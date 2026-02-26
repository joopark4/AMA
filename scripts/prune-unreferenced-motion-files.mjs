import { readdir, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const rootDir = process.cwd();

function shouldIgnoreFile(fileName) {
  return (
    fileName === '.gitkeep' ||
    fileName === '.DS_Store' ||
    fileName.startsWith('._')
  );
}

async function readJson(path) {
  const raw = await import('node:fs/promises').then((fs) => fs.readFile(path, 'utf8'));
  return JSON.parse(raw);
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !shouldIgnoreFile(name));
}

async function removeFiles(baseDir, files) {
  let removed = 0;
  for (const file of files) {
    const path = resolve(baseDir, file);
    await rm(path, { force: true });
    removed += 1;
  }
  return removed;
}

async function main() {
  const catalogPath = resolve(rootDir, 'motions/clean/catalog.json');
  const manifestPath = resolve(rootDir, 'src/config/motionManifest.json');
  const cleanDir = resolve(rootDir, 'motions/clean/clips');
  const publicDir = resolve(rootDir, 'public/motions/clips');
  const reportPath = resolve(rootDir, 'motions/reports/prune-unreferenced-files-latest.json');

  const catalog = await readJson(catalogPath);
  const manifest = await readJson(manifestPath);

  const keepClean = new Set(
    (catalog.clips || [])
      .map((clip) => basename(String(clip.source_file || '').trim()))
      .filter(Boolean)
  );
  const keepPublic = new Set(
    (manifest.clips || [])
      .map((clip) => basename(String(clip.file || '').trim()))
      .filter(Boolean)
  );

  const cleanFiles = await listFiles(cleanDir);
  const publicFiles = await listFiles(publicDir);

  const removeClean = cleanFiles.filter((file) => !keepClean.has(file));
  const removePublic = publicFiles.filter((file) => !keepPublic.has(file));

  const removedClean = await removeFiles(cleanDir, removeClean);
  const removedPublic = await removeFiles(publicDir, removePublic);

  const report = {
    generated_at: new Date().toISOString(),
    clean_dir: cleanDir,
    public_dir: publicDir,
    keep_clean_count: keepClean.size,
    keep_public_count: keepPublic.size,
    removed_clean_count: removedClean,
    removed_public_count: removedPublic,
    removed_clean_files: removeClean.sort(),
    removed_public_files: removePublic.sort(),
  };

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[motion-prune-files] removed clean clips: ${removedClean}`);
  console.log(`[motion-prune-files] removed public clips: ${removedPublic}`);
  console.log(`[motion-prune-files] report: ${reportPath}`);
}

main().catch((error) => {
  console.error(`[motion-prune-files] Failed: ${error.message}`);
  process.exit(1);
});
