# 아키텍처

MyPartnerAI는 `React + Tauri 2` 기반의 오버레이 데스크톱 앱입니다.
프런트엔드는 UI/3D/대화 오케스트레이션을 담당하고, 백엔드는 OS 권한/파일 선택/Whisper 실행/창 제어를 담당합니다.

## 시스템 구성

```text
┌──────────────────────────────────────────────────────────────┐
│ Frontend (React, R3F, Zustand)                              │
│ - AvatarCanvas / VRMAvatar / AnimationManager               │
│ - StatusIndicator / SpeechBubble / SettingsPanel            │
│ - useConversation (STT → LLM → TTS orchestration)           │
│ - useClickThrough (투명창 상호작용 보호)                    │
└──────────────────────────────────────────────────────────────┘
                   │ invoke / plugins
                   ▼
┌──────────────────────────────────────────────────────────────┐
│ Backend (Tauri 2, Rust commands)                            │
│ - commands::voice (Whisper, 원격 세션 감지)                 │
│ - commands::settings (VRM picker, 시스템 설정 열기)         │
│ - commands::window (cursor/click-through/window helpers)    │
│ - commands::screenshot (Vision용 화면 캡처)                 │
│ - tauri-plugin-single-instance                               │
└──────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│ Local Runtime Assets                                         │
│ - models/whisper (base, small, medium)                      │
│ - models/supertonic (onnx, voice_styles)                    │
│ - bundled whisper-cli + runtime dylibs (macOS Resources)    │
└──────────────────────────────────────────────────────────────┘
```

## 핵심 런타임 플로우

### 1) 음성 입력 + 답변
1. 우하단 마이크 버튼 클릭
2. `useConversation.startListening()`이 녹음 시작 (`audioProcessor`)
3. 녹음 중지 시 WAV(16k mono) 생성 후 `transcribe_audio` 호출
4. Rust에서 `whisper-cli` 실행 후 텍스트 반환
5. `llmRouter.chat()`로 응답 생성
6. 응답을 말풍선에 즉시 표시
7. `ttsRouter.playAudio()`로 Supertonic TTS 재생 (HTMLAudio 실패 시 WebAudio fallback)
8. 재생 중 립싱크/감정/제스처 동기화

### 2) 텍스트 입력 + 답변
1. 우하단 텍스트 버튼으로 입력창 열기
2. 메시지 전송 시 `sendMessage()` 호출
3. LLM 응답 표시 + 동일 텍스트 TTS 재생

### 3) VRM 로딩
1. `settings.vrmModelPath` 확인
2. 비어 있으면 VRM 선택 오버레이 표시
3. 선택 경로를 `VRMAvatar`가 로드
4. URL 로드 실패 시 Tauri fs read + parse fallback 수행
5. 로딩 성공 후 interaction bounds 계산 시작

## 상태 저장 구조

- `settingsStore`:
  - LLM/STT/TTS/언어/VRM 경로/아바타 이름/아바타 설정
  - persist key: `mypartnerai-settings`, version: `5`
- `avatarStore`:
  - 위치, bounds, interactionBounds, 감정, 제스처, 수동 회전
- `conversationStore`:
  - 메시지 목록, 현재 응답, 상태(`idle/listening/processing/speaking/error`)

## 안정화 포인트

- 단일 인스턴스 강제: 중복 실행 시 기존 창 포커스
- 시작 시 모니터 크기에 맞춰 윈도우 크기/위치 보정
- 클릭스루 보호: 아바타/버튼/패널/조명아이콘 위에서 클릭 가능
- 원격 세션 음성 차단: 원격 감지 시 STT 버튼은 안내 메시지로 차단
- 의존성 안내 모달: Whisper/Supertonic/LLM 설정 누락 시 설치/설정 단계 표시
- 아바타 초기 시선 저장/적용: head drag로 조정한 시선을 기본값으로 저장

## Vision(화면 분석)

- `screenAnalyzer`가 Tauri `capture_screen`으로 스크린샷 확보
- Vision 지원 provider: `claude`, `openai`, `gemini`
- `ollama/localai` 선택 시 Vision 요청은 에러 반환

## 첫 실행 UX

- 배포 빌드에서 아바타 이름(`avatarName`)이 비어 있으면 온보딩 모달 표시
- 이름 저장 전까지 일반 대화 UI는 계속 표시되며, 이름 저장 후 system prompt에 반영
