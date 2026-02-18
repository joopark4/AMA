import { access, chmod, cp, mkdir, readdir, rm, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

async function ensureExists(path, description) {
  try {
    await access(path, constants.F_OK);
  } catch {
    throw new Error(`${description} not found: ${path}`);
  }
}

async function syncDirectory(sourcePath, targetPath, description) {
  await ensureExists(sourcePath, description);
  await rm(targetPath, { recursive: true, force: true });
  await mkdir(dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true, force: true });
  console.log(`[stage-models] Synced ${description}: ${sourcePath} -> ${targetPath}`);
}

async function findExistingPath(candidates, description) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await access(candidate, constants.F_OK);
      return candidate;
    } catch {
      // keep searching
    }
  }
  throw new Error(`${description} not found. Checked: ${candidates.filter(Boolean).join(', ')}`);
}

async function resolveCodesignIdentity(rootDir) {
  const fromEnv = process.env.APPLE_CODESIGN_IDENTITY?.trim();
  if (fromEnv) return fromEnv;

  try {
    const tauriConfigPath = resolve(rootDir, 'src-tauri/tauri.conf.json');
    const raw = await readFile(tauriConfigPath, 'utf8');
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

async function stageWhisperRuntime(resourcesDir, signingIdentity) {
  const binDir = resolve(resourcesDir, 'bin');
  const libDir = resolve(resourcesDir, 'lib');

  await rm(binDir, { recursive: true, force: true });
  await rm(libDir, { recursive: true, force: true });
  await mkdir(binDir, { recursive: true });
  await mkdir(libDir, { recursive: true });

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
  await cp(whisperCliSource, whisperCliTarget, { force: true, dereference: true });
  await chmod(whisperCliTarget, 0o755);

  const libEntries = await readdir(whisperLibSourceDir);
  const whisperRuntimeLibs = libEntries.filter((entry) => {
    return entry.endsWith('.dylib') && (entry.startsWith('libwhisper') || entry.startsWith('libggml'));
  });

  if (whisperRuntimeLibs.length === 0) {
    throw new Error(`No whisper runtime dylibs found under ${whisperLibSourceDir}`);
  }

  for (const libName of whisperRuntimeLibs) {
    await cp(
      resolve(whisperLibSourceDir, libName),
      resolve(libDir, libName),
      { force: true, dereference: true }
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

  if (signingIdentity) {
    for (const libName of whisperRuntimeLibs) {
      codesignFile(resolve(libDir, libName), signingIdentity, { runtime: false });
    }
    codesignFile(whisperCliTarget, signingIdentity, { runtime: true });
    console.log(`[stage-models] Codesigned bundled whisper runtime with identity: ${signingIdentity}`);
  } else {
    console.log('[stage-models] Skipping runtime codesign: no signing identity configured.');
  }

  console.log(`[stage-models] Staged Whisper runtime binary: ${whisperCliSource} -> ${whisperCliTarget}`);
  console.log(`[stage-models] Staged Whisper runtime libraries from: ${whisperLibSourceDir}`);
}

async function main() {
  if (process.platform !== 'darwin') {
    console.log('[stage-models] Skipped: macOS app bundle staging only.');
    return;
  }

  const rootDir = process.cwd();
  const signingIdentity = await resolveCodesignIdentity(rootDir);
  const appBundlePath = resolve(
    rootDir,
    'src-tauri/target/release/bundle/macos/MyPartnerAI.app'
  );
  const resourcesDir = resolve(appBundlePath, 'Contents/Resources');
  const modelsDir = resolve(resourcesDir, 'models');

  await ensureExists(appBundlePath, 'Built app bundle');
  await mkdir(resourcesDir, { recursive: true });

  // Clear stale updater-embedded model payloads from previous builds.
  await rm(resolve(resourcesDir, '_up_/models'), { recursive: true, force: true });
  await rm(modelsDir, { recursive: true, force: true });

  await syncDirectory(
    resolve(rootDir, 'models/whisper'),
    resolve(modelsDir, 'whisper'),
    'Whisper models'
  );
  await syncDirectory(
    resolve(rootDir, 'models/supertonic/onnx'),
    resolve(modelsDir, 'supertonic/onnx'),
    'Supertonic ONNX models'
  );
  await syncDirectory(
    resolve(rootDir, 'models/supertonic/voice_styles'),
    resolve(modelsDir, 'supertonic/voice_styles'),
    'Supertonic voice styles'
  );
  await stageWhisperRuntime(resourcesDir, signingIdentity);
}

main().catch((error) => {
  console.error(`[stage-models] Failed: ${error.message}`);
  process.exit(1);
});
