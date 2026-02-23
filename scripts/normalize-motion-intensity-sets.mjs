import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = process.cwd();
const TARGET_INTENSITIES = ['low', 'mid', 'high'];
const INTENSITY_RANK = {
  low: 0,
  mid: 1,
  high: 2,
};

function getArgValue(flag, fallback = '') {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) return fallback;
  return value;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function toAbsolute(pathValue) {
  if (!pathValue) return '';
  if (pathValue.startsWith('/')) return pathValue;
  return resolve(rootDir, pathValue);
}

function parseJson(raw, context) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON (${context}): ${error.message}`);
  }
}

function intensityRank(value) {
  return INTENSITY_RANK[value] ?? 1;
}

function getPrimaryEmotion(clip) {
  if (!Array.isArray(clip.emotion_tags) || clip.emotion_tags.length === 0) {
    return 'unknown';
  }
  const first = clip.emotion_tags.find((tag) => typeof tag === 'string' && tag.trim());
  return first ? first.trim() : 'unknown';
}

function inferFallbackMotionKey(clip) {
  const id = String(clip.id || '').trim();
  if (!id) return 'unknown';
  return id
    .replace(/_(low|mid|high)$/i, '')
    .replace(/_[0-9]+$/i, '')
    .trim() || id;
}

function buildGroupKey(clip) {
  const emotion = getPrimaryEmotion(clip);
  const variationTag = String(clip.variation_tag || '').trim();
  if (variationTag) {
    return `${emotion}::${variationTag}`;
  }

  const slotGroup = String(clip.slot_group || '').trim();
  const fallbackKey = inferFallbackMotionKey(clip);
  return `${emotion}::${slotGroup || 'default'}::${fallbackKey}`;
}

function byQuality(a, b) {
  const priorityDiff = (Number(b.clip.priority) || 0) - (Number(a.clip.priority) || 0);
  if (priorityDiff !== 0) return priorityDiff;

  const speakingDiff = Number(Boolean(b.clip.speaking_compatible)) - Number(Boolean(a.clip.speaking_compatible));
  if (speakingDiff !== 0) return speakingDiff;

  const loopDiff = Number(Boolean(b.clip.loopable)) - Number(Boolean(a.clip.loopable));
  if (loopDiff !== 0) return loopDiff;

  const durationDiff = (Number(b.clip.duration_ms) || 0) - (Number(a.clip.duration_ms) || 0);
  if (durationDiff !== 0) return durationDiff;

  return String(a.clip.id || '').localeCompare(String(b.clip.id || ''));
}

function byDistanceToTarget(targetIntensity) {
  const targetRank = intensityRank(targetIntensity);
  return (a, b) => {
    const distA = Math.abs(intensityRank(a.clip.intensity) - targetRank);
    const distB = Math.abs(intensityRank(b.clip.intensity) - targetRank);
    if (distA !== distB) return distA - distB;
    return byQuality(a, b);
  };
}

function normalizeGroup(groupKey, items) {
  const working = [...items];
  const selected = [];
  const used = new Set();
  const relabeled = [];
  const dropped = [];

  for (const targetIntensity of TARGET_INTENSITIES) {
    const candidates = working
      .filter((item) => !used.has(item) && item.clip.intensity === targetIntensity)
      .sort(byQuality);
    if (candidates.length === 0) continue;
    const chosen = candidates[0];
    used.add(chosen);
    selected.push({
      ...chosen,
      normalized_intensity: targetIntensity,
    });
  }

  for (const targetIntensity of TARGET_INTENSITIES) {
    if (selected.some((item) => item.normalized_intensity === targetIntensity)) {
      continue;
    }

    const leftovers = working
      .filter((item) => !used.has(item))
      .sort(byDistanceToTarget(targetIntensity));
    if (leftovers.length === 0) continue;

    const chosen = leftovers[0];
    used.add(chosen);
    selected.push({
      ...chosen,
      normalized_intensity: targetIntensity,
    });

    if (chosen.clip.intensity !== targetIntensity) {
      relabeled.push({
        id: chosen.clip.id,
        from: chosen.clip.intensity,
        to: targetIntensity,
      });
    }
  }

  const maxSetCount = Math.min(3, items.length);
  selected.sort((a, b) => a.index - b.index);

  const finalized = selected.slice(0, maxSetCount).map((item) => ({
    ...item.clip,
    intensity: item.normalized_intensity,
  }));

  for (const item of items) {
    const keep = finalized.some((clip) => clip.id === item.clip.id);
    if (!keep) {
      dropped.push(item.clip.id);
    }
  }

  return {
    groupKey,
    clips: finalized,
    relabeled,
    dropped,
  };
}

async function main() {
  const catalogArg = getArgValue(
    '--catalog',
    process.env.MOTION_CATALOG?.trim() || 'motions/clean/catalog.json'
  );
  const outputArg = getArgValue('--output', catalogArg);
  const reportArg = getArgValue(
    '--report',
    'motions/reports/intensity-triad-normalization-latest.json'
  );
  const dryRun = hasFlag('--dry-run');

  const catalogPath = toAbsolute(catalogArg);
  const outputPath = toAbsolute(outputArg);
  const reportPath = toAbsolute(reportArg);

  const raw = await readFile(catalogPath, 'utf8');
  const catalog = parseJson(raw, catalogPath);

  if (!catalog || typeof catalog !== 'object') {
    throw new Error('catalog must be an object');
  }

  const clips = Array.isArray(catalog.clips) ? catalog.clips : [];
  if (clips.length === 0) {
    throw new Error('catalog.clips is empty');
  }

  const groups = new Map();
  clips.forEach((clip, index) => {
    const groupKey = buildGroupKey(clip);
    const existing = groups.get(groupKey) || [];
    existing.push({ clip, index });
    groups.set(groupKey, existing);
  });

  const normalizedGroups = [];
  for (const [groupKey, items] of groups.entries()) {
    normalizedGroups.push(normalizeGroup(groupKey, items));
  }

  const normalizedClips = normalizedGroups
    .flatMap((group) => group.clips.map((clip) => ({
      clip,
      originalIndex: clips.findIndex((item) => item.id === clip.id),
    })))
    .sort((a, b) => a.originalIndex - b.originalIndex)
    .map((entry) => entry.clip);

  const nextCatalog = {
    ...catalog,
    clips: normalizedClips,
  };

  const report = {
    generated_at: new Date().toISOString(),
    catalog_path: catalogPath,
    output_path: outputPath,
    dry_run: dryRun,
    before_clip_count: clips.length,
    after_clip_count: normalizedClips.length,
    total_groups: normalizedGroups.length,
    relabeled_count: normalizedGroups.reduce((sum, group) => sum + group.relabeled.length, 0),
    dropped_count: normalizedGroups.reduce((sum, group) => sum + group.dropped.length, 0),
    groups: normalizedGroups.map((group) => ({
      group_key: group.groupKey,
      output_ids: group.clips.map((clip) => clip.id),
      output_intensities: group.clips.map((clip) => clip.intensity),
      relabeled: group.relabeled,
      dropped_ids: group.dropped,
    })),
  };

  await mkdir(resolve(rootDir, 'motions/reports'), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (!dryRun) {
    await writeFile(outputPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, 'utf8');
  }

  console.log(`[motion-triad] groups: ${normalizedGroups.length}`);
  console.log(`[motion-triad] clips: ${clips.length} -> ${normalizedClips.length}`);
  console.log(
    `[motion-triad] relabeled: ${report.relabeled_count}, dropped: ${report.dropped_count}`
  );
  console.log(`[motion-triad] report: ${reportPath}`);
  if (!dryRun) {
    console.log(`[motion-triad] wrote catalog: ${outputPath}`);
  }
}

main().catch((error) => {
  console.error(`[motion-triad] Failed: ${error.message}`);
  process.exit(1);
});
