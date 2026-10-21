# Station 06 visual prototype

Local route: `/station`. Start with `pnpm --filter @belac/web dev --host 127.0.0.1 --port 5186`.

This is a standalone design study for judging one station before building the circular ten-station room. It is lazy loaded independently of the existing public application. No backend, ledger, deployment or production-provider changes are included.

## Included

- Real Three.js / React Three Fiber geometry: curved wall, raised floor, desk, chair, keyboard, accessories, lamp and planting.
- A seated, rigged robot on the viewer's side of the desk, normally facing the oversized wall-mounted monitor. The chair seat and robot swivel together into a 45-degree greeting pose when the central camera faces the station; the caster base stays still. Looking away or selecting bird's-eye returns the operator to work. Separate gaze entry/exit thresholds and a short dwell prevent jitter. Arms withdraw from the keyboard during the turn.
- A fixed central camera position with limited look-around dragging. The bird's-eye button transitions to an elevated view of the same geometry; it does not swap images.
- A canvas-textured monitor showing the same illustrative position and return as the accessible HTML footer. The deterministic feed updates every 3.8 seconds and can be paused.
- Keyboard shortcuts 1 and 2 for the views; reduced-motion support; a narrow-screen layout.
- The “Say hello” button replays the swivel. Reduced-motion users see immediate pose changes.

All figures are simulated, including the chart. They do not represent Kamino returns or an actual USDC deposit. No live financial API is used. The character is a visual host and does not operate a trading agent.

## Asset provenance

`apps/web/public/station/robot.glb` is RobotExpressive by Tomás Laulhé / Quaternius, CC0 1.0, with modifications by Don McCurdy. Original source:

https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive

The original attribution is preserved in `apps/web/public/station/robot-source.md`, also linked from the preview.

The Kamino logo is the official-site logo previously collected for this design exploration. It identifies the platform; it does not imply affiliation.

The station is authored in TypeScript. It is not a Blender-authored custom character or a final character commission. The licensed character provides a concrete art-direction reference which can be replaced independently of the set.

## Verification

```powershell
pnpm --filter @belac/web build
pnpm exec eslint apps/web/src/station apps/web/src/main.tsx apps/web/e2e/station.spec.ts
pnpm --filter @belac/web e2e station.spec.ts
```

The browser tests exercise loading, simulated-value changes, pause/resume, both cameras, the greeting button, keyboard navigation, look-away/return chair swivels and the narrow layout. They capture the centre, bird's-eye and mobile views in `artifacts/`.

The 3D bundle is loaded only on this preview route. Full-room asset budgets, final character art, live API wiring and multi-station navigation remain future work.

## Kamino composition review — 20 October 2026

Kamino alone now uses a light architectural surround, a single logo lockup, navy cabinet and upholstery, and a pale-blue inset. Its dedicated display prioritises position value, net result, a performance line and deposit status. The official app colours were checked against `https://kamino.com/assets/style.1792482897.css`; the neutral set finishes are studio choices. Data remains illustrative.

The wider screen stays within the wall with space for the logo. The chair and keyboard move together 0.3 local units right; the seated rig and tested cushion clearance are preserved. Other cubicles retain their existing designs pending review.

There are only two camera modes: centre and the full-room bird's-eye at 45 degrees. Bird's-eye faces toward the selected bay so its front can be judged in the context of the whole room. There is no separate close-up 45-degree camera.

Review captures: `artifacts/kamino-composition-centre.png` and `artifacts/kamino-composition-45.png`. Run `pnpm --filter @belac/web e2e kamino-review.spec.ts` after building to refresh the captures and check the swivel, camera transitions and navigation.

## Central operator and room spacing — 20 October 2026

The room's station radius is 13.8 (previously 10.8). The central desk radius is 3.15 (previously 2.32), with only a keyboard on its surface. The operator is a new procedural 3D character based on Caleb's supplied photo: black cap, geometric light emblem, dark shirt, mechanical beard/jaw plates and left-wrist watch. The reference photo stays outside the app and is not uploaded or included in assets. The head is hidden from the centre first-person camera to prevent self-intersection; it remains visible in bird's-eye.

Kamino's display is raised to local y=3.58 and measures 6.7 by 3.84. Its one logo is drawn in the webpage header; the external signature and side strip are removed. Other displays are scaled for the expanded room. `operator-review.html` is a local Vite character inspection page, separate from the studio's two camera modes.
