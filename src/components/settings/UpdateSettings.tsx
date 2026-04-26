/**
 * UpdateSettings — 앱 업데이트 확인/다운로드/설치 (v2 리디자인).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { FolderOpen } from 'lucide-react';
import { useAutoUpdateStore } from '../../hooks/useAutoUpdate';
import { Row } from './forms';

export default function UpdateSettings() {
  const { t } = useTranslation();
  const {
    info,
    downloading,
    progress,
    ready,
    error,
    checking,
    lastCheckedAt,
    checkForUpdate,
    startUpdate,
    restartApp,
  } = useAutoUpdateStore();
  const [appVersion, setAppVersion] = useState('');

  const lastCheckedLabel = lastCheckedAt
    ? new Date(lastCheckedAt).toLocaleString()
    : null;

  const friendlyErrorKey = (() => {
    if (!error) return null;
    const msg = error.toLowerCase();
    if (
      msg.includes('404') ||
      msg.includes('not found') ||
      msg.includes('could not fetch') ||
      msg.includes('no such file') ||
      msg.includes('release json')
    ) {
      return 'settings.update.errorNotAvailable';
    }
    if (msg.includes('signature') || msg.includes('verify') || msg.includes('pubkey')) {
      return 'settings.update.errorSignature';
    }
    if (
      msg.includes('timeout') ||
      msg.includes('dns') ||
      msg.includes('offline') ||
      msg.includes('connection refused') ||
      msg.includes('connect error') ||
      msg.includes('unreachable')
    ) {
      return 'settings.update.errorNetwork';
    }
    return 'settings.update.errorRetry';
  })();

  useEffect(() => {
    import('@tauri-apps/api/app')
      .then(({ getVersion }) => getVersion().then(setAppVersion).catch(() => {}))
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* 현재 버전 */}
      <Row
        label={t('settings.update.currentVersion')}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--ink)',
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          }}
        >
          {appVersion ? `v${appVersion}` : '...'}
        </span>
      </Row>

      {/* 상태 메시지 */}
      {info?.available && !ready && !downloading && (
        <div style={{ fontSize: 12.5, color: 'var(--accent-ink)', fontWeight: 500, marginTop: 4 }}>
          {t('update.available', { version: info.version })}
        </div>
      )}
      {info !== null && !info.available && !checking && !error && (
        <div style={{ fontSize: 12.5, color: 'var(--ok)', marginTop: 4 }}>
          {t('settings.update.upToDate')}
        </div>
      )}
      {ready && (
        <div style={{ fontSize: 12.5, color: 'var(--ok)', fontWeight: 500, marginTop: 4 }}>
          {t('update.readyToInstall')}
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 4, wordBreak: 'break-word' }}>
          {t('settings.update.error')}
          {friendlyErrorKey && (
            <span style={{ color: 'var(--ink-3)', fontWeight: 400, marginLeft: 6 }}>
              · {t(friendlyErrorKey)}
            </span>
          )}
        </div>
      )}

      {lastCheckedLabel && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>
          {t('settings.update.lastChecked', { time: lastCheckedLabel })}
        </div>
      )}

      {/* 다운로드 진행률 */}
      {downloading && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 4 }}>
            {t('update.downloading')} · {progress}%
          </div>
          <div
            style={{
              width: '100%',
              height: 6,
              background: 'oklch(0.85 0.005 60)',
              borderRadius: 99,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'var(--accent)',
                transition: 'width 220ms var(--ease)',
              }}
            />
          </div>
        </div>
      )}

      {/* 모델 폴더 열기 */}
      <button
        type="button"
        onClick={async () => {
          try {
            const modelPath = await invoke<string>('get_models_dir');
            await invoke('open_folder_in_finder', { path: modelPath });
          } catch (e) {
            console.error('Failed to open model folder:', e);
          }
        }}
        className="w-full focus-ring"
        style={{
          marginTop: 12,
          padding: '8px 12px',
          fontSize: 12,
          color: 'var(--ink-2)',
          background: 'oklch(1 0 0 / 0.7)',
          boxShadow: 'inset 0 0 0 1px var(--hairline)',
          borderRadius: 10,
          textAlign: 'left',
        }}
        data-interactive="true"
      >
        <span className="inline-flex items-center" style={{ gap: 8 }}>
          <FolderOpen size={13} />
          {t('settings.update.modelFolder')}
        </span>
      </button>

      {/* 액션 버튼 */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ready ? (
          <button
            type="button"
            onClick={restartApp}
            className="w-full focus-ring"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'var(--accent)',
              color: 'white',
              fontSize: 13,
              fontWeight: 500,
            }}
            data-interactive="true"
          >
            {t('update.restart')}
          </button>
        ) : info?.available ? (
          <>
            <button
              type="button"
              onClick={startUpdate}
              disabled={downloading}
              className="w-full focus-ring"
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: downloading ? 'oklch(0.85 0.005 60)' : 'var(--accent)',
                color: downloading ? 'var(--ink-3)' : 'white',
                fontSize: 13,
                fontWeight: 500,
                cursor: downloading ? 'not-allowed' : 'pointer',
              }}
              data-interactive="true"
            >
              {downloading ? t('update.downloading') : t('update.install')}
            </button>
            <button
              type="button"
              onClick={checkForUpdate}
              disabled={checking || downloading}
              className="w-full focus-ring"
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'transparent',
                color: 'var(--ink-2)',
                fontSize: 12,
                boxShadow: 'inset 0 0 0 1px var(--hairline)',
                opacity: checking || downloading ? 0.5 : 1,
                cursor: checking || downloading ? 'not-allowed' : 'pointer',
              }}
              data-interactive="true"
            >
              {checking ? t('settings.update.checking') : t('settings.update.checkButton')}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={checkForUpdate}
            disabled={checking}
            className="w-full focus-ring"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'var(--accent-soft)',
              color: 'var(--accent-ink)',
              fontSize: 13,
              fontWeight: 500,
              opacity: checking ? 0.6 : 1,
              cursor: checking ? 'not-allowed' : 'pointer',
            }}
            data-interactive="true"
          >
            {checking ? t('settings.update.checking') : t('settings.update.checkButton')}
          </button>
        )}
      </div>
    </div>
  );
}
