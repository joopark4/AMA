import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Object3D, Vector3 } from 'three';
import { invoke } from '@tauri-apps/api/core';
import { useAvatarStore, type Emotion } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';

// Helper function to log to terminal
const logToTerminal = (message: string) => {
  invoke('log_to_terminal', { message }).catch(console.error);
};

const LOOK_AT_OFFSETS: Record<Emotion, { x: number; y: number; z: number }> = {
  neutral: { x: 0, y: 0, z: 0 },
  happy: { x: 0.1, y: 0.05, z: 0 },
  sad: { x: -0.08, y: -0.04, z: 0 },
  angry: { x: 0.12, y: 0.02, z: 0 },
  surprised: { x: 0, y: 0.12, z: 0 },
  relaxed: { x: 0.04, y: -0.01, z: 0 },
  thinking: { x: -0.14, y: 0.04, z: 0 },
};

export default function LookAtController() {
  const vrm = useAvatarStore((state) => state.vrm);
  const emotion = useAvatarStore((state) => state.emotion);
  const faceOnlyModeEnabled = useSettingsStore(
    (state) => state.settings.avatar?.animation?.faceExpressionOnlyMode ?? false
  );
  const hasLoggedRef = useRef(false);
  const targetRef = useRef(new Object3D());
  const desiredRef = useRef(new Vector3());
  const { camera } = useThree();

  // Log VRM lookAt info once when VRM is loaded
  useEffect(() => {
    if (!vrm || hasLoggedRef.current) return;
    hasLoggedRef.current = true;

    logToTerminal('=== VRM LookAt Info ===');

    if (vrm.lookAt) {
      const lookAt = vrm.lookAt;
      logToTerminal(`LookAt available: true`);
      logToTerminal(`LookAt type: ${(lookAt as any).type || 'unknown'}`);

      // Check lookAt applier type
      if ((lookAt as any).applier) {
        const applier = (lookAt as any).applier;
        logToTerminal(`Applier type: ${applier.constructor.name}`);
      }

      // Log range settings if available
      if ((lookAt as any).rangeMapHorizontalInner) {
        logToTerminal(`Has horizontal inner range map`);
      }
      if ((lookAt as any).rangeMapHorizontalOuter) {
        logToTerminal(`Has horizontal outer range map`);
      }
      if ((lookAt as any).rangeMapVerticalDown) {
        logToTerminal(`Has vertical down range map`);
      }
      if ((lookAt as any).rangeMapVerticalUp) {
        logToTerminal(`Has vertical up range map`);
      }
    } else {
      logToTerminal(`LookAt available: false`);
    }

    // Check for eye bones
    if (vrm.humanoid) {
      const leftEye = vrm.humanoid.getNormalizedBoneNode('leftEye');
      const rightEye = vrm.humanoid.getNormalizedBoneNode('rightEye');
      logToTerminal(`Left eye bone: ${leftEye ? 'found' : 'not found'}`);
      logToTerminal(`Right eye bone: ${rightEye ? 'found' : 'not found'}`);
    }

    logToTerminal('========================');

    // Reset log flag when VRM changes
    return () => {
      hasLoggedRef.current = false;
    };
  }, [vrm]);

  useEffect(() => {
    if (!vrm?.lookAt) return;

    if (!faceOnlyModeEnabled) {
      vrm.lookAt.target = null;
    }

    return () => {
      if (!vrm?.lookAt) return;
      vrm.lookAt.target = null;
    };
  }, [faceOnlyModeEnabled, vrm]);

  useFrame((_, delta) => {
    if (!vrm?.lookAt || !faceOnlyModeEnabled) return;

    const baseOffset = LOOK_AT_OFFSETS[emotion] ?? LOOK_AT_OFFSETS.neutral;
    const t = performance.now() * 0.001;
    desiredRef.current.set(
      camera.position.x + baseOffset.x + Math.sin(t * 0.7) * 0.06,
      camera.position.y + baseOffset.y + Math.sin(t * 1.1 + 0.4) * 0.035,
      camera.position.z + baseOffset.z
    );

    const blend = 1 - Math.exp(-Math.max(0.001, delta) * 6);
    targetRef.current.position.lerp(desiredRef.current, blend);
    vrm.lookAt.target = targetRef.current;
  });

  return null;
}
