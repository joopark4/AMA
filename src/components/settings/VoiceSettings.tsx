/**
 * VoiceSettings - STT/TTS 엔진 및 모델 설정 컴포넌트
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';

// Web Speech 모델 목록 (브라우저/OS 엔진 사용)
const WEB_SPEECH_MODELS = ['default'];

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

export default function VoiceSettings() {
  const { t } = useTranslation();
  const { settings, setSTTSettings, setTTSSettings } = useSettingsStore();

  // 항상 webspeech 엔진 사용, 유효하지 않은 모델은 default로 리셋
  useEffect(() => {
    if (settings.stt.engine !== 'webspeech' || !WEB_SPEECH_MODELS.includes(settings.stt.model)) {
      setSTTSettings({ engine: 'webspeech', model: 'default' });
    }
    // TTS는 supertonic만 지원하므로 항상 supertonic으로 설정
    if (settings.tts.engine !== 'supertonic') {
      setTTSSettings({ engine: 'supertonic', voice: 'F1' });
    }
  }, []);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-800">
        {t('settings.voice.title')}
      </h3>

      {/* STT Settings - Web Speech */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700">
          {t('settings.voice.stt.title')}
        </h4>

        {/* STT Engine Info */}
        <div className="flex items-center gap-2 text-xs mb-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
            Web Speech
          </span>
          <span className="text-gray-500">macOS 시스템 음성 인식 사용</span>
        </div>

        {/* Web Speech Model */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-600">
            모델 선택
          </label>
          <select
            value={settings.stt.model}
            onChange={(e) => setSTTSettings({ model: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {WEB_SPEECH_MODELS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TTS Settings - Supertonic Only */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700">
          {t('settings.voice.tts.title')}
        </h4>

        {/* TTS Engine Info */}
        <div className="flex items-center gap-2 text-xs mb-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-800">
            Supertonic
          </span>
          <span className="text-gray-500">고품질 로컬 TTS - 한국어/영어 지원</span>
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
    </div>
  );
}
