import { makeMaze, key, distance, pathfind, cellOf, neighbors, move, random, walkable } from './maze.js';
export const ARCHETYPES = [
  { name: 'THE STALKER', speed: .82, cue: 'Something is breathing behind you.' },
  { name: 'THE SCREAMER', speed: 1.05, cue: 'Do not follow the voices.' },
  { name: 'THE WATCHER', speed: 1.16, cue: 'It has noticed you.' },
  { name: 'THE HUNTER', speed: 1.12, cue: 'You are being hunted.' },
];
export class Game {
  constructor(seed = 7151) { this.seed = seed; this.maze = makeMaze(seed); this.reset(); }
  reset() {
    this.rng = random(this.seed + 42); this.phase = 'menu'; this.time = 0; this.score = 0; this.lives = 3;
    this.player = { ...this.maze.spawn, dx: 0, dz: 1, moving: false };
    this.orbs = new Set(this.maze.cells.filter(p => distance(p, this.maze.spawn) > 1.2 && distance(p, this.maze.exit) > .1).map(p => key(p.x, p.z)));
    this.total = this.orbs.size; this.souls = new Set(this.maze.souls.map(p => key(p.x, p.z)));
    this.enemies = this.maze.spawns.map((p, i) => ({ ...p, type: i, target: null, path: [], stun: 0, wake: 0, decision: 0, lastSeen: { ...this.player }, scare: 0 }));
    this.ward = 0; this.invulnerable = 5; this.blackout = 0; this.blackoutCooldown = 0; this.sense = 0; this.senseCooldown = 0;
    this.stamina = 1; this.sprintCooldown = 0; this.sprinting = false; this.safeBudget = 6; this.safeRecharge = 0; this.safe = false;
    this.threat = 0; this.nearest = null; this.events = []; this.captureFlash = 0; this.screamFlash = 0; this.pickupFlash = 0;
  }
  start() { this.reset(); this.phase = 'playing'; this.emit('start', 'Collect the lost souls. The gate opens when none remain.'); }
  emit(type, text, extra = {}) { this.events.push({ type, text, ...extra }); }
  pause() { if (this.phase === 'playing') this.phase = 'paused'; }
  resume() { if (this.phase === 'paused') this.phase = 'playing'; }
  senseAction() {
    if (this.phase !== 'playing' || this.senseCooldown > 0) return;
    this.sense = 4; this.senseCooldown = 18; this.emit('sense', 'HEARTBEAT SENSE · their positions are revealed for 4 seconds.');
  }
  interact() {
    if (this.phase !== 'playing') return;
    if (distance(this.player, this.maze.switch) < 1.25 && this.blackoutCooldown <= 0) {
      this.blackout = 8; this.blackoutCooldown = 30; this.emit('blackout', 'BLACKOUT · 8 seconds. They slow down. Keep moving.');
    } else if (distance(this.player, this.maze.exit) < 1.1 && this.orbs.size) this.emit('locked', `GATE SEALED · ${this.orbs.size} souls still below.`);
  }
  update(dt, input = {}) {
    if (this.phase !== 'playing') return;
    // Integrate at <= 30ms even after a slow frame. Long background gaps are paused by UI.
    dt = Math.max(0, Math.min(dt, .15));
    while (dt > 0) { const step = Math.min(dt, .03); this.step(step, input); dt -= step; if (this.phase !== 'playing') break; }
  }
  step(dt, input) {
    this.time += dt;
    for (const field of ['ward','invulnerable','blackout','blackoutCooldown','sense','senseCooldown','sprintCooldown','captureFlash','screamFlash','pickupFlash']) this[field] = Math.max(0, this[field] - dt);
    const dx = input.x || 0, dz = input.z || 0, magnitude = Math.hypot(dx, dz);
    this.sprinting = !!input.sprint && magnitude > .01 && this.stamina > .01 && this.sprintCooldown <= 0;
    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - dt / 2.4);
      if (this.stamina <= .01) { this.stamina = 0; this.sprintCooldown = 4; }
    } else this.stamina = Math.min(1, this.stamina + dt / 7);
    const speed = this.sprinting ? 2.35 : 1.4, before = { ...this.player };
    if (magnitude > .01) {
      this.player.dx = dx / magnitude; this.player.dz = dz / magnitude;
      move(this.maze, this.player, this.player.dx * speed * dt, this.player.dz * speed * dt);
    }
    this.player.moving = distance(before, this.player) > .0001;
    const inside = distance(this.player, this.maze.refuge) < .85;
    this.safe = inside && this.safeBudget > 0;
    if (this.safe) { this.safeBudget = Math.max(0, this.safeBudget - dt); this.safeRecharge = 30; }
    else if (!inside) { this.safeRecharge = Math.max(0, this.safeRecharge - dt); if (!this.safeRecharge) this.safeBudget = 6; }
    this.collect();
    for (const enemy of this.enemies) this.updateEnemy(enemy, dt);
    const sorted = [...this.enemies].sort((a,b) => distance(a,this.player)-distance(b,this.player));
    this.nearest = sorted[0]; const range = distance(this.nearest, this.player);
    this.threat = this.ward > 0 || this.safe ? 0 : Math.max(0, 1 - range / 6);
    for (const enemy of this.enemies) {
      if (distance(enemy, this.player) < .43 && enemy.stun <= 0) {
        if (this.ward > 0) { enemy.stun = 7; this.score += 200; this.emit('banish', `${ARCHETYPES[enemy.type].name} · silenced for 7 seconds.`); }
        else if (!this.safe && this.invulnerable <= 0) { this.capture(enemy); break; }
      }
    }
    if (this.phase === 'playing' && !this.orbs.size && distance(this.player, this.maze.exit) < .65) {
      this.phase = 'won'; this.score += this.lives * 500 + Math.max(0, 1800 - Math.floor(this.time * 3)); this.emit('win', 'You brought them back. But something followed.');
    }
  }
  collect() {
    const p = cellOf(this.player), id = key(p.x,p.z);
    if (distance(p, this.player) > .39) return;
    if (this.orbs.delete(id)) { this.score += 10; this.pickupFlash = .15; this.emit('pickup'); if (!this.orbs.size) this.emit('unlock', 'ALL SOULS RECOVERED · reach the green gate at sector 17 / 17.'); }
    if (this.souls.delete(id)) { this.ward = 9; this.score += 50; this.emit('ward', 'SOUL WARD · 9 seconds. Touch a pursuer to silence it.'); }
  }
  updateEnemy(e, dt) {
    e.scare = Math.max(0, e.scare - dt);
    if (e.stun > 0) { e.stun = Math.max(0, e.stun - dt); return; }
    const range = distance(e, this.player), progress = 1 - this.orbs.size / this.total;
    if (e.type === 2) {
      if (this.blackout > 0) return;
      if (range < 6) e.wake = Math.min(2.1, e.wake + dt); else e.wake = Math.max(0,e.wake - dt * .1);
      if (e.wake < 2) return;
    }
    if (e.type === 1 && range < 2 && e.scare <= 0 && this.invulnerable <= 0) {
      e.scare = 16; this.screamFlash = .4; this.emit('scream', ARCHETYPES[1].cue);
    }
    // Route changes occur ONLY at a waypoint center. Never cut across wall corners.
    if (!e.target) {
      e.decision -= 1;
      let destination = cellOf(this.player);
      if (this.ward > 0) {
        destination = [...this.maze.spawns].sort((a,b) => distance(b,this.player)-distance(a,this.player))[0];
      } else if (e.type === 0) {
        if (e.decision <= 0) { e.lastSeen = destination; e.decision = range < 4 ? 1 : 3; }
        destination = e.lastSeen;
      } else if (e.type === 1 && this.rng() < .48) {
        const options = neighbors(this.maze, cellOf(e)); destination = options[Math.floor(this.rng() * options.length)];
      } else if (e.type === 3) {
        const ahead = { x: Math.round(this.player.x + this.player.dx * 2), z: Math.round(this.player.z + this.player.dz * 2) };
        if (range > 3 && walkable(this.maze,ahead.x,ahead.z)) destination = ahead;
      }
      e.path = pathfind(this.maze,e,destination); e.target = e.path[0] || null;
      if (!e.target) return;
    }
    let speed = ARCHETYPES[e.type].speed + Math.min(.22,this.time / 1500) + progress * (e.type === 3 ? .47 : .14);
    if (e.type === 0 && range < 3) speed += .25;
    if (this.blackout > 0) speed *= .48;
    if (this.ward > 0) speed *= .7;
    const d = distance(e,e.target), step = Math.min(d,speed * dt);
    if (d > .00001) { e.x += (e.target.x-e.x)/d*step; e.z += (e.target.z-e.z)/d*step; }
    if (step >= d) { e.x = e.target.x; e.z = e.target.z; e.target = null; }
  }
  capture(enemy) {
    this.lives--; this.captureFlash = 1.1; this.emit('capture', `${ARCHETYPES[enemy.type].name} found you. ${this.lives} ${this.lives === 1 ? 'life' : 'lives'} remain.`);
    if (this.lives <= 0) { this.phase = 'gameover'; this.emit('lose', 'The labyrinth keeps what it catches.'); return; }
    Object.assign(this.player,this.maze.spawn); this.invulnerable = 5;
    this.enemies.forEach((e,i) => Object.assign(e,this.maze.spawns[i],{ target:null, path:[], wake:0 }));
  }
  get collected() { return this.total - this.orbs.size; }
}
