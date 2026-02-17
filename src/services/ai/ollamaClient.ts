import type { Message, LLMResponse, StreamCallbacks, ChatOptions, LLMClient } from './types';
import { useSettingsStore } from '../../stores/settingsStore';

export class OllamaClient implements LLMClient {
  private getEndpoint(): string {
    const { settings } = useSettingsStore.getState();
    return settings.llm.endpoint || 'http://localhost:11434';
  }

  private getModel(): string {
    const { settings } = useSettingsStore.getState();
    return settings.llm.model || 'deepseek-v3';
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse> {
    const endpoint = this.getEndpoint();
    const model = this.getModel();

    const ollamaMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (options?.systemPrompt) {
      ollamaMessages.unshift({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    const response = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.message?.content || '',
      finishReason: data.done ? 'stop' : undefined,
    };
  }

  async chatStream(
    messages: Message[],
    callbacks: StreamCallbacks,
    options?: ChatOptions
  ): Promise<void> {
    const endpoint = this.getEndpoint();
    const model = this.getModel();

    const ollamaMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (options?.systemPrompt) {
      ollamaMessages.unshift({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    try {
      const response = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: ollamaMessages,
          stream: true,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens ?? 2048,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
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
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              fullResponse += data.message.content;
              callbacks.onToken?.(data.message.content);
            }
          } catch {
            // Ignore JSON parse errors for incomplete chunks
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
      const response = await fetch(`${endpoint}/api/tags`, {
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
      const response = await fetch(`${endpoint}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (data.models || []).map((m: { name: string }) => m.name);
    } catch {
      return [];
    }
  }
}

// Export singleton for model fetching
export const ollamaClient = new OllamaClient();
