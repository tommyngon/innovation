import os
import re
import threading
from pathlib import Path
from typing import Dict, Optional, Tuple

MODEL_ID = "facebook/nllb-200-distilled-600M"
CODES = {"no": "nob_Latn", "nb": "nob_Latn", "en": "eng_Latn"}
_tok = _model = _dev = None
_lock = threading.Lock()
_run_lock = threading.Lock()


def loaded() -> bool:
    return _model is not None


def available() -> bool:
    """True if the local model files are cached (can be lazily loaded)."""
    try:
        from huggingface_hub import try_to_load_from_cache
        return isinstance(try_to_load_from_cache(MODEL_ID, "config.json"), str)
    except Exception:
        return False


def load():
    global _tok, _model, _dev
    with _lock:
        if _model is not None:
            return
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        tok = AutoTokenizer.from_pretrained(MODEL_ID)
        m = AutoModelForSeq2SeqLM.from_pretrained(MODEL_ID).eval()
        dev = "cpu"
        if torch.backends.mps.is_available():
            try:
                m = m.to("mps")
                dev = "mps"
            except Exception:
                m = m.to("cpu")
        _tok, _model, _dev = tok, m, dev


def _gen(text: str, s: str, t: str) -> str:
    import torch
    _tok.src_lang = CODES[s]
    enc = _tok(text, return_tensors="pt").to(_dev)
    with torch.no_grad():
        out = _model.generate(**enc, forced_bos_token_id=_tok.convert_tokens_to_ids(CODES[t]),
                              max_new_tokens=256, num_beams=4)
    return _tok.batch_decode(out, skip_special_tokens=True)[0].strip()


def _local(text: str, s: str, t: str) -> str:
    load()
    parts = [p for p in re.split(r"(?<=[.!?])\s+|\n+", text.strip()) if p.strip()]
    if len(parts) <= 3:  # keep context: translate the whole utterance at once
        parts = [" ".join(parts)]
    with _run_lock:
        try:
            return " ".join(_gen(p, s, t) for p in parts)
        except Exception:
            global _model, _dev
            if _dev == "cpu":
                raise
            _model, _dev = _model.to("cpu"), "cpu"
            return " ".join(_gen(p, s, t) for p in parts)


_PAIRS = [
    ("Jeg har vondt", "I am in pain"),
    ("Jeg trenger hjelp", "I need help"),
    ("Jeg er tørst", "I am thirsty"),
    ("Jeg trenger å gå på do", "I need to use the toilet"),
    ("Jeg er kvalm", "I feel nauseous"),
    ("Jeg fryser", "I am cold"),
    ("Jeg er varm", "I am hot"),
    ("Jeg har vondt i magen", "I have stomach pain"),
    ("Legen kommer om ti minutter", "The doctor will come in ten minutes"),
    ("Har du smerter?", "Are you in pain?"),
    ("Hvordan har du det?", "How are you feeling?"),
    ("Takk", "Thank you"),
    ("Ja", "Yes"),
    ("Nei", "No"),
]


def _norm(s: str) -> str:
    return re.sub(r"[^\w ]", "", s.lower()).strip()


def _demo(text: str, s: str, t: str) -> str:
    n = _norm(text)
    for no, en in _PAIRS:
        if n == _norm(no if s == "no" else en):
            return en if t == "en" else no
    return "[DEMO] " + text


def _hpc(text: str, s: str, t: str) -> str:
    raise RuntimeError("hpc is handled by providers.clinical")


def translate(text: str, src: str, tgt: str, provider: str = "local") -> str:
    src = "no" if src == "nb" else src
    tgt = "no" if tgt == "nb" else tgt
    if src == tgt:
        return text
    return {"local": _local, "demo": _demo, "hpc": _hpc}[provider](text, src, tgt)
