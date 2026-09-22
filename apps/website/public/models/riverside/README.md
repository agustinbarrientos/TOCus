# Riverside hero asset

`hero.glb` contains the capybara, hand-held mate, nearby vegetation, pebbles and trimmed sand from the **Sunset clearing** scene in `hero-character-side-arm.blend`. The vegetation comes from the supplied `Plants_02_Pack.fbx` and color palette; the mate uses the supplied mate model. Original asset licenses continue to apply.

| Property | Value |
| --- | --- |
| Mesh triangles | 96,155 |
| File size | 2,377,636 bytes, approximately 2.38 MB |
| Gzip estimate | Approximately 1.44 MB; requires server compression |
| Mesh objects | 45 |
| Material draws | 48 before culling and extra render passes |
| Animation | `Mate sip and blink`, 12 seconds, looping |

`hero-metadata.json` records these export measurements. The GLB excludes water, sky, lights and cameras; the website supplies them. Its counts therefore do not represent the complete runtime scene or guarantee a frame rate.

## Loading and animation

Load with Three.js `GLTFLoader` and configure `MeshoptDecoder` for `EXT_meshopt_compression`. The plant palette is embedded, and repeated plants share meshes. Coordinates use Y up: the capybara faces -Z and the camera behind it is on +Z.

Play the `Mate sip and blink` clip with an `AnimationMixer`. It includes drinking, a small head nod and blinking. Fully closed eyes retain a thin, slightly curved dark lid about 0.031 to 0.033 world units high, so the blink stays readable; open-eye geometry and blink timing are unchanged. The mate hand has three fingers curved around the cup and an opposing thumb, with a naturally extended arm attached at the side of the torso and following one continuous soft arc, with no distinct elbow corner or localized bulge. The shoulder root is embedded at the side of the torso at glTF `(0.80, 1.94, -0.02)`, with an outward tangent before the arm curves toward the cup; the cup rests a little higher, and a more upright straw keeps the cup closer during the sip without losing mouth contact. Each foot is lowered to the sloping sand with a smooth blend along the leg; the soles sit approximately 0.004 world units into the bank to avoid floating.

Smooth native deformations are baked into morph targets, while the mate follows baked object transforms. The body retains the Blender B-Bone shapes, and the refined mate arm uses matching pose targets. This is **not an editable skeletal puppet in the browser**. Change poses or create additional actions in the native Blender project, then rebuild the export.

The website adds a visible head-only turn of up to 35 degrees toward the viewer after morph deformation, blending through the neck around the Y-up pivot `(0, 2.5, -0.08)`; the pointer-driven turn remains active independently of the drinking and blink animation.

As the mate rises, a separate overlay turns the cup and gripping hand with the head, blending smoothly into the anchored side shoulder. This keeps the straw aligned during a sip without pausing the mixer, moving the torso, or adding geometry.

## Materials

The export uses lightweight PBR approximations of the native procedural materials. Body vertex colors retain the flush muzzle, the supplied plant palette is embedded, and separate material regions retain the ear bowls and damp sand. Native procedural clay grain, subsurface shading and reflections are not reproduced exactly; lighting and optional surface detail are supplied by the website.

## Rebuilding and verification

The native artifact bundle contains `refine_character_soft_arm.py`, `refine_closed_lids.py`, `refine_side_arm.py`, `export_hero.py`, `verify_export.py`, `render_side_arm.py`, `render_visible_lids.py` and the shared `adjust_eyes.py` helper. The refinement script writes a separate native candidate and preserves the original hero scene. The helper preserves the subtle symmetric forward eye placement in both the native hero and export without accumulating offsets on repeated runs. Use Blender 5.2 or a compatible version with its glTF exporter. Configure the scripts' local source and output paths, then run:

```sh
blender --background hero-scene.blend --python-exit-code 1 --python refine_character_soft_arm.py
blender --background hero-character-soft-arm.blend --python-exit-code 1 --python refine_closed_lids.py
blender --background hero-character-visible-lids.blend --python-exit-code 1 --python refine_side_arm.py
blender --background hero-character-side-arm.blend --python-exit-code 1 --python export_hero.py
blender --background hero-character-side-arm.blend --python-exit-code 1 --python verify_export.py
blender --background hero-character-side-arm.blend --python-exit-code 1 --python render_side_arm.py
blender --background hero-character-side-arm.blend --python-exit-code 1 --python render_visible_lids.py
```

The exporter selects the second scene, `Sunset clearing`, bakes the soft animation, preserves shared plant meshes, batches pebbles by material and writes a meshopt-compressed GLB. Verification reimports the GLB and compares rest, blink, lift, sip, return and loop-boundary poses against the native meshes. This export passed eight sampled frames with a maximum surface-position difference of 0.00253 world units on a character approximately four units tall. Review the rest and sip renders after changes, and refresh the metadata when replacing the asset.
