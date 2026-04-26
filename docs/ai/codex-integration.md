# OpenAI Codex 연동

> AMA 앱에서 OpenAI Codex CLI(`codex app-server`)를 직접 연동하여 코딩 전문 AI와 대화하는 기능

## 개요

ChatGPT 구독 사용자가 Codex CLI를 통해 코딩에 특화된 AI 모델(GPT-5.4 등)과 직접 대화할 수 있다. Codex를 LLM Provider 중 하나로 선택하면 기존 대화 UI·TTS·아바타 파이프라인을 그대로 활용한다.

## 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React)                                       │
│                                                         │
│  CodexSettings ─→ settingsStore (codex.*)               │
│  codexClient ──→ invoke('codex_send_message')           │
│       ↑          invoke('codex_start')                  │
│       │          invoke('codex_stop')                   │
│  Tauri Events    invoke('codex_list_models')            │
│  codex-token ←── codex-complete ←── codex-status        │
└────────────────────┬────────────────────────────────────┘
                     │ Tauri IPC
┌────────────────────▼────────────────────────────────────┐
│  Rust Backend (src-tauri/src/commands/codex.rs)         │
│                                                         │
│  spawn_codex_process()                                  │
│    └─ codex app-server (child process, stdio)           │
│         ├─ stdin  → JSON-RPC 2.0 요청                   │
│         └─ stdout ← JSON-RPC 2.0 응답/알림              │
│                                                         │
│  JSON-RPC Methods:                                      │
│    initialize → thread/new → turn/start                 │
│                                                         │
│  Turn Serialization:                                    │
│    turn_active (AtomicBool) + turn_ready (Notify)       │
└─────────────────────────────────────────────────────────┘
```

## 파일 구조

```
src/features/codex/
├── index.ts                  # 퍼블릭 API 재내보내기
├── constants.ts              # CODEX_PROVIDER, 타임아웃 상수
├── codexClient.ts            # LLMClient 인터페이스 구현
├── useCodexConnection.ts     # 연결 상태 관리 훅
└── CodexSettings.tsx         # 설정 UI 컴포넌트

src-tauri/src/commands/codex.rs    # Rust 백엔드 전체
src/stores/settingsStore.ts        # CodexSettings 타입/기본값
src/App.tsx                        # Codex 프로세스 라이프사이클
```

## 설정 항목

### settingsStore 타입

```typescript
export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';
export type CodexApprovalPolicy = 'never' | 'on-request' | 'untrusted';

export interface CodexSettings {
  model: string;             // 기본값: 'gpt-5.4'
  reasoningEffort: CodexReasoningEffort;  // 기본값: 'medium'
  workingDir: string;        // 기본값: '' (→ ~/Documents)
  approvalPolicy: CodexApprovalPolicy;   // 기본값: 'on-request'
}
```

### 작업 폴더 (workingDir)

- 사용자가 설정 UI에서 폴더를 선택하면 Codex CLI가 해당 디렉터리에서 실행됨
- **미지정 시 기본값**: `~/Documents`
- Rust `pick_folder` 네이티브 커맨드 사용 (투명 윈도우에서 `plugin-dialog` 사용 불가)
- 작업 폴더 변경 시 Codex 프로세스 자동 재시작 (stop → start)

### 접근 권한 (approvalPolicy + sandboxPolicy)

Codex에는 두 가지 독립적인 보안 축이 있다:

| 설정 | UI 표시 | approvalPolicy | sandboxPolicy |
|------|---------|---------------|---------------|
| 요청 시 승인 | 기본값 (권장) | `on-request` | `workspaceWrite` (네트워크 허용) |
| 전체 허용 | 빨간 경고 표시 | `never` | `dangerFullAccess` |
| 읽기 전용 | — | `untrusted` | `readOnly` (네트워크 차단) |

**sandboxPolicy 매핑 (Rust)**:

```rust
let sandbox_policy = match policy {
    "never" => json!({ "type": "dangerFullAccess" }),
    "on-request" => json!({
        "type": "workspaceWrite",
        "writableRoots": [],
        "networkAccess": true
    }),
    _ => json!({
        "type": "readOnly",
        "access": { "type": "fullAccess" },
        "networkAccess": false
    }),
};
```

## 프로세스 라이프사이클

### 시작 (`codex_start`)

1. `App.tsx`에서 LLM provider가 `codex`로 변경되거나, `workingDir`이 변경되면 실행
2. 기존 프로세스가 있으면 먼저 `codex_stop` 호출
3. `spawn_codex_process(working_dir)` → `codex app-server` child process 생성
4. stdin/stdout 태스크 시작
5. JSON-RPC `initialize` 요청 전송 → Codex 준비 완료

### 메시지 전송 (`codex_send_message`)

1. 이전 턴 완료 대기 (턴 직렬화: `turn_active` + `turn_ready`)
2. 시스템 프롬프트 변경 감지 시 새 스레드 자동 생성 (`thread/new`)
3. `turn/start` JSON-RPC 요청:
   - `input`: 사용자 메시지 + 첫 턴에만 `<instructions>` 래핑된 시스템 프롬프트
   - `model`: 선택된 모델
   - `reasoningEffort`: 추론 성능
   - `approvalPolicy`: 접근 권한
   - `sandboxPolicy`: 파일 접근 정책
4. 스트리밍 응답: `turn.stream` 알림 → `codex-token` Tauri 이벤트
5. 턴 완료: `turn.complete` 알림 → `codex-complete` Tauri 이벤트

### 종료 (`codex_stop`)

1. child process kill
2. 상태 초기화
3. `codex-status` 이벤트 발행 (`disconnected`)

## 프론트엔드 연동

### codexClient (LLMClient 구현)

```typescript
class CodexClient implements LLMClient {
  async chat(messages, systemPrompt): Promise<string>
  async chatStream(messages, systemPrompt, onToken): Promise<string>
}
```

- `chatStream()`: Tauri 이벤트 리스너(`codex-token`, `codex-complete`)로 토큰 수신
- `ensureStarted()`: 호출 전 연결 상태 확인, 미연결 시 자동 시작
- 타임아웃: 12시간 (`CODEX_RESPONSE_TIMEOUT_MS`)

### useCodexConnection 훅

```typescript
const { cliStatus, authStatus, connStatus, reconnect } = useCodexConnection();
```

- `cliStatus`: Codex CLI 설치 여부 (`installed` / `not_installed` / `checking`)
- `authStatus`: 인증 상태 (`logged_in` / `not_logged_in` / `checking`)
- `connStatus`: 연결 상태 (`connected` / `disconnected` / `connecting` / `error`)
- `reconnect()`: 수동 재연결 (workingDir 반영)

### CodexSettings UI

설정 패널에서 LLM provider로 `codex` 선택 시 추가 표시:

1. **CLI 상태**: 설치/로그인 여부 + 안내 메시지
2. **연결 상태**: 연결됨/미연결/오류 + 재연결 버튼
3. **모델**: 사용 가능 모델 드롭다운 (codex_list_models에서 조회)
4. **추론 성능**: low / medium / high / xhigh
5. **작업 폴더**: 폴더 선택/초기화 버튼 + 현재 경로 표시
6. **접근 권한**: 요청 시 승인 / 전체 허용 / 읽기 전용 + 설명 + 경고

## 요구사항

- **Codex CLI**: `npm install -g @openai/codex` 또는 `brew install codex`
- **인증**: `codex auth login` (ChatGPT 구독 필요)
- **지원 모델**: `codex_list_models` 커맨드로 동적 조회

## 해결된 이슈

| 커밋 | 문제 | 해결 |
|------|------|------|
| `5f0f38c` | 메시지 전송 시 UI 블로킹 | fire-and-forget 비동기 전송 |
| `5c0b653` | busy lock으로 동시 요청 차단 | lock 제거, 턴 직렬화로 대체 |
| `e8c5079` | 턴 겹침으로 응답 혼선 | AtomicBool + Notify 턴 직렬화 |
| `45c45d6` | 설정 패널 닫으면 연결 끊김 | App 레벨 라이프사이클 이동 |
| `9cb741e` | 시스템 프롬프트 미적용 | `<instructions>` 태그로 첫 턴에 전달 |
| `91ab8c9` | 읽기 전용으로만 동작 | sandboxPolicy 매핑 추가 |
| `91ab8c9` | 폴더 선택 다이얼로그 무반응 | Rust 네이티브 `pick_folder` 커맨드 |

## 최종 수정

2026.04.09
