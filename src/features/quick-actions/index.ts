/**
 * Quick Actions 모듈 — 자주 쓰는 설정 토글 (재설계).
 */
export type {
  QuickActionId,
  QuickToggleDef,
  QuickToggleCategory,
} from './types';
export {
  QUICK_TOGGLES,
  QUICK_TOGGLES_BY_CATEGORY,
  ALL_QUICK_ACTION_IDS,
  CATEGORY_ORDER,
  CATEGORY_LABEL_KEY,
  getQuickToggle,
} from './catalog';
export { default as QuickActionsPalette } from './QuickActionsPalette';
export { default as QuickActionsSettings } from './QuickActionsSettings';
