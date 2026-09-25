# Artwork direction

Use these final requirements when creating or editing artwork. Ordinary exports reuse the saved PNGs. Inspect the closest existing asset and attach it as a visual reference; for edits, preserve everything outside the requested change.

## Character and setting

- Use `capybara-wave.png` for TOCus's identity: orange pear-shaped body, long rounded boxy head, brown muzzle, small round ears, thin plum limbs, and rounded three-toed feet. Keep the handmade clay texture and soft warm lighting.
- TOCus is male, with a friendly neutral expression. Open eyes are simple glossy dark beads; closed eyes are shallow plain curves. No lashes, eyeliner, makeup, or flicked outer corners.
- The muzzle has a tiny Y-shaped nose, a central stem, and two connected upward-curving smile branches. Preserve both branches, including in three-quarter views.
- Match the riverside references: peach sky, gently rippling blue water, sandy shore, and thick rounded green foliage. Keep the tactile 3D clay style; avoid abstract lines, geometric waves, and corporate graphics.

## Screenshot character masters

Create one full-body character on true transparent alpha, generally facing left in three-quarter view. Leave clear margins around ears, hands, props, and feet. Both feet share a believable ground baseline. Do not include scenery, a floor, text, logos, or props beyond those specified below. The compositor adds the ground shadow and mirrors left-side characters.

| File | Required pose |
| --- | --- |
| `capybara-wave.png` | Friendly greeting, raised waving paw, open bead eyes, gentle head tilt. |
| `capybara-thumbs-up.png` | Clear thumbs-up with three curled fingers, other hand on chest, calm closed eye without lashes. |
| `capybara-point.png` | Extended pointing finger, open bead eye, complete two-sided smile. |
| `capybara-agenda.png` | Standing and reading a brown planner with cream pages through small round tortoiseshell glasses. Head and gaze tilt down toward the pages, which face his eyes. No stone, chair, or sitting pose. |
| `capybara-medals.png` | One closed fist raised in celebration, other hand on hip, open bead eyes. Exactly three visible medals: gold, silver, bronze, on blue, burgundy, and cream ribbons. No event logos or writing. |
| `capybara-tango.png` | Black tuxedo, white shirt, bow tie, polished shoes, black fedora with burgundy band. One hand tips the hat; the other extends in welcome. Both ears completely hidden beneath the hat. |

Screenshot placement: thumbs-up right, pointing left, agenda right, medals left, tango right. Characters face the window and sit in the foreground layer so hands may overlap it. Feet rest on the shore; keep the tango shoe clear of the window. The UI frame reaches the canvas bottom without stretching or cropping its content.

## Scenery masters

- `riverside-background.png`: 8:5 landscape, approximately 1600 x 1000. Calm sky above a horizon near 56% height; water below, thin sandy shore, foliage confined to the lower corners. Leave the central 80% clear for the UI and room above for its headline. No character.
- `promo-riverside.png`: 5:2 panorama, approximately 2800 x 1120. Capybara centered low, seated with visible weight on a broad river boulder, holding mate with closed eyes. Bottom and feet visibly supported with contact shadows. River cove, sand, and foliage surround him; keep the top 43% clear sky for logo and text.
- `promo-closeup.png`: 11:7 composition, approximately 1320 x 840. Centered close-up, eyes closed, chin resting on crossed plum forearms supported by a broad river stone. Face occupies the lower half; top 44% stays clear. Match contact shadows at head, arms, and stone, with water and foliage behind.
- `og-background.png`: 1200:628 landscape. Use the saved master directly as the reference: large open-eyed thumbs-up capybara on the right, clear sky and water on the left, foliage along the lower edges. Preserve framing, proportions, and palette when editing.

Scenery masters contain no lettering, logos, UI, or browser icons. Match lighting and perspective across the scene; seated characters must visibly contact their support.

## Text and review

Add text, the dark single-color wordmark, browser icons, and real UI through the compositor. Use Fredoka, with Chiron GoRound TC for Japanese OG headlines and Nunito for Russian OG headlines. Keep copy, sizes, and positions in the generator's catalog and stylesheets.

Compare new assets beside their references and in the final composition. Check face lines, eye shape, fingers, ears, props, grounded feet, transparent edges, and readable text spacing. Preserve the exact existing artwork when only copy or layout changes.
