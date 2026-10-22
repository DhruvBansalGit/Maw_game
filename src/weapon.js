import { CELL } from './maze.js';

// Gameplay balance: unlimited spectral rounds, but every fired shot (including a miss)
// costs three seconds. Two hits for Stalker/Screamer, three for Watcher/Hunter.
export const WEAPON = Object.freeze({ cooldown: 3, damage: 50, range: 42 });
export const ENEMY_HEALTH = [100, 100, 150, 150];
const CODE = 'BANDOOK';
const GAMEPLAY_KEYS = new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyR','KeyE','KeyM','KeyF']);
export function editableTarget(target) {
  return !!(target?.isContentEditable || target?.closest?.('input,textarea,select,[role="textbox"],[contenteditable]:not([contenteditable="false"])'));
}
export class CheatSequence {
  constructor() { this.reset(); }
  reset() { this.prefix = ''; this.lastAt = -Infinity; }
  feed(event, time) {
    if (editableTarget(event.target) || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) { this.reset(); return { consumed: false, unlocked: false }; }
    if (time - this.lastAt > 5) this.reset();
    if (event.repeat || !/^[a-z]$/i.test(event.key || '')) return { consumed: false, unlocked: false };
    const letter = event.key.toUpperCase();
    // A/D belong to the code only when expected after B. Other movement/action
    // keys and autorepeat never corrupt a partial code or become phantom letters.
    if (letter === CODE[this.prefix.length]) {
      this.prefix += letter; this.lastAt = time;
      const unlocked = this.prefix === CODE;
      if (unlocked) this.reset();
      return { consumed: true, unlocked };
    }
    if (GAMEPLAY_KEYS.has(event.code)) return { consumed: false, unlocked: false };
    this.reset();
    if (letter === 'B') { this.prefix = 'B'; this.lastAt = time; return { consumed: true, unlocked: false }; }
    return { consumed: false, unlocked: false };
  }
}

// Analytic slab ray/AABB test in scene units, independent of the renderer. This
// makes first-hit occlusion deterministic and testable without WebGL.
export function rayBox(origin, direction, min, max, range = WEAPON.range) {
  let near = 0, far = range;
  for (const axis of ['x','y','z']) {
    if (Math.abs(direction[axis]) < 1e-9) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null;
    } else {
      let a = (min[axis] - origin[axis]) / direction[axis], b = (max[axis] - origin[axis]) / direction[axis];
      if (a > b) [a,b] = [b,a];
      near = Math.max(near,a); far = Math.min(far,b);
      if (near > far) return null;
    }
  }
  return near;
}
export function traceShot(maze, enemies, origin, direction) {
  if (![origin?.x,origin?.y,origin?.z,direction?.x,direction?.y,direction?.z].every(Number.isFinite)) return null;
  const length = Math.hypot(direction.x,direction.y,direction.z);
  if (length < 1e-8) return null;
  const dir = { x: direction.x/length, y: direction.y/length, z: direction.z/length };
  let result = { kind: 'miss', distance: WEAPON.range, enemyIndex: null };
  const test = (min,max,kind,enemyIndex = null) => {
    const d = rayBox(origin,dir,min,max,result.distance);
    // Strictly closer: walls win ties, so a target cannot be hit through a face.
    if (d !== null && d < result.distance) result = {kind, distance:d, enemyIndex};
  };
  maze.grid.forEach((row,z) => row.forEach((wall,x) => {
    if (wall) test({x:(x-.5)*CELL,y:0,z:(z-.5)*CELL},{x:(x+.5)*CELL,y:3.15,z:(z+.5)*CELL},'wall');
  }));
  const end = maze.grid.length*CELL;
  test({x:-CELL,y:-.16,z:-CELL},{x:end,y:0,z:end},'wall');
  test({x:-CELL,y:3.225,z:-CELL},{x:end,y:3.475,z:end},'wall');
  // Head/torso collision envelope follows each live entity's current position.
  // Limbs are cosmetic; banished entities remain hittable, dead entities do not.
  enemies.forEach((e,i) => {
    if (e.dead) return;
    test({x:e.x*CELL-.34,y:.2,z:e.z*CELL-.34},{x:e.x*CELL+.34,y:e.type===3?2.25:2.05,z:e.z*CELL+.34},'enemy',i);
  });
  return {...result, point: {x:origin.x+dir.x*result.distance,y:origin.y+dir.y*result.distance,z:origin.z+dir.z*result.distance}};
}
