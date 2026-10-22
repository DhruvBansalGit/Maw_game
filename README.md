# MAW — Below the Static

A complete, client-side 3D horror maze game built with Three.js and Vite, playable locally or through its optional static deployment. Recover 175 lost souls, survive four hunting entities, and escape the underground facility. Three lives. One way out.

All character models, concrete textures, signs, atmosphere, and audio are generated in the browser. **No game backend, Firebase, authentication, API keys, third-party runtime assets, analytics, or cloud data services.** The only saved data is settings and a personal best in localStorage. Runs are not saved between page loads.

## GitHub and hosted game

- **Play:** https://maw-game-eight.vercel.app
- **Source:** https://github.com/DhruvBansalGit/Maw_game (branch `main`)
- **Vercel project:** `maw-game`, scope `dhruv-820e`; static Vite output in `dist`, built with `npm ci` and `npm run build`, Node 24.

Published at the owner's request using the existing Vercel Hobby account; no billing changes or backend services were added. Hobby is for personal, non-commercial use. The production alias is publicly accessible without a Vercel login; preview/deployment URLs retain the account's default protection.

**Automatic GitHub deployment is not connected.** Vercel rejected repository linking because its GitHub integration does not have access to `DhruvBansalGit/Maw_game`. The source upload and CLI production deployment both succeeded independently. To enable push-to-deploy, grant the Vercel GitHub App access to this repository, then connect it under the Vercel project's Settings > Git. Until then, deploy from this folder with an authorized Vercel CLI session:

```sh
npx vercel deploy --prod --scope dhruv-820e
```

For a fresh clone, first run `npx vercel link --project maw-game --scope dhruv-820e` with the correct Vercel account. No game environment variables are required. GitHub credentials were supplied only transiently for the push and were not placed in source, remote URLs, Git history, or Vercel variables. Deployment metadata, environment files, dependencies, and generated test artifacts are excluded from Git; non-runtime files are excluded from the Vercel upload.

Hosted Chrome smoke checks passed: public HTTP 200, real movement and soul collection, heartbeat sense, minimap toggle, pause/resume, restart with three lives, settings persistence, and a 390 px menu without horizontal overflow. No page errors, failed requests, external-origin requests, or production QA hook were observed. Localhost play remains supported; local and hosted settings/high scores are separate because storage is origin-specific.

## Launch

From the workspace root:

```sh
cd horror-pacman
npm install
npm run dev
```

Open **http://127.0.0.1:5174**. Dependencies are already installed in this workspace; `npm run dev` is sufficient here. Node 22.12+ or 24 is recommended. The initial npm install requires registry access; gameplay does not require internet access once installed. Do not open the HTML directly via a file URL.

This folder was new. It reuses the workspace's established npm/Vite and Three.js approach instead of modifying another project's Next.js server or its service integrations. Existing applications remain unchanged.

For a locally served optimized build:

```sh
npm run build
npm run preview
```

Stop the dev server before previewing on the same port. Both commands bind to loopback only. No deployment or external service is required.

## Controls

- **WASD / arrows:** move relative to the camera.
- **Mouse:** look after clicking the game to capture the pointer. **Q / R** rotate the camera if pointer lock is unavailable.
- **Shift:** sprint. 2.4 seconds of full stamina; 4-second exhaustion cooldown and 7-second full recovery.
- **Space:** heartbeat sense. Reveals enemy directions/distances and minimap positions for 4 seconds; 18-second cooldown.
- **E:** use the emergency blackout console at the central hub; read sealed-exit status when nearby.
- **M:** toggle the minimap.
- **V:** switch first/third-person weapon view after BANDOOK. The choice is also available in Settings > Weapon camera and saved locally.
- **Escape:** pause/resume. Losing focus or pointer lock also pauses the run.

Close third-person camera with wall raycasts and a first-person fallback in tight corners. The player is hidden when the camera is too close, preventing a view inside the character. Keyboard/mouse desktop play is the target; narrow-screen menus are responsive, but touch movement controls are not provided.

## Survive the labyrinth

### Hidden weapon cheat: BANDOOK

During a run, type **BANDOOK** (case insensitive) to see **WEAPON UNLOCKED**. There is no visible cheat button. Expected A/D letters are consumed after the opening B, rather than moving the player; other movement/action keys and autorepeat do not corrupt the partial code. Unrelated typed letters reset the sequence. A partial code expires after five gameplay seconds without another matching letter. Menus, pause, modifiers, IME composition, settings fields, text inputs, and editable content cannot activate it.

The unlock equips a procedural rusted, bone-bound sidearm. **Third-person weapon view is the default**: Pac-Man and the weapon at his side stay visible, with a first-person fallback in tight corners. Press **V** to switch to first person and back, or select Weapon camera in Settings. Aim with the central reticle and mouse look (or Q/R). **Left mouse fires after pointer lock; F fires even if pointer lock is unavailable.** The click that first captures the mouse does not spend a shot.

- Unlimited spectral rounds, with a **3-second cooldown after every fired shot**, including a miss or wall impact. The HUD shows `WEAPON READY IN 3s` down to `WEAPON READY`, a gun icon, camera mode, controls, and the active enemy count.
- Cooldown uses the engine's elapsed gameplay time, stops during pause, and cannot be reset by retyping the code. Duplicate, held/repeated, and simultaneous firing inputs do not bypass it.
- Scene-unit ray/AABB intersection chooses the nearest wall or live enemy head/torso collider. Walls, floor, and ceiling block bullets; no auto-aim or area damage. Reach is 42 scene meters. Limb decorations are not hitboxes.
- In third person, the camera ray picks the reticle point and the shot travels from the world-space muzzle toward that point. An additional eye-to-muzzle check prevents a barrel touching a wall from spawning bullets on its other side. Looking around a corner does not let the weapon shoot through it.
- Damage is **50**. Stalker/Screamer have **100 health** (two hits); Watcher/Hunter have **150 health** (three hits). Wounded entities react and stagger for 0.4 seconds, then continue their original behavior while the gun recharges.
- Defeated entities fade, stretch and disintegrate into soul particles, award 300 points, and are excluded from AI, capture, threat/audio targeting, sensing and minimap markers. They do not respawn on life loss. Surviving enemies stay dangerous.
- Muzzle flash, recoil, procedural gunshot/impact sounds, impact particles, hit reticle feedback and subtle camera shake are included. Reduced-motion mode disables weapon recoil, muzzle flash and shake.
- Losing a life retains the unlock, damage/deaths and cooldown. **Restart / main menu resets** the gun to locked and restores every enemy. The cheat is not persisted to localStorage and adds no service, asset download or dependency.

This release includes BANDOOK plus the requested three-second cooldown, selectable weapon perspectives, corrected rear animation, and a normal forward arrow on the Settings buttons. Other Pac-Man action icons are unchanged.

### Main objective

1. Collect the pale floating souls. All 175 are reachable in the deterministic 19 × 19 connected grid.
2. Four cyan **Soul Wards** grant 9 seconds of protection. Contact banishes an entity for 7 seconds and awards a bonus.
3. The central **Blackout** console slows pursuers and stops the Watcher for 8 seconds. The player's emergency lamp remains usable; the console recharges in 30 seconds.
4. The starting **Refuge** protects for a total of 6 seconds. It recharges only after spending 30 seconds outside. It is not a place to camp indefinitely.
5. The gate in the **southeast corner (17 / 17)** opens automatically when every required soul is recovered. Reach it to win.
6. Capture costs a life, preserves recovered souls, returns the player and enemies to their starting positions, and grants 5 seconds of recovery immunity. Zero lives ends the run.

The score includes souls, wards, banishments, and an escape bonus based on remaining lives and elapsed time. High scores are local to the browser and origin.

### The four entities

- **Stalker:** remembers periodic player positions; reacts more often and speeds up nearby.
- **Screamer:** alternates pursuit with unpredictable adjacent turns; proximity triggers a brief, cooldown-limited audio/visual scare.
- **Watcher:** waits at the central intersection, observes for two seconds before pursuit, and freezes during blackouts.
- **Hunter:** aims ahead of the player where the grid allows, uses shortest paths, and gains the strongest late-run speed increase.

All routes use grid BFS. Enemies change direction at cell centers instead of cutting through wall corners. Player circle collision uses axis separation and small substeps. Speed is delta-time based; very long frame gaps are clamped to avoid teleporting through the level.

## Art, audio, accessibility, performance

- Weathered spherical player with one continuous skin and a front-only animated mouth wedge. Rear vertices stay fixed during the bite cycle; the old rotating hemispheres and overlapping rear mouth disks have been removed. Eyes, teeth, glowing mouth and trailing particles remain.
- Distinct procedural entity silhouettes, shrouds, elongated limbs, the Watcher's crown, and skeletal Hunter geometry.
- Cracked/stained concrete, overhead pipes, warning signs, emergency lamps, gurney, debris, webs, drifting dust, and occasional sparks.
- Exponential scene fog and emissive fixtures provide atmosphere without expensive volumetric ray marching. No postprocessing bloom dependency.
- Instanced walls, floor tiles, pipes, rubble, and soul collectibles. Only six nearby dynamic ceiling lights plus the player lamp/fill; dynamic shadows are high-preset only.
- Procedural Web Audio drone, creaks, footsteps, proximity heartbeat, directional filtered enemy noise, pickups, wards, capture, and victory cues. Audio starts only after a gesture. Failure leaves the game playable with visual cues.
- Persistent volume, SFX, ambient, sensitivity, quality, camera-shake, mute, reduced-motion/flicker, and minimap settings.
- Reduced-motion defaults to the OS preference; it stops decorative movement, light flicker, sparks, camera shake, and impact flashes. It is not a guarantee of suitability for every photosensitive player.
- Settings/manual dialogs have focus containment, labeled controls, keyboard dismissal, and restoration of focus.
- WebGL failure shows an actionable message rather than silently failing. WebGL-capable hardware/browser is required to play.

## Source map

- [index.html](index.html): local entry point and canvas.
- [src/main.js](src/main.js): application states, desktop input, HUD/minimap, dialogs, settings, persistence, lifecycle.
- [src/scene.js](src/scene.js): Three.js renderer, procedural environment and characters, lighting, animation, camera collision, resource disposal.
- [src/pacman-body.js](src/pacman-body.js): continuous spherical skin and front-only mouth deformation with a fixed rear surface.
- [src/maze.js](src/maze.js): seeded connected maze, BFS paths, circle collision, substepped movement.
- [src/game.js](src/game.js): engine, four enemy behaviors, collectibles, power-ups, capture, scoring, win/loss.
- [src/audio.js](src/audio.js): procedural sound graph and transient-resource cleanup.
- [src/weapon.js](src/weapon.js): cheat sequence, weapon balance, renderer-independent wall/target ray tests.
- [src/weapon-view.js](src/weapon-view.js): procedural 3D sidearm, muzzle flash, pooled impact and defeat particles.
- [src/weapon.css](src/weapon.css): unlocked-only weapon HUD and aiming/hit reticle.
- [src/style.css](src/style.css): horror menu, responsive HUD, dialogs, overlays.
- [package.json](package.json): npm commands and pinned minimal dependencies.
- [playwright.config.js](playwright.config.js): local browser test setup; uses installed Chrome on macOS when available, Chromium otherwise.

## Validation

```sh
npm test
npm run build
npm run test:browser
npm audit
```

If no compatible Chrome/Playwright browser is installed, run `npx playwright install chromium` once. This download is test tooling only, not a runtime game requirement.

Verified in this workspace:

- **30 engine tests pass:** the original 20 maze/gameplay tests, eight weapon suites, and two mesh tests cover activation, ray obstruction, damage, three-second timing, pause/reset, AI and fixed rear vertices/front mouth surfaces. A complete collection-to-exit route is exercised using the actual movement integrator with enemies disabled, not just teleporting between objectives.
- **18 browser journeys pass:** the original nine cover WebGL, local-only requests, controls, camera, audio, settings, lifecycle and fallback. Five weapon journeys cover typed unlock, shooting, three-second countdown, pause, defeat, exclusions and effects. Four additional journeys cover the Settings arrow, persistent camera choice, V toggling both ways, real hits in both perspectives, third-person wall obstruction and rear-surface ray checks. If headless Chrome declines native pointer lock, the mouse dispatch branch is tested with a simulated granted lock; native pointer-lock permission behavior remains browser-dependent.
- Native headless Chrome measured **about 60.16 FPS at 1440 × 900**, medium preset, with 110 draw calls and 28,318 visible triangles during the sampled unarmed view. This is a measurement on this machine, not a promise across devices or all views. Use Low on slower hardware.
- Optimized production build smoke-tested locally with real typed BANDOOK activation, F firing/cooldown and pause/resume, in addition to the earlier movement/collection/sense checks: **no page errors, no remote requests, and no development test surface**.
- Production build succeeds; its single approximately 563 kB minified JavaScript bundle (148 kB gzip, including Three.js) produces a non-fatal Vite chunk-size advisory.
- **npm audit: zero vulnerabilities**, including development dependencies.

Browser snapshots are under [artifacts/qa](artifacts/qa). Automated mechanics checks are extensive, but difficulty has not been validated by a completed unaided human survival run. Only Chromium/Chrome were exercised; Safari and Firefox have not been tested here.

## Lifecycle and local data

Input listeners are attached once and cleaned up using an AbortController. Restart resets the engine and reuses the scene, rather than accumulating meshes, renderers, or listeners. Scene disposal releases geometries, materials, textures, resize listeners, and the renderer; audio nodes disconnect at the end of each effect and the context is closed on teardown. Optional storage errors are caught so privacy-restricted browsers can still play.

Storage keys: `maw.settings`, `maw.best`. Clear those site-storage entries to reset preferences and high score. No account or saved-run migration exists. Development-only deterministic QA hooks require the explicit `?qa=1` query and are removed by production compilation.
