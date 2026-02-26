import { useTranslation } from 'react-i18next';
import { useModelDownloadStore } from '../../stores/modelDownloadStore';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function ModelDownloadModal() {
  const { t } = useTranslation();
  const {
    status,
    isDownloading,
    progress,
    error,
    downloadRequiredModels,
    clearError,
  } = useModelDownloadStore();

  const supertonicNeeded = !status?.supertonicReady;
  const whisperBaseNeeded = !status?.whisperBaseReady;

  const filePercent =
    progress && progress.totalBytes > 0
      ? Math.round((progress.downloadedBytes / progress.totalBytes) * 100)
      : 0;

  const overallPercent =
    progress && progress.totalFiles > 0
      ? Math.round(
          ((progress.fileIndex - 1 + filePercent / 100) / progress.totalFiles) * 100
        )
      : 0;

  const handleDownload = () => {
    clearError();
    downloadRequiredModels();
  };

  return (
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center px-4"
      data-interactive="true"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-5">
        <h2 className="text-xl font-semibold text-gray-800">
          {t('modelDownload.title')}
        </h2>
        <p className="text-sm text-gray-600">
          {t('modelDownload.description')}
        </p>

        {/* Model list */}
        <div className="space-y-3">
          {/* Supertonic */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700">
                {t('modelDownload.supertonic')}
              </p>
              <p className="text-xs text-gray-500">~257 MB</p>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                supertonicNeeded
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {supertonicNeeded
                ? t('modelDownload.required')
                : t('modelDownload.ready')}
            </span>
          </div>

          {/* Whisper base */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700">
                {t('modelDownload.whisperBase')}
              </p>
              <p className="text-xs text-gray-500">~142 MB</p>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                whisperBaseNeeded
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {whisperBaseNeeded
                ? t('modelDownload.required')
                : t('modelDownload.ready')}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          {t('modelDownload.totalSize', { size: '~400 MB' })}
        </p>

        {/* Progress */}
        {isDownloading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>
                {progress
                  ? t('modelDownload.fileProgress', {
                      fileName: progress.fileName,
                      current: progress.fileIndex,
                      total: progress.totalFiles,
                    })
                  : t('modelDownload.downloading')}
              </span>
              <span>{overallPercent}%</span>
            </div>

            {/* Overall progress bar */}
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${overallPercent}%` }}
              />
            </div>

            {/* File progress bar */}
            {progress && progress.totalBytes > 0 && (
              <div className="space-y-1">
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all duration-200"
                    style={{ width: `${filePercent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 text-right">
                  {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600">
            {t('modelDownload.error', { error })}
          </p>
        )}

        {/* Action button */}
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isDownloading
            ? t('modelDownload.downloading')
            : error
              ? t('modelDownload.retry')
              : t('modelDownload.startDownload')}
        </button>
      </div>
    </div>
  );
}
