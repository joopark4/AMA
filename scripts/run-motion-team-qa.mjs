import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  computeDiversityMetrics,
  evaluateDiversityMetrics,
} from './lib/motionDiversity.mjs';

const rootDir = process.cwd();
const manifestPath = resolve(rootDir, 'src/config/motionManifest.json');
const reportPath = resolve(rootDir, 'motions/reports/team-qa-latest.json');

const TAXONOMY_TARGETS = {
  neutral: 3,
  happy: 3,
  sad: 3,
  angry: 3,
  surprised: 3,
  thinking: 3,
  relaxed: 3,
  bridge: 3,
};

const MIN_TOTAL_CLIPS = Object.values(TAXONOMY_TARGETS).reduce((sum, value) => sum + value, 0);

const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'thinking', 'relaxed'];
const VALID_INTENSITIES = new Set(['low', 'mid', 'high']);
const VALID_GESTURES = new Set(['wave', 'nod', 'shake', 'shrug', 'thinking', 'celebrate']);
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

function getArgValue(flag, fallback = '') {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) return fallback;
  return value;
}

function getNumericArg(flag, fallback) {
  const raw = getArgValue(flag, `${fallback}`);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function trimIssues(issues, limit = 20) {
  if (issues.length <= limit) return issues;
  return [
    ...issues.slice(0, limit),
    `... ${issues.length - limit} more issue(s) omitted`,
  ];
}

function normalizePublicFile(file) {
  if (typeof file !== 'string') return '';
  const trimmed = file.trim();
  if (!trimmed) return '';
  return trimmed.replace(/^\/+/, '');
}

async function readJson(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

function buildFrameGroups(keyframes) {
  const groups = new Map();
  for (const frame of keyframes) {
    if (!groups.has(frame.bone)) groups.set(frame.bone, []);
    groups.get(frame.bone).push(frame);
  }
  for (const frames of groups.values()) {
    frames.sort((a, b) => a.time - b.time);
  }
  return groups;
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    output: `${result.stdout || ''}${result.stderr || ''}`.trim(),
  };
}

async function removeDotArtifacts(dir) {
  let removed = 0;

  async function walk(currentDir) {
    let entries = [];
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = resolve(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!entry.name.startsWith('._') && entry.name !== '.DS_Store') continue;

      await rm(fullPath, { force: true });
      removed += 1;
    }
  }

  await walk(dir);
  return removed;
}

async function loadContext() {
  const manifest = await readJson(manifestPath);
  const clips = Array.isArray(manifest?.clips) ? manifest.clips : [];
  const records = [];

  for (const clip of clips) {
    const normalizedFile = normalizePublicFile(clip.file);
    const filePath = resolve(rootDir, 'public', normalizedFile);
    let data = null;
    let error = null;

    if (!normalizedFile) {
      error = 'missing file path';
    } else {
      try {
        data = await readJson(filePath);
      } catch (readError) {
        error = readError instanceof Error ? readError.message : String(readError);
      }
    }

    records.push({
      clip,
      filePath,
      data,
      error,
    });
  }

  return { manifest, clips, records };
}

function reviewerTaxonomy(context) {
  const issues = [];
  const counts = {
    neutral: 0,
    happy: 0,
    sad: 0,
    angry: 0,
    surprised: 0,
    thinking: 0,
    relaxed: 0,
    bridge: 0,
  };

  for (const clip of context.clips) {
    for (const tag of clip.emotion_tags || []) {
      if (Object.prototype.hasOwnProperty.call(counts, tag)) {
        counts[tag] += 1;
      }
    }
  }

  if (context.clips.length < MIN_TOTAL_CLIPS) {
    issues.push(`expected at least ${MIN_TOTAL_CLIPS} clips but found ${context.clips.length}`);
  }

  for (const [emotion, minimum] of Object.entries(TAXONOMY_TARGETS)) {
    if ((counts[emotion] ?? 0) < minimum) {
      issues.push(`${emotion} count below minimum (${counts[emotion] ?? 0}/${minimum})`);
    }
  }

  return issues;
}

function reviewerManifestSchema(context) {
  const issues = [];
  const idSet = new Set();

  for (const [index, clip] of context.clips.entries()) {
    const prefix = `clips[${index}]`;

    for (const field of REQUIRED_FIELDS) {
      const value = clip?.[field];
      const isEmptyString = typeof value === 'string' && value.trim().length === 0;
      if (value === undefined || value === null || isEmptyString) {
        issues.push(`${prefix}.${field} is required`);
      }
    }

    if (typeof clip.id === 'string') {
      if (idSet.has(clip.id)) {
        issues.push(`${prefix}.id duplicated (${clip.id})`);
      }
      idSet.add(clip.id);
    }

    if (!Array.isArray(clip.emotion_tags) || clip.emotion_tags.length === 0) {
      issues.push(`${prefix}.emotion_tags must be non-empty`);
    }

    if (!VALID_INTENSITIES.has(clip.intensity)) {
      issues.push(`${prefix}.intensity must be low|mid|high`);
    }

    if (!isFiniteNumber(clip.duration_ms) || clip.duration_ms < 400 || clip.duration_ms > 15000) {
      issues.push(`${prefix}.duration_ms out of range (${clip.duration_ms})`);
    }

    if (!isFiniteNumber(clip.priority) || clip.priority < 0 || clip.priority > 10) {
      issues.push(`${prefix}.priority out of range (${clip.priority})`);
    }

    if (!isFiniteNumber(clip.cooldown_ms) || clip.cooldown_ms < 0 || clip.cooldown_ms > 30000) {
      issues.push(`${prefix}.cooldown_ms out of range (${clip.cooldown_ms})`);
    }
  }

  return issues;
}

function reviewerClipFiles(context) {
  const issues = [];

  for (const record of context.records) {
    if (!record.clip?.file || typeof record.clip.file !== 'string') {
      issues.push(`${record.clip?.id ?? 'unknown'} missing file path`);
      continue;
    }

    if (record.error) {
      issues.push(`${record.clip.id} file load failed (${record.error})`);
    }
  }

  return issues;
}

function reviewerKeyframeTime(context) {
  const issues = [];

  for (const record of context.records) {
    const data = record.data;
    if (!data || !Array.isArray(data.keyframes)) continue;
    if (data.keyframes.length === 0) {
      issues.push(`${record.clip.id} keyframes are empty`);
      continue;
    }

    const grouped = buildFrameGroups(data.keyframes);
    for (const [bone, frames] of grouped.entries()) {
      let previousTime = -Infinity;
      for (const [index, frame] of frames.entries()) {
        if (!isFiniteNumber(frame.time) || frame.time < 0 || frame.time > 1) {
          issues.push(`${record.clip.id} ${bone}[${index}] time invalid (${frame.time})`);
          continue;
        }
        if (frame.time < previousTime) {
          issues.push(`${record.clip.id} ${bone}[${index}] time not monotonic`);
        }
        previousTime = frame.time;
      }
    }
  }

  return issues;
}

function reviewerRotation(context) {
  const issues = [];

  for (const record of context.records) {
    const data = record.data;
    if (!data || !Array.isArray(data.keyframes)) continue;

    for (const [index, frame] of data.keyframes.entries()) {
      for (const axis of ['x', 'y', 'z']) {
        const value = frame?.rotation?.[axis];
        if (value === undefined) continue;
        if (!isFiniteNumber(value)) {
          issues.push(`${record.clip.id} keyframe[${index}] rotation.${axis} not finite`);
          continue;
        }
        if (Math.abs(value) > Math.PI * 0.98) {
          issues.push(`${record.clip.id} keyframe[${index}] rotation.${axis} too extreme (${value})`);
        }
      }
    }
  }

  return issues;
}

function reviewerLoopBoundary(context) {
  const issues = [];

  for (const record of context.records) {
    const { clip, data } = record;
    if (!clip?.loopable || !data || !Array.isArray(data.keyframes)) continue;

    const grouped = buildFrameGroups(data.keyframes);
    for (const [bone, frames] of grouped.entries()) {
      const first = frames[0];
      const last = frames[frames.length - 1];
      if (!first || !last) continue;

      const discontinuity =
        Math.abs((last.rotation?.x ?? 0) - (first.rotation?.x ?? 0)) +
        Math.abs((last.rotation?.y ?? 0) - (first.rotation?.y ?? 0)) +
        Math.abs((last.rotation?.z ?? 0) - (first.rotation?.z ?? 0));

      if (discontinuity > 0.9) {
        issues.push(`${clip.id} loop discontinuity on ${bone} (${discontinuity.toFixed(3)})`);
      }
    }
  }

  return issues;
}

function reviewerRootStability(context) {
  const issues = [];

  for (const record of context.records) {
    const data = record.data;
    if (!data || !Array.isArray(data.keyframes)) continue;

    const hipsFrames = data.keyframes
      .filter((frame) => frame.bone === 'hips')
      .sort((a, b) => a.time - b.time);

    if (hipsFrames.length < 2) continue;

    const first = hipsFrames[0].position ?? { x: 0, y: 0, z: 0 };
    const last = hipsFrames[hipsFrames.length - 1].position ?? { x: 0, y: 0, z: 0 };
    const delta =
      Math.abs((last.x ?? 0) - (first.x ?? 0)) +
      Math.abs((last.y ?? 0) - (first.y ?? 0)) +
      Math.abs((last.z ?? 0) - (first.z ?? 0));

    if (delta > 0.35) {
      issues.push(`${record.clip.id} root jump too high (${delta.toFixed(3)})`);
    }
  }

  return issues;
}

function reviewerPolicy(context) {
  const issues = [];

  const contexts = [
    { speaking: false, moving: false, name: 'idle' },
    { speaking: true, moving: false, name: 'speaking' },
    { speaking: false, moving: true, name: 'moving' },
    { speaking: true, moving: true, name: 'speaking+moving' },
  ];

  const triadGroupKey = (clip, emotion) => {
    const variationTag = typeof clip.variation_tag === 'string' ? clip.variation_tag.trim() : '';
    if (variationTag) return `${emotion}::${variationTag}`;

    const slotGroup = typeof clip.slot_group === 'string' ? clip.slot_group.trim() : '';
    const baseId = String(clip.id || '')
      .replace(/_(low|mid|high)$/i, '')
      .replace(/_[0-9]+$/i, '')
      .trim();
    return `${emotion}::${slotGroup || 'default'}::${baseId || clip.id}`;
  };

  for (const emotion of EMOTIONS) {
    const emotionClips = context.clips.filter((clip) => clip.emotion_tags?.includes(emotion));

    if (emotionClips.length === 0) {
      issues.push(`${emotion}: no emotion-specific clips`);
      continue;
    }

    const lowCount = emotionClips.filter((clip) => clip.intensity === 'low').length;
    const midOrHighCount = emotionClips.filter((clip) => clip.intensity !== 'low').length;

    if ((emotion === 'happy' || emotion === 'angry' || emotion === 'surprised') &&
      midOrHighCount / emotionClips.length < 0.5) {
      issues.push(`${emotion}: mid/high intensity ratio below 50%`);
    }

    const triadGroups = new Map();
    for (const clip of emotionClips) {
      const key = triadGroupKey(clip, emotion);
      const existing = triadGroups.get(key) || [];
      existing.push(clip);
      triadGroups.set(key, existing);
    }

    for (const [group, clips] of triadGroups.entries()) {
      const counts = { low: 0, mid: 0, high: 0 };
      for (const clip of clips) {
        if (clip.intensity === 'low' || clip.intensity === 'mid' || clip.intensity === 'high') {
          counts[clip.intensity] += 1;
        }
      }

      const isTriad = clips.length === 3 && counts.low === 1 && counts.mid === 1 && counts.high === 1;
      if (!isTriad) {
        issues.push(
          `${emotion}: triad mismatch in ${group} (count=${clips.length}, low=${counts.low}, mid=${counts.mid}, high=${counts.high})`
        );
      }
    }

    for (const policy of contexts) {
      const candidates = context.clips.filter((clip) => {
        const emotionMatched =
          clip.emotion_tags?.includes(emotion) || clip.emotion_tags?.includes('bridge');
        if (!emotionMatched) return false;
        if (policy.speaking && !clip.speaking_compatible) return false;
        if (policy.moving && clip.loopable) return false;
        return true;
      });

      if (candidates.length === 0) {
        issues.push(`${emotion}: no candidate for ${policy.name} policy`);
      }
    }
  }

  return issues;
}

function reviewerDiversity(context) {
  const clipRecords = context.records
    .filter((record) => record.clip && record.data)
    .map((record) => ({
      clip: record.clip,
      data: record.data,
    }));

  const metrics = computeDiversityMetrics(clipRecords);
  const issues = evaluateDiversityMetrics(metrics);
  return issues.map((issue) => `diversity gate: ${issue}`);
}

function reviewerLicense(context) {
  const issues = [];

  for (const clip of context.clips) {
    const licenseClass = typeof clip.license_class === 'string' ? clip.license_class.trim() : '';
    const sourceUrl = typeof clip.source_url === 'string' ? clip.source_url.trim() : '';

    if (!licenseClass) {
      issues.push(`${clip.id}: license_class missing`);
    } else if (/amass|non-?commercial/i.test(licenseClass)) {
      issues.push(`${clip.id}: non-commercial license class detected (${licenseClass})`);
    }

    if (!sourceUrl) {
      issues.push(`${clip.id}: source_url missing`);
      continue;
    }

    let parsed;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      issues.push(`${clip.id}: invalid source_url (${sourceUrl})`);
      continue;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      issues.push(`${clip.id}: unsupported source_url protocol (${parsed.protocol})`);
    }
  }

  return issues;
}

function reviewerFallbackGesture(context) {
  const issues = [];

  for (const clip of context.clips) {
    const fallback = typeof clip.fallback_gesture === 'string'
      ? clip.fallback_gesture.trim()
      : '';

    if (!fallback) {
      issues.push(`${clip.id}: fallback_gesture missing`);
      continue;
    }

    if (!VALID_GESTURES.has(fallback)) {
      issues.push(`${clip.id}: fallback_gesture invalid (${fallback})`);
    }
  }

  return issues;
}

function reviewerSelectorRegression() {
  const result = runCommand('npm', [
    'test',
    '--',
    '--run',
    'src/services/avatar/motionSelector.test.ts',
    'src/services/avatar/motionLibrary.test.ts',
  ]);

  if (result.ok) return [];

  const lines = result.output.split('\n').slice(-20).join('\n');
  return [`selector regression tests failed (exit ${result.status})\n${lines}`];
}

const REVIEWERS = [
  { id: 'R1', name: 'Taxonomy', run: reviewerTaxonomy },
  { id: 'R2', name: 'ManifestSchema', run: reviewerManifestSchema },
  { id: 'R3', name: 'ClipFileLink', run: reviewerClipFiles },
  { id: 'R4', name: 'KeyframeTiming', run: reviewerKeyframeTime },
  { id: 'R5', name: 'RotationSanity', run: reviewerRotation },
  { id: 'R6', name: 'LoopContinuity', run: reviewerLoopBoundary },
  { id: 'R7', name: 'RootStability', run: reviewerRootStability },
  { id: 'R8', name: 'EmotionPolicyAndDiversity', run: (context) => [
    ...reviewerPolicy(context),
    ...reviewerDiversity(context),
  ] },
  { id: 'R9', name: 'LicenseGate', run: reviewerLicense },
  { id: 'R10', name: 'FallbackAndSelector', run: async (context) => {
    const fallbackIssues = reviewerFallbackGesture(context);
    const selectorIssues = reviewerSelectorRegression();
    return [...fallbackIssues, ...selectorIssues];
  } },
];

async function runReviewRound(round) {
  const context = await loadContext();
  const reviewerResults = [];

  for (const reviewer of REVIEWERS) {
    const startedAt = Date.now();
    const rawIssues = await reviewer.run(context);
    const issues = trimIssues(rawIssues);

    reviewerResults.push({
      reviewer: reviewer.id,
      name: reviewer.name,
      passed: issues.length === 0,
      issue_count: rawIssues.length,
      issues,
      duration_ms: Date.now() - startedAt,
    });
  }

  const issueCount = reviewerResults.reduce((sum, item) => sum + item.issue_count, 0);
  const passed = issueCount === 0;

  console.log(
    `[motion-team-qa] round ${round}: ${passed ? 'PASS' : 'FAIL'} (${issueCount} issue(s))`
  );

  for (const result of reviewerResults) {
    const state = result.passed ? 'PASS' : 'FAIL';
    console.log(`  - ${result.reviewer} ${result.name}: ${state} (${result.duration_ms}ms)`);
  }

  return {
    round,
    passed,
    issue_count: issueCount,
    reviewer_results: reviewerResults,
  };
}

async function applyAutoCorrection() {
  const removedClean = await removeDotArtifacts(resolve(rootDir, 'motions/clean/clips'));
  const removedPublic = await removeDotArtifacts(resolve(rootDir, 'public/motions'));
  const refresh = runCommand('npm', ['run', 'motion:refresh']);

  return {
    removed_dotfiles: removedClean + removedPublic,
    refresh_ok: refresh.ok,
    refresh_exit_code: refresh.status,
    refresh_tail: refresh.output.split('\n').slice(-20).join('\n'),
  };
}

async function main() {
  const rounds = getNumericArg('--rounds', 10);
  const summaries = [];

  for (let round = 1; round <= rounds; round += 1) {
    const initial = await runReviewRound(round);
    if (initial.passed) {
      summaries.push({ round, corrected: false, initial });
      continue;
    }

    console.log(`[motion-team-qa] round ${round}: applying auto-correction`);
    const correction = await applyAutoCorrection();
    const afterCorrection = await runReviewRound(round);

    summaries.push({
      round,
      corrected: true,
      correction,
      initial,
      after_correction: afterCorrection,
    });

    if (!afterCorrection.passed) {
      break;
    }
  }

  const completedRounds = summaries.length;
  const passedRounds = summaries.filter((round) => {
    if (!round.corrected) return round.initial.passed;
    return round.after_correction?.passed ?? false;
  }).length;
  const success = completedRounds === rounds && passedRounds === rounds;

  const report = {
    generated_at: new Date().toISOString(),
    rounds_requested: rounds,
    rounds_completed: completedRounds,
    rounds_passed: passedRounds,
    reviewers: REVIEWERS.map((reviewer) => `${reviewer.id}-${reviewer.name}`),
    success,
    rounds: summaries,
  };

  await mkdir(resolve(rootDir, 'motions/reports'), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (success) {
    console.log(`[motion-team-qa] PASS ${passedRounds}/${rounds} rounds`);
    console.log(`[motion-team-qa] report: ${reportPath}`);
    return;
  }

  console.error(`[motion-team-qa] FAIL ${passedRounds}/${rounds} rounds`);
  console.error(`[motion-team-qa] report: ${reportPath}`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[motion-team-qa] Failed: ${error.message}`);
  process.exitCode = 1;
});
