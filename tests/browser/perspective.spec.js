import { test, expect } from '@playwright/test';
async function armed(page){
 await page.goto('/?qa=1');await page.getByRole('button',{name:'ENTER THE LABYRINTH'}).click();
 await page.evaluate(()=>{const {game:g}=window.__MAW_TEST__;g.invulnerable=10000;g.enemies.forEach(e=>e.stun=10000);});
 await page.keyboard.type('BANDOOK');await expect(page.locator('#weapon-hud')).toBeVisible();
}
test('Settings uses forward arrow in menu and pause, camera preference persists',async({page})=>{
 await page.goto('/?qa=1');const settings=page.getByRole('button',{name:'SETTINGS',exact:true});await expect(settings.locator('svg')).toHaveCount(0);await expect(settings.locator('.settings-forward')).toHaveText('→');
 await settings.click();await expect(page.getByLabel('Weapon camera')).toHaveValue('third');await page.getByLabel('Weapon camera').selectOption('first');await page.getByRole('button',{name:'SAVE & RETURN'}).click();await page.reload();await settings.click();await expect(page.getByLabel('Weapon camera')).toHaveValue('first');await page.getByRole('button',{name:'SAVE & RETURN'}).click();
 await page.getByRole('button',{name:'ENTER THE LABYRINTH'}).click();await page.keyboard.press('Escape');await expect(settings.locator('.settings-forward')).toHaveText('→');await expect(settings.locator('svg')).toHaveCount(0);
});
test('third-person gun is world-mounted, hits the reticle target, and V toggles both ways',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await armed(page);
 await expect.poll(()=>page.evaluate(()=>window.__MAW_TEST__.world.firstPerson)).toBeFalsy();
 await page.evaluate(()=>{const {game:g,world:w}=window.__MAW_TEST__;Object.assign(g.player,{x:1,z:3});Object.assign(g.enemies[0],{x:1,z:6});w.yaw=Math.PI;w.pitch=0;});await page.waitForTimeout(500);
 const third=await page.evaluate(()=>{const {world:w}=window.__MAW_TEST__;return {player:w.player.visible,gun:w.weaponView.worldGun.visible,first:w.firstPerson};});
 expect(third).toEqual({player:true,gun:true,first:false});await page.screenshot({path:'artifacts/qa/third-person-weapon.png'});
 await page.keyboard.press('f');expect(await page.evaluate(()=>window.__MAW_TEST__.game.enemies[0].health)).toBe(50);await expect(page.locator('#weapon-status')).toHaveText('WEAPON READY IN 3s');
 await page.keyboard.press('v');await expect(page.locator('#weapon-view-status')).toHaveText('V · FIRST PERSON');expect(await page.evaluate(()=>window.__MAW_TEST__.world.player.visible)).toBeFalsy();await page.screenshot({path:'artifacts/qa/first-person-weapon.png'});
 await expect(page.locator('#weapon-status')).toHaveText('WEAPON READY',{timeout:5000});await page.keyboard.press('f');expect(await page.evaluate(()=>window.__MAW_TEST__.game.enemies[0].dead)).toBeTruthy();
 await page.keyboard.press('v');await expect.poll(()=>page.evaluate(()=>window.__MAW_TEST__.world.firstPerson)).toBeFalsy();await expect(page.locator('#weapon-view-status')).toHaveText('V · THIRD PERSON');expect(errors).toEqual([]);
});
test('third-person reticle peeking and obstructed muzzle cannot bypass walls',async({page})=>{
 await armed(page);
 const result=await page.evaluate(async()=>{
  const {CELL}=await import('/src/maze.js');const {game:g,world:w}=window.__MAW_TEST__;
  Object.assign(g.player,{x:1,z:5});Object.assign(g.enemies[0],{x:3,z:5});w.yaw=Math.PI;w.pitch=0;w.update(.1);
  // Simulate a camera seeing across the adjacent wall while the player is on
  // the opposite side. Ballistics must use the checked world muzzle, not camera.
  w.firstPerson=false;w.camera.position.set(3*CELL,1.45,3*CELL);w.camera.lookAt(3*CELL,1.45,5*CELL);w.camera.updateMatrixWorld(true);
  w.weaponView.placeWorld(g,false,w.yaw,{x:3*CELL,y:1.45,z:5*CELL});
  const aim=w.weaponAim();const hit=g.shoot(aim.origin,aim.direction);
  return {kind:hit.kind,health:g.enemies[0].health,origin:[aim.origin.x,aim.origin.z],camera:[w.camera.position.x,w.camera.position.z]};
 });
 expect(result.kind).toBe('wall');expect(result.health).toBe(100);expect(result.origin).not.toEqual(result.camera);
});
test('Pac-Man has no moving rear seam: actual rear-ray hit counts and rendered mouth cycle',async({page})=>{
 await page.goto('/?qa=1');await page.getByRole('button',{name:'ENTER THE LABYRINTH'}).click();
 const geometry=await page.evaluate(async()=>{
  const {game:g,world:w}=window.__MAW_TEST__;
  g.invulnerable=10000;g.enemies.forEach(e=>e.stun=10000);
  const skin=w.player.children[0].children.find(o=>o.geometry===w.pacmanBody.skin);
  const material=skin.material.clone();material.side=2;const mesh=skin.clone();mesh.material=material;mesh.updateMatrixWorld();
  const Vector=w.camera.position.constructor,Raycaster=w.cameraRay.constructor;
  const ray=new Raycaster(new Vector(.12,.10,-2),new Vector(0,0,1));const readings=[];
  for(const open of [.06,.17,.3,.48]){w.pacmanBody.update(open);readings.push(ray.intersectObject(mesh).filter(h=>h.point.z<0).map(h=>h.distance));}
  material.dispose();return {readings,bodyMeshes:w.face.children.filter(o=>o.geometry===w.pacmanBody.skin).length};
 });
 expect(geometry.bodyMeshes).toBe(1);for(const distances of geometry.readings){expect(distances).toHaveLength(1);expect(distances[0]).toBeCloseTo(geometry.readings[0][0],6);}
 await page.evaluate(()=>{const {game:g,world:w}=window.__MAW_TEST__;g.player.moving=true;w.face.rotation.y=0;});await page.screenshot({path:'artifacts/qa/pacman-rear-fixed.png'});
});
