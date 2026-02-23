export type MotionClipId = string;

export type MotionIntensity = 'low' | 'mid' | 'high';

export type MotionEmotionTag =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'relaxed'
  | 'thinking'
  | 'bridge';

export type MotionFallbackGesture =
  | 'wave'
  | 'nod'
  | 'shake'
  | 'shrug'
  | 'thinking'
  | 'celebrate';

export interface MotionClipMeta {
  id: MotionClipId;
  emotion_tags: MotionEmotionTag[];
  intensity: MotionIntensity;
  duration_ms: number;
  loopable: boolean;
  speaking_compatible: boolean;
  priority: number;
  cooldown_ms: number;
  file: string;
  license_class: string;
  source_url: string;
  attribution_required: boolean;
  redistribution_note: string;
  fallback_gesture?: MotionFallbackGesture;
  variation_tag?: string;
  slot_group?: string;
  body_zone?: 'upper' | 'full';
}

export interface MotionClipFrame {
  bone: string;
  time: number;
  rotation: {
    x?: number;
    y?: number;
    z?: number;
  };
  position?: {
    x?: number;
    y?: number;
    z?: number;
  };
}

export interface MotionClipData {
  version: number;
  fps: number;
  duration_ms: number;
  blend_in_ms: number;
  blend_out_ms: number;
  keyframes: MotionClipFrame[];
}

export interface MotionManifest {
  version: number;
  fps: number;
  clips: MotionClipMeta[];
}

export interface MotionSelectorInput {
  emotion: Exclude<MotionEmotionTag, 'bridge'>;
  emotionScore: number;
  isSpeaking: boolean;
  isMoving: boolean;
  diversityStrength: number;
  dynamicBoost?: number;
  recentMotionIds: MotionClipId[];
  cooldownMap: Record<string, number>;
  now: number;
}

export interface MotionSelectorResult {
  selected: MotionClipMeta | null;
  candidates: MotionClipMeta[];
  reason: string;
}
