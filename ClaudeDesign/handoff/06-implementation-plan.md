# 06. 구현 로드맵

Phase 단위로 쪼개서 PR 하나씩 진행하는 것을 권장합니다. 각 Phase는 독립적으로 머지 가능.

## Phase 0: 사전 준비 (0.5일)

- [ ] `@fontsource-variable/pretendard` 설치, `index.css`에서 import
- [ ] `lucide-react` 설치 (이미 있으면 skip)
- [ ] `tailwind.config.ts`에 디자인 토큰 확장 (문서 02 참고)
- [ ] `src/styles/tokens.css` 생성 — 모든 CSS 변수 정의
- [ ] `index.css`에 `tokens.css` import + 기본 글래시 클래스 (`.glass`, `.glass-strong`) 추가
- [ ] `@keyframes` 전부 정의

**완료 기준**: 빈 페이지에서 `<div className="glass p-4">test</div>` 가 글래시 효과로 표시됨.

---

## Phase 1: 오버레이 기본 구조 (1-1.5일)

### 파일
- [ ] **신규** `src/components/ui/ControlCluster.tsx`
  - 버튼 클러스터 (음성, ✨, 기록, 키보드 토글, 아바타 숨김, 설정)
  - Voice 버튼 상태 전환 (idle/listening/transcribing)
  - Waveform 서브컴포넌트
- [ ] **수정** `src/components/ui/SpeechBubble.tsx` 리디자인
- [ ] **수정** `src/components/ui/StatusIndicator.tsx` → StatusPill로 축소 + 위치 변경
- [ ] **수정** `src/App.tsx` — 레이아웃 조정, StatusIndicator 제거, ControlCluster 장착

### 스토어
- [ ] `settingsStore.ts`에 `avatarHidden` 필드 추가 + 마이그레이션

### 테스트
- 음성 버튼 누르면 STT 시작 → listening 표시
- 설정 버튼으로 기존 SettingsPanel 열림 (아직 리디자인 전)

**완료 기준**: 기존 기능 유지 + 새 컨트롤 클러스터 디자인으로 교체 완료.

---

## Phase 2: 아바타 숨기기 + 키보드 토글 (0.5일)

- [ ] 아바타 숨기기 버튼 → `toggleAvatarHidden` 연결
- [ ] `AvatarRestingBadge` 컴포넌트 추가
- [ ] `App.tsx`에서 `avatarHidden` 시 `AvatarCanvas` unmount
- [ ] 키보드 토글 → 입력창 conditional render + 포커스 처리
- [ ] ESC 핸들링

**완료 기준**: 아바타 숨기기 / 다시 보이기 정상, 키보드 토글로 입력창 열고 닫기 정상.

---

## Phase 3: 설정 패널 리디자인 (1.5-2일)

- [ ] `SettingsSection.tsx` 리디자인 (아이콘 칩 + 글래시 카드)
- [ ] `SettingsPanel.tsx` 리디자인 (슬라이드 인, 헤더, 사용자 pill)
- [ ] 하위 섹션들 내부 UI 리디자인:
  - [ ] `LLMSettings.tsx`
  - [ ] `VoiceSettings.tsx`
  - [ ] `PremiumVoiceSettings.tsx`
  - [ ] `AvatarSettings.tsx`
  - [ ] `MCPSettings.tsx`
  - [ ] `UpdateSettings.tsx`
- [ ] 공통 폼 컴포넌트 추출: `<Field>`, `<Select>`, `<TextInput>`, `<Toggle>`, `<Row>`, `<Slider>`, `<Pill>`

**완료 기준**: 모든 설정 섹션이 새 디자인으로 통일 + 기존 기능 전부 동작.

---

## Phase 4: 자주 쓰는 기능 (2일) 🆕

### 데이터 레이어
- [ ] `src/features/quick-actions/types.ts`
- [ ] `src/features/quick-actions/catalog.ts` — 9개 기능 정의 + handlers
- [ ] `src/features/quick-actions/useQuickActions.ts` — dispatch hook
- [ ] `settingsStore.ts` — `enabledQuickActions` 필드 + 마이그레이션 (version 14)

### UI
- [ ] `src/components/settings/QuickActionsSettings.tsx` — 설정 섹션
- [ ] SettingsPanel에 섹션 등록 (아바타 위)
- [ ] `src/components/ui/QuickActionsPalette.tsx` — ✨ 팔레트
- [ ] ControlCluster의 ✨ 버튼 연결
- [ ] 전역 단축키 (`Cmd+Shift+A`)

### i18n
- [ ] `locales/ko/translation.json` 추가 (`quick.*`, `settings.quickActions.*`)
- [ ] en, ja 동일하게

### 핸들러 통합 (기본만)
- [ ] `calendar`, `mail`, `news`, `polish`, `memo`, `files` — `sendMessage` 프롬프트 주입
- [ ] `translate` — 클립보드 읽기
- [ ] `capture` — Tauri `invoke('capture_screen')`
- [ ] `focus` — 번들된 lo-fi 루프 재생

**완료 기준**: 설정에서 체크 → ✨ 팔레트에 반영 → 클릭 시 실제 동작.

---

## Phase 5: 히스토리 · 온보딩 · 인증 · 프리미엄 리디자인 (2-3일)

- [ ] `HistoryPanel.tsx`
- [ ] `ModelDownloadModal.tsx` + 신규 온보딩 스텝 (아바타 이름, VRM 선택)
- [ ] `AuthScreen.tsx`, `TermsModal.tsx`, `UserProfile.tsx`
- [ ] `PremiumVoiceSettings.tsx` + 구독 UI

**완료 기준**: 프로토타입과 시각적으로 동일한 경험.

---

## Phase 6: 랜딩 페이지 (별도, 선택) (1-2일)

- [ ] 별도 디렉토리 (`landing/` 또는 docs 사이트)
- [ ] Hero / Feature grid / 다운로드 / 푸터
- [ ] macOS / Windows DMG·MSI 링크

---

## Phase 7: QA + 폴리싱 (1일)

- [ ] 다크 모드 대응 여부 결정 (미루거나 토큰만 준비)
- [ ] 접근성 체크 (키보드 네비, ARIA)
- [ ] 각 상태 애니메이션 타이밍 검수
- [ ] i18n 전부 채웠는지 확인
- [ ] 프로토타입과 실물 나란히 비교 스크린샷

---

## 🗓 총 예상 기간

**7-10일** (1인 full-time 기준)

Phase 1-4가 핵심. Phase 5-7은 후순위로 미룰 수 있습니다.

## 📌 우선순위 제안

**High**: Phase 0, 1, 2, 3, 4  
**Medium**: Phase 5  
**Low**: Phase 6, 7

## 🤖 Claude Code에 넘길 때 팁

- Phase 하나씩 별도 세션으로 진행 (컨텍스트 분리)
- 각 Phase 시작 시 해당 Phase 문서 + `03-file-mapping.md` + `04-components.md` 붙여넣기
- "프로토타입의 `src/Overlay.jsx`를 참고해서 `src/components/ui/ControlCluster.tsx`를 만들어줘. 프로토타입 원본 파일은 `AMA Prototype.html`과 `src/` 폴더에 있어"라고 명시
- 커밋은 작게 (컴포넌트 1개 단위)
