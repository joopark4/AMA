import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  } = settings.historyPanel ?? {};

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ clientX: 0, clientY: 0, w: 0, h: 0 });

  const scrollRef = useRef<HTMLDivElement>(null);

  // First-mount: set position to top-right if not yet stored; clamp if stored
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

  // Clamp position on resize (monitor change, resolution change)
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

  // 패널 마운트 시 기존 대화 기록 하단으로 즉시 스크롤
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // 새 메시지 시 하단으로 부드럽게 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const panelX = position?.x ?? Math.max(0, window.innerWidth - size.width - 16);
  const panelY = position?.y ?? 16;

  // --- Drag ---
  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-nodrag]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragOffset.current = { x: e.clientX - panelX, y: e.clientY - panelY };
    setIsDragging(true);
  };

  const onDragMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.current.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y));
    setHistoryPanelSettings({ position: { x: newX, y: newY } });
  };

  const stopDrag = () => setIsDragging(false);

  // --- Resize ---
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

  // --- Font size ---
  const decreaseFontSize = () =>
    setHistoryPanelSettings({ fontSize: Math.max(11, fontSize - 1) });
  const increaseFontSize = () =>
    setHistoryPanelSettings({ fontSize: Math.min(20, fontSize + 1) });

  const visibleMessages = messages.filter((m) => m.role !== 'system');

  return (
    <div
      className="fixed flex flex-col rounded-xl border border-gray-200 bg-white/95 backdrop-blur-sm overflow-hidden"
      style={{
        zIndex: 60,
        left: panelX,
        top: panelY,
        width: size.width,
        height: size.height,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      data-interactive="true"
    >
      {/* Header / drag handle */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 cursor-grab active:cursor-grabbing select-none shrink-0"
        onPointerDown={startDrag}
        onPointerMove={onDragMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <span className="text-sm font-semibold text-gray-700">{t('history.title')}</span>
        <div className="flex items-center gap-1" data-nodrag="true">
          <button
            onClick={decreaseFontSize}
            className="px-2 py-0.5 text-xs rounded hover:bg-gray-200 text-gray-600 transition-colors"
            title={t('history.decreaseFontSize')}
          >
            A-
          </button>
          <button
            onClick={increaseFontSize}
            className="px-2 py-0.5 text-xs rounded hover:bg-gray-200 text-gray-600 transition-colors"
            title={t('history.increaseFontSize')}
          >
            A+
          </button>
          <button
            onClick={closeHistory}
            className="ml-1 px-2 py-0.5 text-xs rounded hover:bg-gray-200 text-gray-500 transition-colors"
            title={t('history.close')}
          >
            ×
          </button>
        </div>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
        style={{ fontSize: `${fontSize}px` }}
      >
        {visibleMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm select-none">
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

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 leading-snug break-words ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white rounded-br-sm'
                      : 'bg-[#E5E5B6] text-[#333333] rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-gray-400 mt-0.5 select-none text-[10px]">
                  {dateTimeStr}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer: clear button */}
      <div className="shrink-0 px-3 py-2 border-t border-gray-200 bg-gray-50">
        <button
          onClick={clearMessages}
          className="w-full text-xs text-gray-500 hover:text-red-500 transition-colors text-center"
        >
          {t('history.clearButton')}
        </button>
      </div>

      {/* Resize handle — bottom-right corner */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        style={{
          background: 'linear-gradient(135deg, transparent 50%, #d1d5db 50%)',
        }}
        onPointerDown={startResize}
        onPointerMove={onResizeMove}
        onPointerUp={stopResize}
        onPointerCancel={stopResize}
      />
    </div>
  );
}
