# #017 배포 앱 Channels 관련 이슈 통합

> 배포 앱(DMG 설치)에서 Claude Code Channels 기능 사용 시 발생한 6건의 이슈를 한 문서에 통합

## 이슈 1: 로그아웃 시 프리미엄 음성 상태 미초기화

### 증상
- 로그아웃 했는데 설정 > 음성에 "프리미엄 음성 사용중" 표시가 유지됨

### 원인
- `handleLogout`/`handleDeleteAccount`에서 `premiumStore.reset()` 미호출
- TTS 엔진이 `supertone_api`로 유지되어 프리미엄 상태가 남아 있음

### 해결
- 로그아웃/계정삭제 시 `premiumStore.reset()` 호출
- TTS 엔진을 `supertonic`(로컬)으로 복원

### 수정 파일
- `src/components/auth/UserProfile.tsx`

---

## 이슈 2: Channels 토글 ON 시 bridge 서버 미실행이면 차단

### 증상
- bridge 서버를 먼저 실행하지 않으면 토글 ON 자체가 안 됨

### 원인
- `handleToggleOn`에서 health check 실패 시 `return`하여 토글 차단

### 해결
- health check를 비차단(non-blocking)으로 변경
- 서버가 없어도 토글 ON 허용 (LLM 전환 + 등록은 진행, 상태 표시만 offline)

### 수정 파일
- `src/features/channels/MCPSettings.tsx`

---

## 이슈 3: Channels 연결 확인에서 채널 미활성 표시

### 증상
- bridge 서버 실행 중인데 "채널 미활성"으로 표시됨

### 원인
- `check_bridge_channel` (channel-test)이 Claude Code의 테스트 ping에 자동 응답하지 않아 항상 `false` 반환

### 해결
- "연결 확인" 버튼을 health check만으로 단순화 (channel-test 제거)
- health check 성공이면 `ok`, 실패면 `offline`으로 표시

### 수정 파일
- `src/features/channels/MCPSettings.tsx`

---

## 이슈 4: Channels 클라이언트 응답 타임아웃 3분

### 증상
- 3분 넘는 Claude Code 작업 시 응답 타임아웃 발생

### 원인
- 프론트엔드 `BRIDGE_RESPONSE_TIMEOUT_MS`가 3분(180,000ms)으로 설정
- Rust 사이드 `send_to_bridge`는 24시간(86,400s)으로 설정
- 양측 불일치로 프론트엔드가 먼저 타임아웃

### 해결
- `constants.ts`의 `BRIDGE_RESPONSE_TIMEOUT_MS`를 24시간으로 통일
- `claudeCodeClient.ts`의 에러 메시지에 "(24시간)" 명시

### 수정 파일
- `src/features/channels/constants.ts`
- `src/features/channels/claudeCodeClient.ts`

---

## 이슈 5: 배포 앱에서 Channels bridge 파일 미존재

### 증상
- DMG 설치 앱에서 Channels 토글 ON 시 bridge 파일을 찾을 수 없음
- `register_channel_global`이 `claude-plugin/ama-bridge/` 또는 `mcp-channels/`를 찾지 못해 실패

### 원인
- 배포 앱에는 소스 디렉토리가 없음 (`.app` 번들 내에 프로젝트 소스 미포함)
- `register_channel_global`이 `std::env::current_dir()` 기준으로 소스를 찾는데, 배포 앱의 CWD는 `/` 또는 홈 디렉토리

### 해결

#### 5-1. bridge 플러그인을 Tauri 번들 리소스에 포함
- `src-tauri/tauri.conf.json`의 `bundle.resources`에 `"resources/ama-bridge/": "ama-bridge/"` 추가
- `src-tauri/resources/ama-bridge/`에 bridge 파일 배치 (server.ts, package.json, tsconfig.json, shared/, .claude-plugin/, .mcp.json)

#### 5-2. `setup_bridge_plugin` 커맨드 추가
- 번들 리소스에서 `~/.mypartnerai/ama-bridge/`로 파일 자동 추출
- `/bin/sh -l -c`로 npm install 실행 (macOS 앱 번들 PATH 제한 대응)
- `main.rs`에 커맨드 등록

#### 5-3. `register_channel_global` 배포 환경 폴백
- 소스 디렉토리를 찾지 못하면 `~/.mypartnerai/ama-bridge/`의 기존 파일 사용
- `install_dir`를 `~/.mypartnerai/mcp-channels/` → `~/.mypartnerai/ama-bridge/`로 변경

#### 5-4. `find_node_bin` 함수 추가
- macOS 앱 번들에서 셸 PATH가 제한되므로 npm/npx를 직접 탐색
- Homebrew(ARM/Intel), nvm, fnm, volta, 시스템 경로 확인

#### 5-5. npx 전체 경로 + BRIDGE_PORT env
- `~/.claude.json` 등록 시 npx 명령을 전체 경로로 지정
- `env.BRIDGE_PORT`를 `"8790"`으로 설정

### 수정 파일
- `src-tauri/src/commands/mcp.rs` (setup_bridge_plugin, find_node_bin, register 폴백)
- `src-tauri/src/main.rs` (setup_bridge_plugin 커맨드 등록)
- `src-tauri/tauri.conf.json` (bundle.resources)
- `src-tauri/resources/ama-bridge/` (번들 리소스 파일)
- `src/features/channels/MCPSettings.tsx` (setup_bridge_plugin 호출)
- `src/i18n/ko.json`, `en.json`, `ja.json` (setupSuccess, setupFail, setupFailManual 키)

---

## 이슈 6: --dangerously-load-development-channels 옵션 혼선

### 증상
- Claude Code 2.1.81에서 `--dangerously-load-development-channels` 옵션이 안 보임

### 원인
- claude.ai 로그인이 필요한 상태에서 옵션이 표시되지 않았음
- 로그인 후 옵션은 정상 작동

### 해결
- 실행 명령어를 `--dangerously-load-development-channels server:ama-bridge`로 유지
- `step2Caution` 번역 키를 갱신하여 플래그 설명 추가
- README/UI 가이드 갱신

### 수정 파일
- `src/i18n/ko.json`, `en.json`, `ja.json` (step2Caution 텍스트 갱신)

---

## 수정 요약

| 이슈 | 핵심 변경 | 영향도 |
|------|----------|--------|
| 1 | premiumStore.reset() + TTS 복원 | 인증/프리미엄 |
| 2 | health check 비차단 | Channels UX |
| 3 | channel-test 제거, health만 | Channels UX |
| 4 | 타임아웃 24시간 통일 | Channels 안정성 |
| 5 | 번들 리소스 + auto-setup + 경로 탐색 | 배포 앱 필수 |
| 6 | UI 텍스트 갱신 | 가이드 정확성 |
