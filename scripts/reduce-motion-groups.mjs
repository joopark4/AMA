import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = process.cwd();

const PRESET_TARGETS = {
  min64: {
    neutral: 3,
    happy: 4,
    sad: 3,
    angry: 3,
    surprised: 3,
    thinking: 3,
    relaxed: 3,
    bridge: 2,
  },
  dedupe69: {
    neutral: 3,
    happy: 3,
    sad: 3,
    angry: 3,
    surprised: 3,
    thinking: 3,
    relaxed: 3,
    bridge: 2,
  },
  single24: {
    neutral: 1,
    happy: 1,
    sad: 1,
    angry: 1,
    surprised: 1,
    thinking: 1,
    relaxed: 1,
    bridge: 1,
  },
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

function getPrimaryEmotion(clip) {
  if (!Array.isArray(clip.emotion_tags) || clip.emotion_tags.length === 0) {
    return 'bridge';
  }
  for (const tag of clip.emotion_tags) {
    if (typeof tag === 'string' && tag.trim()) return tag.trim();
  }
  return 'bridge';
}

function buildGroupKey(clip) {
  const emotion = getPrimaryEmotion(clip);
  const variationTag = typeof clip.variation_tag === 'string' ? clip.variation_tag.trim() : '';
  if (variationTag) return `${emotion}::${variationTag}`;

  const slotGroup = typeof clip.slot_group === 'string' ? clip.slot_group.trim() : '';
  const baseId = String(clip.id || '')
    .replace(/_(low|mid|high)$/i, '')
    .replace(/_[0-9]+$/i, '')
    .trim();
  return `${emotion}::${slotGroup || 'default'}::${baseId || clip.id}`;
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeGroupStats(group) {
  const clips = group.clips;
  const avgPriority = average(clips.map((clip) => Number(clip.priority) || 0));
  const speakingRate = average(clips.map((clip) => (clip.speaking_compatible ? 1 : 0)));
  const movingRate = average(clips.map((clip) => (!clip.loopable ? 1 : 0)));
  const speakingMovingRate = average(
    clips.map((clip) => (clip.speaking_compatible && !clip.loopable ? 1 : 0))
  );
  const lowerBodyRate = average(clips.map((clip) => (clip.body_zone === 'full' ? 1 : 0)));

  const score =
    avgPriority * 1.55 +
    speakingRate * 0.6 +
    movingRate * 0.6 +
    speakingMovingRate * 0.8 +
    lowerBodyRate * 0.35;

  return {
    avgPriority,
    speakingRate,
    movingRate,
    speakingMovingRate,
    lowerBodyRate,
    score,
  };
}

function ensureCoverage(selected, nonSelected, predicate) {
  if (selected.some(predicate)) {
    return { selected, nonSelected, changed: false };
  }

  const candidate = nonSelected.find(predicate);
  if (!candidate) {
    return { selected, nonSelected, changed: false };
  }

  const removeIndex = selected.length - 1;
  if (removeIndex < 0) {
    return { selected, nonSelected, changed: false };
  }

  const removed = selected[removeIndex];
  const nextSelected = [...selected];
  nextSelected[removeIndex] = candidate;
  nextSelected.sort((a, b) => b.stats.score - a.stats.score);

  const nextNonSelected = nonSelected.filter((item) => item.key !== candidate.key);
  nextNonSelected.push(removed);
  nextNonSelected.sort((a, b) => b.stats.score - a.stats.score);

  return {
    selected: nextSelected,
    nonSelected: nextNonSelected,
    changed: true,
  };
}

function selectEmotionGroups(groups, targetCount) {
  const sorted = [...groups].sort((a, b) => b.stats.score - a.stats.score);
  if (sorted.length < targetCount) {
    throw new Error(
      `Insufficient groups for ${groups[0]?.emotion ?? 'unknown'}: ${sorted.length}/${targetCount}`
    );
  }

  let selected = sorted.slice(0, targetCount);
  let nonSelected = sorted.slice(targetCount);

  const requirements = [
    {
      name: 'speaking',
      predicate: (group) => group.stats.speakingRate > 0,
    },
    {
      name: 'moving',
      predicate: (group) => group.stats.movingRate > 0,
    },
    {
      name: 'speaking+moving',
      predicate: (group) => group.stats.speakingMovingRate > 0,
    },
  ];

  const swaps = [];

  for (const requirement of requirements) {
    const result = ensureCoverage(selected, nonSelected, requirement.predicate);
    selected = result.selected;
    nonSelected = result.nonSelected;
    if (result.changed) {
      swaps.push(requirement.name);
    }
  }

  selected.sort((a, b) => b.stats.score - a.stats.score);
  return { selected, nonSelected, swaps };
}

async function main() {
  const catalogArg = getArgValue(
    '--catalog',
    process.env.MOTION_CATALOG?.trim() || 'motions/clean/catalog.json'
  );
  const outputArg = getArgValue('--output', catalogArg);
  const reportArg = getArgValue('--report', 'motions/reports/reduce-motion-groups-latest.json');
  const preset = getArgValue('--preset', 'min64');
  const dryRun = hasFlag('--dry-run');

  const targets = PRESET_TARGETS[preset];
  if (!targets) {
    throw new Error(`Unknown preset: ${preset}`);
  }

  const catalogPath = toAbsolute(catalogArg);
  const outputPath = toAbsolute(outputArg);
  const reportPath = toAbsolute(reportArg);

  const catalogRaw = await readFile(catalogPath, 'utf8');
  const catalog = parseJson(catalogRaw, catalogPath);

  if (!catalog || typeof catalog !== 'object') {
    throw new Error('Catalog must be an object');
  }
  if (!Array.isArray(catalog.clips) || catalog.clips.length === 0) {
    throw new Error('Catalog clips are empty');
  }

  const groupsByKey = new Map();
  catalog.clips.forEach((clip, index) => {
    const key = buildGroupKey(clip);
    const emotion = getPrimaryEmotion(clip);
    const existing = groupsByKey.get(key) || { key, emotion, clips: [], indices: [] };
    existing.clips.push(clip);
    existing.indices.push(index);
    groupsByKey.set(key, existing);
  });

  const groupsByEmotion = new Map();
  for (const group of groupsByKey.values()) {
    const stats = computeGroupStats(group);
    const enriched = {
      ...group,
      stats,
    };
    const list = groupsByEmotion.get(group.emotion) || [];
    list.push(enriched);
    groupsByEmotion.set(group.emotion, list);
  }

  const selectedGroups = [];
  const reportEmotions = {};

  for (const [emotion, targetCount] of Object.entries(targets)) {
    const sourceGroups = groupsByEmotion.get(emotion) || [];
    if (sourceGroups.length < targetCount) {
      throw new Error(`Not enough groups for ${emotion}: ${sourceGroups.length}/${targetCount}`);
    }

    const { selected, nonSelected, swaps } = selectEmotionGroups(sourceGroups, targetCount);
    selectedGroups.push(...selected);

    reportEmotions[emotion] = {
      target_groups: targetCount,
      available_groups: sourceGroups.length,
      selected_groups: selected.map((group) => group.key),
      dropped_groups: nonSelected.map((group) => group.key),
      coverage_swaps: swaps,
      selected_scores: selected.map((group) => ({
        key: group.key,
        score: Number(group.stats.score.toFixed(4)),
      })),
    };
  }

  const selectedKeySet = new Set(selectedGroups.map((group) => group.key));
  const reducedClips = catalog.clips.filter((clip) => selectedKeySet.has(buildGroupKey(clip)));

  const reducedCatalog = {
    ...catalog,
    clips: reducedClips,
  };

  const droppedClips = catalog.clips.filter((clip) => !selectedKeySet.has(buildGroupKey(clip)));

  const report = {
    generated_at: new Date().toISOString(),
    catalog_path: catalogPath,
    output_path: outputPath,
    preset,
    dry_run: dryRun,
    group_count_before: groupsByKey.size,
    group_count_after: selectedGroups.length,
    clip_count_before: catalog.clips.length,
    clip_count_after: reducedClips.length,
    dropped_clip_count: droppedClips.length,
    dropped_clip_ids: droppedClips.map((clip) => clip.id),
    targets,
    by_emotion: reportEmotions,
  };

  await mkdir(resolve(rootDir, 'motions/reports'), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (!dryRun) {
    await writeFile(outputPath, `${JSON.stringify(reducedCatalog, null, 2)}\n`, 'utf8');
  }

  console.log(`[motion-reduce] groups: ${groupsByKey.size} -> ${selectedGroups.length}`);
  console.log(`[motion-reduce] clips: ${catalog.clips.length} -> ${reducedClips.length}`);
  console.log(`[motion-reduce] report: ${reportPath}`);
  if (!dryRun) {
    console.log(`[motion-reduce] wrote catalog: ${outputPath}`);
  }
}

main().catch((error) => {
  console.error(`[motion-reduce] Failed: ${error.message}`);
  process.exit(1);
});
