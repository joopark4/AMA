/**
 * Gemini CLI(ACP) LLM 클라이언트 — **스캐폴딩 단계**.
 *
 * 현재는 `LLMClient` 인터페이스만 채운 placeholder이며 실제 동작은 후속 커밋에서
 * 추가된다. 동작 상세는 `docs/ai/gemini-cli-integration.md` 참조.
 *
 * 후속 작업 (대응 지점):
 * 1. Rust 백엔드 `src-tauri/src/commands/gemini_cli.rs` — 프로세스 spawn(`gemini --experimental-acp`) +
 *    JSON-RPC 2.0 over stdio.
 * 2. 이 클라이언트가 Tauri command(`gemini_cli_send_message`)를 호출하고
 *    이벤트(`gemini-cli-token`, `gemini-cli-complete`, `gemini-cli-status`)를 수신.
 * 3. `initialize` → `newSession` → `prompt` 흐름과 스트리밍 notification을 캡처해
 *    Codex와 동일한 UX로 노출.
 */

import type {
  Message,
  LLMResponse,
  StreamCallbacks,
  ChatOptions,
  LLMClient,
} from '../../services/ai/types';

const NOT_IMPLEMENTED_MESSAGE =
  'Gemini CLI(ACP) 연동은 아직 구현 중입니다. 다른 AI 모델을 선택하거나 이후 업데이트를 기다려 주세요.';

export class GeminiCliClient implements LLMClient {
  async chat(_messages: Message[], _options?: ChatOptions): Promise<LLMResponse> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async chatStream(
    _messages: Message[],
    callbacks: StreamCallbacks,
    _options?: ChatOptions,
  ): Promise<void> {
    const error = new Error(NOT_IMPLEMENTED_MESSAGE);
    callbacks.onError?.(error);
    throw error;
  }

  /**
   * 스캐폴딩 단계에서는 항상 `false`를 반환해 LLM 라우터가 이 provider를
   * "준비되지 않음"으로 인식하도록 한다. 이후 `gemini` 바이너리 존재 + 인증 상태
   * 확인을 Rust 커맨드로 위임해 실제 가용성을 반영한다.
   */
  async isAvailable(): Promise<boolean> {
    return false;
  }
}

export const geminiCliClient = new GeminiCliClient();
