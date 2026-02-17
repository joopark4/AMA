import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export type ConversationStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface ConversationState {
  messages: Message[];
  currentResponse: string | null;
  status: ConversationStatus;
  isProcessing: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  error: string | null;

  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  setCurrentResponse: (response: string | null) => void;
  setStatus: (status: ConversationStatus) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setIsListening: (isListening: boolean) => void;
  setIsSpeaking: (isSpeaking: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  clearCurrentResponse: () => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  messages: [],
  currentResponse: null,
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
    set({ messages: [] }),

  clearCurrentResponse: () =>
    set({ currentResponse: null }),
}));
