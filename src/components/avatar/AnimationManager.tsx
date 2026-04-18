import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEffect } from 'react';
import PhysicsController from './PhysicsController';
import ExpressionController from './ExpressionController';
import EyeController from './EyeController';
import LookAtController from './LookAtController';
import GazeFollowController from './GazeFollowController';
import BackchannelController from './BackchannelController';
import DanceController from './DanceController';
import HumanoidSyncController from './HumanoidSyncController';
import IdleFidgetController from './IdleFidgetController';

/**
 * AnimationManager - Orchestrates all animation layers
 *
 * Animation Layer System (from bottom to top):
 * Layer 0: Base (idle/walking) - Mixamo FBX clips via LocomotionClipManager (VRMAvatar.tsx)
 * Layer 1: Idle fidget (breathing, micro head drift) - IdleFidgetController
 * Layer 2: Physics (SpringBone) - PhysicsController
 * Layer 3: Expression (facial blending) - ExpressionController + EyeController + LookAtController
 * Layer 4: Dance (rhythm-based movement) - DanceController
 * Layer 5: Final humanoid sync - HumanoidSyncController
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
      {/* Layer 1: Idle fidget - Breathing and micro head drift */}
      {!faceOnlyModeEnabled && <IdleFidgetController />}

      {/* Layer 2: Physics - SpringBone effects for hair/clothing */}
      {physicsEnabled && <PhysicsController />}

      {/* Layer 3: Expression system - Facial expressions and emotions */}
      <ExpressionController />

      {/* Layer 3b: Eye controller - Eye movement and blinking */}
      <EyeController />

      {/* Layer 3c: LookAt controller - Makes avatar look at camera (faceOnlyMode) */}
      <LookAtController />

      {/* Layer 3d: Gaze follow - Cursor tracking + saccade (v2 3순위) */}
      <GazeFollowController />

      {/* Layer 3e: Backchannel - Listening nod (v2 3순위) */}
      <BackchannelController />

      {/* Layer 4: Dance system - Rhythm-based movement */}
      {!faceOnlyModeEnabled && dancingEnabled && <DanceController />}

      {/* Layer 5: Final normalized->raw humanoid sync for VRM compatibility */}
      <HumanoidSyncController />
    </>
  );
}
