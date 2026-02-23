import type { Emotion } from '../../stores/avatarStore';
import type {
  MotionClipMeta,
  MotionIntensity,
  MotionSelectorInput,
  MotionSelectorResult,
} from '../../types/motion';
import { getMotionManifest } from './motionLibrary';

interface WeightedCandidate {
  clip: MotionClipMeta;
  weight: number;
}

const INTENSITY_PREFERENCES: Record<Emotion, Record<MotionIntensity, number>> = {
  neutral: { low: 1.25, mid: 1.0, high: 0.72 },
  happy: { low: 0.8, mid: 1.2, high: 1.3 },
  sad: { low: 1.3, mid: 1.0, high: 0.65 },
  angry: { low: 0.7, mid: 1.25, high: 1.35 },
  surprised: { low: 0.72, mid: 1.25, high: 1.3 },
  relaxed: { low: 1.35, mid: 0.95, high: 0.55 },
  thinking: { low: 1.4, mid: 0.9, high: 0.5 },
};

function chooseWeighted(
  candidates: WeightedCandidate[],
  rng: () => number
): MotionClipMeta | null {
  if (candidates.length === 0) return null;

  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (total <= 0) {
    return candidates[Math.floor(rng() * candidates.length)]?.clip ?? null;
  }

  let threshold = rng() * total;
  for (const candidate of candidates) {
    threshold -= candidate.weight;
    if (threshold <= 0) return candidate.clip;
  }

  return candidates[candidates.length - 1]?.clip ?? null;
}

function isRecentClip(id: string, recent: string[], windowSize = 3): boolean {
  return recent.slice(0, windowSize).includes(id);
}

function getIntensityWeight(
  emotion: Emotion,
  intensity: MotionIntensity,
  isSpeaking: boolean,
  emotionScore: number,
  dynamicBoost: number
): number {
  const preference = INTENSITY_PREFERENCES[emotion]?.[intensity] ?? 1;
  const normalizedBoost = Math.max(0, Math.min(1.5, dynamicBoost));
  const isDynamicEmotion =
    emotion === 'happy' || emotion === 'angry' || emotion === 'surprised';
  const isCalmEmotion =
    emotion === 'neutral' || emotion === 'sad' || emotion === 'thinking' || emotion === 'relaxed';
  let dynamicBias = 1;

  if (normalizedBoost > 0) {
    if (isDynamicEmotion) {
      if (intensity === 'high') dynamicBias = 1 + normalizedBoost * 0.95;
      else if (intensity === 'mid') dynamicBias = 1 + normalizedBoost * 0.45;
      else dynamicBias = Math.max(0.55, 1 - normalizedBoost * 0.42);
    } else if (isCalmEmotion) {
      if (intensity === 'high') dynamicBias = Math.max(0.4, 1 - normalizedBoost * 0.65);
      else if (intensity === 'low') dynamicBias = 1 + normalizedBoost * 0.18;
    }
  }

  const confidenceBoost = Math.min(1.8, 1 + Math.max(0, emotionScore - 1) * 0.12);
  const weighted = preference * dynamicBias * confidenceBoost;

  if (!isSpeaking) {
    return weighted;
  }

  if (intensity === 'high') {
    return weighted * 0.55;
  }

  return weighted * 1.12;
}

function getCandidateWeight(
  clip: MotionClipMeta,
  input: MotionSelectorInput,
  penalizeRecent: boolean
): number {
  const basePriority = Math.max(0.2, clip.priority);
  const intensityWeight = getIntensityWeight(
    input.emotion,
    clip.intensity,
    input.isSpeaking,
    input.emotionScore,
    input.dynamicBoost ?? 0
  );

  const emotionMatchBoost = clip.emotion_tags.includes(input.emotion)
    ? 1.45
    : clip.emotion_tags.includes('bridge')
      ? 0.8
      : 1;

  const recentPenalty = penalizeRecent && isRecentClip(clip.id, input.recentMotionIds)
    ? Math.max(0.15, 1 - Math.min(1, input.diversityStrength))
    : 1;

  return basePriority * intensityWeight * emotionMatchBoost * recentPenalty;
}

function buildCandidates(
  input: MotionSelectorInput,
  source: MotionClipMeta[]
): MotionClipMeta[] {
  const baseCandidates = source.filter((clip) => {
    const emotionMatched =
      clip.emotion_tags.includes(input.emotion) || clip.emotion_tags.includes('bridge');
    if (!emotionMatched) return false;

    if (input.isSpeaking && !clip.speaking_compatible) return false;
    if (input.isMoving && clip.loopable) return false;

    const cooldownUntil = input.cooldownMap[clip.id] ?? 0;
    if (cooldownUntil > input.now) return false;

    return true;
  });

  if (baseCandidates.length === 0) return [];

  const withoutRecent = baseCandidates.filter(
    (clip) => !isRecentClip(clip.id, input.recentMotionIds)
  );

  return withoutRecent.length > 0 ? withoutRecent : baseCandidates;
}

export function selectMotionClip(
  input: MotionSelectorInput,
  source: MotionClipMeta[] = getMotionManifest(),
  rng: () => number = Math.random
): MotionSelectorResult {
  const candidates = buildCandidates(input, source);
  if (candidates.length === 0) {
    return {
      selected: null,
      candidates: [],
      reason: 'no-matching-candidates',
    };
  }

  const weighted = candidates.map((clip) => ({
    clip,
    weight: getCandidateWeight(clip, input, true),
  }));

  const selected = chooseWeighted(weighted, rng);
  if (!selected) {
    return {
      selected: null,
      candidates,
      reason: 'selection-failed',
    };
  }

  return {
    selected,
    candidates,
    reason: 'ok',
  };
}
