# AMA - AI My Avatar

화면 위를 자유롭게 이동하는 AI 아바타 데스크톱 앱입니다.
대화 입력(텍스트/음성), 음성 답변(TTS), VRM 아바타 상호작용을 제공합니다.

English version: [README.en.md](README.en.md) | 日本語版: [README.ja.md](README.ja.md)

> 버그 리포트, 기능 제안 등 피드백은 [jooparkhappy4@gmail.com](mailto:jooparkhappy4@gmail.com)으로 보내주세요.

<a href="https://github.com/sponsors/joopark4">
  <img src="https://img.shields.io/badge/Sponsor%20on%20GitHub-ea4aaa?style=for-the-badge&logo=github-sponsors&logoColor=white" alt="Sponsor on GitHub" height="60">
</a>
<a href="https://www.buymeacoffee.com/eunyeon">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-red.png" alt="Buy Me A Coffee" width="217" height="60">
</a>
<a href="https://toon.at/donate/heavyarm">
  <img src="https://img.shields.io/badge/Donate%20on%20Toonation-00B9F1?style=for-the-badge&logoColor=white" alt="Donate on Toonation" height="60">
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

## 사용 시 참고사항 (v2.0.0)

### 🔄 자동 업데이트
- **v2.0.0 이상 버전부터 앱 내 자동 업데이트 확인을 지원**합니다.
- 설정 → 앱 업데이트 → "업데이트 확인" 으로 수동 확인 가능, 24시간마다 백그라운드 자동 재확인.
- 업데이트가 있으면 우측 상단 알림 카드 → "설치" → 다운로드 → "재시작" 순으로 진행됩니다.
- v1.x 이하 옛 버전을 쓰던 사용자는 v2.0.0 dmg를 직접 받아 새로 설치해야 합니다 (옛 서명 키와 호환되지 않음).

### ✨ 프리미엄 음성 (베타)
프리미엄 음성(클라우드 TTS)은 **베타 기능으로 한정 제공**됩니다.

- **로그인한 사용자에 한해 사용 가능** (Google OAuth)
- **공유 자원 방식**: 모든 베타 사용자가 함께 소비하는 잔고에서 차감됩니다 — 개인 할당이 아닙니다.
- 자원 갱신 시점은 일정하지 않으며, 잔고가 소진되면 일시적으로 사용 불가합니다.
- 잔고 소진 시 **자동으로 로컬 음성(Supertonic)으로 전환**됩니다 — 사용자가 별도 조작할 필요 없음.
- **베타 기간이 종료되면 본 기능은 사전 공지 없이 비활성화될 수 있습니다.**
- 정식 출시 시점·방식은 별도 공지 예정 (구독제 또는 다른 형태일 수 있음).

> 잔고 상태가 안 보이거나 "공유잔고 정보를 가져올 수 없어요"가 뜨면 잔고가 모두 소진된 상태일 수 있습니다. 잠시 후 다시 시도하거나 로컬 음성을 그대로 사용하시면 됩니다.

### 💃 아바타 모션 (현재 한계)
- 현재 기본 모션 카탈로그는 **다소 여성스러운 동작 위주**로 구성되어 있습니다.
- 추후 다양한 성별·스타일의 모션을 추가할 예정입니다.
- 소스 빌드 사용자는 직접 [Mixamo](https://www.mixamo.com/)에서 FBX를 받아 `motions/mixamo/`에 추가한 뒤 `npm run motion:refresh`로 카탈로그를 재생성해 사용할 수 있습니다.

### 🤝 AI CLI 연결 상태 안내 (Codex / Gemini CLI / Claude Code Channels)
이들 외부 CLI는 **첫 대화 시점에 백엔드 프로세스가 자동 spawn**됩니다. 따라서 설치 직후 설정 패널의 연결 상태가 **"연결 안 됨"으로 보일 수 있습니다 — 정상 동작입니다.**

해결 절차:
1. 먼저 CLI가 정상 설치·로그인되었는지 확인합니다 (각 가이드의 "설치 상태 확인" 절 참고).
   ```bash
   codex --version       && codex login status        # OpenAI Codex CLI
   gemini --version      && gemini auth print          # Gemini CLI (ACP)
   claude --version                                    # Claude Code
   ```
2. 설정 → AI 모델에서 해당 Provider 를 선택합니다.
3. 아바타에게 **임의의 대화를 1~3회 진행**해 주세요.
4. 첫 대화 시점에 프로세스가 spawn되며, 그 직후부터 연결 상태가 "연결됨"으로 자동 갱신됩니다.

> 설치까지 마쳤는데도 대화 후 "연결 안 됨"이 유지되면, CLI 로그인 상태 또는 작업 폴더 접근 권한을 먼저 확인해 주세요. 위 가이드를 따랐는데도 동일하다면 [버그 리포트](mailto:jooparkhappy4@gmail.com)로 알려주시면 감사하겠습니다.

---

## 데모

> Claude Code Channels를 통한 AMA 아바타와 Claude Code 간 실시간 양방향 대화 데모입니다. 사용자가 AMA에서 질문하면 Claude Code가 응답하고, 아바타가 TTS로 음성 답변을 제공합니다.

<img src="public/demo/ccc-01.gif" alt="Claude Code Channels 데모" style="max-width:100%;height:auto;" width="360">

> OpenAI Codex CLI를 통한 AMA 아바타와 Codex 간 실시간 양방향 대화 데모입니다. 사용자가 AMA에서 질문하면 Codex가 코드 작업을 수행하고 응답하며, 아바타가 TTS로 음성 답변을 제공합니다.

<img src="public/demo/codex-demo.gif" alt="OpenAI Codex CLI 데모" style="max-width:100%;height:auto;" width="360">

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

#### 모션 파일 (Mixamo)

Mixamo 애니메이션 FBX 파일은 라이선스 제한으로 저장소에 포함되지 않습니다. [Mixamo](https://www.mixamo.com/)에서 직접 다운로드 후 `public/motions/mixamo/`에 배치해야 합니다.

> Mixamo 에셋은 프로젝트에 통합된 형태로만 사용 가능하며, 원본 FBX의 독립적 재배포는 허용되지 않습니다.

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

## 설정 메뉴 소개

설정 패널(우측 슬라이드)은 다음 항목으로 구성됩니다. 각 섹션은 카드 UI로 펼침/접힘이 가능하며, 펼침 상태는 다음 실행에 재현됩니다.

| 섹션 | 주요 기능 |
|---|---|
| 계정 | OAuth 로그인(Google) / 약관 동의 / 계정 삭제 |
| 언어 | 앱 UI 언어 (한국어 / English / 日本語) |
| AI 모델 | LLM provider 선택 — Ollama · LocalAI(로컬) / Claude · OpenAI · Gemini(클라우드) / Codex · Gemini CLI(로컬 CLI) |
| 오디오 디바이스 | 마이크 입력 / 스피커 출력 디바이스 독립 선택 + 마이크 피크 미터 |
| 음성 | STT 엔진(Whisper) · 모델 선택(base/small/medium) + 로컬 TTS(Supertonic) 음성/언어 + 글로벌 단축키 |
| 프리미엄 음성 | Supertone API 클라우드 TTS (구독 필요) + 음성/모델/스타일/사용량 대시보드 |
| 아바타 | VRM 파일 교체 / 표정 / 초기 시선 / 자유 이동 모드 / 말풍선 위치 / 애니메이션 / 물리 / 조명 |
| 화면 관찰 | Vision LLM 주기 관찰(능동 발화) — 캡처 대상 / 관찰 간격 / 응답 스타일 / 조용한 시간 |
| Claude Code Channels | MCP 서버 자동 등록 + Claude Code 양방향 대화 |
| Codex | OpenAI Codex CLI 연결 상태 / 모델 / 추론 성능 / 작업 폴더 / 접근 권한 |
| 앱 업데이트 | 현재 버전 / 업데이트 확인 / 다운로드 / 재시작 |
| 오픈소스 라이선스 | 사용 라이브러리·AI 서비스·모델의 라이선스 표기 |

> 설정 패널은 우상단 톱니 아이콘 또는 macOS 메뉴바 `AMA → Settings...` (`⌘,`)로 열 수 있습니다.

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

### OpenAI Codex CLI 사용 방법

AMA 아바타를 OpenAI Codex CLI와 연결하여 코딩 에이전트와 양방향 대화가 가능합니다.

#### 사전 요구사항

- [OpenAI Codex CLI](https://github.com/openai/codex) 설치 (`npm install -g @openai/codex`)
- Codex 로그인 완료 (`codex login`)

#### 설정 단계

1. AMA 앱 실행
2. `설정 > LLM Provider > Codex` 선택
3. Codex CLI 설치 상태와 로그인 상태가 자동으로 확인됩니다
4. 연결되면 추가 설정 가능:
   - **작업 폴더**: Codex가 코드를 읽고 쓸 디렉터리 (미지정 시 `~/Documents`)
   - **모델**: 연결 후 사용 가능한 모델 목록에서 선택
   - **추론 성능**: Low / Medium / High / Extra High
   - **접근 권한**: 요청 시 승인(기본) / 자동 승인 / 신뢰되지 않는 코드만 승인
5. AMA에서 대화 → Codex가 코드 작업 수행 후 응답 → 아바타 TTS

#### 주의사항

- Codex CLI는 백그라운드에서 `codex app-server`를 자동으로 실행합니다. 별도 터미널 작업이 필요 없습니다.
- 접근 권한을 "자동 승인"으로 설정하면 Codex가 파일 수정/실행을 자동 수행합니다. **신뢰할 수 있는 환경에서만 사용**하세요.
- Provider를 다른 모델로 전환하면 Codex 연결이 자동으로 종료됩니다.

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
| OpenAI Codex CLI | 코딩 에이전트 | Apache 2.0 License | [github.com/openai/codex](https://github.com/openai/codex) |
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
