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

## 설정 UI

- `VoiceSettings`:
  - STT 모델 선택: `base`, `small`, `medium`
  - TTS 보이스 선택: `F1~F5`, `M1~M5`
- `PremiumVoiceSettings`:
  - TTS 엔진 선택 (로컬 / 클라우드)
  - 모델/언어/음성/스타일 선택
  - 감정 자동 매핑 토글
  - 음성 미세 조정 (pitchShift, pitchVariance, speed)
  - 사용량/할당량 모니터링
- 엔진 타입:
  - STT: `whisper` (강제)
  - TTS: `supertonic` (기본) 또는 `supertone_api` (프리미엄)

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
