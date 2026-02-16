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
  enableDancing: boolean;
  danceIntensity: number;
}

export interface LightingSettings {
  ambientIntensity: number;
  directionalIntensity: number;
  directionalPosition: { x: number; y: number; z: number };
  showControl: boolean;
}

export interface AvatarSettings {
  scale: number;
  movementSpeed: number;
  physics: PhysicsSettings;
  animation: AnimationSettings;
  lighting: LightingSettings;
}

export interface Settings {
  llm: LLMSettings;
  stt: STTSettings;
  tts: TTSSettings;
  language: Language;
  vrmModelPath: string;
  avatar: AvatarSettings;
}

interface SettingsState {
  settings: Settings;
  isSettingsOpen: boolean;
  setSettings: (settings: Partial<Settings>) => void;
  setLLMSettings: (llm: Partial<LLMSettings>) => void;
  setSTTSettings: (stt: Partial<STTSettings>) => void;
  setTTSSettings: (tts: Partial<TTSSettings>) => void;
  setAvatarSettings: (avatar: Partial<AvatarSettings>) => void;
  setLanguage: (language: Language) => void;
  setVrmModelPath: (path: string) => void;
  toggleSettings: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  resetSettings: () => void;
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
  vrmModelPath: '/vrm/eunyeon_ps.vrm',
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
      enableDancing: true,
      danceIntensity: 0.7,
    },
    lighting: {
      ambientIntensity: 1.0,
      directionalIntensity: 1.0,
      directionalPosition: { x: 0, y: 1, z: 2 },
      showControl: true,
    },
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      isSettingsOpen: false,

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
            stt: { ...state.settings.stt, ...stt },
          },
        })),

      setTTSSettings: (tts) =>
        set((state) => ({
          settings: {
            ...state.settings,
            tts: { ...state.settings.tts, ...tts },
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

      setVrmModelPath: (path) =>
        set((state) => ({
          settings: { ...state.settings, vrmModelPath: path },
        })),

      toggleSettings: () =>
        set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

      openSettings: () => set({ isSettingsOpen: true }),

      closeSettings: () => set({ isSettingsOpen: false }),

      resetSettings: () => set({ settings: defaultSettings }),
    }),
    {
      name: 'mypartnerai-settings',
    }
  )
);
