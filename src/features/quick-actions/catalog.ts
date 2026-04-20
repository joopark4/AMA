/**
 * Quick Actions 카탈로그 — 정의 + 기본 핸들러.
 *
 * 핸들러는 `QuickActionContext`를 받아 sendMessage / readClipboard 등을 호출.
 * UI는 `QUICK_ACTION_DEFS`만 보고 렌더, 실행 시 `runQuickAction`로 dispatch.
 */
import {
  Brain,
  Calendar,
  Camera,
  Folder,
  Languages,
  Mail,
  Music,
  Pen,
  Zap,
} from 'lucide-react';
import type {
  QuickActionContext,
  QuickActionDef,
  QuickActionHandler,
  QuickActionId,
} from './types';

/** 9개 기능 정의 — 핸드오프 spec과 동일 순서/색상 */
export const QUICK_ACTION_DEFS: QuickActionDef[] = [
  {
    id: 'calendar',
    icon: Calendar,
    labelKey: 'quick.calendar.label',
    hintKey: 'quick.calendar.hint',
    descKey: 'quick.calendar.desc',
    accent: 'oklch(0.85 0.10 50)',
  },
  {
    id: 'mail',
    icon: Mail,
    labelKey: 'quick.mail.label',
    hintKey: 'quick.mail.hint',
    descKey: 'quick.mail.desc',
    accent: 'oklch(0.85 0.10 200)',
  },
  {
    id: 'translate',
    icon: Languages,
    labelKey: 'quick.translate.label',
    hintKey: 'quick.translate.hint',
    descKey: 'quick.translate.desc',
    accent: 'oklch(0.85 0.10 320)',
  },
  {
    id: 'capture',
    icon: Camera,
    labelKey: 'quick.capture.label',
    hintKey: 'quick.capture.hint',
    descKey: 'quick.capture.desc',
    accent: 'oklch(0.85 0.10 140)',
  },
  {
    id: 'polish',
    icon: Pen,
    labelKey: 'quick.polish.label',
    hintKey: 'quick.polish.hint',
    descKey: 'quick.polish.desc',
    accent: 'oklch(0.85 0.10 70)',
  },
  {
    id: 'focus',
    icon: Music,
    labelKey: 'quick.focus.label',
    hintKey: 'quick.focus.hint',
    descKey: 'quick.focus.desc',
    accent: 'oklch(0.85 0.10 25)',
  },
  {
    id: 'news',
    icon: Zap,
    labelKey: 'quick.news.label',
    hintKey: 'quick.news.hint',
    descKey: 'quick.news.desc',
    accent: 'oklch(0.85 0.10 240)',
  },
  {
    id: 'files',
    icon: Folder,
    labelKey: 'quick.files.label',
    hintKey: 'quick.files.hint',
    descKey: 'quick.files.desc',
    accent: 'oklch(0.85 0.10 110)',
  },
  {
    id: 'memo',
    icon: Brain,
    labelKey: 'quick.memo.label',
    hintKey: 'quick.memo.hint',
    descKey: 'quick.memo.desc',
    accent: 'oklch(0.85 0.10 290)',
  },
];

const DEF_BY_ID: Record<QuickActionId, QuickActionDef> = QUICK_ACTION_DEFS.reduce(
  (acc, def) => ({ ...acc, [def.id]: def }),
  {} as Record<QuickActionId, QuickActionDef>
);

export function getQuickActionDef(id: QuickActionId): QuickActionDef | undefined {
  return DEF_BY_ID[id];
}

/**
 * 기본 핸들러들 — 대부분 sendMessage로 LLM에 프롬프트 주입.
 * translate / polish는 클립보드 텍스트를 읽어 프롬프트에 포함.
 *
 * MVP 정책: 외부 API(캘린더/메일 실시간 데이터)는 통합하지 않고
 * LLM에 자연어 프롬프트만 전달한다. 추후 도구 호출(tool use) 도입 시 확장.
 */
const HANDLERS: Record<QuickActionId, QuickActionHandler> = {
  calendar: async (ctx) => {
    await ctx.sendMessage('오늘 일정을 짧게 요약해줘.');
  },
  mail: async (ctx) => {
    await ctx.sendMessage('읽지 않은 메일 중 중요한 것만 골라 요약해줘.');
  },
  translate: async (ctx) => {
    const text = await ctx.readClipboard();
    if (!text.trim()) {
      await ctx.sendMessage('번역할 텍스트가 클립보드에 없어. 복사한 뒤 다시 시도해줘.');
      return;
    }
    await ctx.sendMessage(`다음을 자연스럽게 번역해줘:\n\n${text}`);
  },
  capture: async (ctx) => {
    // 화면 분석은 화면 관찰 기능과 자연스럽게 안내 (별도 캡처 IPC 미구현 상태)
    await ctx.sendMessage(
      '지금 화면을 분석하고 싶어. 화면 관찰(Screen Watch) 기능을 켜거나 스크린샷을 첨부해줘.'
    );
  },
  polish: async (ctx) => {
    const text = await ctx.readClipboard();
    if (!text.trim()) {
      await ctx.sendMessage('다듬을 글이 클립보드에 없어. 복사한 뒤 다시 시도해줘.');
      return;
    }
    await ctx.sendMessage(
      `다음 글의 맞춤법·어투·문장 흐름을 자연스럽게 다듬어줘. 의미는 유지해줘.\n\n${text}`
    );
  },
  focus: async (ctx) => {
    await ctx.sendMessage('집중에 좋은 음악이나 백색소음을 추천해줘.');
  },
  news: async (ctx) => {
    await ctx.sendMessage('오늘 주요 뉴스 3개만 짧게 정리해줘.');
  },
  files: async (ctx) => {
    await ctx.sendMessage('어지러운 다운로드 폴더를 카테고리별로 정리하는 방법을 알려줘.');
  },
  memo: async (ctx) => {
    await ctx.sendMessage('방금 한 대화 핵심을 메모처럼 짧게 정리해줘.');
  },
};

/** 단일 진입점 — UI는 이 함수만 호출 */
export async function runQuickAction(
  id: QuickActionId,
  ctx: QuickActionContext
): Promise<void> {
  const handler = HANDLERS[id];
  if (!handler) return;
  await handler(ctx);
}
