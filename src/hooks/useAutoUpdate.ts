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
  lastCheckedAt: number | null;
  skippedVersion: string | null;
  skippedAt: number | null;
  checkForUpdate: () => Promise<void>;
  startUpdate: () => Promise<void>;
  restartApp: () => Promise<void>;
  skipUpdate: () => void;
}

let _updateRef: any = null;

const SKIP_REMIND_MS = 24 * 60 * 60 * 1000;

export const useAutoUpdateStore = create<AutoUpdateState>()((set, get) => ({
  info: null,
  downloading: false,
  progress: 0,
  ready: false,
  error: null,
  checking: false,
  lastCheckedAt: null,
  skippedVersion: null,
  skippedAt: null,

  checkForUpdate: async () => {
    set({ checking: true, error: null });
    try {
      console.log('[AutoUpdate] Checking for updates...');
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      const now = Date.now();

      if (update) {
        console.log('[AutoUpdate] Update available:', update.version);
        const { skippedVersion, skippedAt } = get();
        const stillSkipping =
          skippedVersion === update.version &&
          skippedAt !== null &&
          now - skippedAt < SKIP_REMIND_MS;
        set({
          checking: false,
          lastCheckedAt: now,
          info: stillSkipping
            ? { available: false, version: '', body: '' }
            : {
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
          lastCheckedAt: now,
          info: { available: false, version: '', body: '' },
          skippedVersion: null,
          skippedAt: null,
        });
        _updateRef = null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[AutoUpdate] Check failed:', message);
      set({ checking: false, lastCheckedAt: Date.now(), error: message });
    }
  },

  startUpdate: async () => {
    if (!_updateRef) return;

    set({ downloading: true, error: null });
    let downloadedBytes = 0;

    try {
      await _updateRef.downloadAndInstall((event: { event: string; data: { chunkLength: number; contentLength?: number } }) => {
        if (event.event === 'Progress') {
          const { contentLength, chunkLength } = event.data;
          downloadedBytes += chunkLength;
          if (contentLength && contentLength > 0) {
            set({ progress: Math.round((downloadedBytes / contentLength) * 100) });
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
    const current = get().info;
    set({
      info: null,
      downloading: false,
      progress: 0,
      ready: false,
      error: null,
      checking: false,
      skippedVersion: current?.available ? current.version : null,
      skippedAt: current?.available ? Date.now() : null,
    });
    _updateRef = null;
  },
}));

const PERIODIC_CHECK_MS = 24 * 60 * 60 * 1000;

/** Backwards-compatible hook - auto-checks on mount + every 24h */
export function useAutoUpdate() {
  const store = useAutoUpdateStore();

  useEffect(() => {
    store.checkForUpdate();
    const interval = setInterval(() => {
      useAutoUpdateStore.getState().checkForUpdate();
    }, PERIODIC_CHECK_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return store;
}
