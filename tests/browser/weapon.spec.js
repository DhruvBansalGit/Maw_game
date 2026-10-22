import { test, expect } from '@playwright/test';
async function play(page) {
  await page.goto('/?qa=1');await page.getByRole('button',{name:'ENTER THE LABYRINTH'}).click();
  await page.evaluate(()=>{const {game:g,settings:s}=window.__MAW_TEST__;s.weaponPerspective='first';g.invulnerable=10000;g.enemies.forEach(e=>e.stun=10000);});
}
async function code(page){await page.keyboard.type('bAnDoOk',{delay:35});await expect(page.locator('#weapon-hud')).toBeVisible();}
async function lineUp(page){await page.evaluate(()=>{const {game:g,world:w}=window.__MAW_TEST__;Object.assign(g.player,{x:1,z:1});Object.assign(g.enemies[0],{x:1,z:3});w.yaw=Math.PI;w.pitch=0;w.update(0);});}
test('hidden keyboard code ignores gameplay/repeats; HUD and 3D gun appear without moving on code A/D',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await play(page);
 await page.keyboard.press('f');expect(await page.evaluate(()=>window.__MAW_TEST__.game.shotsFired)).toBe(0);await expect(page.locator('#weapon-hud')).toBeHidden();
 const before=await page.evaluate(()=>({...window.__MAW_TEST__.game.player}));
 await page.keyboard.type('bAnDoOk',{delay:45});await expect(page.locator('#toast')).toHaveText('WEAPON UNLOCKED');await expect(page.locator('#weapon-status')).toHaveText('WEAPON READY');
 const state=await page.evaluate(()=>{const {game:g,world:w}=window.__MAW_TEST__;return {x:g.player.x,z:g.player.z,armed:g.weaponUnlocked,firstPerson:w.firstPerson,gunMeshes:w.weaponView.gun.children.length};});
 expect(state.x).toBe(before.x);expect(state.z).toBe(before.z);expect(state.armed&&state.firstPerson).toBeTruthy();expect(state.gunMeshes).toBeGreaterThan(15);
 await lineUp(page);await page.screenshot({path:'artifacts/qa/bandook-ready.png'});expect(errors).toEqual([]);
});
test('real F input wounds one target, counts down three seconds, pauses, and defeats on second hit',async({page})=>{
 await play(page);await code(page);await lineUp(page);await page.keyboard.press('f');
 await expect(page.locator('#weapon-status')).toHaveText('WEAPON READY IN 3s');expect(await page.evaluate(()=>window.__MAW_TEST__.game.enemies[0].health)).toBe(50);
 await page.keyboard.down('f');await page.waitForTimeout(350);await page.keyboard.up('f');await page.keyboard.press('f');expect(await page.evaluate(()=>window.__MAW_TEST__.game.shotsFired)).toBe(1);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'RETURN TO THE DARK'}).waitFor();
 const paused=await page.evaluate(()=>window.__MAW_TEST__.game.weaponCooldown);await page.waitForTimeout(500);expect(await page.evaluate(()=>window.__MAW_TEST__.game.weaponCooldown)).toBe(paused);
 await page.getByRole('button',{name:'RETURN TO THE DARK'}).click();await expect(page.locator('#weapon-status')).toHaveText('WEAPON READY IN 2s',{timeout:3000});
 await expect(page.locator('#weapon-status')).toHaveText('WEAPON READY',{timeout:5000});await page.keyboard.press('f');
 await expect(page.locator('#enemy-count')).toHaveText('ENTITIES REMAINING 3 / 4');expect(await page.evaluate(()=>window.__MAW_TEST__.game.enemies[0].dead)).toBeTruthy();
 await page.screenshot({path:'artifacts/qa/bandook-dissolve.png'});await page.waitForTimeout(1500);
 expect(await page.evaluate(()=>window.__MAW_TEST__.world.enemyModels[0].group.visible)).toBeFalsy();
 await page.keyboard.press('Space');await expect(page.locator('.sense-entity')).toHaveCount(3);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'MAIN MENU',exact:false}).last().click();await page.getByRole('button',{name:'ENTER THE LABYRINTH'}).click();await expect(page.locator('#weapon-hud')).toBeHidden();
 expect(await page.evaluate(()=>({unlocked:window.__MAW_TEST__.game.weaponUnlocked,cooldown:window.__MAW_TEST__.game.weaponCooldown,health:window.__MAW_TEST__.game.enemies[0].health}))).toEqual({unlocked:false,cooldown:0,health:100});
});
test('wall obstructs aimed enemy; mouse fires once with granted pointer lock',async({page})=>{
 await play(page);await code(page);
 await page.evaluate(()=>{const {game:g,world:w}=window.__MAW_TEST__;Object.assign(g.player,{x:1,z:1});Object.assign(g.enemies[0],{x:3,z:1});w.yaw=Math.PI/2;w.pitch=0;});
 await page.keyboard.press('f');expect(await page.evaluate(()=>window.__MAW_TEST__.game.lastShot.kind)).toBe('wall');expect(await page.evaluate(()=>window.__MAW_TEST__.game.enemies[0].health)).toBe(100);
 // Native pointer lock is denied by some headless builds; exercise it when available,
 // while the unconditional keyboard test covers the supported F fallback.
 await page.locator('#world').click({position:{x:720,y:450},force:true});
 const locked=await page.evaluate(()=>document.pointerLockElement===document.querySelector('#world'));
 if(locked){
  await lineUp(page);await page.evaluate(()=>{window.__MAW_TEST__.game.weaponCooldown=0;});await page.mouse.click(720,450);
  expect(await page.evaluate(()=>window.__MAW_TEST__.game.enemies[0].health)).toBe(50);
 } else {
  test.info().annotations.push({type:'pointer-lock',description:'Native lock declined in headless mode; simulate granted state to test mouse dispatch separately.'});
  await lineUp(page);
  await page.evaluate(()=>{window.__MAW_TEST__.game.weaponCooldown=0;Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.querySelector('#world')});});
  await page.mouse.click(720,450);await page.mouse.click(720,450);
  expect(await page.evaluate(()=>window.__MAW_TEST__.game.enemies[0].health)).toBe(50);
  expect(await page.evaluate(()=>window.__MAW_TEST__.game.shotsFired)).toBe(2);
  await page.evaluate(()=>{delete document.pointerLockElement;});
 }
});
test('muzzle/impact/recoil render, reduced motion suppresses flash, and restart reuses resources',async({page})=>{
 await play(page);await code(page);await lineUp(page);
 const effects=await page.evaluate(()=>{
  const {game:g,world:w,settings:s}=window.__MAW_TEST__;w.fireWeapon();w.update(0);
  const active={flash:w.weaponView.flash.visible,impact:w.weaponView.impact.visible,recoil:w.weaponView.gun.rotation.x};
  w.applySettings({...s,reducedMotion:true});w.update(0);active.reducedFlash=w.weaponView.flash.visible;
  w.applySettings(s);return active;
 });
 expect(effects.flash&&effects.impact).toBeTruthy();expect(effects.recoil).toBeGreaterThan(0);expect(effects.reducedFlash).toBeFalsy();
 const counts=await page.evaluate(()=>{
  const {game:g,world:w}=window.__MAW_TEST__;
  function cycle(){g.start();for(const key of 'BANDOOK')g.typeCheat({key,code:'Key'+key});Object.assign(g.player,{x:1,z:1});Object.assign(g.enemies[0],{x:1,z:3});w.yaw=Math.PI;w.pitch=0;w.fireWeapon();w.update(0);g.weaponCooldown=0;w.fireWeapon();g.update(.1);w.update(0);}
  cycle();const before={...w.renderer.info.memory};for(let i=0;i<6;i++)cycle();return {before,after:{...w.renderer.info.memory}};
 });
 expect(counts.after).toEqual(counts.before);
});
test('typing in inputs, editable content, settings or paused state cannot unlock',async({page})=>{
 await play(page);
 await page.evaluate(()=>{const input=document.createElement('input');input.id='test-input';input.style='position:fixed;top:200px;left:300px;z-index:100';document.body.append(input);input.focus();});
 await page.keyboard.type('BANDOOK');expect(await page.evaluate(()=>window.__MAW_TEST__.game.weaponUnlocked)).toBeFalsy();await page.locator('#test-input').evaluate(e=>e.remove());
 await page.evaluate(()=>{const input=document.createElement('div');input.id='editable';input.contentEditable='true';input.style='position:fixed;top:200px;left:300px;z-index:100';document.body.append(input);input.focus();});
 await page.keyboard.type('BANDOOK');expect(await page.evaluate(()=>window.__MAW_TEST__.game.weaponUnlocked)).toBeFalsy();await page.locator('#editable').evaluate(e=>e.remove());
 await page.keyboard.press('Escape');await page.keyboard.type('BANDOOK');await page.getByRole('button',{name:'SETTINGS'}).click();await page.keyboard.type('BANDOOK');expect(await page.evaluate(()=>window.__MAW_TEST__.game.weaponUnlocked)).toBeFalsy();
 await page.getByRole('button',{name:'SAVE & RETURN'}).click();await page.getByRole('button',{name:'RETURN TO THE DARK'}).click();await code(page);
});
