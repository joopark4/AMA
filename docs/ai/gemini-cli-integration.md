# Gemini CLI(ACP) 연동

> **현재 상태: 스캐폴딩 (실제 동작 구현 전)**
>
> 브랜치 `feature/gemini-cli-integration`에서 진행 중. 이 문서는 구현 방향·프로토콜
> 조사 결과·단계별 계획을 기록한다. 실제 프로세스 연결·스트리밍은 후속 커밋에서 추가된다.

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

| 단계 | Codex app-server | Gemini ACP |
|------|------------------|-----------|
| 연결 | `initialize` | `initialize` |
| 인증 | (Keychain 기반) | `authenticate` |
| 세션 시작 | `thread/start` | `newSession` |
| 턴 송신 | `turn/start` | `prompt` |
| 이전 세션 복원 | `thread/resume` | `loadSession` |
| 중단 | `cancel` | `cancel` |
| 모델/모드 변경 | `setReasoningEffort` | `setSessionMode`, `unstable_setSessionModel` |

실제 `newSession`/`prompt` 페이로드·스트리밍 notification 스키마는 구현 중 실제 응답을
캡처해 이 문서에 추가한다.

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

1. ✅ **스캐폴딩 커밋** (현재 PR)
   - `LLMProvider` 확장 + `GeminiCliSettings` 타입/기본값/migrate
   - `src/features/gemini-cli/` 생성 + placeholder 클라이언트
   - `llmRouter`에 provider 등록
   - `LLMSettings` provider 드롭다운에 노출
   - i18n ko/en/ja 최소 라벨 추가
   - 이 문서(프로토콜 조사 결과)
2. ⬜ **Rust 백엔드** (`gemini_cli.rs`)
   - `gemini --experimental-acp` 자식 프로세스 spawn/kill/stderr 포워딩
   - JSON-RPC 요청 id 관리 + 응답 매칭
   - notification 파싱 → Tauri 이벤트 발행
3. ⬜ **TS 클라이언트 본체** (`geminiCliClient.ts`)
   - `LLMClient` 실제 구현
   - `initialize` → `newSession` → `prompt` 흐름 + 스트리밍 onToken 연결
4. ⬜ **설정 UI** (`GeminiCliSettings.tsx`)
   - CLI 설치/인증 상태 표시
   - model/workingDir/approvalMode/authMethod 입력 UI
   - 재연결 버튼
5. ⬜ **실제 통합 테스트**
   - `newSession` + `prompt` payload 캡처 후 스키마 정합
   - 스트리밍 notification 타입 확정
   - 에러/취소 플로우 검증
6. ⬜ **문서 확정** — 이 문서 업데이트 + CLAUDE.md 요약 섹션 추가

## 알려진 리스크

- **ACP unstable 메서드**: `unstable_setSessionModel` 등 prefix가 명시되어 있어 스펙이
  변할 수 있음. CLI 버전 고정·호환 체크 필요.
- **인증**: 최초 OAuth는 브라우저 플로우. `authenticate` RPC가 URL을 클라이언트에 넘기는지,
  CLI가 직접 브라우저를 여는지 실제 응답 캡처로 확인 필요.
- **파일시스템 proxy**: ACP는 에이전트가 파일을 클라이언트(AMA) 경유로 접근하도록 설계되어
  있으므로, 허용 범위를 `settings.geminiCli.workingDir` 기준으로 제한해야 한다.
- **동일 앱 내 배타 사용**: Claude Code Channels / Codex / Gemini CLI는 provider 드롭다운에서
  하나만 선택되는 구조로 유지한다.
