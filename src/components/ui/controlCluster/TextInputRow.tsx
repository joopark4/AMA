/**
 * TextInputRow — 메뉴바 위 슬롯에 노출되는 채팅 입력 행 (showTextInput 시).
 *
 * glass-strong 효과를 인라인으로 적용하되, 외곽 shadow 제거 (겹쳐 보이는 잔상 방지).
 * 제출 비활성 조건은 상위에서 `submitDisabled`로 전달.
 */
import { Keyboard, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';

export function TextInputRow({
  value,
  onChange,
  onSubmit,
  onClose,
  submitDisabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
  submitDisabled: boolean;
}) {
  const { t } = useTranslation();
  const hasText = value.trim().length > 0;
  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2"
      style={{
        padding: 3,
        paddingLeft: 14,
        borderRadius: 999,
        width: 440,
        background: 'var(--surface-2)',
        backdropFilter: 'blur(40px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
        boxShadow: 'inset 0 1px 0 var(--top-edge), inset 0 0 0 1px var(--hairline)',
        animation: 'inputSlide 240ms var(--ease)',
      }}
      data-interactive="true"
    >
      <Keyboard size={14} style={{ color: 'var(--ink-3)' }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('chat.placeholder')}
        className="flex-1 bg-transparent border-0 outline-none"
        style={{
          padding: '4px 4px',
          fontSize: 13,
          letterSpacing: '-0.01em',
          color: 'var(--ink)',
        }}
        autoFocus
        data-interactive="true"
      />
      <button
        type="button"
        onClick={onClose}
        title={t('overlay.closeKeyboard')}
        className="grid place-items-center transition-all"
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          background: 'transparent',
          color: 'var(--ink-3)',
          transitionDuration: '160ms',
          transitionTimingFunction: 'var(--ease)',
        }}
        data-interactive="true"
      >
        <X size={12} />
      </button>
      <button
        type="submit"
        disabled={submitDisabled}
        className="grid place-items-center transition-all"
        style={{
          width: 24,
          height: 18,
          borderRadius: 999,
          background: hasText ? 'var(--accent)' : 'oklch(0.88 0.01 60)',
          color: hasText ? 'white' : 'var(--ink-3)',
          transitionDuration: '200ms',
          transitionTimingFunction: 'var(--ease)',
        }}
        data-interactive="true"
      >
        <Send size={12} />
      </button>
    </form>
  );
}
