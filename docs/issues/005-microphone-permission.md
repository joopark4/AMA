# Issue #005: 마이크 권한 요청 및 시스템 설정 열기 구현

[← CLAUDE.md로 돌아가기](../../CLAUDE.md) | [← 음성 서비스](../voice/voice-services.md)

## 요약

| 항목 | 내용 |
|------|------|
| **문제** | 마이크 권한 거부 시 사용자가 권한을 부여할 방법이 없음 |
| **해결** | 시스템 설정 열기 버튼 구현 및 권한 요청 흐름 개선 |
| **상태** | ✅ 해결됨 |
| **날짜** | 2026-01-27 |

## 문제 상황

### 증상
1. 마이크 버튼 클릭 시 권한 요청 팝업이 나타남
2. 권한을 거부하면 에러 메시지만 표시되고 복구 방법이 없음
3. "시스템 설정 열기" 버튼이 있으나 클릭해도 아무 반응 없음

### 원인 분석

#### 원인 1: 투명 윈도우 클릭 영역 문제
`useClickThrough.ts`에서 클릭 가능한 영역을 폴링으로 체크하는데, 에러 메시지 영역이 설정된 범위를 벗어남:

```typescript
// 기존 설정 (너무 작음)
const settingsAreaWidth = 200;
const settingsAreaHeight = 60;  // 에러 메시지 + 버튼 높이 < 이 값
```

#### 원인 2: macOS Info.plist 누락
앱이 시스템 설정의 마이크 권한 목록에 나타나지 않음:
- `NSMicrophoneUsageDescription` 키가 Info.plist에 없음
- 개발 모드에서는 Terminal이 권한을 요청함

## 해결 방법

### 1. 클릭 영역 확대

**파일**: `src/hooks/useClickThrough.ts`

```typescript
// 수정 후
const settingsAreaWidth = 350;  // 텍스트 입력 폼 포함
const settingsAreaHeight = 200; // 에러 메시지 + 버튼 포함
```

### 2. Info.plist 생성

**파일**: `src-tauri/Info.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSMicrophoneUsageDescription</key>
    <string>MyPartnerAI needs microphone access for voice input</string>
    <key>NSCameraUsageDescription</key>
    <string>MyPartnerAI may use camera for future features</string>
    <key>NSSpeechRecognitionUsageDescription</key>
    <string>MyPartnerAI uses speech recognition for voice commands</string>
</dict>
</plist>
```

### 3. tauri.conf.json 설정 추가

**파일**: `src-tauri/tauri.conf.json`

```json
{
  "bundle": {
    "macOS": {
      "entitlements": "./entitlements.plist",
      "infoPlist": "./Info.plist"
    }
  }
}
```

## 구현 상세

### 권한 요청 흐름

```
사용자 → 마이크 버튼 클릭
         ↓
useConversation.startListening()
         ↓
navigator.mediaDevices.getUserMedia({ audio: true })
         ↓
    ┌────┴────┐
    │         │
  허용       거부
    │         ↓
    │    setNeedsMicrophonePermission(true)
    │    setError('마이크 권한이 필요합니다.')
    │         ↓
    │    StatusIndicator에 버튼 표시
    │         ↓
    │    사용자 → "시스템 설정 열기" 클릭
    │         ↓
    │    openMicrophoneSettings()
    │         ↓
    │    invoke('open_microphone_settings')
    │         ↓
    │    Rust: Command::new("open").arg(URL).spawn()
    │         ↓
    │    시스템 설정 앱 열림
    ↓
음성 인식 시작
```

### 파일별 역할

| 파일 | 변경 내용 |
|------|----------|
| `src/hooks/useConversation.ts` | `needsMicrophonePermission` 상태 관리, `openMicrophoneSettings` 함수 |
| `src/components/ui/StatusIndicator.tsx` | "시스템 설정 열기" 버튼 UI |
| `src/hooks/useClickThrough.ts` | 클릭 영역 확대 (200→350, 60→200) |
| `src/services/tauri/permissions.ts` | Tauri invoke 래퍼 |
| `src-tauri/src/commands/settings.rs` | OS별 시스템 설정 열기 명령 |
| `src-tauri/Info.plist` | (신규) 권한 사용 설명 |
| `src-tauri/tauri.conf.json` | Info.plist 참조 추가 |

### Rust 백엔드 구현

**파일**: `src-tauri/src/commands/settings.rs`

```rust
#[tauri::command]
pub fn open_microphone_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")
            .spawn()
            .map_err(|e| format!("Failed to open settings: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "ms-settings:privacy-microphone"])
            .spawn()
            .map_err(|e| format!("Failed to open settings: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        if Command::new("gnome-control-center")
            .arg("privacy")
            .spawn()
            .is_ok()
        {
            return Ok(());
        }
        if Command::new("systemsettings5").spawn().is_ok() {
            return Ok(());
        }
        Err("Could not open system settings".to_string())
    }
}
```

## 테스트

### 개발 모드
1. Terminal 앱에 마이크 권한 부여 필요
2. `npm run tauri dev` 실행
3. 마이크 버튼 클릭 → 권한 요청 (Terminal 앞으로)

### 프로덕션 모드
1. `npm run tauri build` 실행
2. `src-tauri/target/release/bundle/macos/MyPartnerAI.app` 실행
3. 마이크 버튼 클릭 → 권한 요청 (MyPartnerAI 앞으로)
4. 권한 거부 → "시스템 설정 열기" 버튼 표시
5. 버튼 클릭 → 시스템 설정 > 개인정보 보호 > 마이크 열림
6. MyPartnerAI 앱이 목록에 표시됨

## 관련 파일

- `src/hooks/useConversation.ts` - 권한 요청 로직
- `src/hooks/useClickThrough.ts` - 투명 윈도우 클릭 처리
- `src/components/ui/StatusIndicator.tsx` - 버튼 UI
- `src/services/tauri/permissions.ts` - Tauri 서비스
- `src-tauri/src/commands/settings.rs` - Rust 백엔드
- `src-tauri/Info.plist` - macOS 권한 설명
- `src-tauri/entitlements.plist` - macOS 권한 설정
- `src-tauri/tauri.conf.json` - Tauri 설정

## 참고

- [Apple Developer - Privacy Usage Descriptions](https://developer.apple.com/documentation/bundleresources/information_property_list/protected_resources)
- [Tauri 2.0 macOS Bundle Configuration](https://tauri.app/reference/config/#macosconfig)
- [Web API - getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
