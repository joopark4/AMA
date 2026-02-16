# 프로젝트 구조

최신 구현 기준의 주요 디렉터리와 핵심 파일을 정리합니다.

## 루트 구조

```text
MyPartnerAI/
├── src/                         # React 프런트엔드
├── src-tauri/                   # Tauri(Rust) 백엔드
├── models/                      # 로컬/배포용 AI 모델 원본
│   ├── whisper/
│   └── supertonic/
├── scripts/                     # 빌드/스테이징/서명 스크립트
├── docs/                        # 프로젝트 문서
├── CLAUDE.md                    # 프로젝트 운영/요약 문서
└── package.json
```

## 프런트엔드 (`src`)

### 컴포넌트

```text
src/components/
├── avatar/
│   ├── AvatarCanvas.tsx         # R3F Canvas + VRM 미선택/에러 오버레이
│   ├── VRMAvatar.tsx            # VRM 로딩, 클릭/드래그/회전, bounds 계산
│   ├── AvatarController.tsx     # 이동 제어
│   ├── AnimationManager.tsx     # 표정/제스처/댄스 레이어
│   └── LightingControl.tsx      # 조명 컨트롤
├── settings/
│   ├── VoiceSettings.tsx        # Whisper 모델/Supertonic 보이스 설정
│   └── AvatarSettings.tsx       # VRM 선택/아바타 스케일/TTS 테스트
└── ui/
    ├── StatusIndicator.tsx      # 우하단 기능 버튼, 상태/설치 안내 모달
    ├── SpeechBubble.tsx         # 아바타 상단 말풍선
    ├── SettingsPanel.tsx        # 설정 패널
    └── ErrorBoundary.tsx
```

### 훅

```text
src/hooks/
├── useConversation.ts           # STT→LLM→TTS 메인 오케스트레이션
├── useSpeechSynthesis.ts        # Supertonic 재생 + 립싱크
└── useClickThrough.ts           # click-through 토글/인터랙션 보호
```

### 서비스

```text
src/services/
├── ai/
│   ├── llmRouter.ts
│   ├── ollamaClient.ts
│   ├── localAiClient.ts
│   ├── claudeClient.ts
│   ├── openaiClient.ts
│   ├── geminiClient.ts
│   └── screenAnalyzer.ts
├── voice/
│   ├── audioProcessor.ts        # 마이크 녹음 + WAV 인코딩
│   ├── supertonicClient.ts      # Supertonic ONNX 로딩/합성
│   ├── ttsRouter.ts             # TTS 재생 라우터
│   └── voiceCommandParser.ts
└── tauri/
    ├── windowManager.ts         # 창 제어 invoke 래퍼
    ├── permissions.ts           # 시스템 권한 설정 이동
    └── fileDialog.ts            # VRM 파일 선택(네이티브 + fallback)
```

### 상태 스토어

```text
src/stores/
├── settingsStore.ts             # LLM/STT/TTS/VRM/아바타 설정(persist)
├── avatarStore.ts               # 아바타 런타임 상태
└── conversationStore.ts         # 대화/응답/상태
```

## 백엔드 (`src-tauri`)

```text
src-tauri/
├── src/
│   ├── main.rs                  # plugin 등록, invoke handler, window setup
│   └── commands/
│       ├── voice.rs             # whisper 실행, 원격 감지, 의존성 점검
│       ├── settings.rs          # 권한 설정 열기, VRM picker
│       ├── window.rs            # click-through/커서/창 정보
│       └── screenshot.rs        # 화면 캡처
├── capabilities/
│   └── default.json             # fs/dialog/shell 권한
├── tauri.conf.json
├── Info.plist                   # macOS privacy usage 설명 키
└── entitlements.plist
```

## 모델/리소스

```text
models/
├── whisper/
│   ├── ggml-base.bin
│   ├── ggml-small.bin
│   └── ggml-medium.bin
└── supertonic/
    ├── onnx/
    └── voice_styles/
```

- 개발 모드: 필요 시 `public/models`로 동기화
- macOS 배포: 앱 번들 `Contents/Resources/models`로 스테이징

## 스크립트

```text
scripts/
├── prepare-assets.mjs           # 모델 준비/동기화/선택적 다운로드
├── stage-bundled-models.mjs     # 앱 번들로 모델/whisper runtime 복사
├── sign-macos-app.mjs           # 코드사인
└── notarize-macos-app.mjs       # 노타라이즈 + staple
```
