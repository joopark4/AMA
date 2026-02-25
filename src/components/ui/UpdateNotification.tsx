import { useTranslation } from 'react-i18next';
import { useAutoUpdate } from '../../hooks/useAutoUpdate';

export default function UpdateNotification() {
  const { t } = useTranslation();
  const { info, downloading, progress, ready, startUpdate, restartApp, skipUpdate } =
    useAutoUpdate();

  if (!info?.available) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[210] w-80 rounded-xl bg-white/95 backdrop-blur-md shadow-lg border border-gray-200 p-4 space-y-3"
      data-interactive="true"
    >
      <p className="text-sm font-medium text-gray-800">
        {t('update.available', { version: info.version })}
      </p>

      {downloading && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">
            {t('update.downloading')}
          </p>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {ready && (
        <p className="text-xs text-green-600">
          {t('update.readyToInstall')}
        </p>
      )}

      <div className="flex gap-2">
        {ready ? (
          <button
            onClick={restartApp}
            className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('update.restart')}
          </button>
        ) : (
          <button
            onClick={startUpdate}
            disabled={downloading}
            className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {t('update.install')}
          </button>
        )}
        {!ready && (
          <button
            onClick={skipUpdate}
            disabled={downloading}
            className="px-3 py-1.5 text-gray-600 text-xs rounded-lg hover:bg-gray-100 disabled:text-gray-300 transition-colors"
          >
            {t('update.later')}
          </button>
        )}
      </div>
    </div>
  );
}
