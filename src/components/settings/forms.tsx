/**
 * 설정 패널 공용 폼 프리미티브 (v2 리디자인).
 *
 * 핸드오프 문서 04-components.md의 spec에 맞춘 글래시 톤 폼 요소.
 * 설정 섹션 컴포넌트들이 일관된 시각/인터랙션을 갖도록 여기서만 export.
 *
 * - Field   : label/hint + 자식 입력
 * - Row     : label + 우측 컨트롤 (한 줄)
 * - Pill    : 토글 버튼 (active 시 accent)
 * - Select  : 글래시 select (custom chevron)
 * - TextInput : 글래시 input (mono 옵션)
 * - Toggle  : 38x22 라운드 스위치
 * - Slider  : range + 우측 mono 값 표시
 * - SectionHint : 섹션 상단 안내문 (12.5px ink-2)
 */
import { ChevronDown } from 'lucide-react';
import type { ChangeEvent, ReactNode } from 'react';

/* ─────────────────────── Field / Row / SectionHint ─────────────────────── */

export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ padding: '10px 0' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export function Row({
  label,
  description,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: '10px 0' }}
    >
      <div className={description ? 'flex flex-col' : undefined}>
        <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>{label}</div>
        {description && (
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
            {description}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function SectionHint({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12.5,
        color: 'var(--ink-2)',
        lineHeight: 1.55,
        padding: '4px 0 10px',
      }}
    >
      {children}
    </div>
  );
}

/* ────────────────────────────── Pill ────────────────────────────── */

export function Pill({
  active,
  onClick,
  disabled,
  children,
  title,
}: {
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="focus-ring"
      style={{
        padding: '6px 12px',
        borderRadius: 99,
        fontSize: 12.5,
        fontWeight: 500,
        background: active ? 'var(--accent)' : 'oklch(1 0 0 / 0.7)',
        color: active ? 'white' : 'var(--ink-2)',
        boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--hairline)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 160ms var(--ease)',
        whiteSpace: 'nowrap',
      }}
      data-interactive="true"
    >
      {children}
    </button>
  );
}

/* ────────────────────────────── Select ────────────────────────────── */

interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export function Select<T extends string = string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: SelectOption<T>[];
  onChange?: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange?.(e.target.value as T)}
        disabled={disabled}
        className="focus-ring w-full appearance-none"
        style={{
          padding: '9px 32px 9px 12px',
          fontSize: 13.5,
          borderRadius: 10,
          border: 0,
          background: 'oklch(1 0 0 / 0.7)',
          boxShadow: 'inset 0 0 0 1px var(--hairline)',
          color: 'var(--ink)',
          fontFamily: 'inherit',
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        data-interactive="true"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <div
        className="absolute right-2.5 top-1/2 pointer-events-none"
        style={{ transform: 'translateY(-50%)', color: 'var(--ink-3)' }}
      >
        <ChevronDown size={14} />
      </div>
    </div>
  );
}

/* ────────────────────────────── TextInput ────────────────────────────── */

export function TextInput({
  value,
  onChange,
  placeholder,
  mono,
  type = 'text',
  disabled,
  maxLength,
}: {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: 'text' | 'password' | 'email' | 'url';
  disabled?: boolean;
  maxLength?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      className="focus-ring w-full"
      style={{
        padding: '9px 12px',
        fontSize: 13.5,
        borderRadius: 10,
        border: 0,
        background: 'oklch(1 0 0 / 0.7)',
        boxShadow: 'inset 0 0 0 1px var(--hairline)',
        outline: 'none',
        color: 'var(--ink)',
        fontFamily: mono ? '"JetBrains Mono", ui-monospace, monospace' : 'inherit',
        opacity: disabled ? 0.6 : 1,
      }}
      data-interactive="true"
    />
  );
}

/* ────────────────────────────── Toggle ────────────────────────────── */

export function Toggle({
  on,
  onChange,
  disabled,
  ariaLabel,
}: {
  on: boolean;
  onChange?: (on: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onChange?.(!on)}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onChange?.(!on);
        }
      }}
      style={{
        // WKWebView 호환: SVG로 트랙+핸들 모두 그림 — 가장 안정적 렌더.
        display: 'inline-block',
        flex: '0 0 44px',
        flexShrink: 0,
        minWidth: 44,
        lineHeight: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
        verticalAlign: 'middle',
      }}
      data-interactive="true"
    >
      <svg
        width="44"
        height="24"
        viewBox="0 0 44 24"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {/* 트랙 — 색상 토큰 사용 (theme/accent 변경 시 자동 반영) */}
        <rect
          x="0.5"
          y="0.5"
          width="43"
          height="23"
          rx="11.5"
          strokeWidth="1"
          style={{
            fill: on ? 'var(--accent)' : 'var(--toggle-off-track)',
            stroke: on ? 'var(--accent-border)' : 'var(--toggle-off-border)',
            transition: 'fill 200ms var(--ease), stroke 200ms var(--ease)',
          }}
        />
        {/* 핸들 그림자 (핸들보다 1px 아래) */}
        <circle
          cx={on ? 32 : 12}
          cy="13"
          r="9.5"
          fill="rgba(0, 0, 0, 0.15)"
          style={{ transition: 'cx 220ms var(--ease)' }}
        />
        {/* 핸들 */}
        <circle
          cx={on ? 32 : 12}
          cy="12"
          r="9.5"
          fill="#ffffff"
          stroke="rgba(0, 0, 0, 0.1)"
          strokeWidth="0.5"
          style={{ transition: 'cx 220ms var(--ease)' }}
        />
      </svg>
    </div>
  );
}

/* ────────────────────────────── Slider ────────────────────────────── */

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  format = (v) => String(v),
  disabled,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange?.(Number(e.target.value))}
        disabled={disabled}
        className="ama-slider flex-1"
        data-interactive="true"
      />
      <div
        style={{
          fontSize: 12,
          color: 'var(--ink-3)',
          minWidth: 44,
          textAlign: 'right',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        }}
      >
        {format(value)}
      </div>
    </div>
  );
}

/* ────────────────────────────── 보조 ────────────────────────────── */

/** 글래시 카드 — 폼 그룹용 (예: VRM 파일 정보, 코드 블록 등) */
export function FormCard({
  children,
  padding = 12,
}: {
  children: ReactNode;
  padding?: number;
}) {
  return (
    <div
      style={{
        padding,
        borderRadius: 12,
        background: 'oklch(1 0 0 / 0.7)',
        boxShadow: 'inset 0 0 0 1px var(--hairline)',
      }}
    >
      {children}
    </div>
  );
}
