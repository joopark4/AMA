# AMA - AI 아바타 데스크톱 애플리케이션

> PC 화면 위에서 상호작용하는 투명 오버레이 AI 아바타

## 앱 이름

- **표시 이름: AMA** (2026-02-25부터 MyPartnerAI → AMA로 변경)
- 내부 패키지명(npm): `mypartnerai` (유지)
- Bundle ID: `com.mypartnerai` (유지)
- URL scheme: `mypartnerai://` (유지)
- macOS 메뉴바/타이틀바: `AMA`

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

## README.md 작성 기준

- 목적: GitHub 방문 사용자가 바로 실행/사용할 수 있도록 **사용자 가이드 중심**으로 작성
- 언어 정책:
  - `README.md`: 한국어 메인
  - `README.en.md`: 영어 버전
  - 두 문서 상단에 상호 링크 유지
- 반드시 포함할 내용:
  - 핵심 동작 요약(아바타/입력 버튼/STT/TTS)
  - 요구사항, 개발 실행, 기본 빌드 방법
  - 최초 실행 흐름(VRM 선택, 설정 진입)
  - AI 설정 방법(Ollama, Gemini, OpenAI, Claude, LocalAI)
  - 테스트 사양(검증된 하드웨어)
  - 사용 AI/모델의 라이선스와 공식 링크
  - 프로젝트 라이선스 표기(`MIT`)
- 작성 스타일:
  - 내부 구현 세부보다 사용자 행동 기준(무엇을 눌러서 어떻게 쓰는지)으로 설명
  - 명령어는 복사-실행 가능한 형태로 유지
  - 과장/마케팅 문구보다 실제 동작과 제한사항을 명확히 기재
- 제외 원칙:
  - 배포 서명/노타라이즈 등 내부 배포 절차는 README 기본 문서에서 제외
  - 팀 내부 운영 문서/민감 정보는 README에 포함하지 않음

## 지역화 (i18n)

### 라이브러리

- `i18next` ^24.2.0 + `react-i18next` ^15.2.0

### 지원 언어

| 코드 | 언어 | 파일 |
|------|------|------|
| `ko` | 한국어 (기본/폴백) | `src/i18n/ko.json` |
| `en` | 영어 | `src/i18n/en.json` |
| `ja` | 일본어 | `src/i18n/ja.json` |

### 언어 초기화 흐름

1. `src/i18n/index.ts`의 `getInitialLanguage()`가 localStorage에서 저장된 언어 확인
2. 없으면 `detectSystemLanguage()`로 `navigator.language` 기반 자동 감지 (영어계 → `en`, 그 외 → `ko`)
3. `App.tsx`에서 `settings.language` 변경 시 `i18n.changeLanguage()` 자동 동기화
4. 언어 선택은 Zustand persist(`mypartnerai-settings`)로 localStorage 저장

### 번역 키 네이밍 규칙

계층 구조: `[카테고리].[섹션].[항목]`

| 카테고리 | 용도 | 예시 |
|---------|------|------|
| `app` | 앱 기본 텍스트 | `app.title`, `app.loading` |
| `settings` | 설정 패널 | `settings.llm.title`, `settings.language` |
| `settings.llm` | AI 모델 설정 | `settings.llm.provider`, `settings.llm.apiKey` |
| `settings.voice` | STT/TTS 설정 | `settings.voice.stt.title` |
| `settings.avatar` | 아바타 설정 | `settings.avatar.name`, `settings.avatar.emotions.*` |
| `settings.update` | 앱 업데이트 | `settings.update.checkButton`, `settings.update.checking` |
| `settings.licenses` | 라이선스 정보 | `settings.licenses.title` |
| `dependency` | 의존성 설치 안내 | `dependency.requiredCheck` |
| `status` | 상태 메시지 | `status.idle`, `status.listening` |
| `chat` | 채팅 입력 | `chat.placeholder`, `chat.send` |
| `onboarding` | 초기 설정 | `onboarding.avatarNameTitle` |
| `history` | 대화 기록 | `history.title`, `history.empty` |
| `errors` | 에러 메시지 | `errors.llmConnection` |
| `avatar` | 아바타 캔버스 UI | `avatar.selectVrm.title`, `avatar.loading` |
| `update` | 업데이트 알림 | `update.available`, `update.downloading` |
| `modelDownload` | 모델 다운로드 | `modelDownload.title`, `modelDownload.ready` |
| `lightingControl` | 조명 제어 | `lightingControl.dragHint` |
| `about` | 앱 정보 모달 | `about.title`, `about.version` |

### 신규 번역 키 추가 방법

1. `src/i18n/ko.json`, `src/i18n/en.json`, `src/i18n/ja.json` 세 파일에 **같은 키**를 동시에 추가
2. 동적 값은 `{{변수명}}` 보간 사용: `"error": "실패: {{error}}"`
3. 컴포넌트에서 `useTranslation()` 훅으로 `t('키')` 호출
4. 번역 키 누락 시 폴백 언어(`ko`)로 자동 대체

```typescript
// 컴포넌트 사용 예시
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();
// 정적 키
<span>{t('settings.llm.title')}</span>
// 보간 키
<span>{t('errors.localModelFail', { error: err.message })}</span>
```

### 주의사항

- 하드코딩 문자열 금지: 사용자에게 노출되는 모든 텍스트는 반드시 `t()` 호출로 처리
- ko/en/ja 키 개수 항상 일치 유지
- 새 언어 추가 시: `src/i18n/index.ts` 리소스 등록 + `settingsStore.ts`의 `Language` 타입 확장 + `SettingsPanel.tsx` 드롭다운 옵션 추가

---

## 현재 구현 요약 (v0.8.0)

### 음성 파이프라인
- STT: `Whisper(whisper-cli)` 단일 경로
- STT 모델: `base`, `small`, `medium` (온디맨드 다운로드)
- TTS: `Supertonic` ONNX 기반 로컬 추론, 음성 `F1~F5`, `M1~M5`
- 프런트 녹음(`16kHz mono WAV`) → Tauri `transcribe_audio` → `whisper-cli`
- 원격 세션 감지 시 음성 인식 차단 (텍스트 입력은 사용 가능)
- TTS 테스트 버튼: 음성 설정 섹션에 위치 (아바타 섹션에서 이동)

### 아바타/UI
- VRM 파일은 기본 포함하지 않으며, 첫 실행 시 사용자가 직접 `.vrm` 파일 선택
- 옵션 패널에서 VRM 파일 변경 가능
- 기능 버튼/옵션 버튼 우하단 고정 (상태/텍스트/음성/히스토리/설정)
- 아바타 마우스 선택/드래그 이동/회전 지원
- 자유 이동 모드: 화면 어디든 자유 배치, 화면 밖 이동 가능
- 말풍선 위치를 아바타 상단 기준으로 동적 계산 (표시/숨김 토글 가능)
- 클릭스루 + 인터랙티브 영역 보호(버튼/아바타/설정 패널) + 멀티 모니터 대응
- 모션 클립/제스처/댄스/표정 시스템
- 커스텀 About 모달 (`AboutModal.tsx`) — `aboutStore` + `useMenuListeners` 훅으로 분리
- 모델/데이터 폴더 Finder 열기: Rust `open_folder_in_finder` 커맨드

### macOS 네이티브 메뉴바
- **AMA 메뉴**: About AMA / Check for Updates... / Settings... (Cmd+,) / Hide / Hide Others / Show All / Quit
- **Edit 메뉴**: Undo / Redo / Cut / Copy / Paste / Select All
- **Window 메뉴**: Minimize
- About: 커스텀 MenuItem → `menu-about` 이벤트 → 프론트엔드 AboutModal
- 메뉴 이벤트 → 프론트엔드 `@tauri-apps/api/event` listen으로 처리

### 자동 업데이트
- `tauri-plugin-updater` + `tauri-plugin-process` 기반
- `useAutoUpdateStore` (Zustand): 업데이트 확인 → 다운로드(바이트 누적 프로그레스) → 설치 → 앱 재시작
- `UpdateNotification` (상단 알림) + `UpdateSettings` (설정 패널 섹션)
- macOS 메뉴바 "Check for Updates..."에서도 트리거 가능
- 업데이터 엔드포인트: GitHub Releases (`https://github.com/joopark4/AMA/releases/latest/download/latest.json`)
- 대상 플랫폼: Apple Silicon (`darwin-aarch64`) only

### 온디맨드 모델 다운로드
- `modelDownloadStore` (Zustand): 모델 상태 확인/다운로드/진행도 추적
- Rust 커맨드: `check_model_status`, `download_model`, `get_models_dir`
- 사용자 모델 디렉토리: `~/.mypartnerai/models/`
- Supertonic TTS + Whisper 모델 개별 다운로드
- `ModelDownloadModal`: 첫 실행 시 필수 모델 다운로드 UI
- `VoiceSettings`: 모델별 크기 표시, 미다운로드 모델 선택 시 자동 다운로드

### Claude Code Channels
- 외부 Claude Code 세션과 아바타를 양방향 연결
- `ama-bridge` 채널: 사용자 입력 → Claude Code → 응답 → TTS
- `ci-webhook` / `monitor-alert`: 일방향 알림 → 아바타 음성
- Claude Code Channels 공식 스펙 준수 (`notifications/claude/channel`, `claude/channel` capability)
- 설정 토글 ON 시: 자동 글로벌 등록 + AI 모델 자동 전환 + LLM 설정 잠금
- 설정 토글 OFF 시: 이전 AI 모델 자동 복원
- 리서치 프리뷰: `claude --dangerously-load-development-channels server:ama-bridge` 필요
- **모듈화**: `src/features/channels/`에 독립 모듈로 응집 (클라이언트/훅/UI/상수/유틸)
- **플러그인 구조**: `claude-plugin/ama-bridge/`에 공식 마켓플레이스 제출용 플러그인 준비
  - `.claude-plugin/plugin.json` 메타데이터 + `.mcp.json` 서버 설정
  - `server.ts`: 채널 서버 canonical source (mcp-channels/dev-bridge.mts와 동일 로직)

### 설정 패널 구성
1. **Language** — 한국어/영어/일본어 선택
2. **LLMSettings** — AI 모델 Provider/Model/API Key/Endpoint (Channels ON 시 잠금)
3. **VoiceSettings** — STT 엔진/모델 선택 + TTS 음성 선택 + TTS 테스트 + 글로벌 단축키
4. **AvatarSettings** — VRM/표정/초기 시선/자유 이동/말풍선/애니메이션/물리/조명
5. **MCPSettings** — Claude Code Channels 연동 (토글/등록/연결확인 + 복사 가능한 실행 명령어 UI)
6. **UpdateSettings** — 현재 버전 표시 + 업데이트 확인/다운로드/재시작
7. **LicensesSettings** — 오픈소스/모델 라이선스
- 각 섹션은 `SettingsSection.tsx` 공통 접을 수 있는 카드 UI 사용

### 로컬 배포 파이프라인
- `release-local.mjs`: 8단계 자동화 (pre-check → build → stage → sign → notarize → package → github release → pages)
- `package.json` 기준 `Cargo.toml` + `tauri.conf.json` 버전 자동 동기화
- tar.gz 리소스 포크(`._*`) 자동 검증
- Apple Silicon (`darwin-aarch64`) 단일 플랫폼 지원
- CLI: `npm run release:local`, `--skip-build`, `--skip-notarize`, `--skip-release`, `--skip-pages`, `--dry-run`

### 배포 안정화
- macOS 권한 키 반영: `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`
- 단일 인스턴스 강제(`tauri-plugin-single-instance`)
- 배포 앱에 Whisper/Supertonic 모델 + Whisper 런타임(`whisper-cli`, dylib) 스테이징
- 실행 시 의존성 상태 점검 및 설치 안내 모달 제공
- 코드사인 + 노타라이즈 지원

## 프로젝트 구조 요약

```text
AMA/
├── src/
│   ├── components/
│   │   ├── avatar/        # AvatarCanvas, VRMAvatar, 14개 컨트롤러
│   │   ├── settings/      # LLM/Voice/Avatar/Monitor/Update/Licenses + SettingsSection
│   │   └── ui/            # SettingsPanel, AboutModal, StatusIndicator, HistoryPanel 등
│   ├── features/
│   │   └── channels/      # Claude Code Channels 독립 모듈 (클라이언트/훅/UI/상수)
│   ├── hooks/             # useAutoUpdate, useConversation, useVRM 등
│   ├── services/
│   │   ├── ai/            # llmRouter, claude/openai/gemini/ollama 클라이언트
│   │   ├── audio/         # rhythmAnalyzer (댄스용)
│   │   ├── avatar/        # motionLibrary, motionSelector, motionNarration
│   │   ├── voice/         # supertonicClient, ttsRouter, audioProcessor
│   │   └── tauri/         # permissions, globalShortcutUtils, windowManager
│   ├── stores/            # settingsStore, aboutStore, modelDownloadStore, monitorStore 등
│   └── i18n/              # ko.json, en.json, ja.json
├── src-tauri/
│   ├── src/
│   │   ├── main.rs        # 앱 엔트리 + macOS 네이티브 메뉴바
│   │   └── commands/      # window, voice, settings, models, screenshot, http, mcp, vrm
│   └── capabilities/      # Tauri 권한 설정
├── claude-plugin/
│   └── ama-bridge/        # Claude Code 공식 플러그인 구조 (.claude-plugin/ + server.ts)
├── scripts/               # release-local, prepare-assets, stage/sign/notarize
└── .github/workflows/     # release.yml (GitHub Actions 배포)
```

## Tauri 플러그인

| 플러그인 | 용도 |
|---------|------|
| `tauri-plugin-dialog` | 파일 다이얼로그 |
| `tauri-plugin-fs` | 파일시스템 접근 |
| `tauri-plugin-global-shortcut` | 글로벌 단축키 |
| `tauri-plugin-shell` | 외부 프로세스/URL 열기 |
| `tauri-plugin-single-instance` | 단일 인스턴스 강제 |
| `tauri-plugin-deep-link` | `mypartnerai://` URL 스킴 |
| `tauri-plugin-updater` | 자동 업데이트 |
| `tauri-plugin-process` | 앱 재시작 |

## Zustand 스토어

| 스토어 | 용도 |
|--------|------|
| `settingsStore` | 전역 설정 (LLM/STT/TTS/아바타/UI), persist (version 13) |
| `conversationStore` | 대화 기록/상태, persist |
| `avatarStore` | VRM 제어 상태 (위치/애니메이션) |
| `appStatusStore` | 앱 실행 상태 |
| `modelDownloadStore` | 모델 다운로드 상태/진행도 |
| `monitorStore` | 모니터/디스플레이 상태 |
| `aboutStore` | About 모달 열림/닫힘 상태 |
| `useAutoUpdateStore` | 앱 업데이트 확인/다운로드/설치 상태 |

## 주요 명령어

```bash
npm run dev                 # 프런트 개발 서버 (모델 준비 포함)
npm run build               # 프런트 프로덕션 빌드
npm run tauri dev           # Tauri 개발 모드
npm run tauri build         # 기본 Tauri 빌드
npm run build:mac-app       # macOS 앱 빌드 + 모델 스테이징 + 코드사인
npm run build:mac-release   # macOS 배포(노타라이즈 포함)
npm run release:local       # 통합 배포 파이프라인 (빌드→서명→노타라이즈→패키징→릴리즈)
npx tsc --noEmit            # 타입 체크
```

## 환경 변수

```env
# LLM
VITE_ANTHROPIC_API_KEY=
VITE_OPENAI_API_KEY=
VITE_GOOGLE_API_KEY=
VITE_OLLAMA_ENDPOINT=http://localhost:11434
VITE_LOCALAI_ENDPOINT=http://localhost:8080

# 기본값
VITE_DEFAULT_LLM_PROVIDER=ollama
VITE_DEFAULT_LLM_MODEL=deepseek-v3
VITE_DEFAULT_STT_ENGINE=whisper
VITE_DEFAULT_TTS_ENGINE=kokoro
VITE_DEFAULT_LANGUAGE=ko

# 모델 번들링/준비
WHISPER_BUNDLE_MODELS=base,small,medium
PREPARE_DOWNLOAD_WHISPER=1
PREPARE_PUBLIC_MODELS=1
PREPARE_VRM=0

# 업데이터 서명
TAURI_SIGNING_PRIVATE_KEY=
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=
```

## 라이선스

프로젝트 라이선스: `MIT`. 주요 의존성은 상업적 사용 가능한 라이선스(MIT/Apache-2.0) 기반입니다.
