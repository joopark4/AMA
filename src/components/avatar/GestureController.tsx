import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAvatarStore } from '../../stores/avatarStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  GESTURE_DEFINITIONS,
  findGestureFromText,
  findGestureFromEmotion,
  interpolateKeyframes,
  easeInOutQuad,
} from '../../animation/gestureDefinitions';

// Bone name mapping for VRM humanoid
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

// Store base pose rotations for blending
interface BoneRotation {
  x: number;
  y: number;
  z: number;
}

export default function GestureController() {
  const vrm = useAvatarStore((state) => state.vrm);
  const {
    currentGesture,
    currentMotionClip,
    emotion,
    animationState,
    isMoving,
    triggerGesture,
    setGestureProgress,
    clearGesture,
    resetGestures,
  } = useAvatarStore();
  const { currentResponse } = useConversationStore();
  const { settings } = useSettingsStore();

  // Track gesture timing
  const gestureStartTimeRef = useRef(0);
  const loopCountRef = useRef(0);
  const basePoseRef = useRef<Record<string, BoneRotation>>({});
  const lastResponseRef = useRef<string | null>(null);

  // Stop emotion-loop gestures when emotion/state no longer matches.
  useEffect(() => {
    if (isMoving) {
      if (currentGesture) {
        resetGestures();
      }
      return;
    }

    if (!currentGesture) return;

    const definition = GESTURE_DEFINITIONS[currentGesture];
    if (!definition) {
      clearGesture();
      return;
    }

    if (definition.loop && animationState === 'walking') {
      clearGesture();
      return;
    }

    if (
      definition.loop &&
      definition.triggerEmotions &&
      definition.triggerEmotions.length > 0 &&
      !definition.triggerEmotions.includes(emotion)
    ) {
      clearGesture();
    }
  }, [
    currentGesture,
    emotion,
    animationState,
    isMoving,
    clearGesture,
    resetGestures,
  ]);

  // Detect gestures from conversation
  useEffect(() => {
    if (!settings.avatar?.animation?.enableGestures) return;
    if (currentMotionClip) return;
    if (isMoving) return;
    if (!currentResponse || currentResponse === lastResponseRef.current) return;

    lastResponseRef.current = currentResponse;

    // Find gesture from text
    const textGesture = findGestureFromText(currentResponse);
    if (textGesture && !currentGesture) {
      triggerGesture(textGesture);
    }
  }, [
    currentResponse,
    currentGesture,
    currentMotionClip,
    triggerGesture,
    isMoving,
    settings.avatar?.animation?.enableGestures,
  ]);

  // Detect gestures from emotion (like thinking pose)
  useEffect(() => {
    if (!settings.avatar?.animation?.enableGestures) return;
    if (currentMotionClip) return;
    if (isMoving) return;

    const emotionGesture = findGestureFromEmotion(emotion);
    if (emotionGesture && !currentGesture && animationState !== 'walking') {
      // Only trigger emotion-based gestures when idle
      triggerGesture(emotionGesture);
    }
  }, [
    emotion,
    currentGesture,
    currentMotionClip,
    animationState,
    isMoving,
    triggerGesture,
    settings.avatar?.animation?.enableGestures,
  ]);

  // Initialize gesture timing when a new gesture starts
  useEffect(() => {
    if (currentGesture) {
      gestureStartTimeRef.current = performance.now() * 0.001;
      loopCountRef.current = 0;

      // Capture base pose
      if (vrm?.humanoid) {
        for (const boneName of Object.values(BONE_NAMES)) {
          const bone = vrm.humanoid.getNormalizedBoneNode(boneName as any);
          if (bone) {
            basePoseRef.current[boneName] = {
              x: bone.rotation.x,
              y: bone.rotation.y,
              z: bone.rotation.z,
            };
          }
        }
      }
    }
  }, [currentGesture, vrm]);

  // Animate gesture
  useFrame(() => {
    if (!vrm?.humanoid || !currentGesture) return;
    if (currentMotionClip) return;
    if (!settings.avatar?.animation?.enableGestures) return;

    const definition = GESTURE_DEFINITIONS[currentGesture];
    if (!definition) {
      clearGesture();
      return;
    }

    const currentTime = performance.now() * 0.001;
    const elapsed = currentTime - gestureStartTimeRef.current;
    const duration = definition.duration;

    // Calculate normalized time (0-1)
    let normalizedTime = elapsed / duration;

    // Handle looping
    if (normalizedTime >= 1) {
      if (definition.loop) {
        loopCountRef.current++;
        if (definition.loopCount && loopCountRef.current >= definition.loopCount) {
          clearGesture();
          return;
        }
        gestureStartTimeRef.current = currentTime;
        normalizedTime = 0;
      } else {
        clearGesture();
        return;
      }
    }

    setGestureProgress(normalizedTime);

    // Calculate blend weight for smooth in/out
    let blendWeight = 1.0;
    const blendInTime = definition.blendInTime / duration;
    const blendOutTime = definition.blendOutTime / duration;

    if (normalizedTime < blendInTime) {
      blendWeight = easeInOutQuad(normalizedTime / blendInTime);
    } else if (normalizedTime > 1 - blendOutTime && !definition.loop) {
      blendWeight = easeInOutQuad((1 - normalizedTime) / blendOutTime);
    }

    // Apply gesture keyframes to bones
    const humanoid = vrm.humanoid;

    for (const boneName of Object.keys(BONE_NAMES)) {
      const vrmBoneName = BONE_NAMES[boneName];
      const bone = humanoid.getNormalizedBoneNode(vrmBoneName as any);
      if (!bone) continue;

      const keyframeRotation = interpolateKeyframes(
        definition.keyframes,
        boneName,
        normalizedTime
      );

      if (keyframeRotation) {
        const basePose = basePoseRef.current[vrmBoneName] || { x: 0, y: 0, z: 0 };

        // Additive blending with base pose
        bone.rotation.x = basePose.x + (keyframeRotation.x - basePose.x) * blendWeight;
        bone.rotation.y = basePose.y + (keyframeRotation.y - basePose.y) * blendWeight;
        bone.rotation.z = basePose.z + (keyframeRotation.z - basePose.z) * blendWeight;
      }
    }
  });

  return null;
}
