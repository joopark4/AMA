/**
 * Codex 연결 관리 훅
 *
 * provider가 'codex'일 때 app-server 프로세스를 시작하고,
 * 다른 provider로 전환 시 또는 언마운트 시 정리한다.
 *
 * [P0 fixes]
 * - listen() 레이스 컨디션: cancelled 플래그로 즉시 해제
 * - 언마운트 시 codex_stop 호출
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useSettingsStore } from '../../stores/settingsStore';
import { CODEX_PROVIDER } from './constants';

export type CodexConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface StatusEvent {
  status: string;
  message: string | null;
}

export function useCodexConnection() {
  const provider = useSettingsStore((s) => s.settings.llm.provider);
  const [connectionState, setConnectionState] = useState<CodexConnectionState>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const providerRef = useRef(provider);
  providerRef.current = provider;

  // [P0-3 fix] 상태 이벤트 리스너 — cancelled 플래그로 레이스 컨디션 방지
  useEffect(() => {
    let cancelled = false;
    let unlisten: UnlistenFn | null = null;

    listen<StatusEvent>('codex-status', (event) => {
      if (cancelled) return;
      const { status, message } = event.payload;
      switch (status) {
        case 'connecting':
          setConnectionState('connecting');
          setErrorMessage(null);
          break;
        case 'connected':
          setConnectionState('connected');
          setErrorMessage(null);
          break;
        case 'disconnected':
          setConnectionState('disconnected');
          break;
        case 'error':
          setConnectionState('error');
          setErrorMessage(message);
          break;
      }
    }).then((fn) => {
      if (cancelled) {
        fn(); // 이미 언마운트됨 — 즉시 해제
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // [P0-4 fix] provider 전환 시 연결/해제 + 언마운트 시 정리
  useEffect(() => {
    if (provider === CODEX_PROVIDER) {
      invoke('codex_start').catch((err) => {
        setConnectionState('error');
        setErrorMessage(String(err));
      });
    } else {
      invoke('codex_stop').catch(() => {});
      setConnectionState('disconnected');
    }

    return () => {
      // 언마운트 시 현재 provider가 codex면 정리
      if (providerRef.current === CODEX_PROVIDER) {
        invoke('codex_stop').catch(() => {});
      }
    };
  }, [provider]);

  // 초기 상태 조회
  useEffect(() => {
    invoke<{ installed: boolean }>('codex_check_installed')
      .then((r) => setInstalled(r.installed))
      .catch(() => setInstalled(false));
    invoke<{ authenticated: boolean }>('codex_check_auth')
      .then((r) => setAuthenticated(r.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await invoke<{
        connected: boolean;
        installed: boolean;
        authenticated: boolean;
      }>('codex_get_status');
      setInstalled(status.installed);
      setAuthenticated(status.authenticated);
      if (status.connected) {
        setConnectionState('connected');
      }
    } catch {
      // 무시
    }
  }, []);

  const reconnect = useCallback(async () => {
    try {
      await invoke('codex_stop');
      await invoke('codex_start');
    } catch (err) {
      setConnectionState('error');
      setErrorMessage(String(err));
    }
  }, []);

  return {
    connectionState,
    errorMessage,
    installed,
    authenticated,
    refreshStatus,
    reconnect,
  };
}
