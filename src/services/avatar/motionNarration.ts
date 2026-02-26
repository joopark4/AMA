import type { Language } from '../../stores/settingsStore';
import type { MotionClipMeta } from '../../types/motion';

const EMOTION_LABEL_KO: Record<string, string> = {
  neutral: '중립',
  happy: '행복',
  sad: '슬픔',
  angry: '분노',
  surprised: '놀람',
  thinking: '사고',
  relaxed: '편안',
  bridge: '전환',
};

const EMOTION_LABEL_EN: Record<string, string> = {
  neutral: 'neutral',
  happy: 'happy',
  sad: 'sad',
  angry: 'angry',
  surprised: 'surprised',
  thinking: 'thinking',
  relaxed: 'relaxed',
  bridge: 'bridge',
};

const EMOTION_MEANING_KO: Record<string, string> = {
  neutral: '기본 호흡과 안정 자세를 보여줍니다.',
  happy: '긍정적인 리액션과 활력을 표현합니다.',
  sad: '감정이 가라앉은 차분한 반응을 표현합니다.',
  angry: '강한 의지와 단호한 감정을 표현합니다.',
  surprised: '순간적인 놀람 반응을 표현합니다.',
  thinking: '생각에 잠긴 탐색 동작을 표현합니다.',
  relaxed: '긴장을 푼 편안한 흐름을 표현합니다.',
  bridge: '상태를 자연스럽게 전환하는 연결 동작입니다.',
};

const EMOTION_MEANING_EN: Record<string, string> = {
  neutral: 'Shows a stable baseline breathing pose.',
  happy: 'Expresses positive energy and upbeat reactions.',
  sad: 'Expresses calm, lowered emotional energy.',
  angry: 'Expresses assertive and intense emotion.',
  surprised: 'Expresses quick surprise reactions.',
  thinking: 'Expresses reflective and searching motion.',
  relaxed: 'Expresses loose and comfortable movement.',
  bridge: 'A bridge clip for smooth state transitions.',
};

const INTENSITY_LABEL_KO: Record<string, string> = {
  low: '저강도',
  mid: '중강도',
  high: '고강도',
};

const INTENSITY_LABEL_EN: Record<string, string> = {
  low: 'low intensity',
  mid: 'mid intensity',
  high: 'high intensity',
};

function pickPrimaryTag(clip: MotionClipMeta): string {
  if (clip.emotion_tags.length === 0) return 'bridge';
  if (clip.emotion_tags[0] === 'bridge' && clip.emotion_tags.length > 1) {
    return clip.emotion_tags[1];
  }
  return clip.emotion_tags[0];
}

export function buildMotionNarration(
  clip: MotionClipMeta,
  index: number,
  total: number,
  language: Language
): string {
  const tag = pickPrimaryTag(clip);

  if (language === 'en') {
    const emotionLabel = EMOTION_LABEL_EN[tag] ?? tag;
    const intensityLabel = INTENSITY_LABEL_EN[clip.intensity] ?? clip.intensity;
    const meaning = EMOTION_MEANING_EN[tag] ?? EMOTION_MEANING_EN.bridge;
    return `[${index + 1}/${total}] ${clip.id}. ${emotionLabel}, ${intensityLabel}. ${meaning}`;
  }

  const emotionLabel = EMOTION_LABEL_KO[tag] ?? tag;
  const intensityLabel = INTENSITY_LABEL_KO[clip.intensity] ?? clip.intensity;
  const meaning = EMOTION_MEANING_KO[tag] ?? EMOTION_MEANING_KO.bridge;
  return `[${index + 1}/${total}] ${clip.id}. ${emotionLabel} ${intensityLabel} 모션입니다. ${meaning}`;
}
