import { useFrame } from '@react-three/fiber';
import { useAvatarStore } from '../../stores/avatarStore';

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
 */
export default function HumanoidSyncController() {
  const vrm = useAvatarStore((state) => state.vrm);

  useFrame(() => {
    if (!vrm?.humanoid) return;

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
