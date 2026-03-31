# #018 오디오 출력 디바이스 선택이 기본 디바이스로만 출력되는 문제

## 상태: 해결됨 (2026-03-31)

## 증상

설정에서 기본 시스템 오디오가 아닌 다른 출력 디바이스(예: Revelator, 블루투스 스피커, USB DAC)를 선택해도 TTS 음성이 항상 기본 시스템 출력(맥북 스피커)으로만 재생됨. 테스트 비프음은 선택한 디바이스에서 정상 출력.

## 원인

### 근본 원인: WKWebView의 setSinkId 제스처 제약

Tauri v2 macOS는 WKWebView(WebKit)를 사용하며, `HTMLMediaElement.setSinkId()`는 **사용자 제스처(클릭) 콜 스택 내에서만** 호출이 허용된다. 제스처 컨텍스트 밖에서 호출하면 `A user gesture is required` 에러로 거부됨.

**TTS 재생 흐름에서 제스처가 소멸되는 과정:**

```
사용자 클릭 (제스처 시작)
    ↓
useConversation → LLM API 호출 (수 초 대기) ← 제스처 컨텍스트 소멸
    ↓
응답 수신 → useSpeechSynthesis.speak()
    ↓
ttsRouter.playAudio() → synthesize() (TTS 합성)
    ↓
playViaMediaStream() → setSinkId() ← ❌ "A user gesture is required"
```

테스트 비프는 버튼 클릭 → 즉시 `setSinkId()` 호출이므로 제스처가 유효하여 동작함.

### 부수 원인 (해결 과정에서 발견)

1. **별도 AudioContext 싱글톤**: `getSharedAudioContext()` 대신 `private audioContext`를 사용하여 앱 전체 오디오 컨텍스트와 분리
2. **blob URL 방식의 setSinkId 비호환**: `audio.src = blobUrl` 방식은 WKWebView에서 `setSinkId`가 무시됨. `audio.srcObject = MediaStream` 방식에서만 안정적으로 동작
3. **폴백 경로 누락**: `playViaWebAudio`가 `audioContext.destination`에 직접 연결하여 항상 기본 출력
4. **디버깅 불가**: `log()`가 Tauri 터미널 전용(`invoke`)이라 브라우저 콘솔에서 확인 불가

## 해결

### 핵심: 제스처 시점에 setSinkId를 미리 적용하고 Audio 엘리먼트를 재사용

```
디바이스 선택 (클릭 = 제스처)
    ↓
ttsRouter.prepareOutputDevice(deviceId)
    → new Audio() + setSinkId(deviceId)  [제스처 컨텍스트 ✓]
    → this.deviceAudio에 보관
    ↓
... 시간 경과 ...
    ↓
TTS 재생 시
    → this.deviceAudio 사용 (setSinkId 이미 적용)
    → 재생 완료 후 this.deviceAudio에 다시 보존 (다음 재생용)
```

### 1. `prepareOutputDevice()` 메서드 추가

디바이스 변경 시(제스처 컨텍스트) Audio 엘리먼트를 미리 생성하고 `setSinkId`를 적용해둔다.

```typescript
async prepareOutputDevice(deviceId?: string): Promise<void> {
  const audio = new Audio();
  if (deviceId && 'setSinkId' in audio) {
    await (audio as any).setSinkId(deviceId);
  }
  this.deviceAudio = audio;  // 다음 TTS 재생에 재사용
}
```

### 2. AudioDeviceSettings에서 디바이스 변경 시 호출

```typescript
onChange={(e) => {
  const deviceId = e.target.value || undefined;
  setTTSSettings({ audioOutputDeviceId: deviceId });
  ttsRouter.prepareOutputDevice(deviceId);  // 제스처 컨텍스트에서 setSinkId 적용
}}
```

### 3. MediaStream 경로로 통합

blob URL(`audio.src`) 방식을 폐기하고, `AudioContext → BufferSource → MediaStreamDestination → HTML Audio(srcObject)` 단일 경로로 통합.

```typescript
private async playViaMediaStream(audioData: ArrayBuffer): Promise<void> {
  const source = audioContext.createBufferSource();
  const dest = audioContext.createMediaStreamDestination();
  source.connect(gain).connect(dest);

  const audio = this.deviceAudio ?? new Audio();  // 미리 준비된 Audio 사용
  this.deviceAudio = null;
  audio.srcObject = dest.stream;

  source.start(0);
  await audio.play();

  // 재생 완료 후 Audio를 다시 보존 (다음 재생용)
  this.deviceAudio = audio;
}
```

### 4. 테스트 비프 후에도 Audio 보존

테스트 비프 버튼 클릭도 제스처이므로, 비프 재생 후 `setSinkId` 적용된 Audio를 `this.deviceAudio`에 보존하여 이후 TTS에 재사용.

### 5. getSharedAudioContext() + console.log 추가

```typescript
private getAudioContext(): AudioContext {
  return getSharedAudioContext();
}

const log = (...args: unknown[]) => {
  console.log(`[TTSRouter] ${message}`);     // 브라우저 콘솔
  invoke('log_to_terminal', { ... });         // Tauri 터미널
};
```

## 수정 파일

- `src/services/voice/ttsRouter.ts` — `prepareOutputDevice()` 추가, MediaStream 경로 통합, deviceAudio 재사용, console.log 병행
- `src/components/settings/AudioDeviceSettings.tsx` — 디바이스 변경 시 `ttsRouter.prepareOutputDevice()` 호출, 테스트 버튼 추가
- `src/i18n/ko.json`, `en.json`, `ja.json` — "스피커 (출력)" → "오디오 출력" 라벨 변경

## 디버깅 방법

앱에서 Cmd+Option+I → Console 탭에서 `[TTSRouter]` 로그 확인:

| 로그 | 의미 |
|------|------|
| `prepareOutputDevice: setSinkId OK` | 디바이스 선택 시 setSinkId 적용 성공 |
| `playViaMediaStream: using device=<id>` | 미리 준비된 디바이스로 재생 |
| `playViaMediaStream: using default audio` | 기본 출력 사용 (디바이스 미선택) |
| `setSinkId FAILED: A user gesture is required` | 제스처 컨텍스트 밖에서 호출됨 |

## 참고

- Tauri v2 macOS는 WKWebView(WebKit) 사용
- `HTMLMediaElement.setSinkId()`는 Safari 17.4+ 지원, **제스처 필수**
- `audio.src`(blob URL) 방식은 WKWebView에서 `setSinkId` 비호환 — `audio.srcObject`(MediaStream) 방식 사용
- 디바이스 선택 또는 테스트 비프 중 하나를 수행하면 이후 모든 TTS가 선택된 디바이스로 출력
