import { useEffect } from 'react';
import { create } from 'zustand';

interface UpdateInfo {
  available: boolean;
  version: string;
  body: string;
}

interface AutoUpdateState {
  info: UpdateInfo | null;
  downloading: boolean;
  progress: number;
  ready: boolean;
  error: string | null;
  checking: boolean;
  checkForUpdate: () => Promise<void>;
  startUpdate: () => Promise<void>;
  restartApp: () => Promise<void>;
  skipUpdate: () => void;
}

let _updateRef: any = null;

export const useAutoUpdateStore = create<AutoUpdateState>()((set) => ({
  info: null,
  downloading: false,
  progress: 0,
  ready: false,
  error: null,
  checking: false,

  checkForUpdate: async () => {
    set({ checking: true, error: null });
    try {
      console.log('[AutoUpdate] Checking for updates...');
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (update) {
        console.log('[AutoUpdate] Update available:', update.version);
        set({
          checking: false,
          info: {
            available: true,
            version: update.version,
            body: update.body ?? '',
          },
        });
        _updateRef = update;
      } else {
        console.log('[AutoUpdate] No update available (already latest)');
        set({
          checking: false,
          info: { available: false, version: '', body: '' },
        });
        _updateRef = null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[AutoUpdate] Check failed:', message);
      set({ checking: false, error: message });
    }
  },

  startUpdate: async () => {
    if (!_updateRef) return;

    set({ downloading: true, error: null });

    try {
      await _updateRef.downloadAndInstall((event: { event: string; data: { chunkLength: number; contentLength?: number } }) => {
        if (event.event === 'Progress') {
          const { contentLength, chunkLength } = event.data;
          if (contentLength && contentLength > 0) {
            set({ progress: Math.round((chunkLength / contentLength) * 100) });
          }
        }
      });

      set({ downloading: false, ready: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ downloading: false, error: message });
    }
  },

  restartApp: async () => {
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      // Process plugin not available
    }
  },

  skipUpdate: () => {
    set({
      info: null,
      downloading: false,
      progress: 0,
      ready: false,
      error: null,
      checking: false,
    });
    _updateRef = null;
  },
}));

/** Backwards-compatible hook - auto-checks for updates on mount */
export function useAutoUpdate() {
  const store = useAutoUpdateStore();

  useEffect(() => {
    store.checkForUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return store;
}
