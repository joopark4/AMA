import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useConversationStore } from '../../stores/conversationStore';
import { useAvatarStore, type Emotion } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  getMotionById,
  loadMotionClipData,
} from '../../services/avatar/motionLibrary';
import { selectMotionClip } from '../../services/avatar/motionSelector';
import {
  easeInOutQuad,
  interpolateKeyframes,
} from '../../animation/gestureDefinitions';

interface BoneRotation {
  x: number;
  y: number;
  z: number;
}

const BONE_NAMES: Record<string, string> = {
  head: 'head',
  neck: 'neck',
  spine: 'spine',
  chest: 'chest',
  hips: 'hips',
  leftShoulder: 'leftShoulder',
  rightShoulder: 'rightShoulder',
  leftUpperArm: 'leftUpperArm',
  rightUpperArm: 'rightUpperArm',
  leftLowerArm: 'leftLowerArm',
  rightLowerArm: 'rightLowerArm',
  leftHand: 'leftHand',
  rightHand: 'rightHand',
  leftUpperLeg: 'leftUpperLeg',
  rightUpperLeg: 'rightUpperLeg',
  leftLowerLeg: 'leftLowerLeg',
  rightLowerLeg: 'rightLowerLeg',
  leftFoot: 'leftFoot',
  rightFoot: 'rightFoot',
};

type MotionStyleTag =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'thinking'
  | 'relaxed'
  | 'bridge';

const STYLE_OSCILLATION_BONES = new Set([
  'head',
  'neck',
  'spine',
  'chest',
  'hips',
  'leftShoulder',
  'rightShoulder',
]);

const EMOTION_STYLE_OFFSETS: Record<MotionStyleTag, Partial<Record<string, BoneRotation>>> = {
  neutral: {
    spine: { x: 0, y: 0, z: 0.02 },
    chest: { x: -0.01, y: 0, z: 0.03 },
    head: { x: -0.01, y: 0, z: 0 },
  },
  happy: {
    spine: { x: -0.06, y: 0, z: 0.06 },
    chest: { x: -0.08, y: 0, z: 0.08 },
    head: { x: -0.05, y: 0.08, z: 0.03 },
    leftUpperArm: { x: -0.12, y: 0, z: 0.2 },
    rightUpperArm: { x: -0.12, y: 0, z: -0.2 },
  },
  sad: {
    spine: { x: 0.08, y: 0, z: -0.05 },
    chest: { x: 0.1, y: 0, z: -0.07 },
    head: { x: 0.15, y: -0.04, z: -0.03 },
    leftShoulder: { x: 0.05, y: 0, z: -0.1 },
    rightShoulder: { x: 0.05, y: 0, z: 0.1 },
  },
  angry: {
    hips: { x: -0.06, y: 0.06, z: 0 },
    spine: { x: -0.08, y: 0.08, z: 0.03 },
    chest: { x: -0.05, y: 0.1, z: 0.02 },
    head: { x: -0.05, y: 0.12, z: 0 },
    leftUpperArm: { x: -0.1, y: 0, z: -0.12 },
    rightUpperArm: { x: -0.1, y: 0, z: 0.12 },
  },
  surprised: {
    spine: { x: -0.12, y: 0, z: 0.05 },
    chest: { x: -0.16, y: 0, z: 0.06 },
    head: { x: -0.14, y: 0, z: 0.02 },
    leftUpperArm: { x: -0.2, y: 0, z: 0.22 },
    rightUpperArm: { x: -0.2, y: 0, z: -0.22 },
  },
  thinking: {
    spine: { x: 0.01, y: 0.05, z: 0.04 },
    head: { x: 0.05, y: 0.18, z: 0.14 },
    neck: { x: 0.03, y: 0.12, z: 0.08 },
    leftLowerArm: { x: -0.14, y: 0.08, z: 0.1 },
    rightLowerArm: { x: -0.1, y: -0.05, z: -0.08 },
  },
  relaxed: {
    spine: { x: 0.01, y: 0, z: 0.05 },
    chest: { x: 0, y: 0, z: 0.06 },
    head: { x: -0.01, y: 0.02, z: 0.08 },
    leftShoulder: { x: -0.02, y: 0, z: 0.06 },
    rightShoulder: { x: -0.02, y: 0, z: -0.06 },
  },
  bridge: {
    hips: { x: 0, y: 0, z: 0 },
  },
};

function getPrimaryEmotionTag(emotionTags: string[]): MotionStyleTag {
  const orderedTags: MotionStyleTag[] = [
    'happy',
    'sad',
    'angry',
    'surprised',
    'thinking',
    'relaxed',
    'neutral',
    'bridge',
  ];

  for (const tag of orderedTags) {
    if (emotionTags.includes(tag)) return tag;
  }
  return 'neutral';
}

function getIntensityScale(intensity: 'low' | 'mid' | 'high'): number {
  if (intensity === 'high') return 1.25;
  if (intensity === 'mid') return 1.0;
  return 0.75;
}

function getStyleOscillation(
  emotionTag: MotionStyleTag,
  normalizedTime: number,
  boneName: string
): BoneRotation {
  if (!STYLE_OSCILLATION_BONES.has(boneName)) {
    return { x: 0, y: 0, z: 0 };
  }

  const t = normalizedTime * Math.PI * 2;

  switch (emotionTag) {
    case 'happy':
      return {
        x: Math.sin(t * 2.1) * 0.028,
        y: Math.sin(t * 1.6) * 0.024,
        z: Math.sin(t * 2.4) * 0.018,
      };
    case 'sad':
      return {
        x: Math.sin(t * 0.9) * 0.015,
        y: Math.sin(t * 0.6) * 0.01,
        z: Math.sin(t * 1.1) * 0.012,
      };
    case 'angry':
      return {
        x: Math.sin(t * 3.0) * 0.024,
        y: Math.sin(t * 2.8) * 0.022,
        z: Math.sin(t * 3.4) * 0.016,
      };
    case 'surprised':
      return {
        x: Math.sin(t * 2.7) * 0.026,
        y: Math.sin(t * 2.2) * 0.014,
        z: Math.sin(t * 3.1) * 0.012,
      };
    case 'thinking':
      return {
        x: Math.sin(t * 1.2) * 0.018,
        y: Math.sin(t * 1.0) * 0.026,
        z: Math.sin(t * 0.9) * 0.02,
      };
    case 'relaxed':
      return {
        x: Math.sin(t * 0.95) * 0.012,
        y: Math.sin(t * 0.75) * 0.012,
        z: Math.sin(t * 0.8) * 0.024,
      };
    case 'neutral':
      return {
        x: Math.sin(t * 1.1) * 0.01,
        y: Math.sin(t * 1.0) * 0.008,
        z: Math.sin(t * 1.1) * 0.01,
      };
    case 'bridge':
    default:
      return { x: 0, y: 0, z: 0 };
  }
}

function getEmotionStyleAccent(
  boneName: string,
  emotionTag: MotionStyleTag,
  intensity: 'low' | 'mid' | 'high',
  normalizedTime: number,
  strength: number
): BoneRotation {
  if (strength <= 0) return { x: 0, y: 0, z: 0 };

  const base = EMOTION_STYLE_OFFSETS[emotionTag]?.[boneName] ?? { x: 0, y: 0, z: 0 };
  const oscillation = getStyleOscillation(emotionTag, normalizedTime, boneName);
  const scaled = strength * getIntensityScale(intensity);

  return {
    x: ((base.x ?? 0) + oscillation.x) * scaled,
    y: ((base.y ?? 0) + oscillation.y) * scaled,
    z: ((base.z ?? 0) + oscillation.z) * scaled,
  };
}

function getDynamicEmotionFactor(emotionTags: string[]): number {
  if (emotionTags.includes('happy') || emotionTags.includes('angry') || emotionTags.includes('surprised')) {
    return 1.0;
  }
  if (emotionTags.includes('thinking') || emotionTags.includes('relaxed') || emotionTags.includes('sad')) {
    return 0.5;
  }
  if (emotionTags.includes('neutral')) {
    return 0.7;
  }
  return 0.75;
}

export default function ClipMotionController() {
  const vrm = useAvatarStore((state) => state.vrm);
  const {
    emotion,
    currentGesture,
    currentMotionClip,
    isMoving,
    clearMotionClip,
    setMotionProgress,
    triggerGesture,
    triggerMotionClip,
    registerMotionSelection,
    recentMotionIds,
    motionCooldownMap,
  } = useAvatarStore();
  const { settings } = useSettingsStore();
  const conversationStatus = useConversationStore((state) => state.status);

  const startTimeRef = useRef(0);
  const basePoseRef = useRef<Record<string, BoneRotation>>({});
  const activeMetaRef = useRef<ReturnType<typeof getMotionById>>(null);
  const activeDataRef = useRef<Awaited<ReturnType<typeof loadMotionClipData>>>(null);
  const loadTokenRef = useRef(0);
  const lastEmotionRef = useRef<Emotion>('neutral');

  const motionEnabled = settings.avatar?.animation?.enableMotionClips ?? true;
  const diversityStrength = settings.avatar?.animation?.motionDiversity ?? 1;
  const dynamicMotionEnabled = settings.avatar?.animation?.dynamicMotionEnabled ?? false;
  const dynamicMotionBoost = dynamicMotionEnabled
    ? settings.avatar?.animation?.dynamicMotionBoost ?? 1.0
    : 0;

  const captureBasePose = () => {
    if (!vrm?.humanoid) return;

    for (const boneName of Object.values(BONE_NAMES)) {
      const bone = vrm.humanoid.getNormalizedBoneNode(boneName as any);
      if (!bone) continue;
      basePoseRef.current[boneName] = {
        x: bone.rotation.x,
        y: bone.rotation.y,
        z: bone.rotation.z,
      };
    }
  };

  useEffect(() => {
    if (!motionEnabled) {
      if (currentMotionClip) clearMotionClip();
      return;
    }

    if (currentMotionClip || currentGesture || isMoving) return;
    if (emotion === 'neutral') {
      lastEmotionRef.current = 'neutral';
      return;
    }
    if (emotion === lastEmotionRef.current) return;

    lastEmotionRef.current = emotion;

    const selection = selectMotionClip({
      emotion,
      emotionScore: 1,
      isSpeaking: conversationStatus === 'speaking',
      isMoving,
      diversityStrength,
      dynamicBoost: dynamicMotionBoost,
      recentMotionIds,
      cooldownMap: motionCooldownMap,
      now: Date.now(),
    });

    if (!selection.selected) return;

    registerMotionSelection(selection.selected.id, selection.selected.cooldown_ms);
    triggerMotionClip(selection.selected.id);
  }, [
    currentGesture,
    currentMotionClip,
    diversityStrength,
    dynamicMotionBoost,
    emotion,
    isMoving,
    motionCooldownMap,
    motionEnabled,
    recentMotionIds,
    conversationStatus,
    triggerMotionClip,
    registerMotionSelection,
    clearMotionClip,
  ]);

  useEffect(() => {
    if (!currentMotionClip) {
      loadTokenRef.current += 1;
      activeMetaRef.current = null;
      activeDataRef.current = null;
      return;
    }

    if (currentGesture) {
      clearMotionClip();
      return;
    }

    const meta = getMotionById(currentMotionClip);
    if (!meta) {
      clearMotionClip();
      return;
    }

    if (isMoving && meta.loopable) {
      clearMotionClip();
      return;
    }

    if (conversationStatus === 'speaking' && !meta.speaking_compatible) {
      clearMotionClip();
      return;
    }

    activeMetaRef.current = meta;
    activeDataRef.current = null;
    startTimeRef.current = performance.now() * 0.001;
    captureBasePose();

    const loadToken = ++loadTokenRef.current;

    void loadMotionClipData(meta)
      .then((data) => {
        if (loadToken !== loadTokenRef.current) return;

        if (!data) {
          if (meta.fallback_gesture) {
            triggerGesture(meta.fallback_gesture);
          }
          clearMotionClip();
          return;
        }

        activeDataRef.current = data;
        startTimeRef.current = performance.now() * 0.001;
        captureBasePose();
      })
      .catch(() => {
        if (loadToken !== loadTokenRef.current) return;
        if (meta.fallback_gesture) {
          triggerGesture(meta.fallback_gesture);
        }
        clearMotionClip();
      });
  }, [
    conversationStatus,
    currentGesture,
    currentMotionClip,
    clearMotionClip,
    isMoving,
    triggerGesture,
    vrm,
  ]);

  useEffect(() => {
    if (!currentMotionClip) return;

    const meta = activeMetaRef.current;
    if (!meta) return;

    if (isMoving && meta.loopable) {
      clearMotionClip();
      return;
    }

    if (conversationStatus === 'speaking' && !meta.speaking_compatible) {
      clearMotionClip();
    }
  }, [conversationStatus, currentMotionClip, isMoving, clearMotionClip]);

  useFrame(() => {
    if (!motionEnabled) return;
    if (!vrm?.humanoid) return;
    if (!currentMotionClip) return;

    const meta = activeMetaRef.current;
    const data = activeDataRef.current;
    if (!meta || !data) return;

    const now = performance.now() * 0.001;
    const normalizedBoost = Math.max(0, Math.min(1.5, dynamicMotionBoost));
    const emotionTag = getPrimaryEmotionTag(meta.emotion_tags);
    const emotionFactor = getDynamicEmotionFactor(meta.emotion_tags);
    const intensityFactor =
      meta.intensity === 'high' ? 1.1 : meta.intensity === 'mid' ? 0.85 : 0.65;
    const speakingDampen = conversationStatus === 'speaking' ? 0.78 : 1;
    const dynamicScale = normalizedBoost * emotionFactor * intensityFactor * speakingDampen;
    const rotationGain = 1 + dynamicScale * 0.58;
    const speedGain = 1 + dynamicScale * 0.28;
    const styleStrength = (
      dynamicMotionEnabled
        ? 0.25 + normalizedBoost * 0.8
        : 0.1
    ) * speakingDampen;

    const duration = Math.max(0.2, (data.duration_ms / 1000) / Math.max(1, speedGain));
    let normalizedTime = (now - startTimeRef.current) / duration;

    if (normalizedTime >= 1) {
      if (meta.loopable && !isMoving) {
        startTimeRef.current = now;
        normalizedTime = 0;
      } else {
        clearMotionClip();
        return;
      }
    }

    setMotionProgress(normalizedTime);

    const blendInNorm = Math.max(0.01, data.blend_in_ms / data.duration_ms);
    const blendOutNorm = Math.max(0.01, data.blend_out_ms / data.duration_ms);

    let blendWeight = 1;
    if (normalizedTime < blendInNorm) {
      blendWeight = easeInOutQuad(normalizedTime / blendInNorm);
    } else if (!meta.loopable && normalizedTime > 1 - blendOutNorm) {
      blendWeight = easeInOutQuad((1 - normalizedTime) / blendOutNorm);
    }

    const motionBones = new Set(data.keyframes.map((frame) => frame.bone));

    for (const boneName of motionBones) {
      const vrmBoneName = BONE_NAMES[boneName] ?? boneName;
      const bone = vrm.humanoid.getNormalizedBoneNode(vrmBoneName as any);
      if (!bone) continue;

      const keyRotation = interpolateKeyframes(data.keyframes, boneName, normalizedTime);
      if (!keyRotation) continue;

      const basePose = basePoseRef.current[vrmBoneName] || {
        x: bone.rotation.x,
        y: bone.rotation.y,
        z: bone.rotation.z,
      };

      const styleAccent = getEmotionStyleAccent(
        vrmBoneName,
        emotionTag,
        meta.intensity,
        normalizedTime,
        styleStrength
      );

      const targetX =
        basePose.x +
        (keyRotation.x - basePose.x) * blendWeight * rotationGain +
        styleAccent.x;
      const targetY =
        basePose.y +
        (keyRotation.y - basePose.y) * blendWeight * rotationGain +
        styleAccent.y;
      const targetZ =
        basePose.z +
        (keyRotation.z - basePose.z) * blendWeight * rotationGain +
        styleAccent.z;

      bone.rotation.x = Math.max(-Math.PI * 0.97, Math.min(Math.PI * 0.97, targetX));
      bone.rotation.y = Math.max(-Math.PI * 0.97, Math.min(Math.PI * 0.97, targetY));
      bone.rotation.z = Math.max(-Math.PI * 0.97, Math.min(Math.PI * 0.97, targetZ));
    }
  });

  return null;
}
