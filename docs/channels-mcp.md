# Claude Code Channels — AMA 아바타 연동

> 외부에서 실행 중인 Claude Code와 AMA 아바타를 연결하여,
> 사용자의 텍스트/음성 입력을 Claude Code로 전달하고
> 응답을 아바타가 TTS로 읽어주는 양방향 파이프라인.

## 아키텍처

```
사용자 → AMA (텍스트/음성 입력)
    ↓ LLM Provider: Claude Code
AMA → POST http://127.0.0.1:8790 (dev-bridge)
    ↓ notifications/claude/channel (stdio)
외부 터미널의 Claude Code 세션
    ↓ reply 도구 호출
dev-bridge → HTTP 응답
    ↓
AMA → 대화 저장 + 말풍선 + 감정/모션 + TTS 재생
```

## 채널 목록

| 채널 | 포트 | 방향 | 용도 |
|------|------|------|------|
| `ama-bridge` | 8790 | 양방향 | AMA ↔ Claude Code 대화 브리지 |
| `ci-webhook` | 8788 | 일방향 | GitHub CI/CD 웹훅 이벤트 |
| `monitor-alert` | 8789 | 일방향 | 에러/경고 모니터링 알림 |
| AMA 리스너 | 8791 | 수신 | 아바타 TTS + 말풍선 출력 |

## 빠른 시작

### 1. 채널 의존성 설치 (최초 1회)

```bash
cd mcp-channels && npm install && cd ..
```

### 2. AMA 앱에서 설정

1. AMA 앱 실행: `npm run tauri dev`
2. 설정 패널 열기 (우하단 설정 버튼 또는 `Cmd+,`)
3. **Claude Code Channels** 섹션 펼치기
4. **Channels 리스너** 토글을 **ON**으로 전환

토글 ON 시 자동으로:
- Claude Code 글로벌 설정에 **자동 등록** (`~/.claude/settings.json`)
- AI 모델이 **Claude Code (외부 연동)** 으로 자동 전환
- 이전 AI 모델 설정을 백업 (OFF 시 복원)

### 3. Claude Code 실행 (별도 터미널)

Channels는 리서치 프리뷰 기능이므로 개발 플래그가 필요합니다:

```bash
claude --dangerously-load-development-channels server:ama-bridge --permission-mode bypassPermissions
```

- 초기 확인 프롬프트에서 **`Yes`** 선택 (세션당 1회, 보안 확인)
- 어느 디렉토리에서 실행해도 됩니다 (글로벌 등록 완료 상태)

### 4. 대화

AMA에서 텍스트/음성으로 메시지 입력 → Claude Code가 응답 → 아바타가 TTS로 읽어줌

## 실행 옵션

| 플래그 | 역할 | 필수 |
|--------|------|------|
| `--dangerously-load-development-channels server:ama-bridge` | 채널 로드 (리서치 프리뷰) | O |
| `--permission-mode bypassPermissions` | 도구 실행 권한 자동 수락 | 권장 |

### 주의사항

- `--dangerously-load-development-channels`는 리서치 프리뷰 기간에만 필요합니다. 정식 출시 후 제거될 수 있습니다.
- `--permission-mode bypassPermissions`는 Claude Code가 파일 수정, 명령 실행 등의 도구를 **확인 없이 실행**합니다. 신뢰할 수 있는 로컬 환경에서만 사용하세요.
- 채널 확인 프롬프트(`Do you want to proceed?`)는 보안상 자동 수락이 불가능하며, 세션 시작 시 1회만 표시됩니다.
- AMA와 Claude Code는 **같은 머신**(localhost)에서 실행되어야 합니다.

## 설정 ON/OFF 동작

| 동작 | 상세 |
|------|------|
| **ON** | 글로벌 등록 확인(미등록 시 자동 등록) → 현재 AI 모델 백업 → Claude Code 프로바이더로 전환 → LLM 설정 잠금 |
| **OFF** | 백업된 이전 AI 모델로 자동 복원 → LLM 설정 잠금 해제 |

- 토글 변경은 **즉시 적용** (앱 재시작 불필요)
- Channels ON 상태에서는 AI 모델 설정 드롭다운이 **비활성화**(잠금)됨
- 설정은 localStorage에 자동 저장되어 다음 실행에도 유지

## 글로벌 등록

AMA 설정에서 토글을 ON하면 자동 등록되지만, 수동으로도 가능합니다:

```bash
# 등록 (AMA 프로젝트 디렉토리에서)
npm run mcp:install

# 해제
npm run mcp:uninstall
```

등록 시 수행하는 작업:
1. `~/.mypartnerai/mcp-channels/`에 dev-bridge 파일 복사
2. `~/.claude/settings.json`에 `ama-bridge` 서버 등록

등록 후 어느 디렉토리에서 `claude`를 실행해도 dev-bridge가 자동 시작됩니다.

## 타임아웃 및 비동기 입력

### 타임아웃 정책

| 구간 | 타임아웃 | 갱신 조건 |
|------|----------|----------|
| dev-bridge 대기 | 24시간 | 새 메시지 입력 시 전체 갱신 |
| Rust HTTP 요청 | 24시간 | 요청별 독립 |

- 사용자가 메시지를 보내면 dev-bridge의 **모든 대기 중인 요청**의 타임아웃이 24시간으로 갱신됩니다.
- 24시간 동안 입력이 없으면 대기 중인 요청이 만료됩니다.

### 비동기 입력 (입력 비차단)

Claude Code 모드에서는 응답 대기 중에도 새 메시지를 보낼 수 있습니다:

- 사용자 입력 → 즉시 대화 기록에 추가 → 입력창 비움 → 백그라운드에서 Claude Code 응답 대기
- Claude Code 응답 도착 → 대화 기록 추가 + 말풍선 + 감정/모션 + TTS 재생
- 여러 메시지를 연속 입력해도 각각 독립적으로 처리됨

일반 LLM 모드(Ollama, Claude API 등)에서는 기존과 동일하게 응답 완료까지 입력이 차단됩니다.

## 채널 스펙 (Claude Code Channels 공식 준수)

채널 서버는 [Claude Code Channels 레퍼런스](https://docs.anthropic.com/en/docs/claude-code/channels-reference)를 따릅니다:

- `Server` 클래스 사용 (`@modelcontextprotocol/sdk/server/index.js`)
- `capabilities: { experimental: { 'claude/channel': {} } }` 선언
- `notifications/claude/channel` 메서드로 이벤트 전송
- `{ content, meta }` 형식의 알림 페이로드
- `instructions` 문자열로 Claude에 컨텍스트 제공
- 양방향 채널은 `ListToolsRequestSchema` + `CallToolRequestSchema`로 reply 도구 등록

## API

### POST /speak (AMA 리스너, 포트 8791)

채널 서버가 AMA 아바타에 직접 음성 출력을 요청합니다.

```bash
TOKEN=$(cat ~/.mypartnerai/mcp-token)
curl -X POST http://127.0.0.1:8791/speak \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"text":"빌드가 실패했습니다","source":"ci-webhook","emotion":"surprised"}'
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `text` | string | O | 음성으로 출력할 텍스트 (최대 1000자) |
| `source` | string | O | 이벤트 출처 |
| `priority` | string | X | `normal` (기본) / `urgent` (현재 재생 중단) |
| `emotion` | string | X | 아바타 감정 (`happy`, `sad`, `angry`, `surprised`, `relaxed`, `thinking`) |

### GET /health (AMA 리스너)

```bash
curl http://127.0.0.1:8791/health
# → {"status":"ok","queue_size":0}
```

### POST / (dev-bridge, 포트 8790)

AMA가 사용자 메시지를 Claude Code로 전달합니다.

```bash
curl -X POST http://127.0.0.1:8790 \
  -H "Content-Type: application/json" \
  -d '{"question":"settingsStore 마이그레이션 방법은?","context":"..."}'
```

응답: `{ "id": "1", "reply": "Claude Code의 응답 텍스트" }`

## 보안

- **127.0.0.1 바인딩**: 외부 네트워크에서 접근 불가 (로컬 전용)
- **Bearer 토큰 인증**: AMA 앱 시작 시 `~/.mypartnerai/mcp-token`에 UUID 자동 생성
- **텍스트 길이 제한**: 최대 1000자
- **요청 크기 제한**: 최대 4KB (dev-bridge는 8KB)
- **Rate Limiting**: 분당 30회
- **GitHub Webhook**: HMAC-SHA256 검증 (`GITHUB_WEBHOOK_SECRET` 환경변수)
- **모니터링 알림**: IP 허용 목록 (`ALLOWED_ALERT_SOURCES` 환경변수)

## 음성 큐

동시에 여러 메시지가 도착할 수 있으므로 SpeakQueue로 관리:

- **FIFO**: 일반 메시지는 순서대로 처리
- **urgent 인터럽트**: 현재 재생을 중단하고 긴급 메시지를 즉시 재생
- **큐 최대 5개**: 초과 시 오래된 것부터 폐기
- **사용자 대화 우선**: 사용자가 직접 대화 중이면 채널 메시지는 대기

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `WEBHOOK_PORT` | 8788 | CI 웹훅 HTTP 포트 |
| `ALERT_PORT` | 8789 | 모니터링 알림 HTTP 포트 |
| `BRIDGE_PORT` | 8790 | dev-bridge HTTP 포트 |
| `AMA_SPEAK_PORT` | 8791 | AMA TTS 리스너 포트 |
| `GITHUB_WEBHOOK_SECRET` | (없음) | GitHub Webhook HMAC 시크릿 |
| `ALLOWED_ALERT_SOURCES` | `127.0.0.1,::1,::ffff:127.0.0.1` | 모니터링 알림 허용 IP |

## 테스트

```bash
./mcp-channels/test-channels.sh
```

## 파일 구조

```
mcp-channels/
├── package.json
├── tsconfig.json
├── install-global.mjs        # 글로벌 등록 스크립트 (npm run mcp:install)
├── shared/
│   ├── config.mts             # 포트/설정 중앙 관리
│   └── ama-client.mts         # AMA HTTP 클라이언트
├── dev-bridge.mts             # 양방향 브리지 (AMA ↔ Claude Code)
├── ci-webhook.mts             # CI/CD 웹훅 채널
├── monitor-alert.mts          # 모니터링 알림 채널
└── test-channels.sh           # 테스트 스크립트

src-tauri/src/commands/mcp.rs     # Rust HTTP 리스너 + 글로벌 등록 커맨드
src/services/ai/claudeCodeClient.ts  # Claude Code LLM 클라이언트
src/utils/responseProcessor.ts    # 공유 응답 파이프라인
src/hooks/useMcpSpeakListener.ts  # Tauri 이벤트 리스너 + 큐
src/components/settings/MCPSettings.tsx  # Claude Code Channels 설정 UI
```

## 제한사항

- **로컬 전용**: AMA와 Claude Code가 같은 머신에서 실행되어야 함
- **리서치 프리뷰**: `--dangerously-load-development-channels` 플래그 필요
- **응답 타임아웃**: 24시간 비활동 시 만료. 새 메시지 입력 시 모든 대기 중인 요청의 타임아웃이 24시간으로 갱신됨. 응답 대기 중에도 새 입력 가능.
