import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { makeMaze, pathfind, distance, canOccupy, move, neighbors, key } from '../src/maze.js';
function running(){const g=new Game();g.start();return g;}
function seconds(g,n,input={}){for(let t=0;t<n;t+=.02)g.update(.02,input);}
function parkEnemies(g){g.enemies.forEach(e=>e.stun=10000);}
test('maze is deterministic, fully connected, and has loops, dead ends and rooms',()=>{
  const m=makeMaze();assert.deepEqual(m.grid,makeMaze().grid);assert.ok(m.cells.length>170);
  for(const p of m.cells)if(distance(p,m.spawn)>.01)assert.ok(pathfind(m,m.spawn,p).length,`unreachable ${key(p.x,p.z)}`);
  assert.ok(m.cells.some(p=>neighbors(m,p).length===1));assert.ok(m.cells.some(p=>neighbors(m,p).length===4));
});
test('all soul wards, spawns, console and exit are reachable',()=>{const m=makeMaze();for(const p of [...m.souls,...m.spawns,m.switch,m.exit])assert.ok(pathfind(m,m.spawn,p).length);});
test('circle collision rejects wall overlap and prevents tunneling',()=>{
  const m=makeMaze(),body={x:1,z:1};move(m,body,-80,0);assert.ok(body.x>.7);assert.ok(canOccupy(m,body.x,body.z));assert.equal(canOccupy(m,0,0),false);
});
test('BFS routes have orthogonal, walkable steps',()=>{const m=makeMaze();for(const destination of m.cells){let prev=m.spawn;for(const next of pathfind(m,prev,destination)){assert.equal(distance(prev,next),1);assert.ok(canOccupy(m,next.x,next.z));prev=next;}}});
test('movement is delta time based and diagonals are normalized',()=>{
  const a=running(),b=running();parkEnemies(a);parkEnemies(b);for(let i=0;i<60;i++)a.update(1/60,{z:1});for(let i=0;i<120;i++)b.update(1/120,{z:1});assert.ok(distance(a.player,b.player)<.001);
  const c=running();parkEnemies(c);const before={...c.player};c.update(.1,{x:1,z:1});assert.ok(Math.abs(distance(c.player,before)-.14)<.001);
});
test('orbs count and score once; restart restores every collectible',()=>{const g=running();parkEnemies(g);const id=[...g.orbs][0],[x,z]=id.split(',').map(Number);Object.assign(g.player,{x,z});g.collect();assert.equal(g.collected,1);assert.equal(g.score,10);g.collect();assert.equal(g.score,10);g.start();assert.equal(g.collected,0);assert.equal(g.score,0);});
test('each enemy stays inside corridors during many pursuit steps',()=>{
  const g=running();g.invulnerable=10000;g.safeBudget=0;for(let i=0;i<6000;i++){
    if(i%400===0)Object.assign(g.player,g.maze.cells[(i/400*13)%g.maze.cells.length]);g.update(.025);
    for(const e of g.enemies)assert.ok(canOccupy(g.maze,e.x,e.z,.15),`${e.type} clipped a wall at ${e.x},${e.z}`);
  }
});
test('Watcher waits for observation delay and stops during blackout',()=>{
  const g=running(),e=g.enemies[2];Object.assign(g.player,{x:9,z:8});const before={...e};g.updateEnemy(e,1);assert.equal(distance(e,before),0);g.updateEnemy(e,1.1);assert.ok(distance(e,before)>0);g.blackout=5;const frozen={...e};g.updateEnemy(e,1);assert.equal(distance(e,frozen),0);
});
test('Hunter accelerates late in the run',()=>{const g=running(),e=g.enemies[3];e.target={x:16,z:17};const before={...e};g.updateEnemy(e,.1);const early=distance(e,before);Object.assign(e,before);e.target={x:16,z:17};g.orbs.clear();g.updateEnemy(e,.1);assert.ok(distance(e,before)>early);});
test('soul ward grants immunity and banishes on contact',()=>{
  const g=running();parkEnemies(g);Object.assign(g.player,g.maze.souls[0]);g.collect();assert.equal(g.ward,9);const e=g.enemies[0];Object.assign(e,g.player,{stun:0});g.update(.01);assert.equal(g.lives,3);assert.ok(e.stun>6);assert.ok(g.score>=250);
});
test('blackout requires proximity, expires and respects cooldown',()=>{const g=running();g.interact();assert.equal(g.blackout,0);Object.assign(g.player,g.maze.switch);g.interact();assert.equal(g.blackout,8);assert.equal(g.blackoutCooldown,30);parkEnemies(g);seconds(g,9);assert.equal(g.blackout,0);g.interact();assert.equal(g.blackout,0);});
test('heartbeat sense expires and cannot bypass cooldown',()=>{const g=running();parkEnemies(g);g.senseAction();assert.equal(g.sense,4);seconds(g,5);assert.equal(g.sense,0);g.senseAction();assert.equal(g.sense,0);seconds(g,14);g.senseAction();assert.equal(g.sense,4);});
test('sprint drains stamina, enters cooldown and recovers',()=>{const g=running();parkEnemies(g);seconds(g,2.6,{z:1,sprint:true});assert.ok(g.sprintCooldown>3);assert.ok(g.stamina<.1);seconds(g,8);assert.equal(g.stamina,1);assert.equal(g.sprintCooldown,0);});
test('safe room is time limited and only recharges outside',()=>{const g=running();parkEnemies(g);seconds(g,8);assert.equal(g.safeBudget,0);assert.equal(g.safe,false);seconds(g,35);assert.equal(g.safeBudget,0);Object.assign(g.player,{x:4,z:1});seconds(g,31);assert.equal(g.safeBudget,6);});
test('capture consumes a life, preserves collected orbs, and ends at zero',()=>{
  const g=running();g.safeBudget=0;const total=g.orbs.size;
  for(let i=0;i<3;i++){g.invulnerable=0;Object.assign(g.enemies[0],g.player);g.update(.001);assert.equal(g.lives,2-i);}
  assert.equal(g.phase,'gameover');assert.equal(g.orbs.size,total);g.start();assert.equal(g.lives,3);assert.equal(g.phase,'playing');
});
test('exit stays locked until every orb has been collected',()=>{const g=running();parkEnemies(g);Object.assign(g.player,g.maze.exit);g.update(.01);assert.equal(g.phase,'playing');g.orbs.clear();g.update(.01);assert.equal(g.phase,'won');assert.ok(g.score>=1500);});
test('complete route can collect every orb and reach the exit without walls',()=>{
  const g=running();parkEnemies(g);g.invulnerable=10000;
  for(const id of [...g.orbs]){const [x,z]=id.split(',').map(Number);for(const p of pathfind(g.maze,g.player,{x,z})){assert.ok(canOccupy(g.maze,p.x,p.z));Object.assign(g.player,p);g.collect();}}
  assert.equal(g.orbs.size,0);for(const p of pathfind(g.maze,g.player,g.maze.exit))Object.assign(g.player,p);g.update(.01);assert.equal(g.phase,'won');
});
test('pause freezes timers, player, enemy AI and power-up cooldowns',()=>{const g=running();g.senseAction();g.pause();const state=JSON.stringify(g);seconds(g,4,{z:1});assert.equal(JSON.stringify(g),state);g.resume();g.update(.01,{z:1});assert.ok(g.time>0);});
