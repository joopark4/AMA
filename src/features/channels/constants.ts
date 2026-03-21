/**
 * Claude Code Channels 관련 상수
 */

export const CLAUDE_CODE_PROVIDER = 'claude_code' as const;
export const BRIDGE_DEFAULT_ENDPOINT = 'http://127.0.0.1:8790';
export const BRIDGE_DEFAULT_MODEL = 'ama-bridge';
/** 채널 응답 타임아웃 (3분) — 무한 대기 방지 */
export const BRIDGE_RESPONSE_TIMEOUT_MS = 3 * 60 * 1000;
