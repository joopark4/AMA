/**
 * Codex LLM 클라이언트 — codex app-server JSON-RPC를 통해 대화
 *
 * Tauri 커맨드를 호출하고 이벤트를 수신하여 스트리밍 응답을 처리한다.
 * - listen() await로 리스너 등록 보장 후 메시지 전송
 * - busy 플래그로 동시 호출 방지
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { Message, LLMResponse, StreamCallbacks, ChatOptions, LLMClient } from '../../services/ai/types';
import { useSettingsStore } from '../../stores/settingsStore';
import { CODEX_RESPONSE_TIMEOUT_MS } from './constants';

interface CodexTokenEvent {
  text: string;
  itemId: string | null;
}

interface CodexCompleteEvent {
  text: string;
  threadId: string | null;
  turnId: string | null;
}

interface CodexStatusEvent {
  status: string;
  message: string | null;
}

export class CodexClient implements LLMClient {
  async chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse> {
    const userMessage = this.extractLastUserMessage(messages);
    const systemPrompt = this.extractSystemPrompt(messages, options);
    await this.ensureStarted();

    const unlistens: UnlistenFn[] = [];
    const cleanup = () => unlistens.forEach((fn) => fn());

    try {
      return await new Promise<LLMResponse>(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Codex response timeout'));
        }, CODEX_RESPONSE_TIMEOUT_MS);

        try {
          unlistens.push(await listen<CodexCompleteEvent>('codex-complete', (event) => {
            clearTimeout(timeout);
            cleanup();
            resolve({ content: event.payload.text, finishReason: 'stop' });
          }));

          unlistens.push(await listen<CodexStatusEvent>('codex-status', (event) => {
            if (event.payload.status === 'error' || event.payload.status === 'disconnected') {
              clearTimeout(timeout);
              cleanup();
              reject(new Error(event.payload.message || 'Codex disconnected'));
            }
          }));

          await this.invokeMessage(userMessage, systemPrompt);
        } catch (err) {
          clearTimeout(timeout);
          cleanup();
          reject(new Error(String(err)));
        }
      });
    } catch (err) {
      cleanup();
      throw err;
    }
  }

  async chatStream(
    messages: Message[],
    callbacks: StreamCallbacks,
    options?: ChatOptions,
  ): Promise<void> {
    const userMessage = this.extractLastUserMessage(messages);
    const systemPrompt = this.extractSystemPrompt(messages, options);
    await this.ensureStarted();

    let fullResponse = '';
    const unlistens: UnlistenFn[] = [];
    const cleanup = () => unlistens.forEach((fn) => fn());

    try {
      await new Promise<void>(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          callbacks.onError?.(new Error('Codex response timeout'));
          reject(new Error('Codex response timeout'));
        }, CODEX_RESPONSE_TIMEOUT_MS);

        try {
          unlistens.push(await listen<CodexTokenEvent>('codex-token', (event) => {
            fullResponse += event.payload.text;
            callbacks.onToken?.(event.payload.text);
          }));

          unlistens.push(await listen<CodexCompleteEvent>('codex-complete', () => {
            clearTimeout(timeout);
            cleanup();
            callbacks.onComplete?.(fullResponse);
            resolve();
          }));

          unlistens.push(await listen<CodexStatusEvent>('codex-status', (event) => {
            if (event.payload.status === 'error' || event.payload.status === 'disconnected') {
              clearTimeout(timeout);
              cleanup();
              const err = new Error(event.payload.message || 'Codex disconnected');
              callbacks.onError?.(err);
              reject(err);
            }
          }));

          await this.invokeMessage(userMessage, systemPrompt);
        } catch (err) {
          clearTimeout(timeout);
          cleanup();
          const error = new Error(String(err));
          callbacks.onError?.(error);
          reject(error);
        }
      });
    } catch (err) {
      cleanup();
      throw err;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const install = await invoke<{ installed: boolean }>('codex_check_installed');
      if (!install.installed) return false;
      const auth = await invoke<{ authenticated: boolean }>('codex_check_auth');
      return auth.authenticated;
    } catch {
      return false;
    }
  }

  // ─── 내부 헬퍼 ────────────────────────────────

  private async invokeMessage(text: string, systemPrompt: string): Promise<void> {
    const { codex } = useSettingsStore.getState().settings;
    await invoke('codex_send_message', {
      text,
      systemPrompt,
      model: codex.model,
      reasoningEffort: codex.reasoningEffort,
    });
  }

  private extractSystemPrompt(messages: Message[], options?: ChatOptions): string {
    if (options?.systemPrompt) return options.systemPrompt;
    const systemMsg = messages.find((m) => m.role === 'system');
    return systemMsg?.content || '';
  }

  private extractLastUserMessage(messages: Message[]): string {
    const userMessages = messages.filter((m) => m.role === 'user');
    const last = userMessages[userMessages.length - 1];
    const content = last?.content || '';
    if (!content.trim()) throw new Error('No user message to send');
    return content;
  }

  private async ensureStarted(): Promise<void> {
    try {
      const status = await invoke<{ connected: boolean }>('codex_get_status');
      if (!status.connected) await invoke('codex_start');
    } catch {
      await invoke('codex_start');
    }
  }
}

export const codexClient = new CodexClient();
