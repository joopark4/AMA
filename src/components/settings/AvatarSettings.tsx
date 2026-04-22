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
        label={t('settings.avatar.freeMovement.title')}
        description={t('settings.avatar.freeMovement.description')}
      >
        <Toggle
          on={settings.avatar?.freeMovement ?? false}
          onChange={(on) => setAvatarSettings({ freeMovement: on })}
        />
      </Row>

      {/* Speech Bubble */}
      <Row
        label={t('settings.avatar.speechBubble.title')}
        description={t('settings.avatar.speechBubble.description')}
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
      <div className="space-y-2 border-t pt-4 mt-4" style={{ borderColor: 'var(--hairline)' }}>
        <h4 className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
          {t('settings.avatar.initialView.title')}
        </h4>
        <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
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

        <div className="text-xs space-y-1" style={{ color: 'var(--ink-3)' }}>
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
      <div className="space-y-3 border-t pt-4 mt-4" style={{ borderColor: 'var(--hairline)' }}>
        <h4 className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
          {t('settings.avatar.animation.title')}
        </h4>

        {/* 표정 전용 모드 */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col flex-1 min-w-0 pr-3">
            <label className="text-sm" style={{ color: 'var(--ink-2)' }}>{t('settings.avatar.animation.faceOnlyMode')}</label>
            {faceOnlyModeEnabled && (
              <span className="text-xs text-ok">{t('settings.avatar.animation.faceOnlyDescription')}</span>
            )}
          </div>
          <Toggle
            on={faceOnlyModeEnabled}
            onChange={(v) => setAvatarSettings({
              animation: { ...settings.avatar?.animation, faceExpressionOnlyMode: v },
            })}
          />
        </div>

        {/* ── 걷기 ── */}
        {!faceOnlyModeEnabled && (
          <div
            className="space-y-2 rounded-lg p-3"
            style={{
              background: 'oklch(1 0 0 / 0.45)',
              boxShadow: 'inset 0 0 0 1px var(--hairline)',
            }}
          >
            <h5 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-2)' }}>
              {t('settings.avatar.animation.walkingTitle')}
            </h5>

            <div className="flex items-center justify-between">
              <div className="flex flex-col flex-1 min-w-0 pr-3">
                <label
                  className="text-sm"
                  style={{ color: settings.avatar?.freeMovement ? 'var(--ink-3)' : 'var(--ink-2)' }}
                >{t('settings.avatar.animation.autoRoam')}</label>
                <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                  {settings.avatar?.freeMovement
                    ? t('settings.avatar.animation.autoRoamDisabledByFreeMove')
                    : t('settings.avatar.animation.autoRoamDesc')}
                </span>
              </div>
              <Toggle
                on={(settings.avatar?.autoRoam ?? false) && !settings.avatar?.freeMovement}
                disabled={settings.avatar?.freeMovement ?? false}
                onChange={(v) => setAvatarSettings({ autoRoam: v })}
              />
            </div>
          </div>
        )}

        {/* ── 대기 동작 ── */}
        {!faceOnlyModeEnabled && (
          <div
            className="space-y-2 rounded-lg p-3"
            style={{
              background: 'oklch(1 0 0 / 0.45)',
              boxShadow: 'inset 0 0 0 1px var(--hairline)',
            }}
          >
            <h5 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-2)' }}>
              {t('settings.avatar.animation.idleTitle')}
            </h5>

            <div className="flex items-center justify-between">
              <div className="flex flex-col flex-1 min-w-0 pr-3">
                <label className="text-sm" style={{ color: 'var(--ink-2)' }}>{t('settings.avatar.animation.enableBreathing')}</label>
                <span className="text-xs" style={{ color: 'var(--ink-3)' }}>{t('settings.avatar.animation.enableBreathingDesc')}</span>
              </div>
              <Toggle
                on={settings.avatar?.animation?.enableBreathing ?? true}
                onChange={(v) => setAvatarSettings({
                  animation: { ...settings.avatar?.animation, enableBreathing: v },
                })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col flex-1 min-w-0 pr-3">
                <label className="text-sm" style={{ color: 'var(--ink-2)' }}>{t('settings.avatar.animation.enableEyeDrift')}</label>
                <span className="text-xs" style={{ color: 'var(--ink-3)' }}>{t('settings.avatar.animation.enableEyeDriftDesc')}</span>
              </div>
              <Toggle
                on={settings.avatar?.animation?.enableEyeDrift ?? true}
                onChange={(v) => setAvatarSettings({
                  animation: { ...settings.avatar?.animation, enableEyeDrift: v },
                })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col flex-1 min-w-0 pr-3">
                <label className="text-sm" style={{ color: 'var(--ink-2)' }}>{t('settings.avatar.animation.gazeFollow')}</label>
                <span className="text-xs" style={{ color: 'var(--ink-3)' }}>{t('settings.avatar.animation.gazeFollowDesc')}</span>
              </div>
              <Toggle
                on={settings.avatar?.animation?.gazeFollow ?? true}
                onChange={(v) => setAvatarSettings({
                  animation: { ...settings.avatar?.animation, gazeFollow: v },
                })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col flex-1 min-w-0 pr-3">
                <label className="text-sm" style={{ color: 'var(--ink-2)' }}>{t('settings.avatar.animation.backchannel')}</label>
                <span className="text-xs" style={{ color: 'var(--ink-3)' }}>{t('settings.avatar.animation.backchannelDesc')}</span>
              </div>
              <Toggle
                on={settings.avatar?.animation?.backchannel ?? true}
                onChange={(v) => setAvatarSettings({
                  animation: { ...settings.avatar?.animation, backchannel: v },
                })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Physics Settings */}
      <div className="space-y-2 border-t pt-4 mt-4" style={{ borderColor: 'var(--hairline)' }}>
        <h4 className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
          {t('settings.avatar.physics.title')}
        </h4>

        <div className="flex items-center justify-between">
          <label className="text-sm" style={{ color: 'var(--ink-2)' }}>
            {t('settings.avatar.physics.enable')}
          </label>
          <Toggle
            on={settings.avatar?.physics?.enabled ?? true}
            onChange={(v) => setAvatarSettings({
              physics: { ...settings.avatar?.physics, enabled: v },
            })}
          />
        </div>

        {settings.avatar?.physics?.enabled && (
          <>
            <div className="space-y-1">
              <label className="block text-xs" style={{ color: 'var(--ink-2)' }}>
                {t('settings.avatar.physics.gravity', {
                  value: (settings.avatar?.physics?.gravityMultiplier ?? 1.0).toFixed(1),
                })}
              </label>
              <input
                type="range" min="0.2" max="2.0" step="0.1"
                value={settings.avatar?.physics?.gravityMultiplier ?? 1.0}
                onChange={(e) => setAvatarSettings({ physics: { ...settings.avatar?.physics, gravityMultiplier: parseFloat(e.target.value) } })}
                className="ama-slider"
                data-interactive="true"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs" style={{ color: 'var(--ink-2)' }}>
                {t('settings.avatar.physics.stiffness', {
                  value: (settings.avatar?.physics?.stiffnessMultiplier ?? 1.0).toFixed(1),
                })}
              </label>
              <input
                type="range" min="0.2" max="2.0" step="0.1"
                value={settings.avatar?.physics?.stiffnessMultiplier ?? 1.0}
                onChange={(e) => setAvatarSettings({ physics: { ...settings.avatar?.physics, stiffnessMultiplier: parseFloat(e.target.value) } })}
                className="ama-slider"
                data-interactive="true"
              />
            </div>
          </>
        )}
      </div>

      {/* Lighting Intensity */}
      <div className="space-y-2 border-t pt-4 mt-4" style={{ borderColor: 'var(--hairline)' }}>
        <h4 className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
          {t('settings.avatar.lighting.title')}
        </h4>

        <div className="space-y-1">
          <label className="block text-xs" style={{ color: 'var(--ink-2)' }}>
            {t('settings.avatar.lighting.ambient', {
              value: (settings.avatar?.lighting?.ambientIntensity ?? 1.0).toFixed(1),
            })}
          </label>
          <input
            type="range" min="0" max="3" step="0.1"
            value={settings.avatar?.lighting?.ambientIntensity ?? 1.0}
            onChange={(e) => setAvatarSettings({ lighting: { ...settings.avatar?.lighting, ambientIntensity: parseFloat(e.target.value) } })}
            className="ama-slider"
            data-interactive="true"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs" style={{ color: 'var(--ink-2)' }}>
            {t('settings.avatar.lighting.directional', {
              value: (settings.avatar?.lighting?.directionalIntensity ?? 1.0).toFixed(1),
            })}
          </label>
          <input
            type="range" min="0" max="3" step="0.1"
            value={settings.avatar?.lighting?.directionalIntensity ?? 1.0}
            onChange={(e) => setAvatarSettings({ lighting: { ...settings.avatar?.lighting, directionalIntensity: parseFloat(e.target.value) } })}
            className="ama-slider"
            data-interactive="true"
          />
        </div>

        <div className="flex items-center justify-between mt-3">
          <label className="text-sm" style={{ color: 'var(--ink-2)' }}>
            {t('settings.avatar.lighting.showIcon')}
          </label>
          <Toggle
            on={settings.avatar?.lighting?.showControl !== false}
            onChange={(v) => setAvatarSettings({ lighting: { ...settings.avatar?.lighting, showControl: v } })}
          />
        </div>

        <p className="text-xs mt-2" style={{ color: 'var(--ink-3)' }}>
          {t('settings.avatar.lighting.dragHint')}
        </p>
      </div>

    </div>
  );
}
