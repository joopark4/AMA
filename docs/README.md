# 문서 목차

| 문서 | 설명 | 최종 수정 |
|------|------|----------|
| [feature-spec.md](./feature-spec.md) | 전체 기능 명세서 + 정책 | 2026.02.27 |
| [architecture.md](./architecture.md) | 시스템 구조와 데이터 흐름 | 2026.02.26 |
| [project-structure.md](./project-structure.md) | 디렉터리/핵심 파일 맵 | 2026.02.27 |
| [tech-stack.md](./tech-stack.md) | 최신 의존성과 역할 | 2026.02.26 |
| [avatar-system.md](./avatar-system.md) | 아바타 시스템 (렌더링/이동/회전/클릭스루) | 2026.02.26 |
| [ai-services.md](./ai-services.md) | LLM 라우팅, Vision 분석 | 2026.02.26 |
| [voice-services.md](./voice-services.md) | Whisper/Supertonic 구현 상세 | 2026.02.26 |
| [settings-system.md](./settings-system.md) | 설정 시스템 (Zustand/마이그레이션) | 2026.02.26 |
| [tauri-backend.md](./tauri-backend.md) | Rust 명령/권한/단일 인스턴스 | 2026.02.26 |
| [deployment.md](./deployment.md) | macOS 빌드/서명/노타라이즈/릴리즈 파이프라인 | 2026.02.27 |
| [development-guide.md](./development-guide.md) | 기능 추가/디버깅 체크리스트 | 2026.02.26 |
| [auth-supabase.md](./auth-supabase.md) | Supabase OAuth 연동, 환경변수, 트러블슈팅 | 2026.02.23 |
| [db-schema.md](./db-schema.md) | DB 테이블 구조, RLS 정책, 데이터 저장 정책 | 2026.02.23 |
| [member-management.md](./member-management.md) | 가입 흐름, 약관 동의, 계정 탈퇴, Edge Function | 2026.02.23 |

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
