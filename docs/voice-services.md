# 음성 서비스

현재 음성 스택은 **Whisper(STT) + Supertonic(TTS) 단일 경로**입니다.

## 현재 구성

| 기능 | 엔진 | 상태 |
|------|------|------|
| STT | whisper.cpp (`whisper-cli`) | 사용 중 |
| STT 모델 | `base`, `small`, `medium` | 사용 중 |
| TTS | Supertonic (onnxruntime-web) | 사용 중 |
| TTS 보이스 | `F1~F5`, `M1~M5` | 사용 중 |

## STT 파이프라인

### 프런트엔드

- `audioProcessor.startRecording()`로 마이크 수집
- 녹음 종료 시 `16kHz mono PCM WAV`로 인코딩
- `useConversation`에서 `invoke('transcribe_audio')` 호출

관련 파일:
- `src/services/voice/audioProcessor.ts`
- `src/hooks/useConversation.ts`

### 백엔드

- `transcribe_audio` 명령에서 base64 WAV 디코드
- `whisper-cli -m <model> -f <wav> ...` 실행
- 결과 텍스트를 프런트로 반환

관련 파일:
- `src-tauri/src/commands/voice.rs`

### Whisper 탐색 순서

1. `WHISPER_CLI_PATH` / `WHISPER_MODEL_PATH`
2. 앱 번들 리소스(`Contents/Resources/...`)
3. 작업 디렉터리(`models/whisper`, `public/models/whisper` 등)
4. 시스템 PATH(`/opt/homebrew/bin/whisper-cli` 포함)

## 원격 세션 차단

- `detect_remote_environment`로 SSH/원격툴 흔적 검사
- 원격으로 판단되면 음성 인식 버튼은 동작하지 않고 안내 메시지 표시
- 텍스트 입력은 계속 가능

관련 파일:
- `src-tauri/src/commands/voice.rs` (`detect_remote_environment`)
- `src/hooks/useConversation.ts`

## TTS 파이프라인

### 프런트엔드

1. `useSpeechSynthesis.speak(text)` 호출
2. `ttsRouter.playAudio(text)` 수행
3. `supertonicClient.synthesize()`로 WAV 생성
4. HTMLAudio 재생 실패 시 WebAudio fallback

관련 파일:
- `src/hooks/useSpeechSynthesis.ts`
- `src/services/voice/ttsRouter.ts`
- `src/services/voice/supertonicClient.ts`

### Supertonic 모델 로딩

- 우선순위:
  1. Tauri `Resource` 디렉터리 (`models/supertonic` 또는 `_up_/models/supertonic`)
  2. 웹 경로(`/models/supertonic`)
- 음성 스타일 JSON과 ONNX 모델을 모두 필요로 함

## 설정 UI

- `VoiceSettings`에서 STT 모델(`base/small/medium`) 선택
- TTS 엔진은 `supertonic` 고정
- TTS 보이스(`F1~F5`, `M1~M5`) 선택

관련 파일:
- `src/components/settings/VoiceSettings.tsx`
- `src/stores/settingsStore.ts`

## 배포 번들링

### 개발 모드

- `npm run dev`에서 `prepare-assets.mjs`가 모델 준비/동기화

### macOS 배포

- `build:mac-app` 실행 시:
  1. Whisper 모델(base/small/medium) 준비
  2. 앱 번들 빌드
  3. `stage-bundled-models.mjs`로 리소스 스테이징
  4. `sign-macos-app.mjs`로 코드사인

번들 포함 대상:
- `Contents/Resources/models/whisper/*`
- `Contents/Resources/models/supertonic/onnx/*`
- `Contents/Resources/models/supertonic/voice_styles/*`
- `Contents/Resources/bin/whisper-cli`
- `Contents/Resources/lib/libwhisper*.dylib`, `libggml*.dylib`

## 장애 대응 가이드

### `Whisper CLI executable not found`

- 배포 앱이면 번들 손상 가능성: 앱 재빌드/재배포
- 개발 환경이면 `brew install whisper-cpp` 설치 확인

### `Whisper model file not found`

- `models/whisper`에 필요한 ggml 모델 존재 확인
- 설정 모델명(`base/small/medium`)과 실제 파일 일치 확인

### `Supertonic 모델 미설치 안내`

- `models/supertonic/onnx`, `models/supertonic/voice_styles` 경로 확인
- 배포 앱은 Resources 스테이징 누락 여부 확인

### TTS 재생 오류

- `StatusIndicator` 및 `AvatarSettings`의 TTS Test에서 에러 문구 확인
- `supertonicClient` 로그로 리소스 로딩 경로 확인
