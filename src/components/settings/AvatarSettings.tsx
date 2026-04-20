import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAvatarStore } from '../../stores/avatarStore';
import { pickVrmFile } from '../../services/tauri/fileDialog';
import { isDefaultVrmAvailable } from '../../services/tauri/defaultVrm';
import { Field, FormCard, Pill, Row, Slider, Toggle } from './forms';

export default function AvatarSettings() {
  const { t } = useTranslation();
  const {
    settings,
    setVrmModelPath,
    setAvatarSettings,
  } = useSettingsStore();
  const {
    setEmotion,
    emotion,
    manualRotation,
    setManualRotation,
  } = useAvatarStore();
  const savedInitialView = settings.avatar?.initialViewRotation || { x: 0, y: 0 };
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
    <div>
      {/* VRM Model */}
      <Field label={t('settings.avatar.model')}>
        {isUsingDefaultVrm && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              background: 'oklch(0.95 0.05 160 / 0.5)',
              boxShadow: 'inset 0 0 0 1px oklch(0.7 0.12 160 / 0.3)',
              fontSize: 12,
              color: 'var(--ok)',
              marginBottom: 8,
            }}
          >
            {t('settings.avatar.defaultVrmLabel')}
          </div>
        )}
        <FormCard padding={12}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <div className="flex-1 min-w-0">
              <div
                className="truncate"
                style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}
              >
                {settings.vrmModelPath?.trim() ||
                  (isUsingDefaultVrm
                    ? t('settings.avatar.defaultVrmLabel')
                    : t('settings.avatar.vrmPlaceholder'))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSelectVRM}
              className="focus-ring"
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--accent-ink)',
                background: 'var(--accent-soft)',
                fontWeight: 500,
              }}
              data-interactive="true"
            >
              {t('settings.avatar.select')}
            </button>
          </div>
        </FormCard>
        {settings.vrmModelPath?.trim() && hasDefaultVrm && (
          <button
            type="button"
            onClick={() => setVrmModelPath('')}
            className="w-full focus-ring"
            style={{
              marginTop: 8,
              padding: '8px 12px',
              fontSize: 12.5,
              fontWeight: 500,
              borderRadius: 10,
              background: 'oklch(1 0 0 / 0.7)',
              boxShadow: 'inset 0 0 0 1px var(--hairline)',
              color: 'var(--ink-2)',
            }}
            data-interactive="true"
          >
            {t('settings.avatar.useDefaultVrm')}
          </button>
        )}
      </Field>

      {/* Scale */}
      <Field
        label={t('settings.avatar.scale')}
        hint={`${(settings.avatar?.scale || 1.0).toFixed(1)}x`}
      >
        <Slider
          value={settings.avatar?.scale || 1.0}
          min={0.3}
          max={2.0}
          step={0.1}
          format={(v) => `${v.toFixed(1)}x`}
          onChange={(v) => setAvatarSettings({ scale: v })}
        />
      </Field>

      {/* Free Movement */}
      <Row
        label={
          <div>
            <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>
              {t('settings.avatar.freeMovement.title')}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
              {t('settings.avatar.freeMovement.description')}
            </div>
          </div>
        }
      >
        <Toggle
          on={settings.avatar?.freeMovement ?? false}
          onChange={(on) => setAvatarSettings({ freeMovement: on })}
        />
      </Row>

      {/* Speech Bubble */}
      <Row
        label={
          <div>
            <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>
              {t('settings.avatar.speechBubble.title')}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
              {t('settings.avatar.speechBubble.description')}
            </div>
          </div>
        }
      >
        <Toggle
          on={settings.avatar?.showSpeechBubble !== false}
          onChange={(on) => setAvatarSettings({ showSpeechBubble: on })}
        />
      </Row>

      {/* Expression Control */}
      <Field label={t('settings.avatar.expression')}>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {emotions.map((em) => (
            <Pill
              key={em}
              active={emotion === em}
              onClick={() => setEmotion(em)}
            >
              {t(`settings.avatar.emotions.${em}`)}
            </Pill>
          ))}
        </div>
      </Field>

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
            className="px-3 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-2 transition-colors focus-ring"
            data-interactive="true"
          >
            {t('settings.avatar.initialView.saveCurrent')}
          </button>
          <button
            onClick={() => setManualRotation({
              x: savedInitialView.x,
              y: savedInitialView.y,
            })}
            className="px-3 py-2 text-xs font-medium rounded-lg text-ink-2 transition-colors focus-ring"
            style={{
              background: 'oklch(1 0 0 / 0.7)',
              boxShadow: 'inset 0 0 0 1px var(--hairline)',
            }}
            data-interactive="true"
          >
            {t('settings.avatar.initialView.applySaved')}
          </button>
          <button
            onClick={() => {
              const resetRotation = { x: 0, y: 0 };
              setAvatarSettings({ initialViewRotation: resetRotation });
              setManualRotation(resetRotation);
            }}
            className="px-3 py-2 text-xs font-medium rounded-lg text-ink-2 transition-colors focus-ring"
            style={{
              background: 'oklch(1 0 0 / 0.7)',
              boxShadow: 'inset 0 0 0 1px var(--hairline)',
            }}
            data-interactive="true"
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

        {/* 표정 전용 모드 */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <label className="text-sm text-gray-600">{t('settings.avatar.animation.faceOnlyMode')}</label>
            {faceOnlyModeEnabled && (
              <span className="text-xs text-emerald-600">{t('settings.avatar.animation.faceOnlyDescription')}</span>
            )}
          </div>
          <button
            onClick={() => setAvatarSettings({
              animation: { ...settings.avatar?.animation, faceExpressionOnlyMode: !faceOnlyModeEnabled },
            })}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${faceOnlyModeEnabled ? 'bg-accent' : 'bg-[oklch(0.78_0.008_60)]'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${faceOnlyModeEnabled ? 'translate-x-5' : ''}`} />
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
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings.avatar?.autoRoam && !settings.avatar?.freeMovement ? 'bg-accent' : 'bg-[oklch(0.78_0.008_60)]'} ${settings.avatar?.freeMovement ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                  (settings.avatar?.animation?.enableBreathing ?? true) ? 'bg-accent' : 'bg-[oklch(0.78_0.008_60)]'
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
                  (settings.avatar?.animation?.enableEyeDrift ?? true) ? 'bg-accent' : 'bg-[oklch(0.78_0.008_60)]'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  (settings.avatar?.animation?.enableEyeDrift ?? true) ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <label className="text-sm text-gray-600">{t('settings.avatar.animation.gazeFollow')}</label>
                <span className="text-xs text-gray-400">{t('settings.avatar.animation.gazeFollowDesc')}</span>
              </div>
              <button
                onClick={() => setAvatarSettings({
                  animation: { ...settings.avatar?.animation, gazeFollow: !(settings.avatar?.animation?.gazeFollow ?? true) },
                })}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                  (settings.avatar?.animation?.gazeFollow ?? true) ? 'bg-accent' : 'bg-[oklch(0.78_0.008_60)]'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  (settings.avatar?.animation?.gazeFollow ?? true) ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <label className="text-sm text-gray-600">{t('settings.avatar.animation.backchannel')}</label>
                <span className="text-xs text-gray-400">{t('settings.avatar.animation.backchannelDesc')}</span>
              </div>
              <button
                onClick={() => setAvatarSettings({
                  animation: { ...settings.avatar?.animation, backchannel: !(settings.avatar?.animation?.backchannel ?? true) },
                })}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                  (settings.avatar?.animation?.backchannel ?? true) ? 'bg-accent' : 'bg-[oklch(0.78_0.008_60)]'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  (settings.avatar?.animation?.backchannel ?? true) ? 'translate-x-5' : ''
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
              physics: { ...settings.avatar?.physics, enabled: !settings.avatar?.physics?.enabled },
            })}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.avatar?.physics?.enabled ? 'bg-accent' : 'bg-[oklch(0.78_0.008_60)]'
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
                type="range" min="0.2" max="2.0" step="0.1"
                value={settings.avatar?.physics?.gravityMultiplier ?? 1.0}
                onChange={(e) => setAvatarSettings({ physics: { ...settings.avatar?.physics, gravityMultiplier: parseFloat(e.target.value) } })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[oklch(0.74_0.14_45)]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-gray-600">
                {t('settings.avatar.physics.stiffness', {
                  value: (settings.avatar?.physics?.stiffnessMultiplier ?? 1.0).toFixed(1),
                })}
              </label>
              <input
                type="range" min="0.2" max="2.0" step="0.1"
                value={settings.avatar?.physics?.stiffnessMultiplier ?? 1.0}
                onChange={(e) => setAvatarSettings({ physics: { ...settings.avatar?.physics, stiffnessMultiplier: parseFloat(e.target.value) } })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[oklch(0.74_0.14_45)]"
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
            type="range" min="0" max="3" step="0.1"
            value={settings.avatar?.lighting?.ambientIntensity ?? 1.0}
            onChange={(e) => setAvatarSettings({ lighting: { ...settings.avatar?.lighting, ambientIntensity: parseFloat(e.target.value) } })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[oklch(0.74_0.14_45)]"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-gray-600">
            {t('settings.avatar.lighting.directional', {
              value: (settings.avatar?.lighting?.directionalIntensity ?? 1.0).toFixed(1),
            })}
          </label>
          <input
            type="range" min="0" max="3" step="0.1"
            value={settings.avatar?.lighting?.directionalIntensity ?? 1.0}
            onChange={(e) => setAvatarSettings({ lighting: { ...settings.avatar?.lighting, directionalIntensity: parseFloat(e.target.value) } })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[oklch(0.74_0.14_45)]"
          />
        </div>

        <div className="flex items-center justify-between mt-3">
          <label className="text-sm text-gray-600">
            {t('settings.avatar.lighting.showIcon')}
          </label>
          <button
            onClick={() => setAvatarSettings({ lighting: { ...settings.avatar?.lighting, showControl: !settings.avatar?.lighting?.showControl } })}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.avatar?.lighting?.showControl !== false ? 'bg-accent' : 'bg-[oklch(0.78_0.008_60)]'
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
