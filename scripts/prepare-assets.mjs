import { access, cp, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname } from 'node:path';

const rootDir = process.cwd();
const forceCopy = process.env.FORCE_PREPARE_ASSETS === '1';

async function ensureExists(path, description) {
  try {
    await access(path, constants.F_OK);
  } catch {
    throw new Error(`${description} not found: ${path}`);
  }
}

async function copyIfMissing(sourcePath, targetPath, description) {
  if (!forceCopy) {
    try {
      await access(targetPath, constants.F_OK);
      console.log(`[prepare-assets] ${description} already prepared: ${targetPath}`);
      return;
    } catch {
      // Target missing; continue with copy
    }
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true, force: true });
  console.log(`[prepare-assets] Copied ${description}: ${sourcePath} -> ${targetPath}`);
}

async function main() {
  const supertonicSource = resolve(rootDir, 'models/supertonic');
  const supertonicOnnxSource = resolve(supertonicSource, 'onnx');
  const supertonicVoicesSource = resolve(supertonicSource, 'voice_styles');

  const supertonicTarget = resolve(rootDir, 'public/models/supertonic');
  const supertonicOnnxTarget = resolve(supertonicTarget, 'onnx');
  const supertonicVoicesTarget = resolve(supertonicTarget, 'voice_styles');

  const vrmSource = resolve(rootDir, 'vrm/eunyeon_ps.vrm');
  const vrmTarget = resolve(rootDir, 'public/vrm/eunyeon_ps.vrm');

  await ensureExists(supertonicOnnxSource, 'Supertonic ONNX directory');
  await ensureExists(supertonicVoicesSource, 'Supertonic voice style directory');
  await ensureExists(vrmSource, 'Default VRM model');

  await copyIfMissing(supertonicOnnxSource, supertonicOnnxTarget, 'Supertonic ONNX models');
  await copyIfMissing(supertonicVoicesSource, supertonicVoicesTarget, 'Supertonic voice styles');
  await copyIfMissing(vrmSource, vrmTarget, 'Default VRM model');
}

main().catch((error) => {
  console.error(`[prepare-assets] Failed: ${error.message}`);
  process.exit(1);
});
