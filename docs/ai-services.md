# AI 서비스

MyPartnerAI는 하나의 라우터(`llmRouter`)를 통해 여러 LLM 제공자를 교체 가능하게 사용합니다.

## 지원 Provider

| Provider | 유형 | 연결 조건 |
|----------|------|----------|
| Ollama | 로컬 | `endpoint` + `model` |
| LocalAI | 로컬 | `endpoint` + `model` |
| Claude | 클라우드 | `apiKey` + `model` |
| OpenAI | 클라우드 | `apiKey` + `model` |
| Gemini | 클라우드 | `apiKey` + `model` |

기본값은 `ollama / deepseek-v3 / http://localhost:11434` 입니다.

## 핵심 파일

- `src/services/ai/llmRouter.ts`
- `src/services/ai/{ollamaClient,localAiClient,claudeClient,openaiClient,geminiClient}.ts`
- `src/services/ai/screenAnalyzer.ts`
- `src/stores/settingsStore.ts` (`settings.llm`)

## 동작 흐름

1. 사용자가 텍스트 또는 음성으로 입력
2. `useConversation.sendMessage()`에서 system prompt + 대화 히스토리 구성
3. `llmRouter.chat()` 호출
4. 현재 `settings.llm.provider`에 맞는 client가 실제 API 호출
5. 응답 텍스트를 UI/음성(TTS)로 전달

## Vision(화면 분석)

- 화면 분석은 `screenAnalyzer`가 `capture_screen` 명령으로 스크린샷을 받아 처리합니다.
- Vision 지원 Provider: `claude`, `openai`, `gemini`
- `ollama/localai`에서 화면 분석 요청 시 지원 불가 오류를 반환합니다.

## 설정/의존성 가이드

`StatusIndicator`는 아래 상태를 감지해 설치/설정 안내를 표시합니다.

- 모델 미선택
- 엔드포인트 누락(Ollama/LocalAI)
- API 키 누락(Claude/OpenAI/Gemini)
- 로컬 서버 미기동
- 로컬 모델 미다운로드

UI 동작:
- 필수 항목 미설정이면 안내 모달 자동 오픈
- 설정 버튼으로 즉시 `SettingsPanel` 진입 가능

## 개발 시 체크포인트

- Provider를 추가할 때:
  1. `LLMProvider` 타입 확장
  2. 해당 client 구현(`chat`, `chatStream`, `isAvailable`)
  3. `llmRouter.initializeClients()` 등록
  4. 설정 UI/가이드 문구 추가

- Vision 지원 추가 시:
  - `screenAnalyzer.analyzeScreen()` switch 분기와 client의 vision 메서드 동시 확장
