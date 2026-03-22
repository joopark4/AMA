/**
 * Claude Code Channels 관련 상수
 */

export const CLAUDE_CODE_PROVIDER = 'claude_code' as const;
export const BRIDGE_DEFAULT_ENDPOINT = 'http://127.0.0.1:8790';
export const BRIDGE_DEFAULT_MODEL = 'ama-bridge';
/** 채널 응답 타임아웃 (24시간) — 서버 측과 동일 */
export const BRIDGE_RESPONSE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
