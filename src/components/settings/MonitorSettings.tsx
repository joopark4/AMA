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

  // Hide when single monitor
  if (monitors.length <= 1) return null;

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

          return (
            <button
              key={`${monitor.name}-${index}`}
              onClick={() => !isCurrent && moveToMonitor(index)}
              disabled={isCurrent || isMoving}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors ${
                isCurrent ? 'cursor-default' : 'hover:bg-[oklch(0.92_0.02_60_/_0.7)]'
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

      <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
        {t('settings.monitor.shortcutHint')}
      </p>
      <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
        {t('settings.monitor.physicalOnly')}
      </p>
    </div>
  );
}
