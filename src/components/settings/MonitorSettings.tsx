import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMonitorStore } from '../../stores/monitorStore';

export default function MonitorSettings() {
  const { t } = useTranslation();
  const { monitors, currentMonitorName, isMoving, fetchMonitors, moveToMonitor } =
    useMonitorStore();

  useEffect(() => {
    fetchMonitors();
  }, [fetchMonitors]);

  // Monitor 정보가 아직 로드되지 않았으면 숨김 (fetch 중). 1개만 있는 경우에도
  // 현재 디스플레이를 볼 수 있도록 목록은 항상 렌더한다.
  if (monitors.length === 0) return null;

  const hasMultiple = monitors.length > 1;

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
        {t('settings.monitor.description')}
      </p>

      <div className="space-y-2">
        {monitors.map((monitor, index) => {
          const isCurrent = monitor.name === currentMonitorName;
          const logicalWidth = Math.round(monitor.width / monitor.scale_factor);
          const logicalHeight = Math.round(monitor.height / monitor.scale_factor);
          // 단일 모니터면 이동 액션이 의미가 없으므로 버튼을 항상 비활성화.
          const clickable = hasMultiple && !isCurrent;

          return (
            <button
              key={`${monitor.name}-${index}`}
              onClick={() => clickable && moveToMonitor(index)}
              disabled={!clickable || isMoving}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors ${
                clickable ? 'hover:bg-[oklch(0.92_0.02_60_/_0.7)]' : 'cursor-default'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
              style={
                isCurrent
                  ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' }
                  : { borderColor: 'var(--hairline)' }
              }
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                  {monitor.name || t('settings.monitor.unnamed')}
                </span>
                <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                  {logicalWidth} x {logicalHeight}
                  {monitor.scale_factor !== 1 && ` (@${monitor.scale_factor}x)`}
                </span>
              </div>
              {isCurrent && (
                <span className="text-xs font-medium text-accent-ink bg-accent-soft px-2 py-0.5 rounded-full">
                  {t('settings.monitor.current')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {hasMultiple && (
        <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
          {t('settings.monitor.shortcutHint')}
        </p>
      )}
      <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
        {t('settings.monitor.physicalOnly')}
      </p>
    </div>
  );
}
