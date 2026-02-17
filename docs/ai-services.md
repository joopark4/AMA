# AI 서비스

MyPartnerAI는 `llmRouter` 하나로 로컬/클라우드 LLM을 전환합니다.

## 지원 Provider

| Provider | 유형 | 필수 설정 |
|----------|------|-----------|
| Ollama | 로컬 | `endpoint` + `model` |
| LocalAI | 로컬 | `endpoint` + `model` |
| Claude | 클라우드 | `apiKey` + `model` |
| OpenAI | 클라우드 | `apiKey` + `model` |
| Gemini | 클라우드 | `apiKey` + `model` |

기본값: `ollama / deepseek-v3 / http://localhost:11434`

클라우드 기본 추천 모델:
- Claude: `claude-sonnet-4-5`, `claude-haiku-4-5`, `claude-opus-4-6`
- OpenAI: `gpt-5.1`, `gpt-5-mini`, `gpt-4.1`, `gpt-4o-mini`
- Gemini: `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-pro`

## 핵심 파일

- `src/services/ai/llmRouter.ts`
- `src/services/ai/ollamaClient.ts`
- `src/services/ai/localAiClient.ts`
- `src/services/ai/claudeClient.ts`
- `src/services/ai/openaiClient.ts`
- `src/services/ai/geminiClient.ts`
- `src/services/ai/screenAnalyzer.ts`
- `src/components/settings/LLMSettings.tsx`

## 대화 처리 흐름

1. `useConversation.sendMessage()`에서 사용자 입력 수신
2. `buildSystemPrompt(avatarName)`로 아바타 이름 반영 system prompt 생성
3. 대화 히스토리를 `llmRouter.chat()`에 전달
4. 현재 `settings.llm.provider`에 맞는 client 호출
5. 응답 텍스트를 UI 말풍선 + TTS로 동시 반영

## Vision(화면 분석)

- `screenAnalyzer`가 Tauri `capture_screen`으로 스크린샷(base64)을 취득
- Vision 지원 provider: `claude`, `openai`, `gemini`
- `ollama/localai`에서 Vision 요청 시 `Vision not supported` 에러 반환

## 설정 UI 동작

- `LLMSettings`는 provider별 모델 목록을 표시
- `ollama/localai`는 endpoint 입력 필드 노출
- `claude/openai/gemini`는 API Key 입력 필드 노출
- LLM 섹션은 접기/펼치기 지원

### 클라우드 모델 목록 동기화

API Key가 입력되면 provider별 모델 목록을 조회해 드롭다운을 갱신합니다.

- OpenAI: SDK `models.list()` 결과 사용
- Claude: `GET https://api.anthropic.com/v1/models` 결과 사용
- Gemini: `GET https://generativelanguage.googleapis.com/v1beta/models` 결과 사용

목록 조회가 실패하면, 기본 후보 모델들에 대해 최소 요청(ping)으로 사용 가능 여부를 점검하는 폴백 경로를 사용합니다.

## 런타임 점검/안내

`StatusIndicator`가 아래를 감지해 설치 안내 모달을 자동으로 띄웁니다.

- 모델 미설정
- endpoint 미설정 (로컬 provider)
- API 키 미설정 (클라우드 provider)
- 로컬 서버 미기동
- 선택 모델 미설치
- 클라우드 모델 목록 조회 실패(폴백 점검으로 자동 전환)

## 확장 가이드

새 provider 추가 시 최소 변경 지점:

1. `LLMProvider` 타입 확장 (`settingsStore`)
2. 신규 client 구현 (`chat`, `chatStream`, `isAvailable`)
3. `llmRouter.initializeClients()` 등록
4. `LLMSettings` 옵션/가이드 문구 추가
5. 필요 시 `screenAnalyzer` Vision 분기 추가
