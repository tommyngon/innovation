import io
from typing import Optional
import os
import time
import wave
from pathlib import Path

import httpx
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE = Path(__file__).parent
load_dotenv(BASE / ".env")
API_KEY = os.getenv("IDUN_API_KEY", "").strip()
BASE_URL = os.getenv("IDUN_BASE_URL", "https://llm.hpc.ntnu.no/v1").rstrip("/")
VPN_MSG = "IDUN not reachable — connect to NTNU VPN"

app = FastAPI(title="ai-lab")


@app.middleware("http")
async def no_cache(request: Request, call_next):
    # Dev tool: always serve fresh JS/CSS so edits show up on reload
    resp = await call_next(request)
    if not request.url.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


def headers():
    return {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}


def get_device():
    try:
        import torch
        return "mps" if torch.backends.mps.is_available() else "cpu"
    except Exception:
        return "cpu"


@app.get("/api/health")
async def health():
    reachable = False
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"{BASE_URL}/models", headers=headers())
            reachable = r.status_code < 500
    except Exception:
        pass
    return {"key_configured": bool(API_KEY), "idun_reachable": reachable, "device": get_device()}


@app.get("/api/models")
async def models():
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(f"{BASE_URL}/models", headers=headers())
        return JSONResponse(r.json(), status_code=r.status_code)
    except (httpx.TransportError, httpx.TimeoutException):
        return JSONResponse({"error": VPN_MSG}, status_code=503)


class ChatReq(BaseModel):
    model: str
    messages: list
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


@app.post("/api/chat")
async def chat(req: ChatReq):
    body = req.model_dump(exclude_none=True)
    body["stream"] = True
    client = httpx.AsyncClient(timeout=httpx.Timeout(300, connect=10))
    try:
        r = await client.send(
            client.build_request("POST", f"{BASE_URL}/chat/completions", headers=headers(), json=body),
            stream=True,
        )
    except (httpx.TransportError, httpx.TimeoutException):
        await client.aclose()
        return JSONResponse({"error": VPN_MSG}, status_code=503)

    if r.status_code >= 400:
        txt = (await r.aread()).decode("utf-8", "replace")
        await r.aclose()
        await client.aclose()
        return JSONResponse({"error": txt[:1000]}, status_code=r.status_code)

    async def gen():
        try:
            async for chunk in r.aiter_raw():
                yield chunk
        finally:
            await r.aclose()
            await client.aclose()

    return StreamingResponse(gen(), media_type="text/event-stream")


_pipes = {}


def get_pipe(model_id):
    if model_id in _pipes:
        return _pipes[model_id]
    import torch
    from transformers import pipeline
    dev = get_device()
    try:
        p = pipeline("automatic-speech-recognition", model=model_id, device=dev, torch_dtype=torch.float32)
    except Exception:
        if dev == "cpu":
            raise
        p = pipeline("automatic-speech-recognition", model=model_id, device="cpu", torch_dtype=torch.float32)
    _pipes[model_id] = p
    return p


def run_asr(model_id, audio, language, task, timestamps, beams):
    kw = {"task": task, "language": language}
    if beams and beams > 1:
        kw["num_beams"] = beams
    inp = {"raw": audio, "sampling_rate": 16000}
    p = get_pipe(model_id)
    try:
        return p(inp, chunk_length_s=28, return_timestamps=timestamps, generate_kwargs=kw)
    except Exception:
        if str(p.device).startswith("mps"):
            _pipes.pop(model_id, None)
            import torch
            from transformers import pipeline
            p = pipeline("automatic-speech-recognition", model=model_id, device="cpu", torch_dtype=torch.float32)
            _pipes[model_id] = p
            return p(inp, chunk_length_s=28, return_timestamps=timestamps, generate_kwargs=kw)
        raise


def decode_wav(data: bytes):
    with wave.open(io.BytesIO(data)) as w:
        if w.getsampwidth() != 2:
            raise ValueError("Expected PCM16 WAV")
        ch, sr = w.getnchannels(), w.getframerate()
        a = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    if sr != 16000:
        raise ValueError(f"Expected 16kHz, got {sr}")
    return a


@app.post("/api/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form("NbAiLab/nb-whisper-small"),
    language: str = Form("no"),
    task: str = Form("transcribe"),
    timestamps: bool = Form(False),
    beams: int = Form(1),
):
    if not model.startswith("NbAiLab/nb-whisper"):
        raise HTTPException(400, "Unsupported model")
    if language not in ("no", "nn", "en") or task not in ("transcribe", "translate"):
        raise HTTPException(400, "Bad language/task")
    try:
        audio = decode_wav(await file.read())
    except Exception as e:
        raise HTTPException(400, f"Invalid WAV: {e}")
    t0 = time.time()
    try:
        out = await run_in_threadpool(run_asr, model, audio, language, task, timestamps, beams)
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {e}")
    chunks = [
        {"start": (c["timestamp"] or [None, None])[0], "end": (c["timestamp"] or [None, None])[1], "text": c["text"]}
        for c in out.get("chunks", [])
    ]
    return {
        "text": out["text"].strip(),
        "chunks": chunks,
        "seconds_audio": round(len(audio) / 16000, 2),
        "seconds_elapsed": round(time.time() - t0, 2),
        "model": model,
    }


class TranslateReq(BaseModel):
    text: str
    source: str
    target: str
    model: str


LANG = {"no": "Norwegian", "nb": "Norwegian", "nn": "Norwegian Nynorsk", "en": "English"}


@app.post("/api/translate")
async def translate(req: TranslateReq):
    s, t = LANG.get(req.source, req.source), LANG.get(req.target, req.target)
    sys_prompt = (
        f"You are a translation engine. Translate the user's text from {s} to {t}. "
        "Output ONLY the translation: no explanations, no quotes, no notes. Preserve meaning, tone and line breaks."
    )
    body = {
        "model": req.model,
        # Instruction repeated in the user turn: some models (e.g. borealis-27b) ignore the system role
        "messages": [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": f"Translate from {s} to {t}. Output only the translation.\n\n{req.text}"},
        ],
        "temperature": 0.1,
    }
    try:
        async with httpx.AsyncClient(timeout=120) as c:
            r = await c.post(f"{BASE_URL}/chat/completions", headers=headers(), json=body)
    except (httpx.TransportError, httpx.TimeoutException):
        return JSONResponse({"error": VPN_MSG}, status_code=503)
    if r.status_code >= 400:
        return JSONResponse({"error": r.text[:1000]}, status_code=r.status_code)
    return {"text": r.json()["choices"][0]["message"]["content"].strip()}


app.mount("/", StaticFiles(directory=BASE / "static", html=True), name="static")
