import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';

interface SpeechBubbleProps {
  message: string;
  duration?: number;
}

export default function SpeechBubble({ message, duration = 10000 }: SpeechBubbleProps) {
  const getViewportSize = () => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  });

  const [isVisible, setIsVisible] = useState(true);
  const [viewportSize, setViewportSize] = useState(getViewportSize);
  const [bubbleSize, setBubbleSize] = useState({ width: 260, height: 88 });
  const bubbleRef = useRef<HTMLDivElement>(null);

  const position = useAvatarStore((state) => state.position);
  const interactionBounds = useAvatarStore((state) => state.interactionBounds);

  const avatarScale = useSettingsStore((state) => state.settings.avatar?.scale || 1.0);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration]);

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
  }, [message, viewportSize.width, viewportSize.height, isVisible]);

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

  if (!isVisible || !message) return null;

  return (
    <div
      ref={bubbleRef}
      className="speech-bubble fixed z-50 max-w-xs pointer-events-none"
      style={bubbleStyle}
    >
      {/* 꼬리: 버블 바깥에서 버블 뒤에 배치 (z-index 0) */}
      <div
        className="absolute w-4 h-4 bg-white border border-gray-200"
        style={{
          ...tailStyle,
          zIndex: 0,
          transform: 'rotate(45deg)',
        }}
      />

      {/* 버블 본체: 꼬리 위에 렌더링 (z-index 1), 꼬리 상단 반을 덮어 깔끔하게 처리 */}
      <div
        className="relative bg-white rounded-2xl px-4 py-3 border border-gray-200"
        style={{ zIndex: 1 }}
      >
        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
          {message}
        </p>
      </div>
    </div>
  );
}
