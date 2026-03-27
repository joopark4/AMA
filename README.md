# MyPartnerAI

화면 위를 자유롭게 이동하는 AI 아바타 데스크톱 앱입니다.  
대화 입력(텍스트/음성), 음성 답변(TTS), VRM 아바타 상호작용을 제공합니다.

English version: [README.en.md](README.en.md)

![Platform](https://img.shields.io/badge/platform-macOS-blue)
![License](https://img.shields.io/badge/license-BSD--2--Clause-green)
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

## 테스트 사양

| 장비 | CPU/SoC | 메모리 |
|------|---------|--------|
| MacBook Pro | Apple M1 Max | 32 GB |
| Mac mini | Apple M4 | 24 GB |

## 요구사항

- Node.js 20+
- Rust 1.75+ ([rustup](https://rustup.rs/))

## 모델 다운로드 (필수)

AI 모델 파일은 용량이 크므로 저장소에 포함되지 않습니다. 실행 전 아래 경로에 직접 배치해야 합니다.

외부 모델 경로를 사용할 경우:

```bash
PREPARE_MODELS_DIR="/absolute/path/to/models" npm run build
```

### TTS 모델 (Supertonic)

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

### STT 모델 (Whisper)

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

### 최종 디렉터리 구조

```
models/
├── supertonic/
│   ├── onnx/              ← duration_predictor.onnx, text_encoder.onnx 등
│   └── voice_styles/      ← F1.json ~ F5.json, M1.json ~ M5.json
└── whisper/
    └── ggml-base.bin      ← (또는 small / medium)
```

---

## 개발 실행

```bash
# 1) 저장소 클론
git clone https://github.com/joopark4/MyPartnerAI.git
cd MyPartnerAI

# 2) 의존성 설치
npm install

# 3) 개발 모드 실행 (모델 준비 + Vite + Tauri)
npm run tauri dev
```

## 빌드

```bash
# 일반 프로덕션 빌드
npm run tauri build
```

## 최초 실행 가이드

1. 앱 실행
2. VRM 미선택 상태면 중앙 안내창에서 `.vrm` 파일 선택
3. 우하단 설정 버튼에서:
   - LLM Provider/Model 설정
   - Whisper 모델(`base/small/medium`) 선택
   - Supertonic 보이스 선택
   - 글로벌 음성 단축키 ON/OFF 및 키 조합 설정
4. 마이크 버튼 또는 텍스트 입력으로 대화 시작

## 글로벌 음성 단축키

- 기본값: `Cmd+Shift+Space`
- 동작: 단축키 1회 입력 시 음성 입력 시작, 다시 입력 시 종료
- 설정 위치: `설정 > 음성 > 글로벌 음성 단축키`
- 입력 방식: 단축키 입력창을 클릭한 상태에서 키 조합을 직접 누르면 저장
- 등록 실패 시:
  - 앱 내 경고 토스트에서 접근성 설정 열기 버튼 사용
  - 다른 앱/시스템 단축키와 충돌 시 다른 조합으로 변경

## 모델/런타임

- Whisper 모델: `base`, `small`, `medium`
- Supertonic 모델: `onnx`, `voice_styles`
- VRM 파일은 기본 포함하지 않으며, 첫 실행 시 사용자가 직접 선택합니다.

## 모션 데이터 파이프라인

- `motions/raw/` : 원본 모션 소스(수집/캡처)
- `motions/clean/` : 리타게팅/정제 중간 산출물
- `public/motions/` : 런타임에서 사용하는 최종 클립
- `src/config/motionManifest.json` : 모션 메타데이터 단일 소스

실데이터 교체:

```bash
# catalog 파일 준비 (motions/clean/catalog.example.json 참고)
npm run motion:catalog:auto
npm run motion:import:dry
npm run motion:import
```

외부 정제 클립 동기화:

```bash
MOTION_CLEAN_SOURCE=/absolute/path/to/clean/clips npm run motion:sync:clean
MOTION_CLEAN_SOURCE=/absolute/path/to/clean/clips npm run motion:sync:external
npm run motion:refresh
```

외부 정제 경로 alias 사용(`MOTION_CLEAN_SOURCE` 필요):

```bash
MOTION_CLEAN_SOURCE=/absolute/path/to/clean/clips \
npm run motion:refresh:external
```

커스텀 catalog 경로:

```bash
MOTION_CATALOG=motions/clean/my-catalog.json npm run motion:import
```

검증:

```bash
npm run motion:validate
npm run motion:qa:team10
npm run motion:collect:index -- --source "<path/to/your/motions/raw>"
npm run motion:collect:metadata -- --source "<path/to/your/motions/raw>" --checklist "motions/raw/raw-intake-checklist.json"
```

## 환경 변수 (선택)

`cp .env.example .env` 후 필요 시 설정:

```env
# Cloud LLM API Key (해당 provider 사용 시)
VITE_ANTHROPIC_API_KEY=
VITE_OPENAI_API_KEY=
VITE_GOOGLE_API_KEY=

# Local LLM endpoint (기본값)
VITE_OLLAMA_ENDPOINT=http://localhost:11434
```

## AI 설정 방법 (Ollama / Gemini 등)

앱 실행 후 우하단 설정 버튼에서 `LLM Provider`, `Model`, `Endpoint`, `API Key`를 설정합니다.

### 1) Ollama (로컬, 기본 추천)

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

### 2) Gemini (클라우드)

1. Google AI Studio에서 API Key 발급
2. 아래 둘 중 하나로 키 설정

```env
VITE_GOOGLE_API_KEY=발급받은_키
```

또는 앱 설정의 `API Key` 입력란에 직접 입력

설정 화면에서:

- `LLM Provider`: `gemini`
- `Model`: 예) `gemini-2.0-flash`

### 3) OpenAI / Claude (클라우드)

- OpenAI: `VITE_OPENAI_API_KEY` 또는 설정 화면 API Key 입력
- Claude: `VITE_ANTHROPIC_API_KEY` 또는 설정 화면 API Key 입력
- Provider/Model은 설정 화면에서 선택

### 4) LocalAI (로컬 서버)

- LocalAI 서버 실행 후 OpenAI 호환 endpoint 준비
- 설정 화면에서:
  - `LLM Provider`: `localai`
  - `Endpoint`: LocalAI 주소 (예: `http://localhost:8080`)
  - `Model`: LocalAI에 로드된 모델 id

응답이 안 나오는 경우, 설정 화면의 Provider/Model/Endpoint/API Key 값이 모두 올바른지 먼저 확인하세요.

## Claude Code Channels (아바타 ↔ Claude Code 연동)

외부 터미널에서 실행 중인 Claude Code와 AMA 아바타를 연결합니다.
사용자의 텍스트/음성 입력이 Claude Code로 전달되고, 응답을 아바타가 TTS로 읽어줍니다.

### 데모

<video src="docs/movie/ccc-01.mp4" controls width="720">
  Claude Code Channels 연동 데모 영상
</video>

> AMA 아바타와 Claude Code Channels 연동 데모 — 사용자가 음성으로 질문하면 Claude Code가 코드를 분석/실행하고, 응답을 아바타가 음성(TTS)과 표정으로 전달합니다.

### 사용 방법

1. 채널 의존성 설치 (최초 1회): `cd mcp-channels && npm install && cd ..`
2. AMA 앱 실행: `npm run tauri dev`
3. `설정 > Claude Code Channels > 토글 ON` (자동으로 Claude Code 등록 + AI 모델 전환)
4. 별도 터미널에서 Claude Code 실행:
   ```bash
   claude --dangerously-load-development-channels server:ama-bridge --permission-mode bypassPermissions
   ```
5. 초기 확인 프롬프트에서 `Yes` 선택 (세션당 1회)
6. AMA에서 대화 → Claude Code 응답 → 아바타 TTS

토글 OFF 시 이전 AI 모델 설정으로 자동 복원됩니다.

### 주의사항

- Channels는 **리서치 프리뷰** 기능입니다. `--dangerously-load-development-channels` 플래그가 필수이며, 세션 시작 시 보안 확인 프롬프트가 1회 표시됩니다.
- `--permission-mode bypassPermissions`는 도구 실행 권한을 자동 수락합니다. **신뢰할 수 있는 로컬 환경에서만 사용**하세요.
- AMA와 Claude Code는 **같은 머신**(localhost)에서 실행되어야 합니다.

자세한 내용은 [Claude Code Channels 가이드](docs/channels-mcp.md)를 참조하세요.

---

## 사용 AI/모델 라이선스 및 링크

### 1) AI 서비스/런타임

| 항목 | 용도 | 라이선스/약관 | 링크 |
|------|------|---------------|------|
| Ollama | 로컬 LLM 서버 | MIT License | [github.com/ollama/ollama](https://github.com/ollama/ollama) |
| LocalAI | 로컬 OpenAI 호환 서버 | MIT License | [github.com/mudler/LocalAI](https://github.com/mudler/LocalAI) |
| Claude API | 클라우드 LLM | Anthropic 서비스 약관 | [anthropic.com/claude](https://www.anthropic.com/claude) |
| OpenAI API | 클라우드 LLM | OpenAI 서비스 약관 | [platform.openai.com](https://platform.openai.com/) |
| Gemini API | 클라우드 LLM | Google 서비스 약관 | [ai.google.dev](https://ai.google.dev/) |
| ONNX Runtime Web | Supertonic 추론 런타임 | MIT License | [github.com/microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) |

### 2) 음성 모델/엔진

| 항목 | 용도 | 라이선스 | 링크 |
|------|------|----------|------|
| whisper.cpp | STT 실행 엔진(`whisper-cli`) | MIT License | [github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) |
| Whisper (OpenAI) | STT 모델 원본 계열 | MIT License (OpenAI Whisper 저장소 기준) | [github.com/openai/whisper](https://github.com/openai/whisper) |
| GGML Whisper 모델(`ggml-base/small/medium`) | 앱 로컬 STT 모델 | 원본/배포처 라이선스 준수 | [huggingface.co/ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp) |
| Supertonic 코드 | TTS 엔진 구현 | MIT License | [github.com/supertone-inc/supertonic](https://github.com/supertone-inc/supertonic) |
| Supertonic 모델 | 앱 로컬 TTS 모델 | BigScience Open RAIL-M (`models/supertonic/LICENSE`) | [huggingface.co/Supertone/supertonic](https://huggingface.co/Supertone/supertonic) |

참고:

- 클라우드 AI(Claude/OpenAI/Gemini)는 오픈소스 라이선스가 아니라 각 서비스 이용약관을 따릅니다.
- 모델/런타임 재배포 시에는 반드시 각 프로젝트의 최신 LICENSE/약관을 우선 확인하세요.

## 앱 제거

macOS에서 AMA를 완전히 제거하려면:

1. `Applications` 폴더에서 `AMA.app` 삭제
2. 다운로드된 모델 데이터 삭제:
   ```bash
   rm -rf ~/.mypartnerai
   ```

> 앱 내 `설정 > 데이터 관리`에서도 모델 데이터를 삭제할 수 있습니다.

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

## VRM 파일 구하기/구매 가이드

### 대표 사이트

| 사이트 | 유형 | 특징 |
|--------|------|------|
| [VRoid Hub](https://hub.vroid.com/en/) | 무료 중심(공유 모델) | 작가가 다운로드 허용한 모델을 사용 가능 |
| [BOOTH (VRM 검색)](https://booth.pm/en/search/VRM) | 무료 + 유료 | 개인 창작자 모델 판매/배포가 가장 활발한 마켓 |
| [VRoid Studio](https://vroid.com/en/studio/) | 직접 제작(무료) | 직접 캐릭터 제작 후 `.vrm`으로 내보내기 가능 |

### 1) 무료 VRM 받기 (VRoid Hub)

1. VRoid Hub 로그인
2. 원하는 모델 페이지에서 **다운로드/이용 허용 조건** 확인
3. 사용 범위(개인/상업/수정/재배포/크레딧) 확인
4. `.vrm` 파일을 내려받아 앱에서 선택

참고:
- 모든 모델이 다운로드 가능한 것은 아닙니다.
- 모델별 이용 조건이 다르므로 반드시 각 모델 정책을 확인하세요.

### 2) 유료 VRM 구매하기 (BOOTH)

1. [BOOTH VRM 검색](https://booth.pm/en/search/VRM)에서 모델 탐색
2. 가격, 미리보기, 업데이트 이력 확인
3. 상품 설명의 라이선스/이용약관 확인  
   (상업 이용 가능 여부, 크레딧 표기, 재배포 금지 여부 등)
4. 결제 후 다운로드 파일(`.zip`/`.vrm`) 받기
5. 압축 해제 후 `.vrm` 파일을 앱에서 선택

### 3) 직접 만들기 (VRoid Studio)

1. [VRoid Studio](https://vroid.com/en/studio/) 설치
2. 캐릭터 제작/수정
3. `Export VRM`으로 `.vrm` 내보내기
4. 앱에서 해당 `.vrm` 파일 선택

### VRM 사용 전 체크리스트

- 상업 이용 가능 여부
- 방송/영상 업로드 허용 여부
- 개조(수정) 허용 여부
- 재배포 금지 조건
- 크레딧 표기 조건

참고: 위 VRM 구하기/구매 가이드는 참고용이며, 실제 사용 전 각 모델의 최신 라이선스와 이용약관을 반드시 확인하세요.

## 기본 아바타 저작권 고지

본 앱에 내장된 기본 VRM 아바타는 저작권이 있는 자산입니다.

- 무단 복제, 추출, 재배포, 2차 가공을 금지합니다.
- 앱 내부에서만 사용 가능하며, 별도 이용은 불가합니다.
- 바이너리에 암호화되어 임베딩되어 있으며, 역공학을 통한 추출을 시도하지 마십시오.
- 위반 시 관련 법령에 따라 법적 조치가 가능합니다.

## 라이선스

BSD 2-Clause
