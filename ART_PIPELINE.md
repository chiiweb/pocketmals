# Pocketmals visual and audio asset pipeline

This document defines the production asset handoff for the game-wide art pass. Keep the current procedural art as a playable fallback; do not mistake it for approved final artwork.

## Human chibi sprites

Place original, owner-approved PNGs in `assets/sprites/humans/`.

Supported filenames for each direction (`down`, `up`, `left`, `right`):

- `player-boy-{direction}.png`
- `player-girl-{direction}.png`
- `professor-{direction}.png`
- `mom-{direction}.png`
- `tessa-{direction}.png`
- `trainer-{direction}.png`
- `gymLeader-{direction}.png`
- `meridian-{direction}.png`
- `nurse-{direction}.png`
- `villager-{direction}.png`
- `robot-{direction}.png`

The renderer accepts either a static 48 x 72 PNG or a 96 x 72 horizontal strip containing two 48 x 72 frames (idle, walk). These are rendered at 16 x 24 logical pixels with smoothing disabled. Keep the same outline weight, light direction, feet baseline, palette discipline, and head/body proportions across the set. Each named character should have a recognisable silhouette and signature clothing/accessory; trainers and gym leaders should not all look like recolours of one another.

The runtime loader is now wired into `drawPerson`. Missing files fall back to the existing procedural character renderer without breaking the game. The current repository does not yet contain these production PNGs, so the loader is an asset-ready path, not a claim that finished character artwork has been added.

## Pocketmal battle and menu sprites

Place original PNG sheets in `assets/sprites/pocketmals/`, using the lowercase species name with spaces/punctuation converted to hyphens:

- `{species}-front.png`
- `{species}-back.png`

A sheet may be a single 48 x 48 pose or an eight-frame 384 x 48 horizontal strip. Frame order is idle A, idle B, anticipation, action, recovery, blink/detail, alternate idle, settle. Front and back are separately authored views; never mirror the front sprite to create the back. The loader is wired into `malSprite`, so battle sprites, party/box icons, summary/Pokédex art, opening shots, and overworld followers all resolve through the same species asset path. Missing sheets retain the procedural renderer.

For production art, give each species an individual silhouette, face, outline, stepped shadow/highlight clusters, and consistent baseline. Back views must show species-specific rear anatomy, not a generic back patch. Add a separate overworld-sized export only when a species needs a distinct simplified pose; otherwise derive the compact icon from its approved front art.

## Animation and QA

- Human characters: four directions, two-frame walk cycle, idle pose, and small role-specific gesture loops where appropriate.
- Pocketmals: front/back battle views, at least two idle frames, and clear anticipation/action/recovery frames.
- Overworld followers and menu/Pokédex icons must use the same approved species design and palette.
- Check every sprite at native size and at 2x nearest-neighbour zoom.
- Verify transparent padding, consistent feet/ground baseline, no clipped pixels, and readable silhouette against both light and dark backgrounds.
- Keep gender variants only where the approved design has an actual visual distinction; never add arbitrary bows, lashes, or palette swaps.

## Opening and audio

The opening now has its own original procedural theme, a longer timeline, camera drift, dissolves between visual beats, and an on-screen skip instruction. Location tracks remain separate from the opening and title themes. Continue composing each track with a clear emotional identity, phrase variation, dynamic density, transitions, quiet bars, and builds rather than relying on one repeated 16-step pattern.

The current cinematic is still drawn procedurally. Its four existing visual beats have been given longer timing and connected with motion/dissolves; a fully bespoke multi-location cutscene with newly drawn character/creature assets still depends on production art being supplied and integrated.

## Known art blockers

- The six original creature reference drawings mentioned by the owner are not present in this repository. Do not invent or overwrite their designs.
- The sprite audit still identifies Brackibud, Puglow, Glacub, Hauntide, Duskrowl, Ferrivine, Drakindle, Dunemole, and Faefern as missing dedicated body/silhouette drawing branches.
- No finished human or Pocketmal PNG production sheets have been committed yet. The runtime now supports them, but they must be created from approved references and reviewed in-game.
