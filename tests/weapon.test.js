import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { CELL, distance } from '../src/maze.js';
import { CheatSequence, rayBox, traceShot } from '../src/weapon.js';
const event=(key,extra={})=>({key,code:/^[a-z]$/i.test(key)?'Key'+key.toUpperCase():key,...extra});
function unlock(g){for(const key of 'bAnDoOk')g.typeCheat(event(key));}
function setup(){const g=new Game();g.start();g.invulnerable=10000;g.enemies.forEach(e=>e.stun=10000);unlock(g);return g;}
function seconds(g,n,step=.02){for(let left=n;left>1e-9;left-=step)g.update(Math.min(step,left));}
const origin={x:CELL,y:1.45,z:CELL},forward={x:0,y:0,z:1};
test('hidden exact code is case insensitive, ignores movement/repeats and consumes expected A/D',()=>{
 const g=new Game();g.start();g.typeCheat(event('b'));g.typeCheat(event('w'));g.typeCheat(event('w',{repeat:true}));g.typeCheat(event('ArrowUp'));
 for(const c of 'AnDOOk')assert.equal(g.typeCheat(event(c)),true);
 assert.equal(g.weaponUnlocked,true);assert.equal(g.events.filter(e=>e.text==='WEAPON UNLOCKED').length,1);unlock(g);assert.equal(g.events.filter(e=>e.type==='weapon-unlock').length,1);
});
test('wrong letters, modifiers, repeats, editable input, timeout and non-gameplay cannot unlock',()=>{
 for(const string of ['BANOOK','BANDOK','BAXNDOOK']){const g=new Game();g.start();for(const c of string)g.typeCheat(event(c));assert.equal(g.weaponUnlocked,false);}
 const c=new CheatSequence();for(const key of 'BANDOOK')assert.equal(c.feed(event(key,{target:{isContentEditable:true}}),0).unlocked,false);
 for(const key of 'BANDOOK')assert.equal(c.feed(event(key,{ctrlKey:true}),0).unlocked,false);
 c.feed(event('B'),0);for(const key of 'ANDOOK')assert.equal(c.feed(event(key),6).unlocked,false);
 const g=new Game();unlock(g);assert.equal(g.weaponUnlocked,false);g.start();g.pause();unlock(g);assert.equal(g.weaponUnlocked,false);
});
test('locked gun, zero/NaN direction and invalid origin do not fire',()=>{
 const g=new Game();g.start();assert.equal(g.shoot(origin,forward),null);unlock(g);
 assert.equal(g.shoot(origin,{x:0,y:0,z:0}),null);assert.equal(g.shoot({...origin,x:NaN},forward),null);assert.equal(g.shotsFired,0);
});
test('nearest live target is hit once, two hits dissolve it, bodies no longer intercept',()=>{
 const g=setup();Object.assign(g.enemies[0],{x:1,z:3});Object.assign(g.enemies[1],{x:1,z:5});
 assert.equal(g.shoot(origin,forward).enemyIndex,0);assert.equal(g.enemies[0].health,50);assert.equal(g.enemies[1].health,100);
 for(let i=0;i<20;i++)assert.equal(g.shoot(origin,forward),null);assert.equal(g.shotsFired,1);
 seconds(g,3);assert.equal(g.shoot(origin,forward).enemyIndex,0);assert.equal(g.enemies[0].dead,true);assert.equal(g.activeEnemies.length,3);
 seconds(g,3);assert.equal(g.shoot(origin,forward).enemyIndex,1);assert.equal(g.enemies[1].health,50);
});
test('all maze walls block rays including target behind a wall and corner grazing',()=>{
 const g=setup();let checks=0;
 for(const p of g.maze.cells)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  if(g.maze.grid[p.z+dz]?.[p.x+dx]!==1)continue;
  const enemies=[{x:p.x+dx*2,z:p.z+dz*2,type:0,dead:false}];
  const hit=traceShot(g.maze,enemies,{x:p.x*CELL,y:1.45,z:p.z*CELL},{x:dx,y:0,z:dz});
  assert.equal(hit.kind,'wall');assert.ok(hit.distance<=CELL*.5+.0001);checks++;
 }
 assert.ok(checks>50);
 const min={x:0,y:0,z:0},max={x:1,y:1,z:1};assert.equal(rayBox({x:-1,y:.5,z:0},{x:1,y:0,z:0},min,max),1);
});
test('floor/ceiling occlude bullets and a clear miss still costs the cooldown',()=>{
 const g=setup();assert.equal(g.shoot(origin,{x:0,y:1,z:0}).kind,'wall');assert.equal(g.weaponCooldown,3);
 const empty={grid:Array.from({length:30},()=>Array(30).fill(0))};
 assert.equal(traceShot(empty,[],{x:30,y:1,z:30},{x:1,y:0,z:0}).kind,'miss');
});
test('cooldown uses elapsed seconds, pauses, cannot be reset by cheat, and restart resets everything',()=>{
 const g=setup();g.shoot(origin,forward);assert.equal(g.weaponCooldown,3);seconds(g,1,.1);assert.ok(Math.abs(g.weaponCooldown-2)<1e-7);
 unlock(g);assert.ok(Math.abs(g.weaponCooldown-2)<1e-7);g.pause();seconds(g,30);assert.ok(Math.abs(g.weaponCooldown-2)<1e-7);assert.equal(g.shoot(origin,forward),null);
 g.resume();seconds(g,1.99);assert.equal(g.shoot(origin,forward),null);seconds(g,.01);assert.ok(g.shoot(origin,forward));
 g.start();assert.equal(g.weaponUnlocked,false);assert.equal(g.weaponCooldown,0);assert.equal(g.lastShot,null);assert.equal(g.activeEnemies.length,4);assert.equal(g.enemies[0].health,100);
});
test('hunter needs three hits, survivors pursue during cooldown, dead entities cannot attack or revive',()=>{
 const g=setup(),e=g.enemies[3];Object.assign(e,{x:1,z:4});g.enemies.slice(0,3).forEach(e=>e.dead=true);
 for(let i=0;i<3;i++){assert.equal(g.shoot(origin,forward).kind,'enemy');if(i<2){assert.equal(e.dead,false);seconds(g,3);}}
 assert.equal(e.dead,true);g.invulnerable=0;g.safeBudget=0;Object.assign(g.player,e);const lives=g.lives;seconds(g,1);assert.equal(g.lives,lives);assert.equal(g.nearest,null);assert.equal(g.threat,0);g.capture(e);assert.equal(g.lives,lives);
 const h=setup();h.enemies.forEach(e=>e.stun=0);h.shoot(origin,forward);const before={...h.enemies[0]};seconds(h,2);assert.ok(h.weaponCooldown>0);assert.ok(distance(before,h.enemies[0])>.2);
});
