/**
 * Mixamo FBX 애니메이션을 VRM용 AnimationClip으로 변환
 * 출처: pixiv/three-vrm 공식 예제 (loadMixamoAnimation.js)
 * TypeScript 변환 + 루트 모션 제거 옵션 추가
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { mixamoVRMRigMap } from './mixamoVRMRigMap';

export interface LoadMixamoAnimationOptions {
  /** 클립 이름 (기본: FBX 파일명 기반) */
  clipName?: string;
  /** hips 위치 트랙에서 XZ 이동 제거 (제자리 걸음) */
  removeRootMotion?: boolean;
}

/**
 * Mixamo FBX URL → VRM AnimationClip 변환
 */
export async function loadMixamoAnimation(
  url: string,
  vrm: VRM,
  options: LoadMixamoAnimationOptions = {},
): Promise<THREE.AnimationClip> {
  const loader = new FBXLoader();
  // URL 경로의 공백 등 특수문자를 인코딩 (Tauri 프로덕션 프로토콜 호환)
  const safeUrl = url.split('/').map((seg) => encodeURIComponent(seg)).join('/');
  const asset = await loader.loadAsync(safeUrl);
  return convertMixamoAnimation(asset, vrm, options);
}

/**
 * 이미 로드된 FBX Group → VRM AnimationClip 변환
 */
export function convertMixamoAnimation(
  asset: THREE.Group,
  vrm: VRM,
  options: LoadMixamoAnimationOptions = {},
): THREE.AnimationClip {
  const clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com');
  if (!clip) {
    throw new Error('FBX에서 "mixamo.com" 애니메이션 클립을 찾을 수 없습니다');
  }

  const tracks: THREE.KeyframeTrack[] = [];
  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const _quatA = new THREE.Quaternion();

  // hips 높이 비율 계산 (VRM / Mixamo)
  const mixamoHips = asset.getObjectByName('mixamorigHips');
  const motionHipsHeight = mixamoHips ? mixamoHips.position.y : 1;
  const restPose = (vrm.humanoid as any).normalizedRestPose ?? (vrm.humanoid as any).restPose;
  const vrmHipsHeight = restPose?.hips?.position?.[1] ?? 1;
  const hipsPositionScale = vrmHipsHeight / motionHipsHeight;

  const removeRootMotion = options.removeRootMotion ?? true;

  clip.tracks.forEach((track) => {
    const trackSplitted = track.name.split('.');
    const mixamoRigName = trackSplitted[0];
    const vrmBoneName = mixamoVRMRigMap[mixamoRigName];
    if (!vrmBoneName) return;

    const vrmNode = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName as VRMHumanBoneName);
    const vrmNodeName = vrmNode?.name;
    const mixamoRigNode = asset.getObjectByName(mixamoRigName);
    if (!vrmNodeName || !mixamoRigNode) return;

    const propertyName = trackSplitted[1];

    // Rest-pose 회전 보정 값 계산
    mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
    mixamoRigNode.parent?.getWorldQuaternion(parentRestWorldRotation);

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      // 회전 트랙: rest-pose 보정
      for (let i = 0; i < track.values.length; i += 4) {
        const flatQuaternion = track.values.slice(i, i + 4);
        _quatA.fromArray(flatQuaternion);
        _quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse);
        _quatA.toArray(flatQuaternion);
        flatQuaternion.forEach((v, index) => {
          track.values[index + i] = v;
        });
      }

      // VRM 0.x 좌표계 반전 처리
      const isVRM0 = (vrm.meta as any)?.metaVersion === '0';
      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${vrmNodeName}.${propertyName}`,
          track.times as any,
          track.values.map((v, i) => (isVRM0 && i % 2 === 0 ? -v : v)) as any,
        ),
      );
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      // 위치 트랙 (주로 hips)
      const isVRM0 = (vrm.meta as any)?.metaVersion === '0';
      const value = track.values.map((v, i) => {
        const axis = i % 3; // 0=x, 1=y, 2=z
        // 루트 모션 제거: hips의 XZ 이동을 0으로
        if (removeRootMotion && vrmBoneName === 'hips' && axis !== 1) {
          return 0;
        }
        return (isVRM0 && axis !== 1 ? -v : v) * hipsPositionScale;
      });
      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${vrmNodeName}.${propertyName}`,
          track.times as any,
          value as any,
        ),
      );
    }
  });

  const clipName = options.clipName ?? 'vrmAnimation';
  return new THREE.AnimationClip(clipName, clip.duration, tracks);
}
