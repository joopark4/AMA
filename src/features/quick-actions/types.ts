/**
 * Quick Actions — 자주 쓰는 기능 타입 정의 (Phase 4).
 *
 * 사용자가 ✨ 버튼이나 설정에서 등록한 기능을 한 번에 호출하는 모듈.
 */
import type { LucideIcon } from 'lucide-react';

export type QuickActionId =
  | 'calendar'
  | 'mail'
  | 'translate'
  | 'capture'
  | 'polish'
  | 'focus'
  | 'news'
  | 'files'
  | 'memo';

export interface QuickActionDef {
  id: QuickActionId;
  icon: LucideIcon;
  /** i18n 키 — 짧은 라벨 (예: "오늘 일정") */
  labelKey: string;
  /** i18n 키 — 한 줄 힌트 (예: "캘린더 요약") */
  hintKey: string;
  /** i18n 키 — 상세 설명 (설정 등록 화면용) */
  descKey: string;
  /** 아이콘 칩 배경 oklch 색상 */
  accent: string;
}

/**
 * 핸들러가 사용할 수 있는 환경 — 외부에서 주입.
 * 컴포넌트가 useConversation 등을 통해 sendMessage를 확보한 뒤 dispatch에 전달한다.
 */
export interface QuickActionContext {
  /** LLM에 메시지 전송 (사용자 입력으로 처리) */
  sendMessage: (text: string) => Promise<void> | void;
  /** 시스템 클립보드에서 텍스트 읽기. 실패 시 빈 문자열 */
  readClipboard: () => Promise<string>;
}

export type QuickActionHandler = (ctx: QuickActionContext) => Promise<void> | void;

/** 모든 QuickActionId의 집합 — 마이그레이션/필터에서 사용 */
export const ALL_QUICK_ACTION_IDS: ReadonlySet<QuickActionId> = new Set([
  'calendar',
  'mail',
  'translate',
  'capture',
  'polish',
  'focus',
  'news',
  'files',
  'memo',
]);
