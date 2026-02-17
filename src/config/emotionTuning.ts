import generatedConfig from './emotionTuning.generated.json';
import type { Emotion } from '../stores/avatarStore';

export interface EmotionTuningGlobal {
  responseClearMs: number;
  happyDanceMs: number;
  idleNeutralDelayMs: number;
}

export interface EmotionTuningProfile {
  movementSpeedMultiplier: number;
  hopImpulse: number;
  quickStepDistance: number;
  expressionIntensity: number;
  expressionHoldMs: number;
  autoMoveDelayMultiplier: number;
  armSwingScale: number;
  upperBodySwingScale: number;
  walkCadenceScale: number;
  idleDampingStiffness: number;
  walkDampingStiffness: number;
}

export interface EmotionTuningConfig {
  global: EmotionTuningGlobal;
  emotions: Record<Emotion, EmotionTuningProfile>;
  meta?: Record<string, unknown>;
}

const EMOTIONS: Emotion[] = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'surprised',
  'relaxed',
  'thinking',
];

const DEFAULT_PROFILE: EmotionTuningProfile = {
  movementSpeedMultiplier: 1,
  hopImpulse: 0,
  quickStepDistance: 120,
  expressionIntensity: 0.6,
  expressionHoldMs: 2800,
  autoMoveDelayMultiplier: 1,
  armSwingScale: 1,
  upperBodySwingScale: 1,
  walkCadenceScale: 1,
  idleDampingStiffness: 10,
  walkDampingStiffness: 14,
};

const DEFAULT_GLOBAL: EmotionTuningGlobal = {
  responseClearMs: 5000,
  happyDanceMs: 3500,
  idleNeutralDelayMs: 3000,
};

const DEFAULT_EMOTION_CONFIG: Record<Emotion, EmotionTuningProfile> = {
  neutral: { ...DEFAULT_PROFILE, expressionIntensity: 0.52, expressionHoldMs: 2200 },
  happy: {
    ...DEFAULT_PROFILE,
    movementSpeedMultiplier: 1.25,
    hopImpulse: 760,
    quickStepDistance: 150,
    expressionIntensity: 0.92,
    expressionHoldMs: 2900,
    autoMoveDelayMultiplier: 0.85,
    armSwingScale: 1.18,
    upperBodySwingScale: 1.12,
    walkCadenceScale: 1.1,
    idleDampingStiffness: 10,
    walkDampingStiffness: 15,
  },
  sad: {
    ...DEFAULT_PROFILE,
    movementSpeedMultiplier: 0.7,
    quickStepDistance: 90,
    expressionIntensity: 0.78,
    expressionHoldMs: 4200,
    autoMoveDelayMultiplier: 1.35,
    armSwingScale: 0.62,
    upperBodySwingScale: 0.7,
    walkCadenceScale: 0.78,
    idleDampingStiffness: 8,
    walkDampingStiffness: 11,
  },
  angry: {
    ...DEFAULT_PROFILE,
    movementSpeedMultiplier: 1.18,
    quickStepDistance: 220,
    expressionIntensity: 0.88,
    expressionHoldMs: 2500,
    autoMoveDelayMultiplier: 0.9,
    armSwingScale: 1.05,
    upperBodySwingScale: 0.92,
    walkCadenceScale: 1.15,
    idleDampingStiffness: 11,
    walkDampingStiffness: 16,
  },
  surprised: {
    ...DEFAULT_PROFILE,
    movementSpeedMultiplier: 1.35,
    hopImpulse: 900,
    quickStepDistance: 170,
    expressionIntensity: 1,
    expressionHoldMs: 2100,
    autoMoveDelayMultiplier: 0.8,
    armSwingScale: 1.25,
    upperBodySwingScale: 1.18,
    walkCadenceScale: 1.2,
    idleDampingStiffness: 10,
    walkDampingStiffness: 16,
  },
  relaxed: {
    ...DEFAULT_PROFILE,
    movementSpeedMultiplier: 0.86,
    quickStepDistance: 100,
    expressionIntensity: 0.62,
    expressionHoldMs: 3200,
    autoMoveDelayMultiplier: 1.2,
    armSwingScale: 0.82,
    upperBodySwingScale: 0.86,
    walkCadenceScale: 0.88,
    idleDampingStiffness: 9,
    walkDampingStiffness: 12,
  },
  thinking: {
    ...DEFAULT_PROFILE,
    movementSpeedMultiplier: 0.82,
    quickStepDistance: 110,
    expressionIntensity: 0.58,
    expressionHoldMs: 3600,
    autoMoveDelayMultiplier: 1.1,
    armSwingScale: 0.74,
    upperBodySwingScale: 0.78,
    walkCadenceScale: 0.9,
    idleDampingStiffness: 9,
    walkDampingStiffness: 12,
  },
};

const MIN_BOUNDS = {
  movementSpeedMultiplier: 0.5,
  hopImpulse: 0,
  quickStepDistance: 60,
  expressionIntensity: 0.2,
  expressionHoldMs: 1000,
  autoMoveDelayMultiplier: 0.6,
  armSwingScale: 0.4,
  upperBodySwingScale: 0.4,
  walkCadenceScale: 0.55,
  idleDampingStiffness: 6,
  walkDampingStiffness: 8,
  responseClearMs: 2000,
  happyDanceMs: 1000,
  idleNeutralDelayMs: 1000,
};

const MAX_BOUNDS = {
  movementSpeedMultiplier: 1.6,
  hopImpulse: 1200,
  quickStepDistance: 360,
  expressionIntensity: 1,
  expressionHoldMs: 7000,
  autoMoveDelayMultiplier: 2,
  armSwingScale: 1.8,
  upperBodySwingScale: 1.8,
  walkCadenceScale: 1.8,
  idleDampingStiffness: 18,
  walkDampingStiffness: 22,
  responseClearMs: 12000,
  happyDanceMs: 9000,
  idleNeutralDelayMs: 9000,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return clamp(value, min, max);
}

function normalizeProfile(raw: unknown, fallback: EmotionTuningProfile): EmotionTuningProfile {
  const source = isRecord(raw) ? raw : {};
  return {
    movementSpeedMultiplier: toNumber(
      source.movementSpeedMultiplier,
      fallback.movementSpeedMultiplier,
      MIN_BOUNDS.movementSpeedMultiplier,
      MAX_BOUNDS.movementSpeedMultiplier
    ),
    hopImpulse: toNumber(
      source.hopImpulse,
      fallback.hopImpulse,
      MIN_BOUNDS.hopImpulse,
      MAX_BOUNDS.hopImpulse
    ),
    quickStepDistance: toNumber(
      source.quickStepDistance,
      fallback.quickStepDistance,
      MIN_BOUNDS.quickStepDistance,
      MAX_BOUNDS.quickStepDistance
    ),
    expressionIntensity: toNumber(
      source.expressionIntensity,
      fallback.expressionIntensity,
      MIN_BOUNDS.expressionIntensity,
      MAX_BOUNDS.expressionIntensity
    ),
    expressionHoldMs: toNumber(
      source.expressionHoldMs,
      fallback.expressionHoldMs,
      MIN_BOUNDS.expressionHoldMs,
      MAX_BOUNDS.expressionHoldMs
    ),
    autoMoveDelayMultiplier: toNumber(
      source.autoMoveDelayMultiplier,
      fallback.autoMoveDelayMultiplier,
      MIN_BOUNDS.autoMoveDelayMultiplier,
      MAX_BOUNDS.autoMoveDelayMultiplier
    ),
    armSwingScale: toNumber(
      source.armSwingScale,
      fallback.armSwingScale,
      MIN_BOUNDS.armSwingScale,
      MAX_BOUNDS.armSwingScale
    ),
    upperBodySwingScale: toNumber(
      source.upperBodySwingScale,
      fallback.upperBodySwingScale,
      MIN_BOUNDS.upperBodySwingScale,
      MAX_BOUNDS.upperBodySwingScale
    ),
    walkCadenceScale: toNumber(
      source.walkCadenceScale,
      fallback.walkCadenceScale,
      MIN_BOUNDS.walkCadenceScale,
      MAX_BOUNDS.walkCadenceScale
    ),
    idleDampingStiffness: toNumber(
      source.idleDampingStiffness,
      fallback.idleDampingStiffness,
      MIN_BOUNDS.idleDampingStiffness,
      MAX_BOUNDS.idleDampingStiffness
    ),
    walkDampingStiffness: toNumber(
      source.walkDampingStiffness,
      fallback.walkDampingStiffness,
      MIN_BOUNDS.walkDampingStiffness,
      MAX_BOUNDS.walkDampingStiffness
    ),
  };
}

function normalizeGlobal(raw: unknown): EmotionTuningGlobal {
  const source = isRecord(raw) ? raw : {};
  return {
    responseClearMs: toNumber(
      source.responseClearMs,
      DEFAULT_GLOBAL.responseClearMs,
      MIN_BOUNDS.responseClearMs,
      MAX_BOUNDS.responseClearMs
    ),
    happyDanceMs: toNumber(
      source.happyDanceMs,
      DEFAULT_GLOBAL.happyDanceMs,
      MIN_BOUNDS.happyDanceMs,
      MAX_BOUNDS.happyDanceMs
    ),
    idleNeutralDelayMs: toNumber(
      source.idleNeutralDelayMs,
      DEFAULT_GLOBAL.idleNeutralDelayMs,
      MIN_BOUNDS.idleNeutralDelayMs,
      MAX_BOUNDS.idleNeutralDelayMs
    ),
  };
}

function normalizeEmotionConfig(raw: unknown): Record<Emotion, EmotionTuningProfile> {
  const source = isRecord(raw) ? raw : {};
  const normalized = {} as Record<Emotion, EmotionTuningProfile>;

  for (const emotion of EMOTIONS) {
    normalized[emotion] = normalizeProfile(source[emotion], DEFAULT_EMOTION_CONFIG[emotion]);
  }

  return normalized;
}

function normalizeConfig(raw: unknown): EmotionTuningConfig {
  const source = isRecord(raw) ? raw : {};
  return {
    meta: isRecord(source.meta) ? source.meta : undefined,
    global: normalizeGlobal(source.global),
    emotions: normalizeEmotionConfig(source.emotions),
  };
}

export const emotionTuningConfig = normalizeConfig(generatedConfig);
export const emotionTuningGlobal = emotionTuningConfig.global;

export function getEmotionTuning(emotion: Emotion): EmotionTuningProfile {
  return emotionTuningConfig.emotions[emotion] ?? DEFAULT_PROFILE;
}
