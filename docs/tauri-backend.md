# Tauri 백엔드

Rust 커맨드는 프런트엔드가 브라우저 API만으로 처리할 수 없는 기능을 제공합니다.

## 엔트리포인트

- 파일: `src-tauri/src/main.rs`
- 주요 역할:
  - plugin 초기화 (`dialog`, `fs`, `shell`, `single-instance`)
  - invoke handler 등록
  - 앱 시작 시 모니터 해상도/위치에 맞춰 창 크기 보정

## 등록된 커맨드

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
- `check_tts_available()`
- `synthesize_speech(...)` (현재 placeholder)

### `commands/screenshot.rs`

- `capture_screen()`
  - macOS: `screencapture` 명령 기반

## Whisper 실행 방식

`transcribe_audio` 동작:
1. base64 WAV 디코드
2. `whisper-cli` 경로 탐색
3. 모델 경로 탐색
4. 임시 WAV 저장
5. `whisper-cli` subprocess 실행
6. 결과 txt 읽어서 반환

배포 번들 런타임 지원:
- `Resources/bin/whisper-cli`
- `Resources/lib/libwhisper*.dylib`, `libggml*.dylib`
- `DYLD_FALLBACK_LIBRARY_PATH` 주입

## 원격 환경 감지

감지 소스:
- 환경 변수(SSH/원격툴)
- 네트워크 세션(`lsof`) 기반 원격툴 프로세스 패턴

감지 시 반환:
- `is_remote`, `detector`, `reason`

프런트에서 STT 차단 정책에 사용됩니다.

## 단일 인스턴스

- `tauri-plugin-single-instance` 사용
- 중복 실행 시 기존 `main` 윈도우를 전면으로 복귀

## 권한/보안

### Tauri 설정
- `src-tauri/tauri.conf.json`
  - `identifier: com.mypartnerai`
  - `Info.plist`, `entitlements.plist` 연결

### Info.plist
- `NSMicrophoneUsageDescription`
- `NSSpeechRecognitionUsageDescription`
- `NSCameraUsageDescription` (향후 기능 대비)

### Entitlements
- `com.apple.security.device.audio-input`
- `com.apple.security.device.microphone`

### Capabilities
- `src-tauri/capabilities/default.json`
  - dialog/shell/fs read 권한
  - resource/home/desktop/document/download read recursive

## 플러그인

| 플러그인 | 용도 |
|----------|------|
| `tauri-plugin-dialog` | 파일 선택 |
| `tauri-plugin-fs` | Resource 파일 읽기 |
| `tauri-plugin-shell` | 시스템 명령 연동 |
| `tauri-plugin-single-instance` | 단일 실행 인스턴스 |
