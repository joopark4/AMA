import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve, extname, relative } from 'node:path';

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

function toAbsolute(pathValue) {
  if (!pathValue) return '';
  if (pathValue.startsWith('/')) return pathValue;
  return resolve(rootDir, pathValue);
}

async function walkFiles(baseDir) {
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
      if (entry.name.startsWith('._') || entry.name === '.DS_Store') continue;

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

function classifyExtension(extension) {
  if (extension === '.fbx' || extension === '.bvh') return 'skeleton-motion';
  if (extension === '.glb' || extension === '.gltf' || extension === '.vrma') return '3d-animation';
  if (extension === '.json') return 'json-motion';
  if (extension === '.mp4' || extension === '.mov' || extension === '.mkv') return 'video-capture';
  return 'unknown';
}

async function main() {
  const sourceArg = getArgValue(
    '--source',
    process.env.MOTION_RAW_SOURCE || '/Volumes/Sandisk 2TB/Projects/MyPartnerAI/motions/raw'
  );
  const sourceDir = toAbsolute(sourceArg);
  const reportPath = resolve(rootDir, 'motions/reports/raw-motion-source-index.json');

  const files = await walkFiles(sourceDir);

  const byType = {};
  for (const file of files) {
    const type = classifyExtension(file.extension);
    byType[type] = (byType[type] || 0) + 1;
  }

  const report = {
    generated_at: new Date().toISOString(),
    source_dir: sourceDir,
    total_files: files.length,
    by_type: byType,
    files,
    ingestion_ready: files.length > 0,
    note: files.length > 0
      ? 'Raw source files found. Proceed with retarget/cleanup to motions/clean/clips.'
      : 'No raw source files found. Capture/import new data first.',
  };

  await mkdir(resolve(rootDir, 'motions/reports'), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[motion-collect] indexed ${files.length} raw source file(s)`);
  console.log(`[motion-collect] source: ${sourceDir}`);
  console.log(`[motion-collect] report: ${reportPath}`);
}

main().catch((error) => {
  console.error(`[motion-collect] Failed: ${error.message}`);
  process.exit(1);
});
