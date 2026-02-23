import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname } from 'node:path';

const rootDir = process.cwd();

const REQUIRED_MANIFEST_FIELDS = [
  'id',
  'emotion_tags',
  'intensity',
  'duration_ms',
  'loopable',
  'speaking_compatible',
  'priority',
  'cooldown_ms',
  'file',
  'license_class',
  'source_url',
  'attribution_required',
  'redistribution_note',
];

const VALID_INTENSITIES = new Set(['low', 'mid', 'high']);

function getArgValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) return fallback;
  return value;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function toAbsolutePath(pathValue) {
  if (!pathValue) return '';
  if (pathValue.startsWith('/')) return pathValue;
  return resolve(rootDir, pathValue);
}

async function ensureExists(path, description) {
  try {
    await access(path, constants.F_OK);
  } catch {
    throw new Error(`${description} not found: ${path}`);
  }
}

async function readJson(path, description) {
  await ensureExists(path, description);
  const raw = await readFile(path, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON (${description}): ${path} (${error.message})`);
  }
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateClipDataShape(clipData, context) {
  if (!clipData || typeof clipData !== 'object') {
    throw new Error(`${context}: clip data must be an object`);
  }

  const frames = Array.isArray(clipData.keyframes) ? clipData.keyframes : [];
  if (frames.length === 0) {
    throw new Error(`${context}: keyframes is empty`);
  }

  if (!isFiniteNumber(clipData.duration_ms) || clipData.duration_ms <= 0) {
    throw new Error(`${context}: duration_ms must be a positive number`);
  }

  for (const [index, frame] of frames.entries()) {
    if (!frame || typeof frame !== 'object') {
      throw new Error(`${context}: keyframes[${index}] is not an object`);
    }
    if (typeof frame.bone !== 'string' || frame.bone.trim() === '') {
      throw new Error(`${context}: keyframes[${index}].bone is required`);
    }
    if (!isFiniteNumber(frame.time) || frame.time < 0 || frame.time > 1) {
      throw new Error(`${context}: keyframes[${index}].time must be 0..1`);
    }
  }
}

function toManifestEntry(catalogClip, clipData, defaults) {
  const id = String(catalogClip.id || '').trim();
  if (!id) {
    throw new Error('catalog clip id is required');
  }

  const intensity = String(catalogClip.intensity || '').trim();
  if (!VALID_INTENSITIES.has(intensity)) {
    throw new Error(`${id}: intensity must be low|mid|high`);
  }

  const emotionTags = Array.isArray(catalogClip.emotion_tags)
    ? catalogClip.emotion_tags.map((value) => String(value).trim()).filter(Boolean)
    : [];
  if (emotionTags.length === 0) {
    throw new Error(`${id}: emotion_tags is required`);
  }

  const duration = isFiniteNumber(catalogClip.duration_ms)
    ? catalogClip.duration_ms
    : clipData.duration_ms;

  const manifestEntry = {
    id,
    emotion_tags: emotionTags,
    intensity,
    duration_ms: duration,
    loopable: Boolean(catalogClip.loopable),
    speaking_compatible: Boolean(catalogClip.speaking_compatible),
    priority: Number(catalogClip.priority),
    cooldown_ms: Number(catalogClip.cooldown_ms),
    file: `motions/clips/${id}.json`,
    license_class: String(catalogClip.license_class || defaults.license_class || '').trim(),
    source_url: String(catalogClip.source_url || defaults.source_url || '').trim(),
    attribution_required:
      catalogClip.attribution_required ?? defaults.attribution_required ?? false,
    redistribution_note: String(
      catalogClip.redistribution_note ||
      defaults.redistribution_note ||
      ''
    ).trim(),
  };

  if (catalogClip.fallback_gesture) {
    manifestEntry.fallback_gesture = String(catalogClip.fallback_gesture).trim();
  }

  const variationTag = String(catalogClip.variation_tag || '').trim();
  if (variationTag) {
    manifestEntry.variation_tag = variationTag;
  }

  const slotGroup = String(catalogClip.slot_group || '').trim();
  if (slotGroup) {
    manifestEntry.slot_group = slotGroup;
  }

  const bodyZone = String(catalogClip.body_zone || '').trim();
  if (bodyZone) {
    manifestEntry.body_zone = bodyZone;
  }

  for (const field of REQUIRED_MANIFEST_FIELDS) {
    const value = manifestEntry[field];
    const isMissingString = typeof value === 'string' && value.trim() === '';
    if (value === undefined || value === null || isMissingString) {
      throw new Error(`${id}: missing required manifest field (${field})`);
    }
  }

  if (!isFiniteNumber(manifestEntry.priority)) {
    throw new Error(`${id}: priority must be a number`);
  }
  if (!isFiniteNumber(manifestEntry.cooldown_ms)) {
    throw new Error(`${id}: cooldown_ms must be a number`);
  }
  if (!isFiniteNumber(manifestEntry.duration_ms)) {
    throw new Error(`${id}: duration_ms must be a number`);
  }

  return manifestEntry;
}

async function main() {
  const catalogPathArg = getArgValue(
    '--catalog',
    process.env.MOTION_CATALOG?.trim() || 'motions/clean/catalog.json'
  );
  const catalogPath = toAbsolutePath(catalogPathArg);
  const dryRun = hasFlag('--dry-run');

  const catalog = await readJson(catalogPath, 'motion catalog');

  if (!catalog || typeof catalog !== 'object') {
    throw new Error('catalog must be an object');
  }

  const version = isFiniteNumber(catalog.version) ? catalog.version : 1;
  const fps = isFiniteNumber(catalog.fps) ? catalog.fps : 30;

  const clips = Array.isArray(catalog.clips) ? catalog.clips : [];
  if (clips.length === 0) {
    throw new Error('catalog.clips is empty');
  }

  const defaults = {
    source_url: catalog.default_source_url,
    license_class: catalog.default_license_class,
    attribution_required: catalog.default_attribution_required,
    redistribution_note: catalog.default_redistribution_note,
  };

  const manifestEntries = [];
  const idSet = new Set();

  for (const [index, clip] of clips.entries()) {
    const clipId = String(clip?.id || '').trim() || `clips[${index}]`;
    const sourceFile = String(clip?.source_file || '').trim();

    if (!sourceFile) {
      throw new Error(`${clipId}: source_file is required`);
    }

    const sourcePath = toAbsolutePath(sourceFile);
    const clipData = await readJson(sourcePath, `clip source (${clipId})`);
    validateClipDataShape(clipData, clipId);

    const manifestEntry = toManifestEntry(clip, clipData, defaults);

    if (idSet.has(manifestEntry.id)) {
      throw new Error(`duplicate clip id: ${manifestEntry.id}`);
    }
    idSet.add(manifestEntry.id);

    const outputClipPath = resolve(rootDir, 'public', manifestEntry.file);

    if (!dryRun) {
      await mkdir(dirname(outputClipPath), { recursive: true });
      await writeFile(outputClipPath, `${JSON.stringify(clipData, null, 2)}\n`, 'utf8');
    }

    manifestEntries.push(manifestEntry);
  }

  const manifest = {
    version,
    fps,
    clips: manifestEntries,
  };

  const manifestPath = resolve(rootDir, 'src/config/motionManifest.json');
  if (!dryRun) {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  const action = dryRun ? 'Dry run validated' : 'Imported';
  console.log(`[motion-import] ${action} ${manifestEntries.length} clips from ${catalogPath}`);
}

main().catch((error) => {
  console.error(`[motion-import] Failed: ${error.message}`);
  process.exit(1);
});
