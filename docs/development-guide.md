# 개발 가이드

최신 구현 기준으로 기능 수정 시 따라야 할 실무 절차입니다.

## 실행/검증

```bash
npm install
npm run tauri dev
npx tsc --noEmit
```

필수 품질 체크:

```bash
npm run lint
npm run test
```

## 핵심 진입점

| 기능 | 주요 파일 |
|------|-----------|
| 대화 오케스트레이션 | `src/hooks/useConversation.ts` |
| STT 녹음/변환 | `src/services/voice/audioProcessor.ts` |
| TTS 합성/재생 | `src/services/voice/supertonicClient.ts`, `src/services/voice/ttsRouter.ts` |
| 아바타 렌더/상호작용 | `src/components/avatar/VRMAvatar.tsx` |
| 우하단 기능 UI/안내 모달 | `src/components/ui/StatusIndicator.tsx` |
| 설정 패널 | `src/components/ui/SettingsPanel.tsx`, `src/components/settings/*` |
| Rust 명령 | `src-tauri/src/commands/*.rs` |

## 변경 원칙

### 1) 음성(STT/TTS)

- STT는 Whisper 단일 경로 유지
- 입력 오디오는 WAV(16k mono) 계약 유지
- TTS는 Supertonic 단일 경로 유지
- TTS 재생은 HTMLAudio → WebAudio fallback 유지

### 2) 아바타/UI

- 기능 버튼/옵션 버튼은 우하단 고정
- 아바타 이동/회전은 비율/해상도 변경에 대응해야 함
- `interactionBounds` 변경 시 반드시 `SpeechBubble`/`useClickThrough` 영향 확인
- 조명 아이콘은 화면 밖으로 나가지 않도록 viewport clamp 유지
- click-through 좌표 판정 변경 시 상단/하단 영역 모두 실제 클릭 통과를 수동 확인

### 3) 설정/온보딩

- `settingsStore` persist version 변경 시 `migrate` 로직 동시 업데이트
- `avatarName`은 온보딩/시스템 프롬프트/TTS 테스트에 공통 반영
- LLM/라이선스 섹션 접기/펼치기 동작 회귀 확인

### 4) Tauri 명령 추가

1. `src-tauri/src/commands/*.rs`에 `#[tauri::command]` 함수 추가
2. `src-tauri/src/commands/mod.rs` 등록
3. `src-tauri/src/main.rs` `invoke_handler` 등록
4. 프런트 래퍼(`src/services/tauri/*`) 연결

## 모델/리소스 운영

- 개발 모델 원본: `models/whisper`, `models/supertonic`
- `npm run dev`/`npm run build` 시 `prepare-assets.mjs` 실행
- macOS 앱 번들 스테이징은 `stage-bundled-models.mjs` 담당

## 디버깅 포인트

- Whisper 미탐지: `get_whisper_availability` 결과 먼저 확인
- TTS 무음: `supertonicClient` 모델 경로 로그 확인
- 아바타 선택 불가: `interactionBounds`, click-through 상태 확인
- 아바타 위쪽 클릭 막힘: `useClickThrough` 커서 좌표 후보(반전 Y 오검출 여부) 점검
- 응답 후 UI 소실: `setCurrentResponse`/`clearCurrentResponse` 타이밍 확인
- VRM 로드 실패: URL 로드 실패 후 fs fallback 동작 확인
- 클라우드 모델 목록 누락: Provider API Key 입력 후 `LLMSettings` 모델 동기화 노트/상태 확인

## 문서 동기화 규칙

기능 변경 PR에는 아래 문서 동기화를 포함합니다.

- 아키텍처 변경: `docs/architecture.md`
- 음성/모델 변경: `docs/voice-services.md`, `docs/tauri-backend.md`
- UI/아바타 변경: `docs/avatar-system.md`, `docs/settings-system.md`
- 구조 변경: `docs/project-structure.md`
