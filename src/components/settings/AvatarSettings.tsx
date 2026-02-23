import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { pickVrmFile } from '../../services/tauri/fileDialog';
import { getMotionManifest } from '../../services/avatar/motionLibrary';

export default function AvatarSettings() {
  const { t } = useTranslation();
  const {
    settings,
    setVrmModelPath,
    setAvatarSettings,
    setAvatarName,
    setAvatarPersonalityPrompt,
  } = useSettingsStore();
  const {
    setEmotion,
    emotion,
    manualRotation,
    setManualRotation,
    isLoaded,
    isMotionSequenceActive,
    motionSequenceIndex,
    motionSequenceTotal,
    startMotionSequenceDemo,
    stopMotionSequenceDemo,
  } = useAvatarStore();
  const { speak, isSpeaking, stop, error: ttsError } = useSpeechSynthesis();

  const savedInitialView = settings.avatar?.initialViewRotation || { x: 0, y: 0 };
  const avatarName = settings.avatarName?.trim() || '아바타';
  const avatarPersonalityPrompt = settings.avatarPersonalityPrompt ?? '';
  const ttsSample = `안녕 나는 ${avatarName}이라고 해`;
  const isDevBuild = import.meta.env.DEV;
  const totalMotionCount = getMotionManifest().length;
  const faceOnlyModeEnabled = settings.avatar?.animation?.faceExpressionOnlyMode ?? false;

  const formatDegrees = (radian: number) => `${(radian * 180 / Math.PI).toFixed(1)}°`;

  const handleMotionSequenceToggle = () => {
    if (faceOnlyModeEnabled) return;

    if (isMotionSequenceActive) {
      stopMotionSequenceDemo();
      return;
    }

    startMotionSequenceDemo(totalMotionCount);
  };

  const handleSelectVRM = async () => {
    try {
      const selected = await pickVrmFile();
      if (selected) {
        setVrmModelPath(selected);
      }
    } catch (error) {
      console.error('Error selecting VRM file:', error);
    }
  };

  const emotions = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'relaxed', 'thinking'] as const;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-800">
        {t('settings.avatar.title')}
      </h3>

      {/* VRM Model Path */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.avatar.model')}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.vrmModelPath}
            placeholder="선택된 VRM 파일 없음"
            readOnly
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm"
          />
          <button
            onClick={handleSelectVRM}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('settings.avatar.select')}
          </button>
        </div>
      </div>

      {/* Avatar Name */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.avatar.name', '아바타 이름')}
        </label>
        <input
          type="text"
          value={settings.avatarName}
          onChange={(e) => setAvatarName(e.target.value)}
          placeholder={t('settings.avatar.namePlaceholder', '예: 은연')}
          maxLength={40}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Avatar Personality Prompt */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.avatar.personalityPrompt', '성격 가이드 프롬프트')}
        </label>
        <textarea
          value={avatarPersonalityPrompt}
          onChange={(e) => setAvatarPersonalityPrompt(e.target.value)}
          placeholder={t(
            'settings.avatar.personalityPromptPlaceholder',
            '예: 밝고 장난기 있지만, 답변은 간결하고 공감 먼저 표현해줘'
          )}
          maxLength={800}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-y"
        />
        <p className="text-xs text-gray-500 text-right">
          {avatarPersonalityPrompt.length}/800
        </p>
      </div>

      {/* Avatar Scale */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.avatar.scale', 'Avatar Size')}: {settings.avatar?.scale?.toFixed(1) || '1.0'}x
        </label>
        <input
          type="range"
          min="0.3"
          max="2.0"
          step="0.1"
          value={settings.avatar?.scale || 1.0}
          onChange={(e) => setAvatarSettings({ scale: parseFloat(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0.3x</span>
          <span>1.0x</span>
          <span>2.0x</span>
        </div>
      </div>

      {/* Expression Control */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.avatar.expression', 'Expression')}
        </label>
        <div className="flex flex-wrap gap-2">
          {emotions.map((em) => (
            <button
              key={em}
              onClick={() => setEmotion(em)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                emotion === em
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      {/* Initial View Rotation */}
      <div className="space-y-2 border-t pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-700">Initial View</h4>
        <p className="text-xs text-gray-500">
          머리 드래그로 시선을 맞춘 뒤 저장하면, 앱 시작 시 동일한 시선을 적용합니다.
        </p>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setAvatarSettings({
              initialViewRotation: {
                x: Math.max(-0.5, Math.min(0.5, manualRotation.x)),
                y: manualRotation.y,
              },
            })}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            현재 시선 저장
          </button>
          <button
            onClick={() => setManualRotation({
              x: savedInitialView.x,
              y: savedInitialView.y,
            })}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            저장 시선 적용
          </button>
          <button
            onClick={() => {
              const resetRotation = { x: 0, y: 0 };
              setAvatarSettings({ initialViewRotation: resetRotation });
              setManualRotation(resetRotation);
            }}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            정면 초기화
          </button>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>
            저장된 초기 시선: 상하 {formatDegrees(savedInitialView.x)} / 좌우 {formatDegrees(savedInitialView.y)}
          </p>
          <p>
            현재 시선: 상하 {formatDegrees(manualRotation.x)} / 좌우 {formatDegrees(manualRotation.y)}
          </p>
        </div>
      </div>

      {/* TTS Test */}
      <div className="space-y-2 border-t pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-700">TTS Test</h4>
        <p className="text-xs text-gray-500">Test text-to-speech with lip sync</p>
        <button
          onClick={() => {
            if (isSpeaking) {
              stop();
            } else {
              speak(ttsSample);
            }
          }}
          disabled={false}
          className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            isSpeaking
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          {isSpeaking ? 'Stop' : `Speak: "${ttsSample}"`}
        </button>
        {ttsError && (
          <p className="text-xs text-red-600 break-all">
            TTS Error: {ttsError}
          </p>
        )}
      </div>

      {/* Animation Settings */}
      <div className="space-y-3 border-t pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-700">Animation</h4>

        {isDevBuild && (
          <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-blue-900">
                Motion Sequence Demo
              </label>
              <button
                type="button"
                onClick={handleMotionSequenceToggle}
                disabled={
                  !isLoaded ||
                  totalMotionCount === 0 ||
                  faceOnlyModeEnabled ||
                  !(settings.avatar?.animation?.enableMotionClips ?? true)
                }
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  isMotionSequenceActive
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed`}
              >
                {isMotionSequenceActive ? '중지' : '시퀀스 실행'}
              </button>
            </div>
            <p className="text-xs text-blue-900/90">
              개발빌드 전용 기능: 각 모션 실행 전에 말풍선/음성 안내 후 순차 실행합니다.
            </p>
            <p className="text-xs text-blue-900/80">
              {isMotionSequenceActive
                ? `진행중: ${Math.max(1, motionSequenceIndex + 1)}/${Math.max(1, motionSequenceTotal)}`
                : `대기중: 총 ${totalMotionCount}개 모션`}
            </p>
            {!(settings.avatar?.animation?.enableMotionClips ?? true) && (
              <p className="text-xs text-amber-700">
                Motion Clips가 꺼져 있으면 데모를 시작할 수 없습니다.
              </p>
            )}
            {faceOnlyModeEnabled && (
              <p className="text-xs text-amber-700">
                Face/Expression Only 모드에서는 데모를 실행할 수 없습니다.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">Face/Expression Only Mode</label>
          <button
            onClick={() => setAvatarSettings({
              animation: {
                ...settings.avatar?.animation,
                faceExpressionOnlyMode: !faceOnlyModeEnabled,
              },
            })}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              faceOnlyModeEnabled ? 'bg-emerald-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                faceOnlyModeEnabled ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        {faceOnlyModeEnabled && (
          <p className="text-xs text-emerald-700">
            전신 모션(클립/제스처/댄스)을 비활성화하고 표정, 얼굴 방향, 시선만 유지합니다.
          </p>
        )}

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">Enable Motion Clips</label>
          <button
            onClick={() => setAvatarSettings({
              animation: {
                ...settings.avatar?.animation,
                enableMotionClips: !(settings.avatar?.animation?.enableMotionClips ?? true),
              },
            })}
            disabled={faceOnlyModeEnabled}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.avatar?.animation?.enableMotionClips ?? true ? 'bg-blue-600' : 'bg-gray-300'
            } ${faceOnlyModeEnabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.avatar?.animation?.enableMotionClips ?? true ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">Dynamic Motion Boost</label>
          <button
            onClick={() => setAvatarSettings({
              animation: {
                ...settings.avatar?.animation,
                dynamicMotionEnabled: !(settings.avatar?.animation?.dynamicMotionEnabled ?? false),
              },
            })}
            disabled={faceOnlyModeEnabled}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.avatar?.animation?.dynamicMotionEnabled ?? false ? 'bg-emerald-600' : 'bg-gray-300'
            } ${faceOnlyModeEnabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.avatar?.animation?.dynamicMotionEnabled ?? false ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-gray-600">
            Dynamic Boost Strength: {((settings.avatar?.animation?.dynamicMotionBoost ?? 1.0) * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={settings.avatar?.animation?.dynamicMotionBoost ?? 1.0}
            onChange={(e) => setAvatarSettings({
              animation: {
                ...settings.avatar?.animation,
                dynamicMotionBoost: parseFloat(e.target.value),
              },
            })}
            disabled={faceOnlyModeEnabled || !(settings.avatar?.animation?.dynamicMotionEnabled ?? false)}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-gray-600">
            Motion Diversity: {((settings.avatar?.animation?.motionDiversity ?? 1.0) * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.avatar?.animation?.motionDiversity ?? 1.0}
            onChange={(e) => setAvatarSettings({
              animation: {
                ...settings.avatar?.animation,
                motionDiversity: parseFloat(e.target.value),
              },
            })}
            disabled={faceOnlyModeEnabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">Enable Gesture Fallback</label>
          <button
            onClick={() => setAvatarSettings({
              animation: {
                ...settings.avatar?.animation,
                enableGestures: !settings.avatar?.animation?.enableGestures,
              },
            })}
            disabled={faceOnlyModeEnabled}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.avatar?.animation?.enableGestures ? 'bg-blue-600' : 'bg-gray-300'
            } ${faceOnlyModeEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.avatar?.animation?.enableGestures ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Physics Settings */}
      <div className="space-y-2 border-t pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-700">Physics</h4>

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">Enable Physics</label>
          <button
            onClick={() => setAvatarSettings({
              physics: {
                ...settings.avatar?.physics,
                enabled: !settings.avatar?.physics?.enabled,
              },
            })}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.avatar?.physics?.enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.avatar?.physics?.enabled ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        {settings.avatar?.physics?.enabled && (
          <>
            <div className="space-y-1">
              <label className="block text-xs text-gray-600">
                Gravity: {(settings.avatar?.physics?.gravityMultiplier ?? 1.0).toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                value={settings.avatar?.physics?.gravityMultiplier ?? 1.0}
                onChange={(e) => setAvatarSettings({
                  physics: {
                    ...settings.avatar?.physics,
                    gravityMultiplier: parseFloat(e.target.value),
                  },
                })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-gray-600">
                Stiffness: {(settings.avatar?.physics?.stiffnessMultiplier ?? 1.0).toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                value={settings.avatar?.physics?.stiffnessMultiplier ?? 1.0}
                onChange={(e) => setAvatarSettings({
                  physics: {
                    ...settings.avatar?.physics,
                    stiffnessMultiplier: parseFloat(e.target.value),
                  },
                })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </>
        )}
      </div>

      {/* Lighting Intensity */}
      <div className="space-y-2 border-t pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-700">
          {t('settings.avatar.lighting', 'Lighting')}
        </h4>

        <div className="space-y-1">
          <label className="block text-xs text-gray-600">
            Ambient: {(settings.avatar?.lighting?.ambientIntensity ?? 1.0).toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            value={settings.avatar?.lighting?.ambientIntensity ?? 1.0}
            onChange={(e) => setAvatarSettings({
              lighting: {
                ...settings.avatar?.lighting,
                ambientIntensity: parseFloat(e.target.value),
              },
            })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-gray-600">
            Directional: {(settings.avatar?.lighting?.directionalIntensity ?? 1.0).toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            value={settings.avatar?.lighting?.directionalIntensity ?? 1.0}
            onChange={(e) => setAvatarSettings({
              lighting: {
                ...settings.avatar?.lighting,
                directionalIntensity: parseFloat(e.target.value),
              },
            })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <div className="flex items-center justify-between mt-3">
          <label className="text-sm text-gray-600">Show Light Icon</label>
          <button
            onClick={() => setAvatarSettings({
              lighting: {
                ...settings.avatar?.lighting,
                showControl: !settings.avatar?.lighting?.showControl,
              },
            })}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.avatar?.lighting?.showControl !== false ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.avatar?.lighting?.showControl !== false ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Drag the sun icon near the avatar to adjust light direction.
        </p>
      </div>

      {/* Avatar Info */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          Supported format: VRM 0.x and 1.0 models.
          Recommended file size: under 30MB for smooth performance.
        </p>
      </div>
    </div>
  );
}
