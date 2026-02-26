import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { findAppBundleSync } from './lib/findAppBundle.mjs';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function main() {
  if (process.platform !== 'darwin') {
    console.log('[sign-macos-app] Skipped: macOS only.');
    return;
  }

  const appPath = findAppBundleSync();
  const entitlementsPath = resolve(process.cwd(), 'src-tauri/entitlements.plist');
  const signingIdentity = process.env.APPLE_CODESIGN_IDENTITY || '-';

  const isDeveloperIdSigning = signingIdentity !== '-';
  const signArgs = ['--force', '--deep', '--sign', signingIdentity];

  if (isDeveloperIdSigning) {
    signArgs.push('--options', 'runtime', '--timestamp');
    if (existsSync(entitlementsPath)) {
      signArgs.push('--entitlements', entitlementsPath);
    }
  }

  signArgs.push(appPath);

  console.log(
    `[sign-macos-app] Signing app (${isDeveloperIdSigning ? 'Developer ID' : 'ad-hoc'}): ${appPath}`
  );
  run('codesign', signArgs);

  console.log('[sign-macos-app] Verifying signature...');
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);

  console.log('[sign-macos-app] Done.');
}

main();
