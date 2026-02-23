# 프로젝트 구조

최신 구현 기준 디렉터리/핵심 파일 맵입니다.

## 루트

```text
MyPartnerAI/
├── src/                         # React 프런트엔드
├── src-tauri/                   # Rust + Tauri 백엔드
├── models/                      # 로컬/배포용 모델 원본
│   ├── whisper/
│   └── supertonic/
├── scripts/                     # 준비/스테이징/서명/노타라이즈 스크립트
├── docs/
└── package.json
```

## 프런트엔드 (`src`)

### 앱 진입

```text
src/
├── App.tsx                      # 전체 레이아웃, 초기 아바타 이름 온보딩
├── main.tsx
└── index.css
```

### 아바타

```text
src/components/avatar/
├── AvatarCanvas.tsx             # Canvas + VRM 미선택/로드실패 오버레이
├── VRMAvatar.tsx                # VRM 로딩, drag/rotate, bounds 계산
├── AvatarController.tsx         # 이동 상태 업데이트
├── AnimationManager.tsx         # 표정/제스처/댄스 레이어
└── LightingControl.tsx          # 조명 아이콘 드래그 UI
```

### UI

```text
src/components/ui/
├── StatusIndicator.tsx          # 우하단 기능 버튼, 상태/설치 안내 모달
├── SpeechBubble.tsx             # 아바타 상단 말풍선
├── SettingsPanel.tsx            # 설정 패널
└── ErrorBoundary.tsx
```

### 설정

```text
src/components/settings/
├── LLMSettings.tsx              # LLM provider/model/apiKey/endpoint (+접기/펼치기)
├── VoiceSettings.tsx            # Whisper 모델 + Supertonic 보이스
├── AvatarSettings.tsx           # VRM 선택, 아바타 이름, 스케일, 초기 시선, TTS Test
└── LicensesSettings.tsx         # 오픈소스/모델 라이선스 표 (+접기/펼치기)
```

### 훅

```text
src/hooks/
├── useConversation.ts           # STT→LLM→TTS 오케스트레이션
├── useSpeechSynthesis.ts        # TTS 재생 + 립싱크 연동
└── useClickThrough.ts           # 투명창 click-through 제어
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
│   ├── audioProcessor.ts        # 녹음 + WAV 인코딩
│   ├── supertonicClient.ts      # 모델 로딩 + 합성
│   ├── ttsRouter.ts             # 합성/재생 라우팅
│   └── voiceCommandParser.ts
└── tauri/
    ├── windowManager.ts
    ├── permissions.ts
    └── fileDialog.ts            # native picker + dialog fallback
```

### 상태

```text
src/stores/
├── settingsStore.ts             # persist 설정 (version 5)
├── avatarStore.ts               # 아바타 런타임 상태
└── conversationStore.ts         # 대화/상태
```

## 백엔드 (`src-tauri`)

```text
src-tauri/
├── src/
│   ├── main.rs                  # plugin/command 등록, 단일 인스턴스, 창 초기화
│   └── commands/
│       ├── voice.rs             # Whisper, 원격 감지, 의존성 점검
│       ├── settings.rs          # 시스템 설정 열기, VRM 파일 선택
│       ├── window.rs            # click-through, cursor, window helper
│       └── screenshot.rs        # Vision용 화면 캡처
├── tauri.conf.json
├── Info.plist                   # 마이크/음성인식 권한 설명
├── entitlements.plist
└── capabilities/default.json
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
- 배포 모드: `Contents/Resources/models`로 스테이징
