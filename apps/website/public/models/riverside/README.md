# Riverside hero asset

`hero.glb` contains the capybara, hand-held mate, nearby vegetation, pebbles and trimmed sand from the **Sunset clearing** scene in `capybara-two-scenes.blend`. The vegetation comes from the supplied `Plants_02_Pack.fbx` and color palette; the mate uses the supplied mate model. Original asset licenses continue to apply.

| Property | Value |
| --- | --- |
| Mesh triangles | 96,637 |
| File size | 2,461,996 bytes, approximately 2.46 MB |
| Gzip estimate | Approximately 1.54 MB; requires server compression |
| Mesh objects | 45 |
| Material draws | 48 before culling and extra render passes |
| Animation | `Mate sip and blink`, 12 seconds, looping |

`hero-metadata.json` records these export measurements. The GLB excludes water, sky, lights and cameras; the website supplies them. Its counts therefore do not represent the complete runtime scene or guarantee a frame rate.

## Loading and animation

Load with Three.js `GLTFLoader` and configure `MeshoptDecoder` for `EXT_meshopt_compression`. The plant palette is embedded, and repeated plants share meshes. Coordinates use Y up: the capybara faces -Z and the camera behind it is on +Z.

Play the `Mate sip and blink` clip with an `AnimationMixer`. It includes drinking, a small head nod and blinking. Smooth native deformations are baked into morph targets, while the mate follows baked object transforms. This preserves the Blender B-Bone shapes but is **not an editable skeletal puppet in the browser**. Change poses or create additional actions in the native Blender project, then rebuild the export.

## Materials

The export uses lightweight PBR approximations of the native procedural materials. Body vertex colors retain the flush muzzle, the supplied plant palette is embedded, and separate material regions retain the ear bowls and damp sand. Native procedural clay grain, subsurface shading and reflections are not reproduced exactly; lighting and optional surface detail are supplied by the website.

## Rebuilding and verification

The native artifact bundle contains `export_hero.py`, `verify_export.py`, `render_export.py` and the shared `adjust_eyes.py` helper. The helper preserves the subtle symmetric forward eye placement in both the native hero and export without accumulating offsets on repeated runs. Use Blender 5.2 or a compatible version with its glTF exporter. Configure the scripts' local source and output paths, then run:

```sh
blender --background capybara-two-scenes.blend --python-exit-code 1 --python export_hero.py
blender --background capybara-two-scenes.blend --python-exit-code 1 --python verify_export.py
blender --background capybara-two-scenes.blend --python-exit-code 1 --python render_export.py
```

The exporter selects the second scene, `Sunset clearing`, bakes the soft animation, preserves shared plant meshes, batches pebbles by material and writes a meshopt-compressed GLB. Verification reimports the GLB and compares rest, blink, lift, sip, return and loop-boundary poses against the native meshes. This export passed eight sampled frames with a maximum surface-position difference of 0.00257 world units on a character approximately four units tall. Review the rest and sip renders after changes, and refresh the metadata when replacing the asset.
