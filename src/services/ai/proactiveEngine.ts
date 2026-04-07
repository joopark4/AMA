/**
 * 자발적 대화 엔진 (Phase 3)
 *
 * 사용자가 말을 걸지 않아도 아바타가 먼저 말을 건다.
 * - 유휴 감지 타이머
 * - 트리거 유형: idle_greeting, time_greeting, return_greeting
 * - 쿨다운: 자발 발화 후 최소 N분 재발화 방지
 * - 안전 가드레일: 대화 중/TTS 재생 중이면 보류
 */

import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { llmRouter } from './llmRouter';
import { buildCharacterPrompt } from '../character';
import { buildMessageWindow } from './memoryManager';
import type { Message as LLMMessage } from './types';

export type ProactiveTrigger = 'idle_greeting' | 'time_greeting' | 'return_greeting';

export interface ProactiveSettings {
  enabled: boolean;
  /** 유휴 대기 시간 (분) */
  idleMinutes: number;
  /** 최소 재발화 쿨다운 (분) */
  cooldownMinutes: number;
}

export const DEFAULT_PROACTIVE_SETTINGS: ProactiveSettings = {
  enabled: false,
  idleMinutes: 5,
  cooldownMinutes: 10,
};

/** 시간대 판별 */
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

/** 시간대별 힌트 */
function getTimeHint(): string {
  const timeOfDay = getTimeOfDay();
  const hour = new Date().getHours();
  const hints: Record<string, string> = {
    morning: `현재 시각은 오전 ${hour}시입니다. 아침 인사를 해주세요.`,
    afternoon: `현재 시각은 오후 ${hour > 12 ? hour - 12 : hour}시입니다. 점심 이후 안부를 물어보세요.`,
    evening: `현재 시각은 저녁 ${hour > 12 ? hour - 12 : hour}시입니다. 저녁 인사를 해주세요.`,
    night: `현재 시각은 밤 ${hour > 12 ? hour - 12 : hour}시입니다. 늦은 시간이니 걱정/안부를 표현해주세요.`,
  };
  return hints[timeOfDay];
}

/** 트리거별 시스템 힌트 */
function getTriggerHint(trigger: ProactiveTrigger): string {
  switch (trigger) {
    case 'idle_greeting':
      return '사용자가 한동안 조용합니다. 먼저 자연스럽게 말을 걸어주세요. 무엇을 하고 있는지 물어보거나 가벼운 화제를 꺼내세요.';
    case 'time_greeting':
      return getTimeHint();
    case 'return_greeting':
      return '사용자가 잠시 자리를 비웠다가 돌아왔습니다. 반갑게 맞이해주세요.';
  }
}

/**
 * 자발적 대화 생성
 *
 * @returns 생성된 텍스트 또는 null (생성 실패 시)
 */
export async function generateProactiveMessage(trigger: ProactiveTrigger): Promise<string | null> {
  const { settings } = useSettingsStore.getState();
  const character = settings.character;

  // 캐릭터 프로필 기반 시스템 프롬프트
  const basePrompt = character?.name || character?.personality?.traits?.length
    ? buildCharacterPrompt(character)
    : '';

  if (!basePrompt) return null;

  // 메모리 컨텍스트
  const storeState = useConversationStore.getState();
  const { memoryContext } = buildMessageWindow(storeState.messages, storeState.memory);

  const triggerHint = getTriggerHint(trigger);

  const systemPrompt = [
    basePrompt,
    memoryContext,
    `\n[자발적 대화 지시]\n${triggerHint}`,
    '논쟁적 주제/정치/종교에 대해서는 절대 언급하지 마세요.',
    '최대 2문장으로 짧게 말하세요.',
  ].filter(Boolean).join('\n\n');

  const llmMessages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '[시스템: 자발적 대화 트리거]' },
  ];

  try {
    const response = await llmRouter.chat(llmMessages, {
      temperature: 0.8,
      maxTokens: 100,
    });
    return response.content?.trim() || null;
  } catch (err) {
    console.error('[proactiveEngine] Failed to generate:', err);
    return null;
  }
}

/**
 * Proactive Engine — 싱글톤
 *
 * start/stop으로 제어. 내부적으로 유휴 타이머를 관리하고
 * 조건 충족 시 onProactiveMessage 콜백을 호출한다.
 */
export class ProactiveEngine {
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastProactiveAt = 0;
  private lastUserActivityAt = Date.now();
  private running = false;
  private onMessage: ((text: string, trigger: ProactiveTrigger) => void) | null = null;

  start(onMessage: (text: string, trigger: ProactiveTrigger) => void): void {
    this.onMessage = onMessage;
    this.running = true;
    this.lastUserActivityAt = Date.now();
    this.scheduleIdleCheck();
  }

  stop(): void {
    this.running = false;
    this.onMessage = null;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /** 사용자 활동 발생 시 호출 (타이머 리셋) */
  notifyUserActivity(): void {
    this.lastUserActivityAt = Date.now();
  }

  /** 앱 포커스 복귀 시 호출 */
  notifyAppFocusReturn(): void {
    if (!this.running) return;
    const proactive = useSettingsStore.getState().settings.proactive;
    if (!proactive?.enabled) return;
    if (!this.canTrigger(proactive)) return;

    void this.trigger('return_greeting');
  }

  private scheduleIdleCheck(): void {
    if (!this.running) return;
    // 1분마다 체크
    this.idleTimer = setTimeout(() => {
      void this.checkIdle();
      this.scheduleIdleCheck();
    }, 60_000);
  }

  private async checkIdle(): Promise<void> {
    if (!this.running) return;
    const proactive = useSettingsStore.getState().settings.proactive;
    if (!proactive?.enabled) return;
    if (!this.canTrigger(proactive)) return;

    const idleMs = Date.now() - this.lastUserActivityAt;
    const idleThreshold = proactive.idleMinutes * 60_000;

    if (idleMs < idleThreshold) return;

    // 시간대 인사 vs 일반 유휴 인사
    const trigger: ProactiveTrigger = this.shouldTimeGreeting() ? 'time_greeting' : 'idle_greeting';
    await this.trigger(trigger);
  }

  private canTrigger(proactive: ProactiveSettings): boolean {
    // 대화 중 또는 TTS 재생 중이면 보류
    const convState = useConversationStore.getState();
    if (convState.status !== 'idle') return false;

    // 쿨다운
    const cooldownMs = proactive.cooldownMinutes * 60_000;
    if (Date.now() - this.lastProactiveAt < cooldownMs) return false;

    return true;
  }

  private shouldTimeGreeting(): boolean {
    // 시간대 인사: 앱 시작 후 첫 유휴 트리거이거나, 마지막 인사에서 6시간 이상 경과
    return this.lastProactiveAt === 0 || Date.now() - this.lastProactiveAt > 6 * 60 * 60_000;
  }

  private async trigger(trigger: ProactiveTrigger): Promise<void> {
    const text = await generateProactiveMessage(trigger);
    if (!text) return;

    this.lastProactiveAt = Date.now();
    this.lastUserActivityAt = Date.now(); // 자발 발화도 활동으로 취급
    this.onMessage?.(text, trigger);
  }
}

export const proactiveEngine = new ProactiveEngine();
