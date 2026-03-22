import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import AvatarCanvas from './components/avatar/AvatarCanvas';
import SpeechBubble from './components/ui/SpeechBubble';
import StatusIndicator from './components/ui/StatusIndicator';
import SettingsPanel from './components/ui/SettingsPanel';
import HistoryPanel from './components/ui/HistoryPanel';
import LightingControl from './components/avatar/LightingControl';
import ErrorBoundary from './components/ui/ErrorBoundary';
import ModelDownloadModal from './components/ui/ModelDownloadModal';
import UpdateNotification from './components/ui/UpdateNotification';
import AboutModal from './components/ui/AboutModal';
import { useSettingsStore } from './stores/settingsStore';
import { useConversationStore } from './stores/conversationStore';
import { useModelDownloadStore } from './stores/modelDownloadStore';
import { useClickThrough } from './hooks/useClickThrough';
import { useMenuListeners } from './hooks/useMenuListeners';
import { useMonitorStore } from './stores/monitorStore';
import { useAboutStore } from './stores/aboutStore';
import { useMcpSpeakListener } from './features/channels';
import { ollamaClient } from './services/ai/ollamaClient';
import { localAiClient } from './services/ai/localAiClient';

function App() {
  const { i18n, t } = useTranslation();
  const { settings, isSettingsOpen, isHistoryOpen, setLLMSettings, setAvatarName } = useSettingsStore();
  const { currentResponse, isProcessing } = useConversationStore();
  const [initialAvatarName, setInitialAvatarName] = useState('');
  const { isOpen: isAboutOpen, close: closeAbout } = useAboutStore();
  const { status: modelStatus, isChecking: isCheckingModels, checkModelStatus } = useModelDownloadStore();

  // Enable click-through for transparent window (except on interactive elements)
  useClickThrough();

  // MCP 채널 speak 이벤트 리스너
  useMcpSpeakListener();

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

  return (
    <div className="w-full h-full relative">
      {/* Main 3D Avatar Canvas - includes 3D model drag support */}
      <ErrorBoundary name="AvatarCanvas">
        <AvatarCanvas />
      </ErrorBoundary>

      {/* Lighting Control - draggable sun emoji */}
      <ErrorBoundary name="LightingControl">
        <LightingControl />
      </ErrorBoundary>

      {/* Speech Bubble - shows AI responses */}
      {currentResponse && settings.avatar?.showSpeechBubble !== false && (
        <ErrorBoundary name="SpeechBubble">
          <SpeechBubble message={currentResponse} />
        </ErrorBoundary>
      )}

      {/* Status Indicator - shows listening/processing state */}
      <ErrorBoundary name="StatusIndicator">
        <StatusIndicator isProcessing={isProcessing} />
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

      {/* First-run avatar name setup for production builds */}
      {requiresAvatarNameSetup && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center px-4" data-interactive="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">
              {t('onboarding.avatarNameTitle', '아바타 이름 설정')}
            </h2>
            <p className="text-sm text-gray-600">
              {t('onboarding.avatarNameDescription', '첫 실행입니다. 사용할 아바타 이름을 입력해 주세요.')}
            </p>
            <input
              type="text"
              value={initialAvatarName}
              onChange={(e) => setInitialAvatarName(e.target.value)}
              maxLength={40}
              placeholder={t('settings.avatar.namePlaceholder', '예: 은연')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={() => setAvatarName(initialAvatarName)}
              disabled={!initialAvatarName.trim()}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
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
