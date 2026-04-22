/**
 * SettingsSection — 아코디언 카드 (v2 리디자인).
 *
 * 핸드오프 04-components.md spec:
 * - 카드: radius 18, oklch(1 0 0 / 0.55), hairline inset
 * - 헤더: padding 14x16, 아이콘 칩 32x32 (accent-soft + accent-ink)
 * - ChevronDown rotate 180° when open
 * - Content: padding 4 16 18, fade 220ms 등장
 *
 * `icon`은 optional — spec에 명시되지 않은 섹션도 동일 컴포넌트로 통일.
 */
import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface SettingsSectionProps {
  title: string;
  icon?: ReactNode;
  /** uncontrolled 초기 열림 상태 (기본 false). `isOpen`이 지정되면 무시된다. */
  defaultOpen?: boolean;
  /**
   * controlled 모드: 외부에서 열림 상태를 주입. 제공되면 `onToggle`과 함께 사용해야 한다.
   * SettingsPanel이 persist된 상태를 주입할 때 사용.
   */
  isOpen?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}

export default function SettingsSection({
  title,
  icon,
  defaultOpen = false,
  isOpen: controlledOpen,
  onToggle,
  children,
}: SettingsSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const handleToggle = () => {
    if (isControlled) onToggle?.();
    else setInternalOpen((v) => !v);
  };

  return (
    <div
      className="overflow-hidden"
      style={{
        borderRadius: 18,
        background: 'oklch(1 0 0 / 0.55)',
        // 섹션 카드 경계를 hairline → hairline-strong로 강화 + 미세 drop shadow로
        // 카드가 떠 있는 느낌을 살려 인접 섹션과 시각 구분을 명확히.
        boxShadow:
          'inset 0 0 0 1px var(--hairline-strong), 0 1px 3px rgba(0, 0, 0, 0.05)',
        transition: 'all 200ms var(--ease)',
      }}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center text-left focus-ring"
        style={{ padding: '14px 16px', gap: 12 }}
        data-interactive="true"
      >
        {icon && (
          <div
            className="grid place-items-center shrink-0"
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'var(--accent-soft)',
              color: 'var(--accent-ink)',
            }}
          >
            {icon}
          </div>
        )}
        <div
          className="flex-1 min-w-0 truncate"
          // 길어진 i18n 라벨이 ellipsis로 잘릴 때 전체 텍스트를 hover tooltip으로 노출.
          title={typeof title === 'string' ? title : undefined}
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: 'var(--ink-3)',
            transform: `rotate(${isOpen ? 180 : 0}deg)`,
            transition: 'transform 240ms var(--ease)',
          }}
        >
          <ChevronDown size={16} />
        </div>
      </button>
      {isOpen && (
        <div
          style={{
            padding: '4px 16px 18px',
            animation: 'fadeOverlay 220ms var(--ease)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
