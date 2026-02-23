# Issue #007: 음성/아바타/UI 통합 안정화 (Whisper 전환, 원격 차단, 응답 시 UI 소실 수정)

> 작성일: 2026-02-16

## 문제 요약

음성 대화 흐름(음성/텍스트)에서 다음 문제가 복합적으로 발생했다.

- 음성 인식 버튼 동작 시 앱 종료 또는 비정상 동작
- 원격 세션 환경에서 음성 인식 실패/오동작
- 해상도 변경 후 아바타 초기 위치 및 상호작용 영역 불안정
- 아바타 선택/이동/회전 중 클릭 불가 또는 버튼 입력 불가
- 답변 생성 시 UI(아바타/기능 버튼) 소실, 음성만 재생
- 말풍선이 아바타 기준이 아닌 하단 고정 위치로 표시

## 원인 분석

### 1) STT 경로/환경 문제

- 기존 브라우저/플랫폼 의존 STT 경로에서 권한/런타임 변동 요인이 컸다.
- 원격 세션에서는 마이크/오디오 장치 상태가 불안정해 STT 성공률이 낮고 상태 전환이 꼬였다.

### 2) 아바타 좌표계/경계 계산 문제

- 화면 좌표 -> 월드 좌표 변환이 해상도/카메라 조건에 민감한 하드코딩 기반이었다.
- 창 크기/비율 변경 시 아바타가 화면 밖으로 벗어나거나 클릭 판정이 실제 렌더 영역과 어긋났다.

### 3) 클릭스루 판정 문제

- 투명 윈도우 환경에서 글로벌 커서 좌표 변환이 환경별로 다르게 들어오며 오검출이 발생했다.
- 결과적으로 버튼/아바타 상호작용이 끊기거나 반대로 전체 클릭이 막히는 현상이 있었다.

### 4) 응답 시 UI 소실 (핵심 크래시)

- `SpeechBubble` 렌더 과정에서 상태 업데이트 루프가 발생해
  `Maximum update depth exceeded` 런타임 에러가 발생했다.
- 해당 예외 시 React 트리가 내려가며 아바타/버튼이 사라지고, 이미 시작된 TTS만 재생되는 증상이 재현됐다.

## 해결 내용

### A. STT를 Whisper 로컬 경로로 통일

- STT 엔진을 `whisper` 단일 경로로 정리
- 프론트엔드 녹음 -> WAV -> Tauri `transcribe_audio` -> `whisper-cli` 실행
- 모델 탐색 로직(`models/whisper`, `WHISPER_MODEL_PATH`, `WHISPER_MODEL_DIR`) 추가
- `check_whisper_available`로 실행 가능 상태 사전 확인

### B. 원격 세션 감지 및 음성 인식 런타임 차단

- 백엔드 `detect_remote_environment` 추가
  - 환경변수 기반 감지(SSH/원격툴 변수)
  - 활성 네트워크 세션(`lsof`) 기반 원격툴 프로세스 감지
- 원격 세션에서는 음성 인식을 비활성화하고 안내 메시지 표시

### C. 창 크기/초기 배치 안정화

- 앱 시작 시 현재 모니터 해상도 기준으로 창 크기/위치 재설정
- 기능/옵션 버튼은 우측 하단 고정 유지

### D. 아바타 위치/상호작용 안정화

- 아바타 이동 경계 여백을 8% 기준으로 조정
- 해상도 변경 시 경계 재계산 + 우측 하단 기본 배치
- 카메라 기반 스크린->월드 변환으로 좌표 변환 교체
- `interactionBounds`(실제 렌더 경계 투영) 계산 및 store 공유
- 아바타가 화면 밖으로 벗어날 때 자동 복구 위치 보정

### E. 클릭스루 안정화

- 커서 좌표 후보(논리/물리 DPR/축 반전)를 다중 생성해 판정
- 비정상 좌표 감지 시 fail-safe로 상호작용 모드 유지
- `data-interactive="true"` 영역과 `interactionBounds`를 함께 사용해 판정 정확도 개선

### F. 말풍선 아바타 상단 고정 + UI 소실 버그 수정

- 말풍선 위치를 `interactionBounds` 기반으로 아바타 상단에 동적 배치
- 뷰포트 경계 클램프/꼬리(anchor) 동적 계산 추가
- `SpeechBubble` 상태 업데이트 루프 제거
  - Zustand selector 안정화
  - bubble size 업데이트 조건부 적용
  - 불필요한 `ResizeObserver` 루프 제거(1회 측정 + resize 재계산)
- `ErrorBoundary` 및 전역 에러 로깅(`window.error`, `unhandledrejection`) 추가

## 검증

- `npx tsc --noEmit` 통과
- `npm run tauri dev`로 반복 재실행 확인
- 텍스트/음성 답변 시 TTS 재생과 UI 유지 동작 검증
- 아바타 드래그/회전/버튼 상호작용 동시 동작 확인
- 해상도 변경 후 아바타/버튼/말풍선 위치 재계산 확인

## 관련 파일

- `src-tauri/src/commands/voice.rs`
- `src-tauri/src/main.rs`
- `src/hooks/useConversation.ts`
- `src/services/voice/audioProcessor.ts`
- `src/components/settings/VoiceSettings.tsx`
- `src/stores/settingsStore.ts`
- `src/components/avatar/AvatarController.tsx`
- `src/components/avatar/VRMAvatar.tsx`
- `src/stores/avatarStore.ts`
- `src/hooks/useClickThrough.ts`
- `src/components/ui/StatusIndicator.tsx`
- `src/components/ui/SpeechBubble.tsx`
- `src/components/ui/ErrorBoundary.tsx`
- `src/App.tsx`
- `src/main.tsx`
