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
      <p className="text-sm text-gray-500">
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
                isCurrent
                  ? 'border-blue-500 bg-blue-50 cursor-default'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-800">
                  {monitor.name || t('settings.monitor.unnamed')}
                </span>
                <span className="text-xs text-gray-500">
                  {logicalWidth} x {logicalHeight}
                  {monitor.scale_factor !== 1 && ` (@${monitor.scale_factor}x)`}
                </span>
              </div>
              {isCurrent && (
                <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                  {t('settings.monitor.current')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">
        {t('settings.monitor.shortcutHint')}
      </p>
      <p className="text-xs text-gray-400">
        {t('settings.monitor.physicalOnly')}
      </p>
    </div>
  );
}
