import { access, chmod, cp, lstat, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { constants, createWriteStream, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const modelsSourceRoot = resolve(
  rootDir,
  process.env.PREPARE_MODELS_DIR?.trim() || 'models'
);
const forceCopy = process.env.FORCE_PREPARE_ASSETS === '1';
const includeDefaultVrm = process.env.PREPARE_VRM === '1';
const preparePublicModels = process.env.PREPARE_PUBLIC_MODELS !== '0';
const stageBundleResources = process.env.PREPARE_BUNDLE_RESOURCES !== '0';
const canStageMacBundleResources = process.platform === 'darwin';
const shouldCodesignBundledRuntime = process.env.PREPARE_CODESIGN_BUNDLE_RESOURCES !== '0';
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

function resolveCodesignIdentity() {
  const fromEnv = process.env.APPLE_CODESIGN_IDENTITY?.trim();
  if (fromEnv) return fromEnv;

  try {
    const tauriConfigPath = resolve(rootDir, 'src-tauri/tauri.conf.json');
    const raw = readFileSync(tauriConfigPath, 'utf8');
    const parsed = JSON.parse(raw);
    const fromConfig = parsed?.bundle?.macOS?.signingIdentity;
    if (typeof fromConfig === 'string' && fromConfig.trim()) {
      return fromConfig.trim();
    }
  } catch {
    // ignore parse/read errors; signing remains optional in this step
  }

  return null;
}

function codesignFile(path, identity, { runtime = false } = {}) {
  const args = ['--force', '--sign', identity, '--timestamp'];
  if (runtime) {
    args.push('--options', 'runtime');
  }
  args.push(path);

  const result = spawnSync('codesign', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    throw new Error(
      `codesign failed for ${path}: ${stderr || stdout || `exit ${result.status ?? 'unknown'}`}`
    );
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

  // Finder/Spotlight can recreate metadata files during deletion on macOS.
  // Use retry options so transient ENOTEMPTY does not fail the build.
  await rm(path, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 120,
  });
  console.log(`[prepare-assets] Removed ${description}: ${path}`);
}

async function copyFileIfMissing(sourcePath, targetPath, description) {
  if (!forceCopy) {
    try {
      await access(targetPath, constants.F_OK);
      return;
    } catch {
      // Target missing; continue with copy.
    }
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { force: true, dereference: true });
  console.log(`[prepare-assets] Copied ${description}: ${sourcePath} -> ${targetPath}`);
}

async function findExistingPath(candidates, description) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await access(candidate, constants.F_OK);
      return candidate;
    } catch {
      // Keep searching.
    }
  }

  throw new Error(`${description} not found. Checked: ${candidates.filter(Boolean).join(', ')}`);
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

async function stageWhisperRuntimeResources(bundleResourcesRoot, signingIdentity) {
  const binDir = resolve(bundleResourcesRoot, 'bin');
  const libDir = resolve(bundleResourcesRoot, 'lib');

  await ensureRealDirectory(binDir, 'bundled whisper runtime bin directory');
  await ensureRealDirectory(libDir, 'bundled whisper runtime lib directory');

  const whisperCliSource = await findExistingPath(
    [
      process.env.WHISPER_CLI_PATH,
      '/opt/homebrew/bin/whisper-cli',
      '/usr/local/bin/whisper-cli',
    ],
    'whisper-cli binary'
  );

  const whisperLibSourceDir = await findExistingPath(
    [
      process.env.WHISPER_CPP_LIB_DIR,
      '/opt/homebrew/opt/whisper-cpp/libexec/lib',
      '/usr/local/opt/whisper-cpp/libexec/lib',
    ],
    'whisper-cpp runtime library directory'
  );

  const whisperCliTarget = resolve(binDir, 'whisper-cli');
  await copyFileIfMissing(whisperCliSource, whisperCliTarget, 'Whisper runtime binary');
  await chmod(whisperCliTarget, 0o755);

  const libEntries = await readdir(whisperLibSourceDir);
  const whisperRuntimeLibs = libEntries.filter((entry) => {
    return entry.endsWith('.dylib') && (entry.startsWith('libwhisper') || entry.startsWith('libggml'));
  });

  if (whisperRuntimeLibs.length === 0) {
    throw new Error(`No whisper runtime dylibs found under ${whisperLibSourceDir}`);
  }

  for (const libName of whisperRuntimeLibs) {
    await copyFileIfMissing(
      resolve(whisperLibSourceDir, libName),
      resolve(libDir, libName),
      `Whisper runtime library (${libName})`
    );
  }

  const requiredLibs = [
    'libwhisper.1.dylib',
    'libggml.0.dylib',
    'libggml-cpu.0.dylib',
    'libggml-blas.0.dylib',
    'libggml-metal.0.dylib',
    'libggml-base.0.dylib',
  ];

  for (const libName of requiredLibs) {
    await ensureExists(resolve(libDir, libName), `Bundled whisper runtime library (${libName})`);
  }

  if (shouldCodesignBundledRuntime && signingIdentity && signingIdentity !== '-') {
    for (const libName of whisperRuntimeLibs) {
      codesignFile(resolve(libDir, libName), signingIdentity, { runtime: false });
    }
    codesignFile(whisperCliTarget, signingIdentity, { runtime: true });
    console.log(`[prepare-assets] Codesigned bundled whisper runtime with identity: ${signingIdentity}`);
  } else if (shouldCodesignBundledRuntime) {
    console.log('[prepare-assets] Skipping runtime codesign: no signing identity configured.');
  }

  console.log(`[prepare-assets] Whisper runtime ready: ${whisperCliTarget}`);
}

async function stageBundleModelResources({
  bundleResourcesRoot,
  supertonicSource,
  supertonicOnnxSource,
  supertonicVoicesSource,
  whisperSource,
}) {
  const modelsRoot = resolve(bundleResourcesRoot, 'models');
  const supertonicOnnxTarget = resolve(modelsRoot, 'supertonic/onnx');
  const supertonicVoicesTarget = resolve(modelsRoot, 'supertonic/voice_styles');
  const whisperTarget = resolve(modelsRoot, 'whisper');

  await ensureRealDirectory(modelsRoot, 'bundled model root directory');
  await copyIfMissing(supertonicOnnxSource, supertonicOnnxTarget, 'Bundled Supertonic ONNX models');
  await copyIfMissing(supertonicVoicesSource, supertonicVoicesTarget, 'Bundled Supertonic voice styles');
  await ensureRealDirectory(whisperTarget, 'bundled Whisper model directory');

  const requiredSupertonicAssets = [
    'onnx/tts.json',
    'onnx/unicode_indexer.json',
    'onnx/duration_predictor.onnx',
    'onnx/text_encoder.onnx',
    'onnx/vector_estimator.onnx',
    'onnx/vocoder.onnx',
    'voice_styles/F1.json',
  ];

  for (const relativePath of requiredSupertonicAssets) {
    await copyFileIfMissing(
      resolve(supertonicSource, relativePath),
      resolve(modelsRoot, `supertonic/${relativePath}`),
      `Bundled Supertonic asset (${relativePath})`
    );
  }

  const whisperEntries = await readdir(whisperSource, { withFileTypes: true });
  const whisperModels = whisperEntries
    .filter((entry) => entry.isFile() && entry.name.startsWith('ggml-') && entry.name.endsWith('.bin'))
    .map((entry) => entry.name);

  if (whisperModels.length === 0) {
    throw new Error(`No Whisper model files found under ${whisperSource}`);
  }

  for (const fileName of whisperModels) {
    await copyFileIfMissing(
      resolve(whisperSource, fileName),
      resolve(whisperTarget, fileName),
      `Bundled Whisper model (${fileName})`
    );
  }

  console.log(`[prepare-assets] Bundled Whisper models ready under: ${whisperTarget}`);
}

async function main() {
  const publicModelsRoot = resolve(rootDir, 'public/models');
  const bundleResourcesRoot = resolve(rootDir, 'src-tauri/resources');
  const supertonicSource = resolve(modelsSourceRoot, 'supertonic');
  const supertonicOnnxSource = resolve(supertonicSource, 'onnx');
  const supertonicVoicesSource = resolve(supertonicSource, 'voice_styles');
  const whisperSource = resolve(modelsSourceRoot, 'whisper');

  const supertonicTarget = resolve(rootDir, 'public/models/supertonic');
  const supertonicOnnxTarget = resolve(supertonicTarget, 'onnx');
  const supertonicVoicesTarget = resolve(supertonicTarget, 'voice_styles');
  const whisperTarget = resolve(rootDir, 'public/models/whisper');

  const vrmSource = resolve(rootDir, 'vrm/eunyeon_ps.vrm');
  const vrmTarget = resolve(rootDir, 'public/vrm/eunyeon_ps.vrm');

  console.log(`[prepare-assets] Model source root: ${modelsSourceRoot}`);

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

  if (!stageBundleResources) {
    console.log('[prepare-assets] Skipping staged Tauri bundle resources.');
    return;
  }

  if (!canStageMacBundleResources) {
    console.log('[prepare-assets] Skipping macOS bundle resource staging on non-macOS platform.');
    return;
  }

  await ensureRealDirectory(bundleResourcesRoot, 'Tauri bundle resource root');
  const signingIdentity = resolveCodesignIdentity();
  await stageBundleModelResources({
    bundleResourcesRoot,
    supertonicSource,
    supertonicOnnxSource,
    supertonicVoicesSource,
    whisperSource,
  });
  await stageWhisperRuntimeResources(bundleResourcesRoot, signingIdentity);
}

main().catch((error) => {
  console.error(`[prepare-assets] Failed: ${error.message}`);
  process.exit(1);
});
