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
          let myTurnId: string | null = null;

          unlistens.push(await listen<CodexCompleteEvent>('codex-complete', (event) => {
            // myTurnId가 아직 할당되지 않은 시점(invokeMessage가 turnId를 돌려주기 전)에
            // 도착하는 complete는 모두 다른 턴(이전 턴 또는 동시 진행 턴) 소속이다.
            // 무시하지 않으면 이전 턴의 응답을 자기 응답으로 잘못 resolve해 코러션이
            // 발생한다(Screen Watch ↔ 일반 채팅 동시 실행 시 재현).
            if (!myTurnId) return;
            if (event.payload.turnId !== myTurnId) return;
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

          myTurnId = await this.invokeMessage(userMessage, systemPrompt);
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
          let myTurnId: string | null = null;

          unlistens.push(await listen<CodexTokenEvent>('codex-token', (event) => {
            // turnId가 채워지기 전 도착한 토큰, 또는 다른 턴의 itemId가 들어온 토큰은
            // 누적하지 않는다. 이전엔 if 조건에 빈 본문을 둬 항상 누적했고, 동시 턴
            // 실행 시 다른 요청의 토큰이 fullResponse에 섞여 corrupted 응답이
            // 만들어졌다.
            if (!myTurnId) return;
            if (event.payload.itemId && !event.payload.itemId.includes(myTurnId)) return;
            fullResponse += event.payload.text;
            callbacks.onToken?.(event.payload.text);
          }));

          unlistens.push(await listen<CodexCompleteEvent>('codex-complete', (event) => {
            // chat()과 동일 정책: turnId가 아직 없으면 다른 턴의 complete로 간주.
            if (!myTurnId) return;
            if (event.payload.turnId !== myTurnId) return;
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

          myTurnId = await this.invokeMessage(userMessage, systemPrompt);
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

  /**
   * 이미지 파일 경로를 LocalImageUserInput으로 함께 전송.
   * - imagePath는 absolute path여야 함.
   * - Codex의 sandbox policy에 따라 파일 접근 권한 필요.
   *
   * 구현: chat()과 동일한 이벤트 수신 패턴. invokeMessage는 turnId만 반환하므로
   * codex-complete 이벤트의 text를 실제 응답으로 사용한다.
   */
  async chatWithLocalImage(
    messages: Message[],
    imagePath: string,
    options?: ChatOptions
  ): Promise<LLMResponse> {
    const systemPrompt = this.extractSystemPrompt(messages, options);
    const userText = this.extractLastUserMessage(messages);
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
          let myTurnId: string | null = null;

          unlistens.push(
            await listen<CodexCompleteEvent>('codex-complete', (event) => {
              // myTurnId가 아직 할당되지 않은 시점(invokeMessage가 turnId를 돌려주기 전)에
              // 다른 턴(예: screen-watch)이 종료되어 codex-complete가 먼저 도착할 수 있다.
              // 우리 턴이 확정되기 전 이벤트는 모두 무시 — chat()/chatStream() 과 동일한 패턴.
              if (!myTurnId) return;
              if (event.payload.turnId !== myTurnId) return;
              clearTimeout(timeout);
              cleanup();
              resolve({ content: event.payload.text, finishReason: 'stop' });
            })
          );

          unlistens.push(
            await listen<CodexStatusEvent>('codex-status', (event) => {
              if (event.payload.status === 'error' || event.payload.status === 'disconnected') {
                clearTimeout(timeout);
                cleanup();
                reject(new Error(event.payload.message || 'Codex disconnected'));
              }
            })
          );

          myTurnId = await this.invokeMessage(userText, systemPrompt, imagePath);
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

  // ─── 내부 헬퍼 ────────────────────────────────

  private async invokeMessage(
    text: string,
    systemPrompt: string,
    imagePath?: string
  ): Promise<string> {
    const { codex } = useSettingsStore.getState().settings;
    return invoke<string>('codex_send_message', {
      text,
      systemPrompt,
      model: codex.model,
      reasoningEffort: codex.reasoningEffort,
      approvalPolicy: codex.approvalPolicy,
      imagePath: imagePath ?? null,
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
    const status = await invoke<{ connected: boolean }>('codex_get_status');
    if (!status.connected) {
      const { codex } = useSettingsStore.getState().settings;
      await invoke('codex_start', {
        workingDir: codex.workingDir || null,
      });
    }
  }
}

export const codexClient = new CodexClient();
