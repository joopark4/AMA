# #016 Claude Code Channels 포트 충돌로 응답 멈춤

## 상태: 해결됨 (2026-03-21)

## 증상

AMA에서 Claude Code Channels를 활성화하고 메시지를 보내면 "생각중" 상태에서 무한 대기. dev-bridge 연결은 정상으로 표시됨.

## 원인

### 포트 8790 충돌로 채널 알림 미전달

`.mcp.json`에 등록된 `ama-bridge` MCP 서버가 Claude Code 세션 시작 시 자동으로 dev-bridge를 실행하여 포트 8790을 점유한다.

```
[세션 A] 일반 Claude Code 세션
  └─ .mcp.json → dev-bridge 자동 시작 → 포트 8790 점유
     └─ 채널 알림 처리 불가 (--dangerously-load-development-channels 플래그 없음)

[세션 B] claude --dangerously-load-development-channels server:ama-bridge
  └─ .mcp.json → dev-bridge 시작 시도 → 포트 8790 이미 사용 중 → HTTP 서버 실패
     └─ 채널 알림 처리 가능하지만 HTTP 요청 수신 불가

AMA → POST :8790 → 세션 A의 dev-bridge → notifications/claude/channel 발송
  → 세션 A는 채널 미지원 → 알림 무시 → reply 도구 호출 안 됨 → AMA 무한 대기
```

### 근본 원인 요약

1. **포트 선점 경쟁**: 먼저 시작된 세션이 포트를 점유하면, 채널 플래그가 있는 세션의 dev-bridge HTTP 서버가 시작 불가
2. **무한 대기**: AMA의 Rust `send_to_bridge` 커맨드가 24시간 타임아웃으로 설정되어 있어 사용자에게 에러 피드백 없음

## 해결

### 1. dev-bridge 포트 충돌 자동 해결

**위치:** `mcp-channels/dev-bridge.mts` (프로젝트 + `~/.mypartnerai/mcp-channels/`)

새 인스턴스가 시작될 때 포트가 이미 사용 중이면, 기존 서버에 `/shutdown` 요청을 보내 종료시킨 후 포트를 인수받는다.

```typescript
// /shutdown 엔드포인트 추가 — 다른 인스턴스가 포트를 인수받기 위한 종료 요청
if (req.method === 'POST' && req.url === '/shutdown') {
  console.error('[ama-bridge] Shutdown requested by new instance — exiting');
  res.writeHead(200).end('ok');
  setTimeout(() => process.exit(0), 200);
  return;
}
```

```typescript
// 포트 충돌 시 기존 서버 종료 후 재바인딩
async function tryListen(): Promise<void> {
  return new Promise((resolve, reject) => {
    httpServer.once('error', async (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[ama-bridge] Port ${port} in use — killing old server and retrying...`);
        const res = await fetch(`http://127.0.0.1:${port}/shutdown`, { method: 'POST' }).catch(() => null);
        if (!res) await new Promise(r => setTimeout(r, 1000));
        httpServer.listen(port, '127.0.0.1', () => {
          console.error(`[ama-bridge] HTTP server listening on 127.0.0.1:${port} (after retry)`);
          resolve();
        });
      } else {
        reject(err);
      }
    });

    httpServer.listen(port, '127.0.0.1', () => {
      console.error(`[ama-bridge] HTTP server listening on 127.0.0.1:${port}`);
      resolve();
    });
  });
}

await tryListen();
```

### 2. AMA 앱 응답 타임아웃 추가

**위치:** `src/features/channels/claudeCodeClient.ts`

24시간 무한 대기 대신 3분 타임아웃을 적용하여 에러 피드백 제공.

```typescript
const responseText = await Promise.race([
  invoke<string>('send_to_bridge', {
    endpoint: bridgeUrl,
    body: payload,
  }),
  new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('Claude Code 응답 시간 초과 (3분). 채널 연결 상태를 확인해주세요.')),
      BRIDGE_RESPONSE_TIMEOUT_MS
    )
  ),
]);
```

**위치:** `src/features/channels/constants.ts`

```typescript
/** 채널 응답 타임아웃 (3분) — 무한 대기 방지 */
export const BRIDGE_RESPONSE_TIMEOUT_MS = 3 * 60 * 1000;
```

## 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `mcp-channels/dev-bridge.mts` | `/shutdown` 엔드포인트 + 포트 충돌 시 자동 인수 |
| `~/.mypartnerai/mcp-channels/dev-bridge.mts` | 동일 (배포용) |
| `src/features/channels/claudeCodeClient.ts` | `Promise.race`로 3분 타임아웃 |
| `src/features/channels/constants.ts` | `BRIDGE_RESPONSE_TIMEOUT_MS` 상수 추가 |

## 재현 조건

1. AMA 프로젝트 디렉토리에서 일반 Claude Code 세션 시작 (`.mcp.json`이 dev-bridge를 자동 실행)
2. 별도 터미널에서 `claude --dangerously-load-development-channels server:ama-bridge` 실행
3. AMA에서 Channels ON → 메시지 전송 → "생각중"에서 멈춤

## 교훈

- MCP 서버가 HTTP 포트를 사용하는 경우, 여러 Claude Code 세션 간 포트 충돌을 반드시 고려해야 한다
- 외부 서비스 호출 시 적절한 타임아웃과 에러 피드백이 없으면 사용자 경험이 크게 저하된다
- `notifications/claude/channel`은 `--dangerously-load-development-channels` 플래그가 활성화된 세션에서만 처리된다
