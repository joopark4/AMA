/**
 * 캐릭터 archetype별 감정 가중치
 *
 * analyzeEmotion의 키워드 매칭 점수에 가중치를 곱하여
 * 캐릭터 성격에 맞는 감정 반응 강도를 조절한다.
 */
import type { CharacterArchetype } from './characterProfile';
import type { Emotion } from '../../stores/avatarStore';

export interface EmotionWeight {
  /** 감정 감지 민감도 배율 (1.0 = 기본) */
  sensitivity: number;
  /** expressionIntensity 보정 배율 */
  expressionScale: number;
}

/**
 * archetype × emotion 가중치 매트릭스
 *
 * | Archetype | happy 민감도 | sad 표현 | angry 표현 |
 * |-----------|------------|---------|----------|
 * | genki     | 1.5x       | 억제    | 표현     |
 * | cool      | 0.7x       | 억제    | 억제     |
 * | neko      | 1.3x       | 과장    | 삐짐     |
 * | calm      | 0.8x       | 공감    | 표현     |
 * | trickster | 1.2x       | 장난    | 장난     |
 */
const WEIGHT_MATRIX: Record<CharacterArchetype, Partial<Record<Emotion, EmotionWeight>>> = {
  genki: {
    happy:    { sensitivity: 1.5, expressionScale: 1.2 },
    sad:      { sensitivity: 0.8, expressionScale: 0.7 },
    angry:    { sensitivity: 1.0, expressionScale: 1.0 },
    surprised:{ sensitivity: 1.3, expressionScale: 1.2 },
  },
  cool: {
    happy:    { sensitivity: 0.7, expressionScale: 0.7 },
    sad:      { sensitivity: 0.8, expressionScale: 0.6 },
    angry:    { sensitivity: 0.8, expressionScale: 0.7 },
    surprised:{ sensitivity: 0.6, expressionScale: 0.6 },
  },
  neko: {
    happy:    { sensitivity: 1.3, expressionScale: 1.3 },
    sad:      { sensitivity: 1.2, expressionScale: 1.4 },
    angry:    { sensitivity: 0.9, expressionScale: 0.8 },
    surprised:{ sensitivity: 1.4, expressionScale: 1.3 },
  },
  calm: {
    happy:    { sensitivity: 0.8, expressionScale: 0.8 },
    sad:      { sensitivity: 1.1, expressionScale: 1.0 },
    angry:    { sensitivity: 0.9, expressionScale: 0.9 },
    surprised:{ sensitivity: 0.7, expressionScale: 0.8 },
  },
  trickster: {
    happy:    { sensitivity: 1.2, expressionScale: 1.1 },
    sad:      { sensitivity: 0.9, expressionScale: 0.8 },
    angry:    { sensitivity: 0.8, expressionScale: 0.8 },
    surprised:{ sensitivity: 1.3, expressionScale: 1.2 },
  },
  custom: {},
};

const DEFAULT_WEIGHT: EmotionWeight = { sensitivity: 1.0, expressionScale: 1.0 };

export function getEmotionWeight(
  archetype: CharacterArchetype,
  emotion: Emotion
): EmotionWeight {
  return WEIGHT_MATRIX[archetype]?.[emotion] ?? DEFAULT_WEIGHT;
}
