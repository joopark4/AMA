/**
 * Gemini CLI(ACP) 연동 관련 상수.
 *
 * Codex(`CODEX_*`)와 동일한 패턴으로 프로바이더 키, 기본 모델, 응답 타임아웃,
 * ACP 프로토콜 버전을 정의한다. Gemini CLI 쪽 Rust 백엔드와 TS 클라이언트가
 * 공용으로 참조하는 기준점 역할.
 */

export const GEMINI_CLI_PROVIDER = 'gemini_cli' as const;

/**
 * 기본 모델. 빈 문자열이면 Gemini CLI의 현재 기본 모델을 사용한다.
 * (ACP `newSession` 시 model을 지정하지 않고 서버 기본에 위임)
 */
export const GEMINI_CLI_DEFAULT_MODEL = '';

/** Gemini CLI ACP 응답 타임아웃 (12시간). Codex와 동일한 기준. */
export const GEMINI_CLI_RESPONSE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

/**
 * ACP 프로토콜 버전. `initialize` 요청에 number로 전달해야 한다
 * (생략 시 Gemini CLI가 -32603 Internal error로 거부).
 */
export const GEMINI_CLI_ACP_PROTOCOL_VERSION = 1;
