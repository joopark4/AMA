/**
 * Gemini CLI(ACP) 모듈 — 퍼블릭 API.
 */

export {
  GEMINI_CLI_PROVIDER,
  GEMINI_CLI_DEFAULT_MODEL,
  GEMINI_CLI_RESPONSE_TIMEOUT_MS,
  GEMINI_CLI_ACP_PROTOCOL_VERSION,
} from './constants';

export { GeminiCliClient, geminiCliClient } from './geminiCliClient';
export { useGeminiCliConnection } from './useGeminiCliConnection';
export type { GeminiCliConnectionState } from './useGeminiCliConnection';
export { default as GeminiCliSettings } from './GeminiCliSettings';
