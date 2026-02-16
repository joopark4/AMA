# 설정 시스템

설정은 Zustand persist 기반으로 관리되며, 앱 재시작 후에도 유지됩니다.

## 스토어

- 파일: `src/stores/settingsStore.ts`
- storage key: `mypartnerai-settings`
- persist version: `3`

## 설정 구조

```ts
interface Settings {
  llm: {
    provider: 'ollama' | 'localai' | 'claude' | 'openai' | 'gemini';
    model: string;
    apiKey?: string;
    endpoint?: string;
  };
  stt: {
    engine: 'whisper';
    model: 'base' | 'small' | 'medium';
  };
  tts: {
    engine: 'supertonic';
    voice: 'F1'|'F2'|'F3'|'F4'|'F5'|'M1'|'M2'|'M3'|'M4'|'M5';
  };
  language: 'ko' | 'en';
  vrmModelPath: string;
  avatar: {
    scale: number;
    movementSpeed: number;
    physics: {...};
    animation: {...};
    lighting: {...};
  };
}
```

## 기본값

- LLM: `ollama / deepseek-v3 / http://localhost:11434`
- STT: `whisper / base`
- TTS: `supertonic / F1`
- 언어: `ko`
- VRM: 빈 문자열(사용자 선택 필요)

## 정규화/마이그레이션

### STT
- 엔진을 항상 `whisper`로 강제
- 모델명은 `base/small/medium`으로 정규화
- 과거 값(`ggml-small.bin` 등)도 대응

### TTS
- 엔진을 항상 `supertonic`으로 강제
- 음성 키를 `F1~F5/M1~M5`로 정규화

### VRM 경로
- 구형 기본 경로(`/vrm/eunyeon_ps.vrm`)는 빈 값으로 치환
- 슬래시 정규화 수행

## UI 연결

| 화면 | 관련 설정 |
|------|-----------|
| `VoiceSettings` | `settings.stt`, `settings.tts` |
| `AvatarSettings` | `settings.vrmModelPath`, `settings.avatar.*` |
| `SettingsPanel` | 전체 설정 편집 |
| `App` | `settings.language` 변경 시 i18n 적용 |

## 의존성 안내 모달 연동

`StatusIndicator`에서 설정값과 런타임 점검 결과를 조합해 안내를 표시합니다.

예시:
- LLM 모델 미선택
- API 키 미입력
- Whisper/Supertonic 자원 누락

## 새 설정 항목 추가 가이드

1. `Settings` 타입 확장
2. `defaultSettings` 기본값 추가
3. `setXxxSettings` 업데이트 함수 반영
4. persist migration에서 구버전 값 대응
5. 설정 UI(`components/settings/*`) 연결
