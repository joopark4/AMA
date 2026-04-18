import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Object3D, Vector3 } from 'three';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Gaze Follow Controller (v2 — 3순위)
 *
 * 마우스 커서를 아바타 시선이 추적. 커서가 오래 정지하면 saccade jitter로 자연스러움 추가.
 *
 * 동작 조건:
 * - `avatar.animation.gazeFollow` 설정 ON (기본 true)
 * - faceOnlyMode가 OFF일 때만 활성 (faceOnlyMode에서는 LookAtController가 카메라 응시 유지)
 */

const CURSOR_OFFSET_SCALE_X = 0.6; // 화면 좌우 끝에서 ±0.6 world unit
const CURSOR_OFFSET_SCALE_Y = 0.3;
const FOLLOW_LERP_RATE = 8; // 시선 이동 속도 (높을수록 빠름)
const SACCADE_IDLE_THRESHOLD_MS = 2500; // 커서 정지 후 saccade 시작
const SACCADE_INTERVAL_MIN = 2_000;
const SACCADE_INTERVAL_MAX = 4_000;
const SACCADE_JITTER_RANGE = 0.25; // world unit (±)
const SACCADE_DURATION_MS = 180;

export default function GazeFollowController() {
  const vrm = useAvatarStore((state) => state.vrm);
  const { camera, size } = useThree();
  const gazeEnabled = useSettingsStore(
    (state) => state.settings.avatar?.animation?.gazeFollow ?? true
  );
  const faceOnlyModeEnabled = useSettingsStore(
    (state) => state.settings.avatar?.animation?.faceExpressionOnlyMode ?? false
  );

  const cursorNormRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastCursorMoveRef = useRef(performance.now());
  const targetObjRef = useRef(new Object3D());
  const desiredRef = useRef(new Vector3());
  const saccadeOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const saccadeTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const nextSaccadeAtRef = useRef(performance.now() + SACCADE_INTERVAL_MAX);
  const saccadeStartedAtRef = useRef(0);
  const saccadeActiveRef = useRef(false);

  useEffect(() => {
    if (!gazeEnabled || faceOnlyModeEnabled) return;

    const handleMove = (e: PointerEvent) => {
      // normalized device coords (-1..+1)
      const nx = (e.clientX / size.width) * 2 - 1;
      const ny = -((e.clientY / size.height) * 2 - 1);
      cursorNormRef.current.x = Math.max(-1, Math.min(1, nx));
      cursorNormRef.current.y = Math.max(-1, Math.min(1, ny));
      lastCursorMoveRef.current = performance.now();
      saccadeActiveRef.current = false;
      saccadeOffsetRef.current.x = 0;
      saccadeOffsetRef.current.y = 0;
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handleMove);
    };
  }, [gazeEnabled, faceOnlyModeEnabled, size]);

  // 비활성화 시 target 해제
  useEffect(() => {
    if ((!gazeEnabled || faceOnlyModeEnabled) && vrm?.lookAt) {
      vrm.lookAt.target = null;
    }
  }, [gazeEnabled, faceOnlyModeEnabled, vrm]);

  useFrame((_, delta) => {
    if (!vrm?.lookAt || !gazeEnabled || faceOnlyModeEnabled) return;

    const now = performance.now();
    const idleMs = now - lastCursorMoveRef.current;

    // Saccade: 커서가 SACCADE_IDLE_THRESHOLD_MS 이상 정지 시 주기적 시선 흔들기
    if (idleMs >= SACCADE_IDLE_THRESHOLD_MS) {
      if (!saccadeActiveRef.current && now >= nextSaccadeAtRef.current) {
        // 새 saccade 타겟 설정
        saccadeTargetRef.current.x = (Math.random() - 0.5) * 2 * SACCADE_JITTER_RANGE;
        saccadeTargetRef.current.y = (Math.random() - 0.5) * 2 * SACCADE_JITTER_RANGE;
        saccadeActiveRef.current = true;
        saccadeStartedAtRef.current = now;
        const interval = SACCADE_INTERVAL_MIN + Math.random() * (SACCADE_INTERVAL_MAX - SACCADE_INTERVAL_MIN);
        nextSaccadeAtRef.current = now + interval;
      }

      if (saccadeActiveRef.current) {
        const progress = Math.min(1, (now - saccadeStartedAtRef.current) / SACCADE_DURATION_MS);
        saccadeOffsetRef.current.x =
          saccadeOffsetRef.current.x + (saccadeTargetRef.current.x - saccadeOffsetRef.current.x) * progress;
        saccadeOffsetRef.current.y =
          saccadeOffsetRef.current.y + (saccadeTargetRef.current.y - saccadeOffsetRef.current.y) * progress;
        if (progress >= 1) saccadeActiveRef.current = false;
      }
    }

    // 시선 타겟 = 카메라 위치 + 커서 오프셋 + saccade jitter
    const cursor = cursorNormRef.current;
    desiredRef.current.set(
      camera.position.x + cursor.x * CURSOR_OFFSET_SCALE_X + saccadeOffsetRef.current.x,
      camera.position.y + cursor.y * CURSOR_OFFSET_SCALE_Y + saccadeOffsetRef.current.y,
      camera.position.z
    );

    // frame-rate 독립 lerp
    const blend = 1 - Math.exp(-Math.max(0.001, delta) * FOLLOW_LERP_RATE);
    targetObjRef.current.position.lerp(desiredRef.current, blend);
    vrm.lookAt.target = targetObjRef.current;
  });

  return null;
}
