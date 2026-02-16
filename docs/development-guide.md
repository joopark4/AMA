# 개발 가이드

최신 구현 기준으로 기능 추가/수정 시 따라야 할 기본 절차를 정리합니다.

## 개발 실행

```bash
npm install
npm run tauri dev
```

## 기본 품질 체크

```bash
npx tsc --noEmit
npm run lint
npm run test
```

## 기능별 진입점

| 기능 | 주 파일 |
|------|---------|
| 대화 오케스트레이션 | `src/hooks/useConversation.ts` |
| STT 녹음/변환 | `src/services/voice/audioProcessor.ts` |
| TTS 합성/재생 | `src/services/voice/supertonicClient.ts`, `src/services/voice/ttsRouter.ts` |
| 아바타 로딩/상호작용 | `src/components/avatar/VRMAvatar.tsx` |
| 상태/설정 UI | `src/components/ui/StatusIndicator.tsx`, `src/components/settings/*` |
| Rust 명령 | `src-tauri/src/commands/*.rs` |

## 변경 작업 가이드

### 1) STT 관련 수정

- STT 엔진은 Whisper 단일 경로를 유지합니다.
- 입력은 반드시 WAV(16k mono)로 전달합니다.
- `voice.rs`의 `transcribe_audio` 반환 계약(text/confidence/language)을 깨지 않도록 유지합니다.

### 2) TTS 관련 수정

- TTS 엔진은 Supertonic 단일 경로를 유지합니다.
- `ttsRouter.playAudio()`의 HTMLAudio → WebAudio fallback 흐름을 유지합니다.
- TTS 오류는 `StatusIndicator`와 `AvatarSettings`에서 사용자에게 표시되므로 에러 메시지를 의미 있게 유지합니다.

### 3) VRM/UI 관련 수정

- 아바타 상호작용 bounds 변경 시 `SpeechBubble` 위치 계산과 `useClickThrough` hit-test를 함께 점검합니다.
- 기능 버튼/옵션 버튼은 우하단 고정 정책을 유지합니다.
- 화면 해상도 변경 대응 로직(초기 bounds, resize)을 깨지 않도록 주의합니다.

### 4) Tauri 명령 추가

1. `src-tauri/src/commands/*.rs`에 함수 추가 (`#[tauri::command]`)
2. `src-tauri/src/commands/mod.rs`에 모듈 등록
3. `src-tauri/src/main.rs` `invoke_handler`에 명령 등록
4. 프런트에서 `invoke('<command>')` 호출 래퍼 추가

## 모델/리소스 관리

- 개발 중 모델 경로: `models/whisper`, `models/supertonic`
- `prepare-assets.mjs`로 개발용 동기화
- 배포 시 `stage-bundled-models.mjs`로 앱 번들 Resources에 복사

## 디버깅 팁

### 프런트/백엔드 통합 로그

- 프런트에서 `invoke('log_to_terminal')`로 Rust stdout 로그 사용
- 음성 관련 로그 접두사: `[useConversation]`, `[TTS]`, `[Supertonic]`, `[TTSRouter]`

### 자주 발생하는 이슈

- Whisper 미탐지: `whisper-cli` 경로/모델 파일 확인
- TTS 무음: Supertonic 모델 리소스 경로 확인
- 아바타 선택 불가: click-through 상태 + interaction bounds 확인
- 응답 시 UI 소실: `setCurrentResponse/clearCurrentResponse` 타이밍 확인

## PR/커밋 권장 단위

- 기능 변경 + 문서 변경을 함께 커밋
- 음성/아바타/배포는 각각 별도 커밋으로 분리 권장
