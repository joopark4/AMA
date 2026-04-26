# 전체 구현 코드리뷰 (2026-04-26 확장)

## 검토 범위

- 이번 시점 워크트리 변경:
  - `CODE_REVIEW_2026-04-22.md` (본 파일, untracked)
- 따라서 이번 업데이트는 "변경분 리뷰"가 아니라 현재 `develop` 브랜치 기준의 전체 코드베이스 정적 리뷰로 확장했다.
- 주요 확인 영역:
  - 인증/OAuth: `src/App.tsx`, `src/components/auth/AuthScreen.tsx`, `src/components/auth/UserProfile.tsx`, `src/services/auth/authService.ts`, `src/services/auth/edgeFunctionClient.ts`, `src/stores/authStore.ts`
  - LLM/언어 라우팅: `src/hooks/useConversation.ts`, `src/features/channels/useClaudeCodeChat.ts`, `src/services/ai/llmRouter.ts`
  - 음성/TTS: `src/components/settings/VoiceSettings.tsx`, `src/services/voice/supertonicClient.ts`, `src/services/voice/ttsQueue.ts`, `src/services/voice/ttsRouter.ts`, `src/hooks/useSpeechSynthesis.ts`
  - 프리미엄 음성: `src/features/premium-voice/PremiumVoiceSettings.tsx`, `src/features/premium-voice/supertoneApiClient.ts`, `src/features/premium-voice/premiumStore.ts`
  - 런타임 연결: `src/features/codex/useCodexConnection.ts`, `src/features/gemini-cli/useGeminiCliConnection.ts`, `src/features/gemini-cli/geminiCliClient.ts`
  - 아바타/모션: `src/services/avatar/motionLibrary.ts`, `src/services/avatar/motionSelector.ts`, `src/config/motionManifest.json`, `motions/clean/catalog.json`
  - 설정/UI/i18n/docs: `src/components/ui/SettingsPanel.tsx`, `src/components/settings/SettingsSection.tsx`, `src/components/settings/forms.tsx`, `src/i18n/ko.json`, `src/i18n/en.json`, `src/i18n/ja.json`, `docs/settings/settings-system.md`, `docs/voice/voice-services.md`, `CLAUDE.md`
- 이전 리뷰에서 이미 추적한 관련 구현:
  - `src/stores/settingsStore.ts`
  - `src/services/voice/types.ts`
  - `src/services/ai/proactiveEngine.ts`
  - `src/features/screen-watch/screenWatchService.ts`

## 요약 판정

수정 권장. 기존에 확인한 언어/TTS 계약 불일치와 motion manifest 문제에 더해, 현재 인증 경로는 프로덕션 OAuth 딥링크 콜백을 실제로 처리하지 못하고, 콜드 스타트 딥링크도 런타임 상태 의존 때문에 버릴 수 있다. 타입 오류나 whitespace 오류는 없고 i18n 키 개수도 맞지만, 런타임 핵심 경로 몇 군데는 지금 상태로 배포 안정성을 보장하기 어렵다.

## Findings

### [P1] 프로덕션 OAuth 딥링크 콜백 리스너가 비활성화되어 로그인 완료가 막힘

- 위치:
  - `src/App.tsx:84-86`
  - `src/services/auth/authService.ts:25-29`
  - `src/components/auth/UserProfile.tsx:128-130`
- 조건:
  - Supabase 환경변수가 설정된 프로덕션 빌드
  - 사용자가 Google OAuth 로그인을 시도
- 문제:
  - 프로덕션 OAuth 리다이렉트 URL은 `mypartnerai://auth/callback`으로 설정되어 있다.
  - 그런데 이 콜백을 처리하는 유일한 프런트 리스너는 `App.tsx`에서 `if (!import.meta.env.DEV) return;`으로 감싸져 있어 개발 모드에서만 등록된다.
  - `UserProfile` 쪽 주석도 프로덕션에서는 `App.tsx` 딥링크 리스너가 처리한다고 전제하고 있어서, 현재 경로상 프로덕션 OAuth 완료를 받아줄 코드가 없다.
- 영향:
  - 개발 모드 폴링 경로를 쓰지 않는 실제 배포 앱에서는 OAuth 브라우저 로그인 이후 세션 교환이 일어나지 않아 로그인 완료가 막힌다.
- 권장 방향:
  - 딥링크 콜백 리스너를 프로덕션에서도 활성화하고, 개발 모드 전용 분기는 로컬 폴링 경로에만 남긴다.

### [P2] 앱 재시작 또는 콜드 스타트에서 OAuth 딥링크 콜백을 무시함

- 위치:
  - `src/App.tsx:110-113`
  - `src/stores/authStore.ts:12-16`
  - `src/stores/authStore.ts:74-80`
- 조건:
  - 사용자가 OAuth 브라우저 인증 중 앱을 다시 열었거나, 커스텀 스킴 딥링크로 앱이 새로 실행됨
  - 콜백 URL에는 `code`가 포함되어 있지만 `pendingProvider`가 비어 있음
- 문제:
  - 딥링크 리스너는 `pendingProvider`가 없으면 `handleCallback()`을 호출하지 않고 바로 반환한다.
  - 그런데 `pendingProvider`는 `authStore`의 런타임 상태로만 유지되고 persist 대상이 아니다.
  - 즉 앱이 재실행되거나 리로드된 뒤 도착한 정상 콜백은 provider 상태가 복원되지 않아 그대로 버려진다.
- 영향:
  - 프로덕션에서 커스텀 스킴이 앱을 새로 띄우는 환경이나, 로그인 중 앱 상태가 한 번 초기화되는 경우 OAuth 완료가 불안정해진다.
  - 사용자는 브라우저 인증을 끝냈는데 앱 쪽에서는 아무 일도 일어나지 않거나 타임아웃만 보게 된다.
- 권장 방향:
  - `code/state`가 유효하면 `pendingProvider` 없이도 콜백을 처리하도록 바꾸고, 필요하다면 최소한의 OAuth 진행 상태만 persist한다.

### [P2] auto textHint로 정한 LLM 언어가 TTS 합성 경로로 전달되지 않음

- 위치:
  - `src/hooks/useConversation.ts:792-793`
  - `src/features/channels/useClaudeCodeChat.ts:58-62`
  - `src/services/voice/supertonicClient.ts:570`, `src/services/voice/supertonicClient.ts:881-887`
  - `src/features/premium-voice/supertoneApiClient.ts:151-160`
  - `src/services/voice/types.ts:22-29`
- 조건:
  - `settings.tts.language === 'auto'`
  - UI 언어가 `ko`
  - 사용자가 영어 ASCII 입력을 보냄
  - TTS 엔진이 `supertonic`이거나, 프리미엄 엔진의 `apiSettings.language`가 `ko`
- 문제:
  - 새 변경은 `resolveResponseLanguage(text)`로 사용자 입력에서 `en`을 감지해 LLM 프롬프트를 영어로 만든다.
  - 하지만 TTS 경로는 이 결정값을 받지 않는다. `TTSOptions`에도 language 필드가 없고, `ttsQueue.start()`는 voice만 넘긴다.
  - Supertonic은 auto에서 "한글 포함이면 ko, 아니면 UI 언어"로 다시 판단하므로 영어 응답 텍스트를 `ko`로 합성할 수 있다.
  - Supertone API도 auto에서 `apiSettings.language || settings.language`를 사용하므로 LLM이 영어로 답했는데 API 합성 언어는 한국어가 될 수 있다.
- 영향:
  - 문서의 "TTS가 발음할 언어와 LLM 응답 언어를 일치"한다는 보장이 실제 대화 경로에서 깨진다.
  - 기본 한국어 UI 사용자도 영어 입력을 한 번 보내면 영어 텍스트를 한국어 TTS 설정으로 읽는 품질 문제가 발생할 수 있다.
- 권장 방향:
  - 턴 시작 시 계산한 `responseLanguage`를 `TTSOptions` 또는 별도 턴 컨텍스트로 `ttsQueue`, `useSpeechSynthesis`, `ttsRouter`, 각 TTS client까지 전달한다.
  - 또는 LLM과 TTS가 동일한 공용 resolver를 사용하도록 만들고, auto textHint 결과를 응답 텍스트 합성 시점까지 보존한다.

### [P2] 프리미엄 모델 미지원 언어 폴백이 LLM 프롬프트에 반영되지 않음

- 위치:
  - `src/hooks/useConversation.ts:92-95`
  - `src/features/premium-voice/supertoneApiClient.ts:153-164`
  - `src/features/premium-voice/supertoneApiClient.ts:18-21`
- 조건:
  - `settings.tts.engine === 'supertone_api'`
  - 모델이 `sona_speech_1`
  - 사용자가 공용 TTS 언어에서 `es`, `pt`, `fr` 중 하나를 선택
- 문제:
  - `resolveResponseLanguage()`는 Supertonic 미지원 언어만 `en`으로 강제하고, Supertone API 모델별 지원 언어는 보지 않는다.
  - 반면 `supertoneApiClient.synthesize()`는 `getModelLanguages(apiSettings.model)`에서 미지원이면 최종 합성 언어를 `en`으로 바꾼다.
  - 결과적으로 LLM은 스페인어/포르투갈어/프랑스어 응답을 만들고, TTS는 영어 언어 설정으로 그 텍스트를 합성할 수 있다.
- 영향:
  - 프리미엄 TTS에서 모델 선택과 언어 선택 조합에 따라 응답 텍스트 언어와 실제 합성 언어가 어긋난다.
  - 사용자는 UI에서 언어를 선택했는데 결과 음성이 의도와 다르게 들리는 상태를 겪을 수 있다.
- 권장 방향:
  - `resolveResponseLanguage()`가 프리미엄 엔진일 때도 `getModelLanguages(model)` 기준으로 최종 언어를 산출한다.
  - 또는 VoiceSettings/PremiumVoiceSettings에서 현재 모델이 지원하지 않는 공용 언어 선택을 막거나 즉시 지원 언어로 정규화한다.

### [P2] 프리미엄 언어/모델 변경 후 선택 음성 호환성을 재검증하지 않음

- 위치:
  - `src/features/premium-voice/PremiumVoiceSettings.tsx:139-160`
  - `src/features/premium-voice/PremiumVoiceSettings.tsx:265-275`
  - `src/features/premium-voice/supertoneApiClient.ts:200-212`
  - `src/features/premium-voice/premiumStore.ts:16-22`
- 조건:
  - 프리미엄 엔진(`supertone_api`) 사용
  - 사용자가 A 언어를 지원하는 음성을 선택한 뒤 B 언어 또는 모델로 변경
  - 기존 `voiceId`가 새 `effectiveTtsLanguage`를 지원하지 않음
- 문제:
  - `handleLanguageChange()`와 `handleModelChange()`는 `language`/`model`만 바꾸고 기존 `voiceId`를 유지한다.
  - 화면의 음성 목록은 `filteredVoices`로 새 언어를 지원하는 음성만 보여주지만, 실제 `selectedVoice`와 저장된 `voiceId`는 필터 밖의 비호환 음성일 수 있다.
  - `supertoneApiClient.synthesize()`는 모델 지원 언어만 확인하고, 선택 음성의 `languages`에는 해당 언어가 있는지 검증하지 않은 채 Edge Function에 요청한다.
- 영향:
  - UI에는 새 언어 기준 목록이 보이는데 실제 합성은 이전 음성 ID로 요청되어 API 실패 또는 로컬 폴백이 발생할 수 있다.
  - 사용자는 언어를 바꾼 뒤 음성을 다시 선택해야 한다는 사실을 알기 어렵다.
- 권장 방향:
  - 언어/모델 변경 시 현재 `voiceId`가 새 언어를 지원하는지 확인하고, 미지원이면 호환 가능한 기본 음성으로 자동 전환하거나 명시적으로 선택 해제한다.
  - 합성 직전에도 `voices.find(v => v.voice_id === voiceId)?.languages.includes(language)`를 검증해 API 실패 전에 사용자에게 명확한 오류를 반환한다.

### [P2] motion manifest가 비어 있어 모션 선택 테스트와 런타임 클립 경로가 무력화됨

- 위치:
  - `src/config/motionManifest.json:1-5`
  - `motions/clean/catalog.json:1-9`
  - `src/services/avatar/motionLibrary.test.ts:13-25`
  - `src/services/avatar/motionSelector.test.ts:18-37`
- 조건:
  - 현재 checkout에서 `npm test -- --run` 실행
  - 앱이 `getMotionManifest()` 기반 motion clip 선택을 시도
- 문제:
  - 현재 manifest와 clean catalog의 `clips`가 빈 배열이다.
  - 테스트는 최소 24개 clip과 라이선스 메타데이터를 기대하고, selector 테스트도 clip 후보가 없어서 `selected === null`로 실패한다.
- 영향:
  - 현재 전체 테스트가 8건 실패한다.
  - 런타임에서도 motion clip 후보가 없어 감정 기반 motion clip 선택은 fallback gesture에만 의존하게 된다.
- 권장 방향:
  - `motions/clean/catalog.generated.json` 또는 실제 clean catalog를 `src/config/motionManifest.json`으로 정상 import하는 파이프라인을 복구한다.
  - 테스트 실행 전 필요한 asset import 단계가 있다면 `npm test` 또는 문서에 명시해 기본 검증 명령이 실패하지 않도록 한다.

### [P3] Codex/Gemini CLI 상태 새로고침이 끊긴 연결을 disconnected로 반영하지 않음

- 위치:
  - `src/features/codex/useCodexConnection.ts:93-104`
  - `src/features/gemini-cli/useGeminiCliConnection.ts:100-111`
- 조건:
  - Codex 또는 Gemini CLI가 한 번 연결된 뒤 외부 종료, 충돌, 수동 stop 등으로 실제 프로세스가 끊김
  - 사용자가 설정 패널에서 `새로고침`을 눌러 상태를 다시 조회
- 문제:
  - 두 훅 모두 `*_get_status()` 결과가 `connected`일 때만 `setConnectionState('connected')`를 호출한다.
  - 반대로 `connected: false`가 돌아와도 `disconnected`로 내리지 않아서, 이전에 연결됐던 UI 상태가 그대로 남는다.
- 영향:
  - 설정 화면은 연결 점과 모델 목록을 계속 보여주는데 실제 다음 요청은 시작 실패 또는 재기동 경로를 타게 된다.
  - 사용자는 문제를 진단하려고 `새로고침`을 눌러도 상태가 갱신되지 않아 원인을 오판하기 쉽다.
- 권장 방향:
  - `refreshStatus()`에서 `statusResult.connected ? 'connected' : 'disconnected'`로 상태를 항상 덮어쓰고, 필요하면 오류 메시지도 함께 초기화한다.

### [P3] Vision 미지원 provider에서는 Screen Watch가 꺼진 것처럼 보이지만 실제 설정은 유지됨

- 위치:
  - `src/features/screen-watch/ScreenWatchSettings.tsx:22-23`
  - `src/features/screen-watch/ScreenWatchSettings.tsx:148-152`
  - `src/features/screen-watch/useScreenWatcher.ts:34-35`
  - `src/features/screen-watch/useScreenWatcher.ts:47-61`
- 조건:
  - 사용자가 OpenAI/Claude/Gemini/Codex/Gemini CLI 등 Vision 지원 provider에서 Screen Watch를 켠 상태
  - 이후 `ollama`, `localai`, `claude_code` 같은 Vision 미지원 provider로 전환
- 문제:
  - 설정 UI의 토글은 `on={watch.enabled && visionOk}`라서 미지원 provider로 바꾸면 꺼진 것처럼 보인다.
  - 하지만 실제 저장값 `settings.screenWatch.enabled`는 그대로 `true`로 남고, `useScreenWatcher`는 런타임 루프만 멈출 뿐 설정값을 내리지 않는다.
- 영향:
  - 사용자는 Screen Watch가 꺼졌다고 이해하기 쉽지만, Vision 지원 provider로 다시 전환하는 순간 별도 확인 없이 자동 재활성화된다.
  - UI 표시와 persist 상태가 어긋나서 기능 재개 원인을 추적하기 어려워진다.
- 권장 방향:
  - 미지원 provider로 전환될 때 `enabled`를 실제로 `false`로 정규화하거나, 최소한 UI에서 "현재는 일시 중지 상태지만 설정은 유지됨"을 명확히 드러내야 한다.

### [P3] ASCII 전용 입력을 모두 영어로 감지해 auto 모드의 UI 언어 폴백을 우회함

- 위치:
  - `src/hooks/useConversation.ts:60-61`
- 조건:
  - `settings.tts.language === 'auto'`
  - 사용자가 `123`, `?`, `...`, URL, 짧은 코드/명령처럼 언어 신호가 약한 ASCII 입력을 보냄
  - UI 언어가 `ko` 또는 `ja`
- 문제:
  - 현재 휴리스틱은 `^[\x00-\x7F\s]+$`에 맞는 모든 입력을 `en`으로 처리한다.
  - 숫자와 문장부호만 있는 입력도 영어로 강제되어, 실제로는 언어 감지 실패 후 UI 언어로 폴백해야 할 케이스가 영어 응답으로 바뀐다.
- 영향:
  - 한국어/일본어 UI 사용자가 숫자, 기호, 짧은 명령, 코드 조각을 보낼 때 응답 언어가 갑자기 영어로 바뀔 수 있다.
- 권장 방향:
  - ASCII 감지는 최소한 `[A-Za-z]` 존재 여부나 alphabetic 비율을 확인한 뒤 `en`으로 판단한다.
  - 언어 신호가 약한 입력은 `null`을 반환해 기존 UI 언어 폴백을 유지한다.

### [P3] 캐릭터 프로필이 비었을 때 es/pt/fr 언어 선택이 영어 프롬프트로 폴백됨

- 위치:
  - `src/hooks/useConversation.ts:150-170`
  - `src/hooks/useConversation.ts:792-800`
- 조건:
  - 사용자가 `settings.tts.language`를 `es`, `pt`, `fr` 중 하나로 선택
  - 캐릭터 이름이 비어 있고 traits도 모두 비어 있어 `buildCharacterPrompt()` 경로를 타지 않음
- 문제:
  - `buildCharacterPrompt()`는 es/pt/fr Layer 0 언어 지시를 지원한다.
  - 하지만 legacy `buildSystemPrompt()` 경로는 `ko/en/ja` 템플릿만 두고 es/pt/fr는 `en`으로 강제 폴백한다.
- 영향:
  - 캐릭터 설정을 거의 비워 둔 사용자는 스페인어/포르투갈어/프랑스어 TTS 언어를 선택해도 LLM 응답 프롬프트는 영어가 된다.
- 권장 방향:
  - legacy 경로에도 es/pt/fr languageDirective를 추가하거나, 캐릭터가 비어도 최소 `DEFAULT_CHARACTER_PROFILE` 기반 `buildCharacterPrompt()`를 사용해 언어 Layer 0을 항상 적용한다.

### [P3] 문서의 "UI 언어는 대화에 영향 없음" 설명이 실제 auto 경로와 다름

- 위치:
  - `docs/voice/voice-services.md:210-212`
  - `CLAUDE.md:149-153`
  - 실제 코드: `src/hooks/useConversation.ts:87-89`, `src/services/ai/proactiveEngine.ts:217-218`, `src/features/screen-watch/screenWatchService.ts:234-238`
- 문제:
  - 문서는 `settings.language`를 앱 UI 전용이며 대화 응답 언어에 직접 영향이 없다고 설명한다.
  - 실제 구현에서는 `tts.language=auto`에서 textHint 감지 실패 시 `settings.language`로 폴백한다.
  - proactive/screen-watch 경로는 textHint가 없어서 auto일 때 UI 언어가 사실상 응답 언어 결정에 직접 사용된다.
- 영향:
  - 추후 유지보수자가 UI 언어 변경이 대화/자발 발화/화면 관찰 응답 언어에 영향을 주지 않는다고 오해할 수 있다.
- 권장 방향:
  - "UI 언어는 명시 언어가 없거나 auto 감지 실패 시 fallback으로만 대화 언어에 관여한다"처럼 실제 동작 기준으로 문구를 좁힌다.

### [P3] 프롬프트 유틸이 hook 파일에 있어 settings/feature 모듈 간 순환 의존이 생김

- 위치:
  - `src/hooks/useConversation.ts:17-24`
  - `src/features/channels/useClaudeCodeChat.ts:15`
  - `src/components/settings/VoiceSettings.tsx:17`
- 문제:
  - `useConversation.ts`는 `useClaudeCodeChat`을 import하고, `useClaudeCodeChat.ts`는 다시 `useConversation.ts`에서 `buildSystemPrompt`와 `resolveResponseLanguage`를 import한다.
  - `VoiceSettings`도 테스트 샘플 언어 계산을 위해 전체 conversation hook 모듈을 import한다.
- 영향:
  - 지금은 함수 본문 실행 전 순환 참조가 터지지 않는 구조지만, 프롬프트/언어 유틸을 재사용할 때 hooks, channels, settings, LLM 라우터가 불필요하게 한 묶음으로 결합된다.
  - HMR 또는 초기화 순서가 바뀌는 리팩터에서 TDZ/undefined export류 문제가 생기기 쉬운 구조다.
- 권장 방향:
  - `resolveResponseLanguage`, `buildSystemPrompt`, legacy prompt template을 `src/services/ai` 또는 `src/services/character` 하위 순수 모듈로 이동한다.
  - hooks와 UI 컴포넌트는 그 순수 모듈만 import하게 만들어 순환 의존을 끊는다.

### [P3] 설정 아코디언과 Pill 선택 UI의 접근성 상태가 DOM에 노출되지 않음

- 위치:
  - `src/components/settings/SettingsSection.tsx:58-63`
  - `src/components/settings/forms.tsx:99-120`
  - `src/components/settings/VoiceSettings.tsx:309-315`
  - `src/features/premium-voice/PremiumVoiceSettings.tsx:351-362`
- 문제:
  - `SettingsSection` 버튼은 시각적으로 열림/닫힘을 표현하지만 `aria-expanded`가 없다.
  - `Pill`은 active 색상만 바뀌고 `aria-pressed` 또는 radio-group 역할이 없어 현재 선택 상태가 보조기술에 전달되지 않는다.
- 영향:
  - 키보드/스크린리더 사용자는 설정 섹션의 열림 상태나 TTS 언어/엔진 선택 상태를 파악하기 어렵다.
- 권장 방향:
  - 아코디언 헤더에 `aria-expanded={isOpen}`와 `aria-controls`를 추가한다.
  - 단일 선택 Pill 그룹은 `role="radiogroup"`/`role="radio"` 또는 최소 `aria-pressed={active}`를 제공한다.

## Verified OK

- `settingsPanelExpanded`는 기본값 `{}`와 migration v21, normalize 경로, `SettingsPanel` controlled props 연결이 일관된다.
- `tts.language`는 `settingsStore`에서 `auto / ko / en / ja / es / pt / fr`로 정규화된다.
- `VoiceSettings`의 ja 경고 조건은 Supertonic 엔진에서만 표시되어 현재 UI 주석과 맞는다.
- `useConversation.sendMessage`와 `useClaudeCodeChat` 양쪽 모두 사용자 입력을 `resolveResponseLanguage(text)`로 넘기도록 변경되어 LLM 프롬프트 경로 자체는 통일되어 있다.
- `ko/en/ja` i18n JSON 키 개수는 현재 서로 일치한다.
- `SettingsPanel`의 `settingsPanelExpanded` controlled 전달, `toggleSettingsPanelSection(key)` persist 연결, v21 migration은 서로 맞물려 있다.
- `git diff --check` 기준 whitespace 오류는 없다.
- Gemini CLI는 `App.tsx` 자동 연결은 없지만 실제 대화 경로에서는 `geminiCliClient.ensureStarted()`를 통해 첫 요청 시 프로세스를 기동하도록 구현되어 있다.

## 검증

- `git diff --check`: 통과
- `npx tsc --noEmit`: 통과
- `npm test -- --run`: 실패
  - `src/services/avatar/motionLibrary.test.ts`: 3건 실패
  - `src/services/avatar/motionSelector.test.ts`: 5건 실패
  - 공통 원인: `src/config/motionManifest.json` / `motions/clean/catalog.json`의 `clips`가 빈 배열
- `git status --short`: `?? CODE_REVIEW_2026-04-22.md`
