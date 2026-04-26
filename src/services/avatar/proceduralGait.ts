/**
 * proceduralGait — 절차적 보행 프로파일 (순수 함수)
 *
 * 각 함수는 gait phase(0~1)를 받아 관절 각도(radian)를 반환.
 * Mixamo 클립 비활성 시 폴백용.
 */

import { wrapPhase01, lerp, smoothStep01 } from './boneUtils';

/** 엉덩이 굴곡: ~-10° ~ 30° */
export function hipFlexFromPhase(phase01: number): number {
  const p = wrapPhase01(phase01);
  return 0.16 + Math.sin(p * Math.PI * 2) * 0.34;
}

/** 무릎 굴곡: stance ~6°, swing ~60° */
export function kneeFlexFromPhase(phase01: number): number {
  const p = wrapPhase01(phase01);
  if (p < 0.12) return lerp(0.10, 0.24, smoothStep01(p / 0.12));
  if (p < 0.50) return lerp(0.24, 0.10, smoothStep01((p - 0.12) / 0.38));
  if (p < 0.72) return lerp(0.10, 1.05, smoothStep01((p - 0.50) / 0.22));
  return lerp(1.05, 0.12, smoothStep01((p - 0.72) / 0.28));
}

/** 팔꿈치 굴곡: 팔 흔들기 사이클 */
export function elbowFlexFromPhase(phase01: number): number {
  const p = wrapPhase01(phase01);
  if (p < 0.35) return lerp(0.34, 0.52, smoothStep01(p / 0.35));
  if (p < 0.70) return lerp(0.52, 0.86, smoothStep01((p - 0.35) / 0.35));
  return lerp(0.86, 0.36, smoothStep01((p - 0.70) / 0.30));
}

/** 발목 피치: contact → mid-stance → push-off → swing */
export function anklePitchFromPhase(phase01: number): number {
  const p = wrapPhase01(phase01);
  if (p < 0.10) return lerp(0.08, -0.04, smoothStep01(p / 0.10));
  if (p < 0.48) return lerp(-0.04, 0.11, smoothStep01((p - 0.10) / 0.38));
  if (p < 0.64) return lerp(0.11, -0.34, smoothStep01((p - 0.48) / 0.16));
  return lerp(-0.34, 0.03, smoothStep01((p - 0.64) / 0.36));
}

/** 발가락 신장: push-off 구간 */
export function toeExtensionFromPhase(phase01: number): number {
  const p = wrapPhase01(phase01);
  if (p < 0.46) return 0;
  if (p < 0.62) return lerp(0, 0.52, smoothStep01((p - 0.46) / 0.16));
  if (p < 0.78) return lerp(0.52, 0.12, smoothStep01((p - 0.62) / 0.16));
  return lerp(0.12, 0, smoothStep01((p - 0.78) / 0.22));
}
