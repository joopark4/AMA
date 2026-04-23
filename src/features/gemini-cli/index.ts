/**
 * Gemini CLI(ACP) 모듈 — 퍼블릭 API (스캐폴딩 단계).
 *
 * 현재 노출되는 항목은 provider 키/상수와 placeholder 클라이언트뿐이며,
 * 훅·설정 UI는 후속 커밋에서 추가된다.
 */

export {
  GEMINI_CLI_PROVIDER,
  GEMINI_CLI_DEFAULT_MODEL,
  GEMINI_CLI_RESPONSE_TIMEOUT_MS,
  GEMINI_CLI_ACP_PROTOCOL_VERSION,
} from './constants';

export { GeminiCliClient, geminiCliClient } from './geminiCliClient';
