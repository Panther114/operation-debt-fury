# Operation Debt Fury

**Spend the Taxpayer's Money.** A satirical incremental clicker game about spending US taxpayer money on an ever-larger military, presented by a pixel-art President with a very large signature. The player starts with $15 of appropriated funds, clicks a pallet of cash to spend it, and procures an escalating force of 40 asset tiers. The force runs from a single Army recruit to a Carrier Strike Group, then on to an orbital carrier, a lunar Marine base and a Dyson-sphere defence contract. The final level, Big Bang 2: The Sequel, spends the entire universe; it ends the game with a closing film, a Final Audit Report of the playthrough and a Hall of Fame of completion times. All art, music and text are original. The pixel art is defined as code, the music is a procedural chiptune score synthesised with the Web Audio API, and no external images or audio files are used.

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
| Economy | Clicks and assets spend money. Congress refunds every dollar spent into the budget, and purchases count as spending. The score is total dollars spent. Intern (automatic) clicks receive 25% of the "% of $/s" click bonus. |
| Assets | 40 tiers: 20 air, 8 ground, 8 sea and 4 space. Each tier has seven upgrades, and upgrades change its board livery from standard to low-visibility, special and gold-plated. |
| Board | An animated theatre with orbit, air, ground and sea lanes. Assets fight a continuous live-fire exercise: bombers fly carpet-bombing runs, the A-10 fires strafing runs, interceptors airburst, VLS launches pitch over, carriers launch jets from the catapult, ICBMs launch, and orbital lasers fire. Explosions use additive glow, smoke, debris, shockwaves and cash. |
| Cinematics | Letterboxed "New Asset Deployed" title cards, screen shake, click combos, promotion title cards, golden-event light rays, screen-edge pulses for frenzies and alarms, and a full inauguration sequence on prestige. |
| Upgrades | Per-asset multipliers, pallet click upgrades, and 12 synergy doctrines (for example, aerial refuelling and JADC2). |
| Research | Black Budget R&D: six branches (Stealth, Hypersonics, Autonomy, Nuclear, Space, Spin) of eight projects each. Some projects unlock assets. |
| Contractors | Six fictional firms. Lobbying gives permanent line bonuses, and contracts give temporary boosts with random overruns. |
| Branches and ranks | Branch levels come from branch spending. Twenty-one ranks run from Private to Emperor of the Military-Industrial Complex. |
| Events | Golden lobbyist briefcases, the $10,000 toilet seat, Congressional audits (a receipt-shredding mini-game) and scheduled war games. Overlapping temporary rate buffs stack up to a cap of ×10 per asset. |
| Prestige | New Administration converts lifetime spending into Political Capital: the square of the spending magnitude, (log10(lifetime) − 8)², so each administration is a steady step rather than a runaway. Capital grants a square-root mandate bonus and buys 15 permanent Executive Orders. |
| The President | A pixel caricature on the board with seven animated poses. He publishes posts reacting to deployments, briefcases, audits, promotions and executive orders, and comments when clicked. |
| The Taxpayer | A national debt clock, the bill per taxpayer, a rotating list of what the money could have bought instead, and a taxpayer whose mood declines from Blissfully Unaware to Wearing a Barrel. |
| World operations | A pixel world map with 26 geopolitical operations, from renaming the Gulf and purchasing Greenland to an AUKUS submarine layaway plan, a Peace Prize lobbying campaign, renaming the Moon and planting a flag on Mars. Completed operations repaint territory in stars and stripes and grant bonuses for the administration. |
| Presidential events | Tariff tantrums, 3 a.m. all-caps posts, Super Bowl flyovers and other timed boosts. |
| Districts | Each asset lists the congressional district that builds it. |
| Final level | Big Bang 2: The Sequel opens once a Dyson Sphere is owned. Five phases are each priced in seconds of steady spending and followed by a construction period; the fifth ends the game. |
| Ending | A 33-second pixel-art closing film (the Oval Office at 2:59 a.m., the countdown, the universe spent into a singularity, the Big Bang 2, Universe 2 with no debt, the credits), then the Final Audit Report with playthrough time, grade, statistics and the Hall of Fame. The game cannot be continued; a new universe resets everything except the Hall of Fame. |
| Medals | 113 achievements, each adding +1% morale. Secret medals are included. |
| Audio | Four original tracks (Appropriations March, War Room Briefing, Emergency Supplemental, New Administration Fanfare). Layers are added as spending rises, and around 20 sound effects are synthesised. |

## Pacing

`scripts/balance-sim.ts` plays the whole game headlessly with the real event code (briefcases, audits, war games, contracts, world operations and the finale), using a greedy buyer that starts a New Administration when progress stalls:

```bash
npm run sim -- 4 5 1
```

The arguments are the maximum hours, clicks per second and random seed. `SIM_CATCH` sets the share of briefcases caught and `SIM_OFF=brief,contract` disables those mechanics. Over three seeds, the current curve completes the game in the following times:

| Player profile | Completion time | New Administrations |
| --- | --- | --- |
| Focused (5 clicks/s, 85% of briefcases, all mechanics) | 45 min to 1 h 6 min | 1 to 2 |
| Typical (2 clicks/s, 60% of briefcases, all mechanics) | 1 h 1 min to 1 h 16 min | 2 to 3 |
| Passive (5 clicks/s, no briefcases or contracts) | 1 h 36 min to 1 h 55 min | 3 |

## Development Tools

- `npm test` runs the Vitest suites for number formatting, cost curves, bulk purchases, multipliers, prestige and save migration.
- `npx tsx scripts/render-sprites.ts src/art/sprites/air1.ts out.png 4` renders a sprite module to a PNG contact sheet in all four liveries and validates the pixel maps.

## Project Layout

```
src/core     state, economy, events, save, number formatting, event bus
src/data     assets, upgrades, research, contractors, ranks, orders, medals, headlines, politics
src/art      palette, sprite rasteriser, pixel-grid composer, procedural insignia and ribbons, sprite maps
src/board    animated canvas board and combat effects
src/audio    Web Audio synthesiser, sequencer and tracks
src/ui       DOM panels, store, world map, President, splash, overlays, cinematics, styles
```

Saves are stored in the browser's localStorage and can be exported or imported as a text code from Settings.
