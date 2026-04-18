# 프로젝트 구조

> 최종 수정: 2026-04-09 (v1.0.0 기준)

최신 구현 기준 디렉터리/핵심 파일 맵입니다.

## 루트

```text
AMA/
├── src/                         # React 프런트엔드 (features/ 포함)
├── src-tauri/                   # Rust + Tauri 백엔드
├── models/                      # 로컬/배포용 모델 원본
│   ├── whisper/
│   └── supertonic/
├── motions/                     # 모션 클립/카탈로그
│   └── clean/
├── scripts/                     # 빌드/배포/모션 스크립트
├── docs/                        # 프로젝트 문서
└── package.json
```

## 프런트엔드 (`src`)

### 앱 진입

```text
src/
├── App.tsx                      # 전체 레이아웃, 메뉴 이벤트, About 모달
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
├── ClipMotionController.tsx     # 모션 클립 재생
├── DanceController.tsx          # 댄스 애니메이션
├── DragController.tsx           # 마우스 드래그/회전
├── ExpressionController.tsx     # 감정 표정 제어
├── EyeController.tsx            # 시선 추적
├── GestureController.tsx        # 제스처 동작
├── HumanoidSyncController.tsx   # 보행/이동 동기화
├── LightingControl.tsx          # 조명 아이콘 드래그 UI
├── LookAtController.tsx         # 시선 방향 제어
├── MotionSequenceDemoController.tsx # 모션 시퀀스 데모
└── PhysicsController.tsx        # 물리 시뮬레이션
```

### 인증

```text
src/components/auth/
├── AuthScreen.tsx               # OAuth 로그인 화면
├── TermsModal.tsx               # 이용약관/개인정보 모달
└── UserProfile.tsx              # 계정 정보/탈퇴
```

### UI

```text
src/components/ui/
├── AboutModal.tsx               # 앱 정보 모달 (커스텀 About)
├── ErrorBoundary.tsx            # 에러 경계
├── HistoryPanel.tsx             # 대화 기록 패널
├── ModelDownloadModal.tsx       # 모델 다운로드 모달
├── SettingsPanel.tsx            # 설정 패널
├── SpeechBubble.tsx             # 아바타 상단 말풍선
├── StatusIndicator.tsx          # 우하단 기능 버튼, 상태/설치 안내 모달
├── UpdateNotification.tsx       # 상단 업데이트 알림
└── VoiceWaveform.tsx            # 음성 파형 시각화
```

### 설정

```text
src/components/settings/
├── AvatarSettings.tsx           # VRM 선택, 아바타 이름, 스케일, 초기 시선, TTS Test
├── LLMSettings.tsx              # LLM provider/model/apiKey/endpoint
├── LicensesSettings.tsx         # 오픈소스/모델 라이선스 표
├── MonitorSettings.tsx          # 모니터/디스플레이 설정
├── PremiumVoiceSettings.tsx     # 프리미엄 음성 설정 (TTS 엔진/음성/모델/사용량)
├── SettingsSection.tsx          # 접을 수 있는 카드 UI 공통 컴포넌트
├── UpdateSettings.tsx           # 앱 버전 표시, 업데이트 확인/설치
└── VoiceSettings.tsx            # Whisper 모델 선택/다운로드 + Supertonic 보이스
```

### Claude Code Channels (`src/features/channels/`)

```text
src/features/channels/
├── index.ts                     # 퍼블릭 API (re-export)
├── constants.ts                 # CLAUDE_CODE_PROVIDER, BRIDGE_DEFAULT_ENDPOINT 등
├── claudeCodeClient.ts          # LLM 클라이언트 (dev-bridge 통신)
├── useClaudeCodeChat.ts         # Claude Code 응답 처리 훅
├── useMcpSpeakListener.ts       # Tauri mcp-speak 이벤트 리스너
├── responseProcessor.ts         # 응답 파이프라인 (감정/모션/TTS 통합)
└── MCPSettings.tsx              # Channels 설정 UI (토글/등록/연결확인)
```

### 훅

```text
src/hooks/
├── useAutoUpdate.ts             # 앱 업데이트 Zustand 스토어 + 훅
├── useClickThrough.ts           # 투명창 click-through 제어
├── useConversation.ts           # STT→LLM→TTS 오케스트레이션
├── useGlobalVoiceShortcut.ts    # 글로벌 단축키 등록/해제
├── useLipSync.ts                # 립싱크 오디오 분석
├── useScreenCapture.ts          # 화면 캡처 트리거
├── useSpeechSynthesis.ts        # TTS 재생 + 립싱크 연동
├── useVRM.ts                    # VRM 로딩/관리
└── useWindowDrag.ts             # 윈도우 드래그 제어
```

### 서비스

```text
src/services/
├── ai/
│   ├── llmRouter.ts             # LLM 프로바이더 라우팅 (channels 모듈 포함)
│   ├── claudeClient.ts          # Anthropic Claude
│   ├── openaiClient.ts          # OpenAI
│   ├── geminiClient.ts          # Google Gemini
│   ├── ollamaClient.ts          # Ollama (로컬)
│   ├── localAiClient.ts         # LocalAI (로컬)
│   ├── screenAnalyzer.ts        # Vision 화면 분석
│   └── types.ts
├── audio/
│   └── rhythmAnalyzer.ts        # 댄스용 리듬 분석
├── auth/
│   ├── authService.ts           # 인증 서비스
│   ├── edgeFunctionClient.ts    # Edge Function 호출 래퍼 (세션 복원 + invoke)
│   ├── oauthClient.ts           # OAuth 클라이언트
│   ├── supabaseClient.ts        # Supabase 연결
│   ├── tokenManager.ts          # 토큰 관리
│   └── types.ts
├── avatar/
│   ├── motionLibrary.ts         # 모션 클립 라이브러리
│   └── motionSelector.ts        # 모션 선택 알고리즘
├── tauri/
│   ├── fileDialog.ts            # native picker + dialog fallback
│   ├── globalShortcutUtils.ts   # 글로벌 단축키 유틸
│   ├── permissions.ts           # 시스템 권한 관리
│   ├── screenCapture.ts         # 화면 캡처
│   └── windowManager.ts         # 윈도우 관리
└── voice/
    ├── audioProcessor.ts        # 녹음 + WAV 인코딩
    ├── supertonicClient.ts      # 로컬 ONNX TTS 모델 로딩 + 합성
    ├── supertoneApiClient.ts    # Supertone API 클라우드 TTS 클라이언트
    ├── ttsRouter.ts             # 합성/재생 라우팅 (엔진 선택 + 폴백)
    └── voiceCommandParser.ts    # 음성 명령어 파서
```

### 상태

```text
src/stores/
├── appStatusStore.ts            # 앱 실행 상태
├── authStore.ts                 # OAuth 인증 상태 (persist)
├── avatarStore.ts               # 아바타 런타임 상태
├── conversationStore.ts         # 대화/상태 (persist)
├── modelDownloadStore.ts        # Whisper/Supertonic 모델 다운로드 상태
├── monitorStore.ts              # 모니터/디스플레이 상태
├── premiumStore.ts              # 프리미엄 상태/음성목록/사용량/할당량
└── settingsStore.ts             # persist 설정 (version 13)
```

### i18n

```text
src/i18n/
├── index.ts                     # 초기화, 언어 감지
├── ko.json                      # 한국어 (기본/폴백)
└── en.json                      # 영어
```

## 백엔드 (`src-tauri`)

```text
src-tauri/
├── src/
│   ├── main.rs                  # plugin/command 등록, 단일 인스턴스, 메뉴바, 창 초기화
│   └── commands/
│       ├── voice.rs             # Whisper, 원격 감지, 의존성 점검
│       ├── settings.rs          # 시스템 설정 열기, VRM 파일 선택
│       ├── window.rs            # click-through, cursor, window helper
│       ├── screenshot.rs        # Vision용 화면 캡처
│       ├── auth.rs              # OAuth URL/콜백 처리
│       ├── models.rs            # 모델 상태/다운로드
│       └── http.rs              # 외부 URL 바이너리 fetch (미리듣기용)
├── tauri.conf.json
├── Cargo.toml
├── Info.plist                   # 마이크/음성인식 권한 설명
├── entitlements.plist
└── capabilities/default.json
```

## 스크립트

```text
scripts/
├── release-local.mjs            # 전체 배포 파이프라인 (8단계)
├── prepare-assets.mjs           # 모델/리소스 준비
├── stage-bundled-models.mjs     # 배포용 모델 스테이징
├── sign-macos-app.mjs           # macOS Developer ID 코드사인
├── notarize-macos-app.mjs       # Apple 노타라이즈
├── validate-motion-assets.mjs   # 모션 에셋 검증
├── generate-motion-catalog.mjs  # 모션 카탈로그 생성
├── import-motion-catalog.mjs    # 모션 카탈로그 임포트
├── tune-emotions.mjs            # 감정 가중치 튜닝
└── lib/                         # 공유 유틸리티
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
- 사용자 모델: `~/.mypartnerai/models/` (온디맨드 다운로드)

## Supabase

```text
supabase/
├── functions/
│   ├── delete-account/index.ts      # 계정 삭제 Edge Function
│   ├── supertone-tts/index.ts       # TTS 프록시 (JWT 검증 + 할당량 관리)
│   ├── supertone-voices/index.ts    # 음성 목록 프록시
│   └── supertone-usage/index.ts     # 사용량 조회
└── migrations/
    ├── 001_initial_schema.sql       # 초기 스키마 (profiles, user_settings, user_consents)
    └── 20260228000000_premium_feature.sql # 프리미엄 기능 (subscription_plans, tts_usage 등)
```
