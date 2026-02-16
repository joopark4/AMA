# MyPartnerAI - AI 아바타 데스크톱 애플리케이션

> PC 화면 위에서 상호작용하는 투명 오버레이 AI 아바타

## 빠른 시작

```bash
# 의존성 설치
npm install

# 개발 실행 (모델 준비 + Vite + Tauri)
npm run tauri dev

# 기본 빌드
npm run tauri build

# macOS 앱 번들 + 모델 스테이징 + 코드사인
npm run build:mac-app

# macOS 배포용 (build:mac-app + notarize)
npm run build:mac-release
```

## 현재 구현 요약 (최신)

### 음성 파이프라인
- STT: `Whisper(whisper-cli)` 단일 경로
- STT 모델: `base`, `small`, `medium`
- TTS: `Supertonic` 단일 경로
- TTS 음성: `F1~F5`, `M1~M5`
- 프런트 녹음(`16kHz mono WAV`) → Tauri `transcribe_audio` → `whisper-cli`
- 원격 세션 감지 시 음성 인식 차단 (텍스트 입력은 사용 가능)

### 아바타/UI
- 기본 VRM 비동봉: 설치 후 첫 실행 시 VRM 파일 선택 필요
- 옵션 패널에서 VRM 파일 변경 가능
- 기능 버튼/옵션 버튼 우하단 고정
- 아바타 마우스 선택/드래그 이동/회전 지원
- 말풍선 위치를 아바타 상단 기준으로 동적 계산
- 클릭스루 + 인터랙티브 영역 보호(버튼/아바타/설정 패널)

### 배포 안정화
- macOS 권한 키 반영: `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`
- 단일 인스턴스 강제(`tauri-plugin-single-instance`)
- 배포 앱에 Whisper/Supertonic 모델 + Whisper 런타임(`whisper-cli`, dylib) 스테이징
- 실행 시 의존성 상태 점검 및 설치 안내 모달 제공

## 문서 목차

| 문서 | 설명 |
|------|------|
| [아키텍처](docs/architecture.md) | 시스템 구조와 데이터 흐름 |
| [기술 스택](docs/tech-stack.md) | 최신 의존성과 역할 |
| [프로젝트 구조](docs/project-structure.md) | 디렉터리/핵심 파일 맵 |
| [AI 서비스](docs/ai-services.md) | LLM 라우팅, Vision 분석 |
| [음성 서비스](docs/voice-services.md) | Whisper/Supertonic 구현 상세 |
| [아바타 시스템](docs/avatar-system.md) | VRM 로딩, 이동/회전, 상호작용 |
| [설정 시스템](docs/settings-system.md) | Zustand 설정/마이그레이션 |
| [Tauri 백엔드](docs/tauri-backend.md) | Rust 명령/권한/단일 인스턴스 |
| [개발 가이드](docs/development-guide.md) | 기능 추가/디버깅 체크리스트 |
| [배포](docs/deployment.md) | macOS 빌드/서명/노타라이즈 |

### 해결된 이슈

| 이슈 | 설명 |
|------|------|
| [#001 VRM 색상 문제](docs/issues/001-vrm-color-issue.md) | VRM 렌더 색상 왜곡 해결 |
| [#002 VRM 눈동자 문제](docs/issues/002-vrm-eye-rendering-issue.md) | 눈동자 렌더 순서 이슈 해결 |
| [#003 VoiceSettings 렌더링 오류](docs/issues/003-voicesettings-render-error.md) | persisted 설정 불일치 해결 |
| [#004 Supertonic ONNX 로딩 문제](docs/issues/004-supertonic-onnx-vite-issue.md) | Vite/onnxruntime 충돌 대응 |
| [#005 마이크 권한 요청](docs/issues/005-microphone-permission.md) | macOS 권한 요청/설정 이동 |
| [#006 Supertonic 모델 버전 불일치](docs/issues/006-supertonic-model-version-mismatch.md) | TTS 품질 문제 해결 |
| [#007 음성/아바타/UI 통합 안정화](docs/issues/007-voice-avatar-ui-stability.md) | STT 단일화/원격 차단/UI 안정화 |

## 프로젝트 구조 요약

```text
MyPartnerAI/
├── src/
│   ├── components/
│   │   ├── avatar/
│   │   ├── settings/
│   │   └── ui/
│   ├── hooks/
│   ├── services/
│   │   ├── ai/
│   │   ├── voice/
│   │   └── tauri/
│   └── stores/
├── src-tauri/
│   ├── src/commands/
│   └── capabilities/
├── models/
│   ├── whisper/
│   └── supertonic/
├── scripts/
└── docs/
```

## 주요 명령어

```bash
npm run dev                 # 프런트 개발 서버 (모델 준비 포함)
npm run build               # 프런트 프로덕션 빌드
npm run tauri dev           # Tauri 개발 모드
npm run tauri build         # 기본 Tauri 빌드
npm run build:mac-app       # macOS 앱 빌드 + 모델 스테이징 + 코드사인
npm run build:mac-release   # macOS 배포(노타라이즈 포함)
npx tsc --noEmit            # 타입 체크
```

## 환경 변수

```env
# LLM
VITE_ANTHROPIC_API_KEY=
VITE_OPENAI_API_KEY=
VITE_GOOGLE_API_KEY=
VITE_OLLAMA_ENDPOINT=http://localhost:11434

# 모델 번들링/준비
WHISPER_BUNDLE_MODELS=base,small,medium
PREPARE_DOWNLOAD_WHISPER=1
PREPARE_PUBLIC_MODELS=1
PREPARE_VRM=0

# 코드사인/노타라이즈
APPLE_CODESIGN_IDENTITY=
APPLE_NOTARY_PROFILE=
# 또는
APPLE_ID=
APPLE_TEAM_ID=
APPLE_APP_PASSWORD=
```

## 라이선스

프로젝트 주요 의존성은 상업적 사용 가능한 라이선스(MIT/Apache-2.0) 기반입니다.
