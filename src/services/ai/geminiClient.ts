import { GoogleGenAI } from '@google/genai';
import type { Message, LLMResponse, StreamCallbacks, ChatOptions, LLMClient } from './types';
import { useSettingsStore } from '../../stores/settingsStore';

export class GeminiClient implements LLMClient {
  private getClient(): GoogleGenAI {
    const { settings } = useSettingsStore.getState();
    const apiKey = settings.llm.apiKey;

    if (!apiKey) {
      throw new Error('Google API key not configured');
    }

    return new GoogleGenAI({ apiKey });
  }

  private getModel(): string {
    const { settings } = useSettingsStore.getState();
    return settings.llm.model || 'gemini-2.5-flash';
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse> {
    const client = this.getClient();
    const model = this.getModel();

    // system 메시지를 systemInstruction으로 분리
    const systemMessage = messages.find((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    // Gemini history: user/model 교대 형식 (마지막 메시지 제외)
    const history = nonSystemMessages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];

    const chat = client.chats.create({
      model,
      history,
      config: {
        systemInstruction: systemMessage?.content || options?.systemPrompt,
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 2048,
      },
    });

    const response = await chat.sendMessage({
      message: lastMessage.content,
    });

    return {
      content: response.text || '',
      finishReason: response.candidates?.[0]?.finishReason,
    };
  }

  async chatStream(
    messages: Message[],
    callbacks: StreamCallbacks,
    options?: ChatOptions
  ): Promise<void> {
    const client = this.getClient();
    const model = this.getModel();

    const systemMessage = messages.find((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const history = nonSystemMessages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];

    try {
      const chat = client.chats.create({
        model,
        history,
        config: {
          systemInstruction: systemMessage?.content || options?.systemPrompt,
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 2048,
        },
      });

      const stream = await chat.sendMessageStream({
        message: lastMessage.content,
      });

      let fullResponse = '';

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
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
    const client = this.getClient();
    const model = this.getModel();

    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    if (!lastUserMessage) {
      throw new Error('No user message found');
    }

    const response = await client.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: imageBase64,
              },
            },
            {
              text: lastUserMessage.content,
            },
          ],
        },
      ],
      config: {
        systemInstruction: options?.systemPrompt,
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 2048,
      },
    });

    return {
      content: response.text || '',
      finishReason: response.candidates?.[0]?.finishReason,
    };
  }
}
