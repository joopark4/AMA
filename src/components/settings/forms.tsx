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
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: '10px 0' }}
    >
      <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>{label}</div>
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
    <button
      type="button"
      onClick={() => !disabled && onChange?.(!on)}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={on}
      className="relative shrink-0"
      style={{
        width: 38,
        height: 22,
        borderRadius: 99,
        // OFF 상태도 글래시 패널 위에서 잘 보이도록 약간 더 진한 회색 + hairline
        background: on ? 'var(--accent)' : 'oklch(0.78 0.008 60)',
        boxShadow: on
          ? '0 0 0 1px oklch(0.6 0.14 45 / 0.25), 0 1px 2px oklch(0.2 0 0 / 0.06)'
          : 'inset 0 0 0 1px var(--hairline-strong), 0 1px 1px oklch(0.2 0 0 / 0.04)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 200ms var(--ease), box-shadow 200ms var(--ease)',
      }}
      data-interactive="true"
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 1px 2px oklch(0.2 0 0 / 0.25), 0 0 0 1px oklch(0.2 0 0 / 0.05)',
          transition: 'left 220ms var(--ease)',
        }}
      />
    </button>
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
        className="flex-1"
        style={{
          accentColor: 'oklch(0.74 0.14 45)',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
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
