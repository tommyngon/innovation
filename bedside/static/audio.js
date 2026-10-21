/* Mic capture -> 16 kHz mono PCM16 WAV, plus API helpers. window.BedsideAudio
   start(opts) -> {error} | {stop(), result:Promise<{wav}|{error}>}
   opts: onLevel(rms 0..1), maxMs, silenceMs,
        onPartial(text), partialLang("no"|"en"), partialEveryMs (live captions)
   result: {wav, partial}|{error}                                          */
(function(){
  const SPEECH_MIN=0.02;         // absolute RMS floor for "speech"
  async function toWav16k(chunks, rate){
    let n=0; for(const c of chunks) n+=c.length;
    const all=new Float32Array(n); let o=0; for(const c of chunks){ all.set(c,o); o+=c.length; }
    const ab=new AudioBuffer({length:Math.max(n,1),sampleRate:rate,numberOfChannels:1});
    ab.copyToChannel(all,0);
    const oc=new OfflineAudioContext(1,Math.max(1,Math.ceil(n/rate*16000)),16000);
    const src=oc.createBufferSource(); src.buffer=ab; src.connect(oc.destination); src.start();
    const pcm=(await oc.startRendering()).getChannelData(0);
    const out=new DataView(new ArrayBuffer(44+pcm.length*2));
    const w=(p,s)=>{for(let i=0;i<s.length;i++) out.setUint8(p+i,s.charCodeAt(i));};
    w(0,"RIFF"); out.setUint32(4,36+pcm.length*2,true); w(8,"WAVEfmt ");
    out.setUint32(16,16,true); out.setUint16(20,1,true); out.setUint16(22,1,true);
    out.setUint32(24,16000,true); out.setUint32(28,32000,true); out.setUint16(32,2,true); out.setUint16(34,16,true);
    w(36,"data"); out.setUint32(40,pcm.length*2,true);
    for(let i=0;i<pcm.length;i++) out.setInt16(44+i*2,Math.max(-1,Math.min(1,pcm[i]))*0x7fff,true);
    return new Blob([out],{type:"audio/wav"});
  }

  async function start(opts){
    opts=opts||{};
    const maxMs=opts.maxMs||30000, silenceMs=opts.silenceMs||1600, noSpeechMs=opts.noSpeechMs||7000;
    let stream;
    try{
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) return {error:"mic_denied"};
      stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:false}});
    }catch(e){ return {error:"mic_denied"}; }

    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    if(ctx.state==="suspended"){ try{await ctx.resume();}catch(e){} }
    const rate=ctx.sampleRate;
    const srcNode=ctx.createMediaStreamSource(stream);
    const proc=ctx.createScriptProcessor(4096,1,1);
    const mute=ctx.createGain(); mute.gain.value=0;
    srcNode.connect(proc); proc.connect(mute); mute.connect(ctx.destination);

    const chunks=[]; const t0=performance.now();
    let floorSum=0,floorN=0,floor=null,peak=0,speechStarted=false,lastLoud=0,finished=false,held=false;
    let latestPartial="", partSeq=0, shownSeq=0, partInflight=false, lastPartSamples=0, totalSamples=0, partTimer=null;
    const partEvery=opts.partialEveryMs||900;
    function partialTick(){
      if(finished||partInflight||!opts.partialLang||!opts.onPartial) return;
      if((totalSamples-lastPartSamples)/rate<0.6) return;
      lastPartSamples=totalSamples; partInflight=true;
      const seq=++partSeq, maxSamp=Math.floor(28*rate);
      let sub=[], n=0;
      for(let i=chunks.length-1;i>=0&&n<maxSamp;i--){ sub.unshift(chunks[i]); n+=chunks[i].length; }
      (async()=>{
        try{
          const wav=await toWav16k(sub,rate);
          const fd=new FormData(); fd.append("audio",wav,"audio.wav"); fd.append("lang",opts.partialLang); fd.append("partial","1");
          const r=await fetch("/api/transcribe",{method:"POST",body:fd});
          const j=await r.json();
          const t=(r.ok&&j&&!j.busy&&!j.error&&j.text)?String(j.text).trim():"";
          if(t&&seq>shownSeq){
            shownSeq=seq; latestPartial=t;
            try{ opts.onPartial(t); }catch(e){}
          }
        }catch(e){}
        partInflight=false;
      })();
    }
    if(opts.partialLang&&opts.onPartial) partTimer=setInterval(partialTick,partEvery);
    let resolveFn; const result=new Promise(r=>{resolveFn=r;});

    function finish(){
      if(finished) return; finished=true;
      clearTimeout(maxTimer); clearTimeout(quietTimer); if(partTimer){ clearInterval(partTimer); partTimer=null; }
      try{proc.disconnect();srcNode.disconnect();}catch(e){}
      stream.getTracks().forEach(t=>t.stop());
      ctx.close().catch(()=>{});
      const f=floor==null?0.001:floor;
      const thr=Math.max(SPEECH_MIN,f*3);
      if(!speechStarted||peak<thr){
        // loud floor and no clear peak above it = noise, otherwise nothing said
        if(f>0.04&&peak/Math.max(f,1e-6)<3) return resolveFn({error:"noisy"});
        return resolveFn({error:"no_speech"});
      }
      if(f>0.04&&peak/f<3) return resolveFn({error:"noisy"});
      toWav16k(chunks,rate).then(wav=>resolveFn({wav,partial:latestPartial}),()=>resolveFn({error:"translate_failed"}));
    }
    const maxTimer=setTimeout(finish,maxMs);
    // Nothing said within a few seconds: give kind feedback instead of waiting 30 s
    const quietTimer=setTimeout(()=>{ if(!speechStarted&&!held) finish(); },noSpeechMs);

    proc.onaudioprocess=(e)=>{
      if(finished) return;
      const d=e.inputBuffer.getChannelData(0); chunks.push(new Float32Array(d)); totalSamples+=d.length;
      let s=0; for(let i=0;i<d.length;i++) s+=d[i]*d[i];
      const rms=Math.sqrt(s/d.length), now=performance.now(), el=now-t0;
      if(opts.onLevel) opts.onLevel(rms);
      if(el<400){ floorSum+=rms; floorN++; floor=floorSum/floorN; return; }
      if(rms>peak) peak=rms;
      const thr=Math.max(SPEECH_MIN,(floor||0)*3);
      if(rms>thr){ speechStarted=true; lastLoud=now; }
      else if(speechStarted&&!held&&now-lastLoud>silenceMs) finish();
    };
    // hold(true) suspends silence/no-speech auto-stop (hold-to-talk); hold(false) resumes it
    function hold(on){
      held=!!on;
      if(!held){ lastLoud=performance.now(); if(!speechStarted&&performance.now()-t0>noSpeechMs) finish(); }
    }
    return {stop:finish,hold,result};
  }

  async function postJson(url,body){
    let r;
    try{ r=await fetch(url,body); }catch(e){ return {error:"offline"}; }
    let j=null; try{ j=await r.json(); }catch(e){}
    if(!r.ok||!j||j.error) return {error:(j&&j.error)||"translate_failed",detail:(j&&j.detail)||("HTTP "+r.status)};
    return j;
  }
  async function transcribe(wav,lang){
    const fd=new FormData(); fd.append("audio",wav,"audio.wav"); fd.append("lang",lang);
    const j=await postJson("/api/transcribe",{method:"POST",body:fd});
    if(j.error) return j;
    if(!j.text||!j.text.trim()) return {error:"no_speech"};
    return {text:j.text.trim(),ms:j.ms};
  }
  async function translate(text,src,tgt,speaker,room){
    const j=await postJson("/api/translate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,src,tgt,speaker:speaker||"worker",room:room||"1"})});
    if(j.error) return {error:j.error==="offline"?"offline":"translate_failed",detail:j.detail};
    return j;
  }
  async function quick(){
    try{ const r=await fetch("/api/quick"); if(!r.ok) return null; return await r.json(); }catch(e){ return null; }
  }
  async function status(){
    try{ const r=await fetch("/api/status"); return await r.json(); }catch(e){ return null; }
  }
  window.BedsideAudio={start,transcribe,translate,quick,status};
})();
