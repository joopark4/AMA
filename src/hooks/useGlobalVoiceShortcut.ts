import { useEffect, useRef, useState } from 'react';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { normalizeGlobalShortcutAccelerator } from '../services/tauri/globalShortcutUtils';

export const GLOBAL_SHORTCUT_REGISTER_ERROR_EVENT = 'mypartnerai:global-shortcut-register-error';

let lastGlobalShortcutRegisterError: string | null = null;

interface UseGlobalVoiceShortcutOptions {
  enabled: boolean;
  accelerator: string;
  onTrigger: () => void;
}

interface UseGlobalVoiceShortcutResult {
  registerError: string | null;
}

function emitGlobalShortcutRegisterError(error: string | null): void {
  lastGlobalShortcutRegisterError = error;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<string | null>(GLOBAL_SHORTCUT_REGISTER_ERROR_EVENT, {
      detail: error,
    })
  );
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
  return `Failed to register global shortcut (${accelerator}). It may be in use by another app or blocked by system privacy settings. ${detail}`;
}

export function getLastGlobalShortcutRegisterError(): string | null {
  return lastGlobalShortcutRegisterError;
}

export function useGlobalVoiceShortcut({
  enabled,
  accelerator,
  onTrigger,
}: UseGlobalVoiceShortcutOptions): UseGlobalVoiceShortcutResult {
  const [registerError, setRegisterError] = useState<string | null>(null);
  const registeredShortcutRef = useRef<string | null>(null);
  const onTriggerRef = useRef(onTrigger);
  const effectRunRef = useRef(0);

  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  useEffect(() => {
    if (!isTauriDesktopRuntime()) {
      setRegisterError(null);
      emitGlobalShortcutRegisterError(null);
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
        setRegisterError(null);
        emitGlobalShortcutRegisterError(null);
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
        setRegisterError(null);
        emitGlobalShortcutRegisterError(null);
      } catch (error) {
        if (runId !== effectRunRef.current) return;
        const message = normalizeRegisterError(error, normalizedAccelerator);
        setRegisterError(message);
        emitGlobalShortcutRegisterError(message);
      }
    };

    void applyShortcut();

    return () => {
      effectRunRef.current += 1;
      void unregisterShortcut(registeredShortcutRef.current);
    };
  }, [accelerator, enabled]);

  return { registerError };
}

export default useGlobalVoiceShortcut;
