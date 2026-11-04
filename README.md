# Operation Debt Fury

An incremental clicker game about spending US taxpayer money on an ever-larger military. The player starts with $15 of appropriated funds, clicks a pallet of cash to spend it, and procures an escalating force of 40 asset tiers. The force runs from a single Army recruit to a Carrier Strike Group, then on to an orbital carrier, a lunar Marine base and a Dyson-sphere defence contract. All art, music and text are original. The pixel art is defined as code, the music is a procedural chiptune score synthesised with the Web Audio API, and no external images or audio files are used.

## Running the Game

```bash
npm install
npm run dev
```

The production build is a static site in `dist/` that can be uploaded to GitHub Pages or itch.io:

```bash
npm run build
```

## Game Systems

| System | Description |
| --- | --- |
| Economy | Clicks and assets spend money. Congress refunds every dollar spent into the budget, and purchases count as spending. The score is total dollars spent. |
| Assets | 40 tiers: 20 air, 8 ground, 8 sea and 4 space. Each tier has seven upgrades, and upgrades change its board livery from standard to low-visibility, special and gold-plated. |
| Board | An animated theatre with orbit, air, ground and sea lanes. Assets fight a continuous live-fire exercise: bombers fly carpet-bombing runs, the A-10 fires strafing runs, interceptors airburst, VLS launches pitch over, carriers launch jets from the catapult, ICBMs launch, and orbital lasers fire. Explosions use additive glow, smoke, debris, shockwaves and cash. |
| Cinematics | Letterboxed "New Asset Deployed" title cards, screen shake, click combos, promotion title cards, golden-event light rays, screen-edge pulses for frenzies and alarms, and a full inauguration sequence on prestige. |
| Upgrades | Per-asset multipliers, pallet click upgrades, and 12 synergy doctrines (for example, aerial refuelling and JADC2). |
| Research | Black Budget R&D: five branches (Stealth, Hypersonics, Autonomy, Nuclear, Space) of eight projects each. Some projects unlock assets. |
| Contractors | Six fictional firms. Lobbying gives permanent line bonuses, and contracts give temporary boosts with random overruns. |
| Branches and ranks | Branch levels come from branch spending. Twenty-one ranks run from Private to Emperor of the Military-Industrial Complex. |
| Events | Golden lobbyist briefcases, the $10,000 toilet seat, Congressional audits (a receipt-shredding mini-game) and scheduled war games. |
| Prestige | New Administration converts lifetime spending into Political Capital (cube-root curve). Capital grants a square-root mandate bonus and buys 15 permanent Executive Orders. |
| Medals | 110 achievements, each adding +1% morale. Secret medals are included. |
| Audio | Four original tracks (Appropriations March, War Room Briefing, Emergency Supplemental, New Administration Fanfare). Layers are added as spending rises, and around 20 sound effects are synthesised. |

## Pacing

`scripts/balance-sim.ts` runs a greedy headless player at five clicks per second:

```bash
npm run sim -- 4 5
```

With the current curve, the simulated player reaches the first New Administration at about 19 minutes, the Carrier Strike Group at about 3 hours and the Dyson Sphere at about 3 h 15 min.

## Development Tools

- `npm test` runs the Vitest suites for number formatting, cost curves, bulk purchases, multipliers, prestige and save migration.
- `npx tsx scripts/render-sprites.ts src/art/sprites/air1.ts out.png 4` renders a sprite module to a PNG contact sheet in all four liveries and validates the pixel maps.

## Project Layout

```
src/core     state, economy, events, save, number formatting, event bus
src/data     assets, upgrades, research, contractors, ranks, orders, medals, headlines
src/art      palette, sprite rasteriser, procedural insignia and ribbons, sprite maps
src/board    animated canvas board and combat effects
src/audio    Web Audio synthesiser, sequencer and tracks
src/ui       DOM panels, store, overlays, cinematics, styles
```

Saves are stored in the browser's localStorage and can be exported or imported as a text code from Settings.
