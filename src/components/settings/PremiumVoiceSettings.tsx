/**
 * PremiumVoiceSettings — 프리미엄 음성 설정 UI
 * TTS 엔진 선택, Supertone API 음성/모델/스타일/사용량 관리
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore, type SupertoneApiSettings } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import { usePremiumStore, type SupertoneVoice } from '../../stores/premiumStore';
import { getModelLanguages } from '../../services/voice/supertoneApiClient';

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
    isPremium, isChecking,
    voices, isLoadingVoices,
    quota, isQuotaExceeded,
    usageSummary, usageDaily, isLoadingUsage,
    checkPremiumStatus, fetchVoices, fetchUsageSummary, fetchUsageDaily,
  } = usePremiumStore();

  const [voiceFilter, setVoiceFilter] = useState({ gender: '', language: '' });
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
    setTTSSettings({
      engine: 'supertone_api',
      supertoneApi: {
        ...effectiveApiSettings,
        voiceId: voice.voice_id,
        voiceName: voice.name,
        style: voice.styles?.[0] || 'neutral',
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
  const handlePreview = useCallback(async (voice: SupertoneVoice, e: React.MouseEvent) => {
    e.stopPropagation();

    // 이미 재생 중이면 정지
    if (previewingVoiceId === voice.voice_id) {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      setPreviewingVoiceId(null);
      return;
    }

    // 현재 언어/스타일에 맞는 샘플 찾기
    const samples = voice.samples || [];
    const lang = effectiveApiSettings.language || 'ko';
    const sample =
      samples.find(s => s.language === lang) ||
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
  }, [previewingVoiceId, effectiveApiSettings.language]);

  // 컴포넌트 언마운트 시 재생 정지
  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause();
    };
  }, []);

  const filteredVoices = voices.filter(v => {
    if (voiceFilter.gender && v.gender !== voiceFilter.gender) return false;
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

          {/* 음성 필터 + 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.premium.voiceSelect')}
            </label>
            <div className="flex gap-2 mb-2">
              <select
                value={voiceFilter.gender}
                onChange={(e) => setVoiceFilter(f => ({ ...f, gender: e.target.value }))}
                className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
              >
                <option value="">{t('settings.premium.voiceGenderAll')}</option>
                <option value="female">{t('settings.premium.voiceGenderFemale')}</option>
                <option value="male">{t('settings.premium.voiceGenderMale')}</option>
              </select>
              <select
                value={voiceFilter.language}
                onChange={(e) => setVoiceFilter(f => ({ ...f, language: e.target.value }))}
                className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
              >
                <option value="">{t('settings.premium.voiceLanguageAll')}</option>
                {supportedLanguages.map(l => (
                  <option key={l} value={l}>{LANGUAGE_LABELS[l] || l}</option>
                ))}
              </select>
            </div>

            {isLoadingVoices ? (
              <div className="text-sm text-gray-400 py-3 text-center">{t('settings.premium.loadingVoices')}</div>
            ) : filteredVoices.length === 0 ? (
              <div className="text-sm text-gray-400 py-3 text-center">{t('settings.premium.noVoicesFound')}</div>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {filteredVoices.map(voice => {
                  const hasSamples = voice.samples && voice.samples.length > 0;
                  const isPreviewing = previewingVoiceId === voice.voice_id;
                  return (
                    <div
                      key={voice.voice_id}
                      onClick={() => handleVoiceSelect(voice)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer ${
                        effectiveApiSettings.voiceId === voice.voice_id
                          ? 'bg-purple-50 text-purple-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{voice.name}</div>
                        <div className="text-xs text-gray-500">
                          {voice.gender} · {voice.languages?.join(', ')}
                        </div>
                      </div>
                      {hasSamples && (
                        <button
                          onClick={(e) => handlePreview(voice, e)}
                          className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                            isPreviewing
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-200 text-gray-600 hover:bg-purple-100 hover:text-purple-600'
                          }`}
                          title={t('settings.premium.preview')}
                        >
                          {isPreviewing ? (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="2" width="3" height="8" rx="0.5"/><rect x="7" y="2" width="3" height="8" rx="0.5"/></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M3 1.5v9l7.5-4.5z"/></svg>
                          )}
                        </button>
                      )}
                    </div>
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
        usageSummary={usageSummary}
        usageDaily={usageDaily}
        isLoading={isLoadingUsage}
        onRefresh={() => { fetchUsageSummary(); fetchUsageDaily(); }}
      />
    </div>
  );
}

/** 사용량 카드 서브 컴포넌트 */
function UsageCard({
  quota, isQuotaExceeded, usageSummary, usageDaily, isLoading, onRefresh,
}: {
  quota: { limit: number; used: number; remaining: number } | null;
  isQuotaExceeded: boolean;
  usageSummary: { totalSeconds: number; totalCharacters: number; totalRequests: number } | null;
  usageDaily: { date: string; seconds: number; characters: number; requests: number }[] | null;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{t('settings.premium.usage.title')}</span>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="text-xs text-purple-600 hover:text-purple-800 disabled:text-gray-400"
        >
          {t('settings.premium.usage.refresh')}
        </button>
      </div>

      {isLoading && !quota ? (
        <div className="text-xs text-gray-400 text-center py-2">{t('settings.premium.usage.loading')}</div>
      ) : (
        <>
          {/* 할당량 바 */}
          {quota && (
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
              <div className="font-medium mb-0.5">{t('settings.premium.usage.thisMonth')}</div>
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
                          className="bg-purple-400 rounded h-2 transition-all"
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
