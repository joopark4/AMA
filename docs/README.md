# 문서 목차

### fundamentals/ — 기초

| 문서 | 설명 | 최종 수정 |
|------|------|----------|
| [architecture.md](./fundamentals/architecture.md) | 시스템 구조와 데이터 흐름 | 2026.02.26 |
| [project-structure.md](./fundamentals/project-structure.md) | 디렉터리/핵심 파일 맵 | 2026.02.27 |
| [tech-stack.md](./fundamentals/tech-stack.md) | 최신 의존성과 역할 | 2026.02.26 |
| [development-guide.md](./fundamentals/development-guide.md) | 기능 추가/디버깅 체크리스트 | 2026.02.26 |

### features/ — 기능 명세

| 문서 | 설명 | 최종 수정 |
|------|------|----------|
| [feature-spec.md](./features/feature-spec.md) | 전체 기능 명세서 + 정책 | 2026.02.27 |

### auth/ — 인증/회원

| 문서 | 설명 | 최종 수정 |
|------|------|----------|
| [auth-supabase.md](./auth/auth-supabase.md) | Supabase OAuth 연동, 환경변수, 트러블슈팅 | 2026.02.23 |
| [member-management.md](./auth/member-management.md) | 가입 흐름, 약관 동의, 계정 탈퇴, Edge Function | 2026.02.23 |
| [admin-management.md](./auth/admin-management.md) | 관리자 계정 관리, Edge Function 권한 우회 | 2026.03.21 |

### voice/ — 음성 시스템

| 문서 | 설명 | 최종 수정 |
|------|------|----------|
| [voice-services.md](./voice/voice-services.md) | Whisper/Supertonic 구현 상세 | 2026.02.26 |

### avatar/ — 아바타

| 문서 | 설명 | 최종 수정 |
|------|------|----------|
| [avatar-system.md](./avatar/avatar-system.md) | 아바타 시스템 (렌더링/이동/회전/클릭스루) | 2026.02.26 |
| [motion-team-plan.md](./avatar/motion-team-plan.md) | 모션 팀 계획 | — |
| [custom-motion-guide.md](./avatar/custom-motion-guide.md) | Mixamo 커스텀 모션 제작 가이드 (5가지 방법 + AMA 통합) | 2026.03.26 |

### ai/ — AI 서비스

| 문서 | 설명 | 최종 수정 |
|------|------|----------|
| [ai-services.md](./ai/ai-services.md) | LLM 라우팅, Vision 분석 | 2026.02.26 |
| [codex-integration.md](./ai/codex-integration.md) | OpenAI Codex CLI 연동 (JSON-RPC, 작업폴더, 접근권한) | 2026.04.07 |
| [natural-interaction-plan.md](./ai/natural-interaction-plan.md) | Neuro-sama 스타일 자연 상호작용 구현 플랜 (Phase 0~5) | 2026.04.07 |

### settings/ — 설정

| 문서 | 설명 | 최종 수정 |
|------|------|----------|
| [settings-system.md](./settings/settings-system.md) | 설정 시스템 (Zustand/마이그레이션) | 2026.02.26 |

### channels/ — Claude Code Channels

| 문서 | 설명 | 최종 수정 |
|------|------|----------|
| [channels-mcp.md](./channels/channels-mcp.md) | Claude Code Channels — 아바타 ↔ Claude Code 연동 | 2026.03.21 |
| [claude-code-channels-reference.md](./channels/claude-code-channels-reference.md) | Claude Code Channels 공식 스펙 레퍼런스 | 2026.03.20 |

### infrastructure/ — Tauri/배포/DB

| 문서 | 설명 | 최종 수정 |
|------|------|----------|
| [tauri-backend.md](./infrastructure/tauri-backend.md) | Rust 명령/권한/단일 인스턴스 | 2026.02.26 |
| [db-schema.md](./infrastructure/db-schema.md) | DB 테이블 구조, RLS 정책, 데이터 저장 정책 | 2026.02.23 |
| [deployment.md](./infrastructure/deployment.md) | macOS 빌드/서명/노타라이즈/릴리즈 파이프라인 | 2026.02.27 |

### 해결된 이슈

| 이슈 | 설명 | 해결일 |
|------|------|--------|
| [#001](./issues/001-vrm-color-issue.md) | VRM 렌더 색상 왜곡 | — |
| [#002](./issues/002-vrm-eye-rendering-issue.md) | 눈동자 렌더 순서 이슈 | — |
| [#003](./issues/003-voicesettings-render-error.md) | persisted 설정 불일치 | — |
| [#004](./issues/004-supertonic-onnx-vite-issue.md) | Vite/onnxruntime 충돌 | — |
| [#005](./issues/005-microphone-permission.md) | macOS 권한 요청 | — |
| [#006](./issues/006-supertonic-model-version-mismatch.md) | TTS 품질 문제 | — |
| [#007](./issues/007-voice-avatar-ui-stability.md) | STT 단일화/원격 차단/UI 안정화 | — |
| [#008](./issues/008-clickthrough-upper-blocked-area.md) | 클릭스루 상단 영역 차단 | — |
| [#009](./issues/009-cloud-model-list-sync.md) | LLM 모델 목록 동기화 | — |
| [#010](./issues/010-supertonic-model-multilingual-update.md) | TTS v1.6.0 다국어 업데이트 | — |
| [#011](./issues/011-updater-resource-fork.md) | 업데이터 tar.gz 리소스 포크 | 2026.02.27 |
| [#012](./issues/012-edge-function-jwt-auth.md) | Edge Function JWT 인증 실패 | 2026.02.28 |
| [#013](./issues/013-tauri-webview-external-audio.md) | Tauri WebView 외부 오디오 재생 차단 | 2026.02.28 |
| [#014](./issues/014-dev-oauth-and-session-restore.md) | 개발 모드 OAuth 콜백 + 세션 복원 안정화 | — |
| [#015](./issues/015-premium-tts-fallback-to-local.md) | 프리미엄 TTS 기본 음성 폴백 (3가지 복합 원인) | 2026.03.21 |
| [#016](./issues/016-channels-port-conflict.md) | Channels 포트 충돌로 응답 멈춤 | 2026.03.21 |
| [#017](./issues/017-deploy-app-channels-issues.md) | 배포 앱 Channels 6건 통합 해결 | 2026.03.25 |
| [#018](./issues/018-audio-output-device-routing.md) | WKWebView setSinkId 제스처 제약 해결 | 2026.03.31 |
| [#019](./issues/019-tts-output-device-gesture.md) | TTS 출력 디바이스 제스처 제약 해결 | 2026.03.31 |

---

## v1.0.0 작업 이력 (2026.04)

- OpenAI Codex CLI 직접 연동 (`codex app-server` JSON-RPC 2.0)
- Codex 작업 폴더 설정 (기본값 ~/Documents, 네이티브 폴더 선택 다이얼로그)
- Codex 접근 권한 설정 (approvalPolicy + sandboxPolicy 매핑)
- TTS 중복 재생 방지 (새 응답 수신 시 이전 TTS 자동 중단)
- 오디오 입/출력 디바이스 독립 선택 + 마이크 피크 미터
- 대화기록창 투명도 조절 (20~100%)
- 관리자 전용 API 크레딧 대시보드
- Channels 레거시 경로 정리 + 항상 재등록
- TTS 출력 디바이스 라우팅 안정화 (#018, #019)
- idle 흔들림 완화 (hips damp + IdleFidget 조건 수정)
- build.rs 안정화 (런타임 파싱 + 릴리스 VRM 검증)

---

## v0.8.0 작업 이력 (2026.03.21)

- main → develop 기능 통합 (About 모달, 멀티모니터 보정, ORT import, capabilities 보안 강화)
- 기본 VRM 아바타 바이너리 임베딩 파이프라인 (AES-128-GCM 암호화)
- 프리미엄 음성 모듈화 (`src/features/premium-voice/`)
- About 모달 분리 (`aboutStore` + `useMenuListeners` 훅)
- Channels 포트 충돌 해결 + 응답 타임아웃 추가 (#016)
- Claude Code 플러그인 구조 준비 (`claude-plugin/ama-bridge/`) — 공식 마켓플레이스 제출용
- TTS 테스트 위치 변경 (아바타 설정 → 음성 설정)
- 일본어 (ja) 지원 추가 (ko/en/ja 359키 일치)
- 모델/데이터 폴더 Finder 열기 (`open_folder_in_finder` Rust 커맨드)
- MCPSettings UX 개선 (복사 가능한 터미널 명령어 블록)
- 코드 리뷰 P2 수정 (AES 키 통합, barrel export, static import 통일)
- docs 폴더 기능별 재구성 (9개 하위 폴더)

---

## 배포 이력

### v0.4.2 (2026.02.27)

- 업데이터 tar.gz 리소스 포크(`._*`) 제거 + 검증 추가
- `latest.json`에서 `darwin-x86_64` 엔트리 제거 (Apple Silicon only 정책)
- `release-local.mjs` URL 하드코딩 제거, npm 스크립트 등록, 버전 자동 동기화

### v0.4.1 (2026.02.27)

- 서명 키 갱신 후 업데이터 배포
- 업데이터 설치 실패 발견 (리소스 포크 이슈 → v0.4.2에서 수정)

### v0.4.0 (2026.02.26)

- 프로덕션 빌드 안정화 + 첫 설치 TTS/STT 즉시 작동
- 커스텀 About 모달 (네이티브 About 다이얼로그 교체)
- 자동 업데이트 시스템 (tauri-plugin-updater)
- 설정 패널 접을 수 있는 카드 UI
- macOS 네이티브 메뉴바
- 자유 이동 모드 + 말풍선 토글
- 클릭스루 멀티 모니터 대응
- 모델 온디맨드 다운로드
- GitHub Pages 기반 업데이터 엔드포인트

---

## 작업 이력

### 2026.03.27 — Mixamo FBX 모션 시스템 + 자동 배회 + 대기 동작 설정

- 모션 시스템 Mixamo FBX 기반으로 전면 교체 (기존 JSON 클립 25개 삭제 → FBX 20종)
  - `loadMixamoAnimation.ts`: FBX → VRM 본 리타겟팅
  - `locomotionClipManager.ts`: Idle/Walk AnimationMixer 관리
  - `boneUtils.ts`, `mixamoVRMRigMap.ts`, `proceduralGait.ts`: 유틸리티 모듈
- 자동 배회 기능 추가 (`settings.avatar.autoRoam` 토글)
  - 감정별 걷기 스타일 자동 선택 (stroll/brisk/sneak/bouncy)
  - 순환 액션 큐 (walk/gesture/jump/idle)
  - 자유 이동 모드와 상호 배타
- 대기 동작 설정 연결 (`IdleFidgetController`)
  - `enableBreathing`: 호흡 애니메이션 ON/OFF
  - `enableEyeDrift`: 시선 미세 이동 ON/OFF
- 모션 시퀀스 데모 제거 (MotionSequenceDemoController, MotionDemoSequence 삭제)
- 설정 persist 버전 13 → 14

### 2026.03.21 — Claude Code Channels + 관리자 관리 + 프리미엄 TTS 수정

- Claude Code Channels 구현 (외부 Claude Code 세션 ↔ AMA 아바타 양방향 연동)
  - `ama-bridge` 채널 서버 (Claude Code Channels 공식 스펙 준수)
  - `ci-webhook`, `monitor-alert` 일방향 채널
  - AMA Tauri axum HTTP 리스너 (127.0.0.1:8791)
  - `claude_code` LLM 프로바이더 추가
  - 설정 UI: Claude Code Channels 토글 ON/OFF (AI 모델 자동 전환/복원, LLM 잠금)
  - 글로벌 등록: `~/.claude.json` user scope + AMA 설정 버튼으로 자동 등록
  - dev-bridge 연결 확인 (Rust CORS 우회)
- 관리자 계정 관리
  - Edge Function `supertone-tts`에 `is_admin` 체크 추가 (프리미엄/할당량 우회)
  - `jooparkhappy4@gmail.com` 스태프 계정 등록
- 프리미엄 TTS 기본 음성 폴백 이슈 수정 (#015)
  - `VoiceSettings.tsx` useEffect 엔진 리셋 버그 수정
  - Edge Function `--no-verify-jwt` 재배포
  - TTS 상태 표시 UI 추가 (Supertonic 녹색 / Supertone API 보라색)

### 2026.02.27 — 릴리즈 파이프라인 안정화 + 업데이터 수정

- 업데이터 tar.gz 리소스 포크(`._*`) 이슈 해결 (`COPYFILE_DISABLE=1` + 검증)
- `release-local.mjs` 코드 리뷰 반영: URL 상수 추출, npm 스크립트 등록, 버전 자동 동기화
- `latest.json`에서 `darwin-x86_64` 제거 (Apple Silicon only)
- 이슈 문서 #011 작성
- `deployment.md` 트러블슈팅/체크리스트 갱신

### 2026.02.26 — 자유 이동 모드 + 말풍선 토글 + 클릭스루 멀티 모니터 대응

- 아바타 자유 이동 모드 추가 (`freeMovement` 토글): 화면 어디든 자유롭게 배치, 화면 밖 이동 가능
- 말풍선 표시/숨김 토글 추가 (`showSpeechBubble`): AI 응답 말풍선 조건부 렌더링
- 클릭스루 멀티 모니터 대응: Rust 백엔드에서 윈도우-로컬 좌표 직접 계산
- NSEvent 메인 스레드 실행으로 macOS 커서 추적 안정화
- 아바타 히트박스를 3D AABB 기반 몸통 영역으로 축소 (55% 너비, 85% 높이)
- 설정 persist 버전 11 → 12

### 2026.02.25 — 설정 패널 개선 + 모델 온디맨드 다운로드

- Whisper 모델 선택 UI 개선: 모델별 크기 표시, 미다운로드 모델 선택 시 자동 다운로드
- 다운로드 프로그레스 바 추가 (바이트 기반 퍼센트)
- `modelDownloadStore` 에러 처리 보강 (`checkModelStatus` 실패 시 error 상태 저장)
- `VoiceSettings` 마운트 시 모델 상태 자동 체크 추가
- `useAutoUpdate` 훅 → Zustand 스토어 전환 (여러 컴포넌트 간 상태 공유)
- `UpdateSettings` 컴포넌트 신규 생성 (설정 패널 내 앱 업데이트 확인/설치)
- i18n 키 추가: `settings.update.*` (ko/en 각 6개)

### 2026.02.23 — Supabase 실제 연동 완료

- `.env` 파일 생성 (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
- Supabase CLI로 DB 마이그레이션 push 및 Edge Function 배포 확인
- `mypartnerai://auth/callback` redirect URL 허용 목록 등록 (Management API)
- 실제 Google 계정으로 로그인 → 계정 삭제 전체 플로우 연결 완료
- `@tauri-apps/api` v2.9.1 → v2.10.1 버전 맞춤 업데이트

### 2026.02 — Supabase OAuth + 회원 관리 기반 구축

- Supabase OAuth 연동 완료 (Google)
- DB 스키마 설계 및 적용: `profiles`, `user_settings`, `user_consents` + RLS
- 신규 가입 자동 프로필 트리거 (`on_auth_user_created`)
- Edge Function `delete-account` 배포
- 약관 동의 UI (이용약관 + 개인정보처리방침 체크박스, 모달)
- 계정 탈퇴 UI (2단계 확인, 클라우드 + 로컬 전체 삭제)
- `ENABLED_PROVIDERS` 상수로 provider 활성화 중앙 관리
- 대화 기록 500개 제한 제거 → 무제한 로컬 저장
- Supabase CLI 설치, Docker 외장 드라이브 마운트 설정
