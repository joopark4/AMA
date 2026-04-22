/**
 * ControlCluster 프리미티브 — ClusterBtn / Divider.
 *
 * 메뉴바 영역의 아이콘 버튼(ClusterBtn)과 섹션 구분자(Divider).
 * 디자인 토큰 기반 hover/active 색상, 클릭스루 보호(data-interactive).
 */
import type { ReactNode } from 'react';

export function ClusterBtn({
  children,
  onClick,
  title,
  active,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      data-interactive="true"
      className={[
        'grid place-items-center transition-all',
        'w-10 h-5 rounded-pill',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[oklch(0.92_0.02_60_/_0.7)]',
      ].join(' ')}
      style={{
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent-ink)' : 'var(--ink-2)',
        transitionDuration: '160ms',
        transitionTimingFunction: 'var(--ease)',
      }}
    >
      {children}
    </button>
  );
}

export function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 24,
        background: 'var(--hairline-strong)',
        margin: '0 4px',
      }}
    />
  );
}
