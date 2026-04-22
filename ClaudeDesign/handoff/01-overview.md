# 01. 개요

## 1.1 프로젝트 현황

`joopark4/MyPartnerAI` (이하 AMA)는 Tauri + React 기반의 데스크톱 AI 동반자 앱입니다.  
현재 구현된 기능:
- VRM 3D 아바타 렌더링 (투명 창, 클릭-스루)
- Whisper STT + Supertonic TTS (로컬)
- 다중 LLM 프로바이더 (Ollama / Claude / OpenAI / Gemini / LocalAI)
- Claude Code Channels (MCP)
- 히스토리 패널, 설정 패널, 온보딩, 인증

현재 UI는 **Tailwind 기본 톤 (파란색 버튼, 흰색 카드)** 위주로 구성돼 있어,  
아바타의 따뜻한 세계관과 톤이 맞지 않고 시각적 일관성이 약합니다.

## 1.2 리디자인 목표

1. **톤앤매너 일원화** — 따뜻·친근·글래시(Vision OS 풍)로 전면 개편
2. **음성 중심 UX** — 텍스트 입력은 on-demand 토글로 축소, 음성을 기본 입력으로 유도
3. **사용자 맞춤** — "자주 쓰는 기능"을 설정에서 등록하고 한 번에 호출
4. **상태 가시성 강화** — 상태 인디케이터를 컨트롤 클러스터와 가까이 배치
5. **아바타 제어권** — 아바타를 숨기거나 다시 띄우는 기능

## 1.3 변경 범위

### 🟢 전체 교체 (UI 다시 디자인)
- 메인 오버레이 (우하단 컨트롤 클러스터)
- 말풍선 (SpeechBubble)
- 상태 인디케이터 (StatusIndicator)
- 설정 패널 (SettingsPanel + 하위 섹션 컴포넌트들)
- 히스토리 패널 (HistoryPanel)
- 온보딩 (초기 셋업)
- 인증 화면 (AuthScreen)
- 프리미엄 음성 / 구독 UI
- 첫 실행 아바타 이름 입력 다이얼로그

### 🟡 신규 추가 (기능 + UI)
- **자주 쓰는 기능** 레지스트리 + 팔레트 화면 (`QuickActionsPanel`)
  - 설정에서 체크박스로 기능 등록/해제
  - ✨ 버튼 클릭 시 등록된 기능 팔레트 열림
- **아바타 숨기기** 토글 (컨트롤 클러스터)
- **키보드 입력 토글** — 기본 숨김, 필요 시 열림

### 🔵 신규 (AMA 외부)
- **AMA 랜딩 페이지** — 다운로드·기능 소개용 웹 페이지 (별도 리포지토리 또는 `/docs` 페이지)

### 🔴 유지 (변경 없음)
- VRM 렌더링 로직 (`VRMAvatar.tsx`, Three.js 관련)
- 음성 처리 파이프라인 (whisper, supertonic)
- Tauri IPC / 파일시스템 / 딥링크
- Zustand 스토어 구조 (필드만 추가)

## 1.4 구현 시 지키기

- **스토어 구조 유지**: 기존 `settingsStore`, `conversationStore` 등의 스키마는 그대로 두고 필요한 필드만 추가
- **i18n**: 모든 한국어 문자열은 `t('...')`로 감싸기 (`locales/ko/*.json`에 키 추가)
- **접근성**: `aria-label`, 키보드 네비게이션 유지 (ESC로 닫기, Enter로 실행)
- **클릭-스루**: `data-interactive="true"` 속성으로 투명 창 이벤트 처리 (useClickThrough 훅)
- **테마**: 현재는 라이트 모드 단일, 향후 다크 모드 고려해 토큰 기반으로 작성

## 1.5 참고

- 프로토타입은 `../AMA Prototype.html`에서 직접 조작 가능
- 모든 화면은 `proto-chrome` 상단 세그먼트로 이동
- 디자인 토큰은 `../src/App.jsx`의 CSS 변수 + 인라인 스타일 참고
