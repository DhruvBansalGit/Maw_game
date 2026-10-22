// All coordinates are cell centers. The same grid drives rendering, collision and AI.
export const SIZE = 19;
export const CELL = 3.2;
export const key = (x, z) => `${x},${z}`;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function random(seed = 7151) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
}
export function makeMaze(seed = 7151) {
  const rng = random(seed), grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(1));
  const stack = [[1, 1]]; grid[1][1] = 0;
  const dirs = [[0, 2], [2, 0], [0, -2], [-2, 0]];
  while (stack.length) {
    const [x, z] = stack.at(-1);
    const choices = dirs.filter(([dx, dz]) => x + dx > 0 && x + dx < SIZE - 1 && z + dz > 0 && z + dz < SIZE - 1 && grid[z + dz][x + dx]);
    if (!choices.length) { stack.pop(); continue; }
    const [dx, dz] = choices[Math.floor(rng() * choices.length)];
    grid[z + dz / 2][x + dx / 2] = grid[z + dz][x + dx] = 0;
    stack.push([x + dx, z + dz]);
  }
  // Cross-links permit flanking; rooms are opened onto the already connected maze.
  for (let i = 0; i < 28; i++) {
    const x = 1 + Math.floor(rng() * (SIZE - 2)), z = 1 + Math.floor(rng() * (SIZE - 2));
    if (grid[z][x] && ((!grid[z][x - 1] && !grid[z][x + 1]) || (!grid[z - 1][x] && !grid[z + 1][x]))) grid[z][x] = 0;
  }
  for (const [cx, cz] of [[2, 2], [9, 9], [16, 16]])
    for (let z = cz - 1; z <= cz + 1; z++) for (let x = cx - 1; x <= cx + 1; x++) grid[z][x] = 0;
  for (let z = 1; z <= 7; z++) grid[z][1] = 0;
  const cells = [];
  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) if (!grid[z][x]) cells.push({ x, z });
  const maze = { grid, cells, spawn: { x: 2, z: 2 }, exit: { x: 17, z: 17 }, refuge: { x: 2, z: 2 }, switch: { x: 9, z: 9 } };
  maze.spawns = [{ x: 17, z: 1 }, { x: 1, z: 17 }, { x: 9, z: 9 }, { x: 17, z: 17 }];
  maze.souls = [{ x: 9, z: 1 }, { x: 1, z: 13 }, { x: 17, z: 9 }, { x: 9, z: 17 }];
  return maze;
}
export function walkable(maze, x, z) { return maze.grid[z]?.[x] === 0; }
export function neighbors(maze, p) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => ({ x: p.x + dx, z: p.z + dz })).filter(p => walkable(maze, p.x, p.z));
}
export function cellOf(p) { return { x: Math.round(p.x), z: Math.round(p.z) }; }
export function pathfind(maze, from, to) {
  const start = cellOf(from), goal = cellOf(to), queue = [start], prev = new Map([[key(start.x, start.z), null]]);
  if (!walkable(maze, goal.x, goal.z)) return [];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]; if (p.x === goal.x && p.z === goal.z) break;
    for (const n of neighbors(maze, p)) if (!prev.has(key(n.x, n.z))) { prev.set(key(n.x, n.z), p); queue.push(n); }
  }
  if (!prev.has(key(goal.x, goal.z))) return [];
  const route = []; let p = goal;
  while (p) { route.push(p); p = prev.get(key(p.x, p.z)); }
  return route.reverse().slice(1);
}
export function canOccupy(maze, x, z, radius = .21) {
  for (let iz = Math.floor(z + .5 - radius); iz <= Math.floor(z + .5 + radius); iz++)
    for (let ix = Math.floor(x + .5 - radius); ix <= Math.floor(x + .5 + radius); ix++) {
      if (walkable(maze, ix, iz)) continue;
      const dx = x - Math.max(ix - .5, Math.min(x, ix + .5));
      const dz = z - Math.max(iz - .5, Math.min(z, iz + .5));
      if (dx * dx + dz * dz < radius * radius) return false;
    }
  return true;
}
export function move(maze, body, dx, dz, radius = .21) {
  // Axis separation permits sliding; small substeps prevent tunneling at low FPS.
  const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .08));
  for (let i = 0; i < count; i++) {
    if (canOccupy(maze, body.x + dx / count, body.z, radius)) body.x += dx / count;
    if (canOccupy(maze, body.x, body.z + dz / count, radius)) body.z += dz / count;
  }
}
