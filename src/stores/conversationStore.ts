import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_MEMORY_STATE, type MemoryState } from '../services/ai/memoryManager';
import type { Emotion } from './avatarStore';
import {
  MOOD_LERP_ALPHA,
  NEUTRAL_MOOD,
  lerpMood,
  moodMagnitude,
  nearestEmotion,
  type MoodVec,
} from '../services/character/vadCatalog';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** 외부 알림(ci-webhook, monitor-alert)은 'external' — LLM 프롬프트에서 제외 */
  source?: 'internal' | 'external';
}

export type ConversationStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface ConversationState {
  messages: Message[];
  currentResponse: string | null;
  /** 스트리밍 중 누적 토큰 (Phase 1) — 스트리밍 완료 시 null */
  streamingResponse: string | null;
  /** 대화 메모리 (Phase 2) — 요약 + 중요 사실 */
  memory: MemoryState;
  /**
   * 지속 감정 상태 (Phase 5) — 여러 턴에 걸쳐 서서히 변화.
   * `mood`는 `moodVec`을 가장 가까운 이산 라벨로 역매핑한 값이며 프롬프트 힌트용.
   */
  mood: Emotion;
  /** VAD 연속 감정 벡터 (v2) — 실제 내부 상태. 턴마다 lerp로 갱신. */
  moodVec: MoodVec;
  /** 감정 강도 (0..1) — render intensity에 곱하기 위한 값. */
  moodIntensity: number;
  status: ConversationStatus;
  isProcessing: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  error: string | null;

  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  setCurrentResponse: (response: string | null) => void;
  setStreamingResponse: (response: string | null) => void;
  appendStreamingToken: (token: string) => void;
  setMemory: (memory: MemoryState) => void;
  setMood: (mood: Emotion) => void;
  /**
   * VAD 연속 감정의 타겟을 지정하고 한 스텝 lerp를 수행한다.
   * mood/moodIntensity도 함께 파생 갱신된다.
   */
  setMoodTarget: (target: MoodVec, alpha?: number) => void;
  setStatus: (status: ConversationStatus) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setIsListening: (isListening: boolean) => void;
  setIsSpeaking: (isSpeaking: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  clearCurrentResponse: () => void;
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set) => ({
      messages: [],
      currentResponse: null,
      streamingResponse: null,
      memory: DEFAULT_MEMORY_STATE,
      mood: 'neutral' as Emotion,
      moodVec: { ...NEUTRAL_MOOD },
      moodIntensity: 0,
      status: 'idle',
      isProcessing: false,
      isListening: false,
      isSpeaking: false,
      error: null,

      addMessage: (message) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...message,
              id: crypto.randomUUID(),
              timestamp: Date.now(),
            },
          ],
        })),

      setCurrentResponse: (response) =>
        set({ currentResponse: response }),

      setStreamingResponse: (response) =>
        set({ streamingResponse: response }),

      appendStreamingToken: (token) =>
        set((state) => ({
          streamingResponse: (state.streamingResponse ?? '') + token,
        })),

      setMemory: (memory) => set({ memory }),

      setMood: (mood) => set({ mood }),

      setMoodTarget: (target, alpha = MOOD_LERP_ALPHA) =>
        set((state) => {
          const next = lerpMood(state.moodVec, target, alpha);
          return {
            moodVec: next,
            mood: nearestEmotion(next),
            moodIntensity: moodMagnitude(next),
          };
        }),

      setStatus: (status) =>
        set({
          status,
          isProcessing: status === 'processing',
          isListening: status === 'listening',
          isSpeaking: status === 'speaking',
        }),

      setIsProcessing: (isProcessing) =>
        set({ isProcessing }),

      setIsListening: (isListening) =>
        set({ isListening }),

      setIsSpeaking: (isSpeaking) =>
        set({ isSpeaking }),

      setError: (error) =>
        set({ error, status: error ? 'error' : 'idle' }),

      clearMessages: () =>
        set({
          messages: [],
          memory: DEFAULT_MEMORY_STATE,
          mood: 'neutral' as Emotion,
          moodVec: { ...NEUTRAL_MOOD },
          moodIntensity: 0,
        }),

      clearCurrentResponse: () =>
        set({ currentResponse: null }),
    }),
    {
      name: 'mypartnerai-conversation',
      // messages + memory만 저장, 휘발성 상태(status, currentResponse 등)는 제외
      partialize: (state) => ({ messages: state.messages, memory: state.memory }),
    }
  )
);
