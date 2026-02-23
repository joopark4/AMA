import { useTranslation } from 'react-i18next';

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

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      data-interactive="true"
    >
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 카드 */}
      <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-white shadow-2xl flex flex-col max-h-[80vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{t(titleKey)}</h2>
            {version && (
              <p className="text-xs text-gray-400 mt-0.5">{t('auth.termsVersion', { version })}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="닫기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 (스크롤) */}
        <div className="overflow-y-auto px-6 py-4 space-y-4 text-sm">
          {doc?.lastUpdated && (
            <p className="text-xs text-gray-400">{doc.lastUpdated}</p>
          )}
          {sections.map((section, i) => (
            <div key={i}>
              <h4 className="font-semibold text-gray-800 mb-1">{section.heading}</h4>
              <p className="text-gray-600 leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            {t('settings.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
