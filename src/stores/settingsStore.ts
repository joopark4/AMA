/**
 * 설정 스토어 - Zustand persist 기반 전역 설정 관리
 * 자세한 문서: docs/settings-system.md
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LLMProvider = 'ollama' | 'localai' | 'claude' | 'openai' | 'gemini';

// STT 엔진: whisper (로컬 whisper-cli)
export type STTEngine = 'whisper';

// TTS 엔진: supertonic (고품질 로컬 TTS)
export type TTSEngine = 'supertonic';
export type Language = 'ko' | 'en';

export interface LLMSettings {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  endpoint?: string;
}

export interface STTSettings {
  engine: STTEngine;
  model: string;
}

export interface TTSSettings {
  engine: TTSEngine;
  voice?: string;
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
  physics: PhysicsSettings;
  animation: AnimationSettings;
  lighting: LightingSettings;
  initialViewRotation: ViewRotationSettings;
}

export interface HistoryPanelSettings {
  position: { x: number; y: number } | null;
  size: { width: number; height: number };
  fontSize: number;
}

export interface Settings {
  llm: LLMSettings;
  stt: STTSettings;
  tts: TTSSettings;
  language: Language;
  avatarName: string;
  avatarPersonalityPrompt: string;
  vrmModelPath: string;
  avatar: AvatarSettings;
  historyPanel: HistoryPanelSettings;
}

interface SettingsState {
  settings: Settings;
  isSettingsOpen: boolean;
  isHistoryOpen: boolean;
  setSettings: (settings: Partial<Settings>) => void;
  setLLMSettings: (llm: Partial<LLMSettings>) => void;
  setSTTSettings: (stt: Partial<STTSettings>) => void;
  setTTSSettings: (tts: Partial<TTSSettings>) => void;
  setAvatarSettings: (avatar: Partial<AvatarSettings>) => void;
  setLanguage: (language: Language) => void;
  setAvatarName: (name: string) => void;
  setAvatarPersonalityPrompt: (prompt: string) => void;
  setVrmModelPath: (path: string) => void;
  toggleSettings: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  resetSettings: () => void;
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
  },
  language: 'ko',
  avatarName: '',
  avatarPersonalityPrompt: '',
  vrmModelPath: '',
  avatar: {
    scale: 1.0,
    movementSpeed: 50,
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
  },
};

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
              engine: 'supertonic',
              voice: normalizeSupertonicVoice(tts.voice ?? state.settings.tts.voice),
            },
          },
        })),

      setAvatarSettings: (avatar) =>
        set((state) => ({
          settings: {
            ...state.settings,
            avatar: { ...state.settings.avatar, ...avatar },
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

      setVrmModelPath: (path) =>
        set((state) => ({
          settings: { ...state.settings, vrmModelPath: normalizeVrmModelPath(path) },
        })),

      toggleSettings: () =>
        set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

      openSettings: () => set({ isSettingsOpen: true }),

      closeSettings: () => set({ isSettingsOpen: false }),

      resetSettings: () => set({ settings: defaultSettings }),

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
      version: 10,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState;
        }

        const state = persistedState as { settings?: Partial<Settings> } & Record<string, unknown>;
        if (!state.settings) return persistedState;

        const legacyAvatar = (state.settings.avatar || {}) as Partial<AvatarSettings>;
        const normalizedAvatar: AvatarSettings = {
          ...defaultSettings.avatar,
          ...legacyAvatar,
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

        const normalizedSettings: Partial<Settings> = {
          ...state.settings,
          avatarName: normalizeAvatarName(state.settings.avatarName),
          avatarPersonalityPrompt: normalizeAvatarPersonalityPrompt(
            state.settings.avatarPersonalityPrompt
          ),
          stt: {
            ...(state.settings.stt || defaultSettings.stt),
            engine: 'whisper',
            model: normalizeWhisperModel(state.settings.stt?.model),
          },
          tts: {
            ...(state.settings.tts || defaultSettings.tts),
            engine: 'supertonic',
            voice: normalizeSupertonicVoice(state.settings.tts?.voice),
          },
          avatar: normalizedAvatar,
          historyPanel: (state.settings as any).historyPanel ?? defaultSettings.historyPanel,
        };

        return {
          ...state,
          settings: {
            ...normalizedSettings,
            vrmModelPath: normalizeVrmModelPath(normalizedSettings.vrmModelPath),
          },
        };
      },
    }
  )
);
