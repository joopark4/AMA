import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { windowManager } from './windowManager';

async function focusWindow(): Promise<void> {
  try {
    await getCurrentWindow().setFocus();
  } catch {
    // ignore focus errors
  }
}

export async function pickVrmFile(): Promise<string | null> {
  await windowManager.disableClickThrough().catch(() => {});
  await focusWindow();

  try {
    const picked = await invoke<string | null>('pick_vrm_file');
    if (typeof picked === 'string' && picked.trim().length > 0) {
      return picked;
    }
  } catch (error) {
    console.error('Native VRM picker failed, fallback to plugin-dialog:', error);
  }

  await focusWindow();
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: 'VRM Model',
        extensions: ['vrm'],
      },
    ],
    title: 'Select VRM Model',
  });

  return typeof selected === 'string' && selected.trim().length > 0 ? selected : null;
}

