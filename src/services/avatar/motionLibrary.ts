import manifestJson from '../../config/motionManifest.json';
import type {
  MotionClipData,
  MotionClipMeta,
  MotionManifest,
} from '../../types/motion';

const REQUIRED_FIELDS: Array<keyof MotionClipMeta> = [
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
const VALID_EMOTION_TAGS = new Set([
  'neutral',
  'happy',
  'sad',
  'angry',
  'surprised',
  'relaxed',
  'thinking',
  'bridge',
]);

const TAXONOMY_MINIMUMS: Record<string, number> = {
  neutral: 3,
  happy: 3,
  sad: 3,
  angry: 3,
  surprised: 3,
  relaxed: 3,
  thinking: 3,
  bridge: 3,
};

const MIN_TOTAL_CLIPS = 24;

const motionClipCache = new Map<string, Promise<MotionClipData | null>>();

function normalizeManifest(raw: unknown): MotionManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('motionManifest.json must be an object');
  }

  const source = raw as Partial<MotionManifest>;
  const version = typeof source.version === 'number' ? source.version : 1;
  const fps = typeof source.fps === 'number' ? source.fps : 30;
  const clips = Array.isArray(source.clips)
    ? source.clips
    : [];

  return {
    version,
    fps,
    clips: clips as MotionClipMeta[],
  };
}

export function validateMotionManifest(manifest: MotionManifest): string[] {
  const errors: string[] = [];

  if (!Array.isArray(manifest.clips) || manifest.clips.length === 0) {
    errors.push('Manifest must include at least one clip.');
    return errors;
  }

  if (manifest.clips.length < MIN_TOTAL_CLIPS) {
    errors.push(`Manifest must include at least ${MIN_TOTAL_CLIPS} clips. Found ${manifest.clips.length}.`);
  }

  const idSet = new Set<string>();
  const taxonomyCounter: Record<string, number> = {
    neutral: 0,
    happy: 0,
    sad: 0,
    angry: 0,
    surprised: 0,
    relaxed: 0,
    thinking: 0,
    bridge: 0,
  };

  for (const [index, clip] of manifest.clips.entries()) {
    const prefix = `clips[${index}]`;

    for (const field of REQUIRED_FIELDS) {
      const value = clip[field];
      const missingString = typeof value === 'string' && value.trim().length === 0;
      if (value === undefined || value === null || missingString) {
        errors.push(`${prefix}.${field} is required.`);
      }
    }

    if (idSet.has(clip.id)) {
      errors.push(`${prefix}.id is duplicated: ${clip.id}`);
    }
    idSet.add(clip.id);

    if (!Array.isArray(clip.emotion_tags) || clip.emotion_tags.length === 0) {
      errors.push(`${prefix}.emotion_tags must contain at least one tag.`);
    } else {
      for (const tag of clip.emotion_tags) {
        if (!VALID_EMOTION_TAGS.has(tag)) {
          errors.push(`${prefix}.emotion_tags has invalid tag: ${tag}`);
        } else {
          taxonomyCounter[tag] += 1;
        }
      }
    }

    if (!VALID_INTENSITIES.has(clip.intensity)) {
      errors.push(`${prefix}.intensity must be low|mid|high.`);
    }

    if (!Number.isFinite(clip.duration_ms) || clip.duration_ms < 400 || clip.duration_ms > 15000) {
      errors.push(`${prefix}.duration_ms out of supported range: ${clip.duration_ms}`);
    }

    if (!Number.isFinite(clip.priority) || clip.priority < 0 || clip.priority > 10) {
      errors.push(`${prefix}.priority out of supported range: ${clip.priority}`);
    }

    if (!Number.isFinite(clip.cooldown_ms) || clip.cooldown_ms < 0 || clip.cooldown_ms > 30000) {
      errors.push(`${prefix}.cooldown_ms out of supported range: ${clip.cooldown_ms}`);
    }
  }

  for (const [emotion, minimum] of Object.entries(TAXONOMY_MINIMUMS)) {
    if ((taxonomyCounter[emotion] ?? 0) < minimum) {
      errors.push(
        `Taxonomy minimum not met for ${emotion}. Required >= ${minimum}, actual ${taxonomyCounter[emotion] ?? 0}.`
      );
    }
  }

  return errors;
}

function normalizeMotionClipData(
  raw: unknown,
  meta: MotionClipMeta
): MotionClipData | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Partial<MotionClipData>;

  const keyframes = Array.isArray(source.keyframes) ? source.keyframes : [];
  const data: MotionClipData = {
    version: typeof source.version === 'number' ? source.version : 1,
    fps: typeof source.fps === 'number' ? source.fps : 30,
    duration_ms:
      typeof source.duration_ms === 'number' ? source.duration_ms : meta.duration_ms,
    blend_in_ms:
      typeof source.blend_in_ms === 'number' ? source.blend_in_ms : 160,
    blend_out_ms:
      typeof source.blend_out_ms === 'number' ? source.blend_out_ms : 220,
    keyframes: keyframes as MotionClipData['keyframes'],
  };

  const errors = validateMotionClipData(meta, data);
  if (errors.length > 0) {
    console.warn(`[motionLibrary] Invalid clip data for ${meta.id}:`, errors);
    return null;
  }

  return data;
}

export function validateMotionClipData(
  meta: MotionClipMeta,
  data: MotionClipData
): string[] {
  const errors: string[] = [];

  if (!Number.isFinite(data.duration_ms) || data.duration_ms < 400 || data.duration_ms > 15000) {
    errors.push(`duration_ms out of range: ${data.duration_ms}`);
  }

  if (!Array.isArray(data.keyframes) || data.keyframes.length === 0) {
    errors.push('keyframes is empty');
    return errors;
  }

  let maxAbsRotation = 0;

  for (const [index, keyframe] of data.keyframes.entries()) {
    if (!keyframe || typeof keyframe !== 'object') {
      errors.push(`keyframes[${index}] is not an object`);
      continue;
    }

    if (typeof keyframe.bone !== 'string' || keyframe.bone.trim().length === 0) {
      errors.push(`keyframes[${index}].bone is required`);
    }

    if (!Number.isFinite(keyframe.time) || keyframe.time < 0 || keyframe.time > 1) {
      errors.push(`keyframes[${index}].time must be between 0 and 1`);
    }

    const rotation = keyframe.rotation || {};
    for (const axis of ['x', 'y', 'z'] as const) {
      const value = rotation[axis];
      if (value === undefined) continue;
      if (!Number.isFinite(value)) {
        errors.push(`keyframes[${index}].rotation.${axis} is not finite`);
        continue;
      }
      const absValue = Math.abs(value);
      maxAbsRotation = Math.max(maxAbsRotation, absValue);
      if (absValue > Math.PI * 0.98) {
        errors.push(`keyframes[${index}].rotation.${axis} too extreme: ${value}`);
      }
    }
  }

  if (maxAbsRotation > Math.PI * 0.98) {
    errors.push(`clip has extreme rotation beyond safe threshold: ${maxAbsRotation}`);
  }

  if (meta.loopable) {
    const firstByBone = new Map<string, { x: number; y: number; z: number }>();
    const lastByBone = new Map<string, { x: number; y: number; z: number }>();

    for (const keyframe of data.keyframes) {
      const rotation = {
        x: keyframe.rotation.x ?? 0,
        y: keyframe.rotation.y ?? 0,
        z: keyframe.rotation.z ?? 0,
      };
      if (!firstByBone.has(keyframe.bone) || keyframe.time < 0.05) {
        firstByBone.set(keyframe.bone, rotation);
      }
      if (!lastByBone.has(keyframe.bone) || keyframe.time > 0.95) {
        lastByBone.set(keyframe.bone, rotation);
      }
    }

    for (const [bone, first] of firstByBone.entries()) {
      const last = lastByBone.get(bone);
      if (!last) continue;
      const discontinuity =
        Math.abs(last.x - first.x) +
        Math.abs(last.y - first.y) +
        Math.abs(last.z - first.z);
      if (discontinuity > 0.9) {
        errors.push(`loop discontinuity too high for bone ${bone}: ${discontinuity.toFixed(3)}`);
      }
    }
  }

  return errors;
}

const motionManifest = normalizeManifest(manifestJson);
const manifestErrors = validateMotionManifest(motionManifest);
if (manifestErrors.length > 0) {
  console.warn('[motionLibrary] motionManifest validation failed:', manifestErrors);
}

export function getMotionManifest(): MotionClipMeta[] {
  return motionManifest.clips;
}

export function getMotionById(id: string): MotionClipMeta | null {
  return motionManifest.clips.find((clip) => clip.id === id) ?? null;
}

export function resolveMotionFileUrl(file: string): string {
  const trimmed = file.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function clearMotionClipCache(): void {
  motionClipCache.clear();
}

export function loadMotionClipData(meta: MotionClipMeta): Promise<MotionClipData | null> {
  if (motionClipCache.has(meta.id)) {
    return motionClipCache.get(meta.id)!;
  }

  const promise = fetch(resolveMotionFileUrl(meta.file))
    .then(async (response) => {
      if (!response.ok) {
        console.warn(`[motionLibrary] Failed to load clip ${meta.id}: ${response.status}`);
        return null;
      }
      const json = (await response.json()) as unknown;
      return normalizeMotionClipData(json, meta);
    })
    .catch((error) => {
      console.warn(`[motionLibrary] Failed to fetch clip ${meta.id}`, error);
      return null;
    });

  motionClipCache.set(meta.id, promise);
  return promise;
}
