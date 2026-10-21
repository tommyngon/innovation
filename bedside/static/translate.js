/* Patient flow v2. States: ready, listening, understanding, confirm, translating, unsure, sent(check), quiet, received, error */
(function(){
  "use strict";
  const q=new URLSearchParams(location.search);
  const room=q.get("room")||"1";
  let lang=q.get("lang")==="en"?"en":"no";   // patient language; WS state overrides
  let workerLang=lang==="no"?"en":"no";
  const S={
    no:{call:"Hent en person",speak:"Snakk",reply:"Svar",done:"Ferdig",ready:"Trykk og snakk",hold:"Hold inne og snakk",tapOnce:"eller trykk én gang",lis:"Jeg lytter …",relDone:"Slipp når du er ferdig",tapDone:"Trykk når du er ferdig",chat:"Samtale",close:"Lukk",
      listening:"Jeg lytter … trykk når du er ferdig",wait:"Et øyeblikk …",translating:"Oversetter …",said:"Du sa:",no:"Nei, prøv igjen",yes:"Ja, send",
      sent:"Sendt",quiet:"Sendt. Se opp – sykepleieren leser nå.",read:"Les høyt",you:"Du",nurse:"Helsepersonell",retry:"Prøv igjen",
      coming:"Noen kommer",onway:"En person er på vei",empty:"Trykk på Snakk, eller bruk et av svarene under.",
      switchTo:"Bytt språk",summary:"Det vi har snakket om",
      unsureTitle:"Jeg er ikke helt sikker på at oversettelsen ble riktig.",again:"Si det igjen",anyway:"Send likevel",
      recvUnsure:"Usikker oversettelse – spør igjen eller hent en person",
      disc:"Maskinoversatt. Viktige beslutninger (samtykke, diagnose, medisiner) må bekreftes med tolk eller en person.",
      discDemo:"DEMO: ferdigskrevne setninger, ikke ekte oversettelse.",demo:"DEMO – ikke ekte oversettelse",live:"LIVE · NTNU",liveGen:"LIVE",local:"LOKAL – usikker",
      err:{no_speech:"Jeg hørte ingenting. Prøv igjen.",noisy:"Det var mye lyd rundt. Prøv igjen, litt nærmere.",
        mic_denied:"Mikrofonen er slått av. En person kan hjelpe.",offline:"Meldingen kom ikke fram. Prøv igjen.",
        translate_failed:"Oversettelsen virker ikke akkurat nå. En person kan hjelpe."}},
    en:{call:"Call a person",speak:"Speak",reply:"Reply",done:"Done",ready:"Tap and speak",hold:"Hold to talk",tapOnce:"or tap once",lis:"Listening …",relDone:"Let go when done",tapDone:"Tap when done",chat:"Conversation",close:"Close",
      listening:"Listening … tap when done",wait:"One moment …",translating:"Translating …",said:"You said:",no:"No, try again",yes:"Yes, send",
      sent:"Sent",quiet:"Sent. Look up – the nurse is reading.",read:"Read aloud",you:"You",nurse:"Nurse",retry:"Try again",
      coming:"Someone is coming",onway:"Someone is on the way",empty:"Tap Speak, or use one of the answers below.",
      switchTo:"Switch language",summary:"What we talked about",
      unsureTitle:"I am not quite sure the translation came out right.",again:"Say it again",anyway:"Send anyway",
      recvUnsure:"Uncertain translation – ask again or call a person",
      disc:"Machine translated. Important decisions (consent, diagnosis, medicines) must be confirmed with an interpreter or a person.",
      discDemo:"DEMO: pre-written phrases, not real translation.",demo:"DEMO – not real translation",live:"LIVE · NTNU",liveGen:"LIVE",local:"LOCAL – uncertain",
      err:{no_speech:"I heard nothing. Try again.",noisy:"There was a lot of noise. Try again, a bit closer.",
        mic_denied:"The microphone is off. A person can help.",offline:"The message did not get through. Try again.",
        translate_failed:"Translation is not working right now. A person can help."}}
  };
  const t=()=>S[lang];
  // 24-grid icons, stroke styled by .ic
  const I={
    mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    stop:'<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/>',
    check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    cross:'<path d="M6 6l12 12M18 6L6 18"/>',
    question:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
    repeat:'<path d="M4 11V9a3 3 0 0 1 3-3h11l-3-3M20 13v2a3 3 0 0 1-3 3H6l3 3"/>',
    slow:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    hand:'<path d="M8 12V5a1.5 1.5 0 0 1 3 0v6M11 10V4a1.5 1.5 0 0 1 3 0v7M14 10V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6 7-2.5 0-4-1.5-5.5-4L4 14a1.5 1.5 0 0 1 2.5-1.5L8 14"/>',
    sound:'<path d="M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    people:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a4.5 4.5 0 0 1 3 4V20"/>',
    swap:'<path d="M4 8h15l-4-4M20 16H5l4 4"/>',
    chev:'<path d="M6 9l6 6 6-6"/>',
    warn:'<path d="M12 3L2 20h20zM12 10v5M12 18h.01"/>',
    ear:'<path d="M8 9a4 4 0 0 1 8 0c0 3-3 3.5-3 6.5a2.5 2.5 0 0 1-5 0"/>',
    waves:'<path d="M2 8c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
    micoff:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M3 3l18 18"/>',
    cloudoff:'<path d="M7 18a5 5 0 0 1-.5-10 6.5 6.5 0 0 1 12.3 1.5A4.2 4.2 0 0 1 18 18zM3 3l18 18"/>',
    bubblex:'<path d="M4 5h16v11H10l-4 4v-4H4zM9.5 8.5l5 4M14.5 8.5l-5 4"/>',
    chat:'<path d="M4 5h16v11H10l-4 4v-4H4z"/>',
    list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'
  };
  const ERRICON={no_speech:"ear",noisy:"waves",mic_denied:"micoff",offline:"cloudoff",translate_failed:"bubblex"};
  const svg=(n)=>`<svg class="ic" aria-hidden="true" viewBox="0 0 24 24">${I[n]||""}</svg>`;
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  // Built-in fallback if /api/quick is unavailable (same six pairs as data/quick_replies.json)
  const QUICK_FALLBACK=[
    {id:"yes",icon:"check",no:"Ja",en:"Yes"},{id:"no",icon:"cross",no:"Nei",en:"No"},
    {id:"not_understand",icon:"question",no:"Jeg forstår ikke",en:"I don't understand"},
    {id:"repeat",icon:"repeat",no:"Kan du gjenta?",en:"Can you say that again?"},
    {id:"slower",icon:"slow",no:"Kan du snakke saktere?",en:"Can you speak more slowly?"},
    {id:"help",icon:"hand",no:"Jeg trenger hjelp",en:"I need help",call_person:true}];
  // Short pill words (the full phrase is what gets sent)
  const PILL={slower:{no:"Snakk saktere",en:"Slower"},repeat:{no:"Kan du gjenta?",en:"Say again"},not_understand:{no:"Jeg forstår ikke",en:"I don't understand"}};
  let quickList=QUICK_FALLBACK;

  let state="ready", ctx={};   // ctx: text, error, msg, r
  let queue=[], handle=null, ttsOK=false, pending=null, quietBase=false, sentTimer=null;
  let confirmedText=null;      // kept so an offline retry resends instead of asking the patient to speak again
  let seenTimer=null, callTimer=null, mode=null, engine=null;
  let turns=[], turnK=0, rendered=new Set(), summary=null;
  let cardMsg=null, unread=0, drawerOpen=false;
  let press=null, wantStop=false, micMode="tap", audioCtx=null;
  const HOLD_MS=400;

  const ws=BedsideWS.create("patient",room,{
    onOpen(){},
    onClose(){},
    onMessage(m){
      if(m.type==="state"){ if(m.call) showCall("coming");
        if(m.lang){ lang=m.lang.patient; workerLang=m.lang.worker; applyLang(); }
        if(m.summary){ summary=m.summary; renderSummary(); }
        const h=m.messages||m.history;
        if(!turns.length&&Array.isArray(h)){
          h.slice(-4).forEach(x=>{ if(x&&(x.from==="patient"||x.from==="worker")){ addTurn(x); } });
          rendered=new Set(turns.map(x=>x.k)); renderConv();
          // Worker messages shown from history (page reload / reconnect) also count as seen once visible
          const unseen=h.slice(-4).filter(x=>x&&x.from==="worker"&&x.status!=="seen");
          if(unseen.length) setTimeout(()=>{ if(document.visibilityState==="visible") unseen.forEach(x=>ws.send({type:"seen",id:x.id})); },1500);
        }
      } else if(m.type==="lang"){ lang=m.patient; workerLang=m.worker; applyLang(); }
      else if(m.type==="summary"){ summary=m.summary||null; renderSummary(); }
      else if(m.type==="message"&&m.message){
        if(m.message.from==="worker") incoming(m.message);
        else if(m.message.from==="patient") echoOwn(m.message);
      }
      else if(m.type==="ack_call"){ showCall("onway"); clearTimeout(callTimer); callTimer=setTimeout(()=>showCall(null),10000); }
      else if(m.type==="cleared"){ queue=[]; cardMsg=null; unread=0; turns=[]; rendered=new Set(); summary=null; renderSummary(); renderConv(); if(state==="received"||state==="quiet") go(quietBase?"quiet":"ready"); }
    }
  });

  /* ---------- conversation model ---------- */
  function textFor(m){
    if(m.originalLang===lang) return m.originalText||m.translatedText||"";
    return m.translatedText||m.originalText||"";
  }
  function addTurn(m,extra){
    const tn=Object.assign({k:++turnK,from:m.from,msg:m,text:textFor(m),quality:m.quality},extra||{});
    turns.push(tn); if(turns.length>12) turns.shift();
    return tn;
  }
  function echoOwn(m){
    const tmp=turns.slice().reverse().find(x=>x.tmp&&x.from==="patient"&&(x.msg.originalText===m.originalText));
    if(tmp){ tmp.tmp=false; tmp.msg=Object.assign({},tmp.msg,m); return; }
    if(turns.some(x=>x.msg&&m.id&&x.msg.id===m.id)) return;
    addTurn(m); renderConv();
  }
  function lastIsQuestion(){
    const l=turns[turns.length-1];
    return !!(l&&l.from==="worker"&&/\?\s*$/.test(l.text||""));
  }

  function renderConv(){
    const box=$("conv"); if(!box) return;
    const T=t(), last=turns.slice(-12);
    if(!last.length){ box.innerHTML=`<p class="empty">${esc(T.empty)}</p>`; }
    else {
      box.innerHTML=last.map(x=>{
        const mine=x.from==="patient";
        const unsure=!mine&&x.quality==="unsure";
        const cls=["bubble",mine?"patient mine":"worker theirs",rendered.has(x.k)?"old":"",unsure?"unsure":""].join(" ");
        const warn=unsure?`<span class="wi" title="${esc(T.recvUnsure)}" aria-label="${esc(T.recvUnsure)}">\u26A0</span>`:"";
        const read=(!mine&&ttsOK)?`<button type="button" class="read" data-k="${x.k}">${svg("sound")}<span>${esc(T.read)}</span></button>`:"";
        return `<div class="${cls}" data-k="${x.k}"><div class="who">${esc(mine?T.you:T.nurse)}${warn}</div><p class="txt" data-t="${x.k}"></p>${read}</div>`;
      }).join("");
      last.forEach(x=>{ const p=box.querySelector(`[data-t="${x.k}"]`); if(p) p.textContent=x.text; rendered.add(x.k); });
      box.querySelectorAll(".read").forEach(b=>{ b.onclick=()=>{ const x=turns.find(y=>String(y.k)===b.dataset.k); if(x) BedsideTTS.speak(x.text,lang); }; });
    }
    renderCard(); renderTab(); renderQuick();
  }

  // ONE compact card for the newest unread worker reply, above the mic
  function renderCard(){
    const el=$("msgcard"), T=t();
    const show=cardMsg&&(state==="ready"||state==="quiet"||state==="received"||state==="listening");
    if(!show){ el.hidden=true; el.innerHTML=""; el.className=""; return; }
    const unsure=cardMsg.quality==="unsure";
    el.hidden=false; el.className="msgcard"+(unsure?" unsure":"");
    el.innerHTML=`<div class="body"><div class="who">${esc(T.nurse)}${unsure?`<span class="wi" title="${esc(T.recvUnsure)}" aria-label="${esc(T.recvUnsure)}">\u26A0</span>`:""}</div><p class="mt" id="cardT"></p></div>`+
      (ttsOK?`<button type="button" class="read" id="cardRead">${svg("sound")}<span>${esc(T.read)}</span></button>`:"");
    $("cardT").textContent=textFor(cardMsg);
    const rb=$("cardRead"); if(rb) rb.onclick=()=>BedsideTTS.speak(textFor(cardMsg),lang);
  }

  function renderSummary(){
    const w=$("sumhost"); if(!w) return;
    const raw=summary&&summary.patient;
    const lines=(Array.isArray(raw)?raw:[]).map(x=>typeof x==="string"?x:(x&&x.text)||"").filter(Boolean);
    if(!lines.length){ w.innerHTML=""; return; }
    w.innerHTML=`<div class="sumbody"><h3>${esc(t().summary)}</h3><ul>${lines.map(l=>`<li>${esc(l)}</li>`).join("")}</ul></div>`;
  }

  /* ---------- chat drawer ---------- */
  function renderTab(){
    const b=$("tabBtn"), T=t();
    b.innerHTML=`${svg("chat")}<span class="tl">${esc(T.chat)}</span>${unread?`<span class="badgeN">${unread}</span>`:""}`;
    b.setAttribute("aria-label",T.chat+(unread?` (${unread})`:""));
  }
  function setDrawer(open){
    drawerOpen=open; document.body.classList.toggle("dopen",open);
    $("drawer").setAttribute("aria-hidden",open?"false":"true"); $("tabBtn").setAttribute("aria-expanded",open?"true":"false");
    if(open){ unread=0; renderTab(); $("dclose").focus(); const b=document.querySelector(".dbody"); b.scrollTop=b.scrollHeight; }
    else $("tabBtn").focus();
  }

  /* ---------- top bar ---------- */
  function applyLang(){
    document.documentElement.lang=lang;
    $("callT").textContent=t().call;
    $("dtitle").textContent=t().chat; $("dclose").textContent=t().close;
    ttsOK=false; BedsideTTS.ready(lang).then(ok=>{ ttsOK=ok; renderConv(); });
    turns.forEach(x=>{ x.text=textFor(x.msg); });
    renderBadge(); renderSummary(); render(); renderConv();
  }

  function renderBadge(){
    const b=$("badge"), T=t();
    $("disc").textContent=mode==="demo"?T.discDemo:T.disc;
    // badge ONLY in demo mode (honesty); nothing for live/local engines on the patient screen
    if(mode==="demo"||engine==="demo") b.innerHTML=`<span class="badge demo"><span>${esc(T.demo)}</span></span>`;
    else b.innerHTML="";
  }
  async function pollStatus(){
    const s=await BedsideAudio.status(); if(!s) return;
    const m=s.mode||null, e=s.engine||null;
    if(m!==mode||e!==engine){ mode=m; engine=e; renderBadge(); }
  }
  async function loadQuick(){
    try{
      const j=await BedsideAudio.quick();
      const l=j&&(Array.isArray(j)?j:j.patient);
      if(Array.isArray(l)&&l.length){ quickList=l.slice(0,6); renderQuick(); }
    }catch(e){}
  }

  function showCall(k){
    const el=$("callStatus");
    if(!k){ el.hidden=true; el.innerHTML=""; el.className="callstatus"; return; }
    el.hidden=false; el.className="callstatus"+(k==="onway"?" ok":"");
    el.innerHTML=(k==="onway"?svg("check"):"")+`<span>${esc(t()[k==="onway"?"onway":"coming"])}</span>`;
  }
  /* When embedded in the larger app (iframe), report events to the parent page. See integration/INTEGRATION.md */
  function embedNotify(type,details){
    if(window.parent===window) return;
    try{ window.parent.postMessage({source:"bedside",type,details:details||{},room},"*"); }catch(e){}
  }
  function callPerson(){
    if(!ws.send({type:"call_person"})){ fail("offline"); return; }
    embedNotify("call_person");
    clearTimeout(callTimer); showCall("coming");
  }

  /* ---------- state machine ---------- */
  function go(s,c){
    clearTimeout(sentTimer); clearTimeout(seenTimer);
    state=s; ctx=c||{};
    document.body.dataset.state=s;
    document.body.classList.toggle("quiet",s==="quiet");
    if(s==="quiet") quietBase=true; else if(s==="ready"||s==="listening"||s==="received") quietBase=false;
    render();
    if(s==="received") armSeen();
    if(s==="ready"||s==="quiet") maybeShowQueued();
  }
  function maybeShowQueued(){
    if(queue.length&&(state==="ready"||state==="quiet"||state==="error")) showWorker(queue.shift());
  }
  function showWorker(m){
    addTurn(m); cardMsg=m; if(!drawerOpen) unread++; go("received",{msg:m}); renderConv();
  }
  function incoming(m){
    if(state==="ready"||state==="quiet"||state==="error"||state==="received") showWorker(m);
    else queue.push(m);   // listening / understanding / confirm / translating / unsure / sent: wait
  }
  function armSeen(){
    clearTimeout(seenTimer);
    const m=ctx.msg; if(!m||ctx.seenSent) return;
    if(document.visibilityState!=="visible") return;
    seenTimer=setTimeout(()=>{
      if(state==="received"&&ctx.msg===m&&document.visibilityState==="visible"&&!ctx.seenSent){
        if(ws.send({type:"seen",id:m.id})) ctx.seenSent=true;
      }
    },1500);
  }
  document.addEventListener("visibilitychange",()=>{ if(state==="received") armSeen(); else clearTimeout(seenTimer); });

  const DOTS='<div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>';
  function pillLabel(p){ const o=PILL[p.id]; return (o&&o[lang])||p[lang]||p.no||""; }
  function renderQuick(){
    const host=$("quickrow"), qw=$("quickwrap"); if(!host) return;
    const vis=["ready","quiet","received","listening","sent"].includes(state);
    qw.hidden=!vis; if(!vis) return;
    const on=(state==="ready"||state==="quiet"||state==="received");
    host.className="quick"+(lastIsQuestion()?" yn":"")+(on?"":" off");
    host.innerHTML=quickList.map(p=>`<button type="button" class="qk ${esc(p.id)}" data-q="${esc(p.id)}"${on?"":" disabled"}>${svg(p.icon in I?p.icon:"question")}<span>${esc(pillLabel(p))}</span></button>`).join("");
    host.querySelectorAll(".qk").forEach(b=>{ b.onclick=()=>sendQuick(quickList.find(p=>p.id===b.dataset.q)); });
  }

  function updateMic(){
    const m=$("mic"), T=t(), mw=$("micwrap");
    const hide=state==="confirm"||state==="unsure"||state==="error";
    mw.hidden=hide; if(hide) return;
    let cls="speak", icon=svg("mic"), label=T.hold, sub=T.tapOnce, dis=false;
    if(state==="listening"){ cls+=" listen"; label=T.lis; sub=micMode==="hold"?T.relDone:T.tapDone; if(micMode!=="hold") icon=svg("stop"); }
    else if(state==="understanding"||state==="translating"){ cls+=" think"; dis=true; icon=DOTS; label=state==="translating"?T.translating:T.wait; sub=""; }
    else if(state==="sent"){ cls+=" ok"; dis=true; icon=`<svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><path class="tick" d="M5 12.5l4.5 4.5L19 7.5" pathLength="30"/></svg>`; label=T.sent; sub=""; }
    const keepLvl=m.style.getPropertyValue("--lvl");
    m.className=cls; m.disabled=dis;
    m.innerHTML=`${icon}<span class="lab">${esc(label)}</span>${sub?`<span class="sub">${esc(sub)}</span>`:""}`;
    m.setAttribute("aria-label",label+(sub?". "+sub:""));
    if(state==="listening"&&keepLvl) m.style.setProperty("--lvl",keepLvl); else m.style.removeProperty("--lvl");
  }

  function render(){
    const box=$("statebox"), ctl=$("controls"), T=t();
    let cls="statebox", inner="", live="", controls="";
    switch(state){
      case "ready": live=T.hold; break;
      case "listening": live=T.lis; break;
      case "understanding":
      case "translating": live=state==="translating"?T.translating:T.wait; break;
      case "confirm":
        cls+=" confirm big"; inner=`<div class="body"><p class="lab">${esc(T.said)}</p><p class="st" id="said"></p></div>`; live=T.said+" "+ctx.text;
        controls=`<div class="btnrow two"><button type="button" class="ans no" id="no">${svg("cross")}<span>${esc(T.no)}</span></button><button type="button" class="ans yes" id="yes">${svg("check")}<span>${esc(T.yes)}</span></button></div>`; break;
      case "unsure": {
        cls+=" unsure big";
        const cq=ctx.r&&ctx.r.clarify_question;
        inner=`${svg("warn")}<div class="body"><p class="st">${esc(T.unsureTitle)}</p>${cq?`<p class="lab" id="cq" style="margin-top:8px"></p>`:""}</div>`;
        live=T.unsureTitle+(cq?" "+cq:"");
        controls=`<div class="btnrow three"><button type="button" class="ans retry" id="again">${svg("mic")}<span>${esc(T.again)}</span></button><button type="button" class="ans plain" id="anyway">${svg("check")}<span>${esc(T.anyway)}</span></button><button type="button" class="ans call" id="callUns">${svg("hand")}<span>${esc(T.call)}</span></button></div>`; break; }
      case "sent": live=T.sent; break;
      case "quiet":
        inner=`${svg("people")}<div class="body"><p class="st">${esc(T.quiet)}</p></div>`; live=T.quiet; break;
      case "received":
        live=T.nurse+": "+((ctx.msg&&textFor(ctx.msg))||""); break;
      case "error": {
        const c=ctx.error; cls+=" err big";
        inner=`${svg(ERRICON[c]||"bubblex")}<div class="body"><p class="st">${esc(T.err[c]||T.err.translate_failed)}</p></div>`; live=T.err[c]||"";
        const retry=`<button type="button" class="ans retry" id="retry">${svg("mic")}<span>${esc(T.retry)}</span></button>`;
        const call=`<button type="button" class="ans call" id="callErr">${svg("hand")}<span>${esc(T.call)}</span></button>`;
        controls=`<div class="btnrow two">${(c==="no_speech"||c==="noisy"||c==="offline")?retry+call:call}</div>`; break; }
    }
    box.hidden=!inner; box.className=cls; box.innerHTML=inner; box.setAttribute("aria-label",live);
    if(state==="confirm") $("said").textContent=ctx.text;
    if(state==="unsure"&&$("cq")) $("cq").textContent=ctx.r.clarify_question;
    ctl.innerHTML=controls;
    $("live").textContent=live;
    updateMic(); renderCard(); renderQuick();
    bind();
  }
  function bind(){
    const on=(id,f)=>{ const e=$(id); if(e) e.onclick=f; };
    on("no",()=>{ spec=null; go("ready"); });
    on("yes",()=>send());
    on("again",()=>{ micMode="tap"; startListening(); });
    on("anyway",()=>sendAnyway());
    on("callUns",callPerson);
    on("retry",()=>{
      if(ctx.error==="offline"&&pending) deliver();
      else if(ctx.error==="offline"&&confirmedText){ ctx={text:confirmedText}; spec=null; send(); }
      else { micMode="tap"; startListening(); }
    });
    on("callErr",callPerson);
  }

  /* ---------- hold-to-talk (hold >= 400 ms = push-to-talk; shorter = tap mode) + keyboard ---------- */
  const startable=()=>state==="ready"||state==="quiet"||state==="received";
  function release(cancel){
    const p=press; if(!p) return; press=null;
    if(cancel||performance.now()-p.t>=HOLD_MS){
      micMode="hold"; if(handle){ handle.hold(false); handle.stop(); } else wantStop=true;
    } else { micMode="tap"; if(handle) handle.hold(false); updateMic(); }
  }
  const mic=$("mic");
  mic.addEventListener("contextmenu",e=>e.preventDefault());
  mic.addEventListener("pointerdown",e=>{
    if(e.button>0||mic.disabled) return;
    e.preventDefault();
    if(state==="listening"){ if(handle) handle.stop(); return; }   // second tap in tap mode
    if(!startable()) return;
    try{ mic.setPointerCapture(e.pointerId); }catch(_){}
    press={t:performance.now()}; wantStop=false; micMode="hold";
    startListening();
  });
  mic.addEventListener("pointerup",()=>release(false));
  mic.addEventListener("pointercancel",()=>release(true));
  mic.addEventListener("keydown",e=>{
    if(e.key!==" "&&e.key!=="Enter") return;
    e.preventDefault(); if(e.repeat||mic.disabled) return;
    if(state==="listening"){ if(handle) handle.stop(); }
    else if(startable()){ micMode="tap"; startListening(); }
  });
  mic.addEventListener("keyup",e=>{ if(e.key===" ") e.preventDefault(); });
  mic.addEventListener("click",e=>e.preventDefault());

  /* ---------- earcon (WebAudio, no files) ---------- */
  function cue(up){
    try{
      audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
      if(audioCtx.state==="suspended") audioCtx.resume();
      const f=up?[523,659]:[659,523], t0=audioCtx.currentTime;
      f.forEach((hz,i)=>{
        const o=audioCtx.createOscillator(), g=audioCtx.createGain(), s=t0+i*0.06;
        o.type="sine"; o.frequency.value=hz; o.connect(g); g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0.0001,s); g.gain.exponentialRampToValueAtTime(0.07,s+0.015); g.gain.exponentialRampToValueAtTime(0.0001,s+0.06);
        o.start(s); o.stop(s+0.07);
      });
    }catch(_){}
  }

  function fail(code,detail){ BedsideTTS.stop(); handle=null; go("error",{error:code,detail}); }

  async function startListening(){
    BedsideTTS.stop(); confirmedText=null; spec=null; cue(true);
    const prevMsg=ctx.msg; if(state==="received"&&prevMsg) ctx.seenSent=true;
    const h=await BedsideAudio.start({onLevel(r){
      const el=$("speak"); if(el&&state==="listening"){ const v=Math.min(1,r*8); el.style.setProperty("--lvl",v.toFixed(2)); }
    }});
    if(h.error){ fail(h.error); return; }
    handle=h;
    if(wantStop){ wantStop=false; h.stop(); }
    else if(press) h.hold(true);   // finger still down: no silence auto-stop
    go("listening");
    const res=await h.result; handle=null; press=null;
    if(state!=="listening") return;
    cue(false);
    if(res.error){ fail(res.error); return; }
    go("understanding");
    const r=await BedsideAudio.transcribe(res.wav,lang);
    if(r.error){ fail(r.error,r.detail); return; }
    specStart(r.text);   // speculative translation while the patient reads the transcript
    go("confirm",{text:r.text});
  }

  // speculative translation cache: one entry keyed by (text,src,tgt); never rejects
  let spec=null;
  const specKey=text=>text+"\u0001"+lang+"\u0001"+workerLang;
  function specStart(text){
    if(lang===workerLang) { spec=null; return; }
    const key=specKey(text), e={key,done:false,p:null};
    e.p=Promise.resolve().then(()=>BedsideAudio.translate(text,lang,workerLang,"patient"))
      .catch(err=>({error:"translate_failed",detail:String(err&&err.message||err)}))
      .then(r=>{ e.done=true; return r; });
    spec=e;
  }

  function mkPending(text,tr,extra){
    return Object.assign({type:"send",from:"patient",originalText:text,originalLang:lang,translatedText:tr,targetLang:workerLang,quick:false},extra||{});
  }
  async function send(){
    const text=ctx.text; confirmedText=text;
    if(lang===workerLang){ pending=mkPending(text,text,{quality:"ok",engine:"none",warnings:[]}); deliver(); return; }
    if(!spec||spec.key!==specKey(text)) specStart(text);
    const e=spec;
    if(!e.done) go("translating");   // only show the wait state if still pending
    const r=await e.p;
    if(spec!==e) return;   // discarded meanwhile
    spec=null;
    if(r.error){ fail(r.error,r.detail); return; }
    if(r.status==="unsure"||r.needs_clarification){ go("unsure",{text,r}); return; }
    pending=mkPending(text,r.text,{engine:r.engine,quality:"ok",warnings:r.warnings||[],back_translation:r.back_translation||null});
    deliver();
  }
  function sendAnyway(){
    const r=ctx.r||{}, text=ctx.text; confirmedText=text;
    pending=mkPending(text,r.text,{engine:r.engine,quality:"unsure",warnings:r.warnings||[],back_translation:r.back_translation||null});
    deliver();
  }
  function sendQuick(p){
    if(!p||!(state==="ready"||state==="quiet"||state==="received"||state==="error")) return;
    BedsideTTS.stop();
    if(state==="received"&&ctx.msg) ctx.seenSent=true;
    pending=mkPending(p[lang],p[workerLang],{quick:true,quality:"ok",engine:"phrasebook",warnings:[]});
    confirmedText=null;
    deliver();
    if(p.call_person||p.id==="help") callPerson();
  }
  function deliver(){
    if(!ws.send(pending)){ fail("offline"); return; }
    const p=pending; pending=null; confirmedText=null;
    embedNotify("message",{originalText:p.originalText,originalLang:p.originalLang,translatedText:p.translatedText,targetLang:p.targetLang});
    cardMsg=null; addTurn(p,{tmp:true}); renderConv();
    go("sent");
    sentTimer=setTimeout(()=>go("quiet"),1500);
  }

  embedNotify("ready");   // tells the parent app the service is reachable
  $("callBtn").onclick=callPerson;
  $("tabBtn").onclick=()=>setDrawer(true);
  $("dclose").onclick=()=>setDrawer(false);
  $("overlay").onclick=()=>setDrawer(false);
  document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&drawerOpen) setDrawer(false); });
  applyLang(); go("ready"); renderConv();
  pollStatus(); setInterval(pollStatus,30000);
  loadQuick();
})();
