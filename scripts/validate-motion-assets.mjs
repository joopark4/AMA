import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeDiversityMetrics,
  evaluateDiversityMetrics,
} from './lib/motionDiversity.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');

const manifestPath = resolve(rootDir, 'src/config/motionManifest.json');
const MIN_TOTAL_CLIPS = 24;

const REQUIRED_FIELDS = [
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
];

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function readJson(path) {
  return readFile(path, 'utf8').then((raw) => JSON.parse(raw));
}

function fail(errors) {
  for (const error of errors) {
    console.error(`[motion-validate] ${error}`);
  }
  process.exitCode = 1;
}

function checkLoopContinuity(meta, clipData) {
  if (!meta.loopable) return [];

  const errors = [];
  const grouped = new Map();

  for (const frame of clipData.keyframes ?? []) {
    if (!grouped.has(frame.bone)) {
      grouped.set(frame.bone, []);
    }
    grouped.get(frame.bone).push(frame);
  }

  for (const [bone, frames] of grouped.entries()) {
    const sorted = [...frames].sort((a, b) => a.time - b.time);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) continue;

    const discontinuity =
      Math.abs((last.rotation?.x ?? 0) - (first.rotation?.x ?? 0)) +
      Math.abs((last.rotation?.y ?? 0) - (first.rotation?.y ?? 0)) +
      Math.abs((last.rotation?.z ?? 0) - (first.rotation?.z ?? 0));

    if (discontinuity > 0.9) {
      errors.push(`${meta.id}: loop discontinuity too high on ${bone} (${discontinuity.toFixed(3)})`);
    }
  }

  return errors;
}

function checkRootJump(meta, clipData) {
  const hipsFrames = (clipData.keyframes ?? []).filter((frame) => frame.bone === 'hips');
  if (hipsFrames.length < 2) return [];

  const sorted = [...hipsFrames].sort((a, b) => a.time - b.time);
  const first = sorted[0].position ?? { x: 0, y: 0, z: 0 };
  const last = sorted[sorted.length - 1].position ?? { x: 0, y: 0, z: 0 };
  const delta =
    Math.abs((last.x ?? 0) - (first.x ?? 0)) +
    Math.abs((last.y ?? 0) - (first.y ?? 0)) +
    Math.abs((last.z ?? 0) - (first.z ?? 0));

  if (delta > 0.35) {
    return [`${meta.id}: root jump too high (${delta.toFixed(3)})`];
  }

  return [];
}

async function main() {
  const manifest = await readJson(manifestPath);
  const clips = Array.isArray(manifest?.clips) ? manifest.clips : [];
  const errors = [];
  const clipRecords = [];

  if (clips.length < MIN_TOTAL_CLIPS) {
    errors.push(`Expected at least ${MIN_TOTAL_CLIPS} clips but got ${clips.length}.`);
  }

  for (const [index, clip] of clips.entries()) {
    for (const field of REQUIRED_FIELDS) {
      const value = clip?.[field];
      if (value === undefined || value === null || value === '') {
        errors.push(`clips[${index}].${field} is required.`);
      }
    }

    if (!isFiniteNumber(clip?.duration_ms) || clip.duration_ms < 400 || clip.duration_ms > 15000) {
      errors.push(`${clip?.id ?? `clips[${index}]`}: duration_ms out of range.`);
    }

    const clipPath = resolve(rootDir, 'public', clip.file || '');

    let clipData;
    try {
      clipData = await readJson(clipPath);
    } catch (error) {
      errors.push(`${clip?.id ?? `clips[${index}]`}: failed to read clip file ${clip.file}`);
      continue;
    }

    const frames = Array.isArray(clipData?.keyframes) ? clipData.keyframes : [];
    if (frames.length === 0) {
      errors.push(`${clip.id}: keyframes are empty.`);
      continue;
    }

    for (const [frameIndex, frame] of frames.entries()) {
      if (!isFiniteNumber(frame?.time) || frame.time < 0 || frame.time > 1) {
        errors.push(`${clip.id}: keyframe[${frameIndex}] has invalid time.`);
      }

      for (const axis of ['x', 'y', 'z']) {
        const value = frame?.rotation?.[axis];
        if (value === undefined) continue;
        if (!isFiniteNumber(value)) {
          errors.push(`${clip.id}: keyframe[${frameIndex}] rotation.${axis} is NaN/inf.`);
          continue;
        }
        if (Math.abs(value) > Math.PI * 0.98) {
          errors.push(`${clip.id}: keyframe[${frameIndex}] rotation.${axis} too extreme (${value}).`);
        }
      }
    }

    errors.push(...checkLoopContinuity(clip, clipData));
    errors.push(...checkRootJump(clip, clipData));
    clipRecords.push({ clip, data: clipData });
  }

  const diversityMetrics = computeDiversityMetrics(clipRecords);
  const diversityIssues = evaluateDiversityMetrics(diversityMetrics);
  errors.push(...diversityIssues.map((issue) => `diversity gate: ${issue}`));

  if (errors.length > 0) {
    fail(errors);
    return;
  }

  console.log(`[motion-validate] OK (${clips.length} clips)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
