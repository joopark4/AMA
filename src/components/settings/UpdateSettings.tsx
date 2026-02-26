/**
 * UpdateSettings - 설정 패널 내 앱 업데이트 확인/설치 섹션
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAutoUpdateStore } from '../../hooks/useAutoUpdate';

export default function UpdateSettings() {
  const { t } = useTranslation();
  const {
    info,
    downloading,
    progress,
    ready,
    error,
    checking,
    checkForUpdate,
    startUpdate,
    restartApp,
  } = useAutoUpdateStore();
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    import('@tauri-apps/api/app')
      .then(({ getVersion }) => getVersion().then(setAppVersion).catch(() => {}))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-lg space-y-3">
        {/* Current version */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {t('settings.update.currentVersion')}
          </span>
          <span className="text-sm font-medium text-gray-800">
            {appVersion ? `v${appVersion}` : '...'}
          </span>
        </div>

        {/* Update available */}
        {info?.available && !ready && !downloading && (
          <p className="text-sm text-blue-600 font-medium">
            {t('update.available', { version: info.version })}
          </p>
        )}

        {/* Up to date */}
        {info !== null && !info.available && !checking && !error && (
          <p className="text-sm text-green-600">
            {t('settings.update.upToDate')}
          </p>
        )}

        {/* Ready to install */}
        {ready && (
          <p className="text-sm text-green-600 font-medium">
            {t('update.readyToInstall')}
          </p>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500">
            {t('settings.update.error')}
          </p>
        )}

        {/* Download progress */}
        {downloading && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500">{t('update.downloading')}</p>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {ready ? (
            <button
              onClick={restartApp}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('update.restart')}
            </button>
          ) : info?.available ? (
            <button
              onClick={startUpdate}
              disabled={downloading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {downloading ? t('update.downloading') : t('update.install')}
            </button>
          ) : (
            <button
              onClick={checkForUpdate}
              disabled={checking}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {checking
                ? t('settings.update.checking')
                : t('settings.update.checkButton')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
