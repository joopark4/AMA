/**
 * QuickActionsPalette — ✨ 팔레트 (재설계: 토글 모음).
 *
 * 사용자가 설정에 등록한 boolean 설정을 토글 row로 노출 → 클릭/Toggle로
 * 즉시 store 변경. 검색으로 필터링. ESC/배경 클릭으로 닫힘.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { Toggle } from '../../components/settings/forms';
import { CATEGORY_LABEL_KEY, getQuickToggle } from './catalog';
import type { QuickToggleCategory, QuickToggleDef } from './types';

interface QuickActionsPaletteProps {
  open: boolean;
  onClose: () => void;
}

/** 단일 토글 row — useSettingsStore selector로 실시간 구독 */
function ToggleRow({ def }: { def: QuickToggleDef }) {
  const { t } = useTranslation();
  const value = useSettingsStore(def.select);

  return (
    <div
      className="flex items-start"
      style={{
        padding: '12px 14px',
        gap: 12,
        borderRadius: 12,
        background: 'oklch(1 0 0 / 0.6)',
        boxShadow: 'inset 0 0 0 1px var(--hairline)',
      }}
    >
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--ink)',
            marginBottom: def.descKey ? 2 : 0,
          }}
        >
          {t(def.titleKey)}
        </div>
        {def.descKey && (
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4 }}>
            {t(def.descKey)}
          </div>
        )}
      </div>
      <div style={{ marginTop: 2 }}>
        <Toggle on={value} onChange={(v) => def.apply(v)} />
      </div>
    </div>
  );
}

export default function QuickActionsPalette({
  open,
  onClose,
}: QuickActionsPaletteProps) {
  const { t } = useTranslation();
  const enabledIds = useSettingsStore((s) => s.settings.enabledQuickActions);
  const openSettings = useSettingsStore((s) => s.openSettings);

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // 등록된 + 카테고리 그룹화 + 검색 필터
  const grouped = useMemo<Record<QuickToggleCategory, QuickToggleDef[]>>(() => {
    const result: Record<QuickToggleCategory, QuickToggleDef[]> = {
      avatar: [], animation: [], voice: [], screen: [], channels: [], proactive: [],
    };
    const q = query.trim().toLowerCase();
    enabledIds.forEach((id) => {
      const def = getQuickToggle(id);
      if (!def) return;
      if (q) {
        const title = t(def.titleKey).toLowerCase();
        const desc = def.descKey ? t(def.descKey).toLowerCase() : '';
        if (!title.includes(q) && !desc.includes(q)) return;
      }
      result[def.category].push(def);
    });
    return result;
  }, [enabledIds, query, t]);

  const totalShown = Object.values(grouped).reduce((acc, arr) => acc + arr.length, 0);

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
          width: 'min(560px, calc(100vw - 32px))',
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
            padding: '14px 18px',
            gap: 12,
            borderBottom: '1px solid var(--hairline)',
          }}
        >
          <Search size={16} style={{ color: 'var(--ink-3)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('quickActions.searchPlaceholder')}
            className="focus-ring flex-1 bg-transparent border-0 outline-none"
            style={{
              fontSize: 14.5,
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
        <div
          className="scroll"
          style={{
            overflowY: 'auto',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{ paddingLeft: 4 }}
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

          {totalShown === 0 ? (
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
            (Object.keys(grouped) as QuickToggleCategory[]).map((cat) => {
              const items = grouped[cat];
              if (items.length === 0) return null;
              return (
                <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div
                    style={{
                      paddingLeft: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                    }}
                  >
                    {t(CATEGORY_LABEL_KEY[cat])}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {items.map((def) => (
                      <ToggleRow key={def.id} def={def} />
                    ))}
                  </div>
                </div>
              );
            })
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
          <span>{t('quickActions.footerToggleHint')}</span>
          <span className="inline-flex items-center" style={{ gap: 6 }}>
            <kbd style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>esc</kbd>
            <span>{t('quickActions.footerClose')}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
