/**
 * PremiumVoiceSettings — 프리미엄 음성 설정 UI
 * TTS 엔진 선택, Supertone API 음성/모델/스타일/사용량 관리
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Play } from 'lucide-react';
import { useSettingsStore, type SupertoneApiSettings } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import { usePremiumStore, type SupertoneVoice } from './premiumStore';
import { getModelLanguages } from './supertoneApiClient';
import { Field, Pill, Select, Slider, Toggle, SectionHint } from '../../components/settings/forms';

const SUPERTONE_MODELS = [
  { id: 'sona_speech_1', labelKey: 'settings.premium.models.sona_speech_1' },
  { id: 'sona_speech_2', labelKey: 'settings.premium.models.sona_speech_2' },
  { id: 'sona_speech_2_flash', labelKey: 'settings.premium.models.sona_speech_2_flash' },
] as const;

const LANGUAGE_LABELS: Record<string, string> = {
  ko: '한국어', en: 'English', ja: '日本語', zh: '中文', de: 'Deutsch',
  fr: 'Français', es: 'Español', pt: 'Português', it: 'Italiano', ru: 'Русский',
  nl: 'Nederlands', pl: 'Polski', sv: 'Svenska', da: 'Dansk', fi: 'Suomi',
  no: 'Norsk', tr: 'Türkçe', ar: 'العربية', hi: 'हिन्दी', th: 'ไทย',
  vi: 'Tiếng Việt', id: 'Indonesia', ms: 'Melayu',
};

export default function PremiumVoiceSettings() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const { settings, setTTSSettings } = useSettingsStore();
  const {
    isPremium, isAdmin, isChecking,
    voices, isLoadingVoices,
    quota, isQuotaExceeded, apiCredits,
    usageSummary, usageDaily, isLoadingUsage,
    checkPremiumStatus, fetchVoices, refreshVoices, fetchUsageSummary, fetchUsageDaily,
  } = usePremiumStore();

  // 향후 필터 UI 복원 시 setVoiceFilter 활성화
  const [voiceFilter] = useState({ gender: '', language: '' });
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const apiSettings = settings.tts.supertoneApi;
  const defaultApiSettings = {
    voiceId: '',
    voiceName: '',
    model: 'sona_speech_1' as const,
    language: 'ko',
    style: 'neutral',
    autoEmotionStyle: true,
    voiceSettings: { pitchShift: 0, pitchVariance: 1, speed: 1 },
  };
  const effectiveApiSettings = apiSettings || defaultApiSettings;

  // 프리미엄 상태 확인
  useEffect(() => {
    if (isAuthenticated) {
      checkPremiumStatus();
    }
  }, [isAuthenticated, checkPremiumStatus]);

  // 프리미엄 활성 시 음성 목록 + 사용량 로드
  useEffect(() => {
    if (isPremium) {
      fetchVoices();
      fetchUsageSummary();
      fetchUsageDaily();
    }
  }, [isPremium, fetchVoices, fetchUsageSummary, fetchUsageDaily]);

  const handleEngineChange = useCallback((engine: 'supertonic' | 'supertone_api') => {
    setTTSSettings({ engine });
  }, [setTTSSettings]);

  const handleVoiceSelect = useCallback((voice: SupertoneVoice) => {
    const isAlreadySelected = effectiveApiSettings.voiceId === voice.voice_id;
    setTTSSettings({
      engine: 'supertone_api',
      supertoneApi: {
        ...effectiveApiSettings,
        voiceId: voice.voice_id,
        voiceName: voice.name,
        // 이미 선택된 음성이면 현재 스타일 유지, 새 음성이면 첫 번째 스타일
        style: isAlreadySelected ? effectiveApiSettings.style : (voice.styles?.[0] || 'neutral'),
      },
    });
  }, [setTTSSettings, effectiveApiSettings]);

  const handleModelChange = useCallback((model: string) => {
    const supportedLangs = getModelLanguages(model);
    const newLang = supportedLangs.includes(effectiveApiSettings.language) ? effectiveApiSettings.language : 'en';
    setTTSSettings({
      engine: 'supertone_api',
      supertoneApi: { ...effectiveApiSettings, model: model as SupertoneApiSettings['model'], language: newLang },
    });
  }, [setTTSSettings, effectiveApiSettings]);

  const handleLanguageChange = useCallback((language: string) => {
    setTTSSettings({ supertoneApi: { ...effectiveApiSettings, language } });
  }, [setTTSSettings, effectiveApiSettings]);

  const handleStyleChange = useCallback((style: string) => {
    setTTSSettings({ supertoneApi: { ...effectiveApiSettings, style } });
  }, [setTTSSettings, effectiveApiSettings]);

  const handleAutoEmotionToggle = useCallback(() => {
    setTTSSettings({ supertoneApi: { ...effectiveApiSettings, autoEmotionStyle: !effectiveApiSettings.autoEmotionStyle } });
  }, [setTTSSettings, effectiveApiSettings]);

  const handleVoiceSettingChange = useCallback((key: 'pitchShift' | 'pitchVariance' | 'speed', value: number) => {
    setTTSSettings({
      supertoneApi: {
        ...effectiveApiSettings,
        voiceSettings: { ...effectiveApiSettings.voiceSettings, [key]: value },
      },
    });
  }, [setTTSSettings, effectiveApiSettings]);

  /** 샘플 URL로 미리듣기 (크레딧 소비 없음) */
  const handlePreview = useCallback(async (voice: SupertoneVoice, e: React.MouseEvent, styleOverride?: string) => {
    e.stopPropagation();

    // 이미 재생 중이면 정지
    if (previewingVoiceId === voice.voice_id) {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      setPreviewingVoiceId(null);
      return;
    }

    // 현재 언어 + 스타일에 맞는 샘플 찾기
    const samples = voice.samples || [];
    const lang = effectiveApiSettings.language || 'ko';
    const style = styleOverride || effectiveApiSettings.style || 'neutral';
    const sample =
      samples.find(s => s.language === lang && s.style === style) ||
      samples.find(s => s.language === lang) ||
      samples.find(s => s.style === style) ||
      samples.find(s => s.language === 'ko') ||
      samples.find(s => s.language === 'en') ||
      samples[0];

    if (!sample?.url) return;

    // 기존 재생 중지
    previewAudioRef.current?.pause();
    setPreviewingVoiceId(voice.voice_id);

    try {
      // Tauri WebView에서 외부 URL fetch/Audio 직접 불가 → Rust 사이드에서 다운로드
      const bytes = await invoke<number[]>('fetch_url_bytes', { url: sample.url });
      const uint8 = new Uint8Array(bytes);
      const blob = new Blob([uint8], { type: 'audio/wav' });
      const blobUrl = URL.createObjectURL(blob);

      const audio = new Audio(blobUrl);

      // 선택된 출력 디바이스 적용
      const outputDeviceId = useSettingsStore.getState().settings.tts.audioOutputDeviceId;
      if (outputDeviceId && 'setSinkId' in audio) {
        await (audio as any).setSinkId(outputDeviceId).catch((err: unknown) => {
          console.warn('Failed to set sink ID for preview audio:', err);
        });
      }

      previewAudioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(blobUrl);
        setPreviewingVoiceId(null);
        previewAudioRef.current = null;
      };
      audio.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        setPreviewingVoiceId(null);
        previewAudioRef.current = null;
      };
      await audio.play();
    } catch (err) {
      console.error('[Preview] Failed:', err);
      setPreviewingVoiceId(null);
      previewAudioRef.current = null;
    }
  }, [previewingVoiceId, effectiveApiSettings.language, effectiveApiSettings.style]);

  // 컴포넌트 언마운트 시 재생 정지
  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause();
    };
  }, []);

  const filteredVoices = voices.filter(v => {
    if (voiceFilter.gender && v.gender !== voiceFilter.gender) return false;
    // 음성 출력 언어를 지원하는 음성만 표시
    const ttsLang = effectiveApiSettings.language || 'ko';
    if (!v.languages?.includes(ttsLang)) return false;
    if (voiceFilter.language && !v.languages?.includes(voiceFilter.language)) return false;
    return true;
  });

  const selectedVoice = voices.find(v => v.voice_id === effectiveApiSettings.voiceId);
  const currentModel = effectiveApiSettings.model;
  const supportedLanguages = getModelLanguages(currentModel);

  // 비로그인 상태
  if (!isAuthenticated) {
    return (
      <div className="text-center py-6">
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
          {t('settings.premium.locked')}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
          {t('settings.premium.loginRequired')}
        </div>
      </div>
    );
  }

  // 로딩 중
  if (isChecking) {
    return (
      <div className="text-center py-6" style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
        {t('app.loading')}
      </div>
    );
  }

  // 비프리미엄
  if (!isPremium) {
    return (
      <div className="text-center py-6">
        <div
          className="inline-block"
          style={{
            padding: '4px 10px',
            background: 'oklch(1 0 0 / 0.7)',
            boxShadow: 'inset 0 0 0 1px var(--hairline)',
            color: 'var(--ink-2)',
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          {t('settings.premium.badge')}
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
          {t('settings.premium.locked')}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
          {t('settings.premium.lockedDesc')}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 프리미엄 배지 */}
      <div style={{ marginBottom: 4 }}>
        <span
          className="inline-block"
          style={{
            padding: '3px 10px',
            background: 'var(--accent-soft)',
            color: 'var(--accent-ink)',
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {t('settings.premium.active')}
        </span>
      </div>

      {/* TTS 엔진 선택 */}
      <Field label={t('settings.premium.engineSelect')}>
        <div className="flex" style={{ gap: 6 }}>
          <Pill
            active={settings.tts.engine === 'supertonic'}
            onClick={() => handleEngineChange('supertonic')}
          >
            {t('settings.premium.engineLocal')}
          </Pill>
          <Pill
            active={settings.tts.engine === 'supertone_api'}
            onClick={() => handleEngineChange('supertone_api')}
          >
            {t('settings.premium.engineCloud')}
          </Pill>
        </div>
      </Field>

      {/* Supertone API 설정 (엔진이 supertone_api일 때만) */}
      {settings.tts.engine === 'supertone_api' && (
        <>
          <Field label={t('settings.premium.modelSelect')}>
            <Select
              value={currentModel}
              onChange={handleModelChange}
              options={SUPERTONE_MODELS.map((m) => ({
                value: m.id,
                label: t(m.labelKey),
              }))}
            />
          </Field>

          <Field label={t('settings.premium.ttsLanguage')} hint={t('settings.premium.ttsLanguageDesc')}>
            <Select
              value={effectiveApiSettings.language || 'ko'}
              onChange={handleLanguageChange}
              options={supportedLanguages.map((lang) => ({
                value: lang,
                label: LANGUAGE_LABELS[lang] || lang,
              }))}
            />
            {effectiveApiSettings.language && !supportedLanguages.includes(effectiveApiSettings.language) && (
              <div style={{ fontSize: 11.5, color: 'var(--warn)', marginTop: 4 }}>
                {t('settings.premium.ttsLanguageUnsupported')}
              </div>
            )}
          </Field>

          {/* 음성 선택 */}
          <Field
            label={
              <>
                {t('settings.premium.voiceSelect')}
                {!isLoadingVoices && (
                  <span style={{ marginLeft: 6, color: 'var(--ink-3)', fontWeight: 400 }}>
                    ({filteredVoices.length})
                  </span>
                )}
              </>
            }
            hint={
              <button
                onClick={() => refreshVoices()}
                disabled={isLoadingVoices}
                style={{
                  fontSize: 11.5,
                  color: 'var(--accent-ink)',
                  background: 'transparent',
                  padding: '2px 6px',
                  borderRadius: 6,
                }}
                title={t('settings.premium.voiceRefresh')}
                data-interactive="true"
              >
                {t('settings.premium.voiceRefresh')}
              </button>
            }
          >
            {isLoadingVoices ? (
              <SectionHint>{t('settings.premium.loadingVoices')}</SectionHint>
            ) : filteredVoices.length === 0 ? (
              <SectionHint>{t('settings.premium.noVoicesFound')}</SectionHint>
            ) : (
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {filteredVoices.map((voice) => {
                  const isSelected = effectiveApiSettings.voiceId === voice.voice_id;
                  const isPreviewing = previewingVoiceId === voice.voice_id;
                  const genderLabel = voice.gender === 'female'
                    ? t('settings.premium.voiceGenderFemaleShort')
                    : t('settings.premium.voiceGenderMaleShort');
                  return (
                    <button
                      key={voice.voice_id}
                      onClick={() => {
                        const isAlreadySelected = effectiveApiSettings.voiceId === voice.voice_id;
                        const previewStyle = isAlreadySelected
                          ? effectiveApiSettings.style
                          : voice.styles?.[0] || 'neutral';
                        handleVoiceSelect(voice);
                        handlePreview(
                          voice,
                          { stopPropagation: () => {} } as React.MouseEvent,
                          previewStyle
                        );
                      }}
                      className="inline-flex items-center transition-all focus-ring"
                      style={{
                        gap: 4,
                        padding: '6px 10px',
                        fontSize: 12,
                        borderRadius: 99,
                        background: isSelected ? 'var(--accent)' : 'oklch(1 0 0 / 0.7)',
                        color: isSelected ? 'white' : 'var(--ink-2)',
                        boxShadow: isSelected ? 'none' : 'inset 0 0 0 1px var(--hairline)',
                        fontWeight: isSelected ? 500 : 400,
                        transitionDuration: '160ms',
                        transitionTimingFunction: 'var(--ease)',
                      }}
                      data-interactive="true"
                    >
                      {isPreviewing && <Play size={10} fill="currentColor" />}
                      <span>{voice.name}</span>
                      <span style={{ opacity: 0.6 }}>({genderLabel})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          {/* 스타일 선택 */}
          {selectedVoice && selectedVoice.styles?.length > 0 && (
            <Field label={t('settings.premium.styleSelect')}>
              <Select
                value={effectiveApiSettings.style || 'neutral'}
                onChange={handleStyleChange}
                options={selectedVoice.styles.map((s) => ({ value: s, label: s }))}
              />
            </Field>
          )}

          {/* 감정 자동 매핑 토글 */}
          <div className="flex items-center justify-between" style={{ padding: '10px 0' }}>
            <div>
              <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>
                {t('settings.premium.autoEmotion')}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                {t('settings.premium.autoEmotionDesc')}
              </div>
            </div>
            <Toggle
              on={effectiveApiSettings.autoEmotionStyle}
              onChange={handleAutoEmotionToggle}
            />
          </div>

          {/* 음성 미세 조정 */}
          <Field label={t('settings.premium.voiceSettings')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 4 }}>
                  {t('settings.premium.pitchShift', {
                    value: effectiveApiSettings.voiceSettings?.pitchShift ?? 0,
                  })}
                </div>
                <Slider
                  value={effectiveApiSettings.voiceSettings?.pitchShift ?? 0}
                  min={-24}
                  max={24}
                  step={1}
                  onChange={(v) => handleVoiceSettingChange('pitchShift', v)}
                />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 4 }}>
                  {t('settings.premium.pitchVariance', {
                    value: effectiveApiSettings.voiceSettings?.pitchVariance ?? 1,
                  })}
                </div>
                <Slider
                  value={effectiveApiSettings.voiceSettings?.pitchVariance ?? 1}
                  min={0}
                  max={2}
                  step={0.1}
                  format={(v) => v.toFixed(1)}
                  onChange={(v) => handleVoiceSettingChange('pitchVariance', v)}
                />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 4 }}>
                  {t('settings.premium.speed', {
                    value: effectiveApiSettings.voiceSettings?.speed ?? 1,
                  })}
                </div>
                <Slider
                  value={effectiveApiSettings.voiceSettings?.speed ?? 1}
                  min={0.5}
                  max={2}
                  step={0.1}
                  format={(v) => `${v.toFixed(1)}x`}
                  onChange={(v) => handleVoiceSettingChange('speed', v)}
                />
              </div>
            </div>
          </Field>
        </>
      )}

      {/* 사용량 카드 (프리미엄이면 항상 표시) */}
      <UsageCard
        quota={quota}
        isQuotaExceeded={isQuotaExceeded}
        apiCredits={apiCredits}
        usageSummary={usageSummary}
        usageDaily={usageDaily}
        isLoading={isLoadingUsage}
        isAdmin={isAdmin}
        onRefresh={() => { fetchUsageSummary(); fetchUsageDaily(); }}
      />
    </div>
  );
}

/** 사용량 카드 서브 컴포넌트 */
function UsageCard({
  quota, isQuotaExceeded, apiCredits, usageSummary, usageDaily, isLoading, isAdmin, onRefresh,
}: {
  quota: { limit: number; used: number; remaining: number } | null;
  isQuotaExceeded: boolean;
  apiCredits: { balance: number; used: number; total: number } | null;
  usageSummary: { totalSeconds: number; totalCharacters: number; totalRequests: number } | null;
  usageDaily: { date: string; seconds: number; characters: number; requests: number }[] | null;
  isLoading: boolean;
  isAdmin: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();

  const accentColor = isAdmin ? 'var(--warn)' : 'var(--accent)';
  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 14,
        background: 'oklch(1 0 0 / 0.55)',
        boxShadow: 'inset 0 0 0 1px var(--hairline)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center" style={{ gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {isAdmin ? t('settings.premium.usage.adminTitle') : t('settings.premium.usage.title')}
          </span>
          {isAdmin && (
            <span
              className="inline-block"
              style={{
                padding: '2px 6px',
                background: 'var(--warn)',
                color: 'white',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              Admin
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          style={{
            fontSize: 11.5,
            color: 'var(--accent-ink)',
            background: 'transparent',
            opacity: isLoading ? 0.5 : 1,
            padding: '2px 6px',
            borderRadius: 6,
          }}
          data-interactive="true"
        >
          {t('settings.premium.usage.refresh')}
        </button>
      </div>

      {isLoading && !quota && !apiCredits ? (
        <div
          className="text-center"
          style={{ padding: '8px 0', fontSize: 11.5, color: 'var(--ink-3)' }}
        >
          {t('settings.premium.usage.loading')}
        </div>
      ) : (
        <>
          {/* 관리자: Supertone API 크레딧 잔액 + 총 할당량 */}
          {isAdmin && apiCredits && (
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 4 }}>
                {t('settings.premium.quota.adminTitle')}
              </div>
              {(() => {
                const { balance, used, total } = apiCredits;
                const usedPercent = total > 0 ? Math.round((used / total) * 100) : 0;
                const remainPercent = 100 - usedPercent;
                return (
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: 'oklch(1 0 0 / 0.6)',
                      boxShadow: 'inset 0 0 0 1px var(--hairline)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div className="flex items-baseline justify-between">
                      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--warn)' }}>
                        {balance.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                        {t('settings.premium.quota.adminBalanceUnit')}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                      {t('settings.premium.quota.adminBalanceDesc', {
                        minutes: Math.floor(balance / 60),
                        seconds: Math.round(balance % 60),
                      })}
                    </div>
                    {/* 프로그레스 바 */}
                    <div
                      style={{
                        width: '100%',
                        height: 6,
                        background: 'oklch(0.85 0.005 60)',
                        borderRadius: 99,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${usedPercent}%`,
                          height: '100%',
                          background: accentColor,
                          transition: 'width 220ms var(--ease)',
                        }}
                      />
                    </div>
                    <div className="flex justify-between" style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                      <span>
                        {t('settings.premium.quota.adminTotal', {
                          used: Math.round(used),
                          total: Math.round(total),
                        })}
                      </span>
                      <span>{t('settings.premium.quota.adminRemainPercent', { value: remainPercent })}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 일반 사용자: 할당량 바 */}
          {!isAdmin && quota && (
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 4 }}>
                {t('settings.premium.quota.title')}
              </div>
              <div
                style={{
                  width: '100%',
                  height: 6,
                  background: 'oklch(0.85 0.005 60)',
                  borderRadius: 99,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background: isQuotaExceeded
                      ? 'var(--danger)'
                      : quota.used / quota.limit > 0.8
                        ? 'var(--warn)'
                        : 'var(--accent)',
                    width: `${Math.min(100, (quota.used / Math.max(1, quota.limit)) * 100)}%`,
                    transition: 'width 220ms var(--ease)',
                  }}
                />
              </div>
              <div className="flex justify-between" style={{ marginTop: 4, fontSize: 11.5, color: 'var(--ink-3)' }}>
                <span>
                  {t('settings.premium.quota.used', {
                    used: Math.round(quota.used),
                    limit: Math.round(quota.limit),
                  })}
                </span>
                <span>
                  {t('settings.premium.quota.percent', {
                    value: Math.round((quota.used / Math.max(1, quota.limit)) * 100),
                  })}
                </span>
              </div>

              {isQuotaExceeded && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 8,
                    borderRadius: 8,
                    background: 'oklch(0.95 0.04 25 / 0.6)',
                    boxShadow: 'inset 0 0 0 1px oklch(0.7 0.15 25 / 0.4)',
                    fontSize: 11.5,
                    color: 'var(--danger)',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{t('settings.premium.quota.exceeded')}</div>
                  <div>{t('settings.premium.quota.exceededDesc')}</div>
                  <div style={{ marginTop: 4 }}>{t('settings.premium.quota.resetInfo')}</div>
                </div>
              )}
              {!isQuotaExceeded && quota.used / quota.limit > 0.8 && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 8,
                    borderRadius: 8,
                    background: 'oklch(0.95 0.04 75 / 0.6)',
                    boxShadow: 'inset 0 0 0 1px oklch(0.7 0.15 75 / 0.4)',
                    fontSize: 11.5,
                    color: 'var(--warn)',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{t('settings.premium.quota.warning')}</div>
                  <div>
                    {t('settings.premium.quota.remaining', {
                      value: Math.round(quota.remaining),
                      minutes: Math.floor(quota.remaining / 60),
                      seconds: Math.round(quota.remaining % 60),
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 이번 달 요약 */}
          {usageSummary && (
            <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                {isAdmin
                  ? t('settings.premium.usage.adminThisMonth')
                  : t('settings.premium.usage.thisMonth')}
              </div>
              <div>
                {t('settings.premium.usage.summary', {
                  seconds: Math.round(usageSummary.totalSeconds),
                  characters: usageSummary.totalCharacters.toLocaleString(),
                  requests: usageSummary.totalRequests,
                })}
              </div>
            </div>
          )}

          {/* 최근 7일 차트 */}
          {usageDaily && usageDaily.length > 0 && (
            <div>
              <div
                style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}
              >
                {t('settings.premium.usage.recent7days')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {usageDaily.slice(0, 7).map((day) => {
                  const maxSeconds = Math.max(...usageDaily.slice(0, 7).map((d) => d.seconds), 1);
                  const barWidth = Math.max(2, (day.seconds / maxSeconds) * 100);
                  return (
                    <div
                      key={day.date}
                      className="flex items-center"
                      style={{ gap: 8, fontSize: 11 }}
                    >
                      <span style={{ color: 'var(--ink-3)', width: 48, flexShrink: 0 }}>
                        {day.date.slice(5)}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          background: 'oklch(0.85 0.005 60)',
                          borderRadius: 4,
                          height: 6,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${barWidth}%`,
                            height: '100%',
                            background: accentColor,
                            transition: 'width 220ms var(--ease)',
                          }}
                        />
                      </div>
                      <span
                        style={{
                          color: 'var(--ink-3)',
                          width: 56,
                          textAlign: 'right',
                          flexShrink: 0,
                          fontFamily: '"JetBrains Mono", monospace',
                        }}
                      >
                        {Math.round(day.seconds)}
                        {t('settings.premium.usage.seconds', { value: '' })
                          .replace('{{value}}', '')
                          .trim()
                          .charAt(0) === 's'
                          ? 's'
                          : '초'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!usageSummary && !usageDaily?.length && (
            <div
              className="text-center"
              style={{ padding: '8px 0', fontSize: 11.5, color: 'var(--ink-3)' }}
            >
              {t('settings.premium.usage.noUsage')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
