import { invoke } from '@tauri-apps/api/core';
import { ClaudeClient } from './claudeClient';
import { OpenAIClient } from './openaiClient';
import { GeminiClient } from './geminiClient';
import { useSettingsStore } from '../../stores/settingsStore';
import type { LLMResponse } from './types';

interface ScreenshotResult {
  data: string;
  width: number;
  height: number;
}

export class ScreenAnalyzer {
  async captureScreen(): Promise<ScreenshotResult> {
    return await invoke<ScreenshotResult>('capture_screen');
  }

  async analyzeScreen(prompt: string): Promise<LLMResponse> {
    const screenshot = await this.captureScreen();

    const { settings } = useSettingsStore.getState();
    const systemPrompt = `You are a helpful AI assistant that can see the user's screen.
Analyze the screen content and help the user with their request.
Be concise and helpful. If you see Korean text, respond in Korean.
If you see English text, respond in English.`;

    const messages = [
      { role: 'user' as const, content: prompt },
    ];

    switch (settings.llm.provider) {
      case 'claude': {
        const client = new ClaudeClient();
        return client.chatWithVision(messages, screenshot.data, { systemPrompt });
      }
      case 'openai': {
        const client = new OpenAIClient();
        return client.chatWithVision(messages, screenshot.data, { systemPrompt });
      }
      case 'gemini': {
        const client = new GeminiClient();
        return client.chatWithVision(messages, screenshot.data, { systemPrompt });
      }
      default:
        throw new Error('Vision not supported for local LLM providers');
    }
  }

  async describeScreen(): Promise<string> {
    const response = await this.analyzeScreen(
      'Please describe what you see on this screen. What application is open? What is the user doing?'
    );
    return response.content;
  }

  async helpWithScreen(context: string): Promise<string> {
    const response = await this.analyzeScreen(
      `Look at my screen and help me with: ${context}`
    );
    return response.content;
  }
}

export const screenAnalyzer = new ScreenAnalyzer();
export default screenAnalyzer;
