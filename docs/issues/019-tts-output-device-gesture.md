# #019 TTS 출력이 선택한 오디오 디바이스 대신 기본 디바이스로 재생되는 문제

## 상태: 해결됨 (2026-03-31)

## 증상

설정에서 오디오 출력 디바이스를 선택하고 테스트 비프음은 정상 출력되지만, 실제 TTS 응답 음성은 항상 기본 시스템 오디오로 재생됨.

## 원인

### 근본 원인: WKWebView setSinkId 제스처 제약 + deviceAudio 생명주기

#018에서 `prepareOutputDevice()` 패턴으로 해결했으나, 다음 시나리오에서 재발:

1. **앱 재시작 후**: `deviceAudio`가 null로 초기화됨. 사용자가 디바이스를 다시 선택하거나 테스트하지 않으면 TTS는 기본 출력 사용
2. **`ensureOutputDevice()` 타이밍**: 음성 버튼/텍스트 전송의 클릭 이벤트에서 `ensureOutputDevice()`를 호출해도, 비동기 체인에서 제스처 컨텍스트가 만료될 수 있음
3. **테스트 비프와 TTS가 별도 Audio 객체**: 테스트 비프는 제스처 내에서 `setSinkId` + `srcObject` + `play()`가 모두 실행되어 성공하지만, `prepareOutputDevice()`로 미리 만든 Audio는 나중에 `srcObject`가 설정될 때 sinkId가 무효화될 수 있음

### 로그 증거

```
[TTSRouter] playViaMediaStream: setSinkId failed: A user gesture is required
```

## 해결

### 핵심: 테스트 버튼에서 TTS용 Audio도 동시에 생성

오디오 출력 섹션에 테스트 버튼을 추가하고, 클릭(제스처) 컨텍스트에서 **비프용 Audio + TTS용 Audio 두 개를 동시에** 생성하여 `setSinkId`를 적용한다.

```typescript
// 테스트 버튼 클릭 (제스처 컨텍스트)
const beepAudio = new Audio();
const ttsAudio = new Audio();
await beepAudio.setSinkId(deviceId);  // ✅ 제스처 내
await ttsAudio.setSinkId(deviceId);   // ✅ 제스처 내

// 비프 재생
beepAudio.srcObject = dest.stream;
await beepAudio.play();

// TTS용 Audio를 보존 → 이후 TTS 재생에 재사용
ttsRouter.setDeviceAudio(ttsAudio);
```

### 추가 안전장치

1. **`ensureOutputDevice()`**: 음성 버튼/텍스트 전송 클릭 시 `deviceAudio`가 null이면 저장된 디바이스 ID로 `prepareOutputDevice()` 시도
2. **`setDeviceAudio()`**: 외부(테스트 버튼)에서 setSinkId 적용된 Audio를 직접 보존
3. **재생 완료 후 Audio 보존**: `playViaMediaStream` 완료 후 Audio를 `deviceAudio`에 다시 저장하여 다음 재생에 재사용

### 사용자 흐름

```
앱 시작 → 설정 열기 → 출력 디바이스 선택 → 테스트 버튼 클릭
                                              ↓
                               비프음: 선택한 디바이스에서 출력 ✅
                               TTS용 Audio: setSinkId 적용 후 보존
                                              ↓
                              이후 모든 TTS: 선택한 디바이스에서 출력 ✅
```

## 수정 파일

- `src/services/voice/ttsRouter.ts` — `setDeviceAudio()`, `ensureOutputDevice()` 추가
- `src/components/settings/AudioDeviceSettings.tsx` — 테스트 버튼 추가, TTS용 Audio 동시 생성
- `src/components/ui/StatusIndicator.tsx` — 음성/텍스트 클릭 시 `ensureOutputDevice()` 호출

## 참고

- WKWebView에서 `setSinkId`는 반드시 사용자 제스처(클릭) 콜 스택 내에서 호출해야 함
- `audio.srcObject = MediaStream` 방식에서만 `setSinkId`가 안정적으로 동작 (blob URL 방식 비호환)
- 테스트 버튼을 한 번 누르면 이후 앱을 닫을 때까지 선택한 디바이스로 계속 출력
