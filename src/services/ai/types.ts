export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMResponse {
  content: string;
  finishReason?: string;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

export interface LLMClient {
  chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse>;
  chatStream(messages: Message[], callbacks: StreamCallbacks, options?: ChatOptions): Promise<void>;
  isAvailable(): Promise<boolean>;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface VisionMessage extends Message {
  imageBase64?: string;
}
