/**
 * 감정 분석 통합 모듈
 *
 * useConversation.ts와 responseProcessor.ts에서 중복되던
 * analyzeEmotion / EMOTION_KEYWORDS를 단일 소스로 통합한다.
 * 캐릭터 archetype 가중치를 적용할 수 있다.
 */
import type { Emotion } from '../../stores/avatarStore';
import type { CharacterArchetype } from './characterProfile';
import { getEmotionWeight } from './emotionWeights';

export interface EmotionMatch {
  emotion: Emotion;
  score: number;
}

export const EMOTION_KEYWORDS: Record<Emotion, string[]> = {
  neutral: [],
  happy: ['happy', 'great', 'love', 'awesome', '좋아', '행복', '기뻐', '최고', '고마워'],
  sad: ['sad', 'sorry', 'unfortunately', '슬퍼', '미안', '힘들', '우울', '걱정'],
  angry: ['angry', 'annoyed', 'frustrated', '화나', '짜증', '열받', '빡쳐'],
  surprised: ['wow', 'surprised', 'amazing', '대박', '놀라', '헉', '와'],
  relaxed: ['calm', 'relaxed', 'peaceful', '차분', '편안', '여유'],
  thinking: ['think', 'maybe', 'hmm', '음', '생각', '고민', '글쎄'],
};

/**
 * 텍스트에서 감정을 분석한다.
 *
 * @param text 분석할 텍스트
 * @param archetype 캐릭터 archetype (가중치 적용, 없으면 기본 1.0)
 */
export function analyzeEmotion(text: string, archetype?: CharacterArchetype): EmotionMatch {
  const normalized = text.toLowerCase();
  let best: EmotionMatch = { emotion: 'neutral', score: 0 };

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS) as [Emotion, string[]][]) {
    if (emotion === 'neutral') continue;

    let rawScore = 0;
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) rawScore += 1;
    }

    if (rawScore === 0) continue;

    // archetype 가중치 적용
    const weight = archetype ? getEmotionWeight(archetype, emotion) : undefined;
    const weightedScore = weight ? rawScore * weight.sensitivity : rawScore;

    if (weightedScore > best.score) {
      best = { emotion, score: weightedScore };
    }
  }

  return best;
}
