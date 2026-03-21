import { invoke } from '@tauri-apps/api/core';

/**
 * Check whether a default VRM avatar is embedded in this build.
 */
export async function isDefaultVrmAvailable(): Promise<boolean> {
  return invoke<boolean>('is_default_vrm_available');
}

/**
 * Load the embedded default VRM as an ArrayBuffer.
 * The Rust backend decrypts and returns base64; we decode it here.
 */
export async function loadDefaultVrmBuffer(): Promise<ArrayBuffer> {
  const base64 = await invoke<string>('load_default_vrm');

  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}
