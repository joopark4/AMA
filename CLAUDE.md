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
  - 프로젝트 라이선스 표기(`BSD 2-Clause`)
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
| `settings.audioDevice` | 오디오 디바이스 설정 | `settings.audioDevice.title`, `settings.audioDevice.microphone` |
| `settings.codex` | Codex 연동 설정 | `settings.codex.cliStatus`, `settings.codex.model` |
| `settings.avatar` | 아바타 설정 | `settings.avatar.name`, `settings.avatar.emotions.*` |
| `settings.update` | 앱 업데이트 | `settings.update.checkButton`, `settings.update.checking` |
| `settings.licenses` | 라이선스 정보 | `settings.licenses.title` |
| `dependency` | 의존성 설치 안내 | `dependency.requiredCheck` |
| `status` | 상태 메시지 | `status.idle`, `status.listening` |
| `chat` | 채팅 입력 | `chat.placeholder`, `chat.send` |
| `onboarding` | 초기 설정 | `onboarding.avatarNameTitle` |
| `history` | 대화 기록 | `history.title`, `history.empty` |
| `errors` | 에러 메시지 | `errors.llmConnection` |
| `auth` | 인증/로그인 | `auth.title`, `auth.loginWith` |
| `terms` | 이용약관/개인정보 | `terms.service.title`, `terms.privacy.title` |
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

## 현재 구현 요약 (v1.5.0)

### 음성 파이프라인
- STT: `Whisper(whisper-cli)` 단일 경로
- STT 모델: `base`, `small`, `medium` (온디맨드 다운로드)
- TTS (로컬): `Supertonic` ONNX 기반 로컬 추론, 음성 `F1~F5`, `M1~M5`
- TTS (클라우드): `Supertone API` Edge Function 프록시 기반 (프리미엄)
- TTS 엔진 선택: `supertonic`(기본) / `supertone_api`(프리미엄)
- 클라우드 TTS 실패/할당량 소진 시 로컬 자동 폴백
- 프런트 녹음(`16kHz mono WAV`) → Tauri `transcribe_audio` → `whisper-cli`
- 원격 세션 감지 시 음성 인식 차단 (텍스트 입력은 사용 가능)
- TTS 테스트 버튼: 음성 설정 섹션에 위치 (엔진 + TTS 언어 조합별 네이티브 샘플 문장 재생)
- 오디오 디바이스: 마이크 입력/스피커 출력 독립 선택 + 마이크 피크 미터 + setSinkId 기반 출력 라우팅
- **대화·음성 언어 선택** (`settings.tts.language`, 기본 `auto`): `auto / ko / en / ja / es / pt / fr`
  - `auto`는 앱 UI 언어(`settings.language`)를 그대로 따라감 (텍스트 감지 아님)
  - Supertonic은 ja 미지원 → 런타임에 `en`으로 폴백 + 설정 UI에 경고 표시
  - 프리미엄 TTS UI 드롭다운과 공용 필드 동기화
  - 프리미엄 엔진 전환 시 `voiceId`가 비어있으면 **Bella**를 기본으로 자동 주입

### 대화·음성 언어 계약
- **요구사항**: `settings.language`는 앱 UI 전용, 대화 내용은 `settings.tts.language` 기준. LLM 응답과 TTS 합성이 **같은 언어**를 공유해 발음이 엇갈리지 않도록.
- **결정자**: `resolveResponseLanguage()` (`src/hooks/useConversation.ts`) — 인자 없음. `tts.language`가 auto이면 UI 언어로, 아니면 명시 값으로. Supertonic + 미지원 언어면 `en` 폴백.
- **같은 기준 공유**: `supertonicClient.detectLanguage`와 `supertoneApiClient.synthesize` 모두 동일한 계약으로 합성 언어 결정 → LLM 응답과 엇갈림 방지
- **Layer 0 언어 강제 지시**: `characterProfile.buildCharacterPrompt`가 해당 언어로 "always respond in …" 지시문을 시스템 프롬프트 최상단에 삽입 (ko/en/ja/es/pt/fr)
- 호출부 통일: `useConversation.sendMessage`, `useClaudeCodeChat`, `proactiveEngine`, `screenWatchService`

### 아바타/UI
- 기본 VRM 아바타 바이너리 임베딩: AES-128-GCM 암호화하여 앱 번들에 포함, 첫 실행 시 VRM 선택 불필요
- 옵션 패널에서 VRM 파일 변경 가능
- 기능 버튼/옵션 버튼 우하단 고정 (상태/텍스트/음성/히스토리/설정)
- 아바타 마우스 선택/드래그 이동/회전 지원
- 자유 이동 모드: 화면 어디든 자유 배치, 화면 밖 이동 가능
- 대화 기록 패널: 드래그 이동/리사이즈/글자 크기 조절/투명도 조절(20~100%) 지원
- 말풍선 위치를 아바타 상단 기준으로 동적 계산 (표시/숨김 토글 가능)
- 클릭스루 + 인터랙티브 영역 보호(버튼/아바타/설정 패널) + 멀티 모니터 대응
- 모션 클립/제스처/댄스/표정 시스템 + 자동배회(autoRoam) + 대기동작(IdleFidget)
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
- 업데이터 엔드포인트: GitHub Pages (`joopark4.github.io/apps/ama/latest.json`)
- 대상 플랫폼: Apple Silicon (`darwin-aarch64`) only

### 온디맨드 모델 다운로드
- `modelDownloadStore` (Zustand): 모델 상태 확인/다운로드/진행도 추적
- Rust 커맨드: `check_model_status`, `download_model`, `get_models_dir`
- 사용자 모델 디렉토리: `~/.mypartnerai/models/`
- Supertonic TTS + Whisper 모델 개별 다운로드
- `ModelDownloadModal`: 첫 실행 시 필수 모델 다운로드 UI
- `VoiceSettings`: 모델별 크기 표시, 미다운로드 모델 선택 시 자동 다운로드

### 인증 시스템
- Supabase OAuth (Google 활성화)
- `ENABLED_PROVIDERS` 상수로 활성화된 provider 중앙 관리
- Mock 모드: `VITE_SUPABASE_*` 환경변수 미설정 시
- `tauri-plugin-deep-link`: `mypartnerai://auth/callback` 콜백 처리
- 약관 동의: TermsModal (이용약관 + 개인정보처리방침)
- 계정 삭제: Supabase Edge Function (`delete-account`)

### 프리미엄 음성 (Supertone API)
- **모듈화**: `src/features/premium-voice/`에 독립 모듈로 응집 (premiumStore/supertoneApiClient/UI)
- 프리미엄 구독 사용자 전용 클라우드 TTS
- 앱 → `edgeFunctionClient` → Supabase Edge Function → Supertone API
- Edge Functions: `supertone-tts` (TTS 프록시), `supertone-voices` (음성 목록), `supertone-usage` (사용량)
- `premiumStore` (Zustand): 프리미엄 상태/음성 목록/할당량/사용량 관리
- `supertoneApiClient`: 텍스트 300자 청크 분할 + WAV 결합 + 할당량 업데이트
- 구독 플랜: free(0) / basic(300크레딧, 5분) / pro(1200크레딧, 20분)
- 할당량 소진 시 로컬 Supertonic 자동 폴백 + 토스트 알림
- 감정 자동 매핑: AI 응답 감정 → Supertone 스타일 자동 변환
- 음성 미리듣기: Rust `fetch_url_bytes` 커맨드로 외부 URL fetch
- DB: `subscription_plans`, `tts_usage`, `subscription_history` + `profiles` 확장

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
  - `server.ts`: 채널 서버 canonical source

### OpenAI Codex 연동
- `codex app-server` JSON-RPC 2.0 통신 (stdio)
- Rust 백엔드(`codex.rs`): 프로세스 spawn + JSON-RPC 요청/응답 + Tauri 이벤트 발행
- TypeScript 클라이언트(`codexClient.ts`): LLMClient 인터페이스 구현, 스트리밍 지원
- 연결 관리: App 레벨 자동 시작/중지 + 턴 직렬화(한 번에 하나의 턴만)
- 시스템 프롬프트 변경 감지 → 새 스레드 자동 생성
- 모델/추론 성능(reasoningEffort) 선택 UI
- Vision: `LocalImageUserInput`로 이미지 파일 경로 전달 (Screen Watch Codex 경로)
- CLI 설치/인증 상태 표시 + 설치/로그인 가이드
- **모듈화**: `src/features/codex/`에 독립 모듈로 응집 (클라이언트/훅/UI/상수)

### Gemini CLI(ACP) 연동 (진행 중, `feature/gemini-cli-integration`)
- `gemini --experimental-acp` 자식 프로세스 + JSON-RPC 2.0 over stdio로 Codex와 동일 패턴
- provider 키: `gemini_cli` (기존 클라우드 `gemini`와 별개)
- 설정: `settings.geminiCli` (`model`/`approvalMode`/`workingDir`/`authMethod`), persist v22
- 현재 상태: **스캐폴딩만 완료** — 타입·기본값·상수·placeholder 클라이언트·UI 드롭다운·i18n·문서
- Rust 백엔드(`gemini_cli.rs`)·실제 `LLMClient` 구현은 후속 커밋. 상세: [docs/ai/gemini-cli-integration.md](docs/ai/gemini-cli-integration.md)

### 화면 관찰 (Screen Watch, v1.5.0)
- 주기적 화면 캡처 + Vision LLM 분석으로 아바타가 능동 발화
- Provider: Claude / OpenAI / Gemini / Codex (Ollama·LocalAI·Claude Code·비macOS 제외)
- 캡처 대상: fullscreen / main-monitor / specific-monitor / active-window / specific-window
- 2단 필터: Rust 픽셀 diff(비용 0) + LLM `[SKIP]` 규칙
- OS 권한 preflight: `CGPreflightScreenCaptureAccess` FFI
- 창 목록: CoreGraphics `CGWindowListCopyWindowInfo` (Accessibility 불필요)
- 파일 저장: `~/.mypartnerai/screenshots/screen_watch.jpg` (finally 즉시 삭제)
- **모듈화**: `src/features/screen-watch/` (service / hook / UI / Rust commands)

### 자연 상호작용 v2 (v1.5.0)
- **VAD 연속 감정**: 8종 이산 Emotion → `{v,a,d}` 3D 잠재 공간 + 턴당 lerp 전이 (`conversationStore.moodVec`)
- **Presence + Inner-Thought**: DOM 이벤트 기반 multi-signal presence tracker + urgency 가중합 + 2-stage LLM (`src/services/presence/`)
- **Gaze follow**: Rust 커서 polling → VRM `lookAt.target` + head/neck additive 회전 (range map 제한 보완)
- **Backchannel nod**: `status === 'listening'` 동안 head bone에 직접 sine 기반 double bob
- 기반: Phase 0~5 (캐릭터 프로필 / 스트리밍 TTS / 메모리 / 자발 대화 / 컨텍스트 / 감정 연속성)

### 아바타 크기 조절 (v1.5.0)
- `settings.avatar.scale` → `camera.zoom` 으로 반영 (group scale 제거)
- SpringBone이 parent group scale과 center-space 캐시 간 불일치로 hair/cloth를 위로 띄우던 버그 회피
- 월드에서 아바타는 항상 1.0 사이즈, 시각 크기는 projection 경유

### 설정 패널 구성
1. **UserProfile** — 계정 정보 (OAuth)
2. **Language** — 한국어/영어/일본어 선택 (앱 UI 전용)
3. **LLMSettings** — AI 모델 Provider/Model/API Key/Endpoint (Channels ON 시 잠금)
4. **AudioDeviceSettings** — 마이크 입력/스피커 출력 디바이스 선택 + 마이크 피크 미터
5. **VoiceSettings** — STT 엔진/모델 선택 + TTS 음성 선택 + **TTS 출력 언어 Pill 리스트** + TTS 테스트 + 글로벌 단축키
6. **PremiumVoiceSettings** — TTS 엔진 선택 + Supertone API 음성/모델/스타일/사용량 + 관리자 API 크레딧 대시보드 (엔진 전환 시 Bella 기본 자동 주입)
7. **AvatarSettings** — VRM/표정/초기 시선/자유 이동/말풍선/애니메이션/물리/조명
8. **CodexSettings** — Codex CLI 상태/연결/모델/추론 성능 (LLMSettings 내 Codex 선택 시 표시)
9. **ScreenWatchSettings** — 화면 관찰 토글 / 캡처 대상(5종) / 관찰 간격 / 응답 스타일 / 조용한 시간 / 권한 요청 (v1.5.0)
10. **MCPSettings** — Claude Code Channels 연동 (토글/등록/연결확인 + 복사 가능한 실행 명령어 UI)
11. **UpdateSettings** — 현재 버전 표시 + 업데이트 확인/다운로드/재시작
12. **LicensesSettings** — 오픈소스/모델 라이선스

**공통 동작**
- 각 섹션은 `SettingsSection.tsx` 공통 접을 수 있는 카드 UI 사용
- **섹션 펼침 상태는 `settings.settingsPanelExpanded`(Record<string, boolean>)로 persist** — 첫 실행 시 모든 섹션 접힘, 사용자가 연 섹션만 다음 실행에 재현
- 패널 최대 너비 800px (최대 2컬럼 CSS columns 레이아웃) — 좁은 화면에선 1컬럼

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

## 문서 목차

| 문서 | 설명 |
|------|------|
| [아키텍처](docs/fundamentals/architecture.md) | 시스템 구조와 데이터 흐름 |
| [기능 명세서](docs/features/feature-spec.md) | 전체 기능 명세 |
| [기술 스택](docs/fundamentals/tech-stack.md) | 최신 의존성과 역할 |
| [프로젝트 구조](docs/fundamentals/project-structure.md) | 디렉터리/핵심 파일 맵 |
| [AI 서비스](docs/ai/ai-services.md) | LLM 라우팅, Vision 분석 |
| [Codex 연동](docs/ai/codex-integration.md) | OpenAI Codex CLI 연동 (JSON-RPC, 작업폴더, 접근권한) |
| [자연 상호작용 v2](docs/ai/natural-interaction-v2-plan.md) | VAD 감정 / Presence 트리거 / Gaze / Backchannel (v1.5.0) |
| [화면 관찰](docs/features/screen-watch.md) | Vision LLM 주기 관찰 + 능동 발화 (v1.5.0) |
| [음성 서비스](docs/voice/voice-services.md) | Whisper/Supertonic 구현 상세 |
| [아바타 시스템](docs/avatar/avatar-system.md) | VRM 로딩, 이동/회전, 상호작용 |
| [설정 시스템](docs/settings/settings-system.md) | Zustand 설정/마이그레이션 |
| [Tauri 백엔드](docs/infrastructure/tauri-backend.md) | Rust 명령/권한/단일 인스턴스 |
| [개발 가이드](docs/fundamentals/development-guide.md) | 기능 추가/디버깅 체크리스트 |
| [에셋 라이선스](docs/fundamentals/asset-licensing-guide.md) | Mixamo/VRM/모델 라이선스 및 배포 체크리스트 |
| [배포](docs/infrastructure/deployment.md) | macOS 빌드/서명/노타라이즈 |
| [인증](docs/auth/auth-supabase.md) | Supabase OAuth 연동 |
| [DB 스키마](docs/infrastructure/db-schema.md) | DB 테이블, RLS, 데이터 정책 |
| [회원 관리](docs/auth/member-management.md) | 가입/약관/탈퇴 흐름 |
| [Channels](docs/channels/channels-mcp.md) | Claude Code Channels 연동 |

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
| [#008 클릭스루 상단 차단](docs/issues/008-clickthrough-upper-blocked-area.md) | 클릭스루 상단 영역 차단 해결 |
| [#009 클라우드 모델 목록 동기화](docs/issues/009-cloud-model-list-sync.md) | LLM 모델 목록 동기화 |
| [#010 Supertonic 다국어 업데이트](docs/issues/010-supertonic-model-multilingual-update.md) | TTS v1.6.0 다국어 업데이트 |
| [#011 업데이터 리소스 포크](docs/issues/011-updater-resource-fork.md) | tar.gz 리소스 포크로 업데이트 설치 실패 |
| [#012 Edge Function JWT 인증](docs/issues/012-edge-function-jwt-auth.md) | Edge Function JWT 인증 실패 |
| [#013 WebView 외부 오디오](docs/issues/013-tauri-webview-external-audio.md) | Tauri WebView 외부 오디오 재생 차단 |
| [#014 OAuth 콜백 + 세션 복원](docs/issues/014-dev-oauth-and-session-restore.md) | 개발 모드 OAuth 콜백 + 세션 복원 안정화 |
| [#015 프리미엄 TTS 폴백](docs/issues/015-premium-tts-fallback-to-local.md) | 프리미엄 TTS 기본 음성 폴백 |
| [#016 Channels 포트 충돌](docs/issues/016-channels-port-conflict.md) | Channels 포트 충돌로 응답 멈춤 |
| [#017 배포 앱 Channels 이슈](docs/issues/017-deploy-app-channels-issues.md) | 배포 앱 Channels 6건 통합 해결 |
| [#018 오디오 출력 디바이스 라우팅](docs/issues/018-audio-output-device-routing.md) | WKWebView setSinkId 제스처 제약 해결 |
| [#019 TTS 출력 디바이스 제스처](docs/issues/019-tts-output-device-gesture.md) | 테스트 버튼에서 TTS용 Audio 동시 생성으로 해결 |

## 프로젝트 구조 요약

```text
AMA/
├── src/
│   ├── components/
│   │   ├── auth/          # AuthScreen, TermsModal, UserProfile
│   │   ├── avatar/        # AvatarCanvas, VRMAvatar, 14개 컨트롤러
│   │   ├── settings/      # LLM/Voice/Premium/Avatar/Monitor/Update/Licenses + SettingsSection
│   │   └── ui/            # SettingsPanel, AboutModal, StatusIndicator, HistoryPanel 등
│   ├── features/
│   │   ├── channels/      # Claude Code Channels 독립 모듈 (클라이언트/훅/UI/상수)
│   │   ├── codex/         # OpenAI Codex 연동 모듈 (codexClient/useCodexConnection/CodexSettings)
│   │   └── premium-voice/ # 프리미엄 음성 모듈 (premiumStore/supertoneApiClient/UI)
│   ├── hooks/             # useAutoUpdate, useConversation, useVRM 등
│   ├── services/
│   │   ├── ai/            # llmRouter, claude/openai/gemini/ollama/codex 클라이언트
│   │   ├── audio/         # rhythmAnalyzer (댄스용)
│   │   ├── auth/          # authService, oauthClient, supabaseClient, edgeFunctionClient
│   │   ├── avatar/        # motionLibrary, motionSelector, motionNarration
│   │   ├── voice/         # supertonicClient, ttsRouter, audioProcessor
│   │   └── tauri/         # permissions, globalShortcutUtils, windowManager
│   ├── stores/            # settingsStore, authStore, aboutStore, modelDownloadStore, monitorStore 등
│   └── i18n/              # ko.json, en.json, ja.json
├── src-tauri/
│   ├── src/
│   │   ├── main.rs        # 앱 엔트리 + macOS 네이티브 메뉴바
│   │   └── commands/      # window, voice, settings, auth, models, screenshot, http, mcp, vrm, codex
│   └── capabilities/      # Tauri 권한 설정
├── claude-plugin/
│   └── ama-bridge/        # Claude Code 공식 플러그인 구조 (.claude-plugin/ + server.ts)
├── models/
│   ├── whisper/           # Whisper STT 모델
│   └── supertonic/        # Supertonic TTS 모델
├── motions/clean/         # 모션 클립/카탈로그
├── scripts/               # release-local, prepare-assets, stage/sign/notarize
├── docs/                  # 프로젝트 문서
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
| `settingsStore` | 전역 설정 (LLM/STT/TTS/아바타/UI/패널 펼침), persist (version 21) |
| `authStore` | OAuth 사용자/토큰/약관 동의, persist |
| `conversationStore` | 대화 기록/상태, persist |
| `avatarStore` | VRM 제어 상태 (위치/애니메이션) |
| `appStatusStore` | 앱 실행 상태 |
| `premiumStore` | 프리미엄 상태/Supertone 음성목록/할당량/사용량 (`features/premium-voice/`) |
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
# Supabase (OAuth)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

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

# 코드사인/노타라이즈
APPLE_CODESIGN_IDENTITY=
APPLE_NOTARY_PROFILE=
# 또는
APPLE_ID=
APPLE_TEAM_ID=
APPLE_APP_PASSWORD=

# 업데이터 서명
TAURI_SIGNING_PRIVATE_KEY=
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=
```

## 라이선스

프로젝트 라이선스: `BSD 2-Clause`. 주요 의존성은 상업적 사용 가능한 라이선스(MIT/Apache-2.0) 기반입니다.
