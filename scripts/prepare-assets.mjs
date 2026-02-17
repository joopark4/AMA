import { access, cp, lstat, mkdir, rename, rm } from 'node:fs/promises';
import { constants, createWriteStream } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const rootDir = process.cwd();
const forceCopy = process.env.FORCE_PREPARE_ASSETS === '1';
const includeDefaultVrm = process.env.PREPARE_VRM === '1';
const preparePublicModels = process.env.PREPARE_PUBLIC_MODELS !== '0';
const whisperModelSpecs = {
  base: {
    fileName: 'ggml-base.bin',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  },
  small: {
    fileName: 'ggml-small.bin',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  },
  medium: {
    fileName: 'ggml-medium.bin',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
  },
};
const requestedWhisperModels = (process.env.WHISPER_BUNDLE_MODELS || 'base')
  .split(',')
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);
const autoDownloadWhisperModels = process.env.PREPARE_DOWNLOAD_WHISPER === '1';

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

async function syncDirectory(sourcePath, targetPath, description) {
  await mkdir(dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true, force: true });
  console.log(`[prepare-assets] Synced ${description}: ${sourcePath} -> ${targetPath}`);
}

async function ensureRealDirectory(path, description) {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) {
      await rm(path, { recursive: true, force: true });
      console.log(`[prepare-assets] Removed symlink ${description}: ${path}`);
    }
  } catch {
    // Path does not exist yet.
  }

  await mkdir(path, { recursive: true });
}

async function removeIfExists(path, description) {
  try {
    await access(path, constants.F_OK);
  } catch {
    return;
  }

  await rm(path, { recursive: true, force: true });
  console.log(`[prepare-assets] Removed ${description}: ${path}`);
}

async function downloadFile(downloadUrl, targetPath, description) {
  await mkdir(dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.download`;

  try {
    console.log(`[prepare-assets] Downloading ${description}: ${downloadUrl}`);
    const response = await fetch(downloadUrl);
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(tempPath)
    );

    await rename(tempPath, targetPath);
    console.log(`[prepare-assets] Downloaded ${description}: ${targetPath}`);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {});
    throw new Error(`Failed to download ${description}: ${error.message}`);
  }
}

async function ensureWhisperBundleModels(whisperSource) {
  const uniqueModels = [...new Set(requestedWhisperModels)];
  if (uniqueModels.length === 0) {
    throw new Error('WHISPER_BUNDLE_MODELS is empty. Set at least one model (e.g. base,small,medium).');
  }

  await ensureRealDirectory(whisperSource, 'Whisper model directory');
  const missingSpecs = [];

  for (const modelName of uniqueModels) {
    const spec = whisperModelSpecs[modelName];
    if (!spec) {
      throw new Error(
        `Unsupported Whisper model "${modelName}". Supported models: ${Object.keys(whisperModelSpecs).join(', ')}.`
      );
    }

    const modelPath = resolve(whisperSource, spec.fileName);
    try {
      await access(modelPath, constants.F_OK);
      console.log(`[prepare-assets] Whisper model ready (${modelName}): ${modelPath}`);
    } catch {
      missingSpecs.push({ ...spec, modelName, modelPath });
    }
  }

  if (missingSpecs.length === 0) return;

  if (!autoDownloadWhisperModels) {
    const missingNames = missingSpecs.map((spec) => spec.fileName).join(', ');
    throw new Error(
      `Whisper model files are missing: ${missingNames}. ` +
      `Place them under ${whisperSource} or re-run with PREPARE_DOWNLOAD_WHISPER=1.`
    );
  }

  for (const spec of missingSpecs) {
    await downloadFile(
      spec.downloadUrl,
      spec.modelPath,
      `Whisper model (${spec.modelName})`
    );
  }
}

async function main() {
  const publicModelsRoot = resolve(rootDir, 'public/models');
  const supertonicSource = resolve(rootDir, 'models/supertonic');
  const supertonicOnnxSource = resolve(supertonicSource, 'onnx');
  const supertonicVoicesSource = resolve(supertonicSource, 'voice_styles');
  const whisperSource = resolve(rootDir, 'models/whisper');

  const supertonicTarget = resolve(rootDir, 'public/models/supertonic');
  const supertonicOnnxTarget = resolve(supertonicTarget, 'onnx');
  const supertonicVoicesTarget = resolve(supertonicTarget, 'voice_styles');
  const whisperTarget = resolve(rootDir, 'public/models/whisper');

  const vrmSource = resolve(rootDir, 'vrm/eunyeon_ps.vrm');
  const vrmTarget = resolve(rootDir, 'public/vrm/eunyeon_ps.vrm');

  await ensureExists(supertonicOnnxSource, 'Supertonic ONNX directory');
  await ensureExists(supertonicVoicesSource, 'Supertonic voice style directory');

  await ensureWhisperBundleModels(whisperSource);

  if (preparePublicModels) {
    await ensureRealDirectory(publicModelsRoot, 'public models root');
    await copyIfMissing(supertonicOnnxSource, supertonicOnnxTarget, 'Supertonic ONNX models');
    await copyIfMissing(supertonicVoicesSource, supertonicVoicesTarget, 'Supertonic voice styles');
    await syncDirectory(whisperSource, whisperTarget, 'Whisper model files');
  } else {
    await removeIfExists(publicModelsRoot, 'public model assets');
  }

  if (includeDefaultVrm) {
    await ensureExists(vrmSource, 'Default VRM model');
    await copyIfMissing(vrmSource, vrmTarget, 'Default VRM model');
  } else {
    await removeIfExists(resolve(rootDir, 'public/vrm'), 'bundled VRM assets');
  }
}

main().catch((error) => {
  console.error(`[prepare-assets] Failed: ${error.message}`);
  process.exit(1);
});
