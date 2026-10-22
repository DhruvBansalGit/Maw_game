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
- **Escape:** pause/resume. Losing focus or pointer lock also pauses the run.

Close third-person camera with wall raycasts and a first-person fallback in tight corners. The player is hidden when the camera is too close, preventing a view inside the character. Keyboard/mouse desktop play is the target; narrow-screen menus are responsive, but touch movement controls are not provided.

## Survive the labyrinth

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

- Weathered split-jaw spherical player; eyes, teeth, glowing mouth, movement-dependent bite animation, and trailing particles.
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
- [src/maze.js](src/maze.js): seeded connected maze, BFS paths, circle collision, substepped movement.
- [src/game.js](src/game.js): engine, four enemy behaviors, collectibles, power-ups, capture, scoring, win/loss.
- [src/audio.js](src/audio.js): procedural sound graph and transient-resource cleanup.
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

- **20 engine tests pass:** maze connectivity and every objective's reachability, orthogonal BFS, player wall collision/tunneling, equal-time movement, normalized diagonals, orb count/reset, long-running enemy collision checks, all mechanics, capture, three lives, pause, victory, and last-life race handling. A complete collection-to-exit route is exercised using the actual movement integrator with enemies disabled, not just teleporting between objectives.
- **9 browser journeys pass:** actual WebGL draws, local-only requests, real keyboard movement and collection, camera/map/sense, pause/resume, settings persistence, game-over/restarts, victory/high score, narrow layout, camera-wall regression, actual Web Audio output/mute/pause, reduced-motion setting, frame-budget sampling, and WebGL failure UI.
- Native headless Chrome measured **about 30.35 FPS at 1440 × 900**, medium preset, with 111 draw calls and 27,502 visible triangles during the sampled view. This is a measurement on this machine, not a promise across devices or all views. Use Low on slower hardware.
- Optimized production build smoke-tested with real movement, collection, and sense: **no page errors, no remote requests, and no development test surface**.
- Production build succeeds; its single approximately 549 kB minified JavaScript bundle (144 kB gzip, including Three.js) produces a non-fatal Vite chunk-size advisory.
- **npm audit: zero vulnerabilities**, including development dependencies.

Browser snapshots are under [artifacts/qa](artifacts/qa). Automated mechanics checks are extensive, but difficulty has not been validated by a completed unaided human survival run. Only Chromium/Chrome were exercised; Safari and Firefox have not been tested here.

## Lifecycle and local data

Input listeners are attached once and cleaned up using an AbortController. Restart resets the engine and reuses the scene, rather than accumulating meshes, renderers, or listeners. Scene disposal releases geometries, materials, textures, resize listeners, and the renderer; audio nodes disconnect at the end of each effect and the context is closed on teardown. Optional storage errors are caught so privacy-restricted browsers can still play.

Storage keys: `maw.settings`, `maw.best`. Clear those site-storage entries to reset preferences and high score. No account or saved-run migration exists. Development-only deterministic QA hooks require the explicit `?qa=1` query and are removed by production compilation.
