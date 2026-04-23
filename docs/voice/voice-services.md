# 음성 서비스

음성 스택은 **Whisper(STT)** + **Supertonic(로컬 TTS)** / **Supertone API(클라우드 TTS)** 이중 경로입니다.

## 현재 구성

| 기능 | 엔진 | 상태 |
|------|------|------|
| STT | whisper.cpp (`whisper-cli`) | 사용 중 |
| STT 모델 | `base`, `small`, `medium` | 사용 중 |
| TTS (로컬) | Supertonic + onnxruntime-web | 사용 중 (기본) |
| TTS (클라우드) | Supertone API (Edge Function 프록시) | 사용 중 (프리미엄) |
| TTS 음성 (로컬) | `F1~F5`, `M1~M5` | 사용 중 |
| TTS 음성 (클라우드) | Supertone API 동적 조회 | 사용 중 |

## STT 파이프라인

### 프런트엔드

- `audioProcessor.startRecording()`로 녹음 시작
- 중지 시 `16kHz mono PCM WAV` 생성
- `invoke('transcribe_audio', { audioBase64, model, language })` 호출

주요 파일:
- `src/services/voice/audioProcessor.ts`
- `src/hooks/useConversation.ts`

### 백엔드

- `voice.rs::transcribe_audio`
  - base64 WAV 디코드
  - `whisper-cli` 경로 탐색
  - 모델 경로 탐색
  - 임시 파일에 WAV 저장
  - `whisper-cli` 실행 후 txt 결과 반환

주요 파일:
- `src-tauri/src/commands/voice.rs`

## Whisper 탐색 우선순위

1. 환경변수 (`WHISPER_CLI_PATH`, `WHISPER_MODEL_PATH`)
2. 앱 번들 리소스 (`Contents/Resources/bin`, `Contents/Resources/models`)
3. 프로젝트/작업 디렉터리 (`models/whisper`, `public/models/whisper` 등)
4. 시스템 PATH (`/opt/homebrew/bin/whisper-cli` 등)

## 원격 세션 정책

- `detect_remote_environment`가 SSH/원격툴 흔적을 검사
- 원격 세션이면 STT를 런타임 차단
- 차단 시 마이크 버튼은 눌려도 인식 시작 대신 안내 메시지 표시

## TTS 파이프라인

### 엔진 선택
`ttsRouter`가 설정(`settings.tts.engine`)에 따라 적절한 클라이언트를 선택합니다:
- `supertonic` → `supertonicClient` (로컬 ONNX)
- `supertone_api` → `supertoneApiClient` (클라우드)

`supertone_api` 선택 시 할당량 소진 여부를 `premiumStore.isQuotaExceeded`로 확인하고, 소진이면 로컬로 자동 폴백합니다.

### 로컬 TTS (Supertonic)

1. `useSpeechSynthesis.speak(text)` 호출
2. `ttsRouter.playAudio(text)`
3. `supertonicClient.synthesize()`로 WAV 생성
4. HTMLAudio 재생 시도
5. 실패하면 WebAudio decode/play로 fallback

### 클라우드 TTS (Supertone API)

1. `useSpeechSynthesis.speak(text)` 호출
2. `ttsRouter.playAudio(text)` → `supertoneApiClient.synthesize()`
3. 텍스트를 300자 이하 청크로 분할
4. 각 청크에 대해 `callEdgeFunction('supertone-tts', ...)` 호출
5. Edge Function: JWT 검증 → 프리미엄 확인 → 할당량 검사 → Supertone API 호출
6. WAV 청크를 결합 (청크 사이 100ms 무음 삽입)
7. HTMLAudio 재생 시도 → 실패하면 WebAudio fallback
8. 에러 발생 시 로컬 Supertonic으로 자동 폴백 + 토스트 알림

주요 파일:
- `src/hooks/useSpeechSynthesis.ts`
- `src/services/voice/ttsRouter.ts`
- `src/services/voice/supertonicClient.ts`
- `src/services/voice/supertoneApiClient.ts`
- `src/services/auth/edgeFunctionClient.ts`

## Supertonic 모델 로딩 우선순위

1. Tauri 리소스 경로
   - `models/supertonic`
   - `_up_/models/supertonic`
2. 웹 경로
   - `/models/supertonic`

필수 하위 폴더:
- `onnx/`
- `voice_styles/`

## Supertone API 클라이언트

### 지원 모델/언어

| 모델 | 지원 언어 |
|------|----------|
| `sona_speech_1` | ko, en, ja |
| `sona_speech_2` | ko, en, ja, zh + 19개 언어 |
| `sona_speech_2_flash` | sona_speech_2와 동일 (경량) |

### 감정 → 스타일 자동 매핑

`autoEmotionStyle` 활성화 시 AI 응답 감정을 Supertone 스타일로 변환:
- happy → happy, sad → sad, angry → angry, surprised → surprised
- relaxed/thinking/neutral → neutral

### Edge Function 프록시 (`supertone-tts`)

1. JWT 검증 (Supabase Auth)
2. `profiles` 테이블에서 프리미엄 상태/플랜 확인
3. `tts_usage` 테이블에서 월간 사용량 합산 → 할당량 초과 여부 검사
4. Supertone API 호출 (`x-sup-api-key` 헤더로 서버 측 API 키 주입)
5. 사용량 기록 (1초 = 1크레딧)
6. 오디오 바이너리 + 할당량 정보 헤더(`X-Quota-Used/Limit/Remaining`) 반환

### Edge Function Client (`edgeFunctionClient.ts`)

- `supabase.functions.invoke()` 기반
- `persistSession: false` 환경에서 세션 자동 복원 (싱글턴)
- 401 응답 시 세션 무효화 후 1회 자동 재시도
- `QuotaExceededError` 전용 에러 클래스

## TTS-말풍선 동기화 (onPlaybackStart)

TTS 합성이 완료되고 실제 오디오 재생이 시작되는 시점에 말풍선을 표시하여, 음성과 말풍선이 동시에 나타나도록 한다.

### 동작 흐름

1. AI 응답 수신 → `clearCurrentResponse()` (이전 말풍선 즉시 제거)
2. `ttsRouter.playAudio(text, { onPlaybackStart })` 호출
3. TTS 합성 (로컬 ONNX 또는 클라우드 API)
4. `playViaMediaStream()` → `audio.play()` 성공 시 `onPlaybackStart()` 콜백 실행
5. 콜백 내에서 `setCurrentResponse(text)` → **말풍선 표시** (오디오와 동시)
6. TTS 완료 → `responseClearMs`(2초) 후 `clearCurrentResponse()` → 말풍선 제거
7. 표정은 별도 `expressionHoldMs` 타이머로 독립 초기화

### 적용 경로

| 경로 | 파일 |
|------|------|
| 일반 채팅 (Ollama/Claude/OpenAI/Gemini/LocalAI/Codex) | `useConversation.ts` |
| 음성 명령 피드백 | `useConversation.ts` |
| Claude Code Channels | `useClaudeCodeChat.ts` |
| 외부 알림 (ci-webhook, monitor-alert) | `responseProcessor.ts` |

### TTS 실패 폴백

TTS 합성/재생이 실패하더라도 `currentResponse !== responseText` 검사로 말풍선을 강제 표시한다. 사용자는 항상 AI 응답을 볼 수 있다.

### SpeechBubble 컴포넌트

- 내부 타이머 없음 — `currentResponse` 상태로 순수하게 제어
- `App.tsx`에서 `currentResponse && settings.avatar.showSpeechBubble !== false` 조건으로 렌더링

## 오디오 디바이스 선택

### 마이크 입력

- `settings.stt.audioInputDeviceId`에 선택된 디바이스 ID 저장
- `audioProcessor.reinitialize(deviceId)`로 녹음 디바이스 전환
- AudioDeviceSettings에서 마이크 피크 미터 실시간 표시

### 스피커 출력

- `settings.tts.audioOutputDeviceId`에 선택된 디바이스 ID 저장
- `ttsRouter.prepareOutputDevice(deviceId)` — 사용자 제스처 컨텍스트에서 `setSinkId` 적용
- WKWebView에서 `setSinkId`는 제스처 없이 호출하면 거부됨 → 테스트 버튼 클릭 시 동시 생성으로 해결 (#019)

## 설정 UI

- `VoiceSettings`:
  - STT 모델 선택: `base`, `small`, `medium`
  - TTS 보이스 선택: `F1~F5`, `M1~M5`
  - **대화·음성 언어 선택** (Pill 리스트, `settings.tts.language`): `auto / ko / en / ja / es / pt / fr`
    - `auto`는 앱 UI 언어(`settings.language`)를 그대로 사용한다는 의미 (텍스트 감지 아님)
    - `<select>`가 WKWebView + glass 배경에서 내부 텍스트가 렌더 누락되는 이슈가 있어 Pill 버튼 리스트로 구현
    - Supertonic(로컬)은 `ja` 미지원이므로 선택 시 경고 표시 + 런타임에 `en`으로 폴백 (LLM/TTS 모두)
  - TTS 테스트 버튼: 현재 엔진 + 대화·음성 언어 조합에 맞춘 네이티브 샘플 문장 재생
- `PremiumVoiceSettings`:
  - TTS 엔진 선택 (로컬 / 클라우드)
  - 모델/언어/음성/스타일 선택
  - 언어 드롭다운은 공용 `settings.tts.language`와 동기화 (변경 시 양쪽 동시 반영)
  - 로컬 → 프리미엄 엔진 전환 시 `voiceId`가 비어있으면 **Bella**를 기본값으로 자동 주입 (synthesize 실패로 로컬 폴백되던 현상 방지)
  - 감정 자동 매핑 토글
  - 음성 미세 조정 (pitchShift, pitchVariance, speed)
  - 사용량/할당량 모니터링
- 엔진 타입:
  - STT: `whisper` (강제)
  - TTS: `supertonic` (기본) 또는 `supertone_api` (프리미엄)

## 대화·음성 언어 계약

사용자 요구사항:
- **`settings.language`는 앱 UI 전용** (메뉴/라벨). 대화 내용 언어에는 영향을 주지 않는다.
- **`settings.tts.language`가 대화·음성 언어의 단일 진실**. LLM 응답과 TTS 합성이 같은 값을 공유해 발음이 엇갈리지 않도록 한다.
- **`auto`는 "앱 UI 언어(`settings.language`)를 그대로 따라간다"는 의미**. 입력 텍스트 기반 감지는 하지 않는다(초기 구현에 있었지만 요구사항 외 기능이라 제거).
- **엔진 제약**: Supertonic(로컬)은 `ko/en/es/pt/fr`만 지원. 사용자가 `ja` 등 미지원 언어를 선택하거나 `auto`로 UI 언어가 `ja`로 가는 경우, 런타임에 `en`으로 폴백하고 설정 UI에 경고를 표시한다.

### 결정 테이블

| 조건 | LLM 응답 언어 | Supertonic 합성 언어 |
|------|----------------|----------------------|
| `tts.language !== 'auto'` + 엔진 지원 | `tts.language` | `tts.language` |
| `tts.language !== 'auto'` + Supertonic 미지원 | `tts.language` 그대로 요청되면 → 엔진 제약이 걸려 `en` | `en` |
| `tts.language === 'auto'` + UI 언어 지원 | `settings.language` | `settings.language` |
| `tts.language === 'auto'` + UI 언어가 `ja`면서 엔진 `supertonic` | `en` | `en` |

### 결정자

| 파일 | 함수 | 역할 |
|------|------|------|
| `src/hooks/useConversation.ts` | `resolveResponseLanguage()` | LLM 프롬프트 주입용 응답 언어 결정 |
| `src/services/voice/supertonicClient.ts` | `SupertonicClient.detectLanguage()` | 로컬 ONNX 합성 시 사용할 언어 태그 결정 |
| `src/features/premium-voice/supertoneApiClient.ts` | `SupertoneApiClient.synthesize()` | 클라우드 API에 전달할 `language` 파라미터 결정 |

세 결정자 모두 **같은 기준**(`tts.language` → auto면 UI 언어 → 엔진 제약 폴백)을 사용해 동일한 언어를 산출한다.

### 호출 경로

| 경로 | 설명 |
|------|------|
| `useConversation.sendMessage` | 사용자 메시지 처리. `resolveResponseLanguage()`로 시스템 프롬프트 언어 결정 |
| `useClaudeCodeChat.sendMessage` | Claude Code Channels 경로에서 동일 결정자 호출 |
| `proactiveEngine.generateProactiveMessage` | 자발 발화. 동일 결정자 호출 |
| `screenWatchService.buildObservationPrompt` | 화면 관찰 프롬프트. 동일 결정자 호출 |

### Whisper 모델 온디맨드 다운로드

모델 선택 UI에서 미다운로드 모델도 선택할 수 있으며, 선택 시 자동으로 다운로드가 시작됩니다.

| 모델 | 크기 | 배포 포함 |
|------|------|-----------|
| `base` | ~75 MB | O (기본) |
| `small` | ~500 MB | X |
| `medium` | ~1.5 GB | X |

**동작 흐름:**
1. 모델 클릭 → `setSTTSettings({ model })` 로 즉시 선택 반영
2. 미다운로드 시 → `modelDownloadStore.downloadModel('whisper-{model}')` 자동 호출
3. 다운로드 중 → 바이트 기반 프로그레스 바 표시
4. 다운로드 완료 → `checkModelStatus()` 자동 갱신, 모델 상태 "준비 완료"로 변경
5. 다운로드 실패 시 → 모델은 선택 상태 유지, 에러 메시지 표시

**modelDownloadStore 초기화:**
- `VoiceSettings` 마운트 시 `modelStatus`가 null이면 `checkModelStatus()` 자동 호출
- `App.tsx`에서도 프로덕션 빌드 시 앱 시작 단계에서 호출

## 사용자 안내/오류 처리

- `StatusIndicator`가 의존성 누락 시 설치 안내 모달 제공
- `AvatarSettings`의 `TTS Test` 버튼으로 즉시 재생 점검 가능
- 대표 오류 예:
  - Whisper CLI 미탐지
  - Whisper 모델 미설치
  - Supertonic 모델 폴더 누락
  - 오디오 재생 실패

## 배포 번들링 포인트

macOS 배포 시 앱 리소스에 아래가 포함되어야 합니다.

- `Contents/Resources/models/whisper/*`
- `Contents/Resources/models/supertonic/onnx/*`
- `Contents/Resources/models/supertonic/voice_styles/*`
- `Contents/Resources/bin/whisper-cli`
- `Contents/Resources/lib/libwhisper*.dylib`, `libggml*.dylib`
