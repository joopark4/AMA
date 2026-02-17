import { useRef, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';

type JointSettingsLike = {
  gravityPower?: number;
  gravityDir?: {
    x: number;
    y: number;
    z: number;
    set?: (x: number, y: number, z: number) => void;
    copy?: (source: THREE.Vector3) => void;
    normalize?: () => void;
  };
};

type JointLike = {
  settings?: JointSettingsLike;
};

const _targetGravityDir = new THREE.Vector3();
const MAX_VELOCITY_PX_PER_SEC = 1400;
const VELOCITY_SMOOTHING = 0.24;
const SWAY_DENOMINATOR = 980;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getSpringJoints(springBoneManager: unknown): JointLike[] {
  if (!springBoneManager || typeof springBoneManager !== 'object') return [];

  const result: JointLike[] = [];
  const manager = springBoneManager as {
    joints?: JointLike[];
    springBones?: Array<{ joints?: JointLike[] }>;
  };

  if (Array.isArray(manager.joints)) {
    result.push(...manager.joints.filter(Boolean));
  }

  if (Array.isArray(manager.springBones)) {
    for (const springBone of manager.springBones) {
      if (!springBone || !Array.isArray(springBone.joints)) continue;
      result.push(...springBone.joints.filter(Boolean));
    }
  }

  // Deduplicate by object identity.
  return Array.from(new Set(result));
}

export default function PhysicsController() {
  const vrm = useAvatarStore((state) => state.vrm);
  const position = useAvatarStore((state) => state.position);
  const isMoving = useAvatarStore((state) => state.isMoving);
  const { settings } = useSettingsStore();

  const prevPositionRef = useRef({ x: position.x, y: position.y });
  const velocityRef = useRef({ x: 0, y: 0 });
  const baseSettingsRef = useRef(
    new Map<
      JointSettingsLike,
      { gravityPower: number; gravityDir: THREE.Vector3 | null }
    >()
  );

  const restoreBaseSettings = useCallback(() => {
    for (const [jointSettings, base] of baseSettingsRef.current.entries()) {
      jointSettings.gravityPower = base.gravityPower;
      if (jointSettings.gravityDir && base.gravityDir) {
        if (typeof jointSettings.gravityDir.copy === 'function') {
          jointSettings.gravityDir.copy(base.gravityDir);
        } else if (typeof jointSettings.gravityDir.set === 'function') {
          jointSettings.gravityDir.set(base.gravityDir.x, base.gravityDir.y, base.gravityDir.z);
        } else {
          jointSettings.gravityDir.x = base.gravityDir.x;
          jointSettings.gravityDir.y = base.gravityDir.y;
          jointSettings.gravityDir.z = base.gravityDir.z;
          jointSettings.gravityDir.normalize?.();
        }
      }
    }
  }, []);

  useEffect(() => () => restoreBaseSettings(), [restoreBaseSettings]);

  useFrame((_, delta) => {
    if (!vrm) return;

    const physicsSettings = settings.avatar?.physics;
    if (!physicsSettings?.enabled) {
      restoreBaseSettings();
      return;
    }

    // Calculate velocity from position change
    const dx = position.x - prevPositionRef.current.x;
    const dy = position.y - prevPositionRef.current.y;

    // Smooth velocity
    const dt = Math.max(delta, 0.001);
    const rawVelocityX = clamp(dx / dt, -MAX_VELOCITY_PX_PER_SEC, MAX_VELOCITY_PX_PER_SEC);
    const rawVelocityY = clamp(dy / dt, -MAX_VELOCITY_PX_PER_SEC, MAX_VELOCITY_PX_PER_SEC);
    velocityRef.current.x =
      velocityRef.current.x * (1 - VELOCITY_SMOOTHING) + rawVelocityX * VELOCITY_SMOOTHING;
    velocityRef.current.y =
      velocityRef.current.y * (1 - VELOCITY_SMOOTHING) + rawVelocityY * VELOCITY_SMOOTHING;

    prevPositionRef.current = { x: position.x, y: position.y };

    // Access SpringBoneManager from VRM
    const springBoneManager = (vrm as any).springBoneManager;
    if (!springBoneManager) return;

    const joints = getSpringJoints(springBoneManager);
    if (joints.length === 0) return;

    const gravityMultiplier = physicsSettings.gravityMultiplier ?? 1.0;
    const stiffnessMultiplier = physicsSettings.stiffnessMultiplier ?? 1.0;
    const movementInfluence = clamp(Math.abs(velocityRef.current.x) / 480, 0, 1);
    const walkingBoost = isMoving ? 1 + movementInfluence * 0.2 : 1;
    const swayX = clamp(
      (-velocityRef.current.x / SWAY_DENOMINATOR) * stiffnessMultiplier,
      -0.3,
      0.3
    );

    for (const joint of joints) {
      if (!joint?.settings) continue;
      const jointSettings = joint.settings;

      if (!baseSettingsRef.current.has(jointSettings)) {
        baseSettingsRef.current.set(jointSettings, {
          gravityPower: jointSettings.gravityPower ?? 0,
          gravityDir: jointSettings.gravityDir
            ? new THREE.Vector3(
              jointSettings.gravityDir.x,
              jointSettings.gravityDir.y,
              jointSettings.gravityDir.z
            )
            : null,
        });
      }

      const baseSettings = baseSettingsRef.current.get(jointSettings);
      if (!baseSettings) continue;

      jointSettings.gravityPower =
        baseSettings.gravityPower * gravityMultiplier * walkingBoost;

      if (jointSettings.gravityDir && baseSettings.gravityDir) {
        _targetGravityDir.copy(baseSettings.gravityDir);
        _targetGravityDir.x += swayX;
        _targetGravityDir.normalize();

        if (typeof jointSettings.gravityDir.copy === 'function') {
          jointSettings.gravityDir.copy(_targetGravityDir);
        } else if (typeof jointSettings.gravityDir.set === 'function') {
          jointSettings.gravityDir.set(
            _targetGravityDir.x,
            _targetGravityDir.y,
            _targetGravityDir.z
          );
        } else {
          jointSettings.gravityDir.x = _targetGravityDir.x;
          jointSettings.gravityDir.y = _targetGravityDir.y;
          jointSettings.gravityDir.z = _targetGravityDir.z;
          jointSettings.gravityDir.normalize?.();
        }
      }
    }
  });

  return null;
}
