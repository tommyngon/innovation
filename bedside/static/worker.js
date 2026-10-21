/* Worker screen v3 */
(function(){
  "use strict";
  const q=new URLSearchParams(location.search), room=q.get("room")||"1";
  let L={patient:"no",worker:"en"}, msgs=[], calls=[], summary=null, quick=[], st=null, online=false;
  let listening=false, handle=null, busy=false, preview=null, errInfo=null, deb=null, pvTok=0, focusTask=null;
  const cache=new Map();
  let panelOpen={};
  try{ panelOpen=JSON.parse(localStorage.getItem("bedside.worker.panels")||"{}")||{}; }catch(e){ panelOpen={}; }
  const savePanels=()=>{ try{ localStorage.setItem("bedside.worker.panels",JSON.stringify(panelOpen)); }catch(e){} };
  const seenIds=new Set();
  const NAME={no:"Norsk",en:"English"};
  const S={
    en:{patient:"Patient",you:"You",room:"Room",swap:"tap to swap languages",ack:"Acknowledge",call:"A person is called – the patient asked for help",
      none:"No messages yet. Speak or type below.",orig:"Original",speak:"Speak",stop:"Stop",listening:"Listening … tap to stop",
      ph:"Or type here …",prev:"Preview",cancel:"Cancel",edit:"Edit",send:"Send",
      delivered:"Delivered",seen:"Seen",sent:"Sent",clear:"Clear conversation",clearAsk:"Wipe all messages?",yes:"Yes, clear",no:"Keep",
      disc:"Machine translation, not certified. Consent, diagnoses and medication changes must be confirmed with a qualified interpreter.",
      discDemo:"DEMO mode: pre-written phrases, not real speech recognition or translation. Machine translation, not certified. Consent, diagnoses and medication changes must be confirmed with a qualified interpreter.",
      offline:"Offline – reconnecting",online:"Connected",working:"Working …",translating:"Translating …",
      verifyTip:"Check with a clinician/translator before real use",quickAria:"Quick phrases",
      demo:"DEMO",offModel:"Offline model",unsureTip:"Translation may be inaccurate",
      sumT:"Summary",todoT:"To-do",factsT:"Key facts",sumEmpty:"Nothing summarised yet. It builds up as you talk.",nothing:"Nothing yet",
      openTasks:"open tasks",sees:"Patient sees"},
    no:{patient:"Pasient",you:"Du",room:"Rom",swap:"trykk for å bytte språk",ack:"Bekreft",call:"En person er kalt – pasienten ba om hjelp",
      none:"Ingen meldinger ennå. Snakk eller skriv under.",orig:"Original",speak:"Snakk",stop:"Stopp",listening:"Lytter … trykk for å stoppe",
      ph:"Eller skriv her …",prev:"Forhåndsvis",cancel:"Avbryt",edit:"Rediger",send:"Send",
      delivered:"Levert",seen:"Sett",sent:"Sendt",clear:"Tøm samtalen",clearAsk:"Slette alle meldinger?",yes:"Ja, tøm",no:"Behold",
      disc:"Maskinoversettelse, ikke sertifisert. Samtykke, diagnoser og endringer i medisinering må bekreftes med kvalifisert tolk.",
      discDemo:"DEMO-modus: ferdigskrevne setninger, ikke ekte talegjenkjenning eller oversettelse. Maskinoversettelse, ikke sertifisert. Samtykke, diagnoser og medisinendringer må bekreftes med kvalifisert tolk.",
      offline:"Frakoblet – kobler til igjen",online:"Tilkoblet",working:"Jobber …",translating:"Oversetter …",
      verifyTip:"Sjekk med lege/tolk før reell bruk",quickAria:"Hurtigfraser",
      demo:"DEMO",offModel:"Offline-modell",unsureTip:"Oversettelsen kan være unøyaktig",
      sumT:"Oppsummering",todoT:"Oppgaver",factsT:"Nøkkelinfo",sumEmpty:"Ingenting oppsummert ennå. Den bygges opp underveis.",nothing:"Ingenting ennå",
      openTasks:"åpne oppgaver",sees:"Pasienten ser"}
  };
  const E={en:{no_speech:"Heard nothing – try again.",noisy:"Too much background noise.",mic_denied:"Microphone blocked in the browser.",
      offline:"Server not reachable.",translate_failed:"Translation failed."},
    no:{no_speech:"Hørte ingenting – prøv igjen.",noisy:"For mye bakgrunnsstøy.",mic_denied:"Mikrofonen er blokkert i nettleseren.",
      offline:"Får ikke kontakt med serveren.",translate_failed:"Oversettelsen feilet."}};
  const t=()=>S[L.worker]||S.en;
  const $=(id)=>document.getElementById(id);
  const el=(tag,cls,txt)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; };
  const ICON={
    mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
    swap:'<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    chev:'<path d="M6 9l6 6 6-6"/>',
    warn:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.01"/>',
    send:'<path d="M4 12l16-8-6 16-2-6z"/>',
    bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>'
  };
  const icon=(n)=>{ const s=document.createElementNS("http://www.w3.org/2000/svg","svg"); s.setAttribute("viewBox","0 0 24 24"); s.setAttribute("class","ic"); s.setAttribute("aria-hidden","true"); s.innerHTML=ICON[n]; return s; };
  const withIcon=(n,txt)=>{ const f=document.createDocumentFragment(); if(n) f.appendChild(icon(n)); f.appendChild(document.createTextNode(txt)); return f; };
  const fmtTime=(ts)=>{ if(!ts) return ""; let d; if(typeof ts==="number") d=new Date(ts>1e12?ts:ts*1000); else d=new Date(ts); if(isNaN(d)) return ""; return d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}); };

  const ws=BedsideWS.create("worker",room,{
    onOpen(){ online=true; renderTop(); },
    onClose(){ online=false; renderTop(); },
    onMessage(m){
      switch(m.type){
        case "state": L=m.lang||L; msgs=(m.messages||[]).map(norm); calls=m.call?[m.call]:[]; if(m.summary) summary=m.summary; renderAll(); break;
        case "message": if(!msgs.find(x=>x.id===m.message.id)) msgs.push(norm(m.message)); renderConv(); break;
        case "status": { const x=msgs.find(y=>y.id===m.id); if(x) x.delivery=m.status; renderConv(); break; }
        case "summary": summary=m.summary; renderSummary(); break;
        case "call_person": calls.push(m.ts||Date.now()); renderCalls(); break;
        case "ack_call": calls=[]; renderCalls(); break;
        case "lang": L={patient:m.patient,worker:m.worker}; if(preview&&!preview.quick) $("txt").value=preview.originalText; preview=null; renderAll(); break;
        case "cleared": msgs=[]; seenIds.clear(); preview=null; summary=null; cache.clear(); renderAll(); break;
      }
    }
  });
  function norm(m){ m.delivery=m.status||"sent"; return m; }
  const warnList=(w)=>Array.isArray(w)?w:[];
  const isUnsure=(m)=>m.quality==="unsure";

  function renderTop(){
    const T=t();
    $("room").textContent=T.room+" "+room;
    const p=$("pair"); p.innerHTML="";
    p.appendChild(document.createTextNode(`${T.patient}: ${NAME[L.patient]}`)); p.appendChild(icon("swap")); p.appendChild(document.createTextNode(`${T.you}: ${NAME[L.worker]}`));
    p.title=T.swap; p.setAttribute("aria-label",`${T.patient}: ${NAME[L.patient]}, ${T.you}: ${NAME[L.worker]} (${T.swap})`);
    const c=$("conn"); c.className="conn"+(online?"":" off"); c.querySelector("span").textContent=online?T.online:T.offline;
    const demo=!!(st&&st.mode==="demo"), offModel=!!(st&&st.engine&&st.engine!=="hpc"&&!demo);
    const b=$("badge"); b.innerHTML="";
    if(demo){ const w=el("span","badge demo"); w.appendChild(el("span",null,T.demo)); b.appendChild(w); }
    else if(offModel) b.appendChild(el("span","badge local",T.offModel));
    $("clearBtn").textContent=T.clear; $("clearYes").textContent=T.yes; $("clearNo").textContent=T.no; $("clearQ").textContent=T.clearAsk;
    $("disc").textContent=demo?T.discDemo:T.disc;
    document.documentElement.lang=L.worker;
    $("mic").setAttribute("aria-pressed",listening?"true":"false");
    $("txt").placeholder=T.ph; $("txt").setAttribute("aria-label",T.ph);
    $("prevBtn").textContent=busy?T.working:T.prev; $("prevBtn").disabled=busy;
    renderMic();
  }
  function renderMic(){
    const T=t(), m=$("mic"); m.innerHTML=""; m.className="btn mic"+(listening?" on":"");
    m.appendChild(withIcon(listening?"stop":"mic",listening?T.listening:`${T.speak} (${NAME[L.worker]})`)); m.disabled=busy&&!listening;
    $("lvl").hidden=!listening;
  }
  function renderCalls(){
    const box=$("calls"); box.innerHTML="";
    if(!calls.length) return;
    const b=el("div","banner"); b.setAttribute("role","alert");
    b.appendChild(icon("bell")); b.appendChild(el("span",null,t().call));
    const btn=el("button","btn ack",t().ack); btn.type="button";
    btn.onclick=()=>{ ws.send({type:"ack_call"}); calls=[]; renderCalls(); };
    b.appendChild(btn); box.appendChild(b);
  }

  function bubble(m){
    const T=t(), mine=m.from==="worker";
    const b=el("article","bubble "+(mine?"worker mine":"patient theirs")+(seenIds.has(m.id)?" old":""));
    seenIds.add(m.id);
    const who=el("div","who",mine?T.you:T.patient); who.appendChild(el("time",null,fmtTime(m.ts))); b.appendChild(who);
    const big=mine?m.originalText:(m.translatedText||m.originalText);
    b.appendChild(el("p","big",big));
    if(mine){ if(m.translatedText&&m.translatedText!==m.originalText) b.appendChild(el("p","orig",`${T.sees} (${NAME[m.targetLang]||m.targetLang||NAME[L.patient]}): ${m.translatedText}`)); }
    else if(m.translatedText&&m.originalText&&m.translatedText!==m.originalText) b.appendChild(el("p","orig",`${T.orig} (${NAME[m.originalLang]||m.originalLang||""}): ${m.originalText}`));
    const unsure=isUnsure(m);
    if(mine||unsure){
      const meta=el("div","meta");
      if(unsure){ const w=el("span","wq"); w.title=T.unsureTip; w.setAttribute("role","img"); w.setAttribute("aria-label",T.unsureTip); w.appendChild(icon("warn")); meta.appendChild(w); }
      if(mine){ const d=m.delivery||"sent"; const c=el("span",d==="seen"?"seen":null,(d==="seen"?"✓✓ ":"✓ ")+(d==="seen"?T.seen:d==="delivered"?T.delivered:T.sent)); meta.appendChild(c); }
      b.appendChild(meta);
    }
    return b;
  }
  function renderConv(){
    const box=$("conv"); const near=box.scrollHeight-box.scrollTop-box.clientHeight<120;
    const before=seenIds.size;
    box.innerHTML="";
    if(!msgs.length){ box.appendChild(el("p","empty",t().none)); return; }
    for(const m of msgs) box.appendChild(bubble(m));
    if(near||seenIds.size!==before) box.scrollTop=box.scrollHeight;
  }

  /* ---- panels: Summary / To-do / Key facts ---- */
  const arr=(x)=>Array.isArray(x)?x:[];
  function panel(key,title,count,fill){
    const T=t(), d=el("details","panel"); d.open=panelOpen[key]!==false;
    const s=el("summary"); s.appendChild(el("span","ptitle",title));
    if(count){ const c=el("span","count",String(count)); c.setAttribute("aria-label",`${count} ${T.openTasks}`); s.appendChild(c); }
    const ch=icon("chev"); ch.classList.add("chev"); s.appendChild(ch);
    d.appendChild(s);
    const body=el("div","pbody"); fill(body); d.appendChild(body);
    d.addEventListener("toggle",()=>{ if(panelOpen[key]!==d.open){ panelOpen[key]=d.open; savePanels(); } });
    return d;
  }
  function roomLabel(r){ if(r==null||r==="") return ""; const x=String(r).trim(); return /^\d+\w?$/.test(x)?`${t().room} ${x}`:x; }
  function taskRow(task){
    const row=el("label","task"+(task.done?" done":""));
    const cb=document.createElement("input"); cb.type="checkbox"; cb.checked=!!task.done; cb.dataset.id=task.id;
    cb.onchange=()=>toggleTask(task.id);
    row.appendChild(cb);
    const box=el("span","box"); box.appendChild(icon("check")); row.appendChild(box);
    row.appendChild(el("span","tt",task.text));
    const rl=roomLabel(task.room); if(rl) row.appendChild(el("span","rchip",rl));
    return row;
  }
  function toggleTask(id){
    const task=arr(summary&&summary.tasks).find(x=>x.id===id); if(!task) return;
    task.done=!task.done; focusTask=id;
    if(!ws.send({type:"task_toggle",id})){ task.done=!task.done; }
    renderSummary();
  }
  function renderSummary(){
    const T=t(), box=$("sum"); box.innerHTML="";
    const sm=summary||{};
    const pts=arr(sm.key_points).filter(Boolean);
    const tasks=arr(sm.tasks).filter(x=>x&&x.text);
    const facts=arr(sm.facts).filter(f=>f&&f.label&&f.value);
    const open=tasks.filter(x=>!x.done).length;
    const wrap=el("div","panels"); wrap.setAttribute("aria-label",T.sumT);
    wrap.appendChild(panel("sum",T.sumT,0,(b)=>{
      if(!pts.length) b.appendChild(el("p","none",T.sumEmpty));
      else { const ul=el("ul"); for(const p of pts) ul.appendChild(el("li",null,p)); b.appendChild(ul); }
    }));
    wrap.appendChild(panel("todo",T.todoT,open,(b)=>{
      if(!tasks.length) b.appendChild(el("p","none",T.nothing));
      else for(const task of tasks.filter(x=>!x.done).concat(tasks.filter(x=>x.done))) b.appendChild(taskRow(task));
    }));
    wrap.appendChild(panel("facts",T.factsT,0,(b)=>{
      if(!facts.length) b.appendChild(el("p","none",T.nothing));
      else { const dl=el("dl","facts"); for(const f of facts){ dl.appendChild(el("dt",null,f.label)); dl.appendChild(el("dd",null,f.value)); } b.appendChild(dl); }
    }));
    box.appendChild(wrap);
    if(focusTask){ const c=box.querySelector(`input[data-id="${CSS.escape(focusTask)}"]`); if(c) c.focus(); focusTask=null; }
  }
  function renderQuick(){
    const T=t(), row=$("qrow"); row.innerHTML=""; row.setAttribute("aria-label",T.quickAria);
    for(const p of quick){
      const txt=p[L.worker]; if(!txt) continue;
      const b=el("button","qp"); b.type="button"; b.textContent=txt; if(p.status==="verify") b.title=T.verifyTip;
      b.onclick=()=>{ errInfo=null; renderErr(); clearTimeout(deb); pvTok++;
        showPreview({originalText:txt,translatedText:p[L.patient]||txt,quick:true,engine:"phrasebook",status:"ok",warnings:[],back_translation:null,loading:false}); };
      row.appendChild(b);
    }
    row.hidden=!row.childNodes.length;
  }
  function renderErr(){
    const box=$("errbox"); box.innerHTML=""; if(!errInfo) return;
    const d=el("div","errline"); d.setAttribute("role","status");
    const EE=E[L.worker]||E.en;
    d.appendChild(document.createTextNode(EE[errInfo.code]||EE.translate_failed));
    d.appendChild(el("p",null,`${errInfo.code}${errInfo.detail?" – "+errInfo.detail:""}`));
    box.appendChild(d);
  }
  function renderPreview(){
    const T=t(), box=$("previewStep"); box.innerHTML="";
    $("inputStep").hidden=!!preview; box.hidden=!preview;
    if(!preview) return;
    const p=preview;
    box.setAttribute("aria-busy",p.loading?"true":"false");
    const big=el("p","big"+(p.loading?" wait":""));
    big.appendChild(document.createTextNode(p.loading?T.translating:p.translatedText));
    if(!p.loading&&p.status==="unsure"){ const w=el("span","wq"); w.title=T.unsureTip; w.setAttribute("role","img"); w.setAttribute("aria-label",T.unsureTip); w.appendChild(icon("warn")); big.appendChild(w); }
    box.appendChild(big);
    box.appendChild(el("p","orig",`${T.orig} (${NAME[L.worker]}): ${p.originalText}`));
    const r=el("div","row");
    const cancel=el("button","btn",T.cancel); cancel.type="button"; cancel.onclick=()=>{ pvTok++; preview=null; $("txt").value=""; renderComposer(); };
    const edit=el("button","btn",T.edit); edit.type="button"; edit.onclick=()=>{ pvTok++; const o=preview.quick?"":preview.originalText; preview=null; $("txt").value=o; renderComposer(); $("txt").focus(); };
    const send=el("button","btn pri"); send.type="button"; send.appendChild(withIcon("send",T.send)); send.disabled=!!p.loading; send.onclick=doSend;
    r.append(cancel,edit,send); box.appendChild(r);
    if(!p.loading) send.focus(); else edit.focus();
  }
  function renderComposer(){ renderPreview(); renderTop(); }
  function renderAll(){ renderTop(); renderCalls(); renderConv(); renderSummary(); renderQuick(); renderComposer(); renderErr(); }

  function showPreview(p){ preview=p; renderComposer(); }

  /* Speculative translation, cached by (src,tgt,text). Entries hold the promise and, once resolved, the result. */
  function getTr(text){
    const key=L.worker+"|"+L.patient+"|"+text;
    let e=cache.get(key); if(e) return e;
    e={result:null};
    const fail=()=>{ cache.delete(key); return {error:"translate_failed"}; };
    const p=(L.worker===L.patient)?Promise.resolve({text,engine:null,status:"ok",warnings:[]}):BedsideAudio.translate(text,L.worker,L.patient,"worker");
    e.promise=Promise.resolve(p).then(r=>{ if(!r||r.error){ cache.delete(key); return r||{error:"translate_failed"}; } e.result=r; return r; },fail);
    cache.set(key,e);
    if(cache.size>50) cache.delete(cache.keys().next().value);
    return e;
  }
  function fillPreview(text,r){
    return {originalText:text,translatedText:r.text,quick:false,engine:r.engine,status:r.status||"ok",warnings:r.warnings||[],
      back_translation:r.back_translation||null,loading:false};
  }
  function openPreview(text){
    clearTimeout(deb);
    errInfo=null; renderErr();
    const e=getTr(text), tok=++pvTok;
    if(e.result){ showPreview(fillPreview(text,e.result)); return; }
    showPreview({originalText:text,translatedText:"",quick:false,status:"ok",warnings:[],loading:true});
    e.promise.then(r=>{
      if(tok!==pvTok||!preview) return;
      if(!r||r.error){ errInfo={code:(r&&r.error)||"translate_failed",detail:r&&r.detail}; preview=null; $("txt").value=text; renderComposer(); renderErr(); return; }
      showPreview(fillPreview(text,r));
    });
  }
  async function toggleMic(){
    if(listening){ handle&&handle.stop(); return; }
    errInfo=null; renderErr();
    let liveOn=true; const tx=$("txt");
    const h=await BedsideAudio.start({
      onLevel(r){ const i=document.querySelector("#lvl i"); if(i) i.style.width=Math.min(100,r*800)+"%"; },
      partialLang:L.worker,
      onPartial(t){ if(!liveOn) return; tx.value=t; tx.classList.add("live"); }
    });
    if(h.error){ errInfo={code:h.error}; renderErr(); return; }
    handle=h; listening=true; renderMic();
    const res=await h.result; handle=null; listening=false;
    const endLive=()=>{ liveOn=false; tx.classList.remove("live"); };
    if(res.error){ if(tx.classList.contains("live")){ tx.value=""; } endLive(); errInfo={code:res.error}; busy=false; renderTop(); renderErr(); return; }
    busy=true; renderTop();
    const r=await BedsideAudio.transcribe(res.wav,L.worker);
    busy=false; endLive();
    if(r.error){ errInfo={code:r.error,detail:r.detail}; renderTop(); renderErr(); return; }
    const text=(r.text||"").trim();
    $("txt").value=text;
    if(!text){ errInfo={code:"no_speech"}; renderTop(); renderErr(); return; }
    openPreview(text);
  }
  function doPreview(){
    const text=$("txt").value.trim(); if(!text||busy) return;
    openPreview(text);
  }
  function doSend(){
    const p=preview; if(!p||p.loading) return;
    const ok=ws.send({type:"send",from:"worker",originalText:p.originalText,originalLang:L.worker,translatedText:p.translatedText,targetLang:L.patient,
      engine:p.engine,quality:p.status,warnings:p.warnings,back_translation:p.back_translation,quick:!!p.quick});
    if(!ok){ errInfo={code:"offline"}; renderErr(); return; }
    pvTok++; preview=null; $("txt").value=""; renderComposer();
  }

  $("pair").onclick=()=>ws.send({type:"set_lang",patient:L.worker,worker:L.patient});
  $("mic").onclick=toggleMic;
  $("prevBtn").onclick=doPreview;
  $("txt").oninput=()=>{ clearTimeout(deb); const v=$("txt").value.trim(); if(!v) return; deb=setTimeout(()=>{ if(!preview) getTr(v); },500); };
  $("txt").onkeydown=(e)=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); doPreview(); } };
  $("clearBtn").onclick=()=>{ $("clearAsk").hidden=false; $("clearBtn").hidden=true; $("clearNo").focus(); };
  $("clearNo").onclick=()=>{ $("clearAsk").hidden=true; $("clearBtn").hidden=false; $("clearBtn").focus(); };
  $("clearYes").onclick=()=>{ ws.send({type:"clear"}); $("clearAsk").hidden=true; $("clearBtn").hidden=false; };

  async function poll(){ const s=await BedsideAudio.status(); if(s){ st=s; renderTop(); } }
  async function loadQuick(){
    try{ const j=BedsideAudio.quick?await BedsideAudio.quick():await (await fetch("/api/quick")).json(); quick=(j&&j.worker)||[]; renderQuick(); }catch(e){}
  }
  renderAll(); poll(); loadQuick(); setInterval(poll,30000);
})();
