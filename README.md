# AMA - AI My Avatar

화면 위를 자유롭게 이동하는 AI 아바타 데스크톱 앱입니다.
대화 입력(텍스트/음성), 음성 답변(TTS), VRM 아바타 상호작용을 제공합니다.

English version: [README.en.md](README.en.md)

> 버그 리포트, 기능 제안 등 피드백은 [jooparkhappy4@gmail.com](mailto:jooparkhappy4@gmail.com)으로 보내주세요.

<a href="https://www.buymeacoffee.com/eunyeon">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-red.png" alt="Buy Me A Coffee" width="217" height="60">
</a>

![Platform](https://img.shields.io/badge/platform-macOS-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Tauri](https://img.shields.io/badge/Tauri-2.0-orange)
![React](https://img.shields.io/badge/React-18-blue)

## 핵심 동작

- 우하단 고정 버튼:
  - 텍스트 입력
  - 음성 인식
  - 설정(옵션)
- 아바타:
  - 마우스로 선택/이동/회전 가능
  - 말풍선은 아바타 상단에 자동 배치
- 음성:
  - STT: Whisper(로컬, `base/small/medium`)
  - TTS: Supertonic(`F1~F5`, `M1~M5`)
  - 글로벌 단축키: 기본 `Cmd+Shift+Space` (앱 포커스와 무관)
- 원격 세션 감지 시:
  - 음성 인식(STT)은 차단
  - 텍스트 대화는 계속 사용 가능

## 데모

> Claude Code Channels를 통한 AMA 아바타와 Claude Code 간 실시간 양방향 대화 데모입니다. 사용자가 AMA에서 질문하면 Claude Code가 응답하고, 아바타가 TTS로 음성 답변을 제공합니다.

[▶ 데모 영상 보기 (Claude Code Channels)](etc/demo/ccc-01.mp4)

## 테스트 사양

| 장비 | CPU/SoC | 메모리 |
|------|---------|--------|
| MacBook Pro | Apple M1 Max | 32 GB |
| Mac mini | Apple M4 | 24 GB |

---

## 방법 1: DMG 설치 (일반 사용자)

### 설치

1. [최신 릴리스](https://github.com/joopark4/AMA/releases/latest)에서 `AMA_x.x.x_aarch64.dmg` 다운로드 — [v0.8.0 바로가기](https://github.com/joopark4/AMA/releases/tag/v0.8.0)
2. DMG를 열고 `AMA.app`을 `Applications` 폴더로 드래그
3. Launchpad 또는 Applications에서 AMA 실행

### 최초 실행

1. 첫 실행 시 필수 모델(TTS/STT) 자동 다운로드 안내
2. 모델 다운로드 완료 후 아바타 이름 입력
3. `.vrm` 아바타 파일 선택 (설정 > 아바타에서 변경 가능)
4. 우하단 설정 버튼에서 AI 모델 설정 후 대화 시작

### AI 설정 방법

앱 실행 후 우하단 설정 버튼에서 `LLM Provider`, `Model`, `Endpoint`, `API Key`를 설정합니다.

#### Ollama (로컬, 기본 추천)

```bash
# macOS 설치
brew install ollama

# 서버 실행
ollama serve

# 모델 다운로드 예시
ollama pull deepseek-v3
```

설정 화면에서:

- `LLM Provider`: `ollama`
- `Endpoint`: `http://localhost:11434`
- `Model`: `deepseek-v3` (또는 다운로드한 모델명)

#### Gemini (클라우드)

1. Google AI Studio에서 API Key 발급
2. 앱 설정의 `API Key` 입력란에 직접 입력

설정 화면에서:

- `LLM Provider`: `gemini`
- `Model`: 예) `gemini-2.0-flash`

#### OpenAI / Claude (클라우드)

- 앱 설정 화면에서 Provider 선택 후 API Key 입력
- Provider/Model은 설정 화면에서 선택

#### LocalAI (로컬 서버)

- LocalAI 서버 실행 후 OpenAI 호환 endpoint 준비
- 설정 화면에서:
  - `LLM Provider`: `localai`
  - `Endpoint`: LocalAI 주소 (예: `http://localhost:8080`)
  - `Model`: LocalAI에 로드된 모델 id

> 응답이 안 나오는 경우, Provider/Model/Endpoint/API Key 값이 올바른지 먼저 확인하세요.

### 자동 업데이트

설정 패널 또는 macOS 메뉴바 "Check for Updates..."에서 업데이트를 확인할 수 있습니다.
새 버전이 있으면 자동으로 다운로드 후 재시작됩니다.

---

## 방법 2: 소스 빌드 (개발자)

### 요구사항

- Node.js 20+
- Rust 1.75+ ([rustup](https://rustup.rs/))

### 모델 다운로드 (필수)

AI 모델 파일은 용량이 크므로 저장소에 포함되지 않습니다. 실행 전 아래 경로에 직접 배치해야 합니다.

#### TTS 모델 (Supertonic)

Git LFS가 설치되어 있어야 합니다:

```bash
brew install git-lfs
git lfs install
```

HuggingFace에서 다운로드:

```bash
git clone https://huggingface.co/Supertone/supertonic models/supertonic
```

> 총 약 250MB. 다운로드 후 `models/supertonic/onnx/`와 `models/supertonic/voice_styles/`가 있어야 합니다.

#### STT 모델 (Whisper)

모델 1개만 있어도 됩니다. base를 먼저 내려받기를 권장합니다:

```bash
mkdir -p models/whisper

# base (~141 MB, 빠름, 권장 시작점)
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin \
  -o models/whisper/ggml-base.bin

# small (~465 MB, 정확도 향상)
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin \
  -o models/whisper/ggml-small.bin

# medium (~1.4 GB, 최고 정확도)
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin \
  -o models/whisper/ggml-medium.bin
```

#### 최종 디렉터리 구조

```
models/
├── supertonic/
│   ├── onnx/              ← duration_predictor.onnx, text_encoder.onnx 등
│   └── voice_styles/      ← F1.json ~ F5.json, M1.json ~ M5.json
└── whisper/
    └── ggml-base.bin      ← (또는 small / medium)
```

### AI 설정 방법

앱 실행 후 우하단 설정 버튼에서 `LLM Provider`, `Model`, `Endpoint`, `API Key`를 설정합니다.
설정 방법은 [방법 1의 AI 설정 방법](#ai-설정-방법)과 동일합니다.

개발 환경에서는 `.env` 파일로도 설정 가능합니다:

```bash
cp .env.example .env
```

```env
# Cloud LLM API Key (해당 provider 사용 시)
VITE_ANTHROPIC_API_KEY=
VITE_OPENAI_API_KEY=
VITE_GOOGLE_API_KEY=

# Local LLM endpoint (기본값)
VITE_OLLAMA_ENDPOINT=http://localhost:11434
```

### 개발 실행

```bash
# 1) 저장소 클론
git clone https://github.com/joopark4/AMA.git
cd AMA

# 2) 의존성 설치
npm install

# 3) 개발 모드 실행 (모델 준비 + Vite + Tauri)
npm run tauri dev
```

### 빌드

```bash
# 일반 프로덕션 빌드
npm run tauri build
```

---

## 공통 가이드

### 글로벌 음성 단축키

- 기본값: `Cmd+Shift+Space`
- 동작: 단축키 1회 입력 시 음성 입력 시작, 다시 입력 시 종료
- 설정 위치: `설정 > 음성 > 글로벌 음성 단축키`
- 입력 방식: 단축키 입력창을 클릭한 상태에서 키 조합을 직접 누르면 저장
- 등록 실패 시:
  - 앱 내 경고 토스트에서 접근성 설정 열기 버튼 사용
  - 다른 앱/시스템 단축키와 충돌 시 다른 조합으로 변경

### Claude Code Channels 사용 방법

AMA 아바타를 Claude Code와 연결하여 양방향 대화가 가능합니다.

#### 사전 요구사항

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI 설치
- [Node.js](https://nodejs.org/) 18+ 설치
- claude.ai 계정 로그인 (`claude login`)

#### 설정 단계

1. AMA 앱 실행
2. `설정 > Claude Code Channels > 토글 ON`
   - Bridge 플러그인 자동 설치 (`~/.mypartnerai/ama-bridge/`)
   - Claude Code에 MCP 서버 자동 등록 (`~/.claude.json`)
   - 자동 설치 실패 시: `cd ~/.mypartnerai/ama-bridge && npm install`
3. 별도 터미널에서 Claude Code 실행:
   ```bash
   claude --dangerously-load-development-channels server:ama-bridge --permission-mode bypassPermissions
   ```
4. 초기 확인 프롬프트에서 `Yes` 선택 (세션당 1회)
5. AMA에서 대화 → Claude Code 응답 → 아바타 TTS

토글 OFF 시 이전 AI 모델 설정으로 자동 복원됩니다.

#### 주의사항

- Channels는 **리서치 프리뷰** 기능입니다. `--dangerously-load-development-channels` 플래그가 필수이며, 세션 시작 시 보안 확인 프롬프트가 1회 표시됩니다.
- `--permission-mode bypassPermissions`는 도구 실행 권한을 자동 수락합니다. **신뢰할 수 있는 로컬 환경에서만 사용**하세요.
- AMA와 Claude Code는 **같은 머신**(localhost)에서 실행되어야 합니다.

---

## 자주 겪는 문제

### 1) 음성 인식 버튼이 동작하지 않음

- 원격 접속 상태인지 확인
- 마이크 권한 허용 여부 확인
- Whisper 모델/런타임 파일 경로가 올바른지 확인
- 글로벌 단축키 사용 중이면 접근성 권한/단축키 충돌 여부 확인

### 2) TTS 소리가 안 남

- 설정에서 TTS Test 실행 후 에러 메시지 확인
- Supertonic 모델(`onnx`, `voice_styles`) 경로 확인

### 3) VRM 로드 실패

- 유효한 `.vrm` 파일인지 확인
- 설정 > 아바타에서 다시 파일 선택

---

## VRM 파일 구하기/구매 가이드

### 대표 사이트

| 사이트 | 유형 | 특징 |
|--------|------|------|
| [VRoid Hub](https://hub.vroid.com/en/) | 무료 중심(공유 모델) | 작가가 다운로드 허용한 모델을 사용 가능 |
| [BOOTH (VRM 검색)](https://booth.pm/en/search/VRM) | 무료 + 유료 | 개인 창작자 모델 판매/배포가 가장 활발한 마켓 |
| [VRoid Studio](https://vroid.com/en/studio/) | 직접 제작(무료) | 직접 캐릭터 제작 후 `.vrm`으로 내보내기 가능 |

### VRM 사용 전 체크리스트

- 상업 이용 가능 여부
- 방송/영상 업로드 허용 여부
- 개조(수정) 허용 여부
- 재배포 금지 조건
- 크레딧 표기 조건

> 위 VRM 가이드는 참고용이며, 실제 사용 전 각 모델의 최신 라이선스와 이용약관을 반드시 확인하세요.

---

## 앱 제거

macOS에서 AMA를 완전히 제거하려면:

1. `Applications` 폴더에서 `AMA.app` 삭제
2. 다운로드된 모델 데이터 삭제:
   ```bash
   rm -rf ~/.mypartnerai
   ```

> 앱 내 `설정 > 데이터 관리`에서도 모델 데이터를 삭제할 수 있습니다.

---

## 사용 AI/모델 라이선스 및 링크

### AI 서비스/런타임

| 항목 | 용도 | 라이선스/약관 | 링크 |
|------|------|---------------|------|
| Ollama | 로컬 LLM 서버 | MIT License | [github.com/ollama/ollama](https://github.com/ollama/ollama) |
| LocalAI | 로컬 OpenAI 호환 서버 | MIT License | [github.com/mudler/LocalAI](https://github.com/mudler/LocalAI) |
| Claude API | 클라우드 LLM | Anthropic 서비스 약관 | [anthropic.com/claude](https://www.anthropic.com/claude) |
| OpenAI API | 클라우드 LLM | OpenAI 서비스 약관 | [platform.openai.com](https://platform.openai.com/) |
| Gemini API | 클라우드 LLM | Google 서비스 약관 | [ai.google.dev](https://ai.google.dev/) |
| ONNX Runtime Web | Supertonic 추론 런타임 | MIT License | [github.com/microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) |

### 음성 모델/엔진

| 항목 | 용도 | 라이선스 | 링크 |
|------|------|----------|------|
| whisper.cpp | STT 실행 엔진 | MIT License | [github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) |
| Whisper (OpenAI) | STT 모델 원본 | MIT License | [github.com/openai/whisper](https://github.com/openai/whisper) |
| Supertonic 코드 | TTS 엔진 구현 | MIT License | [github.com/supertone-inc/supertonic](https://github.com/supertone-inc/supertonic) |
| Supertonic 모델 | 로컬 TTS 모델 | BigScience Open RAIL-M | [huggingface.co/Supertone/supertonic](https://huggingface.co/Supertone/supertonic) |

> 클라우드 AI(Claude/OpenAI/Gemini)는 각 서비스 이용약관을 따릅니다. 모델/런타임 재배포 시 각 프로젝트의 최신 LICENSE를 확인하세요.

## 기본 아바타 저작권

DMG 배포 앱에 포함된 기본 VRM 아바타는 본 프로젝트 저작권자의 소유이며, **MIT 라이선스 적용 대상이 아닙니다.**

- 본 앱 내에서의 사용만 허용됩니다.
- 추출, 재배포, 타 앱/서비스에서의 사용을 금지합니다.
- 소스 코드 저장소에는 기본 아바타가 포함되지 않습니다.

## 라이선스

MIT — 기본 아바타를 제외한 소스 코드에 적용됩니다.
