/**
 * DataCleanupSettings - 설정 패널 내 앱 데이터 정리 섹션
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function DataCleanupSettings() {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; size?: number; error?: string } | null>(null);

  const handleOpenFolder = async () => {
    try {
      const modelPath = await invoke<string>('get_models_dir');
      await invoke('open_folder_in_finder', { path: modelPath });
    } catch (e) {
      console.error('Failed to open model folder:', e);
    }
  };

  const handleDeleteAll = async () => {
    const confirmed = window.confirm(t('settings.dataCleanup.confirm'));
    if (!confirmed) return;

    setDeleting(true);
    setResult(null);
    try {
      const freedBytes = await invoke<number>('delete_app_data');
      setResult({ success: true, size: freedBytes });
    } catch (e) {
      setResult({ success: false, error: String(e) });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-lg space-y-3">
        <p className="text-sm text-gray-600">
          {t('settings.dataCleanup.description')}
        </p>

        {/* Open folder */}
        <button
          onClick={handleOpenFolder}
          className="w-full px-3 py-2 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-left"
        >
          {t('settings.dataCleanup.openFolder')}
        </button>

        {/* Delete all */}
        <button
          onClick={handleDeleteAll}
          disabled={deleting}
          className="w-full px-3 py-2 text-sm text-white bg-danger rounded-lg hover:bg-danger disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {deleting ? t('settings.dataCleanup.deleting') : t('settings.dataCleanup.deleteAll')}
        </button>

        {/* Result */}
        {result?.success && (
          <div className="space-y-1">
            <p className="text-sm text-ok">
              {t('settings.dataCleanup.success', { size: formatBytes(result.size ?? 0) })}
            </p>
            <p className="text-xs text-gray-500">
              {t('settings.dataCleanup.restartHint')}
            </p>
          </div>
        )}
        {result?.success === false && (
          <p className="text-sm text-danger">
            {t('settings.dataCleanup.error', { error: result.error })}
          </p>
        )}
      </div>
    </div>
  );
}
