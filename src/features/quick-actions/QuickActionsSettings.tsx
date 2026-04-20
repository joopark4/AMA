/**
 * QuickActionsSettings — 자주 쓰는 기능 등록 설정 섹션 (Phase 4).
 *
 * 9개 카탈로그를 체크리스트로 표시 → settingsStore.toggleQuickAction 호출.
 * 하단에 등록된 항목을 pill로 미리보기.
 */
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { SectionHint } from '../../components/settings/forms';
import { QUICK_ACTION_DEFS, getQuickActionDef } from './catalog';
import type { QuickActionId } from './types';

export default function QuickActionsSettings() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((s) => s.settings.enabledQuickActions);
  const toggle = useSettingsStore((s) => s.toggleQuickAction);
  const setEnabled = useSettingsStore((s) => s.setEnabledQuickActions);

  return (
    <div>
      <SectionHint>{t('settings.quickActions.description')}</SectionHint>

      {/* 체크리스트 카드 */}
      <div
        style={{
          borderRadius: 12,
          background: 'oklch(1 0 0 / 0.55)',
          boxShadow: 'inset 0 0 0 1px var(--hairline)',
          overflow: 'hidden',
        }}
      >
        {QUICK_ACTION_DEFS.map((def, i) => {
          const Icon = def.icon;
          const on = enabled.includes(def.id);
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => toggle(def.id)}
              className="w-full flex items-center text-left transition-colors focus-ring"
              style={{
                padding: '11px 12px',
                gap: 11,
                borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
                background: 'transparent',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'oklch(1 0 0 / 0.5)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              data-interactive="true"
            >
              {/* 체크박스 */}
              <div
                className="grid place-items-center shrink-0 transition-all"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  background: on ? 'var(--accent)' : 'oklch(1 0 0 / 0.8)',
                  boxShadow: on ? 'none' : 'inset 0 0 0 1.5px oklch(0.78 0.005 60)',
                  transitionDuration: '160ms',
                  transitionTimingFunction: 'var(--ease)',
                }}
              >
                {on && <Check size={12} style={{ color: 'white', strokeWidth: 3 }} />}
              </div>
              {/* 아이콘 칩 */}
              <div
                className="grid place-items-center shrink-0 transition-opacity"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: def.accent,
                  color: 'oklch(0.25 0.05 50)',
                  opacity: on ? 1 : 0.55,
                  transitionDuration: '160ms',
                  transitionTimingFunction: 'var(--ease)',
                }}
              >
                <Icon size={15} />
              </div>
              {/* 라벨 + 설명 */}
              <div className="flex-1 min-w-0">
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 500,
                    marginBottom: 1,
                    color: 'var(--ink)',
                  }}
                >
                  {t(def.labelKey)}
                </div>
                <div
                  className="truncate"
                  style={{ fontSize: 11.5, color: 'var(--ink-3)' }}
                >
                  {t(def.descKey)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 등록된 항목 pill 미리보기 */}
      <div style={{ marginTop: 14 }}>
        <div
          className="flex items-center justify-between"
          style={{
            fontSize: 11,
            color: 'var(--ink-3)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 8,
          }}
        >
          <span>{t('settings.quickActions.registered', { count: enabled.length })}</span>
          {enabled.length > 0 && (
            <button
              type="button"
              onClick={() => setEnabled([])}
              className="focus-ring"
              style={{
                fontSize: 11,
                color: 'var(--ink-3)',
                textTransform: 'none',
                letterSpacing: 0,
                padding: '2px 6px',
                borderRadius: 6,
                background: 'transparent',
              }}
              data-interactive="true"
            >
              {t('settings.quickActions.clearAll')}
            </button>
          )}
        </div>

        {enabled.length === 0 ? (
          <div
            className="text-center"
            style={{
              padding: '14px 12px',
              borderRadius: 10,
              background: 'oklch(0.97 0.01 60 / 0.6)',
              border: '1px dashed oklch(0.82 0.01 60)',
              fontSize: 12,
              color: 'var(--ink-3)',
            }}
          >
            {t('settings.quickActions.empty')}
          </div>
        ) : (
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {enabled.map((id: QuickActionId) => {
              const def = getQuickActionDef(id);
              if (!def) return null;
              const Icon = def.icon;
              return (
                <div
                  key={id}
                  className="inline-flex items-center"
                  style={{
                    padding: '5px 10px 5px 6px',
                    gap: 6,
                    borderRadius: 99,
                    background: 'oklch(1 0 0 / 0.7)',
                    boxShadow: 'inset 0 0 0 1px var(--hairline)',
                    fontSize: 12,
                    color: 'var(--ink)',
                  }}
                >
                  <div
                    className="grid place-items-center"
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      background: def.accent,
                      color: 'oklch(0.25 0.05 50)',
                    }}
                  >
                    <Icon size={11} />
                  </div>
                  {t(def.labelKey)}
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className="grid place-items-center focus-ring"
                    style={{
                      color: 'var(--ink-3)',
                      padding: 2,
                      background: 'transparent',
                      borderRadius: 4,
                    }}
                    data-interactive="true"
                    aria-label="제거"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
