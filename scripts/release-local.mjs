#!/usr/bin/env node

/**
 * release-local.mjs — AMA macOS 로컬 배포 자동화
 *
 * 전체 파이프라인:
 *   pre-check → build → stage → sign → notarize → package → github release → pages
 *
 * Usage:
 *   npm run release:local
 *   node scripts/release-local.mjs --skip-build --skip-notarize
 *   node scripts/release-local.mjs --dry-run
 */

import { spawnSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  cpSync,
  rmSync,
  symlinkSync,
  mkdtempSync,
} from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { findAppBundleSync } from './lib/findAppBundle.mjs';

// ─── Config ─────────────────────────────────────────────────────────────
const PAGES_REPO = 'https://github.com/joopark4/joopark4.github.io.git';
const PAGES_BASE_URL = 'https://joopark4.github.io/apps/ama';

// ─── CLI flags ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = {
  skipBuild: args.includes('--skip-build'),
  skipNotarize: args.includes('--skip-notarize'),
  skipRelease: args.includes('--skip-release'),
  skipPages: args.includes('--skip-pages'),
  dryRun: args.includes('--dry-run'),
};

// ─── Helpers ────────────────────────────────────────────────────────────
const PREFIX = '[release]';

function log(msg) {
  console.log(`${PREFIX} ${msg}`);
}

function warn(msg) {
  console.warn(`${PREFIX} ⚠ ${msg}`);
}

function fatal(msg) {
  console.error(`${PREFIX} ERROR: ${msg}`);
  process.exit(1);
}

function run(command, runArgs, opts = {}) {
  const label = `${command} ${runArgs.join(' ')}`;
  if (flags.dryRun) {
    log(`[DRY-RUN] ${label}`);
    return { status: 0, stdout: '', stderr: '' };
  }
  log(`$ ${label}`);
  const result = spawnSync(command, runArgs, {
    stdio: opts.capture ? 'pipe' : 'inherit',
    encoding: opts.capture ? 'utf8' : undefined,
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0) {
    const err = opts.capture ? (result.stderr || result.stdout || '') : '';
    throw new Error(`Command failed (exit ${result.status}): ${label}${err ? '\n' + err : ''}`);
  }
  return result;
}

function which(cmd) {
  const result = spawnSync('which', [cmd], { encoding: 'utf8' });
  return result.status === 0;
}

// ─── 1. PRE-CHECK ───────────────────────────────────────────────────────
function preCheck() {
  log('─── Step 1: PRE-CHECK ───');

  if (process.platform !== 'darwin') {
    fatal('This script is macOS-only.');
  }

  // 필수 환경변수 (dry-run에서는 경고만)
  const failOrWarn = flags.dryRun ? warn : fatal;

  const signingIdentity = process.env.APPLE_CODESIGN_IDENTITY?.trim();
  if (!signingIdentity) {
    failOrWarn('APPLE_CODESIGN_IDENTITY is required for Developer ID signing.');
  }

  if (!flags.skipNotarize) {
    const hasProfile = Boolean(process.env.APPLE_NOTARY_PROFILE?.trim());
    const hasCreds = Boolean(
      process.env.APPLE_ID?.trim() &&
      process.env.APPLE_TEAM_ID?.trim() &&
      process.env.APPLE_APP_PASSWORD?.trim()
    );
    if (!hasProfile && !hasCreds) {
      failOrWarn(
        'Notarization credentials required. Set APPLE_NOTARY_PROFILE or APPLE_ID+APPLE_TEAM_ID+APPLE_APP_PASSWORD. Use --skip-notarize to skip.'
      );
    }
  }

  if (!flags.skipBuild) {
    if (!process.env.TAURI_SIGNING_PRIVATE_KEY?.trim()) {
      failOrWarn(
        'TAURI_SIGNING_PRIVATE_KEY is required for updater signing. Export it before running.'
      );
    }
  }

  // 필수 도구
  const requiredTools = ['codesign', 'xcrun', 'hdiutil'];
  if (!flags.skipRelease) requiredTools.push('gh');

  for (const tool of requiredTools) {
    if (!which(tool)) {
      fatal(`Required tool not found: ${tool}`);
    }
  }

  // 버전 동기화
  const rootDir = process.cwd();
  const pkgJson = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
  const version = pkgJson.version;
  log(`Version from package.json: ${version}`);

  // Cargo.toml 동기화
  const cargoPath = resolve(rootDir, 'src-tauri/Cargo.toml');
  const cargoContent = readFileSync(cargoPath, 'utf8');
  const updatedCargo = cargoContent.replace(
    /^version\s*=\s*"[^"]*"/m,
    `version = "${version}"`
  );
  if (cargoContent !== updatedCargo) {
    if (!flags.dryRun) {
      writeFileSync(cargoPath, updatedCargo);
    }
    log(`Synced Cargo.toml version → ${version}`);
  }

  // tauri.conf.json 동기화
  const tauriConfPath = resolve(rootDir, 'src-tauri/tauri.conf.json');
  const tauriConfRaw = readFileSync(tauriConfPath, 'utf8');
  const tauriConf = JSON.parse(tauriConfRaw);
  if (tauriConf.version !== version) {
    tauriConf.version = version;
    if (!flags.dryRun) {
      writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
    }
    log(`Synced tauri.conf.json version → ${version}`);
  }

  // git 상태 확인
  const gitResult = spawnSync('git', ['status', '--porcelain'], {
    encoding: 'utf8',
    cwd: rootDir,
  });
  if (gitResult.stdout?.trim()) {
    warn('Uncommitted changes detected. Consider committing before release.');
  }

  log(`PRE-CHECK passed. Version: v${version}`);
  return version;
}

// ─── 2. BUILD ───────────────────────────────────────────────────────────
function build() {
  log('─── Step 2: BUILD ───');

  if (flags.skipBuild) {
    log('Skipped (--skip-build).');
    return;
  }

  run('npm', ['run', 'tauri', '--', 'build', '--bundles', 'app']);
  log('Build complete.');
}

// ─── 3. STAGE ───────────────────────────────────────────────────────────
function stage() {
  log('─── Step 3: STAGE (bundle models/runtime) ───');
  run('node', ['scripts/stage-bundled-models.mjs']);
  log('Staging complete.');
}

// ─── 4. SIGN ────────────────────────────────────────────────────────────
function sign() {
  log('─── Step 4: SIGN (Developer ID) ───');
  run('node', ['scripts/sign-macos-app.mjs']);
  log('Signing complete.');
}

// ─── 5. NOTARIZE ────────────────────────────────────────────────────────
function notarize() {
  log('─── Step 5: NOTARIZE ───');

  if (flags.skipNotarize) {
    log('Skipped (--skip-notarize).');
    return;
  }

  run('node', ['scripts/notarize-macos-app.mjs']);
  log('Notarization complete.');
}

// ─── 6. PACKAGE ─────────────────────────────────────────────────────────
function packageArtifacts(version) {
  log('─── Step 6: PACKAGE (tar.gz + sig + DMG) ───');

  if (flags.dryRun) {
    log('[DRY-RUN] Would create AMA.app.tar.gz, AMA.app.tar.gz.sig, AMA_<version>.dmg');
    return { tarGzPath: null, dmgPath: null };
  }

  const appPath = findAppBundleSync();
  // Output to the same parent directory as the app bundle's macos/ folder
  const bundleMacosDir = dirname(appPath);
  const outputDir = resolve(bundleMacosDir, '..');

  // ── tar.gz ──
  const tarGzPath = resolve(outputDir, 'AMA.app.tar.gz');
  run('tar', ['-czf', tarGzPath, '-C', bundleMacosDir, basename(appPath)], {
    env: { COPYFILE_DISABLE: '1' },
  });
  log(`Created: ${tarGzPath}`);

  // Verify no macOS resource fork files leaked into the archive
  const tarList = spawnSync('tar', ['-tzf', tarGzPath], { encoding: 'utf8' });
  const resourceForks = (tarList.stdout || '').split('\n').filter((l) => /\._/.test(l));
  if (resourceForks.length > 0) {
    fatal(
      `tar.gz contains macOS resource fork files (._*). ` +
      `This will break the Tauri updater.\n` +
      resourceForks.map((f) => `  ${f}`).join('\n')
    );
  }
  log('Verified: no resource fork files in tar.gz');

  // ── updater signature (.sig) ──
  const signingKey = process.env.TAURI_SIGNING_PRIVATE_KEY?.trim();
  if (signingKey) {
    const signerArgs = ['tauri', 'signer', 'sign', tarGzPath,
      '-k', signingKey,
    ];
    if (process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD?.trim()) {
      signerArgs.push('-p', process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD.trim());
    }
    run('npx', signerArgs);
    log(`Created: ${tarGzPath}.sig`);
  } else {
    warn('TAURI_SIGNING_PRIVATE_KEY not set. Skipping updater signature.');
  }

  // ── DMG ──
  const dmgPath = resolve(outputDir, `AMA_${version}.dmg`);
  const tmpMount = mkdtempSync(join(tmpdir(), 'ama-dmg-'));
  const stagingDir = join(tmpMount, 'staging');

  try {
    mkdirSync(stagingDir, { recursive: true });
    cpSync(appPath, join(stagingDir, 'AMA.app'), { recursive: true });
    symlinkSync('/Applications', join(stagingDir, 'Applications'));

    run('hdiutil', [
      'create', dmgPath,
      '-volname', `AMA ${version}`,
      '-srcfolder', stagingDir,
      '-ov', '-format', 'UDZO',
    ]);
    log(`Created: ${dmgPath}`);
  } finally {
    rmSync(tmpMount, { recursive: true, force: true });
  }

  return { tarGzPath, dmgPath };
}

// ─── 7. GITHUB RELEASE ─────────────────────────────────────────────────
function githubRelease(version, dmgPath) {
  log('─── Step 7: GITHUB RELEASE ───');

  if (flags.skipRelease) {
    log('Skipped (--skip-release).');
    return;
  }

  const tag = `v${version}`;

  // Check if release already exists
  const checkResult = spawnSync('gh', ['release', 'view', tag], {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (checkResult.status === 0) {
    warn(`Release ${tag} already exists. Uploading DMG as additional asset.`);
    run('gh', ['release', 'upload', tag, dmgPath, '--clobber']);
  } else {
    const releaseArgs = [
      'release', 'create', tag,
      '--title', `AMA ${tag}`,
      '--notes', `AMA ${tag} release`,
    ];
    if (dmgPath) {
      releaseArgs.push(dmgPath);
    }
    run('gh', releaseArgs);
  }

  log(`GitHub Release ${tag} done.`);
}

// ─── 8. GITHUB PAGES ───────────────────────────────────────────────────
function githubPages(version, tarGzPath) {
  log('─── Step 8: GITHUB PAGES (updater artifacts) ───');

  if (flags.skipPages) {
    log('Skipped (--skip-pages).');
    return;
  }

  if (flags.dryRun) {
    log('[DRY-RUN] Would clone joopark4.github.io, update apps/ama/, push.');
    return;
  }

  const sigPath = tarGzPath + '.sig';
  if (!existsSync(sigPath)) {
    warn('No .sig file found. Skipping GitHub Pages update (updater signature required).');
    return;
  }

  const pagesDir = mkdtempSync(join(tmpdir(), 'ama-pages-'));

  try {
    run('git', ['clone', '--depth=1', PAGES_REPO, pagesDir]);

    const amaDir = join(pagesDir, 'apps/ama');
    mkdirSync(amaDir, { recursive: true });

    // Copy artifacts
    cpSync(tarGzPath, join(amaDir, 'AMA.app.tar.gz'));
    cpSync(sigPath, join(amaDir, 'AMA.app.tar.gz.sig'));

    // Generate latest.json
    const sig = readFileSync(sigPath, 'utf8').trim();
    const latestJson = {
      version: `v${version}`,
      notes: `AMA v${version} release`,
      pub_date: new Date().toISOString(),
      platforms: {
        'darwin-aarch64': {
          signature: sig,
          url: `${PAGES_BASE_URL}/AMA.app.tar.gz`,
        },
        'darwin-x86_64': {
          signature: sig,
          url: `${PAGES_BASE_URL}/AMA.app.tar.gz`,
        },
      },
    };
    writeFileSync(join(amaDir, 'latest.json'), JSON.stringify(latestJson, null, 2) + '\n');
    log('Generated latest.json');

    // Commit + push
    run('git', ['add', '.'], { cwd: pagesDir });

    const commitResult = spawnSync(
      'git', ['diff', '--cached', '--quiet'],
      { cwd: pagesDir }
    );
    if (commitResult.status !== 0) {
      run('git', ['commit', '-m', `chore: AMA v${version} updater artifacts`], { cwd: pagesDir });
      run('git', ['push'], { cwd: pagesDir });
      log('Pushed updater artifacts to GitHub Pages.');
    } else {
      log('No changes to push to GitHub Pages.');
    }
  } finally {
    rmSync(pagesDir, { recursive: true, force: true });
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────────
function main() {
  log('=== AMA Local Release Pipeline ===');

  if (flags.dryRun) {
    log('DRY-RUN mode: no actions will be executed.');
  }

  const activeFlags = Object.entries(flags)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (activeFlags.length > 0) {
    log(`Active flags: ${activeFlags.join(', ')}`);
  }

  const version = preCheck();
  build();
  stage();
  sign();
  notarize();
  const { tarGzPath, dmgPath } = packageArtifacts(version);
  githubRelease(version, dmgPath);
  githubPages(version, tarGzPath);

  log('=== Release pipeline complete! ===');
  log(`Version: v${version}`);
  if (dmgPath) log(`DMG: ${dmgPath}`);
  if (tarGzPath) log(`tar.gz: ${tarGzPath}`);
}

main();
