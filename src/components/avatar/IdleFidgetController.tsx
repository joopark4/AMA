import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';

// Breathing: spine/chest Y-axis ±0.015 rad, cycle 3~4 seconds
const BREATH_AMPLITUDE = 0.015;
const BREATH_PERIOD_MIN = 3.0;
const BREATH_PERIOD_MAX = 4.0;

// Micro head rotation: ±0.03 rad, every 20~40 seconds
const HEAD_DRIFT_AMPLITUDE = 0.03;
const HEAD_DRIFT_INTERVAL_MIN = 20;
const HEAD_DRIFT_INTERVAL_MAX = 40;
const HEAD_DRIFT_SPEED = 0.8; // lerp speed

export default function IdleFidgetController() {
  const vrm = useAvatarStore((state) => state.vrm);
  const animationState = useAvatarStore((state) => state.animationState);
  const currentMotionClip = useAvatarStore((state) => state.currentMotionClip);
  const currentGesture = useAvatarStore((state) => state.currentGesture);
  const isDancing = useAvatarStore((state) => state.isDancing);
  const enableBreathing = useSettingsStore((s) => s.settings.avatar?.animation?.enableBreathing ?? true);
  const enableEyeDrift = useSettingsStore((s) => s.settings.avatar?.animation?.enableEyeDrift ?? true);

  const breathPhaseRef = useRef(Math.random() * Math.PI * 2);
  const breathPeriodRef = useRef(
    BREATH_PERIOD_MIN + Math.random() * (BREATH_PERIOD_MAX - BREATH_PERIOD_MIN),
  );

  const headDriftTargetRef = useRef({ y: 0, z: 0 });
  const headDriftCurrentRef = useRef({ y: 0, z: 0 });
  const nextHeadDriftTimeRef = useRef(
    performance.now() * 0.001 +
      HEAD_DRIFT_INTERVAL_MIN +
      Math.random() * (HEAD_DRIFT_INTERVAL_MAX - HEAD_DRIFT_INTERVAL_MIN),
  );

  useFrame((_, delta) => {
    if (!vrm?.humanoid) return;

    // Skip when higher-priority animations are active
    const isHigherPriorityActive =
      currentMotionClip !== null ||
      currentGesture !== null ||
      isDancing;

    if (isHigherPriorityActive) return;

    // Reduce fidget intensity during walking
    const isWalking = animationState === 'walking';
    const breathScale = isWalking ? 0.3 : 1.0;
    const headScale = isWalking ? 0 : 1.0;

    // === Breathing ===
    if (enableBreathing) {
      const spine = vrm.humanoid.getNormalizedBoneNode('spine' as any);
      const chest = vrm.humanoid.getNormalizedBoneNode('chest' as any);

      breathPhaseRef.current += (delta / breathPeriodRef.current) * Math.PI * 2;
      if (breathPhaseRef.current > Math.PI * 2) {
        breathPhaseRef.current -= Math.PI * 2;
        // Vary the period slightly each cycle
        breathPeriodRef.current =
          BREATH_PERIOD_MIN + Math.random() * (BREATH_PERIOD_MAX - BREATH_PERIOD_MIN);
      }

      const breathValue = Math.sin(breathPhaseRef.current) * BREATH_AMPLITUDE * breathScale;

      if (spine) {
        spine.rotation.x += breathValue * 0.6;
      }
      if (chest) {
        chest.rotation.x += breathValue;
      }
    }

    // === Micro head drift ===
    if (enableEyeDrift && headScale > 0) {
      const time = performance.now() * 0.001;
      const head = vrm.humanoid.getNormalizedBoneNode('head' as any);

      if (head) {
        // Schedule new drift target
        if (time >= nextHeadDriftTimeRef.current) {
          headDriftTargetRef.current = {
            y: (Math.random() * 2 - 1) * HEAD_DRIFT_AMPLITUDE,
            z: (Math.random() * 2 - 1) * HEAD_DRIFT_AMPLITUDE * 0.5,
          };
          nextHeadDriftTimeRef.current =
            time +
            HEAD_DRIFT_INTERVAL_MIN +
            Math.random() * (HEAD_DRIFT_INTERVAL_MAX - HEAD_DRIFT_INTERVAL_MIN);
        }

        // Smooth lerp toward target
        const blend = 1 - Math.exp(-delta * HEAD_DRIFT_SPEED);
        headDriftCurrentRef.current.y +=
          (headDriftTargetRef.current.y - headDriftCurrentRef.current.y) * blend;
        headDriftCurrentRef.current.z +=
          (headDriftTargetRef.current.z - headDriftCurrentRef.current.z) * blend;

        head.rotation.y += headDriftCurrentRef.current.y * headScale;
        head.rotation.z += headDriftCurrentRef.current.z * headScale;
      }
    }
  });

  return null;
}
