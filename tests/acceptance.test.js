import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { pathfind, distance, canOccupy } from '../src/maze.js';
test('entire collection-to-victory route works using simulated movement, not teleportation',()=>{
  const g=new Game();g.start();g.invulnerable=10000;g.enemies.forEach(e=>e.stun=10000);
  function travel(destination){
    for(const waypoint of pathfind(g.maze,g.player,destination)){
      let budget=100;
      while(distance(g.player,waypoint)>.03 && budget-->0){
        g.update(.02,{x:waypoint.x-g.player.x,z:waypoint.z-g.player.z});
        assert.ok(canOccupy(g.maze,g.player.x,g.player.z));
        if(g.phase==='won')return; // The trigger occupies a radius, not only the exact gate center.
      }
      assert.ok(budget>0,'controller stuck at a waypoint');
    }
  }
  for(const id of [...g.orbs]){if(!g.orbs.has(id))continue;const [x,z]=id.split(',').map(Number);travel({x,z});}
  assert.equal(g.collected,g.total);travel(g.maze.exit);assert.equal(g.phase,'won');assert.ok(g.time>60);
});
test('last-life capture cannot be overwritten by a victory in the same frame',()=>{
  const g=new Game();g.start();g.orbs.clear();g.lives=1;g.invulnerable=0;g.safeBudget=0;
  Object.assign(g.player,g.maze.exit);Object.assign(g.enemies[0],g.player);g.update(.001);
  assert.equal(g.lives,0);assert.equal(g.phase,'gameover');assert.equal(g.events.some(e=>e.type==='win'),false);
});
