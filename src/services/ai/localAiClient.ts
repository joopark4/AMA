import type { Message, LLMResponse, StreamCallbacks, ChatOptions, LLMClient } from './types';
import { useSettingsStore } from '../../stores/settingsStore';

export class LocalAIClient implements LLMClient {
  private getEndpoint(): string {
    const { settings } = useSettingsStore.getState();
    return settings.llm.endpoint || 'http://localhost:8080';
  }

  private getModel(): string {
    const { settings } = useSettingsStore.getState();
    return settings.llm.model || 'deepseek-v3';
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse> {
    const endpoint = this.getEndpoint();
    const model = this.getModel();

    const openAIMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (options?.systemPrompt) {
      openAIMessages.unshift({
        role: 'system' as const,
        content: options.systemPrompt,
      });
    }

    const response = await fetch(`${endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: openAIMessages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`LocalAI error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      finishReason: data.choices?.[0]?.finish_reason,
    };
  }

  async chatStream(
    messages: Message[],
    callbacks: StreamCallbacks,
    options?: ChatOptions
  ): Promise<void> {
    const endpoint = this.getEndpoint();
    const model = this.getModel();

    const openAIMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (options?.systemPrompt) {
      openAIMessages.unshift({
        role: 'system' as const,
        content: options.systemPrompt,
      });
    }

    try {
      const response = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: openAIMessages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2048,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`LocalAI error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                callbacks.onToken?.(content);
              }
            } catch {
              // Ignore JSON parse errors
            }
          }
        }
      }

      callbacks.onComplete?.(fullResponse);
    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const endpoint = this.getEndpoint();
      const response = await fetch(`${endpoint}/v1/models`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const endpoint = this.getEndpoint();
      const response = await fetch(`${endpoint}/v1/models`, {
        method: 'GET',
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (data.data || [])
        .map((model: { id?: string }) => model.id)
        .filter((id: string | undefined): id is string => typeof id === 'string' && id.length > 0);
    } catch {
      return [];
    }
  }
}

export const localAiClient = new LocalAIClient();
