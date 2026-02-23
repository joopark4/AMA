# 음성 서비스

현재 음성 스택은 **Whisper(STT) + Supertonic(TTS)** 단일 경로입니다.

## 현재 구성

| 기능 | 엔진 | 상태 |
|------|------|------|
| STT | whisper.cpp (`whisper-cli`) | 사용 중 |
| STT 모델 | `base`, `small`, `medium` | 사용 중 |
| TTS | Supertonic + onnxruntime-web | 사용 중 |
| TTS 음성 | `F1~F5`, `M1~M5` | 사용 중 |

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

1. `useSpeechSynthesis.speak(text)` 호출
2. `ttsRouter.playAudio(text)`
3. `supertonicClient.synthesize()`로 WAV 생성
4. HTMLAudio 재생 시도
5. 실패하면 WebAudio decode/play로 fallback

주요 파일:
- `src/hooks/useSpeechSynthesis.ts`
- `src/services/voice/ttsRouter.ts`
- `src/services/voice/supertonicClient.ts`

## Supertonic 모델 로딩 우선순위

1. Tauri 리소스 경로
   - `models/supertonic`
   - `_up_/models/supertonic`
2. 웹 경로
   - `/models/supertonic`

필수 하위 폴더:
- `onnx/`
- `voice_styles/`

## 설정 UI

- `VoiceSettings`:
  - STT 모델 선택: `base`, `small`, `medium`
  - TTS 보이스 선택: `F1~F5`, `M1~M5`
- 엔진 타입은 런타임에서 강제됨
  - STT: `whisper`
  - TTS: `supertonic`

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
