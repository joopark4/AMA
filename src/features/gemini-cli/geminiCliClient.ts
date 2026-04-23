/**
 * Gemini CLI(ACP) LLM 클라이언트.
 *
 * `gemini --experimental-acp`를 Rust 백엔드에서 자식 프로세스로 돌리고, Tauri 커맨드 +
 * 이벤트 브리지를 통해 스트리밍 대화를 한다. Codex 모듈과 구조가 동일하되 아래 차이가 있다.
 *
 * - 이벤트: `gemini-cli-token` / `gemini-cli-complete` / `gemini-cli-status`
 * - 턴 완료: `session/prompt` 응답의 `stopReason`으로 판정 → `gemini-cli-complete` 이벤트
 *   에는 누적 text가 포함되지 않으므로 클라이언트가 token 이벤트로 직접 누적한다.
 * - 명시 취소: `gemini_cli_cancel` 커맨드 (ACP `session/cancel` notification)
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  Message,
  LLMResponse,
  StreamCallbacks,
  ChatOptions,
  LLMClient,
} from '../../services/ai/types';
import { useSettingsStore } from '../../stores/settingsStore';
import { GEMINI_CLI_RESPONSE_TIMEOUT_MS } from './constants';

interface GeminiCliTokenEvent {
  text: string;
  sessionId: string | null;
}

interface GeminiCliCompleteEvent {
  /** 현재 구현에서는 비어 있음 — 프런트엔드가 token 이벤트로 누적한 값을 사용한다. */
  text: string;
  sessionId: string | null;
  /** `"completed" | "cancelled" | "exceeded_max_iterations" | "error" | "error:..."` */
  stopReason: string;
}

interface GeminiCliStatusEvent {
  status: string;
  message: string | null;
}

function isErrorStopReason(reason: string): boolean {
  return reason === 'exceeded_max_iterations' || reason.startsWith('error');
}

export class GeminiCliClient implements LLMClient {
  async chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse> {
    const userMessage = this.extractLastUserMessage(messages);
    const systemPrompt = this.extractSystemPrompt(messages, options);
    await this.ensureStarted();

    const unlistens: UnlistenFn[] = [];
    const cleanup = () => unlistens.forEach((fn) => fn());
    let accumulated = '';

    try {
      return await new Promise<LLMResponse>(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Gemini CLI response timeout'));
        }, GEMINI_CLI_RESPONSE_TIMEOUT_MS);

        try {
          unlistens.push(
            await listen<GeminiCliTokenEvent>('gemini-cli-token', (event) => {
              accumulated += event.payload.text;
            }),
          );

          unlistens.push(
            await listen<GeminiCliCompleteEvent>('gemini-cli-complete', (event) => {
              clearTimeout(timeout);
              cleanup();
              if (isErrorStopReason(event.payload.stopReason)) {
                reject(new Error(event.payload.stopReason));
                return;
              }
              resolve({
                content: accumulated,
                finishReason: event.payload.stopReason === 'cancelled' ? 'cancelled' : 'stop',
              });
            }),
          );

          unlistens.push(
            await listen<GeminiCliStatusEvent>('gemini-cli-status', (event) => {
              if (
                event.payload.status === 'error' ||
                event.payload.status === 'disconnected'
              ) {
                clearTimeout(timeout);
                cleanup();
                reject(new Error(event.payload.message || 'Gemini CLI disconnected'));
              }
            }),
          );

          await this.invokeMessage(userMessage, systemPrompt);
        } catch (err) {
          clearTimeout(timeout);
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
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
          const err = new Error('Gemini CLI response timeout');
          callbacks.onError?.(err);
          reject(err);
        }, GEMINI_CLI_RESPONSE_TIMEOUT_MS);

        try {
          unlistens.push(
            await listen<GeminiCliTokenEvent>('gemini-cli-token', (event) => {
              fullResponse += event.payload.text;
              callbacks.onToken?.(event.payload.text);
            }),
          );

          unlistens.push(
            await listen<GeminiCliCompleteEvent>('gemini-cli-complete', (event) => {
              clearTimeout(timeout);
              cleanup();
              if (isErrorStopReason(event.payload.stopReason)) {
                const err = new Error(event.payload.stopReason);
                callbacks.onError?.(err);
                reject(err);
                return;
              }
              callbacks.onComplete?.(fullResponse);
              resolve();
            }),
          );

          unlistens.push(
            await listen<GeminiCliStatusEvent>('gemini-cli-status', (event) => {
              if (
                event.payload.status === 'error' ||
                event.payload.status === 'disconnected'
              ) {
                clearTimeout(timeout);
                cleanup();
                const err = new Error(event.payload.message || 'Gemini CLI disconnected');
                callbacks.onError?.(err);
                reject(err);
              }
            }),
          );

          await this.invokeMessage(userMessage, systemPrompt);
        } catch (err) {
          clearTimeout(timeout);
          cleanup();
          const error = err instanceof Error ? err : new Error(String(err));
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
      const install = await invoke<{ installed: boolean }>('gemini_cli_check_installed');
      if (!install.installed) return false;
      const auth = await invoke<{ authenticated: boolean }>('gemini_cli_check_auth');
      return auth.authenticated;
    } catch {
      return false;
    }
  }

  /** 진행 중인 턴을 ACP notification(`session/cancel`)으로 취소. */
  async cancel(): Promise<void> {
    try {
      await invoke('gemini_cli_cancel');
    } catch {
      // 취소 실패는 무시 — 다음 응답 또는 disconnected 이벤트가 정리해줌.
    }
  }

  /**
   * 이미지 파일을 ACP `image` ContentBlock으로 함께 전송.
   * - `imagePath`는 절대 경로여야 하며 Gemini CLI의 `promptCapabilities.image=true`를 활용한다.
   * - Rust 쪽에서 base64 인코딩 + mimeType 추론 후 prompt에 추가.
   */
  async chatWithLocalImage(
    messages: Message[],
    imagePath: string,
    options?: ChatOptions,
  ): Promise<LLMResponse> {
    const userMessage = this.extractLastUserMessage(messages);
    const systemPrompt = this.extractSystemPrompt(messages, options);
    await this.ensureStarted();

    const unlistens: UnlistenFn[] = [];
    const cleanup = () => unlistens.forEach((fn) => fn());
    let accumulated = '';

    try {
      return await new Promise<LLMResponse>(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Gemini CLI response timeout'));
        }, GEMINI_CLI_RESPONSE_TIMEOUT_MS);

        try {
          unlistens.push(
            await listen<GeminiCliTokenEvent>('gemini-cli-token', (event) => {
              accumulated += event.payload.text;
            }),
          );

          unlistens.push(
            await listen<GeminiCliCompleteEvent>('gemini-cli-complete', (event) => {
              clearTimeout(timeout);
              cleanup();
              if (isErrorStopReason(event.payload.stopReason)) {
                reject(new Error(event.payload.stopReason));
                return;
              }
              resolve({
                content: accumulated,
                finishReason: event.payload.stopReason === 'cancelled' ? 'cancelled' : 'stop',
              });
            }),
          );

          unlistens.push(
            await listen<GeminiCliStatusEvent>('gemini-cli-status', (event) => {
              if (
                event.payload.status === 'error' ||
                event.payload.status === 'disconnected'
              ) {
                clearTimeout(timeout);
                cleanup();
                reject(new Error(event.payload.message || 'Gemini CLI disconnected'));
              }
            }),
          );

          await this.invokeMessage(userMessage, systemPrompt, imagePath);
        } catch (err) {
          clearTimeout(timeout);
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
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
    imagePath?: string,
  ): Promise<string> {
    const { geminiCli } = useSettingsStore.getState().settings;
    return invoke<string>('gemini_cli_send_message', {
      text,
      systemPrompt,
      workingDir: geminiCli.workingDir || null,
      approvalMode: geminiCli.approvalMode,
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
    const status = await invoke<{ connected: boolean }>('gemini_cli_get_status');
    if (!status.connected) {
      const { geminiCli } = useSettingsStore.getState().settings;
      await invoke('gemini_cli_start', {
        workingDir: geminiCli.workingDir || null,
      });
    }
  }
}

export const geminiCliClient = new GeminiCliClient();
