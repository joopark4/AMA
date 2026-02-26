import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function main() {
  if (process.platform !== 'darwin') {
    console.log('[notarize-macos-app] Skipped: macOS only.');
    return;
  }

  const candidatePaths = [
    process.env.CARGO_TARGET_DIR && resolve(process.env.CARGO_TARGET_DIR, 'release/bundle/macos/AMA.app'),
    resolve(process.env.HOME || '', 'Library/Caches/mypartnerai-build/release/bundle/macos/AMA.app'),
    resolve(process.cwd(), 'src-tauri/target/release/bundle/macos/AMA.app'),
    '/tmp/ama-build/release/bundle/macos/AMA.app',
    resolve(process.cwd(), '.build/release/bundle/macos/AMA.app'),
  ].filter(Boolean);
  const appPath = candidatePaths.find(p => existsSync(p));

  if (!appPath) {
    throw new Error(`[notarize-macos-app] App bundle not found. Checked: ${candidatePaths.join(', ')}`);
  }

  const profile = process.env.APPLE_NOTARY_PROFILE?.trim();
  const appleId = process.env.APPLE_ID?.trim();
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const appPassword = process.env.APPLE_APP_PASSWORD?.trim();

  const useProfile = Boolean(profile);
  const useCredentials = Boolean(appleId && teamId && appPassword);

  if (!useProfile && !useCredentials) {
    throw new Error(
      '[notarize-macos-app] Missing notarization credentials. Set APPLE_NOTARY_PROFILE or APPLE_ID+APPLE_TEAM_ID+APPLE_APP_PASSWORD.'
    );
  }

  const tmpRoot = mkdtempSync(join(tmpdir(), 'mypartnerai-notary-'));
  const zipPath = join(tmpRoot, 'AMA.app.zip');

  try {
    console.log('[notarize-macos-app] Creating zip for notarization...');
    run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zipPath]);

    const submitArgs = ['notarytool', 'submit', zipPath, '--wait'];

    if (useProfile) {
      submitArgs.push('--keychain-profile', profile);
    } else {
      submitArgs.push('--apple-id', appleId, '--team-id', teamId, '--password', appPassword);
    }

    console.log('[notarize-macos-app] Submitting to Apple notarization service...');
    run('xcrun', submitArgs);

    console.log('[notarize-macos-app] Stapling notarization ticket...');
    run('xcrun', ['stapler', 'staple', appPath]);

    console.log('[notarize-macos-app] Validating stapled ticket...');
    run('xcrun', ['stapler', 'validate', appPath]);

    console.log('[notarize-macos-app] Done.');
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main();
