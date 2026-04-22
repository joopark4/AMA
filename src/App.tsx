import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import AvatarCanvas from './components/avatar/AvatarCanvas';
import SpeechBubble from './components/ui/SpeechBubble';
import ControlCluster from './components/ui/ControlCluster';
import SettingsPanel from './components/ui/SettingsPanel';
import HistoryPanel from './components/ui/HistoryPanel';
import LightingControl from './components/avatar/LightingControl';
import ErrorBoundary from './components/ui/ErrorBoundary';
import ModelDownloadModal from './components/ui/ModelDownloadModal';
import UpdateNotification from './components/ui/UpdateNotification';
import AboutModal from './components/ui/AboutModal';
import { useSettingsStore } from './stores/settingsStore';
import { useConversationStore } from './stores/conversationStore';
import { useAuthStore } from './stores/authStore';
import { useModelDownloadStore } from './stores/modelDownloadStore';
import { useClickThrough } from './hooks/useClickThrough';
import { useMenuListeners } from './hooks/useMenuListeners';
import { useMonitorStore } from './stores/monitorStore';
import { useAboutStore } from './stores/aboutStore';
import { useMcpSpeakListener } from './features/channels';
import { useScreenWatcher } from './features/screen-watch';
import { CODEX_PROVIDER } from './features/codex';
import { ollamaClient } from './services/ai/ollamaClient';
import { localAiClient } from './services/ai/localAiClient';
import { authService } from './services/auth/authService';

function App() {
  const { i18n, t } = useTranslation();
  const { settings, isSettingsOpen, isHistoryOpen, setLLMSettings, setAvatarName } = useSettingsStore();
  const { currentResponse } = useConversationStore();
  const {
    pendingProvider,
    setUser,
    setTokens,
    setLoading,
    setError,
    setPendingProvider,
  } = useAuthStore();
  const [initialAvatarName, setInitialAvatarName] = useState('');
  const { isOpen: isAboutOpen, close: closeAbout } = useAboutStore();
  const { status: modelStatus, isChecking: isCheckingModels, checkModelStatus } = useModelDownloadStore();

  // Enable click-through for transparent window (except on interactive elements)
  useClickThrough();

  // MCP 채널 speak 이벤트 리스너
  useMcpSpeakListener();

  // Screen Watch 주기 관찰 루프
  useScreenWatcher();

  // Codex app-server 연결 관리 (provider 전환 또는 작업 폴더 변경 시 재시작)
  useEffect(() => {
    if (settings.llm.provider === CODEX_PROVIDER) {
      // 작업 폴더 변경 시 기존 프로세스 종료 후 재시작
      invoke('codex_stop').catch(() => {}).then(() => {
        invoke('codex_start', {
          workingDir: settings.codex.workingDir || null,
        }).catch(() => {});
      });
    } else {
      invoke('codex_stop').catch(() => {});
    }
  }, [settings.llm.provider, settings.codex.workingDir]);

  // macOS 네이티브 메뉴 이벤트 리스너
  useMenuListeners();

  useEffect(() => {
    i18n.changeLanguage(settings.language);
  }, [settings.language, i18n]);

  useEffect(() => {
    if (settings.avatarName && initialAvatarName === '') {
      setInitialAvatarName(settings.avatarName);
    }
  }, [settings.avatarName, initialAvatarName]);

  // Deep-link OAuth 콜백 처리 (인증 기능 미완성 — 개발 환경에서만 활성화)
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    let unlisten: (() => void) | undefined;

    onOpenUrl(async (urls) => {
      const callbackUrl = urls.find((u) => u.includes('auth/callback'));
      if (!callbackUrl) return;

      try {
        const params: { code?: string; state?: string; error?: string } =
          await invoke('parse_auth_callback', { url: callbackUrl });

        if (params.error) {
          setError(t('auth.errors.cancelled'));
          setLoading(false);
          return;
        }

        if (!params.code) {
          setError(t('auth.errors.failed'));
          setLoading(false);
          return;
        }

        if (!pendingProvider) {
          setLoading(false);
          return;
        }

        const result = await authService.handleCallback(params.code, params.state ?? '', '');

        setUser(result.user);
        setTokens(result.tokens);

        // OAuth 닉네임을 아바타 이름 초기값으로 연동
        if (result.user.nickname && !(settings.avatarName || '').trim()) {
          setAvatarName(result.user.nickname);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(t('auth.errors.networkError') + ': ' + message);
      } finally {
        setLoading(false);
        setPendingProvider(null);
      }
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingProvider]);

  // Check model download status on startup (production only)
  useEffect(() => {
    if (import.meta.env.DEV) return;
    checkModelStatus().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dev mode: F12 to open devtools
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        const win = getCurrentWebviewWindow() as any;
        win.openDevtools?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Restore preferred monitor on startup
  useEffect(() => {
    const restore = async () => {
      const store = useMonitorStore.getState();
      await store.fetchMonitors();
      const preferred = settings.preferredMonitorName;
      if (!preferred) return;
      const { monitors } = useMonitorStore.getState();
      const idx = monitors.findIndex((m) => m.name === preferred);
      if (idx >= 0) await store.moveToMonitor(idx);
    };
    restore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-detect and set available Ollama model on startup
  useEffect(() => {
    if (settings.llm.provider !== 'ollama' && settings.llm.provider !== 'localai') {
      return;
    }

    const loadModels = async () => {
      const models =
        settings.llm.provider === 'localai'
          ? await localAiClient.getAvailableModels()
          : await ollamaClient.getAvailableModels();

      if (models.length > 0 && !models.includes(settings.llm.model)) {
        console.log('[App] Current model not available, switching to:', models[0]);
        setLLMSettings({ model: models[0] });
      }
    };

    loadModels().catch(() => {});
  }, [settings.llm.provider, settings.llm.endpoint, settings.llm.model, setLLMSettings]);


  const isDevBuild = Boolean((import.meta as any)?.env?.DEV);
  const requiresModelDownload =
    !isDevBuild &&
    !isCheckingModels &&
    modelStatus !== null &&
    (!modelStatus.supertonicReady || !modelStatus.whisperBaseReady);
  const requiresAvatarNameSetup =
    !requiresModelDownload && !isDevBuild && !(settings.avatarName || '').trim();

  const avatarHidden = settings.avatarHidden;

  return (
    <div className="w-full h-full relative">
      {/* Main 3D Avatar Canvas + Lighting + SpeechBubble — avatarHidden 시 모두 unmount */}
      {!avatarHidden && (
        <>
          <ErrorBoundary name="AvatarCanvas">
            <AvatarCanvas />
          </ErrorBoundary>

          <ErrorBoundary name="LightingControl">
            <LightingControl />
          </ErrorBoundary>

          {currentResponse && settings.avatar?.showSpeechBubble !== false && (
            <ErrorBoundary name="SpeechBubble">
              <SpeechBubble message={currentResponse} />
            </ErrorBoundary>
          )}
        </>
      )}

      {/* (이전: 화면 중앙 AvatarRestingBadge)
          → ControlCluster 안 메뉴바 위 슬롯으로 이동. */}

      {/* Control Cluster (v2 리디자인) - status pill + 입력/음성/기록/숨김/설정 */}
      <ErrorBoundary name="ControlCluster">
        <ControlCluster />
      </ErrorBoundary>

      {/* Settings Panel - slide-in panel */}
      {isSettingsOpen && (
        <ErrorBoundary name="SettingsPanel">
          <SettingsPanel />
        </ErrorBoundary>
      )}

      {/* History Panel - draggable chat history */}
      {isHistoryOpen && (
        <ErrorBoundary name="HistoryPanel">
          <HistoryPanel />
        </ErrorBoundary>
      )}

      {/* Auto-update notification */}
      <ErrorBoundary name="UpdateNotification">
        <UpdateNotification />
      </ErrorBoundary>

      {/* About modal */}
      <AboutModal isOpen={isAboutOpen} onClose={closeAbout} />

      {/* Model download modal (shown before onboarding) */}
      {requiresModelDownload && (
        <ErrorBoundary name="ModelDownloadModal">
          <ModelDownloadModal />
        </ErrorBoundary>
      )}

      {/* First-run avatar name setup for production builds (v2 글래시 톤) */}
      {requiresAvatarNameSetup && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center px-4"
          data-interactive="true"
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'oklch(0.2 0 0 / 0.55)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />
          <div
            className="glass-strong relative w-full max-w-md"
            style={{
              padding: 24,
              borderRadius: 'var(--r-lg)',
              animation: 'scaleIn 280ms var(--ease)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
            data-interactive="true"
          >
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em',
                }}
              >
                {t('onboarding.avatarNameTitle', '아바타 이름 설정')}
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--ink-2)',
                  marginTop: 4,
                  lineHeight: 1.55,
                }}
              >
                {t('onboarding.avatarNameDescription', '첫 실행입니다. 사용할 아바타 이름을 입력해 주세요.')}
              </p>
            </div>
            <input
              type="text"
              value={initialAvatarName}
              onChange={(e) => setInitialAvatarName(e.target.value)}
              maxLength={40}
              placeholder={t('settings.avatar.namePlaceholder', '예: 은연')}
              className="focus-ring w-full"
              style={{
                padding: '10px 14px',
                fontSize: 14,
                borderRadius: 12,
                border: 0,
                background: 'oklch(1 0 0 / 0.7)',
                boxShadow: 'inset 0 0 0 1px var(--hairline)',
                color: 'var(--ink)',
                outline: 'none',
              }}
              data-interactive="true"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && initialAvatarName.trim()) {
                  setAvatarName(initialAvatarName);
                }
              }}
            />
            <button
              type="button"
              onClick={() => setAvatarName(initialAvatarName)}
              disabled={!initialAvatarName.trim()}
              className="w-full focus-ring"
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                background: !initialAvatarName.trim()
                  ? 'oklch(0.85 0.005 60)'
                  : 'var(--accent)',
                color: !initialAvatarName.trim() ? 'var(--ink-3)' : 'white',
                fontSize: 13.5,
                fontWeight: 500,
                cursor: !initialAvatarName.trim() ? 'not-allowed' : 'pointer',
                transition: 'background 200ms var(--ease)',
              }}
              data-interactive="true"
            >
              {t('onboarding.confirmAvatarName', '이름 저장')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
