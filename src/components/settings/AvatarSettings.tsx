import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAvatarStore } from '../../stores/avatarStore';
import { pickVrmFile } from '../../services/tauri/fileDialog';
import { isDefaultVrmAvailable } from '../../services/tauri/defaultVrm';

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
  } = useAvatarStore();
  const savedInitialView = settings.avatar?.initialViewRotation || { x: 0, y: 0 };
  const avatarPersonalityPrompt = settings.avatarPersonalityPrompt ?? '';
  const faceOnlyModeEnabled = settings.avatar?.animation?.faceExpressionOnlyMode ?? false;
  const [hasDefaultVrm, setHasDefaultVrm] = useState(false);
  const isUsingDefaultVrm = !settings.vrmModelPath?.trim() && hasDefaultVrm;

  useEffect(() => {
    isDefaultVrmAvailable().then(setHasDefaultVrm).catch(() => setHasDefaultVrm(false));
  }, []);

  const formatDegrees = (radian: number) => `${(radian * 180 / Math.PI).toFixed(1)}°`;

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
      {/* VRM Model Path */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.avatar.model')}
        </label>
        {isUsingDefaultVrm && (
          <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            {t('settings.avatar.defaultVrmLabel')}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.vrmModelPath}
            placeholder={isUsingDefaultVrm ? t('settings.avatar.defaultVrmLabel') : t('settings.avatar.vrmPlaceholder')}
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
        {settings.vrmModelPath?.trim() && hasDefaultVrm && (
          <button
            onClick={() => setVrmModelPath('')}
            className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            {t('settings.avatar.useDefaultVrm')}
          </button>
        )}
      </div>

      {/* Avatar Name */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.avatar.name')}
        </label>
        <input
          type="text"
          value={settings.avatarName}
          onChange={(e) => setAvatarName(e.target.value)}
          placeholder={t('settings.avatar.namePlaceholder')}
          maxLength={40}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Avatar Personality Prompt */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.avatar.personalityPrompt')}
        </label>
        <textarea
          value={avatarPersonalityPrompt}
          onChange={(e) => setAvatarPersonalityPrompt(e.target.value)}
          placeholder={t('settings.avatar.personalityPromptPlaceholder')}
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
          {t('settings.avatar.scale')}: {settings.avatar?.scale?.toFixed(1) || '1.0'}x
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

      {/* Free Movement Mode */}
      <div className="flex items-center justify-between py-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-700">
            {t('settings.avatar.freeMovement.title')}
          </span>
          <span className="text-xs text-gray-500">
            {t('settings.avatar.freeMovement.description')}
          </span>
        </div>
        <button
          onClick={() => setAvatarSettings({ freeMovement: !(settings.avatar?.freeMovement ?? false) })}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
            settings.avatar?.freeMovement ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              settings.avatar?.freeMovement ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      {/* Speech Bubble Toggle */}
      <div className="flex items-center justify-between py-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-700">
            {t('settings.avatar.speechBubble.title')}
          </span>
          <span className="text-xs text-gray-500">
            {t('settings.avatar.speechBubble.description')}
          </span>
        </div>
        <button
          onClick={() => setAvatarSettings({ showSpeechBubble: !(settings.avatar?.showSpeechBubble ?? true) })}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
            settings.avatar?.showSpeechBubble !== false ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              settings.avatar?.showSpeechBubble !== false ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      {/* Expression Control */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.avatar.expression')}
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
              {t(`settings.avatar.emotions.${em}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Initial View Rotation */}
      <div className="space-y-2 border-t pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-700">
          {t('settings.avatar.initialView.title')}
        </h4>
        <p className="text-xs text-gray-500">
          {t('settings.avatar.initialView.description')}
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
            {t('settings.avatar.initialView.saveCurrent')}
          </button>
          <button
            onClick={() => setManualRotation({
              x: savedInitialView.x,
              y: savedInitialView.y,
            })}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            {t('settings.avatar.initialView.applySaved')}
          </button>
          <button
            onClick={() => {
              const resetRotation = { x: 0, y: 0 };
              setAvatarSettings({ initialViewRotation: resetRotation });
              setManualRotation(resetRotation);
            }}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            {t('settings.avatar.initialView.resetFront')}
          </button>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>
            {t('settings.avatar.initialView.savedInfo', {
              vertical: formatDegrees(savedInitialView.x),
              horizontal: formatDegrees(savedInitialView.y),
            })}
          </p>
          <p>
            {t('settings.avatar.initialView.currentInfo', {
              vertical: formatDegrees(manualRotation.x),
              horizontal: formatDegrees(manualRotation.y),
            })}
          </p>
        </div>
      </div>

      {/* Animation Settings */}
      <div className="space-y-3 border-t pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-700">
          {t('settings.avatar.animation.title')}
        </h4>

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">
            {t('settings.avatar.animation.faceOnlyMode')}
          </label>
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
            {t('settings.avatar.animation.faceOnlyDescription')}
          </p>
        )}

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">
            {t('settings.avatar.animation.enableMotionClips')}
          </label>
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
          <label className="text-sm text-gray-600">
            {t('settings.avatar.animation.dynamicMotionBoost')}
          </label>
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
            {t('settings.avatar.animation.dynamicBoostStrength', {
              value: ((settings.avatar?.animation?.dynamicMotionBoost ?? 1.0) * 100).toFixed(0),
            })}
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
            {t('settings.avatar.animation.motionDiversity', {
              value: ((settings.avatar?.animation?.motionDiversity ?? 1.0) * 100).toFixed(0),
            })}
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
          <label className="text-sm text-gray-600">
            {t('settings.avatar.animation.enableGestureFallback')}
          </label>
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

        {/* ── 걷기 ── */}
        {!faceOnlyModeEnabled && (
          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {t('settings.avatar.animation.walkingTitle')}
            </h5>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <label className={`text-sm ${settings.avatar?.freeMovement ? 'text-gray-400' : 'text-gray-600'}`}>{t('settings.avatar.animation.autoRoam')}</label>
                <span className="text-xs text-gray-400">
                  {settings.avatar?.freeMovement
                    ? t('settings.avatar.animation.autoRoamDisabledByFreeMove')
                    : t('settings.avatar.animation.autoRoamDesc')}
                </span>
              </div>
              <button
                onClick={() => !settings.avatar?.freeMovement && setAvatarSettings({ autoRoam: !(settings.avatar?.autoRoam ?? false) })}
                disabled={settings.avatar?.freeMovement ?? false}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings.avatar?.autoRoam && !settings.avatar?.freeMovement ? 'bg-blue-600' : 'bg-gray-300'} ${settings.avatar?.freeMovement ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${settings.avatar?.autoRoam && !settings.avatar?.freeMovement ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {/* ── 대기 동작 ── */}
        {!faceOnlyModeEnabled && (
          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {t('settings.avatar.animation.idleTitle')}
            </h5>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <label className="text-sm text-gray-600">{t('settings.avatar.animation.enableBreathing')}</label>
                <span className="text-xs text-gray-400">{t('settings.avatar.animation.enableBreathingDesc')}</span>
              </div>
              <button
                onClick={() => setAvatarSettings({
                  animation: { ...settings.avatar?.animation, enableBreathing: !(settings.avatar?.animation?.enableBreathing ?? true) },
                })}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                  (settings.avatar?.animation?.enableBreathing ?? true) ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  (settings.avatar?.animation?.enableBreathing ?? true) ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <label className="text-sm text-gray-600">{t('settings.avatar.animation.enableEyeDrift')}</label>
                <span className="text-xs text-gray-400">{t('settings.avatar.animation.enableEyeDriftDesc')}</span>
              </div>
              <button
                onClick={() => setAvatarSettings({
                  animation: { ...settings.avatar?.animation, enableEyeDrift: !(settings.avatar?.animation?.enableEyeDrift ?? true) },
                })}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                  (settings.avatar?.animation?.enableEyeDrift ?? true) ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  (settings.avatar?.animation?.enableEyeDrift ?? true) ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Physics Settings */}
      <div className="space-y-2 border-t pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-700">
          {t('settings.avatar.physics.title')}
        </h4>

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">
            {t('settings.avatar.physics.enable')}
          </label>
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
                {t('settings.avatar.physics.gravity', {
                  value: (settings.avatar?.physics?.gravityMultiplier ?? 1.0).toFixed(1),
                })}
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
                {t('settings.avatar.physics.stiffness', {
                  value: (settings.avatar?.physics?.stiffnessMultiplier ?? 1.0).toFixed(1),
                })}
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
          {t('settings.avatar.lighting.title')}
        </h4>

        <div className="space-y-1">
          <label className="block text-xs text-gray-600">
            {t('settings.avatar.lighting.ambient', {
              value: (settings.avatar?.lighting?.ambientIntensity ?? 1.0).toFixed(1),
            })}
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
            {t('settings.avatar.lighting.directional', {
              value: (settings.avatar?.lighting?.directionalIntensity ?? 1.0).toFixed(1),
            })}
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
          <label className="text-sm text-gray-600">
            {t('settings.avatar.lighting.showIcon')}
          </label>
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
          {t('settings.avatar.lighting.dragHint')}
        </p>
      </div>

    </div>
  );
}
