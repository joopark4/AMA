import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { resolve, basename } from 'node:path';

const rootDir = process.cwd();

function getArgValue(flag, fallback = '') {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const next = process.argv[index + 1];
  if (!next || next.startsWith('--')) return fallback;
  return next;
}

function toAbsolute(pathValue) {
  if (!pathValue) return '';
  if (pathValue.startsWith('/')) return pathValue;
  return resolve(rootDir, pathValue);
}

async function collectJsonFiles(dir) {
  const collected = [];

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (
        entry.isFile() &&
        /^motion_.*\.json$/i.test(entry.name) &&
        !entry.name.startsWith('._')
      ) {
        collected.push(fullPath);
      }
    }
  }

  await walk(dir);
  return collected;
}

async function clearTargetClips(targetDir) {
  const entries = await readdir(targetDir, { withFileTypes: true });
  const removals = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.json') || entry.name.startsWith('._')) {
      removals.push(rm(resolve(targetDir, entry.name), { force: true }));
    }
  }

  await Promise.all(removals);
}

async function main() {
  const sourceArg = getArgValue('--source', process.env.MOTION_CLEAN_SOURCE || '');
  const targetArg = getArgValue('--target', 'motions/clean/clips');

  if (!sourceArg) {
    throw new Error('Missing source. Use --source <path> or MOTION_CLEAN_SOURCE env.');
  }

  const sourceDir = toAbsolute(sourceArg);
  const targetDir = toAbsolute(targetArg);

  const sourceFiles = await collectJsonFiles(sourceDir);
  if (sourceFiles.length === 0) {
    throw new Error(`No JSON clips found in source: ${sourceDir}`);
  }

  await mkdir(targetDir, { recursive: true });
  await clearTargetClips(targetDir);

  const usedNames = new Set();
  let copiedCount = 0;

  for (const sourceFile of sourceFiles) {
    const fileName = basename(sourceFile);
    if (usedNames.has(fileName)) {
      throw new Error(`Duplicate filename during sync: ${fileName}`);
    }
    usedNames.add(fileName);

    const targetFile = resolve(targetDir, fileName);
    await cp(sourceFile, targetFile, { force: true });
    copiedCount += 1;
  }

  console.log(`[motion-sync] source: ${sourceDir}`);
  console.log(`[motion-sync] target: ${targetDir}`);
  console.log(`[motion-sync] copied ${copiedCount} clips`);
}

main().catch((error) => {
  console.error(`[motion-sync] Failed: ${error.message}`);
  process.exit(1);
});
