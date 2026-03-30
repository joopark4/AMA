/**
 * PremiumVoiceSettings — 프리미엄 음성 설정 UI
 * TTS 엔진 선택, Supertone API 음성/모델/스타일/사용량 관리
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore, type SupertoneApiSettings } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import { usePremiumStore, type SupertoneVoice } from './premiumStore';
import { getModelLanguages } from './supertoneApiClient';

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
      <div className="text-center py-6 text-gray-500">
        <div className="text-lg font-medium mb-1">{t('settings.premium.locked')}</div>
        <div className="text-sm">{t('settings.premium.loginRequired')}</div>
      </div>
    );
  }

  // 로딩 중
  if (isChecking) {
    return <div className="text-center py-6 text-gray-400 text-sm">{t('app.loading')}</div>;
  }

  // 비프리미엄
  if (!isPremium) {
    return (
      <div className="text-center py-6 text-gray-500">
        <div className="inline-block px-3 py-1 bg-gray-200 text-gray-600 rounded-full text-xs font-medium mb-3">
          {t('settings.premium.badge')}
        </div>
        <div className="text-lg font-medium mb-1">{t('settings.premium.locked')}</div>
        <div className="text-sm">{t('settings.premium.lockedDesc')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 프리미엄 배지 */}
      <div className="flex items-center gap-2">
        <span className="inline-block px-2.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
          {t('settings.premium.active')}
        </span>
      </div>

      {/* TTS 엔진 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('settings.premium.engineSelect')}
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => handleEngineChange('supertonic')}
            className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
              settings.tts.engine === 'supertonic'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t('settings.premium.engineLocal')}
          </button>
          <button
            onClick={() => handleEngineChange('supertone_api')}
            className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
              settings.tts.engine === 'supertone_api'
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t('settings.premium.engineCloud')}
          </button>
        </div>
      </div>

      {/* Supertone API 설정 (엔진이 supertone_api일 때만) */}
      {settings.tts.engine === 'supertone_api' && (
        <>
          {/* 모델 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.premium.modelSelect')}
            </label>
            <select
              value={currentModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {SUPERTONE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{t(m.labelKey)}</option>
              ))}
            </select>
          </div>

          {/* 음성 출력 언어 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.premium.ttsLanguage')}
            </label>
            <p className="text-xs text-gray-500 mb-1">{t('settings.premium.ttsLanguageDesc')}</p>
            <select
              value={effectiveApiSettings.language || 'ko'}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {supportedLanguages.map(lang => (
                <option key={lang} value={lang}>
                  {LANGUAGE_LABELS[lang] || lang}
                </option>
              ))}
            </select>
            {effectiveApiSettings.language && !supportedLanguages.includes(effectiveApiSettings.language) && (
              <p className="text-xs text-amber-600 mt-1">{t('settings.premium.ttsLanguageUnsupported')}</p>
            )}
          </div>

          {/* 음성 선택 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">
                {t('settings.premium.voiceSelect')}
                {!isLoadingVoices && (
                  <span className="ml-1.5 text-xs font-normal text-gray-400">({filteredVoices.length})</span>
                )}
              </label>
              <button
                onClick={() => refreshVoices()}
                disabled={isLoadingVoices}
                className="text-xs text-purple-600 hover:text-purple-800 disabled:text-gray-400"
                title={t('settings.premium.voiceRefresh')}
              >
                {t('settings.premium.voiceRefresh')}
              </button>
            </div>

            {isLoadingVoices ? (
              <div className="text-sm text-gray-400 py-3 text-center">{t('settings.premium.loadingVoices')}</div>
            ) : filteredVoices.length === 0 ? (
              <div className="text-sm text-gray-400 py-3 text-center">{t('settings.premium.noVoicesFound')}</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {filteredVoices.map(voice => {
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
                        const previewStyle = isAlreadySelected ? effectiveApiSettings.style : voice.styles?.[0] || 'neutral';
                        handleVoiceSelect(voice);
                        handlePreview(voice, { stopPropagation: () => {} } as React.MouseEvent, previewStyle);
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50 text-purple-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50/50'
                      }`}
                    >
                      {isPreviewing && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" className="shrink-0 text-purple-500">
                          <path d="M3 1.5v9l7.5-4.5z"/>
                        </svg>
                      )}
                      <span>{voice.name}</span>
                      <span className="text-gray-400">({genderLabel})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 스타일 선택 */}
          {selectedVoice && selectedVoice.styles?.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('settings.premium.styleSelect')}
              </label>
              <select
                value={effectiveApiSettings.style || 'neutral'}
                onChange={(e) => handleStyleChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {selectedVoice.styles.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          {/* 감정 자동 매핑 토글 */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700">{t('settings.premium.autoEmotion')}</div>
              <div className="text-xs text-gray-500">{t('settings.premium.autoEmotionDesc')}</div>
            </div>
            <button
              onClick={handleAutoEmotionToggle}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                effectiveApiSettings.autoEmotionStyle ? 'bg-purple-500' : 'bg-gray-300'
              }`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                effectiveApiSettings.autoEmotionStyle ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* 음성 미세 조정 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.premium.voiceSettings')}
            </label>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-600 mb-1">
                  {t('settings.premium.pitchShift', { value: effectiveApiSettings.voiceSettings?.pitchShift ?? 0 })}
                </div>
                <input
                  type="range" min={-24} max={24} step={1}
                  value={effectiveApiSettings.voiceSettings?.pitchShift ?? 0}
                  onChange={(e) => handleVoiceSettingChange('pitchShift', Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">
                  {t('settings.premium.pitchVariance', { value: effectiveApiSettings.voiceSettings?.pitchVariance ?? 1 })}
                </div>
                <input
                  type="range" min={0} max={2} step={0.1}
                  value={effectiveApiSettings.voiceSettings?.pitchVariance ?? 1}
                  onChange={(e) => handleVoiceSettingChange('pitchVariance', Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">
                  {t('settings.premium.speed', { value: effectiveApiSettings.voiceSettings?.speed ?? 1 })}
                </div>
                <input
                  type="range" min={0.5} max={2} step={0.1}
                  value={effectiveApiSettings.voiceSettings?.speed ?? 1}
                  onChange={(e) => handleVoiceSettingChange('speed', Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>
          </div>
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

  return (
    <div className={`rounded-lg p-3 space-y-3 ${isAdmin ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {isAdmin ? t('settings.premium.usage.adminTitle') : t('settings.premium.usage.title')}
          </span>
          {isAdmin && (
            <span className="inline-block px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded text-[10px] font-semibold">
              Admin
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="text-xs text-purple-600 hover:text-purple-800 disabled:text-gray-400"
        >
          {t('settings.premium.usage.refresh')}
        </button>
      </div>

      {isLoading && !quota && !apiCredits ? (
        <div className="text-xs text-gray-400 text-center py-2">{t('settings.premium.usage.loading')}</div>
      ) : (
        <>
          {/* 관리자: Supertone API 크레딧 잔액 + 총 할당량 */}
          {isAdmin && apiCredits && (
            <div>
              <div className="text-xs text-gray-600 mb-1">{t('settings.premium.quota.adminTitle')}</div>
              {(() => {
                const { balance, used, total } = apiCredits;
                const usedPercent = total > 0 ? Math.round((used / total) * 100) : 0;
                const remainPercent = 100 - usedPercent;
                return (
                  <div className="p-2.5 bg-amber-100/60 border border-amber-200 rounded-lg space-y-2">
                    {/* 잔액 큰 숫자 */}
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-bold text-amber-800">
                        {balance.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                      <span className="text-xs text-amber-600">{t('settings.premium.quota.adminBalanceUnit')}</span>
                    </div>
                    <div className="text-xs text-amber-700">
                      {t('settings.premium.quota.adminBalanceDesc', {
                        minutes: Math.floor(balance / 60),
                        seconds: Math.round(balance % 60),
                      })}
                    </div>
                    {/* 프로그레스 바 */}
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full transition-all bg-amber-500"
                        style={{ width: `${usedPercent}%` }}
                      />
                    </div>
                    {/* 총 할당량 / 사용량 / 남은 % */}
                    <div className="flex justify-between text-xs text-amber-700">
                      <span>{t('settings.premium.quota.adminTotal', {
                        used: Math.round(used),
                        total: Math.round(total),
                      })}</span>
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
              <div className="text-xs text-gray-600 mb-1">{t('settings.premium.quota.title')}</div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    isQuotaExceeded ? 'bg-red-500' :
                    quota.used / quota.limit > 0.8 ? 'bg-amber-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${Math.min(100, (quota.used / Math.max(1, quota.limit)) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500">
                  {t('settings.premium.quota.used', {
                    used: Math.round(quota.used),
                    limit: Math.round(quota.limit),
                  })}
                </span>
                <span className="text-xs text-gray-500">
                  {t('settings.premium.quota.percent', {
                    value: Math.round((quota.used / Math.max(1, quota.limit)) * 100),
                  })}
                </span>
              </div>

              {/* 경고/소진 메시지 */}
              {isQuotaExceeded && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  <div className="font-medium">{t('settings.premium.quota.exceeded')}</div>
                  <div>{t('settings.premium.quota.exceededDesc')}</div>
                  <div className="mt-1 text-red-500">{t('settings.premium.quota.resetInfo')}</div>
                </div>
              )}
              {!isQuotaExceeded && quota.used / quota.limit > 0.8 && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                  <div className="font-medium">{t('settings.premium.quota.warning')}</div>
                  <div>{t('settings.premium.quota.remaining', {
                    value: Math.round(quota.remaining),
                    minutes: Math.floor(quota.remaining / 60),
                    seconds: Math.round(quota.remaining % 60),
                  })}</div>
                </div>
              )}
            </div>
          )}

          {/* 이번 달 요약 */}
          {usageSummary && (
            <div className="text-xs text-gray-600">
              <div className="font-medium mb-0.5">
                {isAdmin ? t('settings.premium.usage.adminThisMonth') : t('settings.premium.usage.thisMonth')}
              </div>
              <div>{t('settings.premium.usage.summary', {
                seconds: Math.round(usageSummary.totalSeconds),
                characters: usageSummary.totalCharacters.toLocaleString(),
                requests: usageSummary.totalRequests,
              })}</div>
            </div>
          )}

          {/* 최근 7일 차트 */}
          {usageDaily && usageDaily.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1.5">{t('settings.premium.usage.recent7days')}</div>
              <div className="space-y-1">
                {usageDaily.slice(0, 7).map(day => {
                  const maxSeconds = Math.max(...usageDaily.slice(0, 7).map(d => d.seconds), 1);
                  const barWidth = Math.max(2, (day.seconds / maxSeconds) * 100);
                  return (
                    <div key={day.date} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400 w-12 shrink-0">{day.date.slice(5)}</span>
                      <div className="flex-1 bg-gray-200 rounded h-2">
                        <div
                          className={`rounded h-2 transition-all ${isAdmin ? 'bg-amber-400' : 'bg-purple-400'}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="text-gray-500 w-14 text-right shrink-0">
                        {Math.round(day.seconds)}{t('settings.premium.usage.seconds', { value: '' }).replace('{{value}}', '').trim().charAt(0) === 's' ? 's' : '초'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!usageSummary && !usageDaily?.length && (
            <div className="text-xs text-gray-400 text-center py-2">{t('settings.premium.usage.noUsage')}</div>
          )}
        </>
      )}
    </div>
  );
}
