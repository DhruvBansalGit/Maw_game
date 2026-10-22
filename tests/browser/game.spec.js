import { test, expect } from '@playwright/test';
const qa = page => page.goto('/?qa=1');
async function start(page){await page.getByRole('button',{name:'ENTER THE LABYRINTH'}).click();await expect(page.locator('.hud')).toBeVisible();}
async function controlled(page){await page.evaluate(()=>{const g=window.__MAW_TEST__.game;g.invulnerable=10000;g.enemies.forEach(e=>e.stun=10000);});}
test('menu renders real 3D, local-only requests, settings and manual',async({page})=>{
  const errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:5174')&&!r.url().startsWith('data:'))remote.push(r.url());});
  await qa(page);await expect(page.getByRole('heading',{name:'MAW',exact:true})).toBeVisible();await page.waitForTimeout(1600);
  expect(await page.evaluate(()=>window.__MAW_TEST__.resources.render.triangles)).toBeGreaterThan(10000);
  expect(await page.evaluate(()=>window.__MAW_TEST__.resources.render.calls)).toBeLessThan(450);
  await page.screenshot({path:'artifacts/qa/menu.png'});
  await page.getByRole('button',{name:'SETTINGS',exact:false}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('slider',{name:'Master volume'}).fill('0.31');await page.getByLabel('Render quality').selectOption('low');await page.getByLabel('Mute all audio').check();
  await page.getByRole('button',{name:'SAVE & RETURN'}).click();await page.reload();await page.getByRole('button',{name:'SETTINGS'}).click();
  await expect(page.getByRole('slider',{name:'Master volume'})).toHaveValue('0.31');await expect(page.getByLabel('Render quality')).toHaveValue('low');await expect(page.getByLabel('Mute all audio')).toBeChecked();
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'HOW TO SURVIVE'}).click();await expect(page.getByText('THE WATCHER',{exact:true})).toBeVisible();await page.getByRole('button',{name:'UNDERSTOOD'}).click();
  expect(errors).toEqual([]);expect(remote).toEqual([]);
});
test('keyboard movement, collectibles, camera, pause, map and sense',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await qa(page);await start(page);await controlled(page);
  const before=await page.evaluate(()=>({...window.__MAW_TEST__.game.player}));await page.keyboard.down('KeyW');await page.waitForTimeout(1100);await page.keyboard.up('KeyW');
  const after=await page.evaluate(()=>({...window.__MAW_TEST__.game.player}));expect(after.z).toBeGreaterThan(before.z+.3);
  await page.keyboard.down('KeyD');await page.waitForTimeout(2200);await page.keyboard.up('KeyD');
  expect(await page.evaluate(()=>window.__MAW_TEST__.game.collected)).toBeGreaterThan(0);
  const yaw=await page.evaluate(()=>window.__MAW_TEST__.world.yaw);await page.keyboard.down('KeyQ');await page.waitForTimeout(500);await page.keyboard.up('KeyQ');expect(await page.evaluate(()=>window.__MAW_TEST__.world.yaw)).toBeGreaterThan(yaw);
  await page.keyboard.press('Space');await expect(page.locator('#sense-status')).toContainText('ACTIVE');await expect(page.locator('.sense-entity')).toHaveCount(4);
  await page.keyboard.press('KeyM');await expect(page.locator('#map-panel')).toBeHidden();await page.keyboard.press('KeyM');await expect(page.locator('#map-panel')).toBeVisible();
  await page.screenshot({path:'artifacts/qa/playing.png'});
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'RETURN TO THE DARK'})).toBeVisible();const time=await page.evaluate(()=>window.__MAW_TEST__.game.time);await page.waitForTimeout(400);expect(await page.evaluate(()=>window.__MAW_TEST__.game.time)).toBe(time);
  await page.getByRole('button',{name:'RETURN TO THE DARK'}).click();await expect(page.locator('.hud')).toBeVisible();expect(errors).toEqual([]);
});
test('wards, blackout, capture, game-over and repeated restart lifecycle',async({page})=>{
  await qa(page);await start(page);await controlled(page);
  await page.evaluate(()=>{const g=window.__MAW_TEST__.game;Object.assign(g.player,g.maze.souls[0]);});await expect(page.locator('#ward-status')).toContainText('SOUL WARD');
  await page.evaluate(()=>{const g=window.__MAW_TEST__.game;g.ward=0;Object.assign(g.player,g.maze.switch);});await page.keyboard.press('KeyE');await expect(page.locator('#ward-status')).toContainText('BLACKOUT');
  await page.evaluate(()=>{const g=window.__MAW_TEST__.game;g.blackout=0;g.invulnerable=0;g.safeBudget=0;g.capture(g.enemies[0]);});await expect(page.locator('#life-count')).toHaveText('2 / 3');
  await page.evaluate(()=>{const g=window.__MAW_TEST__.game;g.capture(g.enemies[0]);g.capture(g.enemies[0]);});await expect(page.getByRole('heading',{name:'TAKEN BELOW.'})).toBeVisible();
  const initial=await page.evaluate(()=>({...window.__MAW_TEST__.resources.memory}));
  for(let i=0;i<3;i++){
    await page.getByRole('button',{name:'TRY AGAIN'}).click();await expect(page.locator('#life-count')).toHaveText('3 / 3');
    await page.evaluate(()=>{const g=window.__MAW_TEST__.game;g.capture(g.enemies[0]);g.capture(g.enemies[0]);g.capture(g.enemies[0]);});await expect(page.getByRole('button',{name:'TRY AGAIN'})).toBeVisible();
  }
  expect(await page.evaluate(()=>({...window.__MAW_TEST__.resources.memory}))).toEqual(initial);
  await page.getByRole('button',{name:'MAIN MENU'}).click();await expect(page.getByRole('heading',{name:'MAW',exact:true})).toBeVisible();
});
test('victory opens the gate and persists high score',async({page})=>{
  await qa(page);await start(page);await controlled(page);
  await page.evaluate(()=>{const g=window.__MAW_TEST__.game;g.orbs.clear();Object.assign(g.player,g.maze.exit);});await expect(page.getByRole('heading',{name:'STILL BREATHING.'})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('maw.best')))).toBeGreaterThan(0);
  await page.screenshot({path:'artifacts/qa/victory.png'});await page.getByRole('button',{name:'MAIN MENU'}).click();await expect(page.getByText('PERSONAL BEST',{exact:false})).toBeVisible();
});
test('small viewport has readable menu and no horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});await qa(page);await expect(page.getByRole('button',{name:'ENTER THE LABYRINTH'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await page.screenshot({path:'artifacts/qa/narrow-menu.png'});
  await page.getByRole('button',{name:'SETTINGS'}).click();await expect(page.getByRole('dialog')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});
