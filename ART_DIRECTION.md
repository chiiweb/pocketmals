# Pocketmals art direction and implementation rules

This is the persistent visual brief for future Pocketmals development. Follow it whenever adding or replacing character, creature, environment, interface, or animation art.

## Non-negotiable style
- Keep the game in a crisp Nintendo DS-era top-down creature-RPG visual language: readable silhouettes, compact chibi characters, clear tile boundaries, limited palettes, and deliberate pixel clusters.
- Human overworld characters should read as chibi at a glance: large heads, compact torsos, short limbs, expressive faces, and a consistent four-direction walk cycle.
- Use nearest-neighbour rendering for pixel art. Disable smoothing on every canvas/image draw path. Avoid blur, softened pixel edges, and mixed pixel scales.
- Keep consistent outlines, light direction, shadows, palettes, and sprite scale across every character and creature.
- Use original Pocketmals artwork and original audio. Do not copy official game sprites, characters, cries, music recordings, or logos.

## The six user-created creature references
The six creature drawings supplied by the project owner in an earlier conversation are the source of truth for those six designs. Preserve their silhouettes, proportions, markings, colours, facial features, and accessories. Do not replace them with invented creatures, generic type-themed mascots, or procedural approximations.

**Asset handoff:** the six original image files are not currently present in this GitHub repository or the accessible project file library. Do not claim their exact designs are implemented until the owner adds them to `assets/reference-creatures/`. Once supplied:
1. Keep each original image unchanged as a reference file.
2. Create matching production sprites using each drawing as the direct visual guide.
3. Make front, back, and overworld views consistent with the same design.
4. Check each sprite at native game size and 2x zoom; fix silhouette readability before tiny details.
5. Never silently rename a creature or alter defining features. Ask the owner when a drawing or name is ambiguous.

Suggested filenames: `creature-01-reference.png` through `creature-06-reference.png`. Add a mapping note with owner-confirmed creature names.

## Pixel dimensions and rendering
- A Nintendo DS screen is 256 × 192 pixels per screen, with a 4:3 aspect ratio.
- Sprite dimensions vary by species and pose; there is no single mandatory Pokémon DS sprite size. For Pocketmals, use a 96 × 96 working canvas for large battle poses where needed, and compact overworld sprites around 16 × 24 or 32 × 32 pixels depending on silhouette.
- UI icons should generally use a consistent 24 × 24 or 32 × 32 pixel grid.
- The current game uses a 320 × 240 virtual drawing coordinate system scaled into the handheld frame. Do not change global canvas dimensions alone: scene coordinates depend on them. A native 256 × 192 migration must update layout and camera math together and be visually regression-tested.
- Keep integer-scale sprite rendering wherever possible. Avoid arbitrary fractional scaling.

## Character direction
- Professor Lotus should be a memorable, kind, capable field researcher, not a generic NPC. Preserve her established silver-streaked bob, round spectacles, ivory research coat, teal details, notebook/field equipment, and calm expression unless the owner supplies a revised reference.
- Tessa, the player, nurses, Gym Leaders, Elite Four members, villagers, and Team Meridian each need a distinct silhouette and palette.
- Give named characters proper down/up/left/right views and at least a two-frame walk cycle. Use idle motion sparingly.
- Do not use one identical generic human sprite for every named character.

## Creature direction
- Each Pocketmal must have its own species-specific silhouette and readable facial expression. Type colour may guide the palette, but must not determine the whole design.
- Battle sprites should be larger and more detailed than overworld followers and menu icons.
- Front and back battle views must be a matched pair, not a mirrored front view.
- Give each species a short, recognisable idle animation and original synthesized cry. Shiny palettes must preserve silhouette and markings.
- Preserve species names, evolutions, dex descriptions, and owner-approved designs.

## Environment and interface
- Use layered, player-centred maps so the player does not see an entire route at once.
- Keep route-entry banners, tile-based grass/trees/water, shadows, collision, and foreground canopy layers aligned to the same tile grid.
- Menus should use readable DS-style pixel typography, consistent selection motion, and clear focus states.
- Keep the lower-screen map and touch controls usable on desktop and mobile.

## Audio
- Keep music original and location-specific, with melody, harmony, bass, arpeggio, percussion, and occasional counter-lines.
- Use phrase variation and transitions rather than a single short loop repeated unchanged.
- Balance walking accents, battle cues, menu sounds, healing jingles, and Pocketmal cries.
- Respect music and sound-effects toggles.

## Male/female sprite variants

- Do not invent male/female visual differences for every species.
- Add separate male and female art only when the owner-approved creature design has a visible distinction that should be represented in the game.
- Keep species silhouette, palette identity, face, markings, and proportions consistent between variants; change only the confirmed distinguishing features.
- Species without a confirmed difference should share the same sprite art. Do not add random bows, lashes, colour swaps, or body-shape changes as shorthand for gender.
- If an original reference image does not clearly establish a variant, ask the owner before designing one.

## Current fallback implementation
The code contains procedural creature drawings and procedural human sprites. They are fallbacks, not substitutes for the six supplied reference designs or finished production sprite sheets. Replace fallback art only after approved source art is available, and keep the game playable if an optional sprite file is missing.
