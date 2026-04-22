/**
 * 설정 스토어 - Zustand persist 기반 전역 설정 관리
 * 자세한 문서: docs/settings-system.md
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_GLOBAL_SHORTCUT_ACCELERATOR,
  normalizeGlobalShortcutAccelerator,
} from '../services/tauri/globalShortcutUtils';
import {
  DEFAULT_CHARACTER_PROFILE,
  migrateFromLegacy,
  type CharacterProfile,
  type ExampleDialogue,
} from '../services/character';
import { DEFAULT_PROACTIVE_SETTINGS, type ProactiveSettings } from '../services/ai/proactiveEngine';
import { ALL_QUICK_ACTION_IDS, type QuickActionId } from '../features/quick-actions/types';

export type LLMProvider = 'ollama' | 'localai' | 'claude' | 'openai' | 'gemini' | 'claude_code' | 'codex';

// STT 엔진: whisper (로컬 whisper-cli)
export type STTEngine = 'whisper';

// TTS 엔진: supertonic (로컬 ONNX) | supertone_api (클라우드)
export type TTSEngine = 'supertonic' | 'supertone_api';
export type Language = 'ko' | 'en' | 'ja';

/**
 * TTS 출력 언어 — UI 언어(`settings.language`)와 독립된 음성·대화 언어 설정.
 *
 * - `auto`: 텍스트 내용 + UI 언어로 자동 결정 (기존 동작)
 * - 그 외: 선택한 언어로 강제. 엔진이 지원하지 않으면 런타임에 폴백(보통 `en`).
 *
 * 지원 범위:
 * - Supertonic(로컬): en/ko/es/pt/fr — 일본어는 지원하지 않아 UI에서도 노출하지 않는다.
 * - Supertone API(프리미엄): 모델별로 상이(sona_speech_1 = ko/en/ja, sona_speech_2 = 23개)
 */
export type TTSOutputLanguage = 'auto' | 'ko' | 'en' | 'ja' | 'es' | 'pt' | 'fr';

export interface LLMSettings {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  endpoint?: string;
}

export interface STTSettings {
  engine: STTEngine;
  model: string;
  audioInputDeviceId?: string;
}

export interface SupertoneApiVoiceSettings {
  pitchShift: number;      // -24 ~ 24
  pitchVariance: number;   // 0 ~ 2
  speed: number;           // 0.5 ~ 2
}

export interface SupertoneApiSettings {
  voiceId: string;
  voiceName: string;
  model: 'sona_speech_1' | 'sona_speech_2' | 'sona_speech_2_flash';
  language: string;
  style: string;
  autoEmotionStyle: boolean;
  voiceSettings: SupertoneApiVoiceSettings;
}

export interface TTSSettings {
  engine: TTSEngine;
  voice?: string;                       // supertonic용 (F1-M5)
  /** 음성 출력 언어 (로컬/프리미엄 공용). `auto`면 텍스트 감지 + UI 언어 폴백. */
  language?: TTSOutputLanguage;
  supertoneApi?: SupertoneApiSettings;  // supertone_api용
  audioOutputDeviceId?: string;
}

export interface GlobalShortcutSettings {
  enabled: boolean;
  accelerator: string;
}

export interface PhysicsSettings {
  enabled: boolean;
  gravityMultiplier: number;
  stiffnessMultiplier: number;
}

export interface AnimationSettings {
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
  /** 커서 추적 시선 (v2 3순위) — 기본 true */
  gazeFollow: boolean;
  /** 경청 중 주기적 끄덕임 (v2 3순위) — 기본 true */
  backchannel: boolean;
}

export interface LightingSettings {
  ambientIntensity: number;
  directionalIntensity: number;
  directionalPosition: { x: number; y: number; z: number };
  showControl: boolean;
}

export interface ViewRotationSettings {
  x: number;
  y: number;
}

export interface AvatarSettings {
  scale: number;
  movementSpeed: number;
  freeMovement: boolean;
  autoRoam: boolean;
  showSpeechBubble: boolean;
  physics: PhysicsSettings;
  animation: AnimationSettings;
  lighting: LightingSettings;
  initialViewRotation: ViewRotationSettings;
}

export interface HistoryPanelSettings {
  position: { x: number; y: number } | null;
  size: { width: number; height: number };
  fontSize: number;
  opacity: number;
}

export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';
export type CodexApprovalPolicy = 'never' | 'on-request' | 'untrusted';

export interface CodexSettings {
  model: string;
  reasoningEffort: CodexReasoningEffort;
  workingDir: string;
  approvalPolicy: CodexApprovalPolicy;
}

export type CaptureTarget =
  | { type: 'fullscreen' }
  | { type: 'active-window' }
  | { type: 'main-monitor' }
  | { type: 'monitor'; monitorName: string }
  | { type: 'window'; appName: string; windowTitle?: string };

export type ScreenWatchResponseStyle = 'balanced' | 'advisor' | 'comedian' | 'analyst';

export interface ScreenWatchSilentHours {
  enabled: boolean;
  start: number; // 0..23
  end: number;   // 0..23
}

export interface ScreenWatchSettings {
  enabled: boolean;
  intervalSeconds: number; // 30..600
  captureTarget: CaptureTarget;
  responseStyle: ScreenWatchResponseStyle;
  silentHours: ScreenWatchSilentHours;
}

export interface Settings {
  llm: LLMSettings;
  stt: STTSettings;
  tts: TTSSettings;
  globalShortcut: GlobalShortcutSettings;
  language: Language;
  /** @deprecated v15: character.name으로 이전. 마이그레이션 소스로만 유지 */
  avatarName: string;
  /** @deprecated v15: character로 이전. 마이그레이션 소스로만 유지 */
  avatarPersonalityPrompt: string;
  vrmModelPath: string;
  avatar: AvatarSettings;
  historyPanel: HistoryPanelSettings;
  preferredMonitorName: string;
  mcpEnabled: boolean;
  /** Channels ON 전의 LLM 설정 (OFF 시 복원용) */
  mcpPreviousLlm: LLMSettings | null;
  codex: CodexSettings;
  /** 캐릭터 프로필 (Phase 0) */
  character: CharacterProfile;
  /** 자발적 대화 설정 (Phase 3) */
  proactive: ProactiveSettings;
  /** 화면 관찰 설정 */
  screenWatch: ScreenWatchSettings;
  /**
   * 아바타 숨김 토글 (v2 리디자인) — true면 ControlCluster에서 AvatarCanvas/LightingControl 언마운트.
   * persist되어 앱 재시작 후에도 유지된다.
   */
  avatarHidden: boolean;
  /**
   * 아바타 숨김 진입 직전의 proactive.enabled 값 (복구용).
   * 숨김 ON 시 proactive를 강제로 OFF 하고 이 필드에 이전 값을 저장 →
   * 숨김 해제 시 이 값으로 복구한다. 평상시에는 null.
   * persist되어 앱 재시작 후 hidden=true 상태에서도 OFF가 유지되도록 보장.
   */
  proactivePreviousEnabled: boolean | null;
  /**
   * 자주 쓰는 기능 (Phase 4) — ✨ 팔레트에 등록된 기능 ID 목록.
   * 사용자가 설정에서 체크박스로 등록/해제하며, 순서는 등록 순서.
   */
  enabledQuickActions: QuickActionId[];
  /**
   * 설정 패널 섹션별 펼침 상태 — key는 섹션 key(account/lang/premium/llm/...).
   * `true`면 열림. 명시되지 않은 섹션은 접힘으로 간주되어 첫 실행 시 모든 섹션이 접힌다.
   */
  settingsPanelExpanded: Record<string, boolean>;
}

export interface SettingsState {
  settings: Settings;
  isSettingsOpen: boolean;
  isHistoryOpen: boolean;
  setSettings: (settings: Partial<Settings>) => void;
  setLLMSettings: (llm: Partial<LLMSettings>) => void;
  setSTTSettings: (stt: Partial<STTSettings>) => void;
  setTTSSettings: (tts: Partial<TTSSettings>) => void;
  setGlobalShortcutSettings: (shortcut: Partial<GlobalShortcutSettings>) => void;
  setAvatarSettings: (avatar: Partial<AvatarSettings>) => void;
  setLanguage: (language: Language) => void;
  setCodexSettings: (codex: Partial<CodexSettings>) => void;
  setScreenWatchSettings: (screenWatch: Partial<ScreenWatchSettings>) => void;
  setAvatarName: (name: string) => void;
  setAvatarPersonalityPrompt: (prompt: string) => void;
  setVrmModelPath: (path: string) => void;
  setCharacter: (character: Partial<CharacterProfile>) => void;
  /**
   * 프리셋 적용 전용 — 기존 character 상태를 계승하지 않고
   * DEFAULT_CHARACTER_PROFILE을 baseline으로 초기화 후 profile을 덮어쓴다.
   * 이전 archetype의 background/likes/dislikes/exampleDialogues 등
   * optional 필드가 누수되지 않도록 보장.
   */
  applyCharacterPreset: (profile: CharacterProfile) => void;
  setProactive: (proactive: Partial<ProactiveSettings>) => void;
  setAvatarHidden: (hidden: boolean) => void;
  toggleAvatarHidden: () => void;
  setEnabledQuickActions: (ids: QuickActionId[]) => void;
  toggleQuickAction: (id: QuickActionId) => void;
  toggleSettings: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  resetSettings: () => void;
  /** 설정 패널 특정 섹션의 펼침 상태 토글. */
  toggleSettingsPanelSection: (key: string) => void;
  toggleHistory: () => void;
  openHistory: () => void;
  closeHistory: () => void;
  setHistoryPanelSettings: (panel: Partial<HistoryPanelSettings>) => void;
}

const LEGACY_BUNDLED_VRM_PATHS = new Set([
  '/vrm/eunyeon_ps.vrm',
  'vrm/eunyeon_ps.vrm',
]);

const SUPPORTED_WHISPER_MODELS = new Set(['base', 'small', 'medium']);
const SUPPORTED_SUPERTONIC_VOICES = new Set([
  'F1', 'F2', 'F3', 'F4', 'F5',
  'M1', 'M2', 'M3', 'M4', 'M5',
]);

function normalizeVrmModelPath(path: unknown): string {
  if (typeof path !== 'string') return '';
  const trimmed = path.trim();
  if (!trimmed) return '';
  const normalized = trimmed.replace(/\\/g, '/');
  if (LEGACY_BUNDLED_VRM_PATHS.has(normalized)) return '';
  return trimmed;
}

function normalizeWhisperModel(model: unknown): string {
  if (typeof model !== 'string') return 'base';
  const normalized = model.trim().toLowerCase();
  if (!normalized) return 'base';
  if (SUPPORTED_WHISPER_MODELS.has(normalized)) return normalized;

  // Support legacy persisted values such as ggml-small.bin, small.en, etc.
  if (normalized.includes('medium')) return 'medium';
  if (normalized.includes('small')) return 'small';
  return 'base';
}

function normalizeSupertonicVoice(voice: unknown): string {
  if (typeof voice !== 'string') return 'F1';
  const normalized = voice.trim().toUpperCase();
  if (SUPPORTED_SUPERTONIC_VOICES.has(normalized)) return normalized;
  return 'F1';
}

function normalizeGlobalShortcutEnabled(enabled: unknown): boolean {
  return typeof enabled === 'boolean' ? enabled : true;
}

function normalizeGlobalShortcutSettings(
  shortcut: Partial<GlobalShortcutSettings> | undefined
): GlobalShortcutSettings {
  return {
    enabled: normalizeGlobalShortcutEnabled(shortcut?.enabled),
    accelerator: normalizeGlobalShortcutAccelerator(shortcut?.accelerator),
  };
}

function normalizeInitialViewRotation(rotation: unknown): ViewRotationSettings {
  if (!rotation || typeof rotation !== 'object') {
    return { x: 0, y: 0 };
  }

  const source = rotation as { x?: unknown; y?: unknown };
  const x = typeof source.x === 'number' && Number.isFinite(source.x)
    ? Math.max(-0.5, Math.min(0.5, source.x))
    : 0;
  const y = typeof source.y === 'number' && Number.isFinite(source.y)
    ? source.y
    : 0;

  return { x, y };
}

function normalizeMotionDiversity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1.0;
  return Math.max(0, Math.min(1, value));
}

function normalizeDynamicMotionBoost(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1.0;
  return Math.max(0, Math.min(1.5, value));
}

function normalizeFaceExpressionOnlyMode(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}

function normalizeLanguage(language: unknown): Language {
  if (language === 'ko' || language === 'en' || language === 'ja') return language;
  return 'ko';
}

function normalizeTTSEngine(engine: unknown): TTSEngine {
  if (engine === 'supertonic' || engine === 'supertone_api') return engine;
  return 'supertonic';
}

const SUPPORTED_TTS_OUTPUT_LANGUAGES = new Set<TTSOutputLanguage>([
  'auto', 'ko', 'en', 'ja', 'es', 'pt', 'fr',
]);

function normalizeTTSOutputLanguage(language: unknown): TTSOutputLanguage {
  if (typeof language === 'string' && SUPPORTED_TTS_OUTPUT_LANGUAGES.has(language as TTSOutputLanguage)) {
    return language as TTSOutputLanguage;
  }
  return 'auto';
}

function normalizeAvatarName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name.trim().slice(0, 40);
}

function normalizeAvatarPersonalityPrompt(prompt: unknown): string {
  if (typeof prompt !== 'string') return '';
  return prompt.slice(0, 800);
}

const defaultSettings: Settings = {
  llm: {
    provider: 'ollama',
    model: 'deepseek-v3',
    endpoint: 'http://localhost:11434',
  },
  stt: {
    engine: 'whisper',
    model: 'base',
  },
  tts: {
    engine: 'supertonic',
    voice: 'F1',
    language: 'auto',
  },
  globalShortcut: {
    enabled: true,
    accelerator: DEFAULT_GLOBAL_SHORTCUT_ACCELERATOR,
  },
  language: 'ko',
  avatarName: '',
  avatarPersonalityPrompt: '',
  vrmModelPath: '',
  avatar: {
    scale: 1.0,
    movementSpeed: 50,
    freeMovement: false,
    autoRoam: false,
    showSpeechBubble: true,
    physics: {
      enabled: true,
      gravityMultiplier: 1.0,
      stiffnessMultiplier: 1.0,
    },
    animation: {
      expressionBlendSpeed: 0.1,
      enableGestures: true,
      enableMotionClips: true,
      faceExpressionOnlyMode: false,
      dynamicMotionEnabled: true,
      dynamicMotionBoost: 1.0,
      enableDancing: true,
      danceIntensity: 0.7,
      motionDiversity: 1.0,
      enableBreathing: true,
      enableEyeDrift: true,
      gazeFollow: true,
      backchannel: true,
    },
    lighting: {
      ambientIntensity: 1.0,
      directionalIntensity: 1.0,
      directionalPosition: { x: 0, y: 1, z: 2 },
      showControl: true,
    },
    initialViewRotation: {
      x: 0,
      y: 0,
    },
  },
  historyPanel: {
    position: null,
    size: { width: 320, height: 480 },
    fontSize: 14,
    opacity: 95,
  },
  preferredMonitorName: '',
  mcpEnabled: false,
  mcpPreviousLlm: null,
  codex: {
    model: 'gpt-5.4',
    reasoningEffort: 'medium',
    workingDir: '',
    approvalPolicy: 'on-request',
  },
  character: DEFAULT_CHARACTER_PROFILE,
  proactive: DEFAULT_PROACTIVE_SETTINGS,
  screenWatch: {
    enabled: false,
    intervalSeconds: 120,
    captureTarget: { type: 'fullscreen' },
    responseStyle: 'balanced',
    silentHours: { enabled: false, start: 23, end: 7 },
  },
  avatarHidden: false,
  proactivePreviousEnabled: null,
  enabledQuickActions: [
    'avatar.freeMovement',
    'avatar.showSpeechBubble',
    'voice.globalShortcut',
    'screen.watch',
  ],
  settingsPanelExpanded: {},
};

function normalizeAvatarSettings(avatar: Partial<AvatarSettings> | undefined): AvatarSettings {
  const legacyAvatar = (avatar || {}) as Partial<AvatarSettings>;

  return {
    ...defaultSettings.avatar,
    ...legacyAvatar,
    freeMovement: typeof legacyAvatar.freeMovement === 'boolean'
      ? legacyAvatar.freeMovement
      : defaultSettings.avatar.freeMovement,
    autoRoam: typeof (legacyAvatar as any).autoRoam === 'boolean'
      ? (legacyAvatar as any).autoRoam
      : defaultSettings.avatar.autoRoam,
    showSpeechBubble: typeof legacyAvatar.showSpeechBubble === 'boolean'
      ? legacyAvatar.showSpeechBubble
      : defaultSettings.avatar.showSpeechBubble,
    physics: {
      ...defaultSettings.avatar.physics,
      ...(legacyAvatar.physics || {}),
    },
    animation: {
      ...defaultSettings.avatar.animation,
      ...(legacyAvatar.animation || {}),
      motionDiversity: normalizeMotionDiversity(
        legacyAvatar.animation?.motionDiversity
      ),
      dynamicMotionBoost: normalizeDynamicMotionBoost(
        legacyAvatar.animation?.dynamicMotionBoost
      ),
      dynamicMotionEnabled:
        typeof legacyAvatar.animation?.dynamicMotionEnabled === 'boolean'
          ? legacyAvatar.animation.dynamicMotionEnabled
          : defaultSettings.avatar.animation.dynamicMotionEnabled,
      faceExpressionOnlyMode: normalizeFaceExpressionOnlyMode(
        legacyAvatar.animation?.faceExpressionOnlyMode
      ),
    },
    lighting: {
      ...defaultSettings.avatar.lighting,
      ...(legacyAvatar.lighting || {}),
      directionalPosition: {
        ...defaultSettings.avatar.lighting.directionalPosition,
        ...(legacyAvatar.lighting?.directionalPosition || {}),
      },
    },
    initialViewRotation: normalizeInitialViewRotation(legacyAvatar.initialViewRotation),
  };
}

function normalizeSettings(settings: Partial<Settings> | undefined): Settings {
  const source = settings || {};

  return {
    ...defaultSettings,
    ...source,
    language: normalizeLanguage(source.language),
    avatarName: normalizeAvatarName(source.avatarName),
    avatarPersonalityPrompt: normalizeAvatarPersonalityPrompt(
      source.avatarPersonalityPrompt
    ),
    vrmModelPath: normalizeVrmModelPath(source.vrmModelPath),
    stt: {
      ...(source.stt || defaultSettings.stt),
      engine: 'whisper',
      model: normalizeWhisperModel(source.stt?.model),
      audioInputDeviceId: typeof source.stt?.audioInputDeviceId === 'string'
        ? source.stt.audioInputDeviceId
        : undefined,
    },
    tts: {
      ...(source.tts || defaultSettings.tts),
      engine: normalizeTTSEngine(source.tts?.engine),
      voice: normalizeSupertonicVoice(source.tts?.voice),
      language: normalizeTTSOutputLanguage(source.tts?.language),
      audioOutputDeviceId: typeof source.tts?.audioOutputDeviceId === 'string'
        ? source.tts.audioOutputDeviceId
        : undefined,
    },
    globalShortcut: normalizeGlobalShortcutSettings(
      source.globalShortcut as Partial<GlobalShortcutSettings> | undefined
    ),
    avatar: normalizeAvatarSettings(source.avatar),
    historyPanel: {
      ...defaultSettings.historyPanel,
      ...(source.historyPanel || {}),
      size: {
        ...defaultSettings.historyPanel.size,
        ...(source.historyPanel?.size || {}),
      },
      position:
        source.historyPanel?.position === null || source.historyPanel?.position
          ? source.historyPanel.position
          : defaultSettings.historyPanel.position,
      fontSize:
        typeof source.historyPanel?.fontSize === 'number' && Number.isFinite(source.historyPanel.fontSize)
          ? source.historyPanel.fontSize
          : defaultSettings.historyPanel.fontSize,
      opacity:
        typeof source.historyPanel?.opacity === 'number' && Number.isFinite(source.historyPanel.opacity)
          ? source.historyPanel.opacity
          : defaultSettings.historyPanel.opacity,
    },
    preferredMonitorName:
      typeof source.preferredMonitorName === 'string'
        ? source.preferredMonitorName
        : defaultSettings.preferredMonitorName,
    mcpEnabled:
      typeof source.mcpEnabled === 'boolean'
        ? source.mcpEnabled
        : defaultSettings.mcpEnabled,
    mcpPreviousLlm:
      source.mcpPreviousLlm && typeof source.mcpPreviousLlm === 'object'
        ? source.mcpPreviousLlm as LLMSettings
        : null,
    codex: {
      ...defaultSettings.codex,
      ...(source.codex || {}),
    },
    character: normalizeCharacterProfile(source.character),
    proactive: normalizeProactiveSettings(source.proactive),
    screenWatch: normalizeScreenWatchSettings(source.screenWatch),
    avatarHidden: typeof source.avatarHidden === 'boolean' ? source.avatarHidden : false,
    proactivePreviousEnabled:
      typeof source.proactivePreviousEnabled === 'boolean'
        ? source.proactivePreviousEnabled
        : null,
    // enabledQuickActions: source가 없거나, source 항목이 있는데 모두 invalid한 경우만
    // default로 복구. 사용자가 의도적으로 모두 해제한 빈 배열은 존중.
    enabledQuickActions: (() => {
      const arr = Array.isArray(source.enabledQuickActions) ? source.enabledQuickActions : null;
      if (arr === null) return defaultSettings.enabledQuickActions;
      const filtered = arr.filter((id): id is QuickActionId =>
        typeof id === 'string' && ALL_QUICK_ACTION_IDS.has(id as QuickActionId)
      );
      // source는 있는데 모두 invalid → 마이그레이션 누락 가능성, default로 복구
      if (arr.length > 0 && filtered.length === 0) return defaultSettings.enabledQuickActions;
      return filtered;
    })(),
    settingsPanelExpanded: (() => {
      const raw = source.settingsPanelExpanded;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof v === 'boolean') out[k] = v;
      }
      return out;
    })(),
  };
}

/**
 * 아바타 숨김 토글 시 자발적 대화(proactive)를 자동 OFF/복구.
 *
 * - hidden=true 진입: proactive.enabled가 true면 → previousEnabled에 저장 후 OFF.
 *   이미 OFF였다면 previousEnabled는 null로 두어 복구 시점에 변화 없음.
 * - hidden=false 해제: previousEnabled가 boolean(true 또는 false)이면
 *   그 값으로 proactive.enabled 복구. null이면 그대로 둔다.
 */
function applyAvatarHiddenTransition(
  current: Settings,
  nextHidden: boolean
): { settings: Settings } {
  // 동일 상태로의 토글은 no-op (proactivePreviousEnabled 부수효과 방지)
  if (nextHidden === current.avatarHidden) {
    return { settings: { ...current, avatarHidden: nextHidden } };
  }

  if (nextHidden) {
    // 숨김 진입
    const wasEnabled = current.proactive?.enabled === true;
    return {
      settings: {
        ...current,
        avatarHidden: true,
        proactive: wasEnabled
          ? { ...current.proactive, enabled: false }
          : current.proactive,
        proactivePreviousEnabled: wasEnabled ? true : null,
      },
    };
  }

  // 숨김 해제 — previousEnabled가 명시적으로 저장돼 있으면 복구
  const prev = current.proactivePreviousEnabled;
  return {
    settings: {
      ...current,
      avatarHidden: false,
      proactive:
        typeof prev === 'boolean'
          ? { ...current.proactive, enabled: prev }
          : current.proactive,
      proactivePreviousEnabled: null,
    },
  };
}

function normalizeProactiveSettings(raw: unknown): ProactiveSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_PROACTIVE_SETTINGS;
  const source = raw as Partial<ProactiveSettings>;
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_PROACTIVE_SETTINGS.enabled,
    idleMinutes: typeof source.idleMinutes === 'number' && Number.isFinite(source.idleMinutes)
      ? Math.max(1, Math.min(60, source.idleMinutes))
      : DEFAULT_PROACTIVE_SETTINGS.idleMinutes,
    cooldownMinutes: typeof source.cooldownMinutes === 'number' && Number.isFinite(source.cooldownMinutes)
      ? Math.max(1, Math.min(120, source.cooldownMinutes))
      : DEFAULT_PROACTIVE_SETTINGS.cooldownMinutes,
  };
}

function normalizeCharacterProfile(raw: unknown): CharacterProfile {
  if (!raw || typeof raw !== 'object') return DEFAULT_CHARACTER_PROFILE;
  const source = raw as Partial<CharacterProfile>;

  const personality = source.personality && typeof source.personality === 'object'
    ? {
        ...DEFAULT_CHARACTER_PROFILE.personality,
        ...source.personality,
        traits: Array.isArray(source.personality.traits)
          ? source.personality.traits.filter((t): t is string => typeof t === 'string').slice(0, 5)
          : DEFAULT_CHARACTER_PROFILE.personality.traits,
      }
    : DEFAULT_CHARACTER_PROFILE.personality;

  return {
    name: typeof source.name === 'string' ? source.name.slice(0, 40) : DEFAULT_CHARACTER_PROFILE.name,
    age: typeof source.age === 'string' ? source.age.slice(0, 40) : undefined,
    species: typeof source.species === 'string' ? source.species.slice(0, 40) : undefined,
    personality,
    background: typeof source.background === 'string' ? source.background.slice(0, 500) : undefined,
    likes: Array.isArray(source.likes)
      ? source.likes.filter((l): l is string => typeof l === 'string').slice(0, 10)
      : undefined,
    dislikes: Array.isArray(source.dislikes)
      ? source.dislikes.filter((d): d is string => typeof d === 'string').slice(0, 10)
      : undefined,
    exampleDialogues: Array.isArray(source.exampleDialogues)
      ? source.exampleDialogues
          .filter((d): d is ExampleDialogue =>
            d != null && typeof d === 'object' &&
            typeof (d as ExampleDialogue).user === 'string' &&
            typeof (d as ExampleDialogue).assistant === 'string')
          .slice(0, 5)
      : [],
    userRelation: typeof source.userRelation === 'string' ? source.userRelation.slice(0, 40) : DEFAULT_CHARACTER_PROFILE.userRelation,
    honorific: source.honorific === 'casual' || source.honorific === 'polite' || source.honorific === 'mixed'
      ? source.honorific
      : DEFAULT_CHARACTER_PROFILE.honorific,
  };
}

function normalizeScreenWatchSettings(
  value: Partial<ScreenWatchSettings> | undefined
): ScreenWatchSettings {
  const d = defaultSettings.screenWatch;
  if (!value || typeof value !== 'object') return d;

  const interval = Number(value.intervalSeconds);
  const clampedInterval = Number.isFinite(interval)
    ? Math.max(30, Math.min(600, Math.round(interval)))
    : d.intervalSeconds;

  const style: ScreenWatchResponseStyle =
    value.responseStyle === 'advisor' ||
    value.responseStyle === 'comedian' ||
    value.responseStyle === 'analyst' ||
    value.responseStyle === 'balanced'
      ? value.responseStyle
      : d.responseStyle;

  const target = normalizeCaptureTarget(value.captureTarget);
  const silentHours = normalizeSilentHours(value.silentHours);

  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : d.enabled,
    intervalSeconds: clampedInterval,
    captureTarget: target,
    responseStyle: style,
    silentHours,
  };
}

function normalizeCaptureTarget(value: unknown): CaptureTarget {
  const fallback: CaptureTarget = { type: 'fullscreen' };
  if (!value || typeof value !== 'object') return fallback;
  const v = value as Partial<CaptureTarget> & { type?: string };
  switch (v.type) {
    case 'fullscreen':
    case 'active-window':
    case 'main-monitor':
      return { type: v.type };
    case 'monitor': {
      // 빈 monitorName은 "아직 선택 안 함" 상태로 유지 (UI에서 목록을 보여주기 위해).
      // 실제 캡처 시점에 Rust가 fail-closed로 거부한다.
      const m = v as Extract<CaptureTarget, { type: 'monitor' }>;
      const name = typeof m.monitorName === 'string' ? m.monitorName : '';
      return { type: 'monitor', monitorName: name };
    }
    case 'window': {
      // 빈 appName도 허용 (선택 전 상태). 실제 캡처 시 Rust가 검증.
      const w = v as Extract<CaptureTarget, { type: 'window' }>;
      const app = typeof w.appName === 'string' ? w.appName : '';
      return {
        type: 'window',
        appName: app,
        windowTitle: typeof w.windowTitle === 'string' ? w.windowTitle : undefined,
      };
    }
    default:
      return fallback;
  }
}

function normalizeSilentHours(value: unknown): ScreenWatchSilentHours {
  const d = defaultSettings.screenWatch.silentHours;
  if (!value || typeof value !== 'object') return d;
  const v = value as Partial<ScreenWatchSilentHours>;
  const clampHour = (n: unknown): number => {
    const num = Number(n);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(23, Math.round(num)));
  };
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : d.enabled,
    start: v.start !== undefined ? clampHour(v.start) : d.start,
    end: v.end !== undefined ? clampHour(v.end) : d.end,
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      isSettingsOpen: false,
      isHistoryOpen: false,

      setSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      setLLMSettings: (llm) =>
        set((state) => ({
          settings: {
            ...state.settings,
            llm: { ...state.settings.llm, ...llm },
          },
        })),

      setSTTSettings: (stt) =>
        set((state) => ({
          settings: {
            ...state.settings,
            stt: {
              ...state.settings.stt,
              ...stt,
              engine: 'whisper',
              model: normalizeWhisperModel(stt.model ?? state.settings.stt.model),
              audioInputDeviceId: 'audioInputDeviceId' in stt
                ? (typeof stt.audioInputDeviceId === 'string' ? stt.audioInputDeviceId : undefined)
                : state.settings.stt.audioInputDeviceId,
            },
          },
        })),

      setTTSSettings: (tts) =>
        set((state) => ({
          settings: {
            ...state.settings,
            tts: {
              ...state.settings.tts,
              ...tts,
              engine: normalizeTTSEngine(tts.engine ?? state.settings.tts.engine),
              voice: normalizeSupertonicVoice(tts.voice ?? state.settings.tts.voice),
              language: 'language' in tts
                ? normalizeTTSOutputLanguage(tts.language)
                : (state.settings.tts.language ?? 'auto'),
              audioOutputDeviceId: 'audioOutputDeviceId' in tts
                ? (typeof tts.audioOutputDeviceId === 'string' ? tts.audioOutputDeviceId : undefined)
                : state.settings.tts.audioOutputDeviceId,
            },
          },
        })),

      setGlobalShortcutSettings: (shortcut) =>
        set((state) => ({
          settings: {
            ...state.settings,
            globalShortcut: normalizeGlobalShortcutSettings({
              ...state.settings.globalShortcut,
              ...shortcut,
            }),
          },
        })),

      setAvatarSettings: (avatar) =>
        set((state) => ({
          settings: {
            ...state.settings,
            avatar: { ...state.settings.avatar, ...avatar },
          },
        })),

      setCodexSettings: (codex) =>
        set((state) => ({
          settings: {
            ...state.settings,
            codex: { ...state.settings.codex, ...codex },
          },
        })),

      setScreenWatchSettings: (screenWatch) =>
        set((state) => ({
          settings: {
            ...state.settings,
            screenWatch: normalizeScreenWatchSettings({
              ...state.settings.screenWatch,
              ...screenWatch,
            }),
          },
        })),

      setLanguage: (language) =>
        set((state) => ({
          settings: { ...state.settings, language },
        })),

      setAvatarName: (name) =>
        set((state) => ({
          settings: { ...state.settings, avatarName: normalizeAvatarName(name) },
        })),

      setAvatarPersonalityPrompt: (prompt) =>
        set((state) => ({
          settings: {
            ...state.settings,
            avatarPersonalityPrompt: normalizeAvatarPersonalityPrompt(prompt),
          },
        })),

      setCharacter: (character) =>
        set((state) => ({
          settings: {
            ...state.settings,
            character: normalizeCharacterProfile({
              ...state.settings.character,
              ...character,
              personality: character.personality
                ? { ...state.settings.character.personality, ...character.personality }
                : state.settings.character.personality,
            }),
            // 하위호환: character.name이 변경되면 avatarName도 동기화
            ...(character.name !== undefined ? { avatarName: normalizeAvatarName(character.name) } : {}),
          },
        })),

      applyCharacterPreset: (profile) =>
        set((state) => ({
          settings: {
            ...state.settings,
            // DEFAULT_CHARACTER_PROFILE을 baseline으로 하고 profile로 덮어씀 —
            // 이전 상태의 optional 필드(background, likes, dislikes, 예시 등)는 모두 리셋된다.
            character: normalizeCharacterProfile({
              ...DEFAULT_CHARACTER_PROFILE,
              ...profile,
              personality: {
                ...DEFAULT_CHARACTER_PROFILE.personality,
                ...(profile.personality ?? {}),
              },
            }),
            ...(profile.name !== undefined ? { avatarName: normalizeAvatarName(profile.name) } : {}),
          },
        })),

      setProactive: (proactive) =>
        set((state) => {
          const next = {
            ...state.settings,
            proactive: { ...DEFAULT_PROACTIVE_SETTINGS, ...state.settings.proactive, ...proactive },
          };
          // 사용자가 enabled를 직접 변경했고 현재 avatar 숨김 진입 중이면
          // 자동 복구(proactivePreviousEnabled)를 비활성화한다.
          // 그렇지 않으면 hidden 해제 시 사용자 의도가 무시되고 이전 값으로 되돌아감.
          if (proactive.enabled !== undefined && state.settings.avatarHidden) {
            next.proactivePreviousEnabled = null;
          }
          return { settings: next };
        }),

      setAvatarHidden: (hidden) =>
        set((state) => applyAvatarHiddenTransition(state.settings, Boolean(hidden))),

      toggleAvatarHidden: () =>
        set((state) =>
          applyAvatarHiddenTransition(state.settings, !state.settings.avatarHidden)
        ),

      setEnabledQuickActions: (ids) =>
        set((state) => ({
          settings: {
            ...state.settings,
            enabledQuickActions: ids.filter((id) => ALL_QUICK_ACTION_IDS.has(id)),
          },
        })),

      toggleQuickAction: (id) =>
        set((state) => {
          if (!ALL_QUICK_ACTION_IDS.has(id)) return state;
          const curr = state.settings.enabledQuickActions ?? [];
          const next = curr.includes(id)
            ? curr.filter((x) => x !== id)
            : [...curr, id];
          return {
            settings: { ...state.settings, enabledQuickActions: next },
          };
        }),

      setVrmModelPath: (path) =>
        set((state) => ({
          settings: { ...state.settings, vrmModelPath: normalizeVrmModelPath(path) },
        })),

      toggleSettings: () =>
        set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

      openSettings: () => set({ isSettingsOpen: true }),

      closeSettings: () => set({ isSettingsOpen: false }),

      resetSettings: () => set({ settings: defaultSettings }),

      toggleSettingsPanelSection: (key) =>
        set((state) => {
          const current = state.settings.settingsPanelExpanded ?? {};
          const next = { ...current, [key]: !current[key] };
          return {
            settings: {
              ...state.settings,
              settingsPanelExpanded: next,
            },
          };
        }),

      toggleHistory: () =>
        set((state) => ({ isHistoryOpen: !state.isHistoryOpen })),

      openHistory: () => set({ isHistoryOpen: true }),

      closeHistory: () => set({ isHistoryOpen: false }),

      setHistoryPanelSettings: (panel) =>
        set((state) => ({
          settings: {
            ...state.settings,
            historyPanel: {
              ...defaultSettings.historyPanel,
              ...(state.settings.historyPanel ?? {}),
              ...panel,
            },
          },
        })),
    }),
    {
      name: 'mypartnerai-settings',
      version: 21,
      merge: (persistedState, currentState) => {
        const persisted = (persistedState || {}) as Partial<SettingsState>;
        const persistedSettings = persisted.settings as Partial<Settings> | undefined;

        return {
          ...currentState,
          ...persisted,
          settings: normalizeSettings(
            persistedSettings ?? currentState.settings
          ),
        };
      },
      migrate: (persistedState, version) => {
        // 1차 가드: persistedState 자체가 falsy/non-object인 경우 (clean install 등)
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState;
        }

        const state = persistedState as { settings?: Partial<Settings> } & Record<string, unknown>;
        // 2차 가드: state.settings 누락 (스토어 schema가 크게 바뀌었거나 데이터 손상)
        // 이후 모든 블록은 s.* 접근이 안전하다는 invariant 유지.
        if (!state.settings) return persistedState;

        // v14→v15: avatarName/avatarPersonalityPrompt → character 마이그레이션
        if ((version ?? 0) < 15) {
          const s = state.settings;
          if (!s.character) {
            const name = typeof s.avatarName === 'string' ? s.avatarName : '';
            const prompt = typeof s.avatarPersonalityPrompt === 'string' ? s.avatarPersonalityPrompt : '';
            if (name || prompt) {
              s.character = migrateFromLegacy(name, prompt);
            }
          }
        }

        // v15→v16: avatarHidden 필드 추가 (기본 false)
        if ((version ?? 0) < 16) {
          const s = state.settings;
          if (typeof s.avatarHidden !== 'boolean') {
            s.avatarHidden = false;
          }
        }

        // v16→v17: enabledQuickActions 필드 추가 (기본: calendar/mail/translate/capture)
        if ((version ?? 0) < 17) {
          const s = state.settings;
          if (!Array.isArray(s.enabledQuickActions)) {
            s.enabledQuickActions = ['calendar', 'mail', 'translate', 'capture'];
          }
        }

        // v17→v18: Quick Actions 모델 변경 (LLM 프롬프트 → 설정 토글).
        // 기존 ID(calendar/mail/...)는 모두 무효이므로 새 기본값으로 교체.
        if ((version ?? 0) < 18) {
          const s = state.settings;
          s.enabledQuickActions = [
            'avatar.freeMovement',
            'avatar.showSpeechBubble',
            'voice.globalShortcut',
            'screen.watch',
          ];
        }

        // v18→v19: avatar 숨김 시 proactive 자동 OFF/복구 위한
        // proactivePreviousEnabled 필드 추가 (기본 null).
        if ((version ?? 0) < 19) {
          const s = state.settings as Partial<Settings>;
          if (typeof s.proactivePreviousEnabled !== 'boolean' && s.proactivePreviousEnabled !== null) {
            s.proactivePreviousEnabled = null;
          }
          // 이미 hidden=true 상태로 persist돼 있고 proactive.enabled=true면
          // 의도된 자동 OFF가 누락된 상태이므로 일관성 확보:
          //   기존 enabled를 previousEnabled에 옮기고 proactive는 OFF.
          // s.proactive 명시 가드로 TS narrowing + spread 안전성 보장.
          if (s.avatarHidden === true && s.proactive && s.proactive.enabled === true) {
            s.proactivePreviousEnabled = true;
            s.proactive = { ...s.proactive, enabled: false };
          }
        }

        // v19→v20: TTS 출력 언어 필드 추가. 기본 'auto'(기존 동작 유지).
        if ((version ?? 0) < 20) {
          const s = state.settings as Partial<Settings>;
          if (s.tts && typeof (s.tts as TTSSettings).language !== 'string') {
            s.tts = { ...(s.tts as TTSSettings), language: 'auto' };
          }
        }

        // v20→v21: 설정 패널 섹션 펼침 상태 필드 추가 (빈 객체 = 모두 접힘).
        if ((version ?? 0) < 21) {
          const s = state.settings as Partial<Settings>;
          if (!s.settingsPanelExpanded || typeof s.settingsPanelExpanded !== 'object') {
            s.settingsPanelExpanded = {};
          }
        }

        return {
          ...state,
          settings: normalizeSettings(state.settings),
        };
      },
    }
  )
);
