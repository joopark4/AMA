import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';
import PhysicsController from './PhysicsController';
import ExpressionController from './ExpressionController';
import EyeController from './EyeController';
import LookAtController from './LookAtController';
import GestureController from './GestureController';
import DanceController from './DanceController';
import HumanoidSyncController from './HumanoidSyncController';

/**
 * AnimationManager - Orchestrates all animation layers
 *
 * Animation Layer System (from bottom to top):
 * Layer 0: Base (idle/walking) - handled in VRMAvatar.tsx
 * Layer 1: Physics (SpringBone) - PhysicsController
 * Layer 2: Expression (表情 blending) - ExpressionController + EyeController
 * Layer 3: Gesture (additive blending) - GestureController
 * Layer 4: Dance (highest priority, overrides when active) - DanceController
 *
 * Each layer is responsible for its own blending with the base pose.
 * Higher layers can override or additively blend with lower layers.
 */
export default function AnimationManager() {
  const vrm = useAvatarStore((state) => state.vrm);
  const { settings } = useSettingsStore();

  // Don't render anything if VRM isn't loaded
  if (!vrm) return null;

  const physicsEnabled = settings.avatar?.physics?.enabled ?? true;
  const animationEnabled = settings.avatar?.animation?.enableGestures ?? true;
  const dancingEnabled = settings.avatar?.animation?.enableDancing ?? true;

  return (
    <>
      {/* Layer 1: Physics - SpringBone effects for hair/clothing */}
      {physicsEnabled && <PhysicsController />}

      {/* Layer 2: Expression system - Facial expressions and emotions */}
      <ExpressionController />

      {/* Layer 2b: Eye controller - Eye movement and blinking */}
      <EyeController />

      {/* Layer 2c: LookAt controller - Makes avatar look at camera */}
      <LookAtController />

      {/* Layer 3: Gesture system - Hand waves, nods, etc. */}
      {animationEnabled && <GestureController />}

      {/* Layer 4: Dance system - Rhythm-based movement */}
      {dancingEnabled && <DanceController />}

      {/* Layer 5: Final normalized->raw humanoid sync for VRM compatibility */}
      <HumanoidSyncController />
    </>
  );
}
