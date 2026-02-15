import OpenAI from 'openai';
import type { Message, LLMResponse, StreamCallbacks, ChatOptions, LLMClient } from './types';
import { useSettingsStore } from '../../stores/settingsStore';

export class OpenAIClient implements LLMClient {
  private getClient(): OpenAI {
    const { settings } = useSettingsStore.getState();
    const apiKey = settings.llm.apiKey;

    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    return new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  private getModel(): string {
    const { settings } = useSettingsStore.getState();
    return settings.llm.model || 'gpt-4o';
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse> {
    const client = this.getClient();
    const model = this.getModel();

    const openAIMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (options?.systemPrompt) {
      openAIMessages.unshift({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    const response = await client.chat.completions.create({
      model,
      messages: openAIMessages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      finishReason: response.choices[0]?.finish_reason || undefined,
    };
  }

  async chatStream(
    messages: Message[],
    callbacks: StreamCallbacks,
    options?: ChatOptions
  ): Promise<void> {
    const client = this.getClient();
    const model = this.getModel();

    const openAIMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (options?.systemPrompt) {
      openAIMessages.unshift({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    try {
      const stream = await client.chat.completions.create({
        model,
        messages: openAIMessages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        stream: true,
      });

      let fullResponse = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          callbacks.onToken?.(content);
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
    const client = this.getClient();
    const model = this.getModel();

    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    if (!lastUserMessage) {
      throw new Error('No user message found');
    }

    const openAIMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      ...messages.slice(0, -1).map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      {
        role: 'user' as const,
        content: [
          {
            type: 'image_url' as const,
            image_url: {
              url: `data:image/png;base64,${imageBase64}`,
            },
          },
          {
            type: 'text' as const,
            text: lastUserMessage.content,
          },
        ],
      },
    ];

    if (options?.systemPrompt) {
      openAIMessages.unshift({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    const response = await client.chat.completions.create({
      model,
      messages: openAIMessages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      finishReason: response.choices[0]?.finish_reason || undefined,
    };
  }
}
