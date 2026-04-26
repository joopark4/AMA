import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';

/** 위치를 SNAP_PX 단위로 스냅하여 미세 이동 시 리렌더 방지 */
const SNAP_PX = 3;
const snap = (v: number) => Math.round(v / SNAP_PX) * SNAP_PX;

interface SpeechBubbleProps {
  message: string;
}

export default function SpeechBubble({ message }: SpeechBubbleProps) {
  const getViewportSize = () => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  });

  const [viewportSize, setViewportSize] = useState(getViewportSize);
  const [bubbleSize, setBubbleSize] = useState({ width: 260, height: 88 });
  const bubbleRef = useRef<HTMLDivElement>(null);

  // 스냅된 좌표를 문자열 키로 반환 → 값이 같으면 Zustand가 리렌더를 건너뜀
  const posKey = useAvatarStore((s) => `${snap(s.position.x)},${snap(s.position.y)}`);
  const position = useMemo(() => {
    const [x, y] = posKey.split(',').map(Number);
    return { x, y };
  }, [posKey]);

  const boundsKey = useAvatarStore((s) => {
    const b = s.interactionBounds;
    if (!b) return '';
    return `${snap(b.top)},${snap(b.left)},${snap(b.right)},${snap(b.bottom)}`;
  });
  const interactionBounds = useMemo(() => {
    if (!boundsKey) return null;
    const [top, left, right, bottom] = boundsKey.split(',').map(Number);
    return { top, left, right, bottom };
  }, [boundsKey]);

  const avatarScale = useSettingsStore((state) => state.settings.avatar?.scale || 1.0);

  useEffect(() => {
    const handleResize = () => {
      setViewportSize(getViewportSize());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useLayoutEffect(() => {
    if (!bubbleRef.current) return;

    const updateBubbleSize = () => {
      if (!bubbleRef.current) return;
      const rect = bubbleRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setBubbleSize((prev) => {
          const widthChanged = Math.abs(prev.width - rect.width) > 0.5;
          const heightChanged = Math.abs(prev.height - rect.height) > 0.5;
          if (!widthChanged && !heightChanged) return prev;
          return {
            width: rect.width,
            height: rect.height,
          };
        });
      }
    };

    const rafId = window.requestAnimationFrame(updateBubbleSize);
    return () => window.cancelAnimationFrame(rafId);
  }, [message, viewportSize.width, viewportSize.height]);

  const { bubbleStyle, tailStyle } = useMemo(() => {
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));

    const EDGE_PADDING = 12;
    const BUBBLE_GAP = 14;

    const fallbackAvatarTop = position.y - Math.max(300, 420 * avatarScale);
    const anchorX = interactionBounds
      ? (interactionBounds.left + interactionBounds.right) / 2
      : position.x;
    const avatarTopY = interactionBounds
      ? interactionBounds.top
      : fallbackAvatarTop;

    const maxLeft = Math.max(
      EDGE_PADDING,
      viewportSize.width - bubbleSize.width - EDGE_PADDING
    );
    const left = clamp(
      anchorX - bubbleSize.width / 2,
      EDGE_PADDING,
      maxLeft
    );

    const top = clamp(
      avatarTopY - bubbleSize.height - BUBBLE_GAP,
      EDGE_PADDING,
      Math.max(EDGE_PADDING, viewportSize.height - bubbleSize.height - EDGE_PADDING)
    );

    const tailLeft = clamp(anchorX - left - 8, 16, Math.max(16, bubbleSize.width - 24));

    return {
      bubbleStyle: {
        left: `${left}px`,
        top: `${top}px`,
      },
      tailStyle: {
        bottom: '-8px',
        left: `${tailLeft}px`,
      },
    };
  }, [position, interactionBounds, avatarScale, bubbleSize, viewportSize]);

  if (!message) return null;

  return (
    <div
      ref={bubbleRef}
      className="speech-bubble fixed z-50 pointer-events-none"
      style={{
        ...bubbleStyle,
        maxWidth: 460,
      }}
    >
      {/* 꼬리: 본체와 동일한 글래시 톤. 우상/우하측 hairline만 표시해 회전 시 본체 경계와 매끄럽게 연결. */}
      <div
        className="absolute"
        style={{
          ...tailStyle,
          width: 12,
          height: 12,
          background: 'var(--surface-2)',
          borderRight: '1px solid var(--hairline)',
          borderBottom: '1px solid var(--hairline)',
          backdropFilter: 'blur(40px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
          transform: 'rotate(45deg)',
          zIndex: 0,
        }}
      />

      {/* 버블 본체: glass-strong, ink 색상. 꼬리 상단 반을 덮어 깔끔하게 처리. */}
      <div
        className="relative glass-strong"
        style={{
          padding: '14px 18px',
          borderRadius: 'var(--r-lg)',
          zIndex: 1,
        }}
      >
        <p
          className="whitespace-pre-wrap"
          style={{
            color: 'var(--ink)',
            fontSize: 14,
            lineHeight: 1.55,
            letterSpacing: '-0.01em',
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
