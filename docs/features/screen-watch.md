# 화면 관찰 (Screen Watch)

> 작성일: 2026-04-18
> 대상 PR: [#33](https://github.com/joopark4/MyPartnerAI/pull/33) (merged 2026-04-18)
> 계획 문서: `~/.claude/plans/fluttering-hatching-forest.md`

## 개요

사용자 화면을 주기적으로 캡처·분석하여 AI 아바타가 상황에 맞는 한마디를 능동적으로 건네는 기능. 데스크톱 동반자라는 AMA의 포지션을 살린 기능으로, Vision-capable LLM이 선택된 provider일 때만 활성화된다.

## 지원 Provider

| Provider | 이미지 전달 방식 | 상태 |
|---|---|---|
| Claude / OpenAI / Gemini | `chatWithVision` Base64 inline | ✅ |
| Codex | `codex_send_message` + `LocalImageUserInput` (file path) | ✅ |
| Ollama / LocalAI | Vision 미지원 | ❌ auto-disable |
| Claude Code | bridge 이미지 계약 미확정 | ❌ 1차 릴리스 제외 |
| 기타 OS (Windows/Linux) | macOS 전용 백엔드 | ❌ auto-disable |

## 캡처 대상

`CaptureTarget` 타입으로 5가지 지원:

1. `fullscreen` — 전체 화면
2. `main-monitor` — 메인 모니터만 (`screencapture -m`)
3. `monitor` — 이름 기반 특정 모니터 (`screencapture -D <idx+1>`)
4. `active-window` — 최상위 활성 창 (`screencapture -l <windowId>`)
5. `window` — 앱/창 이름 기반 특정 윈도우

창 목록은 CoreGraphics `CGWindowListCopyWindowInfo`로 조회 (Accessibility 불필요, Screen Recording 권한만 사용).

## 파이프라인

```
useScreenWatcher (10초 tick + 시간 기반 cooldown)
  │
  ├─ 가드: enabled / provider vision-capable / platform macOS /
  │        대화 상태 idle / silent hours / 쿨다운 통과
  │
  ├─ screenWatchService.observeScreen()
  │    ├─ Rust `capture_screen_for_watch`
  │    │   ├─ CGPreflightScreenCaptureAccess (OS 권한 확인)
  │    │   ├─ screencapture → PNG → image 크레이트 decode
  │    │   ├─ 640×360 비교 버퍼 + mean_abs_diff (RGB 3채널)
  │    │   │  → 변화 미약하면 Unchanged 반환 (LLM 호출 스킵)
  │    │   ├─ 50% 리사이즈 + JPEG 80% 인코딩
  │    │   └─ CLI provider면 ~/.mypartnerai/screenshots/screen_watch.jpg 저장
  │    │
  │    ├─ Provider 분기
  │    │   ├─ API (Base64 inline + chatWithVision)
  │    │   └─ Codex (localImage UserInput + file path)
  │    │
  │    └─ Stage 1 프롬프트 SKIP 필터 ([SKIP] 토큰)
  │
  └─ processExternalResponse({ source: 'screen-watch' })
       → TTS + 아바타 발화
```

## 비용·프라이버시 안전장치

| 장치 | 효과 |
|---|---|
| Rust 픽셀 diff 필터 | 화면 변화 미약 시 LLM 호출 자체 스킵 (비용 0) |
| LLM `[SKIP]` 규칙 | 볼 게 없는 화면에서 LLM이 발화 생략 |
| OS 권한 preflight | `CGPreflightScreenCaptureAccess`로 실제 권한 확인 |
| 파일 저장 안전 | `~/.mypartnerai/screenshots/` 절대경로 고정, finally로 즉시 삭제 |
| 앱 시작 시 잔여 파일 정리 | `cleanup_screen_watch_residuals` |
| 컨텍스트 제한 | LLM 프롬프트에 최근 5개 관찰만 포함 |
| 프라이버시 다이얼로그 | 첫 활성화 시 동의 확인 |
| Silent hours | 자정 넘기기 포함 특정 시간대 관찰 중단 |
| fail-closed | `active-window`/`window` 실패 시 전체 화면 확대 없이 에러 |

## 동시성·경합 방지

- `isObservingRef` 플래그: 중복 관찰 차단
- 시간 기반 쿨다운: `setInterval` 밀림(sleep/wake) 방지
- 발화 직전 재검사: `enabled` / `provider` / `silentHours` / `conversation state`

## 설정 스키마

```typescript
interface ScreenWatchSettings {
  enabled: boolean;
  intervalSeconds: number;          // 30~600
  captureTarget: CaptureTarget;
  responseStyle: 'balanced' | 'advisor' | 'comedian' | 'analyst';
  silentHours: { enabled: boolean; start: number; end: number };
}
```

persist v14 → v15 마이그레이션 (`normalizeScreenWatchSettings`).

## 주요 파일

| 파일 | 역할 |
|---|---|
| `src/features/screen-watch/screenWatchService.ts` | 캡처·Vision·프롬프트·링버퍼 |
| `src/features/screen-watch/useScreenWatcher.ts` | 타이머 루프·동시성 가드 |
| `src/features/screen-watch/ScreenWatchSettings.tsx` | 설정 UI·프라이버시 다이얼로그 |
| `src-tauri/src/commands/screenshot.rs` | `capture_screen_for_watch`, `list_windows` (CoreGraphics FFI) 등 |
| `src-tauri/Info.plist` | `NSScreenCaptureUsageDescription` |

## 관련 이슈·리뷰 반영

- Adversarial review Top 3 blocker 해결 (CLI 차단, 파일 저장 안전, OS 권한 preflight)
- Gemini/Codex review P1~P2 반영 (UUID 임시 파일, RGB 3채널 diff, PID 기반 자기 제외, Claude Code auto-disable, monitor name 정규화)
