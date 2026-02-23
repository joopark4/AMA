# Tauri 백엔드

Rust 커맨드는 프런트엔드에서 직접 처리하기 어려운 OS 기능을 제공합니다.

## 엔트리포인트

- 파일: `src-tauri/src/main.rs`
- 주요 역할:
  - plugin 등록 (`dialog`, `fs`, `shell`, `single-instance`)
  - invoke handler 등록
  - 앱 시작 시 현재 모니터 크기/위치에 맞춰 윈도우 보정

## 단일 인스턴스

- `tauri-plugin-single-instance` 사용
- 앱이 이미 실행 중일 때:
  - 기존 `main` 윈도우 `unminimize/show/focus`

## 등록 커맨드

### `commands/window.rs`

- `set_ignore_cursor_events(ignore)`
- `set_window_position(x, y)`
- `get_window_size()`
- `get_cursor_position()`
- `log_to_terminal(message)`

### `commands/settings.rs`

- `open_microphone_settings()`
- `open_accessibility_settings()`
- `open_screen_recording_settings()`
- `pick_vrm_file()`

### `commands/voice.rs`

- `detect_remote_environment()`
- `transcribe_audio(audio_base64, model, language)`
- `check_whisper_available()`
- `get_whisper_availability(model)`
- `check_tts_available()` (legacy placeholder)
- `synthesize_speech(...)` (legacy placeholder)

### `commands/screenshot.rs`

- `capture_screen()`
  - macOS: `screencapture` 기반

## Whisper 실행 로직

`transcribe_audio` 흐름:
1. base64 WAV 디코드
2. `whisper-cli` 경로 해석
3. Whisper 모델 경로 해석
4. 임시 디렉터리에 WAV 저장
5. `whisper-cli` 실행 및 결과 txt 읽기
6. `{ text, confidence, language }` 반환

### Whisper 런타임 검색

- `WHISPER_CLI_PATH`, `WHISPER_MODEL_PATH`
- 앱 번들 `Resources/bin`, `Resources/models`
- 작업 디렉터리(`models/whisper`, `public/models/whisper` 등)
- 시스템 PATH

### macOS dylib 처리

- 번들 `Resources/lib` 존재 시
  - `DYLD_FALLBACK_LIBRARY_PATH`
  - `DYLD_LIBRARY_PATH`
  주입해서 whisper runtime dylib 로딩 보장

## 원격 환경 감지

`detect_remote_environment`는 아래를 조합합니다.

- 환경변수 기반 감지
  - SSH, TeamViewer, AnyDesk, RustDesk, Chrome Remote Desktop 등
- 활성 TCP 세션(`lsof`) 기반 원격툴 프로세스 감지

결과:
- `isRemote`
- `detector`
- `reason`

프런트에서 STT 런타임 차단 정책에 사용합니다.

## 보안/권한

### `Info.plist`

- `NSMicrophoneUsageDescription`
- `NSSpeechRecognitionUsageDescription`
- `NSCameraUsageDescription`

### `entitlements.plist`

- 오디오 입력/마이크 관련 권한 항목

### `capabilities/default.json`

- dialog/fs/shell/window 관련 권한
- 모델/리소스 읽기 경로 허용

## 참고

현재 TTS 본 처리는 Rust `synthesize_speech`가 아니라 프런트(`supertonicClient`)에서 수행합니다.
Rust TTS 명령은 호환성을 위해 남아 있으나 실사용 경로는 아닙니다.
