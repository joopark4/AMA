/**
 * Toast 알림 컴포넌트
 * window 'ama-toast' 이벤트를 수신하여 표시
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface ToastMessage {
  id: number;
  type: 'info' | 'warning' | 'error';
  text: string;
}

let toastId = 0;

export default function Toast() {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        type?: 'info' | 'warning' | 'error';
        messageKey?: string;
        message?: string;
      };

      const id = ++toastId;
      const text = detail.messageKey ? t(detail.messageKey) : detail.message || '';
      const type = detail.type || 'info';

      setToasts(prev => [...prev, { id, type, text }]);

      // 5초 후 자동 제거
      setTimeout(() => removeToast(id), 5000);
    };

    window.addEventListener('ama-toast', handler);
    return () => window.removeEventListener('ama-toast', handler);
  }, [t, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-auto" data-interactive="true">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm
            animate-[slideIn_0.3s_ease-out]
            ${toast.type === 'error' ? 'bg-red-600 text-white' : ''}
            ${toast.type === 'warning' ? 'bg-amber-500 text-white' : ''}
            ${toast.type === 'info' ? 'bg-blue-600 text-white' : ''}
          `}
        >
          <span className="flex-1">{toast.text}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="p-0.5 hover:opacity-80 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
