import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

const rootDir = process.cwd();

const EMOTION_ORDER = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'surprised',
  'thinking',
  'relaxed',
  'bridge',
];

const LOOPABLE_EMOTIONS = new Set(['neutral', 'sad', 'thinking', 'relaxed']);

const PRIORITY_BY_EMOTION = {
  neutral: 2,
  happy: 4,
  sad: 3,
  angry: 4,
  surprised: 4,
  thinking: 3,
  relaxed: 2,
  bridge: 1,
};

const FALLBACK_GESTURE_BY_EMOTION = {
  neutral: 'nod',
  happy: 'celebrate',
  sad: 'thinking',
  angry: 'shake',
  surprised: 'nod',
  thinking: 'thinking',
  relaxed: 'nod',
  bridge: 'shrug',
};

const INTENSITY_PATTERNS = {
  neutral: ['low', 'mid', 'low', 'mid', 'low', 'mid', 'high', 'low'],
  happy: ['mid', 'high', 'mid', 'high', 'low', 'mid', 'high', 'mid', 'low', 'high'],
  sad: ['low', 'low', 'mid', 'low', 'mid', 'low', 'mid', 'high'],
  angry: ['mid', 'high', 'mid', 'high', 'low', 'high', 'mid', 'high'],
  surprised: ['mid', 'high', 'mid', 'high', 'low', 'mid', 'high', 'mid'],
  thinking: ['low', 'low', 'mid', 'low', 'mid', 'low', 'mid', 'low'],
  relaxed: ['low', 'mid', 'low', 'mid', 'low', 'mid', 'low', 'high'],
  bridge: ['low', 'mid', 'low', 'mid', 'high', 'mid'],
};

const SOURCE_BY_EMOTION = {
  neutral: 'https://www.mixamo.com',
  happy: 'https://www.mixamo.com',
  sad: 'https://www.rokoko.com/products/vision',
  angry: 'https://www.mixamo.com',
  surprised: 'https://www.mixamo.com',
  thinking: 'https://www.rokoko.com/products/vision',
  relaxed: 'https://www.mixamo.com',
  bridge: 'https://www.mixamo.com',
};

const LICENSE_BY_EMOTION = {
  neutral: 'mixamo-standard',
  happy: 'mixamo-standard',
  sad: 'rokoko-user-generated',
  angry: 'mixamo-standard',
  surprised: 'mixamo-standard',
  thinking: 'rokoko-user-generated',
  relaxed: 'mixamo-standard',
  bridge: 'mixamo-standard',
};

const DEFAULT_REDISTRIBUTION_NOTE =
  'Verify upstream asset terms before redistributing generated deliverables.';

const REDISTRIBUTION_NOTE_BY_LICENSE = {
  'rokoko-user-generated':
    'Captured from user-owned performance. Verify downstream rights before redistribution.',
};

function getArgValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const nextValue = process.argv[index + 1];
  if (!nextValue || nextValue.startsWith('--')) return fallback;
  return nextValue;
}

function toAbsolutePath(pathValue) {
  if (pathValue.startsWith('/')) return pathValue;
  return resolve(rootDir, pathValue);
}

function toPosixPath(pathValue) {
  return pathValue.replace(/\\/g, '/');
}

function parseJson(raw, context) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON (${context}): ${error.message}`);
  }
}

async function collectJsonFiles(dir) {
  const files = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.json')) continue;
      files.push(fullPath);
    }
  }

  await walk(dir);
  return files;
}

function inferEmotion(id) {
  const match = id.match(/(?:^|_)((?:neutral|happy|sad|angry|surprised|thinking|relaxed|bridge))(?:_|$)/i);
  return match ? match[1].toLowerCase() : 'bridge';
}

function inferNumericSuffix(id) {
  const match = id.match(/_(\d+)$/);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

function inferIntensity(id, emotion) {
  if (/_low(?:_|$)/i.test(id)) return 'low';
  if (/_mid(?:_|$)/i.test(id)) return 'mid';
  if (/_high(?:_|$)/i.test(id)) return 'high';

  const pattern = INTENSITY_PATTERNS[emotion] || INTENSITY_PATTERNS.bridge;
  const suffix = inferNumericSuffix(id);
  if (!suffix || suffix <= 0) return 'mid';
  return pattern[(suffix - 1) % pattern.length] || 'mid';
}

function inferCooldownMs(id) {
  const suffix = inferNumericSuffix(id) || 1;
  return 1200 + ((suffix - 1) % 4) * 450;
}

function inferLoopable(emotion, intensity) {
  if (!LOOPABLE_EMOTIONS.has(emotion)) return false;
  return intensity !== 'high';
}

function inferSpeakingCompatible(loopable, intensity) {
  if (intensity === 'high') return false;
  if (loopable) return intensity !== 'high';
  return true;
}

function compareClipIds(a, b) {
  const emotionA = inferEmotion(a);
  const emotionB = inferEmotion(b);

  const rankA = EMOTION_ORDER.indexOf(emotionA);
  const rankB = EMOTION_ORDER.indexOf(emotionB);

  if (rankA !== rankB) return rankA - rankB;

  const suffixA = inferNumericSuffix(a) || 0;
  const suffixB = inferNumericSuffix(b) || 0;
  if (suffixA !== suffixB) return suffixA - suffixB;

  return a.localeCompare(b);
}

function createDefaultMeta(id) {
  const emotion = inferEmotion(id);
  const intensity = inferIntensity(id, emotion);
  const loopable = inferLoopable(emotion, intensity);
  const licenseClass = LICENSE_BY_EMOTION[emotion] ?? 'mixamo-standard';

  return {
    emotion_tags: [emotion],
    intensity,
    loopable,
    speaking_compatible: inferSpeakingCompatible(loopable, intensity),
    priority: PRIORITY_BY_EMOTION[emotion] ?? 2,
    cooldown_ms: inferCooldownMs(id),
    source_url: SOURCE_BY_EMOTION[emotion] ?? 'https://www.mixamo.com',
    license_class: licenseClass,
    attribution_required: false,
    redistribution_note: REDISTRIBUTION_NOTE_BY_LICENSE[licenseClass] ?? DEFAULT_REDISTRIBUTION_NOTE,
    fallback_gesture: FALLBACK_GESTURE_BY_EMOTION[emotion] ?? 'shrug',
  };
}

function normalizeDuration(clipData, fallbackMs = 1500) {
  if (typeof clipData?.duration_ms === 'number' && Number.isFinite(clipData.duration_ms)) {
    return clipData.duration_ms;
  }

  const frames = Array.isArray(clipData?.keyframes) ? clipData.keyframes : [];
  if (frames.length === 0) return fallbackMs;

  const maxTime = frames.reduce((max, frame) => {
    const t = typeof frame?.time === 'number' && Number.isFinite(frame.time) ? frame.time : 0;
    return Math.max(max, t);
  }, 0);

  return Math.max(500, Math.round(maxTime * 1000));
}

async function readBaseCatalog(baseCatalogPath) {
  if (!baseCatalogPath) return new Map();

  const raw = await readFile(baseCatalogPath, 'utf8');
  const parsed = parseJson(raw, 'base catalog');
  const clips = Array.isArray(parsed?.clips) ? parsed.clips : [];

  const map = new Map();
  for (const clip of clips) {
    if (!clip || typeof clip !== 'object') continue;
    if (typeof clip.id !== 'string') continue;
    map.set(clip.id, clip);
  }
  return map;
}

async function main() {
  const clipsDir = toAbsolutePath(getArgValue('--clips-dir', 'motions/clean/clips'));
  const outputPath = toAbsolutePath(getArgValue('--output', 'motions/clean/catalog.generated.json'));
  const baseCatalogPathArg = getArgValue('--base-catalog', 'motions/clean/catalog.json');
  const baseCatalogPath = baseCatalogPathArg ? toAbsolutePath(baseCatalogPathArg) : '';
  const fps = Number.parseInt(getArgValue('--fps', '30'), 10) || 30;

  const files = await collectJsonFiles(clipsDir);
  if (files.length === 0) {
    throw new Error(`No clip JSON files found in ${clipsDir}`);
  }

  const baseById = await readBaseCatalog(baseCatalogPath);

  const entries = [];

  for (const filePath of files) {
    const relativePath = toPosixPath(relative(rootDir, filePath));
    const id = toPosixPath(relativePath).split('/').pop().replace(/\.json$/i, '');
    const clipRaw = await readFile(filePath, 'utf8');
    const clipData = parseJson(clipRaw, `clip (${id})`);

    const defaults = createDefaultMeta(id);
    const base = baseById.get(id) || {};

    const merged = {
      id,
      source_file: relativePath,
      emotion_tags: Array.isArray(base.emotion_tags) && base.emotion_tags.length > 0
        ? base.emotion_tags
        : defaults.emotion_tags,
      intensity: typeof base.intensity === 'string' ? base.intensity : defaults.intensity,
      duration_ms: typeof base.duration_ms === 'number' && Number.isFinite(base.duration_ms)
        ? base.duration_ms
        : normalizeDuration(clipData),
      loopable: typeof base.loopable === 'boolean' ? base.loopable : defaults.loopable,
      speaking_compatible: typeof base.speaking_compatible === 'boolean'
        ? base.speaking_compatible
        : defaults.speaking_compatible,
      priority: typeof base.priority === 'number' && Number.isFinite(base.priority)
        ? base.priority
        : defaults.priority,
      cooldown_ms: typeof base.cooldown_ms === 'number' && Number.isFinite(base.cooldown_ms)
        ? base.cooldown_ms
        : defaults.cooldown_ms,
      source_url: typeof base.source_url === 'string' && base.source_url.trim().length > 0
        ? base.source_url.trim()
        : defaults.source_url,
      license_class: typeof base.license_class === 'string' && base.license_class.trim().length > 0
        ? base.license_class.trim()
        : defaults.license_class,
      attribution_required: typeof base.attribution_required === 'boolean'
        ? base.attribution_required
        : defaults.attribution_required,
      redistribution_note:
        typeof base.redistribution_note === 'string' && base.redistribution_note.trim().length > 0
          ? base.redistribution_note.trim()
          : defaults.redistribution_note,
      fallback_gesture: typeof base.fallback_gesture === 'string' && base.fallback_gesture.trim().length > 0
        ? base.fallback_gesture.trim()
        : defaults.fallback_gesture,
      ...(typeof base.variation_tag === 'string' && base.variation_tag.trim().length > 0
        ? { variation_tag: base.variation_tag.trim() }
        : {}),
      ...(typeof base.slot_group === 'string' && base.slot_group.trim().length > 0
        ? { slot_group: base.slot_group.trim() }
        : {}),
      ...(typeof base.body_zone === 'string' && base.body_zone.trim().length > 0
        ? { body_zone: base.body_zone.trim() }
        : {}),
    };

    entries.push(merged);
  }

  entries.sort((a, b) => compareClipIds(a.id, b.id));

  const catalog = {
    version: 1,
    fps,
    default_source_url: 'https://www.mixamo.com',
    default_license_class: 'mixamo-standard',
    default_attribution_required: false,
    default_redistribution_note:
      DEFAULT_REDISTRIBUTION_NOTE,
    clips: entries,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

  console.log(`[motion-catalog] Generated ${entries.length} entries`);
  console.log(`[motion-catalog] clips dir: ${clipsDir}`);
  console.log(`[motion-catalog] output: ${outputPath}`);
  if (baseCatalogPath) {
    console.log(`[motion-catalog] base metadata: ${baseCatalogPath}`);
  }
}

main().catch((error) => {
  console.error(`[motion-catalog] Failed: ${error.message}`);
  process.exit(1);
});
