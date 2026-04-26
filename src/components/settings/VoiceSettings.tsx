/**
 * VoiceSettings — STT(Whisper) · TTS(Supertonic) · TTS 테스트 · 글로벌 단축키
 * v2 리디자인: forms 프리미티브(Pill/Toggle) + 글래시 톤.
 */
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Square } from 'lucide-react';
import { useSettingsStore, type TTSOutputLanguage } from '../../stores/settingsStore';
import {
  buildGlobalShortcutFromKeyboardEvent,
  DEFAULT_GLOBAL_SHORTCUT_ACCELERATOR,
  formatGlobalShortcutForDisplay,
} from '../../services/tauri/globalShortcutUtils';
import { useAppStatusStore } from '../../stores/appStatusStore';
import { useModelDownloadStore } from '../../stores/modelDownloadStore';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { resolveResponseLanguage } from '../../hooks/useConversation';
import type { PromptLanguage } from '../../services/character';
import { Field, FormCard, Pill, Row, SectionHint, Toggle } from './forms';

const WHISPER_MODELS = ['base', 'small', 'medium'] as const;

const WHISPER_MODEL_SIZE: Record<string, string> = {
  base: '~75 MB',
  small: '~500 MB',
  medium: '~1.5 GB',
};

/**
 * Supertonic voice ID 목록.
 * 라벨은 i18n 키 + 번호 보간 조합으로 동적 생성 (getSupertonicVoiceLabel).
 */
const SUPERTONIC_VOICE_KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5'];

/** TTS 출력 언어 옵션 (로컬/프리미엄 공용). */
const TTS_LANGUAGE_OPTIONS: { value: TTSOutputLanguage; label: string }[] = [
  { value: 'auto', label: '' }, // label은 런타임에 t() 주입
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'es', label: 'Español' },
  { value: 'pt', label: 'Português' },
  { value: 'fr', label: 'Français' },
];

/** Supertonic(로컬 TTS)이 지원하는 언어 — 이 외는 `en`으로 폴백된다. */
const SUPERTONIC_SUPPORTED_LANGUAGES = new Set<TTSOutputLanguage>(['ko', 'en', 'es', 'pt', 'fr']);

/**
 * TTS 테스트용 샘플 문장 — 핵심 6개 언어별 네이티브. 그 외(it/zh 등 supertone API
 * 언어)는 resolveResponseLanguage()가 supertonic 미지원이면 'en'으로 폴백해주므로
 * 로컬 측에선 도달하지 않지만, supertone_api에서 it/zh 등을 선택했을 때는 등록되지
 * 않은 키가 들어올 수 있다. 그 경우 영어 샘플을 폴백으로 사용한다.
 */
const TTS_SAMPLE_BY_LANGUAGE: Partial<Record<string, (name: string) => string>> = {
  ko: (name) => `안녕하세요! 저는 ${name}이에요. 음성 테스트 중입니다.`,
  en: (name) => `Hello! I'm ${name}. This is a voice test.`,
  ja: (name) => `こんにちは!私は${name}です。音声テストをしています。`,
  es: (name) => `¡Hola! Soy ${name}. Esta es una prueba de voz.`,
  pt: (name) => `Olá! Eu sou ${name}. Este é um teste de voz.`,
  fr: (name) => `Bonjour ! Je suis ${name}. Ceci est un test vocal.`,
};

/** 아바타 이름 미설정 시 사용할 언어별 기본값. 미등록 언어는 `Avatar` 폴백. */
const DEFAULT_AVATAR_NAME_BY_LANGUAGE: Partial<Record<string, string>> = {
  ko: '아바타',
  en: 'Avatar',
  ja: 'アバター',
  es: 'Avatar',
  pt: 'Avatar',
  fr: 'Avatar',
};

function getSupertonicVoiceLabel(t: ReturnType<typeof useTranslation>['t'], key: string): string {
  const isFemale = key.startsWith('F');
  const num = key.slice(1);
  return t(
    isFemale ? 'settings.voice.tts.voiceLabel.female' : 'settings.voice.tts.voiceLabel.male',
    { num }
  );
}

/** STT/TTS 그룹 헤더 — 14px ink, 살짝 강조 */
function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--ink)',
        letterSpacing: '-0.01em',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

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
  const { speak, isSpeaking, stop, error: ttsError } = useSpeechSynthesis();
  // TTS 테스트 샘플은 **현재 엔진 + TTS 언어 조합**에 맞춰 생성 —
  // resolveResponseLanguage()가 supertonic + 미지원 언어(ja 등)를 en으로 폴백해주므로
  // 실제 재생되는 음성과 일치하는 언어로 발음된다.
  const ttsLanguageForSample = useMemo<PromptLanguage>(
    () => resolveResponseLanguage(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.tts.engine, settings.tts.language, settings.language]
  );
  const avatarName =
    settings.avatarName?.trim()
    || DEFAULT_AVATAR_NAME_BY_LANGUAGE[ttsLanguageForSample]
    || 'Avatar';
  const ttsSampleBuilder =
    TTS_SAMPLE_BY_LANGUAGE[ttsLanguageForSample] ?? TTS_SAMPLE_BY_LANGUAGE.en!;
  const ttsSample = ttsSampleBuilder(avatarName);
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

  useEffect(() => {
    if (!modelStatus) {
      checkModelStatus().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (settings.stt.engine !== 'whisper' || !(WHISPER_MODELS as readonly string[]).includes(settings.stt.model)) {
      setSTTSettings({ engine: 'whisper', model: 'base' });
    }
    if (
      settings.tts.engine === 'supertonic' &&
      !SUPERTONIC_VOICE_KEYS.includes(settings.tts.voice || '')
    ) {
      setTTSSettings({ voice: 'F1' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShortcutKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Tab') return;
    event.preventDefault();
    event.stopPropagation();
    const shortcut = buildGlobalShortcutFromKeyboardEvent(event);
    if (!shortcut) {
      setShortcutInputError(t('settings.voice.globalShortcut.validation'));
      return;
    }
    setShortcutInputError(null);
    setGlobalShortcutSettings({ enabled: true, accelerator: shortcut });
  };

  // 현재 STT 모델의 다운로드 상태 메타
  const currentSttStatus = (() => {
    const model = settings.stt.model;
    const statusKey = `whisper${model.charAt(0).toUpperCase() + model.slice(1)}Ready` as keyof typeof modelStatus;
    const isReady = modelStatus?.[statusKey] ?? true;
    const isThisDownloading = isDownloading && currentModel === `whisper-${model}`;
    const progress =
      isThisDownloading && downloadProgress && downloadProgress.totalBytes > 0
        ? Math.round((downloadProgress.downloadedBytes / downloadProgress.totalBytes) * 100)
        : 0;
    return { model, isReady, isThisDownloading, progress };
  })();

  return (
    <div>
      {/* STT */}
      <Field label={<GroupTitle>{t('settings.voice.stt.title')}</GroupTitle>}>
        <SectionHint>{t('settings.voice.stt.whisperInfo')}</SectionHint>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {WHISPER_MODELS.map((model) => {
            const statusKey = `whisper${model.charAt(0).toUpperCase() + model.slice(1)}Ready` as keyof typeof modelStatus;
            const isReady = modelStatus?.[statusKey] ?? true;
            const isThisDownloading = isDownloading && currentModel === `whisper-${model}`;
            return (
              <Pill
                key={model}
                active={settings.stt.model === model}
                disabled={isThisDownloading}
                onClick={() => {
                  setSTTSettings({ model });
                  if (!isReady && !isDownloading) {
                    downloadModel(`whisper-${model}`);
                  }
                }}
                title={WHISPER_MODEL_SIZE[model]}
              >
                {model} · {WHISPER_MODEL_SIZE[model]}
                {!isReady && !isThisDownloading && ' ↓'}
              </Pill>
            );
          })}
        </div>

        {/* 현재 STT 모델 상태 / 다운로드 진행률 */}
        <div
          style={{
            marginTop: 8,
            fontSize: 11.5,
            color: 'var(--ink-3)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {currentSttStatus.isThisDownloading ? (
            <>
              <span>
                {t('modelDownload.downloading')} · {currentSttStatus.progress}%
              </span>
              <div
                className="flex-1 overflow-hidden"
                style={{
                  height: 4,
                  borderRadius: 99,
                  background: 'oklch(0.85 0.005 60)',
                }}
              >
                <div
                  style={{
                    width: `${currentSttStatus.progress}%`,
                    height: '100%',
                    background: 'var(--accent)',
                    transition: 'width 220ms var(--ease)',
                  }}
                />
              </div>
            </>
          ) : currentSttStatus.isReady ? (
            <span>{t('modelDownload.ready')}</span>
          ) : (
            <span>{t('modelDownload.notDownloaded')}</span>
          )}
        </div>
      </Field>

      {/* TTS */}
      <Field
        label={<GroupTitle>{t('settings.voice.tts.title')}</GroupTitle>}
        hint={
          settings.tts.engine === 'supertone_api'
            ? t('settings.premium.badge')
            : 'Supertonic'
        }
      >
        <SectionHint>
          {settings.tts.engine === 'supertone_api'
            ? settings.tts.supertoneApi?.voiceName
            : t('settings.voice.tts.supertonicInfo')}
        </SectionHint>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {SUPERTONIC_VOICE_KEYS.map((voice) => (
            <Pill
              key={voice}
              active={(settings.tts.voice || 'F1') === voice}
              onClick={() => setTTSSettings({ voice })}
              title={getSupertonicVoiceLabel(t, voice)}
            >
              {voice}
            </Pill>
          ))}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 11.5,
            color: 'var(--ink-3)',
          }}
        >
          {getSupertonicVoiceLabel(t, settings.tts.voice || 'F1')}
        </div>
      </Field>

      {/* TTS 출력 언어 (로컬/프리미엄 공용) —
          Supertonic은 일본어 미지원이지만 UI에는 표시한다(사용자가 엔진 비교 시 혼란 방지).
          ja가 선택되고 엔진이 supertonic이면 런타임에 TTS/LLM이 영어로 폴백되고 경고를 표시. */}
      <Field label={<GroupTitle>{t('settings.voice.tts.language')}</GroupTitle>}>
        <SectionHint>{t('settings.voice.tts.languageDesc')}</SectionHint>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {TTS_LANGUAGE_OPTIONS.map((opt) => {
            const label =
              opt.value === 'auto' ? t('settings.voice.tts.languageAuto') : opt.label;
            const currentLang = settings.tts.language ?? 'auto';
            return (
              <Pill
                key={opt.value}
                active={currentLang === opt.value}
                onClick={() => setTTSSettings({ language: opt.value })}
              >
                {label}
              </Pill>
            );
          })}
        </div>
        {settings.tts.engine === 'supertonic' &&
          settings.tts.language &&
          settings.tts.language !== 'auto' &&
          !SUPERTONIC_SUPPORTED_LANGUAGES.has(settings.tts.language) && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--warn)' }}>
              {t('settings.voice.tts.languageUnsupportedLocal')}
            </div>
          )}
      </Field>

      {/* TTS Test */}
      <Field label={<GroupTitle>{t('settings.avatar.ttsTest.title')}</GroupTitle>}>
        <SectionHint>{t('settings.avatar.ttsTest.description')}</SectionHint>
        <button
          type="button"
          onClick={() => (isSpeaking ? stop() : speak(ttsSample))}
          className="w-full grid place-items-center focus-ring"
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: isSpeaking ? 'var(--danger)' : 'var(--accent)',
            color: 'white',
            fontSize: 13,
            fontWeight: 500,
            transition: 'all 200ms var(--ease)',
          }}
          data-interactive="true"
        >
          <span className="inline-flex items-center gap-2">
            {isSpeaking ? <Square size={13} /> : <Play size={13} />}
            {isSpeaking
              ? t('settings.avatar.ttsTest.stop')
              : t('settings.avatar.ttsTest.speak', { text: ttsSample })}
          </span>
        </button>
        {ttsError && (
          <div
            style={{
              marginTop: 6,
              fontSize: 11.5,
              color: 'var(--danger)',
              wordBreak: 'break-all',
            }}
          >
            {t('settings.avatar.ttsTest.error', { error: ttsError })}
          </div>
        )}
      </Field>

      {/* Global Shortcut */}
      <Field label={<GroupTitle>{t('settings.voice.globalShortcut.title')}</GroupTitle>}>
        <SectionHint>{t('settings.voice.globalShortcut.description')}</SectionHint>

        <Row label={t('settings.voice.globalShortcut.enabled')}>
          <Toggle
            on={globalShortcutSettings.enabled}
            onChange={(enabled) => setGlobalShortcutSettings({ enabled })}
          />
        </Row>

        <div style={{ paddingTop: 4 }}>
          <Field label={t('settings.voice.globalShortcut.shortcutLabel')}>
            <FormCard padding={0}>
              <input
                type="text"
                readOnly
                value={shortcutDisplayValue}
                onFocus={() => setIsCapturingShortcut(true)}
                onBlur={() => setIsCapturingShortcut(false)}
                onKeyDown={handleShortcutKeyDown}
                aria-label={t('settings.voice.globalShortcut.shortcutLabel')}
                className="focus-ring w-full"
                style={{
                  padding: '9px 12px',
                  background: 'transparent',
                  border: 0,
                  outline: 'none',
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 13,
                  color: 'var(--ink)',
                  borderRadius: 12,
                }}
                data-interactive="true"
              />
            </FormCard>
          </Field>
          <div
            className="flex items-center justify-between"
            style={{ marginTop: 4 }}
          >
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
              {isCapturingShortcut
                ? t('settings.voice.globalShortcut.captureHint')
                : t('settings.voice.globalShortcut.shortcutHint')}
            </div>
            <button
              type="button"
              onClick={() => {
                setShortcutInputError(null);
                setGlobalShortcutSettings({
                  enabled: true,
                  accelerator: DEFAULT_GLOBAL_SHORTCUT_ACCELERATOR,
                });
              }}
              className="focus-ring"
              style={{
                fontSize: 11.5,
                color: 'var(--accent-ink)',
                background: 'transparent',
                padding: '2px 6px',
                borderRadius: 6,
              }}
              data-interactive="true"
            >
              {t('settings.voice.globalShortcut.restoreDefault')}
            </button>
          </div>
        </div>

        {shortcutInputError && (
          <div
            style={{
              marginTop: 6,
              fontSize: 11.5,
              color: 'var(--danger)',
            }}
          >
            {shortcutInputError}
          </div>
        )}
        {!shortcutInputError && globalShortcutSettings.enabled && shortcutRegisterError && (
          <div
            style={{
              marginTop: 6,
              fontSize: 11.5,
              color: 'var(--warn)',
            }}
          >
            {t('settings.voice.globalShortcut.registerErrorInline', {
              error: shortcutRegisterError,
            })}
          </div>
        )}
      </Field>
    </div>
  );
}
