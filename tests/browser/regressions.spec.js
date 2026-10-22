import { test, expect } from '@playwright/test';
async function ready(page){await page.goto('/?qa=1');await page.getByRole('button',{name:'ENTER THE LABYRINTH'}).click();await page.evaluate(()=>{const g=window.__MAW_TEST__.game;g.invulnerable=10000;g.enemies.forEach(e=>e.stun=10000);});}
test('tight-corner camera stays outside walls and hides the obstructing player',async({page})=>{
  await ready(page);
  const results=await page.evaluate(async()=>{
    const {canOccupy,CELL}=await import('/src/maze.js');const {game:g,world:w}=window.__MAW_TEST__;
    Object.assign(g.player,{x:.76,z:5});const checks=[];
    for(let i=0;i<16;i++){w.yaw=i*Math.PI/8;w.update(.016);checks.push({clear:canOccupy(g.maze,w.camera.position.x/CELL,w.camera.position.z/CELL,.01),hidden:!w.firstPerson||!w.player.visible});}
    w.yaw=-Math.PI/2;w.update(.016);return {checks,firstPerson:w.firstPerson,visible:w.player.visible};
  });
  expect(results.checks.every(c=>c.clear&&c.hidden)).toBeTruthy();expect(results.firstPerson).toBeTruthy();expect(results.visible).toBeFalsy();
  await page.screenshot({path:'artifacts/qa/corner-camera.png'});
  await page.evaluate(()=>{const {game:g,world:w}=window.__MAW_TEST__;Object.assign(g.player,g.maze.spawn);w.yaw=Math.PI;w.update(.1);});
  await expect.poll(()=>page.evaluate(()=>window.__MAW_TEST__.world.player.visible)).toBeTruthy();await page.screenshot({path:'artifacts/qa/third-person.png'});
});
test('Web Audio produces sound after gesture, obeys mute and pauses cleanly',async({page})=>{
  await page.goto('/?qa=1');expect(await page.evaluate(()=>window.__MAW_TEST__.audio.ctx)).toBeNull();await ready(page);
  const sound=await page.evaluate(async()=>{
    const a=window.__MAW_TEST__.audio;await a.start();const analyser=a.ctx.createAnalyser();analyser.fftSize=1024;a.master.connect(analyser);
    await new Promise(r=>setTimeout(r,180));const data=new Float32Array(1024);analyser.getFloatTimeDomainData(data);const peak=Math.max(...data.map(Math.abs));
    a.apply({...a.settings,muted:true});await new Promise(r=>setTimeout(r,500));analyser.getFloatTimeDomainData(data);const muted=Math.max(...data.map(Math.abs));
    a.apply({...a.settings,muted:false});for(let i=0;i<20;i++)a.event('pickup');await new Promise(r=>setTimeout(r,400));
    a.master.disconnect(analyser);analyser.disconnect();return {peak,muted,nodes:a.nodes.size,state:a.ctx.state};
  });
  expect(sound.state).toBe('running');expect(sound.peak).toBeGreaterThan(.00001);expect(sound.muted).toBeLessThan(sound.peak*.1);expect(sound.nodes).toBeLessThan(40);
  await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>window.__MAW_TEST__.audio.ctx.state)).toBe('suspended');
});
test('rendering frame budget is measured, and reduced-motion stops decorative flicker',async({page},testInfo)=>{
  await ready(page);await page.waitForTimeout(1000);
  const result=await page.evaluate(()=>new Promise(resolve=>{const frames=[];let last=performance.now();function sample(now){frames.push(now-last);last=now;if(frames.length<90)requestAnimationFrame(sample);else resolve({fps:1000/(frames.reduce((a,b)=>a+b)/frames.length),drawCalls:window.__MAW_TEST__.resources.render.calls,triangles:window.__MAW_TEST__.resources.render.triangles});}requestAnimationFrame(sample);}));
  console.log('Measured browser rendering:',result);await testInfo.attach('render-budget',{body:JSON.stringify(result),contentType:'application/json'});
  expect(result.fps).toBeGreaterThan(15);expect(result.drawCalls).toBeLessThan(450);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'SETTINGS'}).click();await page.getByLabel('Reduce motion & flicker').check();await page.getByRole('button',{name:'SAVE & RETURN'}).click();await page.getByRole('button',{name:'RETURN TO THE DARK'}).click();
  expect(await page.evaluate(()=>window.__MAW_TEST__.world.settings.reducedMotion)).toBeTruthy();
});
test('WebGL failure shows actionable fallback rather than an empty canvas',async({page})=>{
  await page.addInitScript(()=>{const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:getContext.call(this,type,...args);};});
  await page.goto('/');await expect(page.getByRole('alert')).toContainText('Enable hardware acceleration');await expect(page.getByRole('button',{name:'ENTER THE LABYRINTH'})).toBeDisabled();await page.getByRole('button',{name:'HOW TO SURVIVE'}).click();await expect(page.getByRole('dialog')).toBeVisible();
});
