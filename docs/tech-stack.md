# 기술 스택

## 프레임워크 / 런타임

| 영역 | 기술 | 용도 |
|------|------|------|
| Desktop Shell | Tauri 2 | 네이티브 패키징, OS 권한/창 제어 |
| Frontend | React 18 + TypeScript | UI/상태 기반 렌더링 |
| Build Tool | Vite 6 | 프런트 번들링 |
| Backend | Rust (tauri commands) | Whisper 실행, 시스템 연동 |

## 3D / 아바타

| 기술 | 용도 |
|------|------|
| three.js | 3D 렌더링 |
| @react-three/fiber | React 기반 Three 렌더 루프 |
| @react-three/drei | R3F 유틸리티 |
| @pixiv/three-vrm | VRM 로딩/표정 제어 |

## 상태 / UI

| 기술 | 용도 |
|------|------|
| Zustand 5 | 전역 상태(`settings`, `avatar`, `conversation`) |
| i18next + react-i18next | 다국어(ko/en) |
| Tailwind CSS | UI 스타일링 |

## AI

| 범주 | 기술 | 비고 |
|------|------|------|
| LLM Router | 자체 라우터 (`llmRouter`) | 설정 기반 provider 선택 |
| Cloud LLM | Claude / OpenAI / Gemini | API Key 필요 |
| Local LLM | Ollama / LocalAI | endpoint + model 필요 |
| Vision | Claude/OpenAI/Gemini | 화면 캡처 기반 분석 |

## 음성

| 기능 | 기술 | 현재 상태 |
|------|------|----------|
| STT | whisper.cpp (`whisper-cli`) | 사용 중(단일 경로) |
| STT 모델 | ggml-base/small/medium | 사용 중 |
| TTS | Supertonic (onnxruntime-web) | 사용 중(단일 경로) |
| TTS 음성 | F1~F5, M1~M5 | 사용 중 |

## Tauri 플러그인

| 플러그인 | 용도 |
|----------|------|
| `tauri-plugin-dialog` | VRM 파일 선택 다이얼로그 |
| `tauri-plugin-fs` | 리소스/모델 파일 읽기 |
| `tauri-plugin-shell` | 시스템 명령 실행 보조 |
| `tauri-plugin-single-instance` | 단일 인스턴스 보장 |

## 배포/서명

| 구성 | 용도 |
|------|------|
| `scripts/stage-bundled-models.mjs` | 앱 번들에 모델/Whisper 런타임 스테이징 |
| `scripts/sign-macos-app.mjs` | ad-hoc / Developer ID 코드사인 |
| `scripts/notarize-macos-app.mjs` | Apple notarization + staple |
