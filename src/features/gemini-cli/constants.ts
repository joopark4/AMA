/**
 * Gemini CLI(ACP) 연동 관련 상수.
 *
 * Codex(`CODEX_*`)와 동일한 패턴으로 프로바이더 키, 기본 모델, 응답 타임아웃,
 * ACP 프로토콜 버전을 정의한다. Gemini CLI 쪽 Rust 백엔드와 TS 클라이언트가
 * 공용으로 참조하는 기준점 역할.
 */

export const GEMINI_CLI_PROVIDER = 'gemini_cli' as const;

/**
 * 기본 모델 ID — 실측한 Gemini CLI 기본값(`auto-gemini-3`).
 *
 * `session/new` 응답에서 확인한 `models.currentModelId`와 일치한다. 실제 선택 가능한
 * 모델 목록은 연결 후 `gemini_cli_list_models` Tauri 커맨드로 런타임 조회한다.
 */
export const GEMINI_CLI_DEFAULT_MODEL = 'auto-gemini-3';

/** Gemini CLI ACP 응답 타임아웃 (12시간). Codex와 동일한 기준. */
export const GEMINI_CLI_RESPONSE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

/**
 * ACP 프로토콜 버전. `initialize` 요청에 number로 전달해야 한다
 * (생략 시 Gemini CLI가 -32603 Internal error로 거부).
 */
export const GEMINI_CLI_ACP_PROTOCOL_VERSION = 1;
