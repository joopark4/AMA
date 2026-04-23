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
 * - 턴 correlation: 각 턴은 `requestId`(UUID)를 발급받아 Rust에 전달하며, 이벤트 payload에
 *   실려 돌아온다. 리스너가 자기 턴의 이벤트만 받을 수 있어 Screen Watch와 일반 채팅이
 *   근접 타이밍으로 실행될 때 턴 간 응답 혼선을 방지한다.
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
  /** 이 이벤트를 촉발한 턴의 request id. 자기 턴이 아닌 이벤트는 필터링. */
  requestId: string | null;
}

interface GeminiCliCompleteEvent {
  /** 현재 구현에서는 비어 있음 — 프런트엔드가 token 이벤트로 누적한 값을 사용한다. */
  text: string;
  sessionId: string | null;
  /** `"completed" | "cancelled" | "exceeded_max_iterations" | "error" | "error:..."` */
  stopReason: string;
  requestId: string | null;
}

interface GeminiCliStatusEvent {
  status: string;
  message: string | null;
}

interface TurnResult {
  accumulated: string;
  stopReason: string;
}

function isErrorStopReason(reason: string): boolean {
  return reason === 'exceeded_max_iterations' || reason.startsWith('error');
}

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `gemini-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export class GeminiCliClient implements LLMClient {
  async chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse> {
    const userMessage = this.extractLastUserMessage(messages);
    const systemPrompt = this.extractSystemPrompt(messages, options);
    await this.ensureStarted();

    const { accumulated, stopReason } = await this.runTurn(userMessage, systemPrompt);
    if (isErrorStopReason(stopReason)) {
      throw new Error(stopReason);
    }
    return {
      content: accumulated,
      finishReason: stopReason === 'cancelled' ? 'cancelled' : 'stop',
    };
  }

  async chatStream(
    messages: Message[],
    callbacks: StreamCallbacks,
    options?: ChatOptions,
  ): Promise<void> {
    const userMessage = this.extractLastUserMessage(messages);
    const systemPrompt = this.extractSystemPrompt(messages, options);
    await this.ensureStarted();

    try {
      const { accumulated, stopReason } = await this.runTurn(
        userMessage,
        systemPrompt,
        (chunk) => callbacks.onToken?.(chunk),
      );
      if (isErrorStopReason(stopReason)) {
        const err = new Error(stopReason);
        callbacks.onError?.(err);
        throw err;
      }
      callbacks.onComplete?.(accumulated);
    } catch (err) {
      const e = toError(err);
      callbacks.onError?.(e);
      throw e;
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

    const { accumulated, stopReason } = await this.runTurn(
      userMessage,
      systemPrompt,
      undefined,
      imagePath,
    );
    if (isErrorStopReason(stopReason)) {
      throw new Error(stopReason);
    }
    return {
      content: accumulated,
      finishReason: stopReason === 'cancelled' ? 'cancelled' : 'stop',
    };
  }

  // ─── 내부 헬퍼 ────────────────────────────────

  /**
   * 한 턴을 실행한다.
   *
   * - `requestId`를 발급해 Rust 커맨드에 전달하고, 이벤트 payload의 `requestId`가
   *   일치할 때만 소비한다. 다른 턴의 잔여 이벤트가 섞이는 것을 막는다.
   * - `new Promise(async ...)` 안티패턴을 피하기 위해 executor는 동기로 두고,
   *   내부 비동기 작업은 즉시 실행 함수로 감싼다. `settle` 가드로 중복 resolve/reject를
   *   방지한다.
   */
  private async runTurn(
    userMessage: string,
    systemPrompt: string,
    onToken?: (chunk: string) => void,
    imagePath?: string,
  ): Promise<TurnResult> {
    const requestId = generateRequestId();
    const unlistens: UnlistenFn[] = [];
    const cleanup = () => unlistens.forEach((fn) => fn());
    let accumulated = '';

    try {
      return await new Promise<TurnResult>((resolve, reject) => {
        let settled = false;
        const settle = (fn: () => void) => {
          if (settled) return;
          settled = true;
          fn();
        };

        const timeout = setTimeout(() => {
          settle(() => reject(new Error('Gemini CLI response timeout')));
        }, GEMINI_CLI_RESPONSE_TIMEOUT_MS);

        const isMine = (incoming: string | null): boolean =>
          // 구버전 Rust가 requestId를 실어 보내지 않을 경우에도 관대하게 수용(null→mine).
          incoming === null || incoming === requestId;

        void (async () => {
          try {
            unlistens.push(
              await listen<GeminiCliTokenEvent>('gemini-cli-token', (event) => {
                if (!isMine(event.payload.requestId)) return;
                accumulated += event.payload.text;
                onToken?.(event.payload.text);
              }),
            );
            unlistens.push(
              await listen<GeminiCliCompleteEvent>('gemini-cli-complete', (event) => {
                if (!isMine(event.payload.requestId)) return;
                clearTimeout(timeout);
                settle(() =>
                  resolve({ accumulated, stopReason: event.payload.stopReason }),
                );
              }),
            );
            unlistens.push(
              await listen<GeminiCliStatusEvent>('gemini-cli-status', (event) => {
                if (
                  event.payload.status === 'error' ||
                  event.payload.status === 'disconnected'
                ) {
                  clearTimeout(timeout);
                  settle(() =>
                    reject(new Error(event.payload.message || 'Gemini CLI disconnected')),
                  );
                }
              }),
            );

            await this.invokeMessage(userMessage, systemPrompt, requestId, imagePath);
          } catch (err) {
            clearTimeout(timeout);
            settle(() => reject(toError(err)));
          }
        })();
      });
    } finally {
      cleanup();
    }
  }

  private async invokeMessage(
    text: string,
    systemPrompt: string,
    requestId: string,
    imagePath?: string,
  ): Promise<string> {
    const { geminiCli } = useSettingsStore.getState().settings;
    return invoke<string>('gemini_cli_send_message', {
      text,
      systemPrompt,
      workingDir: geminiCli.workingDir || null,
      approvalMode: geminiCli.approvalMode,
      imagePath: imagePath ?? null,
      requestId,
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
    if (status.connected) return;

    const { geminiCli } = useSettingsStore.getState().settings;
    await invoke('gemini_cli_start', {
      workingDir: geminiCli.workingDir || null,
      approvalMode: geminiCli.approvalMode,
    });
    // 저장된 모델을 현재 세션에 적용 — 재시작/프로바이더 전환 후 사용자가 마지막에 고른
    // 모델이 유지되도록. `gemini_cli_set_model`은 unstable RPC라 실패 가능성이 있지만
    // 치명적이지 않으므로 CLI 기본 모델로 진행.
    if (geminiCli.model) {
      try {
        await invoke('gemini_cli_set_model', { modelId: geminiCli.model });
      } catch {
        // noop
      }
    }
  }
}

export const geminiCliClient = new GeminiCliClient();
