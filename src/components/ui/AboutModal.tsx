import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getVersion } from '@tauri-apps/api/app';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const { t } = useTranslation();
  const [version, setVersion] = useState('');

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(''));
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center"
      data-interactive="true"
    >
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 카드 */}
      <div className="relative w-full max-w-sm mx-4 rounded-2xl bg-white shadow-2xl">
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          aria-label={t('about.close')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 본문 */}
        <div className="flex flex-col items-center px-6 pt-8 pb-6 space-y-3">
          {/* 앱 아이콘 */}
          <img src="/app-icon.png" alt={t('app.title')} className="w-16 h-16 rounded-2xl shadow-lg" />

          {/* 앱 이름 */}
          <h2 className="text-xl font-semibold text-gray-900">{t('app.title')}</h2>

          {/* 버전 */}
          {version && (
            <p className="text-sm text-gray-500">
              {t('about.version')} {version}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
