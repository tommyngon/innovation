const $ = (id) => document.getElementById(id);
const KNOWN = ["openai/gpt-oss-120b","NbAiLab/borealis-27b","NorwAI/NorwAI-Magistral-24B-reasoning","norallm/normistral-11b-thinking","moonshotai/Kimi-K2.6","Qwen/Qwen3.8-27B-FP8","mistralai/Mistral-Medium-3.5-128B","Inferact/GLM-5.3-NVFP4"];
// Non-chat models on IDUN: decision model, OCR, embeddings
const NON_CHAT = /clef-flash|GLM-OCR|Embedding|e5-large/i;
const DEFAULT_MODEL = "openai/gpt-oss-120b";

document.querySelectorAll(".tab").forEach((b) => b.onclick = () => {
  document.querySelectorAll(".tab,.panel").forEach((e) => e.classList.remove("active"));
  b.classList.add("active"); $(b.dataset.tab).classList.add("active");
});

function pill(id, text, ok) { const e = $(id); e.textContent = text; e.className = "pill " + (ok ? "ok" : "bad"); }
async function health() {
  try {
    const h = await (await fetch("/api/health")).json();
    pill("s-key", "key: " + (h.key_configured ? "set" : "missing"), h.key_configured);
    pill("s-idun", "IDUN: " + (h.idun_reachable ? "reachable" : "unreachable (VPN?)"), h.idun_reachable);
    $("s-dev").textContent = "device: " + h.device;
  } catch { pill("s-idun", "server down", false); }
}
async function loadModels() {
  let ids = KNOWN;
  try {
    const r = await fetch("/api/models");
    if (r.ok) { const j = await r.json(); const l = (j.data || []).map((m) => m.id).filter((i) => !NON_CHAT.test(i)); if (l.length) ids = l; }
  } catch {}
  for (const s of [$("model"), $("tmodel")]) {
    s.innerHTML = ids.map((i) => `<option>${i}</option>`).join("");
    if (ids.includes(DEFAULT_MODEL)) s.value = DEFAULT_MODEL;
  }
}
health(); loadModels(); setInterval(health, 30000);

// ---- Chat ----
let history = [];
function addMsg(role, text) {
  const d = document.createElement("div"); d.className = "msg " + role; d.textContent = text;
  $("log").appendChild(d); $("log").scrollTop = 1e9; return d;
}
$("clear").onclick = () => { history = []; $("log").innerHTML = ""; };
$("input").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) $("send").click(); });
$("send").onclick = async () => {
  const text = $("input").value.trim(); if (!text) return;
  $("input").value = ""; history.push({ role: "user", content: text }); addMsg("user", text);
  const el = addMsg("assistant", ""); $("send").disabled = true;
  const sys = $("system").value.trim();
  const messages = (sys ? [{ role: "system", content: sys }] : []).concat(history);
  let acc = "";
  try {
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: $("model").value, messages, temperature: parseFloat($("temp").value) }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || j.detail || r.status); }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "";
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim(); if (d === "[DONE]") continue;
        try { const delta = JSON.parse(d).choices?.[0]?.delta; acc += delta?.content || ""; el.textContent = acc; $("log").scrollTop = 1e9; } catch {}
      }
    }
    history.push({ role: "assistant", content: acc });
  } catch (e) { el.classList.add("err"); el.textContent = "Error: " + e.message; history.pop(); }
  $("send").disabled = false;
};

// ---- Transcription ----
let blob = null, recorder = null, chunks = [];
function setAudio(b) { blob = b; $("go").disabled = !b; $("player").src = URL.createObjectURL(b); $("player").hidden = false; }
$("file").onchange = (e) => { if (e.target.files[0]) setAudio(e.target.files[0]); };
$("rec").onclick = async () => {
  if (recorder && recorder.state === "recording") { recorder.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream); chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      $("rec").textContent = "● Record"; $("rec").classList.remove("rec"); $("recinfo").textContent = "";
      setAudio(new Blob(chunks, { type: recorder.mimeType }));
    };
    recorder.start(); $("rec").textContent = "■ Stop"; $("rec").classList.add("rec"); $("recinfo").textContent = "Recording…";
  } catch (e) { $("recinfo").textContent = "Mic error: " + e.message; }
};

async function toWav16k(b) {
  const buf = await new AudioContext().decodeAudioData(await b.arrayBuffer());
  const len = Math.ceil(buf.duration * 16000);
  const oc = new OfflineAudioContext(1, len, 16000);
  const src = oc.createBufferSource(); src.buffer = buf; src.connect(oc.destination); src.start();
  const pcm = (await oc.startRendering()).getChannelData(0);
  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); out.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVEfmt ");
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, 16000, true); out.setUint32(28, 32000, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
  w(36, "data"); out.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return new Blob([out], { type: "audio/wav" });
}
const fmt = (s) => (s == null ? "?" : s.toFixed(1) + "s");

$("go").onclick = async () => {
  $("go").disabled = true; $("out").value = ""; $("segs").innerHTML = ""; $("meta").textContent = "";
  $("busy").textContent = "⏳ Converting audio… (first run downloads the model from Hugging Face — can take minutes)";
  try {
    const wav = await toWav16k(blob);
    $("busy").textContent = "⏳ Transcribing… (first run downloads the model — can take minutes)";
    const fd = new FormData();
    fd.append("file", wav, "audio.wav"); fd.append("model", $("wmodel").value); fd.append("language", $("lang").value);
    fd.append("task", $("task").value); fd.append("timestamps", $("ts").checked); fd.append("beams", $("beams").value);
    const r = await fetch("/api/transcribe", { method: "POST", body: fd });
    const j = await r.json(); if (!r.ok) throw new Error(j.detail || j.error || r.status);
    $("out").value = j.text;
    $("meta").textContent = `${j.model} · audio ${j.seconds_audio}s · processed in ${j.seconds_elapsed}s`;
    $("segs").innerHTML = j.chunks.map((c) => `<div class="seg"><code>${fmt(c.start)}–${fmt(c.end)}</code><span></span></div>`).join("");
    [...$("segs").querySelectorAll("span")].forEach((s, i) => (s.textContent = j.chunks[i].text));
    $("busy").textContent = "";
  } catch (e) { $("busy").textContent = "Error: " + e.message; }
  $("go").disabled = false;
};

async function translate(source, target) {
  const text = $("out").value.trim(); if (!text) return;
  $("trout").value = "…";
  try {
    const r = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source, target, model: $("tmodel").value }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || j.detail);
    $("trout").value = j.text;
  } catch (e) { $("trout").value = "Error: " + e.message; }
}
$("tr-en").onclick = () => translate("no", "en");
$("tr-no").onclick = () => translate("en", "no");
$("tochat").onclick = () => {
  $("input").value = $("out").value; $("model").value = $("tmodel").value;
  document.querySelector('[data-tab="chat"]').click(); $("input").focus();
};
