import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findAppBundleSync } from './lib/findAppBundle.mjs';

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

  const appPath = findAppBundleSync();

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
