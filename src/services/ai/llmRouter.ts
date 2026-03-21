import type { Message, LLMResponse, StreamCallbacks, ChatOptions, LLMClient } from './types';
import { OllamaClient } from './ollamaClient';
import { LocalAIClient } from './localAiClient';
import { ClaudeClient } from './claudeClient';
import { OpenAIClient } from './openaiClient';
import { GeminiClient } from './geminiClient';
import { ClaudeCodeClient } from '../../features/channels';
import { useSettingsStore, LLMProvider } from '../../stores/settingsStore';

class LLMRouter {
  private clients: Map<LLMProvider, LLMClient> = new Map();

  constructor() {
    this.initializeClients();
  }

  private initializeClients() {
    this.clients.set('ollama', new OllamaClient());
    this.clients.set('localai', new LocalAIClient());
    this.clients.set('claude', new ClaudeClient());
    this.clients.set('openai', new OpenAIClient());
    this.clients.set('gemini', new GeminiClient());
    this.clients.set('claude_code', new ClaudeCodeClient());
  }

  private getClient(): LLMClient {
    const { settings } = useSettingsStore.getState();
    const client = this.clients.get(settings.llm.provider);

    if (!client) {
      throw new Error(`Unknown LLM provider: ${settings.llm.provider}`);
    }

    return client;
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse> {
    const client = this.getClient();
    return client.chat(messages, options);
  }

  async chatStream(
    messages: Message[],
    callbacks: StreamCallbacks,
    options?: ChatOptions
  ): Promise<void> {
    const client = this.getClient();
    return client.chatStream(messages, callbacks, options);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const client = this.getClient();
      return await client.isAvailable();
    } catch {
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const available = await this.isAvailable();
      if (!available) {
        return { success: false, error: 'LLM service not available' };
      }

      // Try a simple chat
      const response = await this.chat([
        { role: 'user', content: 'Hello' }
      ]);

      return { success: !!response.content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const llmRouter = new LLMRouter();
export default llmRouter;
