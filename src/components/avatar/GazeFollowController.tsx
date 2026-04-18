import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Object3D, Vector3 } from 'three';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { windowManager } from '../../services/tauri/windowManager';

/**
 * Gaze Follow Controller (v2 — 3순위)
 *
 * 마우스 커서를 아바타 시선이 추적. 커서가 오래 정지하면 saccade jitter로 자연스러움 추가.
 *
 * 구현 노트:
 * - AMA는 투명 오버레이 + 클릭스루 윈도우 → DOM pointermove 이벤트가 인터랙티브 영역에서만
 *   발화해 커서 추적 불가. Rust `get_cursor_position` 커맨드로 네이티브 커서 위치를 폴링.
 * - 100ms 간격 polling으로 CPU 절약 (렌더 lerp가 부드러움을 보완).
 *
 * 동작 조건:
 * - `avatar.animation.gazeFollow` ON
 * - faceOnlyMode가 OFF (faceOnlyMode일 때는 LookAtController가 카메라 응시 유지)
 */

const CURSOR_POLL_INTERVAL_MS = 100;
const CURSOR_OFFSET_SCALE_X = 0.6; // 화면 좌우 끝에서 ±0.6 world unit
const CURSOR_OFFSET_SCALE_Y = 0.3;
const FOLLOW_LERP_RATE = 8;
// VRM lookAt의 range map은 eye bone 회전을 ~4°로 심하게 제한해 체감이 약하다.
// head/neck을 함께 돌려 시각적 feedback을 확보 (VTuber 일반 관행).
const HEAD_YAW_SCALE = 0.40;   // radians (~22.9° at cursor.x=±1)
const HEAD_PITCH_SCALE = 0.20; // ~11.5°
const NECK_YAW_SCALE = 0.20;   // ~11.5°
const NECK_PITCH_SCALE = 0.10; // ~5.7°
const HEAD_BLEND_RATE = 6;
const SACCADE_IDLE_THRESHOLD_MS = 2500;
const SACCADE_INTERVAL_MIN = 2_000;
const SACCADE_INTERVAL_MAX = 4_000;
const SACCADE_JITTER_RANGE = 0.25;
const SACCADE_DURATION_MS = 180;
const CURSOR_MOVE_THRESHOLD_PX = 2; // 이 이하 움직임은 "정지"로 간주

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
  const headYawRef = useRef(0);
  const headPitchRef = useRef(0);
  const lastCursorPxRef = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });
  const lastCursorMoveRef = useRef(performance.now());
  const targetObjRef = useRef(new Object3D());
  const desiredRef = useRef(new Vector3());
  const saccadeOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const saccadeTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const nextSaccadeAtRef = useRef(performance.now() + SACCADE_INTERVAL_MAX);
  const saccadeStartedAtRef = useRef(0);
  const saccadeActiveRef = useRef(false);

  // Rust 커서 polling (클릭스루 윈도우에서도 작동).
  // setInterval 대신 setTimeout 체인 — 이전 polling이 늦으면 호출이 쌓이지 않음.
  useEffect(() => {
    if (!gazeEnabled || faceOnlyModeEnabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const pos = await windowManager.getCursorPosition();
        if (cancelled) return;

        const nx = (pos.x / size.width) * 2 - 1;
        const ny = -((pos.y / size.height) * 2 - 1);
        cursorNormRef.current.x = Math.max(-1, Math.min(1, nx));
        cursorNormRef.current.y = Math.max(-1, Math.min(1, ny));

        const dx = pos.x - lastCursorPxRef.current.x;
        const dy = pos.y - lastCursorPxRef.current.y;
        if (Math.hypot(dx, dy) > CURSOR_MOVE_THRESHOLD_PX) {
          lastCursorMoveRef.current = performance.now();
          saccadeActiveRef.current = false;
          saccadeOffsetRef.current.x = 0;
          saccadeOffsetRef.current.y = 0;
        }
        lastCursorPxRef.current.x = pos.x;
        lastCursorPxRef.current.y = pos.y;
      } catch {
        // Rust 커맨드 실패는 무시 — 다음 체인에서 재시도
      } finally {
        if (!cancelled) {
          timer = setTimeout(poll, CURSOR_POLL_INTERVAL_MS);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
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

    // Saccade: 커서가 정지 상태면 주기적 시선 흔들기
    if (idleMs >= SACCADE_IDLE_THRESHOLD_MS) {
      if (!saccadeActiveRef.current && now >= nextSaccadeAtRef.current) {
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

    const cursor = cursorNormRef.current;
    desiredRef.current.set(
      camera.position.x + cursor.x * CURSOR_OFFSET_SCALE_X + saccadeOffsetRef.current.x,
      camera.position.y + cursor.y * CURSOR_OFFSET_SCALE_Y + saccadeOffsetRef.current.y,
      camera.position.z
    );

    const blend = 1 - Math.exp(-Math.max(0.001, delta) * FOLLOW_LERP_RATE);
    targetObjRef.current.position.lerp(desiredRef.current, blend);
    // Orphan Object3D는 scene graph에 없어 자동 matrix 업데이트가 안 됨.
    // VRMLookAtApplier가 target.getWorldPosition()으로 읽을 때를 대비해 강제 업데이트.
    targetObjRef.current.updateMatrix();
    targetObjRef.current.updateMatrixWorld(true);
    vrm.lookAt.target = targetObjRef.current;

    // Head/Neck 소폭 동시 회전 — VRM eye lookAt의 range map이 회전을 제한하므로
    // 체감 가능한 시선 이동을 위해 헤드/목도 돌려준다 (VTuber 일반 관행).
    // VRM humanoid head 본 convention (사용자 실측 반영):
    //  - rotation.y: + → 아바타가 viewer의 우측을 향함
    //  - rotation.x: + → 아바타가 위를 향함 (뒤로 젖힘)
    const targetHeadYaw = cursor.x * HEAD_YAW_SCALE;
    const targetHeadPitch = cursor.y * HEAD_PITCH_SCALE;
    const hBlend = 1 - Math.exp(-Math.max(0.001, delta) * HEAD_BLEND_RATE);
    headYawRef.current += (targetHeadYaw - headYawRef.current) * hBlend;
    headPitchRef.current += (targetHeadPitch - headPitchRef.current) * hBlend;

    const headBone = vrm.humanoid?.getNormalizedBoneNode?.('head');
    const neckBone = vrm.humanoid?.getNormalizedBoneNode?.('neck');
    if (headBone) {
      // Y-axis rotation for yaw, X-axis for pitch (additive on base rotation).
      headBone.rotation.y += headYawRef.current;
      headBone.rotation.x += headPitchRef.current;
    }
    if (neckBone) {
      neckBone.rotation.y += headYawRef.current * (NECK_YAW_SCALE / HEAD_YAW_SCALE);
      neckBone.rotation.x += headPitchRef.current * (NECK_PITCH_SCALE / HEAD_PITCH_SCALE);
    }
  });

  return null;
}
