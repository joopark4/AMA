# Motion Pipeline

This repository uses a three-stage motion pipeline:

1. `motions/raw/`
- Original capture/source files (FBX/BVH/GLB).
- Do not edit directly.
- Use `motions/raw/raw-intake-checklist.json` to track licensing/source checks.
- Generate source sidecar metadata with:

```bash
npm run motion:collect:metadata -- --source "<path/to/your/motions/raw>" --checklist "motions/raw/raw-intake-checklist.json"
```

2. `motions/clean/`
- Retargeted and cleaned intermediate outputs.
- Blender cleanup tasks:
  - retarget to VRM humanoid conventions
  - loop boundary alignment
  - foot sliding correction
  - hand jitter smoothing
- Target output FPS: `30`.

3. `public/motions/`
- Runtime-deliverable motion clip JSON files.
- Files referenced by `src/config/motionManifest.json`.

## Import Flow (real data replacement)

1. Put cleaned clip JSON files under `motions/clean/clips/`.
   - Or sync from an external folder:

```bash
MOTION_CLEAN_SOURCE=/absolute/path/to/clean/clips npm run motion:sync:clean
```

   - External sync alias (`MOTION_CLEAN_SOURCE` env required):

```bash
MOTION_CLEAN_SOURCE=/absolute/path/to/clean/clips \
npm run motion:sync:external
```

2. Create `motions/clean/catalog.json` from `motions/clean/catalog.example.json`.
   - Current repository includes a bootstrap `motions/clean/catalog.json` that references
     existing runtime clips under `public/motions/clips/`.
   - For real data replacement, update each `source_file` to your cleaned files
     (for example: `motions/clean/clips/*.json`).
   - Optional: auto-generate a draft catalog from clip files:

```bash
npm run motion:catalog:auto
```

   - Bootstrap from current runtime clips (for reference):

```bash
npm run motion:catalog:bootstrap
```
3. Dry-run validation:

```bash
npm run motion:import:dry
```

4. Import to runtime + update manifest:

```bash
npm run motion:import
```

One-shot refresh from `motions/clean/clips`:

```bash
npm run motion:refresh
```

One-shot refresh from external path (`MOTION_CLEAN_SOURCE` required):

```bash
MOTION_CLEAN_SOURCE=/absolute/path/to/clean/clips \
npm run motion:refresh:external
```

Custom catalog path:

```bash
MOTION_CATALOG=motions/clean/my-catalog.json npm run motion:import
```

## Validation

Run:

```bash
npm run motion:validate
npm run motion:qa:team10
npm run motion:collect:index -- --source "<path/to/your/motions/raw>"
npm run motion:collect:metadata -- --source "<path/to/your/motions/raw>"
```

Validation checks:
- required manifest fields
- license/source metadata presence
- keyframe ranges / finite values
- extreme rotation guard
- loop discontinuity guard
- root jump guard

If validation fails, clips should not be considered release-ready.
