# Issue #003: VoiceSettings 컴포넌트 렌더링 오류

[← 문서 목록으로](../../CLAUDE.md)

## 문제 요약

localStorage에 저장된 이전 설정값이 새로운 엔진 타입과 맞지 않아 VoiceSettings 컴포넌트에서 React 오류가 발생하여 앱 전체가 렌더링되지 않는 문제

## 증상

- Tauri 앱 창은 표시되지만 내부 콘텐츠가 빈 화면으로 보임
- 브라우저(localhost:1420)에서는 정상 작동
- 콘솔에 다음과 같은 에러 출력:
  ```
  The above error occurred in the <VoiceSettings> component...
  ```

## 원인 분석

### localStorage persist 불일치

Zustand의 `persist` 미들웨어로 localStorage에 저장된 설정에 더 이상 지원되지 않는 엔진 타입이 포함되어 있었습니다.

```typescript
// localStorage에 저장된 이전 값 (예시)
{
  stt: { engine: 'qwen3', model: 'some-model' },  // 'qwen3'은 STT가 아님
  tts: { engine: 'qwen3', voice: 'default' }      // 유효하지 않은 값
}
```

### VoiceSettings 접근 오류

`VoiceSettings.tsx`에서 `STT_MODELS[settings.stt.engine]`과 `TTS_VOICES[settings.tts.engine]` 접근 시, 존재하지 않는 키로 인해 `undefined.map()`이 호출되어 오류 발생:

```typescript
// 문제가 되는 코드
{STT_MODELS[settings.stt.engine].map((model) => (
  // settings.stt.engine이 'qwen3'이면 STT_MODELS['qwen3']은 undefined
```

## 해결책

### 1. fallback 추가

엔진 객체에서 값을 가져올 때 기본값으로 fallback:

```typescript
// 수정 전
{STT_MODELS[settings.stt.engine].map((model) => ...)}

// 수정 후
{(STT_MODELS[settings.stt.engine] || STT_MODELS.webspeech).map((model) => ...)}
```

### 2. 컴포넌트 마운트 시 유효성 검사

유효하지 않은 엔진 값을 자동으로 리셋하는 useEffect 추가:

```typescript
useEffect(() => {
  if (!STT_MODELS[settings.stt.engine]) {
    setSTTSettings({ engine: 'webspeech', model: 'default' });
  }
  if (!TTS_VOICES[settings.tts.engine]) {
    setTTSSettings({ engine: 'webspeech', voice: 'default' });
  }
}, []);
```

### 3. 'webspeech' 엔진 타입 추가

기본 브라우저 내장 API를 위한 'webspeech' 타입을 STT와 TTS 모두에 추가:

```typescript
// settingsStore.ts
export type STTEngine = 'webspeech' | 'whisper' | 'moonshine' | 'vosk';
export type TTSEngine = 'webspeech' | 'kokoro' | 'melo';

// VoiceSettings.tsx
const STT_MODELS: Record<STTEngine, string[]> = {
  webspeech: ['default'],
  whisper: ['large-v3-turbo', 'large-v3', 'medium', 'small', 'base', 'tiny'],
  moonshine: ['base', 'tiny'],
  vosk: ['vosk-model-ko', 'vosk-model-small-ko'],
};

const TTS_VOICES: Record<TTSEngine, string[]> = {
  webspeech: ['default'],
  kokoro: ['af_bella', 'af_sarah', 'am_adam', 'am_michael'],
  melo: ['KR'],
};
```

## 핵심 포인트

1. **persist 미들웨어 사용 시 스키마 변경 주의**
   - 타입이 변경되면 기존 localStorage 값과 충돌 가능
   - 항상 fallback 또는 마이그레이션 로직 필요

2. **Record 타입 접근 시 방어적 코딩**
   - `Record<K, V>[key]`는 key가 없으면 undefined 반환
   - `.map()` 호출 전에 null/undefined 체크 필수

3. **컴포넌트 초기화 시 유효성 검사**
   - 설정값 의존 컴포넌트는 마운트 시 값 검증 권장

## 관련 파일

- `src/components/settings/VoiceSettings.tsx` - fallback 및 useEffect 추가
- `src/stores/settingsStore.ts` - 'webspeech' 타입 추가

## 환경 정보

- React: 18.x
- Zustand: 5.x
- Tauri: 2.0
