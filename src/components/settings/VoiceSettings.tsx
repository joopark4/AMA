/**
 * VoiceSettings - STT/TTS 엔진 및 모델 설정 컴포넌트
 */
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  buildGlobalShortcutFromKeyboardEvent,
  DEFAULT_GLOBAL_SHORTCUT_ACCELERATOR,
  formatGlobalShortcutForDisplay,
} from '../../services/tauri/globalShortcutUtils';
import { useAppStatusStore } from '../../stores/appStatusStore';
import { useModelDownloadStore } from '../../stores/modelDownloadStore';

// Whisper 모델 목록 (배포 기본 포함 모델)
const WHISPER_MODELS = [
  'base',
  'small',
  'medium',
];

// 모델별 크기 정보
const WHISPER_MODEL_SIZE: Record<string, string> = {
  base: '~75 MB',
  small: '~500 MB',
  medium: '~1.5 GB',
};

// Supertonic 음성 목록
const SUPERTONIC_VOICES = {
  F1: '여성 1',
  F2: '여성 2',
  F3: '여성 3',
  F4: '여성 4',
  F5: '여성 5',
  M1: '남성 1',
  M2: '남성 2',
  M3: '남성 3',
  M4: '남성 4',
  M5: '남성 5',
};
const SUPERTONIC_VOICE_KEYS = Object.keys(SUPERTONIC_VOICES);

export default function VoiceSettings() {
  const { t } = useTranslation();
  const {
    settings,
    setSTTSettings,
    setTTSSettings,
    setGlobalShortcutSettings,
  } = useSettingsStore();
  const {
    status: modelStatus,
    isDownloading,
    currentModel,
    progress: downloadProgress,
    downloadModel,
    checkModelStatus,
  } = useModelDownloadStore();
  const [isCapturingShortcut, setIsCapturingShortcut] = useState(false);
  const [shortcutInputError, setShortcutInputError] = useState<string | null>(null);
  const shortcutRegisterError = useAppStatusStore(
    (state) => state.globalShortcutRegisterError
  );
  const globalShortcutSettings = settings.globalShortcut ?? {
    enabled: true,
    accelerator: DEFAULT_GLOBAL_SHORTCUT_ACCELERATOR,
  };
  const shortcutDisplayValue = useMemo(
    () => formatGlobalShortcutForDisplay(globalShortcutSettings.accelerator),
    [globalShortcutSettings.accelerator]
  );

  // 모델 상태 미확인 시 마운트 시점에 체크
  useEffect(() => {
    if (!modelStatus) {
      checkModelStatus().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 항상 whisper 엔진 사용, 유효하지 않은 모델은 base로 리셋
  useEffect(() => {
    if (settings.stt.engine !== 'whisper' || !WHISPER_MODELS.includes(settings.stt.model)) {
      setSTTSettings({ engine: 'whisper', model: 'base' });
    }
    // 로컬 TTS(supertonic) 사용 시 voice 값 정규화
    // supertone_api 사용 중이면 건드리지 않음
    if (
      settings.tts.engine === 'supertonic' &&
      !SUPERTONIC_VOICE_KEYS.includes(settings.tts.voice || '')
    ) {
      setTTSSettings({ voice: 'F1' });
    }
  }, []);

  const handleShortcutKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Tab') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const shortcut = buildGlobalShortcutFromKeyboardEvent(event);
    if (!shortcut) {
      setShortcutInputError(t('settings.voice.globalShortcut.validation'));
      return;
    }

    setShortcutInputError(null);
    setGlobalShortcutSettings({
      enabled: true,
      accelerator: shortcut,
    });
  };

  return (
    <div className="space-y-6">
      {/* STT Settings - Whisper */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700">
          {t('settings.voice.stt.title')}
        </h4>

        {/* STT Engine Info - Whisper */}
        <div className="flex items-center gap-2 text-xs mb-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
            Whisper
          </span>
          <span className="text-gray-500">{t('settings.voice.stt.whisperInfo')}</span>
        </div>

        {/* Whisper Model */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-600">
            {t('settings.voice.stt.model')}
          </label>
          <div className="space-y-2">
            {WHISPER_MODELS.map((model) => {
              const statusKey = `whisper${model.charAt(0).toUpperCase() + model.slice(1)}Ready` as keyof typeof modelStatus;
              const isReady = modelStatus?.[statusKey] ?? true;
              const isThisDownloading = isDownloading && currentModel === `whisper-${model}`;
              const isSelected = settings.stt.model === model;
              const modelSize = WHISPER_MODEL_SIZE[model] ?? '';

              // 다운로드 진행률 계산
              const thisProgress =
                isThisDownloading && downloadProgress && downloadProgress.totalBytes > 0
                  ? Math.round((downloadProgress.downloadedBytes / downloadProgress.totalBytes) * 100)
                  : 0;

              const handleSelectModel = () => {
                setSTTSettings({ model });
                if (!isReady && !isDownloading) {
                  downloadModel(`whisper-${model}`);
                }
              };

              return (
                <button
                  key={model}
                  type="button"
                  onClick={handleSelectModel}
                  disabled={isThisDownloading}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${isThisDownloading ? 'cursor-wait' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                        {model}
                      </span>
                      <span className="text-xs text-gray-400">{modelSize}</span>
                      {isSelected && isReady && (
                        <span className="text-xs text-blue-600">&#10003;</span>
                      )}
                    </div>
                    <div>
                      {isReady && (
                        <span className="text-xs text-green-600">
                          {t('modelDownload.ready')}
                        </span>
                      )}
                      {!isReady && !isThisDownloading && (
                        <span className="text-xs text-gray-400">
                          {t('modelDownload.notDownloaded')}
                        </span>
                      )}
                      {isThisDownloading && (
                        <span className="text-xs text-blue-600">
                          {thisProgress > 0 ? `${thisProgress}%` : t('modelDownload.downloading')}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Download progress bar */}
                  {isThisDownloading && (
                    <div className="mt-2 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${thisProgress}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TTS Settings - Supertonic Only */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700">
          {t('settings.voice.tts.title')}
        </h4>

        {/* TTS Engine Info */}
        <div className="flex items-center gap-2 text-xs mb-3">
          {settings.tts.engine === 'supertone_api' ? (
            <>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                Supertone API
              </span>
              <span className="text-purple-600">
                {settings.tts.supertoneApi?.voiceName
                  ? `${settings.tts.supertoneApi.voiceName} (${t('settings.premium.badge')})`
                  : t('settings.premium.badge')}
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                Supertonic
              </span>
              <span className="text-gray-500">{t('settings.voice.tts.supertonicInfo')}</span>
            </>
          )}
        </div>

        {/* Supertonic Voice Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-600">
            음성 선택
          </label>
          <select
            value={settings.tts.voice || 'F1'}
            onChange={(e) => setTTSSettings({ voice: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <optgroup label="여성">
              {Object.entries(SUPERTONIC_VOICES)
                .filter(([key]) => key.startsWith('F'))
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label} ({key})
                  </option>
                ))}
            </optgroup>
            <optgroup label="남성">
              {Object.entries(SUPERTONIC_VOICES)
                .filter(([key]) => key.startsWith('M'))
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label} ({key})
                  </option>
                ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* Global Shortcut */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700">
          {t('settings.voice.globalShortcut.title')}
        </h4>

        <p className="text-xs text-gray-500">
          {t('settings.voice.globalShortcut.description')}
        </p>

        <label className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-gray-600">
            {t('settings.voice.globalShortcut.enabled')}
          </span>
          <input
            type="checkbox"
            checked={globalShortcutSettings.enabled}
            onChange={(event) =>
              setGlobalShortcutSettings({ enabled: event.target.checked })
            }
            className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </label>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-600">
            {t('settings.voice.globalShortcut.shortcutLabel')}
          </label>
          <input
            type="text"
            readOnly
            value={shortcutDisplayValue}
            onFocus={() => setIsCapturingShortcut(true)}
            onBlur={() => setIsCapturingShortcut(false)}
            onKeyDown={handleShortcutKeyDown}
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isCapturingShortcut ? 'border-blue-500' : 'border-gray-300'
            }`}
            aria-label={t('settings.voice.globalShortcut.shortcutLabel')}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              {isCapturingShortcut
                ? t('settings.voice.globalShortcut.captureHint')
                : t('settings.voice.globalShortcut.shortcutHint')}
            </p>
            <button
              type="button"
              onClick={() => {
                setShortcutInputError(null);
                setGlobalShortcutSettings({
                  enabled: true,
                  accelerator: DEFAULT_GLOBAL_SHORTCUT_ACCELERATOR,
                });
              }}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {t('settings.voice.globalShortcut.restoreDefault')}
            </button>
          </div>
        </div>

        {shortcutInputError && (
          <p className="text-xs text-red-600">{shortcutInputError}</p>
        )}
        {!shortcutInputError && globalShortcutSettings.enabled && shortcutRegisterError && (
          <p className="text-xs text-amber-700">
            {t('settings.voice.globalShortcut.registerErrorInline', {
              error: shortcutRegisterError,
            })}
          </p>
        )}
      </div>
    </div>
  );
}
