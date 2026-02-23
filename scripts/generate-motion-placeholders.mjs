import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');

const LEGACY_COUNTS = {
  neutral: 8,
  happy: 10,
  sad: 8,
  angry: 8,
  surprised: 8,
  thinking: 8,
  relaxed: 8,
  bridge: 6,
};

const TARGET_COUNTS = {
  neutral: 12,
  happy: 15,
  sad: 12,
  angry: 12,
  surprised: 12,
  thinking: 12,
  relaxed: 12,
  bridge: 9,
};

const INTENSITY_PATTERNS = {
  neutral: ['low', 'mid', 'low', 'mid', 'low', 'mid', 'high', 'low', 'mid', 'low', 'mid', 'high'],
  happy: ['mid', 'high', 'mid', 'high', 'low', 'mid', 'high', 'mid', 'low', 'high', 'mid', 'high', 'low', 'mid', 'high'],
  sad: ['low', 'low', 'mid', 'low', 'mid', 'low', 'mid', 'high', 'low', 'mid', 'low', 'mid'],
  angry: ['mid', 'high', 'mid', 'high', 'low', 'high', 'mid', 'high', 'mid', 'high', 'low', 'mid'],
  surprised: ['mid', 'high', 'mid', 'high', 'low', 'mid', 'high', 'mid', 'high', 'mid', 'low', 'high'],
  thinking: ['low', 'low', 'mid', 'low', 'mid', 'low', 'mid', 'low', 'mid', 'low', 'mid', 'high'],
  relaxed: ['low', 'mid', 'low', 'mid', 'low', 'mid', 'low', 'high', 'low', 'mid', 'low', 'mid'],
  bridge: ['low', 'mid', 'low', 'mid', 'high', 'mid', 'low', 'mid', 'high'],
};

const BASE_DURATION_MS = {
  neutral: 2050,
  happy: 1700,
  sad: 2450,
  angry: 1650,
  surprised: 1480,
  thinking: 2750,
  relaxed: 2550,
  bridge: 1100,
};

const SOURCE_BY_EMOTION = {
  neutral: 'https://www.mixamo.com',
  happy: 'https://www.mixamo.com',
  sad: 'https://www.rokoko.com/products/vision',
  angry: 'https://www.mixamo.com',
  surprised: 'https://www.mixamo.com',
  thinking: 'https://www.rokoko.com/products/vision',
  relaxed: 'https://www.mixamo.com',
  bridge: 'https://www.mixamo.com',
};

const LICENSE_BY_EMOTION = {
  neutral: 'mixamo-standard',
  happy: 'mixamo-standard',
  sad: 'rokoko-user-generated',
  angry: 'mixamo-standard',
  surprised: 'mixamo-standard',
  thinking: 'rokoko-user-generated',
  relaxed: 'mixamo-standard',
  bridge: 'mixamo-standard',
};

const DEFAULT_REDISTRIBUTION_NOTE =
  'Verify upstream asset terms before redistributing generated deliverables.';

const REDISTRIBUTION_NOTE_BY_LICENSE = {
  'rokoko-user-generated':
    'Captured from user-owned performance. Verify downstream rights before redistribution.',
};

const FALLBACK_GESTURE_BY_EMOTION = {
  neutral: 'nod',
  happy: 'celebrate',
  sad: 'thinking',
  angry: 'shake',
  surprised: 'nod',
  thinking: 'thinking',
  relaxed: 'nod',
  bridge: 'shrug',
};

const BASE_PRIORITY_BY_EMOTION = {
  neutral: 2,
  happy: 4,
  sad: 3,
  angry: 4,
  surprised: 4,
  thinking: 3,
  relaxed: 2,
  bridge: 1,
};

const DEFAULT_PROFILE = {
  tag: 'default',
  frameCount: 9,
  frequency: 1,
  energy: 1,
  useLowerBody: true,
  speakingFriendly: false,
  loopablePreferred: false,
  phase: 0,
  durationBiasMs: 0,
  priorityBoost: 0,
  baseLean: 0,
  leanMotion: 0.08,
  baseTwist: 0,
  twistMotion: 0.08,
  swayMotion: 0.06,
  shoulderMotion: 0.06,
  baseHeadPitch: 0,
  baseHeadYaw: 0,
  baseHeadRoll: 0,
  headNodMotion: 0.08,
  headYawMotion: 0.1,
  headRollMotion: 0.06,
  armLiftBase: -0.05,
  armLiftMotion: 0.45,
  armOpenBase: 1.0,
  armOpenMotion: 0.2,
  elbowBase: 0.12,
  elbowMotion: 0.3,
  elbowTwist: 0.18,
  handFlick: 0.08,
  baseHipPitch: 0,
  hipPitchMotion: 0.06,
  hipYawMotion: 0.08,
  hipRollMotion: 0.05,
  bounce: 0.02,
  stepSide: 0.025,
  stepForward: 0.018,
  legLift: 0.24,
  kneeBend: 0.32,
  footFlex: 0.16,
};

const PROFILES_BY_EMOTION = {
  neutral: [
    {
      tag: 'neutral_weight_shift',
      loopablePreferred: true,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 1,
      energy: 0.72,
      stepSide: 0.022,
      stepForward: 0.012,
      baseLean: 0.01,
      armLiftMotion: 0.24,
      armOpenMotion: 0.12,
      legLift: 0.14,
      kneeBend: 0.18,
      durationBiasMs: 140,
    },
    {
      tag: 'neutral_attentive_nod',
      loopablePreferred: true,
      speakingFriendly: true,
      useLowerBody: false,
      frequency: 1,
      energy: 0.68,
      baseHeadPitch: -0.01,
      headNodMotion: 0.1,
      headYawMotion: 0.08,
      armLiftMotion: 0.18,
      armOpenMotion: 0.1,
      bounce: 0.01,
      durationBiasMs: 110,
    },
    {
      tag: 'neutral_open_posture',
      loopablePreferred: true,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 2,
      energy: 0.76,
      baseTwist: 0.02,
      twistMotion: 0.1,
      armLiftMotion: 0.26,
      armOpenMotion: 0.16,
      legLift: 0.18,
      kneeBend: 0.24,
      stepSide: 0.03,
      durationBiasMs: 60,
    },
    {
      tag: 'neutral_ready_shift',
      loopablePreferred: false,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 2,
      energy: 0.82,
      baseLean: -0.02,
      leanMotion: 0.1,
      armLiftMotion: 0.3,
      armOpenMotion: 0.18,
      legLift: 0.22,
      kneeBend: 0.26,
      stepForward: 0.024,
      durationBiasMs: -80,
      priorityBoost: 1,
    },
  ],
  happy: [
    {
      tag: 'happy_bounce_step',
      loopablePreferred: false,
      speakingFriendly: false,
      useLowerBody: true,
      frequency: 2,
      energy: 1.15,
      baseLean: -0.06,
      leanMotion: 0.14,
      armLiftBase: -0.12,
      armLiftMotion: 0.72,
      armOpenMotion: 0.36,
      elbowMotion: 0.46,
      bounce: 0.045,
      stepSide: 0.048,
      stepForward: 0.03,
      legLift: 0.34,
      kneeBend: 0.42,
      footFlex: 0.25,
      durationBiasMs: -180,
      priorityBoost: 1,
    },
    {
      tag: 'happy_open_arms',
      loopablePreferred: false,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 2,
      energy: 1.05,
      baseLean: -0.04,
      armLiftBase: -0.15,
      armLiftMotion: 0.66,
      armOpenMotion: 0.44,
      elbowMotion: 0.38,
      headYawMotion: 0.12,
      stepSide: 0.036,
      legLift: 0.26,
      kneeBend: 0.34,
      durationBiasMs: -120,
      priorityBoost: 1,
    },
    {
      tag: 'happy_quick_shuffle',
      loopablePreferred: false,
      speakingFriendly: false,
      useLowerBody: true,
      frameCount: 11,
      frequency: 3,
      energy: 1.2,
      baseLean: -0.07,
      armLiftMotion: 0.58,
      armOpenMotion: 0.28,
      elbowMotion: 0.42,
      bounce: 0.052,
      stepSide: 0.058,
      stepForward: 0.04,
      legLift: 0.38,
      kneeBend: 0.46,
      footFlex: 0.3,
      durationBiasMs: -220,
      priorityBoost: 2,
    },
    {
      tag: 'happy_talk_beats',
      loopablePreferred: false,
      speakingFriendly: true,
      useLowerBody: false,
      frequency: 2,
      energy: 0.95,
      baseLean: -0.03,
      armLiftMotion: 0.5,
      armOpenMotion: 0.32,
      elbowMotion: 0.36,
      handFlick: 0.16,
      headNodMotion: 0.12,
      durationBiasMs: -60,
    },
    {
      tag: 'happy_side_sway',
      loopablePreferred: false,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 2,
      energy: 1.0,
      baseTwist: 0.03,
      twistMotion: 0.14,
      swayMotion: 0.12,
      armLiftMotion: 0.54,
      armOpenMotion: 0.34,
      stepSide: 0.052,
      legLift: 0.3,
      kneeBend: 0.36,
      durationBiasMs: -90,
      priorityBoost: 1,
    },
  ],
  sad: [
    {
      tag: 'sad_slumped_shift',
      loopablePreferred: true,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 1,
      energy: 0.82,
      baseLean: 0.12,
      leanMotion: 0.06,
      baseHeadPitch: 0.15,
      headNodMotion: 0.05,
      armLiftBase: 0.04,
      armLiftMotion: 0.16,
      armOpenBase: 0.92,
      armOpenMotion: 0.1,
      stepSide: 0.018,
      stepForward: -0.01,
      legLift: 0.1,
      kneeBend: 0.18,
      durationBiasMs: 180,
    },
    {
      tag: 'sad_self_hold',
      loopablePreferred: true,
      speakingFriendly: true,
      useLowerBody: false,
      frequency: 1,
      energy: 0.74,
      baseLean: 0.14,
      baseHeadPitch: 0.18,
      armLiftBase: 0.12,
      armLiftMotion: 0.14,
      armOpenBase: 0.8,
      armOpenMotion: 0.08,
      elbowBase: 0.2,
      elbowMotion: 0.2,
      durationBiasMs: 220,
    },
    {
      tag: 'sad_slow_step_back',
      loopablePreferred: false,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 1,
      energy: 0.88,
      baseLean: 0.1,
      baseHeadPitch: 0.16,
      armLiftMotion: 0.2,
      armOpenMotion: 0.12,
      stepSide: 0.024,
      stepForward: -0.028,
      legLift: 0.18,
      kneeBend: 0.26,
      footFlex: 0.2,
      durationBiasMs: 120,
      priorityBoost: 1,
    },
    {
      tag: 'sad_head_drop_recover',
      loopablePreferred: false,
      speakingFriendly: false,
      useLowerBody: true,
      frequency: 2,
      energy: 0.96,
      baseLean: 0.16,
      leanMotion: 0.1,
      baseHeadPitch: 0.2,
      headNodMotion: 0.16,
      armLiftMotion: 0.22,
      armOpenMotion: 0.1,
      stepSide: 0.02,
      stepForward: -0.014,
      legLift: 0.16,
      kneeBend: 0.24,
      durationBiasMs: 40,
      priorityBoost: 1,
    },
  ],
  angry: [
    {
      tag: 'angry_forward_press',
      loopablePreferred: false,
      speakingFriendly: false,
      useLowerBody: true,
      frequency: 2,
      energy: 1.1,
      baseLean: -0.1,
      leanMotion: 0.12,
      baseTwist: 0.06,
      twistMotion: 0.18,
      armLiftBase: -0.16,
      armLiftMotion: 0.58,
      armOpenBase: 0.9,
      armOpenMotion: 0.16,
      elbowMotion: 0.5,
      stepForward: 0.03,
      stepSide: 0.036,
      legLift: 0.28,
      kneeBend: 0.38,
      durationBiasMs: -130,
      priorityBoost: 2,
    },
    {
      tag: 'angry_point_stance',
      loopablePreferred: false,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 2,
      energy: 1.02,
      baseLean: -0.08,
      baseTwist: 0.08,
      armLiftBase: -0.22,
      armLiftMotion: 0.52,
      armOpenBase: 0.82,
      armOpenMotion: 0.14,
      elbowMotion: 0.56,
      handFlick: 0.2,
      stepForward: 0.022,
      legLift: 0.24,
      kneeBend: 0.34,
      durationBiasMs: -90,
      priorityBoost: 1,
    },
    {
      tag: 'angry_stomp',
      loopablePreferred: false,
      speakingFriendly: false,
      useLowerBody: true,
      frameCount: 11,
      frequency: 3,
      energy: 1.22,
      baseLean: -0.12,
      twistMotion: 0.2,
      armLiftMotion: 0.46,
      armOpenMotion: 0.12,
      elbowMotion: 0.62,
      bounce: 0.055,
      stepSide: 0.05,
      stepForward: 0.026,
      legLift: 0.4,
      kneeBend: 0.5,
      footFlex: 0.3,
      durationBiasMs: -200,
      priorityBoost: 2,
    },
    {
      tag: 'angry_controlled_breath',
      loopablePreferred: true,
      speakingFriendly: true,
      useLowerBody: false,
      frequency: 1,
      energy: 0.86,
      baseLean: -0.06,
      baseTwist: 0.04,
      armLiftMotion: 0.24,
      armOpenBase: 0.88,
      armOpenMotion: 0.1,
      elbowMotion: 0.3,
      durationBiasMs: 40,
    },
  ],
  surprised: [
    {
      tag: 'surprised_recoil_step',
      loopablePreferred: false,
      speakingFriendly: false,
      useLowerBody: true,
      frequency: 2,
      energy: 1.14,
      baseLean: -0.14,
      leanMotion: 0.18,
      baseHeadPitch: -0.08,
      headNodMotion: 0.18,
      armLiftBase: -0.24,
      armLiftMotion: 0.72,
      armOpenMotion: 0.42,
      elbowMotion: 0.5,
      stepForward: -0.035,
      stepSide: 0.04,
      legLift: 0.34,
      kneeBend: 0.4,
      durationBiasMs: -190,
      priorityBoost: 2,
    },
    {
      tag: 'surprised_hands_up',
      loopablePreferred: false,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 2,
      energy: 1.08,
      baseLean: -0.1,
      baseHeadPitch: -0.06,
      armLiftBase: -0.28,
      armLiftMotion: 0.78,
      armOpenMotion: 0.48,
      elbowMotion: 0.45,
      stepSide: 0.03,
      legLift: 0.24,
      kneeBend: 0.3,
      durationBiasMs: -150,
      priorityBoost: 1,
    },
    {
      tag: 'surprised_quick_pivot',
      loopablePreferred: false,
      speakingFriendly: false,
      useLowerBody: true,
      frameCount: 11,
      frequency: 3,
      energy: 1.2,
      baseLean: -0.12,
      twistMotion: 0.24,
      armLiftMotion: 0.66,
      armOpenMotion: 0.34,
      elbowMotion: 0.52,
      stepSide: 0.056,
      stepForward: 0.03,
      legLift: 0.36,
      kneeBend: 0.44,
      footFlex: 0.28,
      durationBiasMs: -220,
      priorityBoost: 2,
    },
    {
      tag: 'surprised_settle',
      loopablePreferred: false,
      speakingFriendly: true,
      useLowerBody: false,
      frequency: 2,
      energy: 0.9,
      baseLean: -0.06,
      baseHeadPitch: -0.04,
      armLiftMotion: 0.42,
      armOpenMotion: 0.24,
      elbowMotion: 0.32,
      durationBiasMs: -40,
    },
  ],
  thinking: [
    {
      tag: 'thinking_chin_touch',
      loopablePreferred: true,
      speakingFriendly: true,
      useLowerBody: false,
      frequency: 1,
      energy: 0.82,
      baseHeadPitch: 0.06,
      baseHeadYaw: 0.08,
      baseHeadRoll: 0.06,
      armLiftBase: -0.16,
      armLiftMotion: 0.3,
      armOpenBase: 0.86,
      armOpenMotion: 0.12,
      elbowBase: 0.28,
      elbowMotion: 0.34,
      elbowTwist: 0.28,
      handFlick: 0.14,
      durationBiasMs: 160,
    },
    {
      tag: 'thinking_pacing_shift',
      loopablePreferred: false,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 1,
      energy: 0.9,
      baseLean: 0.02,
      baseHeadYaw: 0.1,
      armLiftMotion: 0.28,
      armOpenMotion: 0.14,
      elbowMotion: 0.3,
      stepSide: 0.03,
      stepForward: 0.022,
      legLift: 0.2,
      kneeBend: 0.24,
      durationBiasMs: 80,
      priorityBoost: 1,
    },
    {
      tag: 'thinking_micro_gesture',
      loopablePreferred: true,
      speakingFriendly: true,
      useLowerBody: false,
      frequency: 2,
      energy: 0.76,
      baseHeadPitch: 0.04,
      baseHeadYaw: 0.12,
      baseHeadRoll: 0.05,
      armLiftMotion: 0.24,
      armOpenMotion: 0.12,
      elbowMotion: 0.28,
      handFlick: 0.18,
      durationBiasMs: 120,
    },
    {
      tag: 'thinking_decision_step',
      loopablePreferred: false,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 2,
      energy: 0.96,
      baseLean: -0.02,
      baseHeadYaw: 0.14,
      armLiftMotion: 0.34,
      armOpenMotion: 0.2,
      elbowMotion: 0.36,
      stepSide: 0.04,
      stepForward: 0.026,
      legLift: 0.26,
      kneeBend: 0.32,
      durationBiasMs: -20,
      priorityBoost: 1,
    },
  ],
  relaxed: [
    {
      tag: 'relaxed_breath',
      loopablePreferred: true,
      speakingFriendly: true,
      useLowerBody: false,
      frequency: 1,
      energy: 0.68,
      baseLean: 0.01,
      baseHeadRoll: 0.03,
      armLiftMotion: 0.18,
      armOpenMotion: 0.14,
      elbowMotion: 0.22,
      bounce: 0.01,
      durationBiasMs: 180,
    },
    {
      tag: 'relaxed_sway',
      loopablePreferred: true,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 1,
      energy: 0.74,
      baseTwist: 0.02,
      twistMotion: 0.08,
      swayMotion: 0.09,
      armLiftMotion: 0.22,
      armOpenMotion: 0.16,
      stepSide: 0.024,
      legLift: 0.14,
      kneeBend: 0.2,
      durationBiasMs: 140,
    },
    {
      tag: 'relaxed_stretch',
      loopablePreferred: false,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 1,
      energy: 0.82,
      baseLean: -0.02,
      baseHeadPitch: -0.01,
      armLiftBase: -0.14,
      armLiftMotion: 0.34,
      armOpenMotion: 0.24,
      elbowMotion: 0.28,
      stepForward: 0.018,
      legLift: 0.18,
      kneeBend: 0.24,
      durationBiasMs: 80,
      priorityBoost: 1,
    },
    {
      tag: 'relaxed_grounded_shift',
      loopablePreferred: true,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 2,
      energy: 0.78,
      baseLean: 0.02,
      twistMotion: 0.1,
      armLiftMotion: 0.24,
      armOpenMotion: 0.16,
      stepSide: 0.03,
      legLift: 0.18,
      kneeBend: 0.22,
      durationBiasMs: 40,
    },
  ],
  bridge: [
    {
      tag: 'bridge_settle_in',
      loopablePreferred: false,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 1,
      energy: 0.64,
      baseLean: 0,
      armLiftMotion: 0.18,
      armOpenMotion: 0.1,
      stepSide: 0.018,
      stepForward: 0.014,
      legLift: 0.12,
      kneeBend: 0.16,
      durationBiasMs: 40,
    },
    {
      tag: 'bridge_turn_reset',
      loopablePreferred: false,
      speakingFriendly: true,
      useLowerBody: true,
      frequency: 2,
      energy: 0.72,
      baseTwist: 0.04,
      twistMotion: 0.12,
      armLiftMotion: 0.22,
      armOpenMotion: 0.12,
      stepSide: 0.024,
      stepForward: 0.02,
      legLift: 0.14,
      kneeBend: 0.2,
      durationBiasMs: -40,
      priorityBoost: 1,
    },
    {
      tag: 'bridge_release',
      loopablePreferred: false,
      speakingFriendly: true,
      useLowerBody: false,
      frequency: 1,
      energy: 0.58,
      baseLean: 0,
      armLiftMotion: 0.14,
      armOpenMotion: 0.08,
      durationBiasMs: 30,
    },
  ],
};

const LOOPABLE_EMOTIONS = new Set(['neutral', 'sad', 'thinking', 'relaxed']);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function toTime(index, total) {
  if (total <= 1) return 0;
  return round3(index / (total - 1));
}

function normalizeIntensityScale(emotion, intensity) {
  const base = intensity === 'high' ? 1.24 : intensity === 'mid' ? 1 : 0.72;
  if (emotion === 'thinking' || emotion === 'relaxed' || emotion === 'sad') {
    return intensity === 'high' ? base * 0.88 : base;
  }
  return base;
}

function inferIntensity(emotion, index) {
  const pattern = INTENSITY_PATTERNS[emotion] || ['mid'];
  return pattern[index % pattern.length] || 'mid';
}

function inferLoopable(emotion, intensity, profile) {
  const profilePref = typeof profile.loopablePreferred === 'boolean'
    ? profile.loopablePreferred
    : LOOPABLE_EMOTIONS.has(emotion);
  if (!profilePref) return false;
  return intensity !== 'high';
}

function inferSpeakingCompatible(emotion, intensity, profile, loopable) {
  if (profile.speakingFriendly && intensity !== 'high') return true;
  if (loopable) return intensity !== 'high';

  const dynamicEmotion = emotion === 'happy' || emotion === 'angry' || emotion === 'surprised';
  if (dynamicEmotion && profile.useLowerBody && intensity === 'high') {
    return false;
  }

  return intensity !== 'high';
}

function inferDuration(emotion, intensity, index, profile) {
  const base = BASE_DURATION_MS[emotion] ?? 1800;
  const intensityOffset = intensity === 'high' ? -210 : intensity === 'low' ? 220 : 0;
  const cadenceOffset = (profile.frequency - 1) * -80;
  const patternOffset = ((index % 4) - 1.5) * 70;
  const profileOffset = profile.durationBiasMs ?? 0;

  return clamp(
    Math.round(base + intensityOffset + cadenceOffset + patternOffset + profileOffset),
    780,
    4600
  );
}

function inferPriority(emotion, intensity, profile) {
  const base = BASE_PRIORITY_BY_EMOTION[emotion] ?? 2;
  const intensityBoost = intensity === 'high' ? 1 : intensity === 'mid' ? 0.5 : 0;
  const profileBoost = profile.priorityBoost ?? 0;
  return clamp(Math.round(base + intensityBoost + profileBoost), 1, 8);
}

function inferCooldownMs(intensity, index, profile) {
  const base = intensity === 'high' ? 1900 : intensity === 'mid' ? 1550 : 1250;
  const profileBias = profile.useLowerBody ? 220 : 0;
  const stagger = (index % 4) * 280;
  return Math.round(base + profileBias + stagger);
}

function capRotation(value) {
  return round3(clamp(value, -2.6, 2.6));
}

function capPosition(value) {
  return round3(clamp(value, -0.22, 0.22));
}

function composeProfile(profile) {
  return {
    ...DEFAULT_PROFILE,
    ...profile,
  };
}

function buildKeyframes({ emotion, intensity, clipIndex, profile, loopable }) {
  const merged = composeProfile(profile);
  const frameCount = clamp(merged.frameCount, 7, 13);
  const phaseSeed = (clipIndex % 7) * 0.33 + merged.phase;
  const side = clipIndex % 2 === 0 ? 1 : -1;
  const asymmetry = ((clipIndex % 5) - 2) * 0.014;
  const intensityScale = normalizeIntensityScale(emotion, intensity);
  const energy = merged.energy * intensityScale;

  const keyframes = [];

  function addFrame(bone, time, rotation, position) {
    keyframes.push({
      bone,
      time,
      rotation: {
        x: capRotation(rotation.x),
        y: capRotation(rotation.y),
        z: capRotation(rotation.z),
      },
      ...(position
        ? {
          position: {
            x: capPosition(position.x),
            y: capPosition(position.y),
            z: capPosition(position.z),
          },
        }
        : {}),
    });
  }

  for (let i = 0; i < frameCount; i += 1) {
    const time = toTime(i, frameCount);
    const envelope = loopable ? 1 : Math.sin(Math.PI * time);

    const phase = Math.PI * 2 * merged.frequency * time + phaseSeed;
    const primary = Math.sin(phase);
    const secondary = Math.sin(phase * 0.5 + side * 0.45);
    const tertiary = Math.cos(phase * 1.35 + 0.15);
    const burst = Math.max(0, Math.sin(phase + Math.PI / 7));

    const motion = energy * envelope;

    const hipsRotation = {
      x: merged.baseHipPitch + merged.hipPitchMotion * motion * primary,
      y: merged.hipYawMotion * motion * secondary * side,
      z: merged.hipRollMotion * motion * tertiary * side,
    };

    const hipsPositionScale = merged.useLowerBody ? 1 : 0.35;
    const hipsPosition = {
      x: hipsPositionScale * merged.stepSide * motion * primary * side,
      y: hipsPositionScale * merged.bounce * motion * burst,
      z: hipsPositionScale * merged.stepForward * motion * secondary,
    };

    const spineRotation = {
      x: merged.baseLean + merged.leanMotion * motion * primary,
      y: merged.baseTwist * side + merged.twistMotion * motion * secondary * side,
      z: merged.swayMotion * motion * tertiary * side,
    };

    const chestRotation = {
      x: spineRotation.x * 1.12,
      y: spineRotation.y * 1.08,
      z: spineRotation.z * 1.1,
    };

    const headRotation = {
      x: merged.baseHeadPitch + merged.headNodMotion * motion * (0.65 * primary + 0.35 * burst),
      y: merged.baseHeadYaw * side + merged.headYawMotion * motion * secondary * side,
      z: merged.baseHeadRoll * side + merged.headRollMotion * motion * tertiary * side,
    };

    const shoulderSwing = merged.shoulderMotion * motion * burst;

    const leftUpperArm = {
      x: merged.armLiftBase + merged.armLiftMotion * motion * (0.55 + 0.45 * primary),
      y: 0.03 * asymmetry,
      z: merged.armOpenBase + merged.armOpenMotion * motion * (0.5 * secondary + 0.5 * tertiary),
    };

    const rightUpperArm = {
      x: merged.armLiftBase + merged.armLiftMotion * motion * (0.55 + 0.45 * Math.sin(phase + Math.PI)),
      y: -0.03 * asymmetry,
      z: -(merged.armOpenBase + merged.armOpenMotion * motion * (0.5 * secondary + 0.5 * Math.cos(phase * 1.2))),
    };

    const leftLowerArm = {
      x: merged.elbowBase + merged.elbowMotion * motion * (0.3 + 0.7 * burst),
      y: -merged.elbowTwist * motion * tertiary * side,
      z: 0.03 * secondary,
    };

    const rightLowerArm = {
      x: merged.elbowBase + merged.elbowMotion * motion * (0.3 + 0.7 * Math.max(0, Math.sin(phase + Math.PI / 2))),
      y: merged.elbowTwist * motion * tertiary * side,
      z: -0.03 * secondary,
    };

    const leftHand = {
      x: 0,
      y: merged.handFlick * motion * secondary,
      z: merged.handFlick * motion * tertiary,
    };

    const rightHand = {
      x: 0,
      y: -merged.handFlick * motion * secondary,
      z: -merged.handFlick * motion * tertiary,
    };

    const gaitLeft = Math.max(0, Math.sin(phase));
    const gaitRight = Math.max(0, Math.sin(phase + Math.PI));

    const leftUpperLeg = {
      x: merged.useLowerBody ? merged.legLift * motion * gaitLeft : 0,
      y: merged.useLowerBody ? 0.1 * motion * secondary : 0,
      z: merged.useLowerBody ? 0.06 * motion * tertiary : 0,
    };

    const rightUpperLeg = {
      x: merged.useLowerBody ? merged.legLift * motion * gaitRight : 0,
      y: merged.useLowerBody ? -0.1 * motion * secondary : 0,
      z: merged.useLowerBody ? -0.06 * motion * tertiary : 0,
    };

    const leftLowerLeg = {
      x: merged.useLowerBody ? -merged.kneeBend * motion * gaitLeft : 0,
      y: 0,
      z: 0,
    };

    const rightLowerLeg = {
      x: merged.useLowerBody ? -merged.kneeBend * motion * gaitRight : 0,
      y: 0,
      z: 0,
    };

    const leftFoot = {
      x: merged.useLowerBody ? merged.footFlex * motion * Math.max(0, -secondary) : 0,
      y: 0,
      z: 0,
    };

    const rightFoot = {
      x: merged.useLowerBody ? merged.footFlex * motion * Math.max(0, secondary) : 0,
      y: 0,
      z: 0,
    };

    addFrame('hips', time, hipsRotation, hipsPosition);
    addFrame('spine', time, spineRotation);
    addFrame('chest', time, chestRotation);
    addFrame('head', time, headRotation);

    addFrame('leftShoulder', time, { x: shoulderSwing, y: 0, z: -shoulderSwing * 0.8 });
    addFrame('rightShoulder', time, { x: shoulderSwing, y: 0, z: shoulderSwing * 0.8 });

    addFrame('leftUpperArm', time, leftUpperArm);
    addFrame('rightUpperArm', time, rightUpperArm);
    addFrame('leftLowerArm', time, leftLowerArm);
    addFrame('rightLowerArm', time, rightLowerArm);
    addFrame('leftHand', time, leftHand);
    addFrame('rightHand', time, rightHand);

    if (merged.useLowerBody) {
      addFrame('leftUpperLeg', time, leftUpperLeg);
      addFrame('rightUpperLeg', time, rightUpperLeg);
      addFrame('leftLowerLeg', time, leftLowerLeg);
      addFrame('rightLowerLeg', time, rightLowerLeg);
      addFrame('leftFoot', time, leftFoot);
      addFrame('rightFoot', time, rightFoot);
    }
  }

  return keyframes;
}

async function clearMotionJsonFiles(directory) {
  await mkdir(directory, { recursive: true });
  const entries = await readdir(directory, { withFileTypes: true });
  const removals = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (/^motion_.*\.json$/i.test(entry.name) || /^\._motion_.*\.json$/i.test(entry.name)) {
      removals.push(rm(resolve(directory, entry.name), { force: true }));
    }
  }

  await Promise.all(removals);
}

async function main() {
  const cleanClipsDir = resolve(rootDir, 'motions/clean/clips');
  const reportsDir = resolve(rootDir, 'motions/reports');
  const cleanCatalogPath = resolve(rootDir, 'motions/clean/catalog.json');
  const generatedCatalogPath = resolve(rootDir, 'motions/clean/catalog.generated.json');

  await mkdir(cleanClipsDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await clearMotionJsonFiles(cleanClipsDir);

  const catalogClips = [];
  const newSlots = [];

  for (const [emotion, count] of Object.entries(TARGET_COUNTS)) {
    const profiles = PROFILES_BY_EMOTION[emotion] || [DEFAULT_PROFILE];

    for (let index = 0; index < count; index += 1) {
      const id = `motion_${emotion}_${String(index + 1).padStart(2, '0')}`;
      const intensity = inferIntensity(emotion, index);
      const profile = composeProfile(profiles[index % profiles.length]);
      const loopable = inferLoopable(emotion, intensity, profile);
      const speakingCompatible = inferSpeakingCompatible(emotion, intensity, profile, loopable);
      const durationMs = inferDuration(emotion, intensity, index, profile);
      const priority = inferPriority(emotion, intensity, profile);
      const cooldownMs = inferCooldownMs(intensity, index, profile);

      const clipData = {
        version: 1,
        fps: 30,
        duration_ms: durationMs,
        blend_in_ms: clamp(Math.round(durationMs * 0.11), 120, 320),
        blend_out_ms: clamp(Math.round(durationMs * 0.14), 140, 360),
        keyframes: buildKeyframes({
          emotion,
          intensity,
          clipIndex: index,
          profile,
          loopable,
        }),
      };

      const sourceFile = `motions/clean/clips/${id}.json`;
      const clipPath = resolve(rootDir, sourceFile);
      const licenseClass = LICENSE_BY_EMOTION[emotion];

      await writeFile(clipPath, `${JSON.stringify(clipData, null, 2)}\n`, 'utf8');

      const catalogEntry = {
        id,
        source_file: sourceFile,
        emotion_tags: [emotion],
        intensity,
        duration_ms: durationMs,
        loopable,
        speaking_compatible: speakingCompatible,
        priority,
        cooldown_ms: cooldownMs,
        source_url: SOURCE_BY_EMOTION[emotion],
        license_class: licenseClass,
        attribution_required: false,
        redistribution_note: REDISTRIBUTION_NOTE_BY_LICENSE[licenseClass] ?? DEFAULT_REDISTRIBUTION_NOTE,
        fallback_gesture: FALLBACK_GESTURE_BY_EMOTION[emotion],
        variation_tag: profile.tag,
        slot_group: index < (LEGACY_COUNTS[emotion] ?? 0) ? 'core_v1' : 'expansion_v2',
        body_zone: profile.useLowerBody ? 'full' : 'upper',
      };

      catalogClips.push(catalogEntry);

      if (index >= (LEGACY_COUNTS[emotion] ?? 0)) {
        newSlots.push({
          id,
          emotion_tags: [emotion],
          intensity,
          priority,
          variation_tag: profile.tag,
          body_zone: profile.useLowerBody ? 'full' : 'upper',
          speaking_compatible: speakingCompatible,
          loopable,
        });
      }
    }
  }

  const catalog = {
    version: 1,
    fps: 30,
    default_source_url: 'https://www.mixamo.com',
    default_license_class: 'mixamo-standard',
    default_attribution_required: false,
    default_redistribution_note: DEFAULT_REDISTRIBUTION_NOTE,
    clips: catalogClips,
  };

  await writeFile(cleanCatalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  await writeFile(generatedCatalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

  const slotReportPath = resolve(reportsDir, 'new-motion-slots-latest.json');
  const slotTextPath = resolve(reportsDir, 'new-motion-slots-latest.txt');

  await writeFile(
    slotReportPath,
    `${JSON.stringify({
      generated_at: new Date().toISOString(),
      total_slots: catalogClips.length,
      new_slots_count: newSlots.length,
      new_slots: newSlots,
    }, null, 2)}\n`,
    'utf8'
  );

  const slotLines = newSlots.map((slot, idx) => {
    return `${idx + 1}. ${slot.id} | tags=${slot.emotion_tags.join(',')} | intensity=${slot.intensity} | priority=${slot.priority} | variation=${slot.variation_tag} | body=${slot.body_zone}`;
  });

  await writeFile(
    slotTextPath,
    `${slotLines.join('\n')}\n`,
    'utf8'
  );

  console.log(`[motion-generate] Generated ${catalogClips.length} clips (${newSlots.length} new slots)`);
  console.log(`[motion-generate] clips dir: ${cleanClipsDir}`);
  console.log(`[motion-generate] catalog: ${cleanCatalogPath}`);
  console.log(`[motion-generate] new slot report: ${slotReportPath}`);
}

main().catch((error) => {
  console.error(`[motion-generate] Failed: ${error.message}`);
  process.exit(1);
});
