import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../stores/settingsStore';
import { screenWatchService, isVisionAvailable } from './screenWatchService';
import { useMonitorStore } from '../../stores/monitorStore';
import { Row, Toggle } from '../../components/settings/forms';
import type { CaptureTarget, ScreenWatchResponseStyle } from '../../stores/settingsStore';

const STYLES: ScreenWatchResponseStyle[] = ['balanced', 'advisor', 'comedian', 'analyst'];

interface WindowInfo {
  appName: string;
  windowTitle: string;
  windowId: number;
}

export default function ScreenWatchSettings() {
  const { t } = useTranslation();
  const { settings, setScreenWatchSettings } = useSettingsStore();
  const watch = settings.screenWatch;
  const provider = settings.llm.provider;
  const visionOk = isVisionAvailable(provider);

  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [windowsLoading, setWindowsLoading] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (!watch.enabled || !visionOk) {
      setHasPermission(null);
      return;
    }
    let cancelled = false;
    void screenWatchService.checkPermission().then((ok) => {
      if (!cancelled) setHasPermission(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [watch.enabled, visionOk]);

  const handleRequestPermission = async () => {
    const granted = await screenWatchService.requestPermission();
    setHasPermission(granted);
  };

  const loadWindows = async () => {
    setWindowsLoading(true);
    try {
      const list = await screenWatchService.listWindows();
      setWindows(list);
    } finally {
      setWindowsLoading(false);
    }
  };

  useEffect(() => {
    if (watch.captureTarget.type === 'window') {
      void loadWindows();
    }
  }, [watch.captureTarget.type]);

  const handleToggleEnabled = () => {
    const next = !watch.enabled;
    if (next) {
      setShowPrivacy(true);
    } else {
      setScreenWatchSettings({ enabled: false });
    }
  };

  const confirmEnable = () => {
    setScreenWatchSettings({ enabled: true });
    setShowPrivacy(false);
  };

  const { monitors, fetchMonitors } = useMonitorStore();

  useEffect(() => {
    if (watch.captureTarget.type === 'monitor') {
      void fetchMonitors();
    }
  }, [watch.captureTarget.type, fetchMonitors]);

  const handleTargetChange = (value: string) => {
    let target: CaptureTarget;
    switch (value) {
      case 'fullscreen':
      case 'active-window':
      case 'main-monitor':
        target = { type: value };
        break;
      case 'monitor':
        target = { type: 'monitor', monitorName: '' };
        break;
      case 'window':
        target = { type: 'window', appName: '' };
        break;
      default:
        return;
    }
    setScreenWatchSettings({ captureTarget: target });
  };

  const handleSelectMonitor = (name: string) => {
    setScreenWatchSettings({ captureTarget: { type: 'monitor', monitorName: name } });
  };

  const handleSelectWindow = (w: WindowInfo) => {
    setScreenWatchSettings({
      captureTarget: { type: 'window', appName: w.appName, windowTitle: w.windowTitle },
    });
  };

  const targetType = watch.captureTarget.type;
  const selectedAppName =
    watch.captureTarget.type === 'window' ? watch.captureTarget.appName : '';
  const selectedWindowTitle =
    watch.captureTarget.type === 'window' ? watch.captureTarget.windowTitle : '';
  const selectedMonitorName =
    watch.captureTarget.type === 'monitor' ? watch.captureTarget.monitorName : '';

  return (
    <div className="space-y-4">
      {!visionOk && (
        <div
          className="px-3 py-2 border rounded-lg text-sm"
          style={{
            background: 'oklch(0.95 0.04 75 / 0.5)',
            borderColor: 'oklch(0.7 0.15 75 / 0.4)',
            color: 'var(--warn)',
          }}
        >
          {t('settings.screenWatch.visionUnavailable', 'Vision 미지원 provider에서는 사용할 수 없습니다.')}
        </div>
      )}

      {/* Enable toggle */}
      <Row
        label={t('settings.screenWatch.enabled', '화면 관찰 활성화')}
        description={t(
          'settings.screenWatch.enabledDesc',
          '주기적으로 화면을 관찰하고 상황에 맞는 한마디를 건넵니다'
        )}
      >
        <Toggle
          on={watch.enabled && visionOk}
          disabled={!visionOk}
          onChange={() => handleToggleEnabled()}
        />
      </Row>

      {watch.enabled && visionOk && hasPermission === false && (
        <div
          className="px-3 py-2 border rounded-lg text-sm space-y-2"
          style={{
            background: 'oklch(0.95 0.04 25 / 0.5)',
            borderColor: 'oklch(0.7 0.15 25 / 0.4)',
            color: 'oklch(0.45 0.18 25)',
          }}
        >
          <div>
            {t('settings.screenWatch.permissionDenied', '화면 녹화 권한이 없습니다. 관찰이 즉시 차단됩니다.')}
          </div>
          <button
            onClick={handleRequestPermission}
            className="px-3 py-1 rounded text-white text-xs"
            style={{ background: 'var(--danger)' }}
          >
            {t('settings.screenWatch.requestPermission', '권한 요청')}
          </button>
        </div>
      )}

      {watch.enabled && (
        <>
          {/* Capture target */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
              {t('settings.screenWatch.captureTarget', '캡처 대상')}
            </label>
            <select
              value={targetType}
              onChange={(e) => handleTargetChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: 'var(--hairline)' }}
            >
              <option value="fullscreen">{t('settings.screenWatch.targets.fullscreen', '전체 화면')}</option>
              <option value="active-window">{t('settings.screenWatch.targets.activeWindow', '활성 창')}</option>
              <option value="main-monitor">{t('settings.screenWatch.targets.mainMonitor', '메인 모니터')}</option>
              <option value="monitor">{t('settings.screenWatch.targets.specificMonitor', '특정 모니터')}</option>
              <option value="window">{t('settings.screenWatch.targets.specificWindow', '특정 윈도우')}</option>
            </select>
          </div>

          {/* Monitor list */}
          {targetType === 'monitor' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                  {t('settings.screenWatch.selectMonitor', '관찰할 모니터를 선택하세요')}
                </span>
                <button
                  onClick={() => void fetchMonitors()}
                  className="text-xs px-2 py-1 rounded border hover:bg-[oklch(0.92_0.02_60_/_0.7)]"
                  style={{ borderColor: 'var(--hairline)' }}
                >
                  {t('settings.screenWatch.refresh', '🔄 새로고침')}
                </button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {monitors.length === 0 && (
                  <div
                    className="px-3 py-2 text-xs border border-dashed rounded-lg"
                    style={{ color: 'var(--ink-3)', borderColor: 'var(--hairline)' }}
                  >
                    {t('settings.screenWatch.noMonitors', '모니터 정보를 읽을 수 없습니다')}
                  </div>
                )}
                {monitors.map((m, i) => {
                  const isSelected = selectedMonitorName === m.name;
                  return (
                    <button
                      key={`${m.name}-${i}`}
                      onClick={() => handleSelectMonitor(m.name)}
                      className={`w-full px-3 py-2 text-left rounded-lg border text-sm transition-colors ${
                        isSelected ? '' : 'hover:bg-[oklch(0.92_0.02_60_/_0.7)]'
                      }`}
                      style={
                        isSelected
                          ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent-ink)' }
                          : { borderColor: 'var(--hairline)' }
                      }
                    >
                      <div className="font-medium truncate">{m.name}</div>
                      <div className="text-xs" style={{ color: 'var(--ink-3)' }}>
                        {m.width}×{m.height} @ {m.scale_factor}x ({m.x}, {m.y})
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Window list */}
          {targetType === 'window' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                  {t('settings.screenWatch.selectWindow', '관찰할 윈도우를 선택하세요')}
                </span>
                <button
                  onClick={() => void loadWindows()}
                  disabled={windowsLoading}
                  className="text-xs px-2 py-1 rounded border hover:bg-[oklch(0.92_0.02_60_/_0.7)] disabled:opacity-50"
                  style={{ borderColor: 'var(--hairline)' }}
                >
                  {windowsLoading
                    ? t('settings.screenWatch.loading', '로딩...')
                    : t('settings.screenWatch.refresh', '🔄 새로고침')}
                </button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {windows.length === 0 && !windowsLoading && (
                  <div
                    className="px-3 py-2 text-xs border border-dashed rounded-lg space-y-2"
                    style={{ color: 'var(--ink-3)', borderColor: 'var(--hairline)' }}
                  >
                    <div>
                      {t(
                        'settings.screenWatch.noWindows',
                        '열린 윈도우가 없거나 Accessibility 권한이 필요합니다'
                      )}
                    </div>
                    <button
                      onClick={() => {
                        invoke('open_accessibility_settings').catch(() => {});
                      }}
                      className="px-2 py-1 rounded text-white text-xs"
                      style={{ background: 'var(--ink)' }}
                    >
                      {t('settings.screenWatch.openAccessibility', '접근성 설정 열기')}
                    </button>
                  </div>
                )}
                {windows.map((w, i) => {
                  const isSelected =
                    selectedAppName === w.appName && (!selectedWindowTitle || selectedWindowTitle === w.windowTitle);
                  return (
                    <button
                      key={`${w.appName}-${w.windowTitle}-${i}`}
                      onClick={() => handleSelectWindow(w)}
                      className={`w-full px-3 py-2 text-left rounded-lg border text-sm transition-colors ${
                        isSelected ? '' : 'hover:bg-[oklch(0.92_0.02_60_/_0.7)]'
                      }`}
                      style={
                        isSelected
                          ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent-ink)' }
                          : { borderColor: 'var(--hairline)' }
                      }
                    >
                      <div className="font-medium truncate">{w.appName}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--ink-3)' }}>{w.windowTitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interval */}
          <div className="space-y-1">
            <label className="block text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
              {t('settings.screenWatch.interval', '관찰 간격: {{value}}초', { value: watch.intervalSeconds })}
            </label>
            <input
              type="range"
              min={30}
              max={600}
              step={30}
              value={watch.intervalSeconds}
              onChange={(e) => setScreenWatchSettings({ intervalSeconds: parseInt(e.target.value, 10) })}
              className="ama-slider"
              data-interactive="true"
            />
            <div className="flex justify-between text-xs" style={{ color: 'var(--ink-3)' }}>
              <span>30s</span>
              <span>2m</span>
              <span>10m</span>
            </div>
          </div>

          {/* Response style */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
              {t('settings.screenWatch.responseStyle', '응답 스타일')}
            </label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((style) => (
                <button
                  key={style}
                  onClick={() => setScreenWatchSettings({ responseStyle: style })}
                  className="px-3 py-1 rounded-full text-sm transition-colors hover:bg-[oklch(0.92_0.02_60_/_0.7)]"
                  style={
                    watch.responseStyle === style
                      ? { background: 'var(--accent)', color: 'white' }
                      : { background: 'oklch(1 0 0 / 0.45)', color: 'var(--ink-2)' }
                  }
                >
                  {t(`settings.screenWatch.styles.${style}`, style)}
                </button>
              ))}
            </div>
          </div>

          {/* Silent hours */}
          <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
                {t('settings.screenWatch.silentHours', '조용한 시간 (관찰 중단)')}
              </label>
              <Toggle
                on={watch.silentHours.enabled}
                onChange={(v) =>
                  setScreenWatchSettings({
                    silentHours: { ...watch.silentHours, enabled: v },
                  })
                }
              />
            </div>
            {watch.silentHours.enabled && (
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={watch.silentHours.start}
                  onChange={(e) =>
                    setScreenWatchSettings({
                      silentHours: { ...watch.silentHours, start: parseInt(e.target.value, 10) || 0 },
                    })
                  }
                  className="w-16 px-2 py-1 border rounded"
                  style={{ borderColor: 'var(--hairline)' }}
                />
                <span style={{ color: 'var(--ink-3)' }}>:00 ~</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={watch.silentHours.end}
                  onChange={(e) =>
                    setScreenWatchSettings({
                      silentHours: { ...watch.silentHours, end: parseInt(e.target.value, 10) || 0 },
                    })
                  }
                  className="w-16 px-2 py-1 border rounded"
                  style={{ borderColor: 'var(--hairline)' }}
                />
                <span style={{ color: 'var(--ink-3)' }}>:00</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Privacy confirmation dialog */}
      {showPrivacy && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div
            className="rounded-lg p-6 max-w-md mx-4 space-y-4 shadow-xl"
            style={{ background: 'oklch(1 0 0 / 0.95)' }}
          >
            <h3 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              {t('settings.screenWatch.privacyTitle', '화면 관찰 안내')}
            </h3>
            <p className="text-sm whitespace-pre-line" style={{ color: 'var(--ink-2)' }}>
              {t(
                'settings.screenWatch.privacyBody',
                '화면 데이터가 선택한 AI 서비스로 전송됩니다.\n\n민감 정보(비밀번호, 카드번호 등)가 화면에 노출되지 않도록 주의하세요. 조용한 시간 설정을 이용하면 특정 시간대 관찰을 중단할 수 있습니다.'
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPrivacy(false)}
                className="px-4 py-2 rounded-lg border text-sm hover:bg-[oklch(0.92_0.02_60_/_0.7)]"
                style={{ borderColor: 'var(--hairline)', color: 'var(--ink-2)' }}
              >
                {t('settings.screenWatch.cancel', '취소')}
              </button>
              <button
                onClick={confirmEnable}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                {t('settings.screenWatch.confirm', '동의하고 활성화')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
