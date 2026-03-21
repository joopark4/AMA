# #013 Tauri WebView 외부 오디오 재생 차단

## 상태: 해결됨 (2026-02-28)

## 증상

Supertone 음성 미리듣기 버튼 클릭 시 오디오가 재생되지 않음:

- `new Audio(externalUrl)` → error code 4 (`MEDIA_ERR_SRC_NOT_SUPPORTED`), `NotSupportedError`
- `fetch(externalUrl)` → `TypeError: Load failed`

두 가지 접근 모두 실패하여 프론트엔드에서 외부 오디오 리소스를 직접 사용할 수 없었습니다.

## 환경

- Tauri v2 + WKWebView (macOS)
- WebView 프로토콜: `tauri://` (커스텀 프로토콜)
- 외부 URL: CloudFront CDN (`*.cloudfront.net`)

## 원인

Tauri WebView는 `tauri://` 커스텀 프로토콜에서 실행됩니다. WKWebView(macOS)는 커스텀 프로토콜 컨텍스트에서 외부 도메인의 미디어 리소스 직접 로드와 `fetch()` 호출 모두를 보안 정책으로 차단합니다.

### 시도한 접근과 결과

| 접근 | 결과 | 원인 |
|------|------|------|
| `new Audio(cdnUrl)` | `MEDIA_ERR_SRC_NOT_SUPPORTED` | WKWebView가 외부 미디어 로드 차단 |
| `fetch(cdnUrl)` | `TypeError: Load failed` | 커스텀 프로토콜에서 외부 fetch 차단 |
| CSP `media-src *` 설정 | 변화 없음 | CSP가 아닌 WKWebView 자체 정책 |
| `tauri.conf.json` `security.csp: null` | 변화 없음 | CSP 해제와 무관한 WebView 레벨 차단 |

핵심: 이 문제는 CSP(Content Security Policy) 설정과 무관하며, WKWebView 엔진 자체의 보안 정책에 의한 차단입니다.

## 해결

Rust 사이드에서 `reqwest`를 사용하여 외부 URL을 다운로드한 뒤, 바이트 배열을 프론트엔드로 전달하고 Blob URL로 변환하여 재생합니다.

### 1. Rust 명령 추가

**파일**: `src-tauri/src/commands/http.rs`

```rust
/// URL에서 바이너리 데이터를 가져오는 Tauri 명령
/// WebView에서 외부 도메인 fetch가 차단되는 경우 Rust 사이드에서 우회

#[tauri::command]
pub async fn fetch_url_bytes(url: String) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    response
        .bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| format!("Failed to read body: {}", e))
}
```

### 2. 프론트엔드에서 Blob URL 변환

**파일**: `src/components/settings/PremiumVoiceSettings.tsx`

```typescript
// Tauri WebView에서 외부 URL fetch/Audio 직접 불가 → Rust 사이드에서 다운로드
const bytes = await invoke<number[]>('fetch_url_bytes', { url: sample.url });
const uint8 = new Uint8Array(bytes);
const blob = new Blob([uint8], { type: 'audio/wav' });
const blobUrl = URL.createObjectURL(blob);

const audio = new Audio(blobUrl);
audio.play();
```

### 데이터 흐름

```
사용자 → 미리듣기 버튼 클릭
          ↓
PremiumVoiceSettings.tsx
          ↓
invoke('fetch_url_bytes', { url: cdnUrl })
          ↓
[Rust] reqwest::Client → CloudFront CDN
          ↓
[Rust] → Vec<u8> 응답
          ↓
[프론트엔드] number[] 수신
          ↓
new Uint8Array(bytes)
          ↓
new Blob([uint8], { type: 'audio/wav' })
          ↓
URL.createObjectURL(blob)
          ↓
new Audio(blobUrl).play()
```

## 교훈

- **Tauri 앱에서 외부 미디어 재생이 필요한 경우**: 항상 Rust 사이드(`reqwest` 등)를 통해 다운로드 후 Blob URL로 변환해야 함
- **CSP 설정만으로는 해결 불가**: WKWebView의 커스텀 프로토콜 컨텍스트에서의 제한은 CSP와 별개
- **범용 패턴**: `fetch_url_bytes` 명령은 오디오뿐 아니라 이미지, 비디오 등 외부 바이너리 리소스가 필요한 모든 경우에 재사용 가능

## 관련 파일

- `src-tauri/src/commands/http.rs` — `fetch_url_bytes` Rust 명령
- `src-tauri/src/main.rs` — 명령 등록
- `src/components/settings/PremiumVoiceSettings.tsx` — Blob URL 변환 및 오디오 재생
