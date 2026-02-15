# MyPartnerAI

PC 화면에서 자유롭게 돌아다니며 사용자와 상호작용하는 AI 아바타 데스크톱 애플리케이션

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Tauri](https://img.shields.io/badge/Tauri-2.0-orange)
![React](https://img.shields.io/badge/React-18-blue)

## 설치

### 요구사항

- Node.js 20+
- Rust 1.75+ ([설치](https://rustup.rs/))

### 빌드 및 실행

```bash
# 클론
git clone https://github.com/anthropics/MyPartnerAI.git
cd MyPartnerAI

# 의존성 설치
npm install

# 개발 모드 실행
npm run tauri dev

# 프로덕션 빌드
npm run tauri build

# macOS 앱 번들(.app)만 빌드
npm run build:mac-app
```

## 설정

### 환경 변수

```bash
cp .env.example .env
```

```env
# 클라우드 LLM API 키 (사용할 경우)
VITE_ANTHROPIC_API_KEY=your_claude_api_key
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_GOOGLE_API_KEY=your_gemini_api_key

# 로컬 LLM (Ollama)
VITE_OLLAMA_ENDPOINT=http://localhost:11434
```

### AI 설정

| 항목 | 옵션 | 기본값 |
|------|------|--------|
| **LLM Provider** | Claude, OpenAI, Gemini, Ollama | Claude |
| **모델** | 각 Provider별 모델 선택 | - |

### TTS 설정

| 엔진 | 특징 | 한국어 | 오프라인 |
|------|------|--------|----------|
| **Supertonic** (추천) | 고품질 온디바이스 TTS | ✅ | ✅ |
| Edge TTS | Microsoft 음성 | ✅ | ❌ |
| Web Speech | 브라우저 내장 | ✅ | ❌ |

#### Supertonic 음성

| 음성 | 성별 |
|------|------|
| F1 ~ F5 | 여성 |
| M1 ~ M5 | 남성 |

### STT 설정

| 엔진 | 특징 | 한국어 | 오프라인 |
|------|------|--------|----------|
| **Web Speech** (기본) | 브라우저 내장 | ✅ | ❌ |

### 아바타 설정

| 항목 | 범위 | 기본값 |
|------|------|--------|
| 크기 | 0.3x ~ 2.0x | 1.0x |
| 이동 속도 | 0.5 ~ 3.0 | 1.0 |

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Tauri 2.0 + React 18 + TypeScript |
| 3D 렌더링 | Three.js + @react-three/fiber + @pixiv/three-vrm |
| 상태 관리 | Zustand 5 |
| AI | Claude, OpenAI, Gemini, Ollama |
| 음성 (TTS) | Supertonic, Edge TTS, Web Speech |
| 음성 (STT) | Web Speech API |

## 문서

자세한 내용은 [CLAUDE.md](CLAUDE.md) 및 [docs/](docs/) 폴더를 참조하세요.

## 라이선스

MIT License
