import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_MEMORY_STATE, type MemoryState } from '../services/ai/memoryManager';
import type { Emotion } from './avatarStore';

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
  /** 지속 감정 상태 (Phase 5) — 여러 턴에 걸쳐 서서히 변화 */
  mood: Emotion;
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
        set({ messages: [], memory: DEFAULT_MEMORY_STATE, mood: 'neutral' as Emotion }),

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
