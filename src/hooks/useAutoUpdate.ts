import { useEffect, useState, useCallback } from 'react';

interface UpdateInfo {
  available: boolean;
  version: string;
  body: string;
}

interface UpdateState {
  info: UpdateInfo | null;
  downloading: boolean;
  progress: number;
  ready: boolean;
  error: string | null;
}

export function useAutoUpdate() {
  const [state, setState] = useState<UpdateState>({
    info: null,
    downloading: false,
    progress: 0,
    ready: false,
    error: null,
  });
  const [updateRef, setUpdateRef] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkForUpdate() {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();

        if (cancelled) return;

        if (update) {
          setState((prev) => ({
            ...prev,
            info: {
              available: true,
              version: update.version,
              body: update.body ?? '',
            },
          }));
          setUpdateRef(update);
        }
      } catch {
        // Updater not configured or network unavailable - silently ignore
      }
    }

    checkForUpdate();

    return () => {
      cancelled = true;
    };
  }, []);

  const startUpdate = useCallback(async () => {
    if (!updateRef) return;

    setState((prev) => ({ ...prev, downloading: true, error: null }));

    try {
      await updateRef.downloadAndInstall((event: any) => {
        if (event.event === 'Progress') {
          const { contentLength, chunkLength } = event.data;
          if (contentLength && contentLength > 0) {
            setState((prev) => ({
              ...prev,
              progress: Math.round((chunkLength / contentLength) * 100),
            }));
          }
        }
      });

      setState((prev) => ({ ...prev, downloading: false, ready: true }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, downloading: false, error: message }));
    }
  }, [updateRef]);

  const restartApp = useCallback(async () => {
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      // Process plugin not available
    }
  }, []);

  const skipUpdate = useCallback(() => {
    setState({
      info: null,
      downloading: false,
      progress: 0,
      ready: false,
      error: null,
    });
    setUpdateRef(null);
  }, []);

  return { ...state, startUpdate, restartApp, skipUpdate };
}
