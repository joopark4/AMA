/**
 * Quick Actions 모듈 — 자주 쓰는 기능 (Phase 4).
 *
 * 외부 노출:
 * - 타입: QuickActionId, QuickActionDef
 * - 카탈로그: QUICK_ACTION_DEFS, getQuickActionDef, runQuickAction
 * - 훅: useQuickActions (sendMessage 주입)
 * - UI: QuickActionsPalette, QuickActionsSettings
 */
export type {
  QuickActionId,
  QuickActionDef,
  QuickActionContext,
  QuickActionHandler,
} from './types';
export { ALL_QUICK_ACTION_IDS } from './types';
export { QUICK_ACTION_DEFS, getQuickActionDef, runQuickAction } from './catalog';
export { useQuickActions } from './useQuickActions';
export { default as QuickActionsPalette } from './QuickActionsPalette';
export { default as QuickActionsSettings } from './QuickActionsSettings';
