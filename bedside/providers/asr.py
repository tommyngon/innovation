import os
import re
import threading

import numpy as np

MODEL_NO = "NbAiLab/nb-whisper-small"
MODEL_EN = "openai/whisper-small.en"
FAST_NO = "NbAiLab/nb-whisper-base"
FAST_EN = "openai/whisper-base.en"
EN_ONLY = (MODEL_EN, FAST_EN)  # English-only Whisper rejects task/language arguments
MODEL_ID = MODEL_NO + " + " + MODEL_EN
FAST_ID = FAST_NO + " + " + FAST_EN
_ents = {}  # (tier, lang) -> entry {pipe, model, lock}; tier = "final" | "fast"
_load_lock = threading.Lock()
HALLU = ("teksting av", "undertekster", "takk for at du så på", "subtitles by", "takk for følget",
         "thanks for watching", "thank you for watching", "subscribe", "like and subscribe", "please subscribe",
         "amara.org", "www.", ".com", "copyright", "©", "transcribed by", "see you in the next",
         "thank you so much for watching", "vi sees")


def _device():
    import torch
    return "mps" if torch.backends.mps.is_available() else "cpu"


def _make(model, dev):
    import torch
    from transformers import pipeline
    return pipeline("automatic-speech-recognition", model=model, device=dev, torch_dtype=torch.float32)


def _build(model, fast=False):
    # Draft (live caption) models run on the CPU: measured 0.5 s alone like the GPU, but about 1 s instead of
    # 1.2-3.5 s while the accurate final model is using the GPU (no contention). Override: BEDSIDE_FAST_DEVICE=mps.
    if fast:
        return _make(model, os.environ.get("BEDSIDE_FAST_DEVICE", "cpu"))
    try:
        return _make(model, _device())
    except Exception:
        return _make(model, "cpu")


def _key(lang):
    return "en" if lang == "en" else "no"


def _entry(tier, lang):
    """Entry with its own inference lock. English falls back to the Norwegian model if unavailable."""
    k = (tier, _key(lang))
    with _load_lock:
        if k not in _ents:
            no_m, en_m = (FAST_NO, FAST_EN) if tier == "fast" else (MODEL_NO, MODEL_EN)
            if k[1] == "en":
                try:
                    _ents[k] = {"pipe": _build(en_m, tier == "fast"), "model": en_m, "lock": threading.Lock()}
                except Exception:
                    if (tier, "no") not in _ents:
                        _ents[(tier, "no")] = {"pipe": _build(no_m, tier == "fast"), "model": no_m, "lock": threading.Lock()}
                    _ents[k] = _ents[(tier, "no")]  # shared entry -> shared lock
            else:
                _ents[k] = {"pipe": _build(no_m, tier == "fast"), "model": no_m, "lock": threading.Lock()}
        return _ents[k]


def get_pipe(lang="no", tier="final"):
    e = _entry(tier, lang)
    return e["pipe"], e["model"]


def _hallucinated(text: str) -> bool:
    low = text.lower()
    if not text.strip() or any(h in low for h in HALLU):
        return True
    w = re.findall(r"\w+", low)
    if len(w) >= 6:
        for n in (1, 2, 3, 4):
            seen = {}
            for i in range(len(w) - n + 1):
                g = tuple(w[i:i + n])
                seen[g] = seen.get(g, 0) + 1
                if seen[g] >= 4:
                    return True
    return False


def trim_silence(pcm: np.ndarray, sr: int = 16000, pad_ms: int = 200) -> np.ndarray:
    """Cut leading/trailing silence (less audio to decode, fewer hallucinations on pauses)."""
    fl = int(sr * 0.02)
    n = pcm.size // fl
    if n < 4:
        return pcm
    rms = np.sqrt(np.mean(pcm[:n * fl].reshape(n, fl) ** 2, axis=1))
    thr = max(0.004, float(np.percentile(rms, 95)) * 0.08)
    idx = np.where(rms > thr)[0]
    if idx.size == 0:
        return pcm
    pad = pad_ms // 20
    lo, hi = max(0, int(idx[0]) - pad), min(n, int(idx[-1]) + 1 + pad)
    return pcm[lo * fl:hi * fl] if (hi - lo) * fl >= 4800 else pcm


def _run(p, inp, kw, long_audio):
    if long_audio:
        return p(inp, chunk_length_s=28, generate_kwargs=kw)
    return p(inp, generate_kwargs=kw)


def _kw(model, lang):
    kw = {"num_beams": 1}  # greedy: ~2x faster than beam 5, same text on short phrases
    if model not in EN_ONLY:
        kw["task"] = "transcribe"
        kw["language"] = "en" if lang == "en" else "no"
    return kw


def warm_up(lang: str, tier: str = "final"):
    """Run one dummy 1 s clip so the first real request does not pay kernel-compile/first-run cost."""
    e = _entry(tier, lang)
    dummy = (np.random.RandomState(0).randn(16000) * 0.02).astype(np.float32)
    with e["lock"]:
        try:
            e["pipe"]({"raw": dummy, "sampling_rate": 16000}, generate_kwargs=_kw(e["model"], lang))
        except Exception:
            pass


def transcribe(pcm: np.ndarray, lang: str, partial: bool = False) -> dict:
    """partial=True: fast draft model, non-blocking (busy -> empty text), no hallucination filter."""
    if pcm.size < 1600 or float(np.sqrt(np.mean(pcm ** 2))) < 0.003:
        return {"text": "", "no_speech": True, "partial": partial}
    pcm = trim_silence(pcm)
    e = _entry("fast" if partial else "final", lang)
    lk = e["lock"]
    if partial:
        if not lk.acquire(blocking=False):
            return {"text": "", "no_speech": False, "partial": True, "busy": True}
    else:
        lk.acquire()
    try:
        p, model = e["pipe"], e["model"]
        kw = _kw(model, lang)
        if partial:
            kw["max_new_tokens"] = 120
        inp = {"raw": pcm, "sampling_rate": 16000}
        long_audio = pcm.size > 28 * 16000
        try:
            out = _run(p, inp, kw, long_audio)
        except Exception:
            if not str(p.device).startswith("mps"):
                raise
            p = _make(model, "cpu")
            e["pipe"] = p
            out = _run(p, inp, kw, long_audio)
    finally:
        lk.release()
    text = out["text"].strip()
    if partial:
        return {"text": text, "no_speech": False, "partial": True, "engine": model, "lang": lang}
    if _hallucinated(text):
        return {"text": "", "no_speech": True, "partial": False}
    return {"text": text, "no_speech": False, "partial": False, "engine": model, "lang": lang}
