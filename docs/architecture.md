# 아키텍처

MyPartnerAI는 `React + Tauri` 기반 데스크톱 오버레이 앱입니다.
프런트엔드는 아바타 렌더링/상호작용/대화 UI를 담당하고, 백엔드는 OS 통합(권한, 파일 선택, Whisper 실행, 창 제어)을 담당합니다.

## 전체 구성

```text
┌──────────────────────────────────────────────────────────────┐
│ Frontend (React + Zustand + Three.js)                      │
│  - AvatarCanvas/VRMAvatar                                   │
│  - StatusIndicator/SpeechBubble/SettingsPanel               │
│  - useConversation (STT→LLM→TTS 오케스트레이션)            │
│  - services/ai, services/voice, services/tauri              │
└──────────────────────────────────────────────────────────────┘
                  │ invoke / plugin API
                  ▼
┌──────────────────────────────────────────────────────────────┐
│ Backend (Tauri 2, Rust)                                     │
│  - commands::voice (Whisper 실행, 원격 감지)                │
│  - commands::settings (권한 설정 열기, VRM picker)          │
│  - commands::window (click-through, cursor/size/position)   │
│  - commands::screenshot (vision 요청용 캡처)                │
│  - single-instance plugin                                   │
└──────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────┐
│ Local Assets / Runtime                                      │
│  - models/whisper (base/small/medium)                       │
│  - models/supertonic (onnx, voice_styles)                   │
│  - bundled whisper-cli + dylib (macOS app Resources)        │
└──────────────────────────────────────────────────────────────┘
```

## 핵심 런타임 플로우

### 1) 음성 대화
1. 사용자가 우하단 마이크 버튼 클릭
2. `useConversation.startListening()`이 녹음 시작 (`audioProcessor`)
3. 녹음 중지 시 WAV(16k mono) 생성
4. Tauri `transcribe_audio` 호출 → `whisper-cli` 실행
5. 인식 텍스트를 LLM Router로 전달
6. 응답 텍스트를 `useSpeechSynthesis`로 전달
7. `ttsRouter` → `SupertonicClient`로 합성 및 재생
8. 재생 중 립싱크/표정/제스처 업데이트

### 2) 텍스트 대화
1. 사용자가 텍스트 입력
2. LLM Router가 설정된 Provider로 요청
3. 응답 즉시 말풍선 표시
4. 같은 텍스트를 TTS로 재생

### 3) VRM 로딩
1. `settings.vrmModelPath` 확인
2. 비어 있으면 VRM 선택 오버레이 표시
3. 선택된 파일을 `VRMAvatar`에서 로드
4. 로드 성공 시 interaction bounds 계산 후 마우스 선택/드래그/회전 활성화

## 상태 관리

- `settingsStore`: LLM/STT/TTS/VRM/아바타 설정 (persist)
- `avatarStore`: 아바타 로딩/위치/감정/제스처/상호작용 상태
- `conversationStore`: 메시지, 응답 텍스트, 처리 상태(`idle/listening/processing/speaking/error`)

## 안정화 포인트

- **원격 세션 차단**: 원격 연결 감지 시 STT 비활성
- **단일 인스턴스**: 두 번째 실행 시 기존 윈도우 포커스
- **클릭스루 보호**: 인터랙티브 요소 위에서는 click-through 해제
- **말풍선 동적 위치**: 아바타 bounds/스케일/뷰포트 기준 상단 배치
- **모델 의존성 안내**: Whisper/Supertonic/LLM 미설정 시 설치 안내 모달 제공

## Vision(화면 분석) 플로우

- 사용자 요청이 화면 분석 키워드를 포함하면 `capture_screen` 실행
- `claude/openai/gemini` provider에서만 Vision 처리
- `ollama/localai` 선택 시 지원 불가 에러 메시지 반환
