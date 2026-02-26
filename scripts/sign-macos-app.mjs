import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

  const candidatePaths = [
    process.env.CARGO_TARGET_DIR && resolve(process.env.CARGO_TARGET_DIR, 'release/bundle/macos/AMA.app'),
    resolve(process.env.HOME || '', 'Library/Caches/mypartnerai-build/release/bundle/macos/AMA.app'),
    resolve(process.cwd(), 'src-tauri/target/release/bundle/macos/AMA.app'),
    '/tmp/ama-build/release/bundle/macos/AMA.app',
    resolve(process.cwd(), '.build/release/bundle/macos/AMA.app'),
  ].filter(Boolean);
  const appPath = candidatePaths.find(p => existsSync(p));
  const entitlementsPath = resolve(process.cwd(), 'src-tauri/entitlements.plist');
  const signingIdentity = process.env.APPLE_CODESIGN_IDENTITY || '-';

  if (!appPath) {
    throw new Error(`[sign-macos-app] App bundle not found. Checked: ${candidatePaths.join(', ')}`);
  }

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
