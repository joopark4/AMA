/**
 * Shared utility for locating the built AMA.app bundle.
 *
 * CARGO_TARGET_DIR may override the default Tauri output path, so we
 * check multiple candidate locations in order of priority.
 */
import { existsSync } from 'node:fs';
import { access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';

const APP_NAME = 'AMA.app';
const BUNDLE_SUFFIX = `release/bundle/macos/${APP_NAME}`;

function candidatePaths(cwd = process.cwd()) {
  return [
    process.env.CARGO_TARGET_DIR && resolve(process.env.CARGO_TARGET_DIR, BUNDLE_SUFFIX),
    resolve(process.env.HOME || '', 'Library/Caches/mypartnerai-build', BUNDLE_SUFFIX),
    resolve(cwd, 'src-tauri/target', BUNDLE_SUFFIX),
    `/tmp/ama-build/${BUNDLE_SUFFIX}`,
    resolve(cwd, '.build', BUNDLE_SUFFIX),
  ].filter(Boolean);
}

/**
 * Synchronous lookup — for scripts that use `spawnSync`.
 * @param {string} [cwd]
 * @returns {string} resolved path
 */
export function findAppBundleSync(cwd) {
  const paths = candidatePaths(cwd);
  const found = paths.find((p) => existsSync(p));
  if (!found) {
    throw new Error(`App bundle not found. Checked:\n  ${paths.join('\n  ')}`);
  }
  return found;
}

/**
 * Asynchronous lookup — for scripts that use async fs helpers.
 * @param {string} [cwd]
 * @returns {Promise<string>} resolved path
 */
export async function findAppBundle(cwd) {
  const paths = candidatePaths(cwd);
  for (const p of paths) {
    try {
      await access(p, constants.F_OK);
      return p;
    } catch {
      // keep searching
    }
  }
  throw new Error(`App bundle not found. Checked:\n  ${paths.join('\n  ')}`);
}
