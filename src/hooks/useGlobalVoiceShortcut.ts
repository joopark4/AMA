import { useEffect, useRef } from 'react';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import i18n from '../i18n';
import { normalizeGlobalShortcutAccelerator } from '../services/tauri/globalShortcutUtils';
import { useAppStatusStore } from '../stores/appStatusStore';

interface UseGlobalVoiceShortcutOptions {
  enabled: boolean;
  accelerator: string;
  onTrigger: () => void;
}

interface UseGlobalVoiceShortcutResult {
  registerError: string | null;
}

function isTauriDesktopRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__);
}

function normalizeRegisterError(error: unknown, accelerator: string): string {
  const detail = error instanceof Error ? error.message : String(error);
  return i18n.t('settings.voice.globalShortcut.registerErrorMessage', {
    accelerator,
    detail,
    defaultValue: 'Failed to register global shortcut ({{accelerator}}). It may be in use by another app or blocked by system privacy settings. Details: {{detail}}',
  });
}

export function useGlobalVoiceShortcut({
  enabled,
  accelerator,
  onTrigger,
}: UseGlobalVoiceShortcutOptions): UseGlobalVoiceShortcutResult {
  const registerError = useAppStatusStore((state) => state.globalShortcutRegisterError);
  const setGlobalShortcutRegisterError = useAppStatusStore(
    (state) => state.setGlobalShortcutRegisterError
  );
  const registeredShortcutRef = useRef<string | null>(null);
  const onTriggerRef = useRef(onTrigger);
  const effectRunRef = useRef(0);

  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  useEffect(() => {
    if (!isTauriDesktopRuntime()) {
      setGlobalShortcutRegisterError(null);
      return;
    }

    const runId = ++effectRunRef.current;
    const normalizedAccelerator = normalizeGlobalShortcutAccelerator(accelerator);

    const unregisterShortcut = async (shortcut: string | null) => {
      if (!shortcut) return;

      try {
        await unregister(shortcut);
      } catch {
        // ignore unregister cleanup errors
      } finally {
        if (registeredShortcutRef.current === shortcut) {
          registeredShortcutRef.current = null;
        }
      }
    };

    const applyShortcut = async () => {
      await unregisterShortcut(registeredShortcutRef.current);
      if (runId !== effectRunRef.current) return;

      if (!enabled) {
        setGlobalShortcutRegisterError(null);
        return;
      }

      try {
        await register(normalizedAccelerator, () => {
          onTriggerRef.current();
        });
        if (runId !== effectRunRef.current) {
          await unregister(normalizedAccelerator).catch(() => {});
          return;
        }
        registeredShortcutRef.current = normalizedAccelerator;
        setGlobalShortcutRegisterError(null);
      } catch (error) {
        if (runId !== effectRunRef.current) return;
        const message = normalizeRegisterError(error, normalizedAccelerator);
        setGlobalShortcutRegisterError(message);
      }
    };

    void applyShortcut();

    return () => {
      effectRunRef.current += 1;
      void unregisterShortcut(registeredShortcutRef.current);
    };
  }, [accelerator, enabled, setGlobalShortcutRegisterError]);

  return { registerError };
}

export default useGlobalVoiceShortcut;
