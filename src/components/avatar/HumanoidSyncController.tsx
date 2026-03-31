import { useFrame } from '@react-three/fiber';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';

const SYNC_BONES = [
  'hips',
  'spine',
  'chest',
  'upperChest',
  'neck',
  'head',
  'leftShoulder',
  'rightShoulder',
  'leftUpperArm',
  'rightUpperArm',
  'leftLowerArm',
  'rightLowerArm',
  'leftHand',
  'rightHand',
  'leftUpperLeg',
  'rightUpperLeg',
  'leftLowerLeg',
  'rightLowerLeg',
  'leftFoot',
  'rightFoot',
  'leftToes',
  'rightToes',
  'leftThumbProximal',
  'leftThumbIntermediate',
  'leftThumbDistal',
  'rightThumbProximal',
  'rightThumbIntermediate',
  'rightThumbDistal',
  'leftIndexProximal',
  'leftIndexIntermediate',
  'leftIndexDistal',
  'rightIndexProximal',
  'rightIndexIntermediate',
  'rightIndexDistal',
  'leftMiddleProximal',
  'leftMiddleIntermediate',
  'leftMiddleDistal',
  'rightMiddleProximal',
  'rightMiddleIntermediate',
  'rightMiddleDistal',
  'leftRingProximal',
  'leftRingIntermediate',
  'leftRingDistal',
  'rightRingProximal',
  'rightRingIntermediate',
  'rightRingDistal',
  'leftLittleProximal',
  'leftLittleIntermediate',
  'leftLittleDistal',
  'rightLittleProximal',
  'rightLittleIntermediate',
  'rightLittleDistal',
] as const;

/**
 * Some VRM models only render movement from raw bones even when normalized bones change.
 * This final sync layer mirrors normalized pose to raw bones for key motion joints.
 *
 * Mixamo AnimationMixer가 활성화되어 있으면 mixer가 직접 raw 뼈를 제어하므로
 * 이 동기화를 스킵한다 — 두 소스가 동시에 raw 뼈를 설정하면 떨림이 발생한다.
 */
export default function HumanoidSyncController() {
  const vrm = useAvatarStore((state) => state.vrm);
  const enableMotionClips = useSettingsStore((s) => s.settings.avatar?.animation?.enableMotionClips ?? true);

  useFrame(() => {
    if (!vrm?.humanoid) return;

    // Mixamo 클립이 활성화되어 있으면 mixer가 뼈를 직접 제어 — 동기화 스킵
    if (enableMotionClips) return;

    const humanoid = vrm.humanoid as any;
    if (typeof humanoid.getRawBoneNode !== 'function') return;

    for (const boneName of SYNC_BONES) {
      const normalizedNode = vrm.humanoid.getNormalizedBoneNode(boneName as any);
      const rawNode = humanoid.getRawBoneNode(boneName as any);

      if (!normalizedNode || !rawNode || normalizedNode === rawNode) continue;
      rawNode.quaternion.copy(normalizedNode.quaternion);
    }
  });

  return null;
}
