/**
 * HistoryPanel — 드래그 가능한 플로팅 대화 기록 창 (v2 리디자인).
 *
 * 기존 기능 모두 유지: 드래그 이동, 리사이즈, 글자 크기 조절, 투명도 조절.
 * 디자인: gray border/bg → glass-strong + accent 톤 + ink 색.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, X } from 'lucide-react';
import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore } from '../../stores/settingsStore';

function clampPanelPosition(
  pos: { x: number; y: number },
  panelSize: { width: number; height: number }
) {
  return {
    x: Math.max(0, Math.min(window.innerWidth - panelSize.width, pos.x)),
    y: Math.max(0, Math.min(window.innerHeight - 60, pos.y)),
  };
}

export default function HistoryPanel() {
  const { t } = useTranslation();
  const { messages, clearMessages } = useConversationStore();
  const { settings, closeHistory, setHistoryPanelSettings } = useSettingsStore();

  const {
    position = null,
    size = { width: 320, height: 480 },
    fontSize = 14,
    opacity = 95,
  } = settings.historyPanel ?? {};

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ clientX: 0, clientY: 0, w: 0, h: 0 });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (position === null) {
      setHistoryPanelSettings({
        position: {
          x: Math.max(0, window.innerWidth - size.width - 16),
          y: 16,
        },
      });
    } else {
      const clamped = clampPanelPosition(position, size);
      if (clamped.x !== position.x || clamped.y !== position.y) {
        setHistoryPanelSettings({ position: clamped });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (position) {
        const clamped = clampPanelPosition(position, size);
        if (clamped.x !== position.x || clamped.y !== position.y) {
          setHistoryPanelSettings({ position: clamped });
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position, size, setHistoryPanelSettings]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages.length]);

  const panelX = position?.x ?? Math.max(0, window.innerWidth - size.width - 16);
  const panelY = position?.y ?? 16;

  /* ─── Drag ─── */
  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-nodrag]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragOffset.current = { x: e.clientX - panelX, y: e.clientY - panelY };
    setIsDragging(true);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newX = Math.max(
      0,
      Math.min(window.innerWidth - size.width, e.clientX - dragOffset.current.x)
    );
    const newY = Math.max(
      0,
      Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y)
    );
    setHistoryPanelSettings({ position: { x: newX, y: newY } });
  };
  const stopDrag = () => setIsDragging(false);

  /* ─── Resize ─── */
  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeStart.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      w: size.width,
      h: size.height,
    };
    setIsResizing(true);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!isResizing) return;
    const newW = Math.max(200, resizeStart.current.w + e.clientX - resizeStart.current.clientX);
    const newH = Math.max(200, resizeStart.current.h + e.clientY - resizeStart.current.clientY);
    setHistoryPanelSettings({ size: { width: newW, height: newH } });
  };
  const stopResize = () => setIsResizing(false);

  /* ─── Font size ─── */
  const decreaseFontSize = () =>
    setHistoryPanelSettings({ fontSize: Math.max(11, fontSize - 1) });
  const increaseFontSize = () =>
    setHistoryPanelSettings({ fontSize: Math.min(20, fontSize + 1) });

  const visibleMessages = messages.filter((m) => m.role !== 'system');

  return (
    <div
      className="glass-strong fixed flex flex-col overflow-hidden"
      style={{
        zIndex: 60,
        left: panelX,
        top: panelY,
        width: size.width,
        height: size.height,
        cursor: isDragging ? 'grabbing' : 'default',
        opacity: opacity / 100,
        borderRadius: 'var(--r-lg)',
        animation: 'panelIn 320ms var(--ease)',
      }}
      data-interactive="true"
    >
      {/* Header / drag handle */}
      <div
        className="flex items-center justify-between cursor-grab active:cursor-grabbing select-none shrink-0"
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--hairline)',
          gap: 8,
        }}
        onPointerDown={startDrag}
        onPointerMove={onDragMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
          }}
        >
          {t('history.title')}
        </span>
        <div className="flex items-center" style={{ gap: 4 }} data-nodrag="true">
          <input
            type="range"
            min={20}
            max={100}
            value={opacity}
            onChange={(e) =>
              setHistoryPanelSettings({ opacity: Number(e.target.value) })
            }
            className="cursor-pointer"
            style={{
              width: 48,
              height: 12,
              accentColor: 'var(--accent)',
            }}
            title={t('history.opacity', { value: opacity })}
            data-interactive="true"
          />
          <button
            type="button"
            onClick={decreaseFontSize}
            className="grid place-items-center transition-colors"
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              color: 'var(--ink-3)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'oklch(1 0 0 / 0.5)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title={t('history.decreaseFontSize')}
            data-interactive="true"
          >
            <Minus size={12} />
          </button>
          <button
            type="button"
            onClick={increaseFontSize}
            className="grid place-items-center transition-colors"
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              color: 'var(--ink-3)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'oklch(1 0 0 / 0.5)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title={t('history.increaseFontSize')}
            data-interactive="true"
          >
            <Plus size={12} />
          </button>
          <button
            type="button"
            onClick={closeHistory}
            className="grid place-items-center transition-colors"
            style={{
              marginLeft: 4,
              width: 24,
              height: 24,
              borderRadius: 6,
              color: 'var(--ink-3)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'oklch(1 0 0 / 0.5)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title={t('history.close')}
            data-interactive="true"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="scroll flex-1 overflow-y-auto"
        style={{
          padding: '12px 14px',
          fontSize: `${fontSize}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {visibleMessages.length === 0 ? (
          <div
            className="flex items-center justify-center h-full select-none"
            style={{ color: 'var(--ink-3)', fontSize: 13 }}
          >
            {t('history.empty')}
          </div>
        ) : (
          visibleMessages.map((msg) => {
            const ts = new Date(msg.timestamp);
            const now = new Date();
            const isToday = ts.toDateString() === now.toDateString();
            const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateTimeStr = isToday
              ? timeStr
              : `${ts.toLocaleDateString([], { month: '2-digit', day: '2-digit' })} ${timeStr}`;

            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                style={{ gap: 2 }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '8px 12px',
                    borderRadius: 14,
                    borderBottomRightRadius: isUser ? 4 : 14,
                    borderBottomLeftRadius: isUser ? 14 : 4,
                    background: isUser ? 'var(--accent)' : 'oklch(1 0 0 / 0.7)',
                    boxShadow: isUser
                      ? 'none'
                      : 'inset 0 0 0 1px var(--hairline)',
                    color: isUser ? 'white' : 'var(--ink)',
                    lineHeight: 1.45,
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
                <span
                  style={{
                    color: 'var(--ink-3)',
                    fontSize: 10,
                    marginTop: 2,
                  }}
                >
                  {dateTimeStr}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer: clear button */}
      <div
        className="shrink-0"
        style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--hairline)',
        }}
      >
        <button
          type="button"
          onClick={clearMessages}
          className="w-full transition-colors"
          style={{
            fontSize: 11.5,
            color: 'var(--ink-3)',
            background: 'transparent',
            padding: '4px 8px',
            borderRadius: 6,
            textAlign: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-3)')}
          data-interactive="true"
        >
          {t('history.clearButton')}
        </button>
      </div>

      {/* Resize handle — bottom-right corner */}
      <div
        className="absolute bottom-0 right-0 cursor-se-resize"
        style={{
          width: 14,
          height: 14,
          background:
            'linear-gradient(135deg, transparent 50%, var(--hairline-strong) 50%)',
        }}
        onPointerDown={startResize}
        onPointerMove={onResizeMove}
        onPointerUp={stopResize}
        onPointerCancel={stopResize}
        data-interactive="true"
      />
    </div>
  );
}
