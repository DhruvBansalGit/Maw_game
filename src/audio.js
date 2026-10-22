// Original procedural sound. No audio files, network fetches, or autoplay.
export class AudioManager {
  constructor(settings){this.settings=settings;this.ctx=null;this.nodes=new Set();this.beatAt=0;this.stepAt=0;this.creakAt=8;this.voiceAt=0;}
  async start(){
    try {
      if(!this.ctx){
        const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return false;
        const ctx=this.ctx=new AudioContext();this.master=ctx.createGain();this.master.connect(ctx.destination);
        this.music=ctx.createGain();this.sfx=ctx.createGain();this.music.connect(this.master);this.sfx.connect(this.master);
        const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-20;compressor.ratio.value=5;compressor.connect(this.music);
        for(const freq of [43,64.7,86.2]){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.value=.055;osc.connect(gain);gain.connect(compressor);osc.start();this.nodes.add(osc);this.nodes.add(gain);}
        const buffer=this.noise=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=buffer.getChannelData(0);
        for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
        const noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=220;
        const gain=ctx.createGain();gain.gain.value=.045;noise.connect(filter);filter.connect(gain);gain.connect(compressor);noise.start();[noise,filter,gain,compressor].forEach(n=>this.nodes.add(n));
        this.apply(this.settings);
      }
      await this.ctx.resume();return true;
    }catch{return false;}
  }
  apply(settings){this.settings=settings;if(!this.ctx)return;const now=this.ctx.currentTime;this.master.gain.setTargetAtTime(settings.muted?0:settings.volume,now,.06);this.sfx.gain.setTargetAtTime(settings.sfx,now,.06);this.music.gain.setTargetAtTime(settings.music,now,.1);}
  tone(freq,duration=.2,volume=.12,type='sine',end=freq,pan=0,delay=0){
    if(!this.ctx || this.ctx.state!=='running')return;
    const ctx=this.ctx,start=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain(),panner=ctx.createStereoPanner();
    osc.type=type;osc.frequency.setValueAtTime(freq,start);osc.frequency.exponentialRampToValueAtTime(Math.max(1,end),start+duration);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    panner.pan.value=Math.max(-1,Math.min(1,pan));osc.connect(gain);gain.connect(panner);panner.connect(this.sfx);osc.start(start);osc.stop(start+duration+.02);
    [osc,gain,panner].forEach(n=>this.nodes.add(n));osc.onended=()=>{[osc,gain,panner].forEach(n=>{n.disconnect();this.nodes.delete(n);});};
  }
  hiss(duration,volume,frequency=800,pan=0){
    if(!this.ctx||this.ctx.state!=='running')return;
    const ctx=this.ctx,now=ctx.currentTime,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),panner=ctx.createStereoPanner();
    source.buffer=this.noise;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=2;
    gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(volume,now+.03);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    panner.pan.value=Math.max(-1,Math.min(1,pan));source.connect(filter);filter.connect(gain);gain.connect(panner);panner.connect(this.sfx);source.start();source.stop(now+duration);
    const nodes=[source,filter,gain,panner];nodes.forEach(n=>this.nodes.add(n));source.onended=()=>nodes.forEach(n=>{n.disconnect();this.nodes.delete(n);});
  }
  event(type){
    switch(type){
      case 'pickup':this.tone(590,.13,.055,'sine',920);break;
      case 'ward':case 'sense':this.tone(140,1,.15,'sine',420);this.tone(210,1.3,.07,'sine',630);break;
      case 'banish':this.hiss(.6,.2,410);this.tone(310,.7,.15,'triangle',45);break;
      case 'blackout':this.hiss(.6,.2,180);this.tone(120,.7,.25,'sawtooth',18);break;
      case 'scream':this.hiss(.6,.19,1800);this.tone(650,.45,.06,'sawtooth',200);break;
      case 'capture':this.tone(70,.7,.38,'triangle',20);this.hiss(.8,.35,500);break;
      case 'win':case 'unlock':[220,277.18,329.63,440].forEach((f,i)=>this.tone(f,1.4,.09,'sine',f,0,i*.16));break;
      case 'lose':this.tone(80,2,.2,'sine',24);break;
      case 'locked':this.tone(50,.5,.17,'triangle',35);break;
      case 'start':this.hiss(1,.07,300);break;
    }
  }
  update(game,yaw){
    if(!this.ctx || game.phase!=='playing')return;const t=game.time,threat=game.threat;
    if(threat>.08 && t>this.beatAt){this.tone(52,.17,.07+threat*.16,'sine',34);this.tone(47,.14,.05+threat*.1,'sine',31,0,.17);this.beatAt=t+1.2-threat*.78;}
    if(game.player.moving && t>this.stepAt){this.hiss(.09,.045,game.sprinting?380:270);this.stepAt=t+(game.sprinting?.25:.4);}
    if(t>this.creakAt){this.tone(145,1.8,.028,'triangle',43,Math.sin(t));this.creakAt=t+9+Math.random()*11;}
    if(threat>.18 && t>this.voiceAt && game.nearest){
      const e=game.nearest,angle=Math.atan2(e.x-game.player.x,e.z-game.player.z)-yaw;
      this.hiss(e.type===1?.5:1.3,.04+threat*.15,[310,1800,900,180][e.type],Math.sin(angle));
      if(e.type===2)this.tone(880,.45,.025,'sine',790,Math.sin(angle));
      this.voiceAt=t+2.7-threat*1.8;
    }
  }
  resetClock(){this.beatAt=this.stepAt=this.voiceAt=0;this.creakAt=8;}
  pause(){this.ctx?.suspend().catch(()=>{});}
  dispose(){for(const n of this.nodes){try{n.stop?.();n.disconnect();}catch{ /* already stopped */ }}this.nodes.clear();this.ctx?.close().catch(()=>{});}
}
