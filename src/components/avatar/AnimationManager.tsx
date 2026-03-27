import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEffect } from 'react';
import PhysicsController from './PhysicsController';
import ExpressionController from './ExpressionController';
import EyeController from './EyeController';
import LookAtController from './LookAtController';
import DanceController from './DanceController';
import HumanoidSyncController from './HumanoidSyncController';
import IdleFidgetController from './IdleFidgetController';

/**
 * AnimationManager - Orchestrates all animation layers
 *
 * Animation Layer System (from bottom to top):
 * Layer 0: Base (idle/walking) - Mixamo FBX clips via LocomotionClipManager (VRMAvatar.tsx)
 * Layer 0.5: Idle fidget (breathing, micro head drift) - IdleFidgetController
 * Layer 1: Physics (SpringBone) - PhysicsController
 * Layer 2: Expression (facial blending) - ExpressionController + EyeController + LookAtController
 * Layer 3: Dance (rhythm-based movement) - DanceController
 * Layer 4: Final humanoid sync - HumanoidSyncController
 */
export default function AnimationManager() {
  const vrm = useAvatarStore((state) => state.vrm);
  const { settings } = useSettingsStore();
  const stopDancing = useAvatarStore((state) => state.stopDancing);

  const physicsEnabled = settings.avatar?.physics?.enabled ?? true;
  const dancingEnabled = settings.avatar?.animation?.enableDancing ?? true;
  const faceOnlyModeEnabled =
    settings.avatar?.animation?.faceExpressionOnlyMode ?? false;

  useEffect(() => {
    if (!faceOnlyModeEnabled) return;
    stopDancing();
  }, [faceOnlyModeEnabled, stopDancing]);

  if (!vrm) return null;

  return (
    <>
      {/* Layer 0.5: Idle fidget - Breathing and micro head drift */}
      {!faceOnlyModeEnabled && <IdleFidgetController />}

      {/* Layer 1: Physics - SpringBone effects for hair/clothing */}
      {physicsEnabled && <PhysicsController />}

      {/* Layer 2: Expression system - Facial expressions and emotions */}
      <ExpressionController />

      {/* Layer 2b: Eye controller - Eye movement and blinking */}
      <EyeController />

      {/* Layer 2c: LookAt controller - Makes avatar look at camera */}
      <LookAtController />

      {/* Layer 3: Dance system - Rhythm-based movement */}
      {!faceOnlyModeEnabled && dancingEnabled && <DanceController />}

      {/* Layer 4: Final normalized->raw humanoid sync for VRM compatibility */}
      <HumanoidSyncController />
    </>
  );
}
