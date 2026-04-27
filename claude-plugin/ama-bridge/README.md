# ama-bridge

AMA AI 아바타 앱과 Claude Code를 양방향으로 연결하는 채널 플러그인입니다.
Claude Code에서 보낸 메시지가 AMA 아바타를 통해 TTS로 음성 출력됩니다.

## 요구사항

- Node.js 18+
- Claude Code (Channels 지원 버전)
- AMA 앱 실행 중

## 설치

### 방법 1: Claude Code 플러그인으로 설치

```bash
claude /plugin install /path/to/claude-plugin/ama-bridge
```

### 방법 2: 개발 모드로 직접 실행

```bash
cd claude-plugin/ama-bridge
npm install
claude --dangerously-load-development-channels server:ama-bridge --permission-mode bypassPermissions
```

### 방법 3: AMA 앱 설정에서 등록

AMA 앱의 설정 패널 > Claude Code Channels 섹션에서 토글을 켜면
자동으로 `~/.claude.json`에 등록됩니다.

## 실행 방법

플러그인이 설치된 상태에서 Claude Code를 시작하면 자동으로 채널이 활성화됩니다.

```bash
# 개발 모드 (리서치 프리뷰)
claude --dangerously-load-development-channels server:ama-bridge --permission-mode bypassPermissions
```

## AMA 앱 연동

1. AMA 앱을 실행합니다.
2. 설정 패널에서 Claude Code Channels를 활성화합니다.
3. Claude Code 세션을 시작합니다.
4. AMA 앱의 텍스트/음성 입력이 Claude Code로 전달되고, 응답이 아바타 TTS로 출력됩니다.

## 포트 정보

| 포트 | 용도 |
|------|------|
| 8790 | ama-bridge HTTP 서버 (기본값) |

환경변수 `BRIDGE_PORT`로 변경 가능합니다.

## HTTP API

### `GET /health`
서버 상태 확인. `{ "status": "ok", "pending": 0 }`

### `POST /`
질문 전송. JSON body: `{ "question": "..." }` 또는 plain text.
Claude Code가 응답할 때까지 대기 후 `{ "id": "...", "reply": "..." }` 반환.

### `POST /channel-test`
채널 연결 테스트 (5초 타임아웃). `{ "channel": true/false }`

### `POST /shutdown`
서버 종료 요청 (포트 인수인계용).

## 리서치 프리뷰 안내

Claude Code Channels는 현재 리서치 프리뷰 단계입니다.
`--dangerously-load-development-channels` 플래그가 필요하며,
정식 출시 시 `claude --channels plugin:ama-bridge` 형태로 변경될 수 있습니다.

## 라이선스

MIT (AMA 프로젝트와 동일)
