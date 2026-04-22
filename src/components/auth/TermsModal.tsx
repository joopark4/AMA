/**
 * TermsModal — 이용약관/개인정보 처리방침 모달 (v2 리디자인).
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface Section {
  heading: string;
  body: string;
}

interface TermsModalProps {
  type: 'terms' | 'privacy';
  onClose: () => void;
}

export default function TermsModal({ type, onClose }: TermsModalProps) {
  const { t, i18n } = useTranslation();

  const bundle = i18n.getResourceBundle(i18n.language, 'translation') as Record<string, unknown> | undefined;
  const termsBundle = bundle?.terms as Record<string, unknown> | undefined;
  const docKey = type === 'terms' ? 'service' : 'privacy';
  const doc = termsBundle?.[docKey] as { title?: string; lastUpdated?: string; sections?: Section[] } | undefined;
  const sections: Section[] = doc?.sections ?? [];
  const version: string = (termsBundle?.version as string | undefined) ?? '';

  const titleKey = type === 'terms' ? 'auth.termsModalTitle' : 'auth.privacyModalTitle';

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const titleId = `terms-modal-title-${type}`;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-interactive="true"
    >
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        style={{
          background: 'oklch(0.2 0 0 / 0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* 모달 카드 */}
      <div
        className="glass-strong relative w-full max-w-lg flex flex-col"
        style={{
          maxHeight: '80vh',
          padding: 0,
          borderRadius: 'var(--r-lg)',
          animation: 'scaleIn 280ms var(--ease)',
        }}
        data-interactive="true"
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{
            padding: '18px 22px 16px',
            borderBottom: '1px solid var(--hairline)',
          }}
        >
          <div>
            <h2
              id={titleId}
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
              }}
            >
              {t(titleKey)}
            </h2>
            {version && (
              <p
                style={{
                  fontSize: 11.5,
                  color: 'var(--ink-3)',
                  marginTop: 2,
                }}
              >
                {t('auth.termsVersion', { version })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid place-items-center focus-ring"
            style={{
              width: 32,
              height: 32,
              borderRadius: 99,
              background: 'oklch(1 0 0 / 0.5)',
              boxShadow: 'inset 0 0 0 1px var(--hairline)',
              color: 'var(--ink-2)',
            }}
            aria-label={t('history.close')}
            data-interactive="true"
          >
            <X size={14} />
          </button>
        </div>

        {/* 본문 */}
        <div
          className="scroll overflow-y-auto"
          style={{
            padding: '16px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {doc?.lastUpdated && (
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{doc.lastUpdated}</p>
          )}
          {sections.map((section, i) => (
            <div key={i}>
              <h4
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  marginBottom: 4,
                }}
              >
                {section.heading}
              </h4>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--ink-2)',
                  lineHeight: 1.6,
                }}
              >
                {section.body}
              </p>
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <div
          className="flex-shrink-0"
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--hairline)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-full focus-ring"
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'var(--accent)',
              color: 'white',
              fontSize: 13.5,
              fontWeight: 500,
            }}
            data-interactive="true"
          >
            {t('settings.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
