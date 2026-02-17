import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { invoke } from '@tauri-apps/api/core';
import { useAvatarStore } from '../../stores/avatarStore';

// Helper function to log to terminal
const logToTerminal = (message: string) => {
  invoke('log_to_terminal', { message }).catch(console.error);
};

export default function LookAtController() {
  const vrm = useAvatarStore((state) => state.vrm);
  const hasLoggedRef = useRef(false);

  // Note: Camera and target are commented out while debugging eye issues
  // const { camera } = useThree();
  // const targetRef = useRef(new THREE.Vector3());

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

  useFrame(() => {
    // DISABLED: VRMLookAtBoneApplier might be causing eye rendering issues
    // The bone rotation could be making the eye texture point in wrong direction
    // Test with lookAt disabled first to see if eyes render correctly

    // Uncomment below to enable lookAt:
    // if (!vrm?.lookAt) return;
    // targetRef.current.copy(camera.position);
    // vrm.lookAt.target = targetRef.current;
  });

  return null;
}
