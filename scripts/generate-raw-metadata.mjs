import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';

const rootDir = process.cwd();
const RECOGNIZED_EXTENSIONS = new Set([
  '.fbx',
  '.bvh',
  '.glb',
  '.gltf',
  '.vrma',
  '.json',
  '.mp4',
  '.mov',
  '.mkv',
]);

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

function sanitizeSegment(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function inferClipId(relativePath) {
  const withoutMeta = relativePath.replace(/\.meta\.json$/i, '');
  const withoutExt = withoutMeta.replace(/\.[^.]+$/, '');
  return sanitizeSegment(withoutExt.replace(/[\\/]+/g, '-')) || 'motion-raw';
}

function classifyExtension(extension) {
  if (extension === '.fbx' || extension === '.bvh') return 'skeleton-motion';
  if (extension === '.glb' || extension === '.gltf' || extension === '.vrma') return '3d-animation';
  if (extension === '.json') return 'json-motion';
  if (extension === '.mp4' || extension === '.mov' || extension === '.mkv') return 'video-capture';
  return 'unknown';
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function parseIntensity(value) {
  if (value === 'low' || value === 'mid' || value === 'high') return value;
  return 'mid';
}

function normalizeOverrides(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (entry && typeof entry === 'object' ? entry : null))
      .filter(Boolean);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).map(([contains, metadata]) => ({
      contains,
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
    }));
  }

  return [];
}

function pickOverride(relativePath, fileName, overrides) {
  const target = `${relativePath} ${fileName}`.toLowerCase();
  for (const entry of overrides) {
    const contains = typeof entry.contains === 'string' ? entry.contains.toLowerCase() : '';
    if (!contains) continue;
    if (!target.includes(contains)) continue;
    return entry;
  }
  return {};
}

async function readJson(path, fallback) {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`Failed to read JSON (${path}): ${error.message}`);
  }
}

async function walkFiles(baseDir) {
  const files = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('._') || entry.name === '.DS_Store') continue;
      const fullPath = resolve(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (entry.name.endsWith('.meta.json')) continue;
      if (entry.name === 'raw-intake-checklist.json') continue;

      const extension = extname(entry.name).toLowerCase();
      if (!RECOGNIZED_EXTENSIONS.has(extension)) continue;

      const fileStats = await stat(fullPath);
      files.push({
        name: entry.name,
        extension,
        path: fullPath,
        relative_path: relative(baseDir, fullPath),
        size_bytes: fileStats.size,
        modified_at: fileStats.mtime.toISOString(),
      });
    }
  }

  await walk(baseDir);
  return files;
}

function normalizeMeta(meta, defaults = {}) {
  const merged = {
    ...defaults,
    ...meta,
  };

  merged.license_class = typeof merged.license_class === 'string' && merged.license_class.trim()
    ? merged.license_class.trim()
    : 'unverified';
  merged.source_url = typeof merged.source_url === 'string' ? merged.source_url : '';
  merged.attribution_required = parseBoolean(merged.attribution_required, false);
  merged.redistribution_note = typeof merged.redistribution_note === 'string' ? merged.redistribution_note : '';

  if (!Array.isArray(merged.emotion_tags) || merged.emotion_tags.length === 0) {
    merged.emotion_tags = ['neutral'];
  } else {
    merged.emotion_tags = merged.emotion_tags
      .filter((tag) => typeof tag === 'string')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (merged.emotion_tags.length === 0) merged.emotion_tags = ['neutral'];
  }

  merged.intensity = parseIntensity(merged.intensity);
  merged.loopable_candidate = parseBoolean(merged.loopable_candidate, false);
  merged.speaking_compatible_candidate = parseBoolean(merged.speaking_compatible_candidate, false);

  const qualityFlags = merged.quality_flags && typeof merged.quality_flags === 'object'
    ? merged.quality_flags
    : {};
  merged.quality_flags = {
    needs_retarget: parseBoolean(qualityFlags.needs_retarget, true),
    needs_loop_alignment: parseBoolean(qualityFlags.needs_loop_alignment, false),
    needs_footlock_fix: parseBoolean(qualityFlags.needs_footlock_fix, false),
    needs_hand_smoothing: parseBoolean(qualityFlags.needs_hand_smoothing, false),
  };

  return merged;
}

function buildMetadata(file, defaults, overrides) {
  const sourceType = classifyExtension(file.extension);
  const ruleOverride = pickOverride(file.relative_path, file.name, overrides);

  const derived = {
    file_name: file.name,
    file_relative_path: file.relative_path,
    file_size_bytes: file.size_bytes,
    modified_at: file.modified_at,
    source_type: sourceType,
    source_format: file.extension,
    motion_clip_id_suggestion: inferClipId(file.relative_path),
    created_at: new Date().toISOString(),
    capture_tool: '',
    actor: '',
    notes: '',
  };

  return normalizeMeta(
    {
      ...ruleOverride,
      ...derived,
    },
    defaults
  );
}

async function main() {
  const sourceArg = getArgValue(
    '--source',
    process.env.MOTION_RAW_SOURCE || 'motions/raw'
  );
  const checklistArg = getArgValue('--checklist', 'motions/raw/raw-intake-checklist.json');
  const reportArg = getArgValue('--report', 'motions/reports/raw-motion-metadata-report.json');
  const sourceDir = toAbsolute(sourceArg);
  const checklistPath = toAbsolute(checklistArg);
  const reportPath = toAbsolute(reportArg);
  const overwrite = hasFlag('--overwrite');
  const dryRun = hasFlag('--dry-run');

  const checklist = await readJson(checklistPath, {});
  const metadataDefaults = checklist.metadata_defaults && typeof checklist.metadata_defaults === 'object'
    ? checklist.metadata_defaults
    : {};
  const overrides = normalizeOverrides(checklist.source_overrides);

  const files = await walkFiles(sourceDir);
  const results = [];
  let created = 0;
  let updated = 0;
  let skippedExisting = 0;

  for (const file of files) {
    const sidecarPath = `${file.path}.meta.json`;
    let sidecarExists = false;
    try {
      await stat(sidecarPath);
      sidecarExists = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    if (sidecarExists && !overwrite) {
      skippedExisting += 1;
      results.push({
        file: file.relative_path,
        sidecar: relative(sourceDir, sidecarPath),
        status: 'skipped-existing',
      });
      continue;
    }

    const metadata = buildMetadata(file, metadataDefaults, overrides);

    if (!dryRun) {
      await writeFile(sidecarPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    }

    if (sidecarExists) {
      updated += 1;
    } else {
      created += 1;
    }

    results.push({
      file: file.relative_path,
      sidecar: relative(sourceDir, sidecarPath),
      status: sidecarExists ? 'updated' : 'created',
      source_type: metadata.source_type,
      license_class: metadata.license_class,
    });
  }

  const report = {
    generated_at: new Date().toISOString(),
    source_dir: sourceDir,
    checklist_path: checklistPath,
    dry_run: dryRun,
    overwrite,
    total_raw_files: files.length,
    created,
    updated,
    skipped_existing: skippedExisting,
    recognized_extensions: [...RECOGNIZED_EXTENSIONS],
    items: results,
  };

  await mkdir(resolve(rootDir, 'motions/reports'), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[raw-meta] source: ${sourceDir}`);
  console.log(`[raw-meta] checklist: ${checklistPath}`);
  console.log(`[raw-meta] total: ${files.length}, created: ${created}, updated: ${updated}, skipped: ${skippedExisting}`);
  console.log(`[raw-meta] report: ${reportPath}`);
}

main().catch((error) => {
  console.error(`[raw-meta] Failed: ${error.message}`);
  process.exit(1);
});
