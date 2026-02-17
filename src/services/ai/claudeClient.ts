import Anthropic from '@anthropic-ai/sdk';
import type { Message, LLMResponse, StreamCallbacks, ChatOptions, LLMClient } from './types';
import { useSettingsStore } from '../../stores/settingsStore';

export class ClaudeClient implements LLMClient {
  private static readonly DEFAULT_MAX_TOKENS = 2048;

  private getClient(): Anthropic {
    const { settings } = useSettingsStore.getState();
    const apiKey = settings.llm.apiKey;

    if (!apiKey) {
      throw new Error('Claude API key not configured');
    }

    return new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  private getModel(): string {
    const { settings } = useSettingsStore.getState();
    return settings.llm.model || 'claude-sonnet-4-5';
  }

  private getSystemMessage(messages: Message[], options?: ChatOptions): string | undefined {
    return options?.systemPrompt || messages.find((m) => m.role === 'system')?.content;
  }

  private buildTextMessages(messages: Message[]): Anthropic.Messages.MessageParam[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
  }

  private buildVisionMessages(messages: Message[], imageBase64: string): Anthropic.Messages.MessageParam[] {
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    if (!lastUserMessage) {
      throw new Error('No user message found');
    }

    return [
      ...messages.slice(0, -1).filter((m) => m.role !== 'system').map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      {
        role: 'user' as const,
        content: [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: 'image/png' as const,
              data: imageBase64,
            },
          },
          {
            type: 'text' as const,
            text: lastUserMessage.content,
          },
        ],
      },
    ];
  }

  private toLLMResponse(response: Anthropic.Messages.Message): LLMResponse {
    const textContent = response.content.find((c) => c.type === 'text');
    return {
      content: textContent?.type === 'text' ? textContent.text : '',
      finishReason: response.stop_reason || undefined,
    };
  }

  private async createMessageResponse(
    messages: Anthropic.Messages.MessageParam[],
    systemMessage: string | undefined,
    options?: ChatOptions
  ): Promise<LLMResponse> {
    const client = this.getClient();
    const model = this.getModel();
    const response = await client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? ClaudeClient.DEFAULT_MAX_TOKENS,
      system: systemMessage,
      messages,
    });
    return this.toLLMResponse(response);
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse> {
    const anthropicMessages = this.buildTextMessages(messages);
    const systemMessage = this.getSystemMessage(messages, options);
    return this.createMessageResponse(anthropicMessages, systemMessage, options);
  }

  async chatStream(
    messages: Message[],
    callbacks: StreamCallbacks,
    options?: ChatOptions
  ): Promise<void> {
    const client = this.getClient();
    const model = this.getModel();

    const anthropicMessages = this.buildTextMessages(messages);
    const systemMessage = this.getSystemMessage(messages, options);

    try {
      const stream = await client.messages.stream({
        model,
        max_tokens: options?.maxTokens ?? ClaudeClient.DEFAULT_MAX_TOKENS,
        system: systemMessage,
        messages: anthropicMessages,
      });

      let fullResponse = '';

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const text = event.delta.text;
          fullResponse += text;
          callbacks.onToken?.(text);
        }
      }

      callbacks.onComplete?.(fullResponse);
    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { settings } = useSettingsStore.getState();
      return !!settings.llm.apiKey;
    } catch {
      return false;
    }
  }

  async chatWithVision(
    messages: Message[],
    imageBase64: string,
    options?: ChatOptions
  ): Promise<LLMResponse> {
    const anthropicMessages = this.buildVisionMessages(messages, imageBase64);
    const systemMessage = this.getSystemMessage(messages, options);
    return this.createMessageResponse(anthropicMessages, systemMessage, options);
  }
}
