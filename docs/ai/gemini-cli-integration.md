# Gemini CLI(ACP) 연동

> **현재 상태: ACP 본체 + fs + 승인 자동응답 + Vision + Screen Watch 연결까지 구현 완료**
>
> 브랜치 `feature/gemini-cli-integration`에서 진행 중. 남은 후속 과제는 `terminal/*`
> 클라이언트 메서드와 UI 승인 플로우(옵션 선택 모달) 수준이다.

## 개요

로컬에 설치된 [Gemini CLI](https://github.com/google-gemini/gemini-cli)를 `--experimental-acp`
(Agent Client Protocol) 모드로 자식 프로세스로 띄워, Codex 연동과 동일하게 JSON-RPC 2.0
over stdio로 통신하는 구조를 목표로 한다.

### 왜 ACP인가

- `-p/--prompt` headless 모드는 단발 요청용. 세션/도구/스트리밍이 없다.
- `--experimental-acp`는 JSON-RPC 2.0 over stdio + 세션/도구/스트리밍을 제공해 IDE·에이전트
  통합용으로 설계되어 있으며, 구조가 Codex `app-server`와 1:1 대응된다.

## 프로토콜 조사 결과

### initialize

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientInfo":{"name":"ama-probe","version":"0.0.1"}}}' \
  | gemini --experimental-acp
```

응답 예:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": 1,
    "authMethods": [
      { "id": "oauth-personal", "name": "Log in with Google" },
      { "id": "gemini-api-key", "name": "Use Gemini API key", "description": "Requires setting the `GEMINI_API_KEY` environment variable" },
      { "id": "vertex-ai", "name": "Vertex AI" }
    ],
    "agentCapabilities": {
      "loadSession": true,
      "promptCapabilities": { "image": true, "audio": true, "embeddedContext": true },
      "mcpCapabilities": { "http": true, "sse": true }
    }
  }
}
```

포인트:

- `params.protocolVersion`은 **number** 필수. 생략 시 `-32603 Internal error`.
- CLI가 `~/.gemini/`에 캐시된 인증을 자동 로드한다 (`Loaded cached credentials.`).
- multimodal(image/audio/embeddedContext) + MCP(http/sse) 지원.

### 주요 메서드 (Codex 대응)

| 단계 | Codex app-server | Gemini ACP (실측) |
|------|------------------|-------------------|
| 연결 | `initialize` | `initialize` (`protocolVersion:1`) |
| 인증 | (Keychain 기반) | `authenticate` |
| 세션 시작 | `thread/start` | `session/new` (`cwd`, `mcpServers`) |
| 턴 송신 | `turn/start` | `session/prompt` (`sessionId`, `prompt[]`) |
| 이전 세션 복원 | `thread/resume` | `session/load` |
| 중단 | `cancel` | `session/cancel` *(notification)* |
| 모델/모드 변경 | `setReasoningEffort` | `session/set_mode` (modeId) |

### 실측 스트리밍 스키마 (`session/update`)

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "...",
    "update": {
      "sessionUpdate": "agent_message_chunk",
      "content": { "type": "text", "text": "..." }
    }
  }
}
```

- discriminator는 `update.sessionUpdate` 문자열
- 텍스트는 `update.content` (직접 ContentBlock 또는 `content.content[]` 래핑)
- 턴 완료는 notification이 아닌 `session/prompt` **응답**의 `stopReason`으로 판정

### 실측 session/new 응답

```json
{
  "sessionId": "...",
  "modes": {
    "availableModes": [
      { "id": "default", "name": "Default" },
      { "id": "autoEdit", "name": "Auto Edit" },
      { "id": "yolo", "name": "YOLO" },
      { "id": "plan", "name": "Plan" }
    ],
    "currentModeId": "default"
  },
  "models": { "availableModels": [...], "currentModelId": "auto-gemini-3" }
}
```

- 모드 ID는 **camelCase** (`autoEdit`). AMA 설정(`auto_edit`)에서 매핑해 전달한다.

## AMA 쪽 설계

### Provider 키·설정

| 항목 | 값 |
|------|-----|
| `LLMProvider` | `'gemini_cli'` |
| `settings.geminiCli.model` | `''` (빈 문자열 = CLI 기본 모델 위임) |
| `settings.geminiCli.approvalMode` | `'default' | 'auto_edit' | 'yolo' | 'plan'` |
| `settings.geminiCli.workingDir` | 사용자 지정 프로젝트 경로 |
| `settings.geminiCli.authMethod` | `'oauth-personal' | 'gemini-api-key' | 'vertex-ai' | undefined` (CLI 기본 유지) |

`settingsStore` persist version은 v21 → v22로 증분 (마이그레이션에서 기본값 주입).

### 모듈 구조 (계획)

```
src/features/gemini-cli/
├── constants.ts              ← GEMINI_CLI_PROVIDER/DEFAULT_MODEL/TIMEOUT/ACP_PROTOCOL_VERSION ✅
├── geminiCliClient.ts        ← LLMClient 구현 ⬜ (현재 placeholder)
├── useGeminiCliConnection.ts ← 연결/상태 훅 ⬜
├── GeminiCliSettings.tsx     ← 설정 섹션 UI ⬜
└── index.ts                  ← 퍼블릭 API barrel ✅(일부)

src-tauri/src/commands/
└── gemini_cli.rs             ← 프로세스 관리 + JSON-RPC 루프 ⬜
```

### 이벤트 이름 (계획)

Codex(`codex-token`/`codex-complete`/`codex-status`/`codex-stderr`)와 동일 패턴:

- `gemini-cli-token`
- `gemini-cli-complete`
- `gemini-cli-status`
- `gemini-cli-stderr`

## 진행 단계

1. ✅ **스캐폴딩 커밋** — LLMProvider/설정/상수/placeholder/드롭다운/i18n/문서
2. ✅ **ACP 본체** — Rust 백엔드 + TS 클라이언트 + 훅 + 설정 UI
3. ✅ **session/set_mode 연결** — approvalMode(`default/auto_edit/yolo/plan`) → ACP mode ID(`default/autoEdit/yolo/plan`)로 변환해 `session/new` 직후 + UI 변경 시 즉시 동기화
4. ✅ **fs client methods** — `fs/read_text_file`(부분 읽기 `line`/`limit` 포함) + `fs/write_text_file`. `workingDir` 내부 경로만 허용(canonicalize 후 prefix 검사). `clientCapabilities.fs`를 true로 선언
5. ✅ **session/request_permission 자동 응답** — `plan` 모드는 `cancelled`, 그 외는 `options[0].optionId`를 `selected`로 반환. UI 선택 모달은 후속 과제
6. ✅ **Vision** — `gemini_cli_send_message(image_path)` + Rust가 base64 + mimeType 추론해 ACP `image` ContentBlock 전달. `geminiCliClient.chatWithLocalImage()` 공개
7. ✅ **Screen Watch provider 확장** — `VISION_SUPPORTED_PROVIDERS`에 `gemini_cli` 포함. 파일 경로 전달 경로(Codex와 동일)로 통합
8. ⬜ **`terminal/*` 클라이언트 메서드** — `terminal/create`·`output`·`wait_for_exit`·`kill`·`release` 구현. 현재는 -32601 거부 상태
9. ⬜ **UI 승인 플로우** — `default`/`auto_edit` 모드에서 options 모달을 띄우고 사용자가 선택하도록 이벤트 브리지 추가
10. ⬜ **실제 통합 회귀 테스트** — 도구 실행/파일 쓰기/이미지 분석 시나리오별 성공·실패 경로 체크리스트

## 알려진 리스크

- **ACP unstable 메서드**: `unstable_setSessionModel` 등 prefix가 명시되어 있어 스펙이
  변할 수 있음. CLI 버전 고정·호환 체크 필요.
- **인증**: 최초 OAuth는 브라우저 플로우. `authenticate` RPC가 URL을 클라이언트에 넘기는지,
  CLI가 직접 브라우저를 여는지 실제 응답 캡처로 확인 필요.
- **파일시스템 proxy**: ACP는 에이전트가 파일을 클라이언트(AMA) 경유로 접근하도록 설계되어
  있으므로, 허용 범위를 `settings.geminiCli.workingDir` 기준으로 제한해야 한다.
- **동일 앱 내 배타 사용**: Claude Code Channels / Codex / Gemini CLI는 provider 드롭다운에서
  하나만 선택되는 구조로 유지한다.
