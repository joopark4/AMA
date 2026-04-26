/**
 * ModelDownloadModal — 첫 실행 시 필수 모델(Supertonic + Whisper) 다운로드 (v2 리디자인).
 *
 * 기존 기능 유지: Supertonic/Whisper 상태 표시, 진행률 바, 에러 표시.
 * 디자인: white/blue → glass-strong + accent + ok/danger 톤.
 */
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
      <div
        className="absolute inset-0"
        style={{
          background: 'oklch(0.2 0 0 / 0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />
      <div
        className="glass-strong relative w-full max-w-lg"
        style={{
          padding: 24,
          borderRadius: 'var(--r-lg)',
          animation: 'scaleIn 280ms var(--ease)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
        data-interactive="true"
      >
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            {t('modelDownload.title')}
          </h2>
          <p
            style={{
              fontSize: 13,
              color: 'var(--ink-2)',
              marginTop: 4,
              lineHeight: 1.55,
            }}
          >
            {t('modelDownload.description')}
          </p>
        </div>

        {/* Model list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ModelRow
            name={t('modelDownload.supertonic')}
            size="~257 MB"
            ready={!supertonicNeeded}
            readyLabel={t('modelDownload.ready')}
            requiredLabel={t('modelDownload.required')}
          />
          <ModelRow
            name={t('modelDownload.whisperBase')}
            size="~142 MB"
            ready={!whisperBaseNeeded}
            readyLabel={t('modelDownload.ready')}
            requiredLabel={t('modelDownload.required')}
          />
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
          {t('modelDownload.totalSize', { size: '~400 MB' })}
        </p>

        {/* Progress */}
        {isDownloading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              className="flex items-center justify-between"
              style={{ fontSize: 11.5, color: 'var(--ink-2)' }}
            >
              <span>
                {progress
                  ? t('modelDownload.fileProgress', {
                      fileName: progress.fileName,
                      current: progress.fileIndex,
                      total: progress.totalFiles,
                    })
                  : t('modelDownload.downloading')}
              </span>
              <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
                {overallPercent}%
              </span>
            </div>

            {/* Overall progress bar */}
            <ProgressBar percent={overallPercent} />

            {/* File-level progress */}
            {progress && progress.totalBytes > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <ProgressBar percent={filePercent} thin />
                <p
                  className="text-right"
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-3)',
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  }}
                >
                  {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>
            {t('modelDownload.error', { error })}
          </p>
        )}

        {/* Action button */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-full focus-ring"
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: isDownloading ? 'oklch(0.85 0.005 60)' : 'var(--accent)',
            color: isDownloading ? 'var(--ink-3)' : 'white',
            fontSize: 13.5,
            fontWeight: 500,
            cursor: isDownloading ? 'not-allowed' : 'pointer',
            transition: 'background 200ms var(--ease)',
          }}
          data-interactive="true"
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

/* ─── 보조 컴포넌트 ─── */

function ModelRow({
  name,
  size,
  ready,
  readyLabel,
  requiredLabel,
}: {
  name: string;
  size: string;
  ready: boolean;
  readyLabel: string;
  requiredLabel: string;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: 'oklch(1 0 0 / 0.55)',
        boxShadow: 'inset 0 0 0 1px var(--hairline)',
      }}
    >
      <div>
        <p
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: 'var(--ink)',
          }}
        >
          {name}
        </p>
        <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{size}</p>
      </div>
      <span
        style={{
          fontSize: 11,
          padding: '3px 9px',
          borderRadius: 99,
          background: ready ? 'oklch(0.95 0.05 160 / 0.7)' : 'oklch(0.95 0.04 25 / 0.7)',
          color: ready ? 'var(--ok)' : 'var(--danger)',
          fontWeight: 600,
        }}
      >
        {ready ? readyLabel : requiredLabel}
      </span>
    </div>
  );
}

function ProgressBar({ percent, thin }: { percent: number; thin?: boolean }) {
  return (
    <div
      className="w-full overflow-hidden"
      style={{
        height: thin ? 4 : 8,
        background: 'oklch(0.85 0.005 60)',
        borderRadius: 99,
      }}
    >
      <div
        style={{
          width: `${percent}%`,
          height: '100%',
          background: 'var(--accent)',
          borderRadius: 99,
          transition: 'width 220ms var(--ease)',
        }}
      />
    </div>
  );
}
