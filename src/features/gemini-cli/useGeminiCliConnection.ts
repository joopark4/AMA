/**
 * Gemini CLI(ACP) 연결 관리 훅 — Codex 훅과 동일 패턴.
 *
 * provider가 `gemini_cli`일 때 `gemini --experimental-acp` 프로세스를 시작·관리하고,
 * 설정 UI에서 설치/인증/연결 상태를 사용자에게 노출할 수 있도록 훅으로 추상화한다.
 */

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useSettingsStore } from '../../stores/settingsStore';
import { GEMINI_CLI_PROVIDER } from './constants';

export type GeminiCliConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

interface StatusEvent {
  status: string;
  message: string | null;
}

export function useGeminiCliConnection() {
  const provider = useSettingsStore((s) => s.settings.llm.provider);
  const workingDir = useSettingsStore((s) => s.settings.geminiCli.workingDir);

  const [connectionState, setConnectionState] =
    useState<GeminiCliConnectionState>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  // 상태 이벤트 리스너 — 레이스 컨디션 방지 위해 cancelled 플래그 + 즉시 해제.
  useEffect(() => {
    let cancelled = false;
    let unlisten: UnlistenFn | null = null;

    listen<StatusEvent>('gemini-cli-status', (event) => {
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
        // "generating"/"idle"은 연결 상태에 영향을 주지 않음.
        default:
          break;
      }
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // provider가 다른 값으로 바뀌면 상태 초기화 (실 연결/중지는 App 레벨에서 관리 예정).
  useEffect(() => {
    if (provider !== GEMINI_CLI_PROVIDER) {
      setConnectionState('disconnected');
    }
  }, [provider]);

  // 마운트 시 현재 연결/설치/인증 상태 즉시 조회.
  useEffect(() => {
    invoke<{ connected: boolean }>('gemini_cli_get_status')
      .then((r) => {
        if (r.connected) setConnectionState('connected');
      })
      .catch(() => {});
    invoke<{ installed: boolean }>('gemini_cli_check_installed')
      .then((r) => setInstalled(r.installed))
      .catch(() => setInstalled(false));
    invoke<{ authenticated: boolean }>('gemini_cli_check_auth')
      .then((r) => setAuthenticated(r.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const [installResult, authResult, statusResult] = await Promise.all([
        invoke<{ installed: boolean }>('gemini_cli_check_installed'),
        invoke<{ authenticated: boolean }>('gemini_cli_check_auth'),
        invoke<{ connected: boolean }>('gemini_cli_get_status'),
      ]);
      setInstalled(installResult.installed);
      setAuthenticated(authResult.authenticated);
      if (statusResult.connected) {
        setConnectionState('connected');
      }
    } catch {
      // 무시
    }
  }, []);

  const reconnect = useCallback(async () => {
    try {
      await invoke('gemini_cli_stop');
      await invoke('gemini_cli_start', {
        workingDir: workingDir || null,
      });
    } catch (err) {
      setConnectionState('error');
      setErrorMessage(String(err));
    }
  }, [workingDir]);

  return {
    connectionState,
    errorMessage,
    installed,
    authenticated,
    refreshStatus,
    reconnect,
  };
}
