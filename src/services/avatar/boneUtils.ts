/**
 * boneUtils — VRM 뼈 조작 유틸리티 (순수 함수)
 *
 * VRMAvatar에서 추출. 뼈 회전/위치 댐핑, 손가락 체인, 힌지 축 감지 등.
 */

import * as THREE from 'three';

export type BoneNode = THREE.Object3D | null | undefined;
export type AxisWeights = { x: number; y: number; z: number };

export const DEFAULT_ELBOW_WEIGHTS: AxisWeights = { x: 0.72, y: 0.08, z: 0.82 };
export const DEFAULT_KNEE_WEIGHTS: AxisWeights = { x: 1.0, y: 0.08, z: 0.22 };

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothStep01(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function wrapPhase01(phase: number): number {
  return ((phase % 1) + 1) % 1;
}

/** 뼈 회전을 목표값으로 지수 댐핑 보간 */
export function dampBoneRotation(
  bone: BoneNode,
  target: { x: number; y?: number; z?: number },
  delta: number,
  stiffness = 13,
): void {
  if (!bone) return;
  const t = 1 - Math.exp(-stiffness * Math.max(delta, 0.001));
  bone.rotation.x += ((target.x ?? bone.rotation.x) - bone.rotation.x) * t;
  bone.rotation.y += ((target.y ?? bone.rotation.y) - bone.rotation.y) * t;
  bone.rotation.z += ((target.z ?? bone.rotation.z) - bone.rotation.z) * t;
}

/** 뼈 위치를 목표값으로 지수 댐핑 보간 */
export function dampBonePosition(
  bone: BoneNode,
  target: { x: number; y?: number; z?: number },
  delta: number,
  stiffness = 13,
): void {
  if (!bone) return;
  const t = 1 - Math.exp(-stiffness * Math.max(delta, 0.001));
  bone.position.x += ((target.x ?? bone.position.x) - bone.position.x) * t;
  bone.position.y += ((target.y ?? bone.position.y) - bone.position.y) * t;
  bone.position.z += ((target.z ?? bone.position.z) - bone.position.z) * t;
}

/** Normalized + Raw 뼈 쌍을 동시에 댐핑 */
export function dampBoneRotationPair(
  normalizedBone: BoneNode,
  rawBone: BoneNode,
  target: { x: number; y?: number; z?: number },
  delta: number,
  stiffness = 13,
): void {
  dampBoneRotation(normalizedBone, target, delta, stiffness);
  if (rawBone && rawBone !== normalizedBone) {
    dampBoneRotation(rawBone, target, delta, stiffness);
  }
}

/** 손가락 3관절 체인 댐핑 */
export function dampFingerChain(
  proximal: BoneNode,
  intermediate: BoneNode,
  distal: BoneNode,
  curl: number,
  spread: number,
  delta: number,
  stiffness: number,
): void {
  dampBoneRotation(proximal, { x: curl, y: spread, z: 0 }, delta, stiffness);
  dampBoneRotation(intermediate, { x: curl * 0.82, y: spread * 0.35, z: 0 }, delta, stiffness);
  dampBoneRotation(distal, { x: curl * 0.64, y: spread * 0.2, z: 0 }, delta, stiffness);
}

/** 엄지 3관절 체인 댐핑 */
export function dampThumbChain(
  proximal: BoneNode,
  intermediate: BoneNode,
  distal: BoneNode,
  curl: number,
  delta: number,
  stiffness: number,
  isLeft: boolean,
): void {
  const side = isLeft ? 1 : -1;
  dampBoneRotation(
    proximal,
    { x: curl * 0.55, y: side * (0.2 - curl * 0.15), z: side * (0.24 + curl * 0.12) },
    delta,
    stiffness,
  );
  dampBoneRotation(
    intermediate,
    { x: curl * 0.75, y: side * 0.08, z: side * 0.06 },
    delta,
    stiffness,
  );
  dampBoneRotation(distal, { x: curl * 0.65, y: side * 0.04, z: 0 }, delta, stiffness);
}

// ─── 힌지 축 감지 ───

function firstChildDirection(bone: BoneNode): THREE.Vector3 | null {
  if (!bone) return null;
  for (const child of bone.children) {
    if (child.position.lengthSq() <= 1e-8) continue;
    return child.position.clone().normalize();
  }
  return null;
}

export function computeHingeAxisWeights(
  bone: BoneNode,
  fallback: AxisWeights,
): AxisWeights {
  const dir = firstChildDirection(bone);
  if (!dir) return fallback;

  const absDir = {
    x: Math.abs(dir.x),
    y: Math.abs(dir.y),
    z: Math.abs(dir.z),
  };
  const raw = {
    x: Math.max(0.16, 1 - absDir.x),
    y: Math.max(0.16, 1 - absDir.y),
    z: Math.max(0.16, 1 - absDir.z),
  };
  const maxWeight = Math.max(raw.x, raw.y, raw.z);
  if (maxWeight <= 1e-6) return fallback;

  return {
    x: lerp(fallback.x, raw.x / maxWeight, 0.65),
    y: lerp(fallback.y, raw.y / maxWeight, 0.65),
    z: lerp(fallback.z, raw.z / maxWeight, 0.65),
  };
}

/** 힌지 관절 타겟 회전 계산 */
export function hingeTarget(
  flex: number,
  side: number,
  weights: AxisWeights,
  base: { x?: number; y?: number; z?: number } = {},
  lateral = 0,
): { x: number; y: number; z: number } {
  const weightedSum = weights.x + weights.y * 0.85 + weights.z * 1.1;
  const norm = weightedSum > 1e-6 ? 1 / weightedSum : 1;

  return {
    x: (base.x ?? 0) + flex * weights.x * norm * 1.8,
    y: (base.y ?? 0) + side * flex * weights.y * norm * 1.25 + lateral * 0.44,
    z: (base.z ?? 0) - side * flex * weights.z * norm * 1.6 + lateral * 0.24,
  };
}
