/**
 * 대화 메모리 매니저 (Phase 2)
 *
 * - 슬라이딩 윈도우: 최근 N개 메시지만 LLM 프롬프트에 포함
 * - 자동 요약: 윈도우 밖으로 밀린 메시지를 LLM으로 요약
 * - 중요 사실 추출: 사용자 이름, 선호도, 반복 언급 주제
 */

import { llmRouter } from './llmRouter';
import type { Message as LLMMessage } from './types';

/** 메모리 상태 (conversationStore에 저장) */
export interface MemoryState {
  /** 이전 대화 요약 */
  summary: string;
  /** 사용자에 대해 기억한 중요 사실들 */
  importantFacts: string[];
  /** 마지막 요약 시점의 메시지 수 */
  lastSummarizedAt: number;
}

export const DEFAULT_MEMORY_STATE: MemoryState = {
  summary: '',
  importantFacts: [],
  lastSummarizedAt: 0,
};

/** 설정 상수 */
const WINDOW_SIZE = 20;
const SUMMARIZE_THRESHOLD = 10; // 윈도우 밖 미요약 메시지가 이 수를 넘으면 요약 트리거

/**
 * 대화 메시지에서 LLM 프롬프트용 윈도우를 구성한다.
 *
 * 반환 구조:
 * - memoryContext: 시스템 프롬프트에 삽입할 메모리 컨텍스트 문자열
 * - recentMessages: 최근 N개 메시지
 */
export function buildMessageWindow(
  allMessages: { role: string; content: string; source?: string }[],
  memory: MemoryState
): {
  memoryContext: string;
  recentMessages: LLMMessage[];
} {
  // 외부 알림 제외
  const internalMessages = allMessages.filter(m => m.source !== 'external');

  // 최근 N개
  const recentMessages = internalMessages.slice(-WINDOW_SIZE).map(m => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));

  // 메모리 컨텍스트 구성
  const parts: string[] = [];

  if (memory.summary) {
    parts.push(`[이전 대화 요약]\n${memory.summary}`);
  }

  if (memory.importantFacts.length > 0) {
    parts.push(`[기억하고 있는 사실]\n${memory.importantFacts.map(f => `- ${f}`).join('\n')}`);
  }

  return {
    memoryContext: parts.length > 0 ? parts.join('\n\n') : '',
    recentMessages,
  };
}

/**
 * 윈도우 밖으로 밀린 메시지들을 요약한다.
 * LLM을 호출하므로 비동기.
 *
 * @returns 업데이트된 MemoryState 또는 null (요약 불필요 시)
 */
export async function summarizeIfNeeded(
  allMessages: { role: string; content: string; source?: string }[],
  currentMemory: MemoryState
): Promise<MemoryState | null> {
  const internalMessages = allMessages.filter(m => m.source !== 'external');
  const totalCount = internalMessages.length;

  // 윈도우 밖 미요약 메시지 수 계산
  const unsummarized = totalCount - WINDOW_SIZE - currentMemory.lastSummarizedAt;
  if (unsummarized < SUMMARIZE_THRESHOLD) return null;

  // 요약 대상: lastSummarizedAt ~ (totalCount - WINDOW_SIZE)
  const start = currentMemory.lastSummarizedAt;
  const end = totalCount - WINDOW_SIZE;
  if (end <= start) return null;

  const messagesToSummarize = internalMessages.slice(start, end);
  if (messagesToSummarize.length === 0) return null;

  const conversationText = messagesToSummarize
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const previousSummary = currentMemory.summary
    ? `이전 요약:\n${currentMemory.summary}\n\n`
    : '';

  try {
    // 요약 요청
    const summaryPrompt: LLMMessage[] = [
      {
        role: 'system',
        content: `당신은 대화 요약 전문가입니다. 아래 대화 내용을 3-5문장으로 간결하게 요약하세요.
사용자의 이름, 관심사, 선호도 등 중요한 사실은 반드시 포함하세요.
${previousSummary}요약만 출력하세요.`,
      },
      {
        role: 'user',
        content: `다음 대화를 요약해주세요:\n\n${conversationText}`,
      },
    ];

    const summaryResponse = await llmRouter.chat(summaryPrompt, {
      temperature: 0.3,
      maxTokens: 300,
    });

    // 중요 사실 추출
    const factsPrompt: LLMMessage[] = [
      {
        role: 'system',
        content: `다음 대화에서 사용자에 대한 중요한 사실(이름, 직업, 취미, 선호도, 반복 언급 주제 등)을 추출하세요.
각 사실을 한 줄씩 출력하세요. 중요한 것만 최대 10개.
이미 알고 있는 사실: ${currentMemory.importantFacts.join(', ') || '없음'}
새로운 사실만 추출하세요. 없으면 "없음"이라고 출력하세요.`,
      },
      {
        role: 'user',
        content: conversationText,
      },
    ];

    const factsResponse = await llmRouter.chat(factsPrompt, {
      temperature: 0.2,
      maxTokens: 200,
    });

    // 사실 파싱
    const newFacts = factsResponse.content
      .split('\n')
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line && line !== '없음' && line.length > 2);

    // 기존 사실과 합치되, 중복 제거 + 최대 10개
    const allFacts = [...currentMemory.importantFacts];
    for (const fact of newFacts) {
      const isDuplicate = allFacts.some(
        existing => existing.toLowerCase().includes(fact.toLowerCase()) ||
                    fact.toLowerCase().includes(existing.toLowerCase())
      );
      if (!isDuplicate) allFacts.push(fact);
    }

    return {
      summary: summaryResponse.content.trim(),
      importantFacts: allFacts.slice(0, 10),
      lastSummarizedAt: end,
    };
  } catch (err) {
    console.error('[memoryManager] Summarization failed:', err);
    return null;
  }
}
