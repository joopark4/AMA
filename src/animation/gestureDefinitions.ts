import type { Emotion, GestureType } from '../stores/avatarStore';

export interface GestureKeyframe {
  bone: string;
  time: number; // 0-1 normalized time
  rotation: { x?: number; y?: number; z?: number };
  position?: { x?: number; y?: number; z?: number };
}

export interface GestureDefinition {
  duration: number; // seconds
  loop?: boolean;
  loopCount?: number;
  triggerKeywords: string[];
  triggerEmotions?: Emotion[];
  blendInTime: number; // seconds
  blendOutTime: number; // seconds
  keyframes: GestureKeyframe[];
  priority: number; // Higher priority overrides lower
}

// Easing functions
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function easeInOutElastic(t: number): number {
  const c5 = (2 * Math.PI) / 4.5;
  return t === 0
    ? 0
    : t === 1
    ? 1
    : t < 0.5
    ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
    : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
}

export const GESTURE_DEFINITIONS: Record<NonNullable<GestureType>, GestureDefinition> = {
  wave: {
    duration: 2.0,
    triggerKeywords: ['hi', 'hello', 'bye', 'goodbye', 'wave', '안녕', '하이', '바이', '잘가'],
    blendInTime: 0.2,
    blendOutTime: 0.3,
    priority: 2,
    keyframes: [
      // Raise right arm
      { bone: 'rightUpperArm', time: 0.0, rotation: { z: -1.2, x: 0.1 } },
      { bone: 'rightUpperArm', time: 0.2, rotation: { z: -0.3, x: -0.8 } },
      { bone: 'rightLowerArm', time: 0.0, rotation: { y: 0.2 } },
      { bone: 'rightLowerArm', time: 0.2, rotation: { y: 1.0, z: 0.3 } },
      // Wave motion (repeat)
      { bone: 'rightHand', time: 0.2, rotation: { z: -0.3 } },
      { bone: 'rightHand', time: 0.35, rotation: { z: 0.3 } },
      { bone: 'rightHand', time: 0.5, rotation: { z: -0.3 } },
      { bone: 'rightHand', time: 0.65, rotation: { z: 0.3 } },
      { bone: 'rightHand', time: 0.8, rotation: { z: 0 } },
      // Lower arm back
      { bone: 'rightUpperArm', time: 0.85, rotation: { z: -0.3, x: -0.8 } },
      { bone: 'rightUpperArm', time: 1.0, rotation: { z: -1.2, x: 0.1 } },
      { bone: 'rightLowerArm', time: 0.85, rotation: { y: 1.0, z: 0.3 } },
      { bone: 'rightLowerArm', time: 1.0, rotation: { y: 0.2 } },
    ],
  },

  nod: {
    duration: 0.8,
    triggerKeywords: ['yes', 'yeah', 'okay', 'ok', 'sure', 'right', 'agree', '네', '응', '그래', '맞아', '알겠어', '좋아'],
    blendInTime: 0.1,
    blendOutTime: 0.15,
    priority: 1,
    keyframes: [
      { bone: 'head', time: 0.0, rotation: { x: 0 } },
      { bone: 'head', time: 0.25, rotation: { x: 0.2 } },
      { bone: 'head', time: 0.5, rotation: { x: -0.05 } },
      { bone: 'head', time: 0.75, rotation: { x: 0.15 } },
      { bone: 'head', time: 1.0, rotation: { x: 0 } },
      // Slight neck movement
      { bone: 'neck', time: 0.0, rotation: { x: 0 } },
      { bone: 'neck', time: 0.25, rotation: { x: 0.08 } },
      { bone: 'neck', time: 0.5, rotation: { x: -0.02 } },
      { bone: 'neck', time: 0.75, rotation: { x: 0.05 } },
      { bone: 'neck', time: 1.0, rotation: { x: 0 } },
    ],
  },

  shake: {
    duration: 1.0,
    triggerKeywords: ['no', 'nope', 'never', "don't", 'disagree', '아니', '안돼', '싫어', '못해', '아니야'],
    blendInTime: 0.1,
    blendOutTime: 0.15,
    priority: 1,
    keyframes: [
      { bone: 'head', time: 0.0, rotation: { y: 0 } },
      { bone: 'head', time: 0.15, rotation: { y: 0.2 } },
      { bone: 'head', time: 0.35, rotation: { y: -0.2 } },
      { bone: 'head', time: 0.55, rotation: { y: 0.15 } },
      { bone: 'head', time: 0.75, rotation: { y: -0.15 } },
      { bone: 'head', time: 1.0, rotation: { y: 0 } },
    ],
  },

  shrug: {
    duration: 1.2,
    triggerKeywords: ['dunno', "don't know", 'maybe', 'idk', 'perhaps', '몰라', '글쎄', '모르겠어', '아마'],
    blendInTime: 0.15,
    blendOutTime: 0.2,
    priority: 2,
    keyframes: [
      // Both shoulders up
      { bone: 'leftShoulder', time: 0.0, rotation: { z: 0 } },
      { bone: 'leftShoulder', time: 0.3, rotation: { z: 0.25 } },
      { bone: 'leftShoulder', time: 0.7, rotation: { z: 0.25 } },
      { bone: 'leftShoulder', time: 1.0, rotation: { z: 0 } },
      { bone: 'rightShoulder', time: 0.0, rotation: { z: 0 } },
      { bone: 'rightShoulder', time: 0.3, rotation: { z: -0.25 } },
      { bone: 'rightShoulder', time: 0.7, rotation: { z: -0.25 } },
      { bone: 'rightShoulder', time: 1.0, rotation: { z: 0 } },
      // Arms out slightly
      { bone: 'leftUpperArm', time: 0.0, rotation: { z: 1.2, x: 0.1 } },
      { bone: 'leftUpperArm', time: 0.3, rotation: { z: 0.8, x: 0.3 } },
      { bone: 'leftUpperArm', time: 0.7, rotation: { z: 0.8, x: 0.3 } },
      { bone: 'leftUpperArm', time: 1.0, rotation: { z: 1.2, x: 0.1 } },
      { bone: 'rightUpperArm', time: 0.0, rotation: { z: -1.2, x: 0.1 } },
      { bone: 'rightUpperArm', time: 0.3, rotation: { z: -0.8, x: 0.3 } },
      { bone: 'rightUpperArm', time: 0.7, rotation: { z: -0.8, x: 0.3 } },
      { bone: 'rightUpperArm', time: 1.0, rotation: { z: -1.2, x: 0.1 } },
      // Hands rotate
      { bone: 'leftHand', time: 0.0, rotation: { y: 0 } },
      { bone: 'leftHand', time: 0.3, rotation: { y: -0.5, z: 0.3 } },
      { bone: 'leftHand', time: 0.7, rotation: { y: -0.5, z: 0.3 } },
      { bone: 'leftHand', time: 1.0, rotation: { y: 0 } },
      { bone: 'rightHand', time: 0.0, rotation: { y: 0 } },
      { bone: 'rightHand', time: 0.3, rotation: { y: 0.5, z: -0.3 } },
      { bone: 'rightHand', time: 0.7, rotation: { y: 0.5, z: -0.3 } },
      { bone: 'rightHand', time: 1.0, rotation: { y: 0 } },
      // Head tilt
      { bone: 'head', time: 0.0, rotation: { z: 0 } },
      { bone: 'head', time: 0.3, rotation: { z: 0.1 } },
      { bone: 'head', time: 0.7, rotation: { z: 0.1 } },
      { bone: 'head', time: 1.0, rotation: { z: 0 } },
    ],
  },

  thinking: {
    duration: 3.0,
    loop: true,
    triggerKeywords: [],
    triggerEmotions: ['thinking'],
    blendInTime: 0.3,
    blendOutTime: 0.4,
    priority: 1,
    keyframes: [
      // Right hand to chin
      { bone: 'rightUpperArm', time: 0.0, rotation: { z: -1.2, x: 0.1 } },
      { bone: 'rightUpperArm', time: 0.2, rotation: { z: -0.9, x: -0.6 } },
      { bone: 'rightUpperArm', time: 0.8, rotation: { z: -0.9, x: -0.6 } },
      { bone: 'rightUpperArm', time: 1.0, rotation: { z: -1.2, x: 0.1 } },
      { bone: 'rightLowerArm', time: 0.0, rotation: { y: 0.2 } },
      { bone: 'rightLowerArm', time: 0.2, rotation: { y: 1.5 } },
      { bone: 'rightLowerArm', time: 0.8, rotation: { y: 1.5 } },
      { bone: 'rightLowerArm', time: 1.0, rotation: { y: 0.2 } },
      // Head tilt
      { bone: 'head', time: 0.0, rotation: { x: 0, y: 0, z: 0 } },
      { bone: 'head', time: 0.2, rotation: { x: 0.1, y: 0.1, z: 0.05 } },
      { bone: 'head', time: 0.5, rotation: { x: 0.15, y: 0.15, z: 0.05 } },
      { bone: 'head', time: 0.8, rotation: { x: 0.1, y: 0.1, z: 0.05 } },
      { bone: 'head', time: 1.0, rotation: { x: 0, y: 0, z: 0 } },
    ],
  },

  celebrate: {
    duration: 1.5,
    triggerKeywords: ['yay', 'hooray', 'awesome', 'amazing', 'great', 'wonderful', '야호', '최고', '대박', '짱'],
    triggerEmotions: ['happy'],
    blendInTime: 0.15,
    blendOutTime: 0.2,
    priority: 3,
    keyframes: [
      // Both arms up
      { bone: 'leftUpperArm', time: 0.0, rotation: { z: 1.2, x: 0.1 } },
      { bone: 'leftUpperArm', time: 0.25, rotation: { z: -0.3, x: -0.3 } },
      { bone: 'leftUpperArm', time: 0.7, rotation: { z: -0.3, x: -0.3 } },
      { bone: 'leftUpperArm', time: 1.0, rotation: { z: 1.2, x: 0.1 } },
      { bone: 'rightUpperArm', time: 0.0, rotation: { z: -1.2, x: 0.1 } },
      { bone: 'rightUpperArm', time: 0.25, rotation: { z: 0.3, x: -0.3 } },
      { bone: 'rightUpperArm', time: 0.7, rotation: { z: 0.3, x: -0.3 } },
      { bone: 'rightUpperArm', time: 1.0, rotation: { z: -1.2, x: 0.1 } },
      // Elbows
      { bone: 'leftLowerArm', time: 0.0, rotation: { y: -0.2 } },
      { bone: 'leftLowerArm', time: 0.25, rotation: { y: -0.8 } },
      { bone: 'leftLowerArm', time: 0.7, rotation: { y: -0.8 } },
      { bone: 'leftLowerArm', time: 1.0, rotation: { y: -0.2 } },
      { bone: 'rightLowerArm', time: 0.0, rotation: { y: 0.2 } },
      { bone: 'rightLowerArm', time: 0.25, rotation: { y: 0.8 } },
      { bone: 'rightLowerArm', time: 0.7, rotation: { y: 0.8 } },
      { bone: 'rightLowerArm', time: 1.0, rotation: { y: 0.2 } },
      // Little bounce
      { bone: 'spine', time: 0.0, rotation: { y: 0 } },
      { bone: 'spine', time: 0.15, rotation: { y: 0 } },
      { bone: 'spine', time: 0.35, rotation: { y: 0.1 } },
      { bone: 'spine', time: 0.55, rotation: { y: -0.1 } },
      { bone: 'spine', time: 0.75, rotation: { y: 0.05 } },
      { bone: 'spine', time: 1.0, rotation: { y: 0 } },
    ],
  },
  jump: {
    duration: 1.0,
    triggerKeywords: [],
    blendInTime: 0.1,
    blendOutTime: 0.2,
    priority: 4,
    keyframes: [], // Mixamo FBX 클립으로 재생 — 프로시저럴 키프레임 불필요
  },
};

// Find matching gesture from text
export function findGestureFromText(text: string): GestureType | null {
  const lowerText = text.toLowerCase();

  let bestMatch: { gesture: GestureType; priority: number } | null = null;

  for (const [gestureKey, definition] of Object.entries(GESTURE_DEFINITIONS)) {
    for (const keyword of definition.triggerKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        if (!bestMatch || definition.priority > bestMatch.priority) {
          bestMatch = { gesture: gestureKey as GestureType, priority: definition.priority };
        }
      }
    }
  }

  return bestMatch?.gesture ?? null;
}

// Find matching gesture from emotion
export function findGestureFromEmotion(emotion: Emotion): GestureType | null {
  for (const [gestureKey, definition] of Object.entries(GESTURE_DEFINITIONS)) {
    if (definition.triggerEmotions?.includes(emotion)) {
      return gestureKey as GestureType;
    }
  }
  return null;
}

// Interpolate keyframes at a given time
export function interpolateKeyframes(
  keyframes: GestureKeyframe[],
  bone: string,
  time: number
): { x: number; y: number; z: number } | null {
  // Filter keyframes for this bone
  const boneKeyframes = keyframes
    .filter((kf) => kf.bone === bone)
    .sort((a, b) => a.time - b.time);

  if (boneKeyframes.length === 0) return null;

  // Find surrounding keyframes
  let prevKeyframe = boneKeyframes[0];
  let nextKeyframe = boneKeyframes[boneKeyframes.length - 1];

  for (let i = 0; i < boneKeyframes.length - 1; i++) {
    if (boneKeyframes[i].time <= time && boneKeyframes[i + 1].time >= time) {
      prevKeyframe = boneKeyframes[i];
      nextKeyframe = boneKeyframes[i + 1];
      break;
    }
  }

  // Calculate interpolation factor
  const range = nextKeyframe.time - prevKeyframe.time;
  const t = range > 0 ? (time - prevKeyframe.time) / range : 0;
  const easedT = easeInOutQuad(t);

  // Interpolate rotation
  return {
    x: lerp(prevKeyframe.rotation.x ?? 0, nextKeyframe.rotation.x ?? 0, easedT),
    y: lerp(prevKeyframe.rotation.y ?? 0, nextKeyframe.rotation.y ?? 0, easedT),
    z: lerp(prevKeyframe.rotation.z ?? 0, nextKeyframe.rotation.z ?? 0, easedT),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
