import './style.css';
import { Game, ARCHETYPES } from './game.js';
import { World } from './scene.js';
import { AudioManager } from './audio.js';
import { CELL, SIZE, distance } from './maze.js';

const DEFAULTS={sensitivity:1,volume:.65,sfx:.8,music:.45,quality:'medium',shake:true,muted:false,minimap:true,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
const load=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Storage can be disabled; gameplay remains local and usable. */}};
function readSettings(){const data=load('maw.settings',{}),s={...DEFAULTS};for(const k of ['sensitivity','volume','sfx','music'])if(Number.isFinite(data?.[k]))s[k]=Math.max(k==='sensitivity'?.2:0,Math.min(k==='sensitivity'?2.5:1,data[k]));for(const k of ['shake','muted','minimap','reducedMotion'])if(typeof data?.[k]==='boolean')s[k]=data[k];if(['low','medium','high'].includes(data?.quality))s.quality=data.quality;return s;}
const settings=readSettings(), game=new Game(), audio=new AudioManager(settings), app=document.querySelector('#app'), canvas=document.querySelector('#world');
const keys=new Set();const abort=new AbortController();const on=(target,type,handler,options={})=>target.addEventListener(type,handler,{...options,signal:abort.signal});
let world,error='',lastPhase='',dialog=null,toastUntil=0,toastText='',raf=0,lastTime=performance.now(),uiTime=0,previousFocus=null,disposed=false;
let highScore=Number(load('maw.best',0))||0;
try{world=new World(canvas,game,settings);}catch(e){console.error(e);error='This browser could not start WebGL. Enable hardware acceleration and reload in a current desktop browser.';}
const icon=`<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M35 9a18 18 0 1 0 0 22L20 20Z" fill="currentColor"/><circle cx="19" cy="10" r="2" fill="#101715"/></svg>`;
const arrow='<span aria-hidden="true">↗</span>';
const clock=time=>`${Math.floor(time/60).toString().padStart(2,'0')}:${Math.floor(time%60).toString().padStart(2,'0')}`;
function header(){return `<header class="topbar"><a class="brand" href="#" data-action="menu" aria-label="MAW main menu">${icon}<span>MAW<span class="brand-small">BELOW THE STATIC</span></span></a><div class="connection"><i></i> LOCAL SIGNAL <span>/</span> NO CONNECTION REQUIRED</div><button class="sound-button" data-action="mute" aria-label="${settings.muted?'Unmute':'Mute'} audio" aria-pressed="${settings.muted}">${settings.muted?'SOUND OFF':'SOUND ON'} <span aria-hidden="true">${settings.muted?'▱':'▥'}</span></button></header>`;}
function render(){
  lastPhase=game.phase;document.body.dataset.phase=game.phase;
  if(game.phase==='menu')app.innerHTML=`${header()}<main class="menu"><section class="menu-copy"><div class="eyebrow"><span class="signal-dot"></span> TRANSMISSION 001 <span class="dim">/</span> SIGNAL FOUND</div><h1>MAW<span class="title-scratch" aria-hidden="true"></span></h1><div class="subtitle">B E L O W &nbsp; T H E &nbsp; S T A T I C</div><div class="menu-rule"></div><h2>Some things are better left hungry.</h2><p class="intro">You woke up below the surface.<br>Gather the lost souls. Find a way out.<br>And whatever you hear behind you—<em>keep moving.</em></p><button class="primary start" data-action="start" ${error?'disabled':''}>ENTER THE LABYRINTH ${arrow}</button><div class="secondary-actions"><button data-action="how">HOW TO SURVIVE <span>+</span></button><button data-action="settings">SETTINGS <span>↗</span></button></div>${error?`<p class="error" role="alert">${error}</p>`:''}<div class="audio-advice"><span aria-hidden="true">◖◗</span> Headphones recommended. Darkness is intentional.</div></section><aside class="scene-label" aria-hidden="true"><div class="locator">+</div><span>SUB-LEVEL 09</span><p>OCCUPANCY: UNKNOWN<br>SIGNAL INTEGRITY: 13%</p><div class="waveform">▁▂▁▅▃▁▂▆▁▃▅▁▂▁▆▃▁▂▅▁▂▁▅▃▁</div></aside></main><footer class="menu-footer"><div><span class="red-text">WARNING</span> &nbsp; Mild flashing lights · unsettling audio · psychological horror</div><div>${highScore?`PERSONAL BEST <b>${highScore.toLocaleString()}</b>`:'FOUR ENTITIES. THREE LIVES. ONE WAY OUT.'}</div><span class="version">V.01 / OFFLINE</span></footer>`;
  else if(game.phase==='playing')app.innerHTML=`<div class="hud"><header class="hud-top"><div class="hud-brand">${icon}<div>SOUL RECOVERY<span>SUB-LEVEL 09</span></div></div><div class="stats"><div><label>RECOVERED</label><strong id="collected">0</strong><small id="total"></small><div class="progress"><i id="progress"></i></div></div><div><label>SCORE</label><strong id="score">00000</strong></div><div><label>TIME BELOW</label><strong id="time">00:00</strong></div></div><button class="pause-button" data-action="pause" aria-label="Pause game">Ⅱ <kbd>ESC</kbd></button></header><div id="toast" class="toast" role="status"></div><div id="capture-caption" class="capture-caption"></div><div id="sense-directions" class="sense-directions" aria-live="off"></div><aside id="map-panel" class="map-panel"><div>FACILITY PLAN <kbd>M</kbd></div><canvas id="minimap" width="228" height="228" aria-label="Maze map: player ivory, souls grey, wards cyan, exit orange or green"></canvas><p><i class="legend-player"></i> YOU <i class="legend-ward"></i> WARD <i class="legend-exit"></i> EXIT</p></aside><div id="context" class="context"></div><footer class="hud-bottom"><div class="vitals"><label>VITAL SIGNS <span id="life-count"></span></label><div id="lives" class="lives"></div><div class="stamina-row"><span>PANIC SPRINT</span><kbd>SHIFT</kbd></div><div class="stamina"><i id="stamina"></i></div><small id="sprint-status">READY</small></div><div class="threat"><div class="heartbeat-line">⌁</div><span id="threat-label">NO IMMEDIATE THREAT</span><div class="threat-track"><i id="threat"></i></div></div><div class="abilities"><div><kbd>SPACE</kbd><span>HEARTBEAT SENSE <small id="sense-status">READY</small></span></div><div><kbd>E</kbd><span>INTERACT <small id="ward-status">FIND THE EMERGENCY SWITCH</small></span></div><button class="look-hint" data-action="lock">CLICK TO CAPTURE MOUSE · Q / R TO TURN</button></div></footer><div class="crosshair" aria-hidden="true">·</div></div>`;
  else {
    const paused=game.phase==='paused',won=game.phase==='won';
    app.innerHTML=`${header()}<main class="result-screen"><div class="eyebrow">${paused?'TRANSMISSION INTERRUPTED':won?'SIGNAL RESTORED / SURVIVOR FOUND':'SIGNAL LOST / NO RESPONSE'}</div><h1>${paused?'HOLD YOUR<br>BREATH.':won?'STILL<br>BREATHING.':'TAKEN<br>BELOW.'}</h1><p>${paused?'Nothing moves while you are away.':won?'You brought them back. But something followed.':'The labyrinth keeps what it catches.'}</p><div class="result-stats"><div><span>SOULS RECOVERED</span><b>${game.collected} / ${game.total}</b></div><div><span>FINAL SCORE</span><b>${game.score.toLocaleString()}</b></div><div><span>TIME BELOW</span><b>${clock(game.time)}</b></div></div><button class="primary" data-action="${paused?'resume':'start'}">${paused?'RETURN TO THE DARK':'TRY AGAIN'} ${arrow}</button><div class="secondary-actions">${paused?'<button data-action="settings">SETTINGS ↗</button>':''}<button data-action="menu">MAIN MENU ↗</button></div></main>`;
  }
  if(dialog)showDialog(dialog,true);if(game.phase==='playing')updateHud();
}
function showDialog(type,rerender=false){
  if(!rerender)previousFocus=document.activeElement;
  dialog=type;document.querySelector('.modal-backdrop')?.remove();
  const backdrop=document.createElement('div');backdrop.className='modal-backdrop';
  backdrop.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-heading"><div><div class="eyebrow">FIELD MANUAL / 09</div><h2 id="dialog-title">${type==='settings'?'Tune the signal.':'Stay alive.'}</h2></div><button data-action="close" class="close" aria-label="Close dialog">×</button></div>${type==='settings'?`
    <p class="modal-intro">Stored on this device. No account. No connection.</p>
    ${[['sensitivity','Mouse sensitivity',.2,2.5,.05],['volume','Master volume',0,1,.01],['sfx','Sound effects',0,1,.01],['music','Ambient drone',0,1,.01]].map(([id,title,min,max,step])=>`<label class="setting"><span>${title}<output id="value-${id}">${id==='sensitivity'?settings[id].toFixed(2)+'×':Math.round(settings[id]*100)+'%'}</output></span><input type="range" name="${id}" aria-label="${title}" min="${min}" max="${max}" step="${step}" value="${settings[id]}"></label>`).join('')}
    <label class="setting select-setting"><span>Render quality</span><select name="quality" aria-label="Render quality">${['low','medium','high'].map(v=>`<option value="${v}" ${settings.quality===v?'selected':''}>${v[0].toUpperCase()+v.slice(1)}${v==='high'?' · dynamic shadows':v==='low'?' · performance':''}</option>`).join('')}</select></label>
    <label class="toggle-setting">Camera shake<input type="checkbox" name="shake" ${settings.shake?'checked':''}></label><label class="toggle-setting">Reduce motion & flicker<input type="checkbox" name="reducedMotion" ${settings.reducedMotion?'checked':''}></label><label class="toggle-setting">Mute all audio<input type="checkbox" name="muted" ${settings.muted?'checked':''}></label><p class="fine-print">Low quality reduces resolution and disables shadows. Reduce motion suppresses camera shake, decorative movement, sparks, and light flicker. Audio is synthesized locally.</p><button class="primary" data-action="close">SAVE & RETURN ${arrow}</button>`:`
    <p class="modal-intro">Collect every pale soul. Reach the <b>exit in the far southeast</b>. You have three lives. The maze remembers your progress after a capture.</p>
    <div class="manual-controls"><div><kbd>W A S D</kbd><span>Move · arrow keys also work</span></div><div><kbd>MOUSE</kbd><span>Look · click the maze to capture</span></div><div><kbd>Q / R</kbd><span>Turn camera without a mouse</span></div><div><kbd>SHIFT</kbd><span>Sprint · 2.4s stamina / 4s exhaustion</span></div><div><kbd>SPACE</kbd><span>Sense enemies · 4s / 18s cooldown</span></div><div><kbd>M / ESC</kbd><span>Toggle map / pause</span></div></div>
    <div class="manual-mechanics"><p><b>01 / SOUL WARDS</b>Cyan cages protect you for 9 seconds. Touch an entity to silence it for 7 seconds.</p><p><b>02 / BLACKOUT</b>Press E near the central power console: 8 seconds of darkness, slower enemies, a sleeping Watcher. Recharges in 30 seconds.</p><p><b>03 / REFUGE</b>The starting circle protects for 6 seconds. It needs 30 seconds with you outside to recover. Do not linger.</p></div>
    <div class="entity-list"><div><b>THE STALKER</b><span>Follows your trail. Quickens nearby.</span></div><div><b>THE SCREAMER</b><span>Erratic turns. Listen for its voice.</span></div><div><b>THE WATCHER</b><span>Waits at the hub. Wakes after 2 seconds.</span></div><div><b>THE HUNTER</b><span>Cuts you off. Faster as souls disappear.</span></div></div>
    <p class="fine-print">Capture returns you to the refuge with 5 seconds of immunity. Headphones reveal threat direction. This experience includes mild flicker and brief, non-strobing scares.</p><button class="primary" data-action="close">UNDERSTOOD ${arrow}</button>`}</section>`;
  app.append(backdrop);backdrop.querySelector('button').focus();
}
function closeDialog(){dialog=null;document.querySelector('.modal-backdrop')?.remove();if(previousFocus?.isConnected)previousFocus.focus();}
function notify(text,duration=5){if(!text)return;toastText=text;toastUntil=performance.now()+duration*1000;document.querySelector('#announcer').textContent=text;}
function releaseMouse(){if(document.pointerLockElement)document.exitPointerLock();}
async function lockMouse(){if(game.phase!=='playing')return;try{await canvas.requestPointerLock?.();}catch{notify('Mouse capture unavailable. Use Q / R to turn the camera.');}}
function setPause(){if(game.phase!=='playing')return;game.pause();keys.clear();releaseMouse();audio.pause();render();}
function start(){if(error)return;dialog=null;game.start();audio.resetClock();audio.start().then(ok=>{if(!ok)notify('Audio is unavailable in this browser. Visual threat cues remain active.');});world.yaw=Math.PI;world.syncItems(true);keys.clear();render();lockMouse();}
function resume(){game.resume();keys.clear();audio.start();render();lockMouse();}
on(app,'click',event=>{
  const button=event.target.closest('[data-action]');if(!button)return;event.preventDefault();
  switch(button.dataset.action){
    case 'start':start();break;
    case 'pause':setPause();break;
    case 'resume':resume();break;
    case 'settings':case 'how':if(game.phase==='playing')setPause();showDialog(button.dataset.action);break;
    case 'close':closeDialog();break;
    case 'menu':dialog=null;game.reset();world?.syncItems(true);keys.clear();releaseMouse();audio.pause();render();break;
    case 'mute':settings.muted=!settings.muted;audio.apply(settings);save('maw.settings',settings);button.setAttribute('aria-pressed',settings.muted);button.setAttribute('aria-label',settings.muted?'Unmute audio':'Mute audio');button.innerHTML=`${settings.muted?'SOUND OFF':'SOUND ON'} <span aria-hidden="true">${settings.muted?'▱':'▥'}</span>`;break;
    case 'lock':lockMouse();break;
  }
});
on(app,'input',event=>{
  const input=event.target;if(!input.name||!(input.name in DEFAULTS))return;
  settings[input.name]=input.type==='checkbox'?input.checked:input.tagName==='SELECT'?input.value:Number(input.value);
  const output=document.querySelector(`#value-${input.name}`);if(output)output.textContent=input.name==='sensitivity'?settings[input.name].toFixed(2)+'×':Math.round(settings[input.name]*100)+'%';
  save('maw.settings',settings);audio.apply(settings);world?.applySettings(settings);
});
on(window,'keydown',event=>{
  if(dialog){
    if(event.code==='Escape'){event.preventDefault();closeDialog();return;}
    if(event.code==='Tab'){const focusable=[...document.querySelectorAll('.modal button,.modal input,.modal select')];const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    return;
  }
  if(event.code==='Escape'){event.preventDefault();if(game.phase==='playing')setPause();else if(game.phase==='paused')resume();return;}
  if(game.phase!=='playing')return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(event.code))event.preventDefault();
  keys.add(event.code);if(event.repeat)return;
  if(event.code==='KeyM'){settings.minimap=!settings.minimap;save('maw.settings',settings);}
  if(event.code==='Space')game.senseAction();if(event.code==='KeyE')game.interact();
});
on(window,'keyup',event=>keys.delete(event.code));
on(window,'blur',()=>{keys.clear();setPause();});
on(document,'visibilitychange',()=>{if(document.hidden){keys.clear();setPause();}});
on(document,'pointerlockchange',()=>{if(!document.pointerLockElement&&game.phase==='playing')setPause();});
on(canvas,'click',lockMouse);
on(document,'mousemove',event=>{if(document.pointerLockElement===canvas&&game.phase==='playing')world?.look(event.movementX,event.movementY);});
on(canvas,'webglcontextlost',event=>{event.preventDefault();setPause();notify('Graphics context lost. Reload this page to restore the renderer.');});
function input(dt){
  if(keys.has('KeyQ'))world.yaw+=dt*1.8;if(keys.has('KeyR'))world.yaw-=dt*1.8;
  const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
  const right=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  return {x:-Math.sin(world.yaw)*forward+Math.cos(world.yaw)*right,z:-Math.cos(world.yaw)*forward-Math.sin(world.yaw)*right,sprint:keys.has('ShiftLeft')||keys.has('ShiftRight')};
}
function map(){
  const panel=document.querySelector('#map-panel');if(!panel)return;panel.hidden=!settings.minimap;if(!settings.minimap)return;
  const c=document.querySelector('#minimap').getContext('2d'),unit=228/SIZE;c.clearRect(0,0,228,228);
  for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){c.fillStyle=game.maze.grid[z][x]?'#48544c':'#141e1b';c.fillRect(x*unit,z*unit,unit-1,unit-1);}
  c.fillStyle='#899886';for(const id of game.orbs){const [x,z]=id.split(',').map(Number);c.fillRect((x+.5)*unit-1,(z+.5)*unit-1,2,2);}
  c.strokeStyle='#70b8a9';const safe=game.maze.refuge;c.strokeRect((safe.x-.3)*unit,(safe.z-.3)*unit,unit*1.6,unit*1.6);
  for(const id of game.souls){const [x,z]=id.split(',').map(Number);c.fillStyle='#85cbbb';c.fillRect((x+.5)*unit-2.5,(z+.5)*unit-2.5,5,5);}
  const ex=game.maze.exit;c.fillStyle=game.orbs.size?'#c0764f':'#9af2b9';c.fillRect(ex.x*unit,ex.z*unit,unit-1,unit-1);
  const sw=game.maze.switch;c.fillStyle='#b8a178';c.fillRect((sw.x+.5)*unit-2,(sw.z+.5)*unit-2,4,4);
  if(game.sense>0){c.fillStyle='#e36a53';game.enemies.forEach(e=>{c.beginPath();c.arc((e.x+.5)*unit,(e.z+.5)*unit,3.5,0,Math.PI*2);c.fill();});}
  c.save();c.translate((game.player.x+.5)*unit,(game.player.z+.5)*unit);c.rotate(-Math.atan2(game.player.dx,game.player.dz));c.fillStyle='#efe9cc';c.beginPath();c.moveTo(0,5);c.lineTo(-3,-3);c.lineTo(3,-3);c.closePath();c.fill();c.restore();
}
function updateHud(){
  if(game.phase!=='playing')return;
  const text=(id,value)=>{const e=document.getElementById(id);if(e&&e.textContent!==value)e.textContent=value;};
  text('collected',String(game.collected).padStart(3,'0'));text('total',` / ${game.total}`);text('score',String(game.score).padStart(5,'0'));text('time',clock(game.time));
  text('life-count',`${game.lives} / 3`);const lives=document.querySelector('#lives');if(lives.dataset.count!==String(game.lives)){lives.innerHTML=[0,1,2].map(i=>`<span class="${i<game.lives?'':'lost'}">${icon}</span>`).join('');lives.dataset.count=game.lives;}
  document.querySelector('#progress').style.width=`${game.collected/game.total*100}%`;
  document.querySelector('#stamina').style.width=`${game.stamina*100}%`;
  text('sprint-status',game.sprintCooldown>0?`EXHAUSTED · ${Math.ceil(game.sprintCooldown)}s`:game.sprinting?'RUN. DO NOT LOOK BACK.':game.stamina<.95?'RECOVERING':'READY');
  text('sense-status',game.sense>0?`ACTIVE · ${Math.ceil(game.sense)}s`:game.senseCooldown>0?`${Math.ceil(game.senseCooldown)}s COOLDOWN`:'READY');
  text('ward-status',game.ward>0?`SOUL WARD · ${Math.ceil(game.ward)}s`:game.blackout>0?`BLACKOUT · ${Math.ceil(game.blackout)}s`:'CENTRAL POWER CONSOLE');
  text('threat-label',game.safe?'REFUGE ACTIVE':game.invulnerable>0?'RECOVERY IMMUNITY':game.ward>0?'THEY FEAR YOU':game.threat>.7?'IT IS RIGHT BEHIND YOU':game.threat>.3?'SOMETHING IS CLOSE':'NO IMMEDIATE THREAT');
  document.querySelector('#threat').style.width=`${game.threat*100}%`;
  let prompt='WASD / ARROWS · MOVE     SHIFT · SPRINT';
  if(game.safe)prompt=`REFUGE · ${game.safeBudget.toFixed(1)}s OF SAFETY. THEN RUN.`;
  else if(distance(game.player,game.maze.refuge)<1)prompt=`REFUGE DEPLETED · LEAVE FOR ${Math.ceil(game.safeRecharge)}s TO RECHARGE`;
  else if(distance(game.player,game.maze.switch)<1.25)prompt=game.blackoutCooldown>0?`POWER RECOVERING · ${Math.ceil(game.blackoutCooldown)}s`:'[ E ] CUT THE LIGHTS · SLOW THE ENTITIES';
  else if(!game.orbs.size)prompt='GATE OPEN · FIND THE GREEN EXIT ON YOUR MAP';
  else if(distance(game.player,game.maze.exit)<1.2)prompt=`GATE SEALED · ${game.orbs.size} SOULS REMAIN`;
  text('context',prompt);
  const toast=document.querySelector('#toast');toast.textContent=toastText;toast.classList.toggle('visible',performance.now()<toastUntil);
  text('capture-caption',game.captureFlash>.25?'DO NOT LET IT KEEP YOU.':game.screamFlash>.1?'DID YOU HEAR THAT?':'');
  const sense=document.querySelector('#sense-directions');
  if(game.sense>0){sense.innerHTML=game.enemies.map(e=>{const angle=Math.atan2(e.x-game.player.x,e.z-game.player.z)-world.yaw+Math.PI;return `<div class="sense-entity"><span style="transform:rotate(${-angle*180/Math.PI}deg)">↑</span><small>${ARCHETYPES[e.type].name.replace('THE ','')}<b>${Math.round(distance(e,game.player)*CELL)} m</b></small></div>`;}).join('');}else sense.replaceChildren();
  map();
}
function loop(now){
  if(disposed)return;const dt=Math.min((now-lastTime)/1000,.08);lastTime=now;
  if(world){if(game.phase==='playing'){game.update(dt,input(dt));audio.update(game,world.yaw);}world.update(dt);}
  for(const event of game.events.splice(0)){audio.event(event.type);if(event.text)notify(event.text,event.type==='start'?7:5);}
  if(game.phase!==lastPhase){
    if(['won','gameover'].includes(game.phase)){releaseMouse();if(game.score>highScore){highScore=game.score;save('maw.best',highScore);}}
    render();
  }
  if(now-uiTime>80){updateHud();uiTime=now;}
  document.body.style.setProperty('--danger',game.phase==='playing'?game.threat*.5:0);document.body.style.setProperty('--impact',settings.reducedMotion?0:Math.max(game.captureFlash*.6,game.screamFlash*.3));
  document.body.classList.toggle('last-life',game.lives===1&&game.phase==='playing');
  raf=requestAnimationFrame(loop);
}
render();raf=requestAnimationFrame(loop);
function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);abort.abort();world?.dispose();audio.dispose();}
on(window,'pagehide',event=>{if(!event.persisted)dispose();});
if(import.meta.hot)import.meta.hot.dispose(dispose);
// Explicit DEV-only test surface. Not present in the production build or ordinary sessions.
if(import.meta.env.DEV && new URLSearchParams(location.search).has('qa'))window.__MAW_TEST__={game,world,audio,settings,start,pause:setPause,resume,render,get resources(){return world?.renderer.info;}};
