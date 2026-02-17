import type { Emotion } from '../stores/avatarStore';

// VRM Expression name mappings (VRM 1.0 -> possible VRM 0.x names)
// VRM 1.0 uses lowercase names, VRM 0.x uses different naming
export const EXPRESSION_NAME_MAP: Record<string, string[]> = {
  // Emotions
  happy: ['happy', 'Happy', 'joy', 'Joy', 'fun', 'Fun'],
  sad: ['sad', 'Sad', 'sorrow', 'Sorrow'],
  angry: ['angry', 'Angry'],
  surprised: ['surprised', 'Surprised'],
  relaxed: ['relaxed', 'Relaxed', 'neutral', 'Neutral'],
  // Mouth shapes (visemes)
  aa: ['aa', 'Aa', 'A', 'a'],
  ih: ['ih', 'Ih', 'I', 'i'],
  ou: ['ou', 'Ou', 'U', 'u'],
  ee: ['ee', 'Ee', 'E', 'e'],
  oh: ['oh', 'Oh', 'O', 'o'],
  // Blink
  blink: ['blink', 'Blink'],
  blinkLeft: ['blinkLeft', 'BlinkLeft', 'Blink_L', 'blink_l'],
  blinkRight: ['blinkRight', 'BlinkRight', 'Blink_R', 'blink_r'],
};

// Find the actual expression name available in the VRM model
export function findExpressionName(
  targetName: string,
  availableExpressions: string[]
): string | null {
  // First try exact match
  if (availableExpressions.includes(targetName)) {
    return targetName;
  }

  // Try mapped names
  const mappings = EXPRESSION_NAME_MAP[targetName];
  if (mappings) {
    for (const mapped of mappings) {
      if (availableExpressions.includes(mapped)) {
        return mapped;
      }
    }
  }

  // Try case-insensitive match
  const lowerTarget = targetName.toLowerCase();
  for (const available of availableExpressions) {
    if (available.toLowerCase() === lowerTarget) {
      return available;
    }
  }

  return null;
}

// Expression preset values for smooth blending
export interface ExpressionValues {
  happy: number;
  sad: number;
  angry: number;
  surprised: number;
  relaxed: number;
  // Micro expressions
  aa: number;
  ih: number;
  ou: number;
  ee: number;
  oh: number;
  blink: number;
  blinkLeft: number;
  blinkRight: number;
}

export const DEFAULT_EXPRESSION: ExpressionValues = {
  happy: 0,
  sad: 0,
  angry: 0,
  surprised: 0,
  relaxed: 0,
  aa: 0,
  ih: 0,
  ou: 0,
  ee: 0,
  oh: 0,
  blink: 0,
  blinkLeft: 0,
  blinkRight: 0,
};

// Expression presets with subtle blending for more natural looks
export const EXPRESSION_PRESETS: Record<Emotion, Partial<ExpressionValues>> = {
  neutral: {
    happy: 0,
    sad: 0,
    angry: 0,
    surprised: 0,
    relaxed: 0.15, // Slight relaxed for natural look
  },
  happy: {
    happy: 0.8,
    sad: 0,
    angry: 0,
    surprised: 0,
    relaxed: 0.2,
  },
  sad: {
    happy: 0,
    sad: 0.7,
    angry: 0,
    surprised: 0,
    relaxed: 0,
  },
  angry: {
    happy: 0,
    sad: 0,
    angry: 0.75,
    surprised: 0.1, // Slight surprise for intensity
    relaxed: 0,
  },
  surprised: {
    happy: 0,
    sad: 0,
    angry: 0,
    surprised: 0.85,
    relaxed: 0,
  },
  relaxed: {
    happy: 0.1,
    sad: 0,
    angry: 0,
    surprised: 0,
    relaxed: 0.7,
  },
  thinking: {
    happy: 0,
    sad: 0,
    angry: 0,
    surprised: 0.2, // Slight brow raise
    relaxed: 0.3,
  },
};

// Transition speed multipliers for different emotions
// Some emotions should transition faster (like surprise) or slower (like sadness)
export const EMOTION_TRANSITION_SPEED: Record<Emotion, number> = {
  neutral: 1.0,
  happy: 1.2,
  sad: 0.6,
  angry: 1.5,
  surprised: 2.5, // Quick reaction
  relaxed: 0.8,
  thinking: 0.9,
};

// Linear interpolation
export function lerp(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

// Blend between current expression values and target with smooth lerp
export function blendExpressions(
  current: Partial<ExpressionValues>,
  target: Partial<ExpressionValues>,
  blendSpeed: number,
  delta: number
): Partial<ExpressionValues> {
  const result: Partial<ExpressionValues> = { ...current };
  const factor = Math.min(1, blendSpeed * delta * 60); // Normalize to 60fps

  for (const key of Object.keys(target) as (keyof ExpressionValues)[]) {
    const currentValue = current[key] ?? 0;
    const targetValue = target[key] ?? 0;
    result[key] = lerp(currentValue, targetValue, factor);
  }

  return result;
}

// Get target expression values for an emotion
export function getExpressionForEmotion(emotion: Emotion): Partial<ExpressionValues> {
  return EXPRESSION_PRESETS[emotion] ?? EXPRESSION_PRESETS.neutral;
}

// Calculate blend speed based on emotion transition
export function getTransitionSpeed(
  _fromEmotion: Emotion,
  toEmotion: Emotion,
  baseSpeed: number
): number {
  const toSpeed = EMOTION_TRANSITION_SPEED[toEmotion] ?? 1.0;
  return baseSpeed * toSpeed;
}

// Micro expression variations based on context
export interface MicroExpressionContext {
  isTalking: boolean;
  isListening: boolean;
  isThinking: boolean;
  confidence: number; // 0-1, how confident the emotion detection is
}

export function applyMicroExpressions(
  base: Partial<ExpressionValues>,
  context: MicroExpressionContext,
  time: number
): Partial<ExpressionValues> {
  const result = { ...base };

  // Add subtle variations when talking
  if (context.isTalking) {
    // Slight eyebrow movement while talking
    const talkVariation = Math.sin(time * 3) * 0.05;
    result.surprised = (result.surprised ?? 0) + talkVariation;
  }

  // Add subtle variations when listening
  if (context.isListening) {
    // Slight interested expression
    const listenVariation = Math.sin(time * 1.5) * 0.03;
    result.happy = (result.happy ?? 0) + Math.max(0, listenVariation);
    result.surprised = (result.surprised ?? 0) + Math.max(0, listenVariation * 0.5);
  }

  // Thinking expression micro-movements
  if (context.isThinking) {
    // Subtle furrowed brow
    const thinkVariation = Math.sin(time * 0.8) * 0.05;
    result.angry = (result.angry ?? 0) + Math.max(0, thinkVariation * 0.3);
    result.surprised = (result.surprised ?? 0) + Math.max(0, thinkVariation * 0.5);
  }

  // Scale expression intensity by confidence
  if (context.confidence < 1.0) {
    const scale = 0.5 + context.confidence * 0.5;
    for (const key of Object.keys(result) as (keyof ExpressionValues)[]) {
      const value = result[key];
      if (typeof value === 'number' && key !== 'blink' && key !== 'blinkLeft' && key !== 'blinkRight') {
        result[key] = value * scale;
      }
    }
  }

  return result;
}
