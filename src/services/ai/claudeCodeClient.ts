/**
 * Claude Code 클라이언트
 *
 * 외부에서 실행 중인 Claude Code 세션의 dev-bridge(채널)를 통해
 * 메시지를 전달하고 응답을 받는다.
 *
 * Tauri invoke로 Rust 사이드에서 HTTP 요청 (WebView CORS 우회)
 *
 * 흐름:
 * AMA → invoke('send_to_bridge') → Rust → POST 127.0.0.1:8790 → dev-bridge → Claude Code → reply → AMA
 */

import type { Message, LLMResponse, StreamCallbacks, ChatOptions, LLMClient } from './types';
import { useSettingsStore } from '../../stores/settingsStore';
import { invoke } from '@tauri-apps/api/core';

const log = (...args: unknown[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  console.log('[ClaudeCodeClient]', ...args);
  invoke('log_to_terminal', { message: `[ClaudeCodeClient] ${message}` }).catch(() => {});
};

const DEFAULT_BRIDGE_PORT = 8790;

export class ClaudeCodeClient implements LLMClient {
  private getBridgeUrl(): string {
    const { settings } = useSettingsStore.getState();
    const endpoint = settings.llm.endpoint?.trim();
    if (endpoint) return endpoint;
    return `http://127.0.0.1:${DEFAULT_BRIDGE_PORT}`;
  }

  async chat(messages: Message[], _options?: ChatOptions): Promise<LLMResponse> {
    const bridgeUrl = this.getBridgeUrl();

    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1]?.content ?? '';

    if (!lastUserMessage) {
      throw new Error('No user message to send');
    }

    const systemMessages = messages.filter(m => m.role === 'system');
    const context = systemMessages.length > 0
      ? `[Context: ${systemMessages[0].content.substring(0, 200)}]\n\n`
      : '';

    const recentHistory = messages
      .filter(m => m.role !== 'system')
      .slice(-10)
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const payload = JSON.stringify({
      question: lastUserMessage,
      context: context + recentHistory,
    });

    log('Sending to dev-bridge:', bridgeUrl, 'message:', lastUserMessage.substring(0, 50));

    try {
      const responseText = await invoke<string>('send_to_bridge', {
        endpoint: bridgeUrl,
        body: payload,
      });

      const data = JSON.parse(responseText) as { id?: string; reply?: string; error?: string };

      if (data.error) {
        throw new Error(`Claude Code: ${data.error}`);
      }

      const content = data.reply ?? '';
      log('Response received:', content.substring(0, 50));

      return { content, finishReason: 'stop' };
    } catch (err) {
      throw err;
    }
  }

  async chatStream(
    messages: Message[],
    callbacks: StreamCallbacks,
    _options?: ChatOptions
  ): Promise<void> {
    try {
      const response = await this.chat(messages, _options);
      callbacks.onToken?.(response.content);
      callbacks.onComplete?.(response.content);
    } catch (err) {
      callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await invoke<boolean>('check_bridge_health');
    } catch {
      return false;
    }
  }
}

export const claudeCodeClient = new ClaudeCodeClient();
