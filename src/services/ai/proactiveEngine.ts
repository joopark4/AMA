/**
 * 자발적 대화 엔진 (Phase 3 / v2)
 *
 * 기존 1분 타이머 + 단일 idle 체크 → **Presence 기반 이벤트 트리거 + 2-stage LLM 필터**로 교체.
 *
 * v2 개선:
 * - PresenceTracker 구독 → idle 경계/포커스 복귀 이벤트 수신
 * - Urgency score 계산 (신호 가중합) + 동적 쿨다운 (urgency 반비례)
 * - Stage 1: 경량 LLM 호출로 `should_speak` 판단 (헛발화 1차 필터)
 * - Stage 2: 실제 발화 생성 (기존 로직)
 */

import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { llmRouter } from './llmRouter';
import { buildCharacterPrompt } from '../character';
import { buildMessageWindow } from './memoryManager';
import type { Message as LLMMessage } from './types';
import { presenceTracker, type Presence } from '../presence/presenceTracker';
import { resolveResponseLanguage } from '../../hooks/useConversation';

const debug = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log('[proactive]', ...args);
};

export type ProactiveTrigger =
  | 'idle_greeting'
  | 'time_greeting'
  | 'return_greeting'
  | 'observation'
  | 'silent';

export interface ProactiveSettings {
  enabled: boolean;
  /** 유휴 대기 시간 (분) */
  idleMinutes: number;
  /** 최소 재발화 쿨다운 (분) — urgency 낮을 때 상한 */
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

function getTriggerHint(trigger: ProactiveTrigger): string {
  switch (trigger) {
    case 'idle_greeting':
      return '사용자가 한동안 조용합니다. 먼저 자연스럽게 말을 걸어주세요. 무엇을 하고 있는지 물어보거나 가벼운 화제를 꺼내세요.';
    case 'time_greeting':
      return getTimeHint();
    case 'return_greeting':
      return '사용자가 잠시 자리를 비웠다가 돌아왔습니다. 반갑게 맞이해주세요.';
    case 'observation':
      return '사용자가 작업 중인 것 같습니다. 방해되지 않는 선에서 짧은 관찰이나 격려 한마디를 건네세요.';
    case 'silent':
      return ''; // 발화 없음
  }
}

/** Urgency 신호 → 가중합 (0..1) */
export function computeUrgency(inputs: {
  idleSec: number;
  idleThresholdSec: number;
  returnedFromAway: boolean;
  crossedIdle: boolean;
  isFirstProactive: boolean;
  moodIntensity: number;
}): number {
  const idleRatio = Math.min(1, inputs.idleSec / Math.max(1, inputs.idleThresholdSec));
  const idleComponent = inputs.crossedIdle ? 0.5 : idleRatio * 0.3;
  const returnComponent = inputs.returnedFromAway ? 0.35 : 0;
  const firstComponent = inputs.isFirstProactive ? 0.2 : 0;
  const moodComponent = inputs.moodIntensity * 0.15;
  return Math.max(0, Math.min(1, idleComponent + returnComponent + firstComponent + moodComponent));
}

/**
 * urgency 기반 동적 쿨다운 (ms).
 *
 * 높은 urgency → 짧은 쿨다운 (더 빨리 다시 말할 수 있음)
 * 낮은 urgency → 긴 쿨다운
 */
export function urgencyToCooldownMs(urgency: number, baseCooldownMinutes: number): number {
  const u = Math.max(0, Math.min(1, urgency));
  const base = baseCooldownMinutes * 60_000;
  if (u >= 0.9) return 2 * 60_000;
  if (u >= 0.5) return Math.min(base, 10 * 60_000);
  return Math.max(base, 30 * 60_000);
}

// ── Stage 1: should_speak 필터 ──

export interface InnerThought {
  shouldSpeak: boolean;
  category: ProactiveTrigger;
  reason?: string;
}

/**
 * Stage 1: 경량 LLM 호출로 "지금 말할 적절한 순간인가" 판단.
 *
 * 실패/malformed 시 heuristic fallback 사용.
 */
export async function innerThought(context: {
  trigger: ProactiveTrigger;
  urgency: number;
  idleSec: number;
  isPageVisible: boolean;
  recentUserMessage: string | null;
}): Promise<InnerThought> {
  // 빠른 휴리스틱: silent trigger이거나 탭이 숨겨진 상태면 skip.
  // (window focus는 DevTools 오픈 시 blur되므로 체크하지 않는다 — 탭 visibility만 본다)
  if (context.trigger === 'silent') {
    return { shouldSpeak: false, category: 'silent' };
  }
  if (!context.isPageVisible) {
    return { shouldSpeak: false, category: 'silent', reason: 'page not visible' };
  }

  // 중강도 이상 urgency는 LLM 판단 없이 바로 발화 (쿨다운/urgency 필터가 이미 통과했음)
  if (context.urgency >= 0.4) {
    return { shouldSpeak: true, category: context.trigger };
  }

  // Stage 1 프롬프트: 저 urgency(<0.4)에서만 호출됨. 강한 긍정 bias.
  const systemPrompt = [
    '당신은 AI 아바타의 "내부 사고(inner thought)"입니다.',
    '자연스러운 동반자처럼 먼저 말을 걸어도 되는지 판단하세요.',
    '기본 답은 true입니다. 다음 한 가지 경우에만 false로 답하세요:',
    '- 최근 사용자 메시지에 "집중해야 해", "방해하지 마", "조용히 해" 같은 명시적 요청이 있음',
    '그 외 모든 경우엔 true로 답하세요.',
    '반드시 다음 JSON 형식으로만 답하세요 (추가 설명 금지):',
    '{"should_speak": boolean, "category": "idle_greeting"|"time_greeting"|"return_greeting"|"observation"|"silent"}',
  ].join('\n');

  const userPrompt = JSON.stringify({
    proposed_trigger: context.trigger,
    urgency: Number(context.urgency.toFixed(2)),
    idle_sec: Math.round(context.idleSec),
    recent_user_message: context.recentUserMessage?.slice(0, 120) ?? null,
  });

  try {
    const response = await llmRouter.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 60 }
    );
    const raw = response.content?.trim() ?? '';
    const parsed = extractJson(raw);
    if (parsed && typeof parsed.should_speak === 'boolean') {
      const category = isValidTrigger(parsed.category) ? parsed.category : context.trigger;
      return { shouldSpeak: parsed.should_speak, category };
    }
  } catch (err) {
    console.warn('[proactiveEngine] inner thought stage failed, falling back', err);
  }

  // Heuristic fallback: urgency ≥ 0.2면 말함 (LLM 실패 시에도 관대하게)
  return { shouldSpeak: context.urgency >= 0.2, category: context.trigger };
}

function isValidTrigger(value: unknown): value is ProactiveTrigger {
  return (
    value === 'idle_greeting' ||
    value === 'time_greeting' ||
    value === 'return_greeting' ||
    value === 'observation' ||
    value === 'silent'
  );
}

function extractJson(text: string): { should_speak?: unknown; category?: unknown } | null {
  // 모델이 앞뒤 설명을 붙여도 첫 { ... } 블록만 추출
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// ── Stage 2: 실제 발화 생성 ──

export async function generateProactiveMessage(trigger: ProactiveTrigger): Promise<string | null> {
  if (trigger === 'silent') return null;

  const { settings } = useSettingsStore.getState();
  const character = settings.character;

  // 응답 언어는 TTS 출력 언어 기준 (엔진별 폴백 포함)
  const responseLanguage = resolveResponseLanguage();
  const basePrompt =
    character?.name || character?.personality?.traits?.length
      ? buildCharacterPrompt(character, responseLanguage)
      : '';
  if (!basePrompt) return null;

  const storeState = useConversationStore.getState();
  const { memoryContext } = buildMessageWindow(storeState.messages, storeState.memory);

  const triggerHint = getTriggerHint(trigger);

  const systemPrompt = [
    basePrompt,
    memoryContext,
    `\n[자발적 대화 지시]\n${triggerHint}`,
    '논쟁적 주제/정치/종교에 대해서는 절대 언급하지 마세요.',
    '최대 2문장으로 짧게 말하세요.',
  ]
    .filter(Boolean)
    .join('\n\n');

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

// ── Engine ──

export class ProactiveEngine {
  private lastProactiveAt = 0;
  private running = false;
  private onMessage: ((text: string, trigger: ProactiveTrigger) => void) | null = null;
  private unsubPresence: (() => void) | null = null;
  private inFlight = false;

  start(onMessage: (text: string, trigger: ProactiveTrigger) => void): void {
    if (this.running) this.stop();
    this.onMessage = onMessage;
    this.running = true;

    // PresenceTracker에 구독
    presenceTracker.start();
    this.unsubPresence = presenceTracker.subscribe((p) => this.onPresence(p));
    debug('engine started, subscribed to presenceTracker');
  }

  stop(): void {
    this.running = false;
    this.onMessage = null;
    if (this.unsubPresence) {
      this.unsubPresence();
      this.unsubPresence = null;
    }
  }

  /** @deprecated presenceTracker가 DOM 이벤트로 활동을 직접 수집. 호환용 브리지. */
  notifyUserActivity(): void {
    presenceTracker.notifyActivity();
  }

  /** @deprecated presenceTracker의 returnedFromAway가 대체. 호환용 브리지. */
  notifyAppFocusReturn(): void {
    // 명시 호출 시 즉시 return_greeting 시도 (포커스 복귀 직후)
    if (!this.running || this.inFlight) return;
    const proactive = useSettingsStore.getState().settings.proactive;
    if (!proactive?.enabled) return;
    if (!this.canTrigger(proactive, /*urgency*/ 0.6)) return;
    void this.trigger('return_greeting', 0.6);
  }

  private async onPresence(presence: Presence): Promise<void> {
    if (!this.running || this.inFlight) return;
    const proactive = useSettingsStore.getState().settings.proactive;
    if (!proactive?.enabled) return;

    const convState = useConversationStore.getState();
    if (convState.status !== 'idle') {
      if (presence.idleCrossed) {
        debug('idle crossed but status=', convState.status, '— skipped');
      }
      return;
    }

    // 시그널 평가
    const idleThresholdSec = proactive.idleMinutes * 60;
    const isFirstProactive = this.lastProactiveAt === 0;
    const urgency = computeUrgency({
      idleSec: presence.idleSec,
      idleThresholdSec,
      returnedFromAway: presence.returnedFromAway,
      crossedIdle: presence.idleCrossed,
      isFirstProactive,
      moodIntensity: convState.moodIntensity ?? 0,
    });

    // 트리거 후보 선정 (우선순위: return > idleCrossed > 시간대)
    let trigger: ProactiveTrigger = 'silent';
    if (presence.returnedFromAway) trigger = 'return_greeting';
    else if (presence.idleCrossed) {
      trigger = this.shouldTimeGreeting() ? 'time_greeting' : 'idle_greeting';
    }

    if (trigger === 'silent') return;

    debug(`trigger=${trigger} urgency=${urgency.toFixed(2)} idleSec=${presence.idleSec.toFixed(0)}`);

    if (!this.canTrigger(proactive, urgency)) {
      const cooldownMs = urgencyToCooldownMs(urgency, proactive.cooldownMinutes);
      const remaining = cooldownMs - (Date.now() - this.lastProactiveAt);
      debug(`cooldown blocking — ${Math.round(remaining / 1000)}s remaining`);
      return;
    }

    await this.trigger(trigger, urgency);
  }

  private canTrigger(proactive: ProactiveSettings, urgency: number): boolean {
    const cooldownMs = urgencyToCooldownMs(urgency, proactive.cooldownMinutes);
    if (Date.now() - this.lastProactiveAt < cooldownMs) return false;
    return true;
  }

  private shouldTimeGreeting(): boolean {
    return this.lastProactiveAt === 0 || Date.now() - this.lastProactiveAt > 6 * 60 * 60_000;
  }

  private async trigger(proposedTrigger: ProactiveTrigger, urgency: number): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;

    try {
      // Stage 1: inner thought
      const presence = presenceTracker.getSnapshot();
      const messages = useConversationStore.getState().messages;
      const recentUser = [...messages].reverse().find((m) => m.role === 'user');

      debug('stage 1 (inner thought) start');
      const thought = await innerThought({
        trigger: proposedTrigger,
        urgency,
        idleSec: presence.idleSec,
        isPageVisible: presence.isPageVisible,
        recentUserMessage: recentUser?.content ?? null,
      });
      debug('stage 1 result:', thought);

      if (!thought.shouldSpeak) return;

      // Stage 2: 실제 발화 생성
      debug('stage 2 (generate message) start');
      const text = await generateProactiveMessage(thought.category);
      debug('stage 2 result:', text ? `"${text.slice(0, 60)}..."` : 'null');
      if (!text) return;

      this.lastProactiveAt = Date.now();
      // 자발 발화도 활동으로 취급 (presence 트래커에도 반영)
      presenceTracker.notifyActivity();
      this.onMessage?.(text, thought.category);
    } finally {
      this.inFlight = false;
    }
  }
}

export const proactiveEngine = new ProactiveEngine();
