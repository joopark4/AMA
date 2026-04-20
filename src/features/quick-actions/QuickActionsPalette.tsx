/**
 * QuickActionsPalette — ✨ 팔레트 (Phase 4).
 *
 * ControlCluster의 ✨ 버튼이나 단축키로 열림 → 등록된 기능을 그리드로 표시 →
 * 클릭 시 dispatch. 검색으로 필터링, ESC/배경 클릭으로 닫힘.
 *
 * sendMessage는 useConversation을 가진 부모(ControlCluster)에서 prop으로 주입.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { getQuickActionDef } from './catalog';
import { useQuickActions } from './useQuickActions';
import type { QuickActionDef, QuickActionId } from './types';

interface QuickActionsPaletteProps {
  open: boolean;
  onClose: () => void;
  /** 부모(ControlCluster)의 useConversation에서 가져온 sendMessage */
  sendMessage: (text: string) => Promise<void> | void;
}

export default function QuickActionsPalette({
  open,
  onClose,
  sendMessage,
}: QuickActionsPaletteProps) {
  const { t } = useTranslation();
  const enabledIds = useSettingsStore((s) => s.settings.enabledQuickActions);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const { dispatch } = useQuickActions({ sendMessage });

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 열릴 때 입력 포커스 + 검색 초기화
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const pinned = useMemo<QuickActionDef[]>(() => {
    const defs = enabledIds
      .map((id) => getQuickActionDef(id))
      .filter((d): d is QuickActionDef => Boolean(d));
    if (!query.trim()) return defs;
    const q = query.toLowerCase();
    return defs.filter((d) => {
      const label = t(d.labelKey).toLowerCase();
      const hint = t(d.hintKey).toLowerCase();
      const desc = t(d.descKey).toLowerCase();
      return label.includes(q) || hint.includes(q) || desc.includes(q);
    });
  }, [enabledIds, query, t]);

  const handlePick = async (id: QuickActionId) => {
    onClose();
    await dispatch(id);
  };

  const handleManage = () => {
    onClose();
    openSettings();
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[110] grid place-items-center"
      style={{
        background: 'oklch(0.2 0 0 / 0.18)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'fadeOverlay 200ms var(--ease)',
      }}
      data-interactive="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong overflow-hidden flex flex-col"
        style={{
          width: 'min(640px, calc(100vw - 32px))',
          maxHeight: '80vh',
          padding: 0,
          animation: 'scaleIn 240ms var(--ease)',
          borderRadius: 'var(--r-lg)',
        }}
        data-interactive="true"
      >
        {/* 검색 바 */}
        <div
          className="flex items-center"
          style={{
            padding: '16px 20px',
            gap: 12,
            borderBottom: '1px solid var(--hairline)',
          }}
        >
          <Search size={18} style={{ color: 'var(--ink-3)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('quickActions.searchPlaceholder')}
            className="focus-ring flex-1 bg-transparent border-0 outline-none"
            style={{
              fontSize: 16,
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
            }}
            data-interactive="true"
          />
          <kbd
            style={{
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              background: 'oklch(1 0 0 / 0.6)',
              boxShadow: 'inset 0 0 0 1px var(--hairline)',
              color: 'var(--ink-3)',
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            }}
          >
            esc
          </kbd>
        </div>

        {/* 본문 */}
        <div className="scroll" style={{ overflowY: 'auto', padding: 16 }}>
          <div
            className="flex items-center justify-between"
            style={{
              marginBottom: 10,
              paddingLeft: 4,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'var(--ink-3)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {t('quickActions.registeredCount', { count: enabledIds.length })}
            </div>
            <button
              type="button"
              onClick={handleManage}
              className="inline-flex items-center focus-ring"
              style={{
                gap: 4,
                fontSize: 11.5,
                color: 'var(--accent-ink)',
                padding: '3px 8px',
                borderRadius: 6,
                background: 'var(--accent-soft)',
              }}
              data-interactive="true"
            >
              <SettingsIcon size={11} />
              {t('quickActions.manage')}
            </button>
          </div>

          {pinned.length === 0 ? (
            <div
              className="text-center"
              style={{
                padding: '28px 16px',
                borderRadius: 16,
                background: 'oklch(1 0 0 / 0.55)',
                boxShadow: 'inset 0 0 0 1px var(--hairline)',
              }}
            >
              <div
                className="grid place-items-center"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  margin: '0 auto 12px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent-ink)',
                }}
              >
                <Sparkles size={20} />
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 4,
                  color: 'var(--ink)',
                }}
              >
                {query.trim()
                  ? t('quickActions.noResults')
                  : t('quickActions.empty')}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--ink-3)',
                  marginBottom: 14,
                  lineHeight: 1.55,
                }}
              >
                {query.trim()
                  ? t('quickActions.noResultsDesc')
                  : t('quickActions.emptyDesc')}
              </div>
              {!query.trim() && (
                <button
                  type="button"
                  onClick={handleManage}
                  className="inline-flex items-center focus-ring"
                  style={{
                    padding: '8px 14px',
                    gap: 6,
                    borderRadius: 99,
                    fontSize: 12.5,
                    color: 'white',
                    background: 'var(--accent)',
                    fontWeight: 500,
                  }}
                  data-interactive="true"
                >
                  <Plus size={13} />
                  {t('quickActions.register')}
                </button>
              )}
            </div>
          ) : (
            <div
              className="grid"
              style={{
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}
            >
              {pinned.map((def) => {
                const Icon = def.icon;
                return (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => void handlePick(def.id)}
                    className="text-left flex flex-col focus-ring"
                    style={{
                      padding: 14,
                      gap: 10,
                      borderRadius: 16,
                      background: 'oklch(1 0 0 / 0.55)',
                      boxShadow: 'inset 0 0 0 1px var(--hairline)',
                      cursor: 'pointer',
                      transition: 'all 180ms var(--ease)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'oklch(1 0 0 / 0.85)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'oklch(1 0 0 / 0.55)';
                      e.currentTarget.style.transform = 'none';
                    }}
                    data-interactive="true"
                  >
                    <div
                      className="grid place-items-center"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: def.accent,
                        color: 'oklch(0.25 0.05 50)',
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          marginBottom: 2,
                          color: 'var(--ink)',
                        }}
                      >
                        {t(def.labelKey)}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                        {t(def.hintKey)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--hairline)',
            fontSize: 11.5,
            color: 'var(--ink-3)',
          }}
        >
          <span>{t('quickActions.footerHint')}</span>
          <span className="inline-flex items-center" style={{ gap: 6 }}>
            <kbd style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>↵</kbd>
            <span style={{ opacity: 0.6 }}>·</span>
            <kbd style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>⌘,</kbd>
            <span>{t('quickActions.footerSettings')}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
