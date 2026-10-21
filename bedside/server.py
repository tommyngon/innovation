import asyncio
import io
import json
import logging
import os
import threading
import time
import uuid
import wave
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
from fastapi import FastAPI, File, Form, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from providers import asr, clinical, mt

BASE = Path(__file__).parent
log = logging.getLogger("bedside")
logging.basicConfig(level=logging.INFO)
app = FastAPI()

STATE = {"mode": os.getenv("BEDSIDE_MODE", "live"), "asr": False, "asr_fast": False, "mt": False}


def _preload():
    # NLLB is NOT loaded here: it loads lazily on first local-fallback translation (saves ~2.4 GB RAM)
    threading.Thread(target=clinical.hpc_warmup, daemon=True).start()  # open TLS connection early
    ok = 0
    for lang in ("no", "en"):  # accurate (final) pipelines first: they gate ready.asr
        try:
            asr.warm_up(lang, "final")
            ok += 1
        except Exception as e:
            log.error("ASR final %s load failed: %s", lang, type(e).__name__)
    if ok == 2:
        STATE["asr"] = True
    elif ok == 0:
        STATE["mode"] = "demo"
    fast = 0
    for lang in ("no", "en"):
        try:
            asr.warm_up(lang, "fast")
            fast += 1
        except Exception as e:
            log.error("ASR fast %s load failed: %s", lang, type(e).__name__)
    STATE["asr_fast"] = fast == 2


@app.on_event("startup")
def _startup():
    if STATE["mode"] == "live":
        threading.Thread(target=_preload, daemon=True).start()


@app.middleware("http")
async def no_store(request, call_next):
    resp = await call_next(request)
    if not request.url.path.startswith("/api"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


@app.get("/api/status")
async def status():
    demo = STATE["mode"] == "demo"
    reach = await run_in_threadpool(clinical.hpc_reachable)
    eng = "demo" if demo else ("local" if os.getenv("BEDSIDE_MT") == "local" or not reach else "hpc")
    return {"mode": STATE["mode"], "asr_model": asr.MODEL_ID, "mt_model": "phrasebook" if demo else mt.MODEL_ID, "asr_fast_model": asr.FAST_ID,
            "engine": eng, "hpc_reachable": reach, "hpc_model": clinical.MODEL,
            "ready": {"asr": STATE["asr"], "asr_fast": STATE["asr_fast"],
                      "mt": bool(reach or demo or mt.loaded() or mt.available()), "mt_loaded": mt.loaded()}}


@app.get("/api/quick")
def quick():
    return JSONResponse(json.loads(clinical.QUICK_PATH.read_text(encoding="utf-8")))


def decode_wav(data: bytes):
    with wave.open(io.BytesIO(data)) as w:
        if w.getsampwidth() != 2:
            raise ValueError("Expected PCM16 WAV")
        ch, sr = w.getnchannels(), w.getframerate()
        a = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    if sr != 16000:
        raise ValueError("Expected 16kHz, got %d" % sr)
    return a


@app.post("/api/transcribe")
async def transcribe(audio: UploadFile = File(...), lang: str = Form("no"), partial: str = Form("")):
    part = partial.strip().lower() in ("1", "true", "yes")
    if lang not in ("no", "en"):
        return JSONResponse({"error": "bad_lang", "detail": "lang must be no|en"}, 400)
    try:
        pcm = decode_wav(await audio.read())
    except Exception as e:
        return JSONResponse({"error": "bad_audio", "detail": str(e)}, 400)
    if STATE["mode"] == "demo":
        # Demo: audio is ignored; return the next pre-written phrase (UI shows the DEMO badge)
        pairs = mt._PAIRS[:8]
        STATE["demo_i"] = STATE.get("demo_i", -1) + 1
        no, en = pairs[STATE["demo_i"] % len(pairs)]
        return {"text": no if lang == "no" else en, "demo": True, "partial": part}
    if part:
        if not STATE["asr_fast"]:
            return {"text": "", "partial": True, "busy": True}
    elif not STATE["asr"]:
        return JSONResponse({"error": "asr_unavailable", "detail": "ASR model not ready"}, 503)
    t0 = time.time()
    try:
        r = await run_in_threadpool(asr.transcribe, pcm, lang, part)
    except Exception as e:
        return JSONResponse({"error": "transcribe_failed", "detail": type(e).__name__}, 500)
    ms = int((time.time() - t0) * 1000)
    if r.get("busy"):
        return {"text": "", "partial": True, "busy": True, "ms": ms}
    if r["no_speech"]:
        if part:
            return {"text": "", "partial": True, "ms": ms}
        return {"error": "no_speech", "ms": ms}
    return {"text": r["text"], "lang": lang, "engine": r.get("engine"), "partial": part, "ms": ms}


class TReq(BaseModel):
    text: str
    src: str
    tgt: str
    speaker: str = "worker"
    room: str = "1"


def _history(room_id: str):
    rm = rooms.get(room_id)
    if not rm:
        return []
    return [{"from": m["from"], "text": m["originalText"]} for m in rm.messages[-6:]]


def translate_full(text, src, tgt, speaker, history, mode=None):
    """Full pipeline: hpc -> local fallback -> demo. Never logs text. Adds server time `ms`."""
    t0 = time.time()
    r = _translate_full(text, src, tgt, speaker, history, mode)
    r["ms"] = int((time.time() - t0) * 1000)
    return r


def _translate_full(text, src, tgt, speaker, history, mode=None):
    src = "no" if src == "nb" else src
    tgt = "no" if tgt == "nb" else tgt
    text = text.strip()
    if src == tgt:
        return {"text": text, "engine": "local", "status": "ok", "confidence": "high", "needs_clarification": False,
                "clarify_question": None, "back_translation": None, "check": "skipped", "warnings": [],
                "uncertain_terms": []}
    mode = mode or STATE["mode"]
    pb = clinical.quick_match(text, src, tgt)
    if mode == "demo":
        r = clinical.fallback_result(mt.translate(text, src, tgt, "demo"), "demo", text, src, tgt)
        if pb:
            r.update(text=pb, status="ok", warnings=[], needs_clarification=False, confidence="high")
        return r
    if os.getenv("BEDSIDE_MT") != "local":
        try:
            r = clinical.translate_hpc(text, src, tgt, speaker, history)
            if r["text"]:
                return r
        except Exception as e:
            log.warning("hpc translate failed: %s", type(e).__name__)
    r = clinical.fallback_result(mt.translate(text, src, tgt, "local"), "local", text, src, tgt)
    if pb:
        r.update(text=pb, status="ok", warnings=[], needs_clarification=False, confidence="high")
    return r


@app.post("/api/translate")
async def translate(req: TReq):
    if req.src not in ("no", "en", "nb") or req.tgt not in ("no", "en", "nb"):
        return JSONResponse({"error": "translate_failed", "detail": "unsupported language"}, 400)
    if req.speaker not in ("patient", "worker"):
        return JSONResponse({"error": "translate_failed", "detail": "bad speaker"}, 400)
    if not req.text.strip():
        return JSONResponse({"error": "translate_failed", "detail": "empty text"}, 400)
    try:
        return await run_in_threadpool(translate_full, req.text, req.src, req.tgt, req.speaker, _history(req.room))
    except Exception as e:
        return JSONResponse({"error": "translate_failed", "detail": type(e).__name__}, 502)


# ---------- WebSocket hub ----------
class Room:
    def __init__(self, rid="1"):
        self.rid = rid
        self.tasks = []  # [{id,text,room,done}] merged across summary regenerations
        self.conns = []  # (role, ws)
        self.messages = []
        self.lang = {"patient": "no", "worker": "en"}
        self.summary = None
        self.sum_task = None
        self.call = None  # ts of an unacknowledged "call a person"; survives page reloads until acknowledged

    def peers(self):
        return {r: any(x == r for x, _ in self.conns) for r in ("patient", "worker")}


rooms = {}


SUMMARY_DEBOUNCE = 2.0


def _compose(rm, sm):
    """Attach the room's merged task list (order: open first, then done) to a generated summary."""
    wl = rm.lang["worker"]
    rm.tasks = clinical.merge_tasks(rm.tasks, sm.get("tasks") or [], rm.rid, wl)
    out = dict(sm)
    out["tasks"] = rm.tasks
    return out


def _view(rm):
    if rm.summary is None:
        return None
    v = dict(rm.summary)
    v["tasks"] = sorted(rm.tasks, key=lambda t: bool(t.get("done")))
    return v


async def _summarize_later(rm):
    try:
        await asyncio.sleep(SUMMARY_DEBOUNCE)
        snap, langs, ex = list(rm.messages), dict(rm.lang), list(rm.tasks)
        sm = await run_in_threadpool(clinical.summarize, snap, langs, rm.rid, ex)
        rm.summary = _compose(rm, sm)
        await bcast(rm, {"type": "summary", "summary": _view(rm)})
    except asyncio.CancelledError:
        pass
    except Exception as e:
        log.warning("summary failed: %s", type(e).__name__)


def schedule_summary(rm):
    if rm.sum_task and not rm.sum_task.done():
        rm.sum_task.cancel()
    rm.sum_task = asyncio.ensure_future(_summarize_later(rm))


async def bcast(room, payload, only_role=None):
    for role, ws in list(room.conns):
        if only_role and role != only_role:
            continue
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            pass


@app.websocket("/ws")
async def ws_hub(ws: WebSocket, room: str = "1", role: str = "patient"):
    await ws.accept()
    if role not in ("patient", "worker"):
        await ws.close(code=1008)
        return
    rm = rooms.setdefault(room, Room(room))
    rm.conns.append((role, ws))
    log.info("ws connect %s", role)
    await ws.send_text(json.dumps({"type": "state", "lang": rm.lang, "messages": rm.messages, "peers": rm.peers(), "summary": _view(rm), "call": rm.call}))
    await bcast(rm, dict(type="peers", **rm.peers()))
    # deliver anything pending for this role
    for m in rm.messages:
        if m["from"] != role and m["status"] == "sent":
            m["status"] = "delivered"
            await bcast(rm, {"type": "status", "id": m["id"], "status": "delivered"})
    try:
        while True:
            d = json.loads(await ws.receive_text())
            t = d.get("type")
            log.info("ws event %s", t)
            if t == "send":
                frm = d.get("from", role)
                m = {"id": uuid.uuid4().hex[:12], "from": frm, "originalText": d.get("originalText", ""),
                     "originalLang": d.get("originalLang"), "translatedText": d.get("translatedText", ""),
                     "targetLang": d.get("targetLang"), "ts": int(time.time() * 1000), "status": "sent",
                     "engine": d.get("engine") or ("phrasebook" if d.get("quick") else None),
                     "quality": d.get("quality") or ("ok" if d.get("quick") else "unsure"),
                     "warnings": d.get("warnings") or [], "back_translation": d.get("back_translation"),
                     "quick": bool(d.get("quick"))}
                rm.messages.append(m)
                await bcast(rm, {"type": "message", "message": m})
                schedule_summary(rm)
                other = "worker" if frm == "patient" else "patient"
                if rm.peers()[other]:
                    m["status"] = "delivered"
                    await bcast(rm, {"type": "status", "id": m["id"], "status": "delivered"})
            elif t == "seen":
                for m in rm.messages:
                    if m["id"] == d.get("id"):
                        m["status"] = "seen"
                        await bcast(rm, {"type": "status", "id": m["id"], "status": "seen"})
            elif t == "task_toggle":
                for tk in rm.tasks:
                    if tk["id"] == d.get("id"):
                        tk["done"] = not tk.get("done")
                        if rm.summary is not None:
                            await bcast(rm, {"type": "summary", "summary": _view(rm)})
                        break
            elif t == "call_person":
                rm.call = rm.call or int(time.time() * 1000)
                await bcast(rm, {"type": "call_person", "ts": rm.call})
            elif t == "ack_call":
                rm.call = None
                await bcast(rm, {"type": "ack_call"})
            elif t == "set_lang":
                rm.lang = {"patient": d.get("patient", rm.lang["patient"]), "worker": d.get("worker", rm.lang["worker"])}
                await bcast(rm, dict(type="lang", **rm.lang))
                if rm.messages:
                    schedule_summary(rm)
            elif t == "clear":
                rm.messages.clear()
                rm.call = None
                rm.summary = None
                rm.tasks = []
                if rm.sum_task and not rm.sum_task.done():
                    rm.sum_task.cancel()
                await bcast(rm, {"type": "cleared"})
    except (WebSocketDisconnect, RuntimeError, ValueError):
        pass
    finally:
        if (role, ws) in rm.conns:
            rm.conns.remove((role, ws))
        await bcast(rm, dict(type="peers", **rm.peers()))


def _page(name):
    return lambda: FileResponse(BASE / "static" / name)


for _p, _f in (("/", "translate.html"), ("/translate", "translate.html"), ("/worker", "worker.html"), ("/demo", "demo.html")):
    app.add_api_route(_p, _page(_f), methods=["GET"], include_in_schema=False)

app.mount("/static", StaticFiles(directory=BASE / "static"), name="static")
