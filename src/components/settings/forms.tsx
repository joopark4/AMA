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
    <label
      className="shrink-0 inline-block"
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        minWidth: 44,
        flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
      aria-label={ariaLabel}
      data-interactive="true"
    >
      {/* 실제 상태를 담는 숨겨진 네이티브 체크박스 — 접근성 + 이벤트 소스 */}
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => !disabled && onChange?.(e.target.checked)}
        disabled={disabled}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          margin: 0,
          opacity: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          zIndex: 1,
        }}
        data-interactive="true"
      />
      {/* 비주얼 트랙 (label 내부 div — WKWebView 렌더 안정) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 99,
          background: on ? '#e6903a' : '#a8a39a',
          border: on ? '1px solid #c77630' : '1px solid #7a756d',
          boxShadow: on
            ? '0 1px 2px rgba(0, 0, 0, 0.1)'
            : 'inset 0 1px 2px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)',
          transition: 'background 200ms var(--ease), border-color 200ms var(--ease)',
        }}
      />
      {/* 비주얼 핸들 */}
      <div
        style={{
          position: 'absolute',
          top: 1,
          left: on ? 21 : 1,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          transition: 'left 220ms var(--ease)',
        }}
      />
    </label>
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
