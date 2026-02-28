# 기술 스택

## 앱 프레임워크

| 영역 | 기술 | 용도 |
|------|------|------|
| Desktop Shell | Tauri 2 | 데스크톱 번들링, 네이티브 명령 호출 |
| Frontend | React 18 + TypeScript | UI/상태 기반 렌더링 |
| Build | Vite 6 | 개발 서버/프로덕션 번들 |
| Backend | Rust | OS 연동, Whisper 실행, 원격 감지 |

## 3D / 아바타

| 기술 | 용도 |
|------|------|
| three.js | WebGL 렌더링 |
| @react-three/fiber | React 기반 렌더 루프 |
| @react-three/drei | R3F 유틸리티 |
| @pixiv/three-vrm | VRM 로딩/표정 런타임 |

## 상태 / UI

| 기술 | 용도 |
|------|------|
| Zustand 5 | `settings`, `avatar`, `conversation` 스토어 |
| i18next + react-i18next | 한국어/영어 다국어 |
| Tailwind CSS | UI 스타일링 |

## AI / LLM

| 범주 | 기술 | 비고 |
|------|------|------|
| 라우팅 | `llmRouter` | 설정 provider에 따라 클라이언트 위임 |
| 로컬 LLM | Ollama / LocalAI | endpoint + model 필요 |
| 클라우드 LLM | Claude / OpenAI / Gemini | API Key + model 필요 |
| Vision | Claude/OpenAI/Gemini | Tauri 화면 캡처 기반 |

## 음성

| 기능 | 기술 | 상태 |
|------|------|------|
| STT 엔진 | whisper.cpp (`whisper-cli`) | 사용 중 (단일 엔진) |
| STT 모델 | `base`, `small`, `medium` | 사용 중 |
| TTS 엔진 (로컬) | Supertonic + onnxruntime-web | 사용 중 (기본) |
| TTS 엔진 (클라우드) | Supertone API (Edge Function 프록시) | 사용 중 (프리미엄) |
| TTS 보이스 (로컬) | `F1~F5`, `M1~M5` | 사용 중 |
| TTS 보이스 (클라우드) | Supertone API 음성 목록 (동적 조회) | 사용 중 |

## Tauri 플러그인

| 플러그인 | 용도 |
|----------|------|
| `tauri-plugin-dialog` | 파일 선택 다이얼로그 |
| `tauri-plugin-fs` | 모델/리소스 파일 읽기 |
| `tauri-plugin-shell` | 시스템 명령 연동 보조 |
| `tauri-plugin-single-instance` | 단일 인스턴스 강제 |

## 클라우드 서비스

| 서비스 | 용도 |
|--------|------|
| Supabase Auth | OAuth 인증 (Google) |
| Supabase Database | 프로필, 설정, 약관 동의, 구독, TTS 사용량 |
| Supabase Edge Functions | Edge Function 프록시 (TTS, 음성 목록, 사용량, 계정 삭제) |
| Supertone API | 클라우드 TTS (프리미엄) |

## macOS 배포 관련 스크립트

| 스크립트 | 역할 |
|----------|------|
| `scripts/prepare-assets.mjs` | 모델 준비/동기화, Whisper 모델 자동 다운로드(옵션) |
| `scripts/stage-bundled-models.mjs` | 앱 번들 Resources로 모델+Whisper 런타임 스테이징 |
| `scripts/sign-macos-app.mjs` | 코드사인 |
| `scripts/notarize-macos-app.mjs` | 노타라이즈 + staple |
