/**
 * DependencyGuideModal — 의존성 이슈 상세 가이드 모달.
 *
 * ControlCluster에서 생성한 DependencyIssue 목록을 카드 형태로 나열.
 * 우상단 '설정 열기' / '닫기' 액션 버튼 포함.
 */
import { useTranslation } from 'react-i18next';
import type { DependencyIssue } from './dependencyIssues';

export function DependencyGuideModal({
  issues,
  onClose,
  onOpenSettings,
}: {
  issues: DependencyIssue[];
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'oklch(0.2 0 0 / 0.6)' }}
      data-interactive="true"
    >
      <div
        className="glass-strong w-full max-w-2xl max-h-[80vh] overflow-y-auto p-5 scroll"
        style={{ borderRadius: 'var(--r-lg)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
            {t('dependency.guideTitle')}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-3 py-1 text-xs rounded-md text-white"
              style={{ background: 'var(--accent)' }}
            >
              {t('dependency.openSettings')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-xs rounded-md"
              style={{ background: 'oklch(1 0 0 / 0.6)', color: 'var(--ink)' }}
            >
              {t('dependency.close')}
            </button>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className="p-3"
              style={{
                border: '1px solid var(--hairline)',
                borderRadius: 'var(--r-sm)',
                background: 'oklch(1 0 0 / 0.4)',
              }}
            >
              <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {issue.title}
              </div>
              <div className="mt-1 text-xs" style={{ color: 'var(--ink-2)' }}>
                {issue.summary}
              </div>
              <ol
                className="mt-2 list-decimal list-inside space-y-1 text-xs"
                style={{ color: 'var(--ink-2)' }}
              >
                {issue.steps.map((step, index) => (
                  <li key={`${issue.id}-${index}`}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
