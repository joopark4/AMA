/**
 * VAD (Valence-Arousal-Dominance) 연속 감정 모델
 *
 * 8종 이산 감정(Emotion)을 3차원 잠재 공간에 매핑해, 감정 전이를 lerp로 부드럽게 보간한다.
 * 렌더링/프롬프트 시에만 가장 가까운 이산 라벨로 역매핑한다.
 *
 * - V (Valence): 긍정 ↔ 부정 (-1 부정, +1 긍정)
 * - A (Arousal): 각성도/에너지 (-1 차분, +1 흥분)
 * - D (Dominance): 주도성/통제감 (-1 수동, +1 주도)
 */
import type { Emotion } from '../../stores/avatarStore';

export interface MoodVec {
  v: number;
  a: number;
  d: number;
}

/**
 * Emotion → VAD 좌표 매핑.
 *
 * 값 기반 문헌(Russell's circumplex, Mehrabian PAD)의 일반적 영역을 참조.
 */
export const VAD_CATALOG: Record<Emotion, MoodVec> = {
  neutral: { v: 0.0, a: 0.0, d: 0.0 },
  happy: { v: 0.7, a: 0.5, d: 0.3 },
  sad: { v: -0.6, a: -0.3, d: -0.2 },
  angry: { v: -0.4, a: 0.6, d: 0.5 },
  surprised: { v: 0.2, a: 0.8, d: -0.1 },
  relaxed: { v: 0.5, a: -0.4, d: 0.2 },
  thinking: { v: 0.0, a: -0.1, d: 0.1 },
};

const EMOTION_LABELS: Emotion[] = Object.keys(VAD_CATALOG) as Emotion[];

/** 감정 라벨을 VAD 벡터로 변환. */
export function emotionToVec(emotion: Emotion): MoodVec {
  return { ...VAD_CATALOG[emotion] };
}

/** 두 벡터 간 유클리드 거리. */
function distance(a: MoodVec, b: MoodVec): number {
  const dv = a.v - b.v;
  const da = a.a - b.a;
  const dd = a.d - b.d;
  return Math.sqrt(dv * dv + da * da + dd * dd);
}

/** VAD 벡터에 가장 가까운 이산 감정 라벨을 찾는다. */
export function nearestEmotion(vec: MoodVec): Emotion {
  let best: Emotion = 'neutral';
  let bestDist = Infinity;
  for (const label of EMOTION_LABELS) {
    const d = distance(vec, VAD_CATALOG[label]);
    if (d < bestDist) {
      bestDist = d;
      best = label;
    }
  }
  return best;
}

/**
 * 감정 강도 (렌더 intensity multiplier).
 *
 * clamp(|v| + |a|, 0..1) — valence/arousal 축의 절대값 합. dominance는 제외.
 */
export function moodMagnitude(vec: MoodVec): number {
  const m = Math.abs(vec.v) + Math.abs(vec.a);
  return Math.max(0, Math.min(1, m));
}

/**
 * 두 MoodVec 사이 선형 보간.
 *
 * @param current 현재 상태
 * @param target 목표 상태
 * @param alpha 0..1, 한 스텝에 이동할 비율 (0.35 권장 — 한 턴에 35% 이동)
 */
export function lerpMood(current: MoodVec, target: MoodVec, alpha: number): MoodVec {
  const a = Math.max(0, Math.min(1, alpha));
  return {
    v: current.v + (target.v - current.v) * a,
    a: current.a + (target.a - current.a) * a,
    d: current.d + (target.d - current.d) * a,
  };
}

/** 턴당 lerp 계수 (감정 전이 속도). */
export const MOOD_LERP_ALPHA = 0.35;

export const NEUTRAL_MOOD: MoodVec = { v: 0, a: 0, d: 0 };
