import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEffect } from 'react';
import PhysicsController from './PhysicsController';
import ExpressionController from './ExpressionController';
import EyeController from './EyeController';
import LookAtController from './LookAtController';
import GestureController from './GestureController';
import ClipMotionController from './ClipMotionController';
import MotionSequenceDemoController from './MotionSequenceDemoController';
import DanceController from './DanceController';
import HumanoidSyncController from './HumanoidSyncController';

/**
 * AnimationManager - Orchestrates all animation layers
 *
 * Animation Layer System (from bottom to top):
 * Layer 0: Base (idle/walking) - handled in VRMAvatar.tsx
 * Layer 1: Physics (SpringBone) - PhysicsController
 * Layer 2: Expression (表情 blending) - ExpressionController + EyeController
 * Layer 3: Clip motion (priority) - ClipMotionController
 * Layer 4: Gesture (fallback additive blending) - GestureController
 * Layer 5: Dance (highest priority, overrides when active) - DanceController
 *
 * Each layer is responsible for its own blending with the base pose.
 * Higher layers can override or additively blend with lower layers.
 */
export default function AnimationManager() {
  const vrm = useAvatarStore((state) => state.vrm);
  const { settings } = useSettingsStore();
  const resetGestures = useAvatarStore((state) => state.resetGestures);
  const resetMotionState = useAvatarStore((state) => state.resetMotionState);
  const stopMotionSequenceDemo = useAvatarStore((state) => state.stopMotionSequenceDemo);
  const stopDancing = useAvatarStore((state) => state.stopDancing);
  const isDevBuild = import.meta.env.DEV;

  const physicsEnabled = settings.avatar?.physics?.enabled ?? true;
  const animationEnabled = settings.avatar?.animation?.enableGestures ?? true;
  const clipMotionEnabled = settings.avatar?.animation?.enableMotionClips ?? true;
  const dancingEnabled = settings.avatar?.animation?.enableDancing ?? true;
  const faceOnlyModeEnabled =
    settings.avatar?.animation?.faceExpressionOnlyMode ?? false;

  useEffect(() => {
    if (!faceOnlyModeEnabled) return;

    resetGestures();
    resetMotionState();
    stopMotionSequenceDemo();
    stopDancing();
  }, [
    faceOnlyModeEnabled,
    resetGestures,
    resetMotionState,
    stopMotionSequenceDemo,
    stopDancing,
  ]);

  useEffect(() => {
    if (clipMotionEnabled) return;

    resetMotionState();
    stopMotionSequenceDemo();
  }, [clipMotionEnabled, resetMotionState, stopMotionSequenceDemo]);

  // Don't render anything if VRM isn't loaded
  if (!vrm) return null;

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

      {/* Layer 3: Manifest-driven clip motions */}
      {!faceOnlyModeEnabled && clipMotionEnabled && <ClipMotionController />}
      {!faceOnlyModeEnabled && isDevBuild && <MotionSequenceDemoController />}

      {/* Layer 4: Fallback gesture system - Hand waves, nods, etc. */}
      {!faceOnlyModeEnabled && animationEnabled && <GestureController />}

      {/* Layer 5: Dance system - Rhythm-based movement */}
      {!faceOnlyModeEnabled && dancingEnabled && <DanceController />}

      {/* Layer 6: Final normalized->raw humanoid sync for VRM compatibility */}
      <HumanoidSyncController />
    </>
  );
}
