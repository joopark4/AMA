# 설정 시스템

설정은 Zustand `persist`로 저장되며 재실행 후에도 유지됩니다.

## 스토어 기본 정보

- 파일: `src/stores/settingsStore.ts`
- persist key: `mypartnerai-settings`
- persist version: `15` (v1.5.0에서 `screenWatch` 추가로 증분)

## 설정 스키마 (요약)

```ts
interface Settings {
  llm: {
    provider: 'ollama' | 'localai' | 'claude' | 'openai' | 'gemini' | 'claude_code' | 'codex';
    model: string;
    apiKey?: string;
    endpoint?: string;
  };
  stt: {
    engine: 'whisper';
    model: 'base' | 'small' | 'medium' | string;
  };
  tts: {
    engine: 'supertonic' | 'supertone_api';
    voice?: 'F1'|'F2'|'F3'|'F4'|'F5'|'M1'|'M2'|'M3'|'M4'|'M5';
    supertoneApi?: {
      voiceId: string;
      voiceName: string;
      model: 'sona_speech_1' | 'sona_speech_2' | 'sona_speech_2_flash';
      language: string;
      style: string;
      autoEmotionStyle: boolean;
      voiceSettings: {
        pitchShift: number;      // -24 ~ 24
        pitchVariance: number;   // 0 ~ 2
        speed: number;           // 0.5 ~ 2
      };
    };
  };
  language: 'ko' | 'en' | 'ja';
  avatarName: string;
  avatarPersonalityPrompt: string;  // 아바타 성격 프롬프트 (최대 800자)
  vrmModelPath: string;
  avatar: {
    scale: number;
    movementSpeed: number;
    freeMovement: boolean;      // 자유 이동 모드 (기본: false)
    showSpeechBubble: boolean;  // 말풍선 표시 (기본: true)
    physics: {
      enabled: boolean;
      gravityMultiplier: number;
      stiffnessMultiplier: number;
    };
    animation: {
      expressionBlendSpeed: number;
      enableGestures: boolean;
      enableMotionClips: boolean;
      faceExpressionOnlyMode: boolean;
      dynamicMotionEnabled: boolean;
      dynamicMotionBoost: number;
      enableDancing: boolean;
      danceIntensity: number;
      motionDiversity: number;
      enableBreathing: boolean;
      enableEyeDrift: boolean;
      gazeFollow: boolean;        // v1.5.0 — 커서 시선 추적
      backchannel: boolean;       // v1.5.0 — 경청 끄덕임
    };
    lighting: {
      ambientIntensity: number;
      directionalIntensity: number;
      directionalPosition: { x: number; y: number; z: number };
      showControl: boolean;
    };
    initialViewRotation: { x: number; y: number };
  };
  stt: {
    // ...
    audioInputDeviceId?: string;    // 마이크 입력 디바이스 ID
  };
  tts: {
    // ...
    audioOutputDeviceId?: string;   // 스피커 출력 디바이스 ID
  };
  codex: {
    model: string;                  // 기본: 'gpt-5.4'
    reasoningEffort: 'low' | 'medium' | 'high' | 'xhigh';
    workingDir: string;             // 기본: '' (→ ~/Documents)
    approvalPolicy: 'never' | 'on-request' | 'untrusted';
  };
  // v1.5.0 — 화면 관찰
  screenWatch: {
    enabled: boolean;               // 기본: false
    intervalSeconds: number;        // 30~600, 기본: 120
    captureTarget:
      | { type: 'fullscreen' }
      | { type: 'active-window' }
      | { type: 'main-monitor' }
      | { type: 'monitor'; monitorName: string }
      | { type: 'window'; appName: string; windowTitle?: string };
    responseStyle: 'balanced' | 'advisor' | 'comedian' | 'analyst';
    silentHours: { enabled: boolean; start: number; end: number };  // 0~23, 자정 넘기기 지원
  };
  // v1.5.0 — 자연 상호작용 기반 (natural-interaction 브랜치 통합)
  character: CharacterProfile;      // Phase 0 캐릭터 프로필
  proactive: {
    enabled: boolean;
    idleMinutes: number;
    cooldownMinutes: number;
  };
}
```

## 기본값

- LLM: `ollama / deepseek-v3 / http://localhost:11434`
- STT: `whisper / base`
- TTS: `supertonic / F1`
- 언어: `ko`
- 아바타 이름: 빈 문자열
- VRM 경로: 빈 문자열 (사용자 선택)

## 정규화/마이그레이션 규칙

### STT
- 엔진은 항상 `whisper`로 강제
- 모델명은 `base/small/medium` 중심으로 정규화
- 레거시 값(`ggml-small.bin`, `small.en`) 대응

### TTS
- 엔진은 `supertonic`(로컬) 또는 `supertone_api`(클라우드) 중 선택
- 로컬 보이스는 `F1~F5/M1~M5`로 정규화
- `supertoneApi` 설정은 프리미엄 사용자만 유효

### VRM 경로
- 구형 번들 경로(`/vrm/eunyeon_ps.vrm`)는 빈 값으로 정규화
- 경로 슬래시 정규화

### 초기 시선
- `initialViewRotation.x`는 `-0.5 ~ 0.5`로 clamp
- `initialViewRotation.y`는 유효 숫자만 유지

### 아바타 이름
- trim + 최대 40자 제한

### 자유 이동 / 말풍선
- `freeMovement`: boolean 타입 검증, 기본값 `false`
- `showSpeechBubble`: boolean 타입 검증, 기본값 `true`

## UI 연결

| UI 컴포넌트 | 연결 설정 |
|-------------|-----------|
| `LLMSettings` | `settings.llm.*` |
| `AudioDeviceSettings` | `settings.stt.audioInputDeviceId`, `settings.tts.audioOutputDeviceId` |
| `VoiceSettings` | `settings.stt`, `settings.tts`, `modelDownloadStore` |
| `PremiumVoiceSettings` | `settings.tts.engine`, `settings.tts.supertoneApi`, `premiumStore` |
| `AvatarSettings` | `vrmModelPath`, `avatarName`, `avatarPersonalityPrompt`, `avatar.*` |
| `CodexSettings` | `settings.codex.*` (LLM provider가 `codex`일 때 표시) |
| `ScreenWatchSettings` | `settings.screenWatch.*` (v1.5.0) |
| `CharacterSettings` | `settings.character`, `settings.proactive` (v1.5.0) |
| `UpdateSettings` | `useAutoUpdateStore` (앱 버전/업데이트 확인) |
| `LicensesSettings` | 설정값 저장 없음 (라이선스 안내 전용) |
| `SettingsPanel` | 설정 저장/리셋/언어 |

## 모델 다운로드 스토어 (`modelDownloadStore`)

- 파일: `src/stores/modelDownloadStore.ts`
- Whisper/Supertonic 모델의 다운로드 상태와 진행률 관리
- `checkModelStatus()` → Rust `check_model_status` 커맨드로 각 모델 설치 여부 확인
- `downloadModel(modelType)` → Rust `download_model` 커맨드로 개별 모델 다운로드
- 다운로드 진행률은 Tauri `model-download-progress` 이벤트로 수신
- 에러 발생 시 `error` 상태에 메시지 저장 + 콘솔 로그

## 프리미엄 스토어 (`premiumStore`)

- 파일: `src/stores/premiumStore.ts`
- 프리미엄 구독 상태, Supertone API 음성 목록, 할당량/사용량 관리
- `checkPremiumStatus()` → Supabase `profiles` 테이블에서 `is_premium`, `plan_id` 조회
- `fetchVoices(filters?)` → Edge Function `supertone-voices` 호출
- `fetchUsageSummary()` / `fetchUsageDaily()` → Edge Function `supertone-usage` 호출
- `updateQuotaFromTtsResponse(headers)` → TTS 응답 헤더에서 할당량 정보 추출
- `isQuotaExceeded` 플래그로 `ttsRouter`가 자동 폴백 판단
- 이중 호출 방지: `checkPremiumStatus()`는 Promise 싱글턴 패턴 사용

## 온보딩 규칙

- 배포 빌드에서 `avatarName`이 비어 있으면 시작 시 이름 설정 모달 표시
- 저장된 이름은 system prompt 및 TTS 테스트 문구에 반영

## 런타임 안내 모달과의 관계

`StatusIndicator`는 설정값 + 런타임 점검 결과를 합쳐 설치/설정 안내를 표시합니다.

대표 항목:
- LLM 모델/API key/endpoint 누락
- Whisper CLI/모델 누락
- Supertonic 모델 누락
- 원격 세션 STT 차단

## 새 설정 항목 추가 체크리스트

1. `Settings` 타입 확장
2. `defaultSettings` 반영
3. setter(`setXxxSettings`) 반영
4. `migrate` 정규화 로직 보강
5. UI 컴포넌트 연결
