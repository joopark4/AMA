/**
 * QuickActionsSettings — 자주 쓰는 토글 등록 설정 (재설계).
 *
 * 카테고리별로 그룹화된 체크리스트. 사용자가 체크한 항목이 ✨ 팔레트에
 * 토글 row로 노출됨. 아이콘은 없고 제목 + 짧은 설명.
 */
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { SectionHint } from '../../components/settings/forms';
import {
  CATEGORY_LABEL_KEY,
  CATEGORY_ORDER,
  QUICK_TOGGLES_BY_CATEGORY,
} from './catalog';

export default function QuickActionsSettings() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((s) => s.settings.enabledQuickActions);
  const toggle = useSettingsStore((s) => s.toggleQuickAction);
  const setEnabled = useSettingsStore((s) => s.setEnabledQuickActions);

  return (
    <div>
      <SectionHint>{t('settings.quickActions.description')}</SectionHint>

      {/* 카테고리별 체크리스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {CATEGORY_ORDER.map((cat) => {
          const items = QUICK_TOGGLES_BY_CATEGORY[cat] || [];
          if (items.length === 0) return null;

          return (
            <div
              key={cat}
              style={{
                borderRadius: 12,
                background: 'oklch(1 0 0 / 0.55)',
                boxShadow: 'inset 0 0 0 1px var(--hairline)',
                overflow: 'hidden',
              }}
            >
              {/* 카테고리 헤더 */}
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  borderBottom: '1px solid var(--hairline)',
                  background: 'oklch(1 0 0 / 0.35)',
                }}
              >
                {t(CATEGORY_LABEL_KEY[cat])}
              </div>

              {/* 항목들 */}
              {items.map((def, i) => {
                const on = enabled.includes(def.id);
                return (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => toggle(def.id)}
                    className="w-full flex items-start text-left transition-colors focus-ring hover:bg-[oklch(1_0_0_/_0.5)]"
                    style={{
                      padding: '10px 12px',
                      gap: 11,
                      borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
                    }}
                    data-interactive="true"
                  >
                    {/* 체크박스 */}
                    <div
                      className="grid place-items-center shrink-0 transition-all"
                      style={{
                        width: 18,
                        height: 18,
                        marginTop: 1,
                        borderRadius: 6,
                        background: on ? 'var(--accent)' : 'oklch(1 0 0 / 0.8)',
                        boxShadow: on
                          ? 'none'
                          : 'inset 0 0 0 1.5px oklch(0.78 0.005 60)',
                        transitionDuration: '160ms',
                        transitionTimingFunction: 'var(--ease)',
                      }}
                    >
                      {on && <Check size={12} style={{ color: 'white', strokeWidth: 3 }} />}
                    </div>

                    {/* 제목 + 설명 (아이콘 없음) */}
                    <div className="flex-1 min-w-0">
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 500,
                          color: 'var(--ink)',
                          marginBottom: def.descKey ? 2 : 0,
                        }}
                      >
                        {t(def.titleKey)}
                      </div>
                      {def.descKey && (
                        <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                          {t(def.descKey)}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* 등록 카운트 + 모두 해제 */}
      <div
        className="flex items-center justify-between"
        style={{
          marginTop: 12,
          fontSize: 11,
          color: 'var(--ink-3)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
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
    </div>
  );
}
