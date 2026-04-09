import { useEffect, useRef, useCallback } from 'react';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
import {
  useAvatarStore,
  type AvatarInteractionBounds,
  type Emotion,
} from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getEmotionTuning } from '../../config/emotionTuning';
import { loadDefaultVrmBuffer, isDefaultVrmAvailable } from '../../services/tauri/defaultVrm';
import { LocomotionClipManager } from '../../services/avatar/locomotionClipManager';
import {
  type BoneNode, type AxisWeights,
  DEFAULT_ELBOW_WEIGHTS, DEFAULT_KNEE_WEIGHTS,
  clamp, wrapPhase01,
  dampBoneRotation, dampBonePosition, dampBoneRotationPair,
  dampFingerChain, dampThumbChain,
  computeHingeAxisWeights, hingeTarget,
} from '../../services/avatar/boneUtils';
import {
  hipFlexFromPhase, kneeFlexFromPhase, elbowFlexFromPhase,
  anklePitchFromPhase, toeExtensionFromPhase,
} from '../../services/avatar/proceduralGait';
import {
  isLocalFileSource, toFsReadTarget, resolveModelUrl,
} from '../../services/avatar/vrmUrlUtils';

// Helper function to log to terminal
const logToTerminal = (message: string) => {
  invoke('log_to_terminal', { message }).catch(console.error);
};

const GROUND_MARGIN_PX = 8;
const VISIBILITY_RECOVERY_COOLDOWN_MS = 1200;
const MAX_GROUND_SOLVE_RETRIES = 120;
const IDLE_YAW = Math.PI;
// 좌우 비대칭 회전 — 카메라 각도 보정
const RIGHT_WALK_YAW = Math.PI + 1.40; // 오른쪽 (~80°)
const LEFT_WALK_YAW = Math.PI - 0.70;  // 왼쪽 (~40°)
const POSITION_JITTER_EPSILON = 0.45;
const LOCOMOTION_START_SPEED = 24;
const LOCOMOTION_STOP_SPEED = 10;
const IDLE_SPEED_SNAP = 4;
const STRIDE_LENGTH_PX = 80; // 한 걸음(반 사이클)에 이동하는 화면 픽셀 수
const ENABLE_JOINT_DEBUG = false;
const DIAGNOSTIC_BONES = [
  'hips',
  'spine',
  'chest',
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
] as const;

const FACE_ONLY_HEAD_POSE: Record<Emotion, { x: number; y: number; z: number }> = {
  neutral: { x: 0, y: 0, z: 0 },
  happy: { x: -0.06, y: 0.08, z: 0.02 },
  sad: { x: 0.1, y: -0.05, z: -0.03 },
  angry: { x: -0.03, y: 0.12, z: 0 },
  surprised: { x: -0.13, y: 0, z: 0.02 },
  relaxed: { x: -0.01, y: 0.03, z: 0.03 },
  thinking: { x: 0.07, y: 0.17, z: 0.08 },
};

const STYLE_GAIT = {
  stroll: { cadence: 0.95, leg: 0.9, arm: 0.85, bounce: 0.8, sway: 0.9 },
  brisk: { cadence: 1.25, leg: 1.15, arm: 1.08, bounce: 1.0, sway: 0.75 },
  sneak: { cadence: 0.72, leg: 0.58, arm: 0.5, bounce: 0.45, sway: 0.55 },
  bouncy: { cadence: 1.05, leg: 1.0, arm: 1.0, bounce: 1.35, sway: 1.1 },
} as const;

// AxisWeights, DEFAULT_*_WEIGHTS → boneUtils.ts
// URL 유틸리티 → vrmUrlUtils.ts
// 보행 프로파일 → proceduralGait.ts
// 뼈 유틸리티 → boneUtils.ts

export default function VRMAvatar() {
  type HingeProfile = {
    leftElbow: AxisWeights;
    rightElbow: AxisWeights;
    leftKnee: AxisWeights;
    rightKnee: AxisWeights;
  };

  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const modelMinYRef = useRef(-1.0);
  const interactionBoxRef = useRef(new THREE.Box3());
  const interactionCornersRef = useRef(
    Array.from({ length: 8 }, () => new THREE.Vector3())
  );
  const projectedCornerRef = useRef(new THREE.Vector3());
  const lastInteractionBoundsRef = useRef<AvatarInteractionBounds | null>(null);
  const lastVisibilityRecoveryAtRef = useRef(0);
  const ndcProbeRef = useRef(new THREE.Vector3());
  const unprojectedProbeRef = useRef(new THREE.Vector3());
  const rayDirectionProbeRef = useRef(new THREE.Vector3());
  const worldProbeRef = useRef(new THREE.Vector3());
  const prevScreenPosRef = useRef<{ x: number; y: number } | null>(null);
  const movementSpeedRef = useRef(0);
  const gaitPhaseRef = useRef(Math.random() * Math.PI * 2);
  const locomotionBlendRef = useRef(0);
  const locomotionLatchRef = useRef(false);
  const smoothedYawRef = useRef(IDLE_YAW);
  const stepAccentRef = useRef(Math.random() * Math.PI * 2);
  const lastJointDebugAtRef = useRef(0);
  const hingeProfileRef = useRef<HingeProfile | null>(null);
  const hingeProfileLoggedRef = useRef(false);
  const hasAppliedInitialViewRef = useRef(false);
  const locomotionClipRef = useRef<LocomotionClipManager | null>(null);
  const useClipLocomotion = useRef(true);
  const restHipsPositionRef = useRef<{ x: number; y: number; z: number } | null>(null);

  // ─── 뼈 노드 캐시 (매 프레임 getNormalizedBoneNode 호출 제거) ───
  const boneCacheRef = useRef<Record<string, BoneNode>>({});
  const rawBoneCacheRef = useRef<Record<string, BoneNode>>({});

  const { gl, camera } = useThree();

  const {
    setVRM,
    setIsLoading,
    setLoadError,
    setGroundY,
    setInteractionBounds,
    position,
    targetPosition,
    setPosition,
    emotion,
    facingRight,
    isMoving,
    animationState,
    locomotionStyle,
    isDancing,
    currentGesture,
    isDragging,
    setIsDragging,
    isRotating,
    setIsRotating,
    manualRotation,
    setManualRotation,
    bounds,
  } = useAvatarStore();

  const prevEmotionRef = useRef(emotion);

  // ─── 감정 변경 시 Mixamo 제스처 트리거 (감정이 실제로 바뀔 때만) ───
  useEffect(() => {
    if (prevEmotionRef.current === emotion) return;
    prevEmotionRef.current = emotion;

    const clipMgr = locomotionClipRef.current;
    const isFaceOnly = useSettingsStore.getState().settings.avatar?.animation?.faceExpressionOnlyMode ?? false;
    if (!clipMgr || isFaceOnly) return;

    // 감정별 제스처 매핑 (idle 상태에서만 one-shot 재생)
    const gestureMap: Partial<Record<string, string>> = {
      happy: 'celebrate',
      surprised: 'jump',
      angry: 'shake',
    };

    const currentlyMoving = useAvatarStore.getState().isMoving;
    const gesture = gestureMap[emotion];
    if (gesture && !currentlyMoving) {
      clipMgr.playGesture(gesture);
    }
  }, [emotion]); // isMoving 의존성 제거 — 감정 변경 시에만 트리거

  // ─── avatarStore.currentGesture → Mixamo 제스처 재생 ───
  const prevGestureRef = useRef(currentGesture);
  const gestureClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!currentGesture || currentGesture === prevGestureRef.current) {
      prevGestureRef.current = currentGesture;
      return;
    }
    prevGestureRef.current = currentGesture;

    const clipMgr = locomotionClipRef.current;
    if (!clipMgr) return;

    const gestureToClip: Record<string, string> = {
      wave: 'wave', nod: 'nod', shake: 'shake', shrug: 'shrug',
      celebrate: 'celebrate', thinking: 'nod', jump: 'jump',
    };

    const clipName = gestureToClip[currentGesture];
    if (clipName) {
      clipMgr.playGesture(clipName);
      if (gestureClearTimerRef.current) clearTimeout(gestureClearTimerRef.current);
      gestureClearTimerRef.current = setTimeout(() => {
        useAvatarStore.getState().clearGesture();
        gestureClearTimerRef.current = null;
      }, 3000);
    }

    return () => {
      if (gestureClearTimerRef.current) {
        clearTimeout(gestureClearTimerRef.current);
        gestureClearTimerRef.current = null;
      }
    };
  }, [currentGesture]);

  // Drag state refs
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  const rotationStartRef = useRef({ x: 0, y: 0 });

  const { settings, setAvatarSettings } = useSettingsStore();
  const vrm = useAvatarStore((state) => state.vrm);
  const faceOnlyModeEnabled =
    settings.avatar?.animation?.faceExpressionOnlyMode ?? false;

  useEffect(() => {
    hasAppliedInitialViewRef.current = false;
  }, [settings.vrmModelPath]);

  useEffect(() => {
    if (!vrm || hasAppliedInitialViewRef.current) return;

    const saved = settings.avatar?.initialViewRotation;
    const nextX = clamp(saved?.x ?? 0, -0.5, 0.5);
    const nextY = Number.isFinite(saved?.y) ? (saved?.y as number) : 0;

    setManualRotation({ x: nextX, y: nextY });
    hasAppliedInitialViewRef.current = true;
  }, [
    vrm,
    settings.avatar?.initialViewRotation?.x,
    settings.avatar?.initialViewRotation?.y,
    setManualRotation,
  ]);

  const screenToWorldAtZ = useCallback((screenX: number, screenY: number, targetZ = 0) => {
    const canvas = gl.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    if (width <= 0 || height <= 0) return null;

    const ndc = ndcProbeRef.current.set(
      (screenX / width) * 2 - 1,
      -((screenY / height) * 2 - 1),
      0.5
    );
    const unprojected = unprojectedProbeRef.current.copy(ndc).unproject(camera);
    const rayDirection = rayDirectionProbeRef.current.copy(unprojected).sub(camera.position);

    if (!Number.isFinite(rayDirection.z) || Math.abs(rayDirection.z) < 1e-6) return null;

    const t = (targetZ - camera.position.z) / rayDirection.z;
    if (!Number.isFinite(t)) return null;

    const world = worldProbeRef.current
      .copy(camera.position)
      .add(rayDirection.multiplyScalar(t));

    if (!Number.isFinite(world.x) || !Number.isFinite(world.y) || !Number.isFinite(world.z)) {
      return null;
    }

    return { x: world.x, y: world.y, z: world.z };
  }, [camera, gl.domElement]);

  const positionToRootWorldY = useCallback((posY: number): number | null => {
    const world = screenToWorldAtZ(0, posY, 0);
    return world?.y ?? null;
  }, [screenToWorldAtZ]);

  const feetScreenYFromPosition = useCallback((posY: number, scale: number): number | null => {
    const canvas = gl.domElement;
    const height = canvas.clientHeight || window.innerHeight;
    if (height <= 0) return null;

    const rootWorldY = positionToRootWorldY(posY);
    if (rootWorldY === null) return null;
    const feetWorldY = rootWorldY + modelMinYRef.current * scale;
    const feetPoint = new THREE.Vector3(0, feetWorldY, 0);
    feetPoint.project(camera);

    return ((-feetPoint.y + 1) * 0.5) * height;
  }, [camera, gl.domElement, positionToRootWorldY]);

  const solveGroundPositionY = useCallback((scale: number): number | null => {
    const canvas = gl.domElement;
    const height = canvas.clientHeight || window.innerHeight;
    if (height <= 0) return null;

    const targetFeetScreenY = height - GROUND_MARGIN_PX;
    let low = -height;
    let high = height * 2;

    for (let i = 0; i < 28; i++) {
      const mid = (low + high) / 2;
      const feetScreenY = feetScreenYFromPosition(mid, scale);
      if (feetScreenY === null) return null;

      if (feetScreenY < targetFeetScreenY) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return Math.max(0, Math.min(height, (low + high) / 2));
  }, [feetScreenYFromPosition, gl.domElement]);

  const publishInteractionBounds = useCallback(() => {
    const group = groupRef.current;
    if (!group) {
      if (lastInteractionBoundsRef.current !== null) {
        lastInteractionBoundsRef.current = null;
        setInteractionBounds(null);
      }
      return;
    }

    const canvas = gl.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    if (width <= 0 || height <= 0) return;

    const boundsBox = interactionBoxRef.current.setFromObject(group);
    if (boundsBox.isEmpty()) return;

    const min = boundsBox.min;
    const max = boundsBox.max;
    const corners = interactionCornersRef.current;
    corners[0].set(min.x, min.y, min.z);
    corners[1].set(min.x, min.y, max.z);
    corners[2].set(min.x, max.y, min.z);
    corners[3].set(min.x, max.y, max.z);
    corners[4].set(max.x, min.y, min.z);
    corners[5].set(max.x, min.y, max.z);
    corners[6].set(max.x, max.y, min.z);
    corners[7].set(max.x, max.y, max.z);

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const corner of corners) {
      const projected = projectedCornerRef.current.copy(corner).project(camera);
      if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) continue;

      const screenX = (projected.x * 0.5 + 0.5) * width;
      const screenY = (-projected.y * 0.5 + 0.5) * height;

      minX = Math.min(minX, screenX);
      minY = Math.min(minY, screenY);
      maxX = Math.max(maxX, screenX);
      maxY = Math.max(maxY, screenY);
    }

    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(maxY)
    ) {
      return;
    }

    const padX = Math.max(16, width * 0.012);
    const padY = Math.max(24, height * 0.02);

    const nextBounds: AvatarInteractionBounds = {
      left: Math.max(0, minX - padX),
      right: Math.min(width, maxX + padX),
      top: Math.max(0, minY - padY),
      bottom: Math.min(height, maxY + padY),
    };

    const rawWidth = Math.max(1, maxX - minX);
    const rawHeight = Math.max(1, maxY - minY);
    const rawArea = rawWidth * rawHeight;
    const visibleWidth = Math.max(
      0,
      Math.min(width, nextBounds.right) - Math.max(0, nextBounds.left)
    );
    const visibleHeight = Math.max(
      0,
      Math.min(height, nextBounds.bottom) - Math.max(0, nextBounds.top)
    );
    const visibleArea = visibleWidth * visibleHeight;
    const visibleRatio = visibleArea / rawArea;
    const fullyOutOfViewport =
      maxX < -80 || minX > width + 80 || maxY < -80 || minY > height + 80;
    const mostlyInvisible = fullyOutOfViewport || visibleRatio < 0.08;

    if (mostlyInvisible && !isDragging && !isRotating) {
      const now = performance.now();
      if (now - lastVisibilityRecoveryAtRef.current >= VISIBILITY_RECOVERY_COOLDOWN_MS) {
        lastVisibilityRecoveryAtRef.current = now;
        const fallbackX = clamp(width * 0.82, bounds.minX, bounds.maxX);
        const avatarScale = settings.avatar?.scale || 1.0;
        const solvedGroundY = solveGroundPositionY(avatarScale);
        const fallbackY = solvedGroundY ?? bounds.maxY;
        if (solvedGroundY !== null) {
          setGroundY(solvedGroundY);
        }
        setPosition({ x: fallbackX, y: fallbackY });
      }
    }

    const prevBounds = lastInteractionBoundsRef.current;
    const hasMeaningfulChange =
      !prevBounds ||
      Math.abs(prevBounds.left - nextBounds.left) > 1 ||
      Math.abs(prevBounds.right - nextBounds.right) > 1 ||
      Math.abs(prevBounds.top - nextBounds.top) > 1 ||
      Math.abs(prevBounds.bottom - nextBounds.bottom) > 1;

    if (hasMeaningfulChange) {
      lastInteractionBoundsRef.current = nextBounds;
      setInteractionBounds(nextBounds);
    }
  }, [
    camera,
    gl.domElement,
    setInteractionBounds,
    isDragging,
    isRotating,
    bounds,
    setPosition,
    settings.avatar?.scale,
    solveGroundPositionY,
    setGroundY,
  ]);

  // Check if click is on head area (upper 30% of the avatar)
  const isHeadClick = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!groupRef.current) return false;

    // Get the bounding box of the avatar
    const box = new THREE.Box3().setFromObject(groupRef.current);
    const avatarHeight = box.max.y - box.min.y;
    const headThreshold = box.max.y - avatarHeight * 0.3; // Top 30% is head

    // Check if click point Y is in head area
    return e.point.y > headThreshold;
  }, []);

  // Pointer event handlers for 3D model drag and rotation
  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);

    dragStartRef.current = { x: e.clientX, y: e.clientY };

    if (isHeadClick(e)) {
      // Head click - start rotation
      setIsRotating(true);
      rotationStartRef.current = { x: manualRotation.x, y: manualRotation.y };
    } else {
      // Body click - start dragging
      setIsDragging(true);
      positionStartRef.current = { x: position.x, y: position.y };
    }
  }, [position, manualRotation, setIsDragging, setIsRotating, isHeadClick]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (isRotating) {
      // Handle rotation (head drag)
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      // Convert mouse movement to rotation (sensitivity: 0.01 radians per pixel)
      const sensitivity = 0.01;
      const newRotationY = rotationStartRef.current.y + dx * sensitivity;
      const newRotationX = rotationStartRef.current.x + dy * sensitivity;

      // Clamp X rotation (up/down) to prevent extreme angles
      const clampedX = Math.max(-0.5, Math.min(0.5, newRotationX));
      // Y rotation (left/right) can go full 360
      const clampedY = newRotationY;

      setManualRotation({ x: clampedX, y: clampedY });
    } else if (isDragging) {
      // Handle position drag (body)
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      let newX = positionStartRef.current.x + dx;
      let newY = positionStartRef.current.y + dy;

      // Clamp to bounds
      newX = Math.max(bounds.minX, Math.min(bounds.maxX, newX));
      newY = Math.max(bounds.minY, Math.min(bounds.maxY, newY));

      setPosition({ x: newX, y: newY });
    }
  }, [isDragging, isRotating, bounds, setPosition, setManualRotation]);

  const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);

    if (isRotating) {
      const currentRotation = useAvatarStore.getState().manualRotation;
      setAvatarSettings({
        initialViewRotation: {
          x: clamp(currentRotation.x, -0.5, 0.5),
          y: currentRotation.y,
        },
      });
    }

    setIsDragging(false);
    setIsRotating(false);
  }, [isRotating, setIsDragging, setIsRotating, setAvatarSettings]);

  // Load VRM model
  useEffect(() => {
    let isEffectActive = true;

    const configuredPath = settings.vrmModelPath?.trim() ?? '';

    const handleLoaded = (gltf: any) => {
      if (!isEffectActive) {
        const staleVRM = gltf?.userData?.vrm as VRM | undefined;
        if (staleVRM) {
          VRMUtils.deepDispose(staleVRM.scene);
        }
        return;
      }

      const loadedVRM = gltf.userData.vrm as VRM;

      if (!loadedVRM) {
        setLoadError('Failed to parse VRM data');
        setIsLoading(false);
        return;
      }

      // Optimize VRM
      VRMUtils.removeUnnecessaryJoints(gltf.scene);
      VRMUtils.removeUnnecessaryVertices(gltf.scene);

      // Ensure humanoid rig updates are enabled (some VRM configs disable this).
      const humanoidAny = loadedVRM.humanoid as any;
      if (humanoidAny && 'autoUpdateHumanBones' in humanoidAny) {
        humanoidAny.autoUpdateHumanBones = true;
      }

      const modelBounds = new THREE.Box3().setFromObject(loadedVRM.scene);
      if (Number.isFinite(modelBounds.min.y) && Number.isFinite(modelBounds.max.y)) {
        modelMinYRef.current = modelBounds.min.y;
        logToTerminal(
          `[VRM] model bounds minY=${modelBounds.min.y.toFixed(3)} maxY=${modelBounds.max.y.toFixed(3)}`
        );
      }

      // Debug: Check Face mesh materials for eye issues
      loadedVRM.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          const meshName = mesh.name;

          // Log Face mesh materials (eyes are part of face)
          if (meshName.startsWith('Face')) {
            logToTerminal(`=== ${meshName} Material Info ===`);
            if (mesh.material) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              materials.forEach((mat, idx) => {
                const m = mat as any;
                logToTerminal(`  [${idx}] type: ${mat.type}`);
                logToTerminal(`  [${idx}] transparent: ${mat.transparent}, opacity: ${m.opacity}`);
                logToTerminal(`  [${idx}] visible: ${mat.visible}, side: ${m.side}`);
                if (m.map) {
                  logToTerminal(`  [${idx}] has texture map: ${m.map.image ? 'loaded' : 'not loaded'}`);
                }
                if (m.color) {
                  logToTerminal(`  [${idx}] color: r=${m.color.r}, g=${m.color.g}, b=${m.color.b}`);
                }
              });
            }
          }

          // Set transparency for window overlay
          if (mesh.material) {
            const materials = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material];
            materials.forEach((mat) => {
              if (mat instanceof THREE.Material) {
                mat.transparent = true;
              }
            });
          }
        }
      });

      // Create animation mixer
      mixerRef.current = new THREE.AnimationMixer(loadedVRM.scene);

      // Mixamo 걷기 클립 매니저 초기화
      const clipMgr = new LocomotionClipManager(mixerRef.current, loadedVRM);
      locomotionClipRef.current = clipMgr;
      clipMgr.preloadEssentials().catch((err) =>
        logToTerminal(`[VRMAvatar] Walk clip preload warning: ${err}`)
      );


      // Debug: Log available expressions to terminal
      if (loadedVRM.expressionManager) {
        const expressions = loadedVRM.expressionManager.expressions;
        const expressionNames = expressions.map(e => e.expressionName);
        logToTerminal('=== VRM Expressions Available ===');
        logToTerminal(JSON.stringify(expressionNames, null, 2));
        logToTerminal('=================================');
      }

      // Debug: Log all mesh names to find eye meshes
      logToTerminal('=== All Mesh Names ===');
      loadedVRM.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          logToTerminal(`Mesh: ${mesh.name}`);

          // Check for eye-related meshes and log detailed info
          const nameLC = mesh.name.toLowerCase();
          if (nameLC.includes('eye') || nameLC.includes('iris') || nameLC.includes('pupil') || nameLC.includes('highlight')) {
            logToTerminal(`  >> EYE MESH FOUND: ${mesh.name}`);
            if (mesh.material) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              materials.forEach((mat, idx) => {
                const m = mat as any;
                logToTerminal(`    [${idx}] type: ${mat.type}, visible: ${mat.visible}`);
                logToTerminal(`    [${idx}] renderOrder: ${mesh.renderOrder}, depthTest: ${m.depthTest}, depthWrite: ${m.depthWrite}`);
                if (m.map) {
                  logToTerminal(`    [${idx}] texture: ${m.map.image?.src || 'embedded'}`);
                }
              });
            }
          }
        }
      });
      logToTerminal('======================');

      // Debug: Check SpringBone for eye bones
      if (loadedVRM.springBoneManager) {
        logToTerminal('=== SpringBone Info ===');
        logToTerminal('SpringBone manager exists: true');
        logToTerminal('======================');
      }

      // Rig diagnostics: verify key motion bones exist in humanoid mapping.
      if (loadedVRM.humanoid) {
        const humanoid = loadedVRM.humanoid as any;
        const hasRawGetter = typeof humanoid.getRawBoneNode === 'function';
        logToTerminal(`=== Humanoid Bone Mapping (${hasRawGetter ? 'normalized+raw' : 'normalized'}) ===`);
        for (const boneName of DIAGNOSTIC_BONES) {
          const normalizedNode = loadedVRM.humanoid.getNormalizedBoneNode(boneName as any);
          const rawNode = hasRawGetter ? humanoid.getRawBoneNode(boneName as any) : null;
          const status = normalizedNode
            ? `OK normalized=${normalizedNode.name || '(unnamed)'}`
            : 'MISSING normalized';
          const rawStatus = hasRawGetter
            ? (rawNode ? ` raw=${rawNode.name || '(unnamed)'}` : ' raw=MISSING')
            : '';
          logToTerminal(`[Humanoid] ${boneName}: ${status}${rawStatus}`);
        }
        logToTerminal('========================================');
      }

      // Fix eye render order: Face_5 (sclera/white) should render BEFORE other face parts
      // so that iris/pupil on transparent meshes render on top
      loadedVRM.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.name === 'Face_5') {
            // Render eye whites first (lower render order)
            mesh.renderOrder = -10;
            logToTerminal('Set Face_5 (eye whites) renderOrder to -10');
          }
          // Set transparent face meshes to render after Face_5
          if (mesh.name.startsWith('Face_') && mesh.name !== 'Face_5') {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((mat) => {
              if ((mat as THREE.Material).transparent) {
                mesh.renderOrder = 10;
              }
            });
          }
        }
      });

      const previousVRM = useAvatarStore.getState().vrm;
      if (previousVRM && previousVRM !== loadedVRM) {
        VRMUtils.deepDispose(previousVRM.scene);
      }

      setVRM(loadedVRM);
      setIsLoading(false);
    };

    if (!configuredPath) {
      // Try loading the embedded default VRM
      void (async () => {
        try {
          const available = await isDefaultVrmAvailable();
          if (!isEffectActive) return;

          if (!available) {
            // No embedded VRM — unload and show picker overlay
            setGroundY(null);
            setInteractionBounds(null);
            setLoadError(null);
            setIsLoading(false);

            const currentVrm = useAvatarStore.getState().vrm;
            if (currentVrm) {
              VRMUtils.deepDispose(currentVrm.scene);
              setVRM(null);
            }
            return;
          }

          setIsLoading(true);
          setLoadError(null);

          const buffer = await loadDefaultVrmBuffer();
          if (!isEffectActive) return;

          const defaultLoader = new GLTFLoader();
          defaultLoader.register((parser) => new VRMLoaderPlugin(parser));

          defaultLoader.parse(
            buffer,
            '',
            handleLoaded,
            (parseError: unknown) => {
              if (!isEffectActive) return;
              const msg = parseError instanceof Error ? parseError.message : 'Unknown error';
              setLoadError(`Failed to load default VRM: ${msg}`);
              setIsLoading(false);
            }
          );
        } catch {
          if (!isEffectActive) return;
          // Default VRM not available — fall back to picker overlay
          setGroundY(null);
          setInteractionBounds(null);
          setLoadError(null);
          setIsLoading(false);

          const currentVrm = useAvatarStore.getState().vrm;
          if (currentVrm) {
            VRMUtils.deepDispose(currentVrm.scene);
            setVRM(null);
          }
        }
      })();
      return;
    }

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    setIsLoading(true);
    setLoadError(null);

    const modelPath = resolveModelUrl(configuredPath);
    const shouldUseFsFallback = isTauri() && isLocalFileSource(configuredPath);
    let fsFallbackAttempted = false;

    loader.load(
      modelPath,
      handleLoaded,
      (progress) => {
        // Progress callback
        const percent = (progress.loaded / progress.total) * 100;
        console.log(`Loading VRM: ${percent.toFixed(1)}%`);
      },
      (error: unknown) => {
        if (!isEffectActive) {
          return;
        }

        console.error('Error loading VRM:', error);
        if (!shouldUseFsFallback || fsFallbackAttempted) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          setLoadError(`Failed to load VRM: ${errorMessage}`);
          setIsLoading(false);
          return;
        }

        fsFallbackAttempted = true;
        console.log('[VRM] URL load failed, trying fs read + parse fallback');

        void (async () => {
          try {
            const bytes = await readFile(toFsReadTarget(configuredPath));
            if (!isEffectActive) {
              return;
            }
            const raw = bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength
            );

            loader.parse(
              raw,
              '',
              handleLoaded,
              (parseError: unknown) => {
                if (!isEffectActive) {
                  return;
                }
                const parseErrorMessage =
                  parseError instanceof Error ? parseError.message : 'Unknown parse error';
                setLoadError(`Failed to load VRM: ${parseErrorMessage}`);
                setIsLoading(false);
              }
            );
          } catch (fallbackError) {
            if (!isEffectActive) {
              return;
            }
            const fallbackMessage =
              fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error';
            setLoadError(`Failed to load VRM: ${fallbackMessage}`);
            setIsLoading(false);
          }
        })();
      }
    );

    return () => {
      isEffectActive = false;
      setGroundY(null);
      setInteractionBounds(null);
      // LocomotionClipManager 정리 (AnimationAction/Clip 캐시 해제)
      if (locomotionClipRef.current) {
        locomotionClipRef.current.dispose();
        locomotionClipRef.current = null;
      }
      // AnimationMixer 정리
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current.uncacheRoot(mixerRef.current.getRoot());
        mixerRef.current = null;
      }
      // VRM 리소스 해제
      const currentVrm = useAvatarStore.getState().vrm;
      if (currentVrm) {
        VRMUtils.deepDispose(currentVrm.scene);
        setVRM(null);
      }
    };
  }, [settings.vrmModelPath, setGroundY, setInteractionBounds]);

  // VRM 변경 시 캐시 리셋 + 뼈 노드 캐시 초기화
  useEffect(() => {
    hingeProfileRef.current = null;
    hingeProfileLoggedRef.current = false;
    restHipsPositionRef.current = null;
    boneCacheRef.current = {};
    rawBoneCacheRef.current = {};

    if (!vrm?.humanoid) return;
    const h = vrm.humanoid;
    const boneNames = [
      'spine', 'chest', 'upperChest', 'hips', 'neck', 'head',
      'leftShoulder', 'rightShoulder', 'leftUpperArm', 'rightUpperArm',
      'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand',
      'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg',
      'leftFoot', 'rightFoot', 'leftToes', 'rightToes',
      'leftThumbProximal', 'leftThumbIntermediate', 'leftThumbDistal',
      'rightThumbProximal', 'rightThumbIntermediate', 'rightThumbDistal',
      'leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal',
      'rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal',
      'leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal',
      'rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal',
      'leftRingProximal', 'leftRingIntermediate', 'leftRingDistal',
      'rightRingProximal', 'rightRingIntermediate', 'rightRingDistal',
      'leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal',
      'rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal',
    ];
    const cache: Record<string, BoneNode> = {};
    for (const name of boneNames) {
      cache[name] = h.getNormalizedBoneNode(name as any);
    }
    boneCacheRef.current = cache;

    // Raw 뼈 캐시
    const humanoidAny = h as any;
    if (typeof humanoidAny.getRawBoneNode === 'function') {
      const rawCache: Record<string, BoneNode> = {};
      for (const name of ['leftLowerArm', 'rightLowerArm', 'leftLowerLeg', 'rightLowerLeg']) {
        rawCache[name] = humanoidAny.getRawBoneNode(name as any);
      }
      rawBoneCacheRef.current = rawCache;
    }

    // 힌지 프로파일 계산 (1회)
    const rawL = rawBoneCacheRef.current;
    hingeProfileRef.current = {
      leftElbow: computeHingeAxisWeights(rawL.leftLowerArm || cache.leftLowerArm, DEFAULT_ELBOW_WEIGHTS),
      rightElbow: computeHingeAxisWeights(rawL.rightLowerArm || cache.rightLowerArm, DEFAULT_ELBOW_WEIGHTS),
      leftKnee: computeHingeAxisWeights(rawL.leftLowerLeg || cache.leftLowerLeg, DEFAULT_KNEE_WEIGHTS),
      rightKnee: computeHingeAxisWeights(rawL.rightLowerLeg || cache.rightLowerLeg, DEFAULT_KNEE_WEIGHTS),
    };
  }, [vrm]);

  useEffect(() => {
    if (!vrm?.humanoid) return;

    const hips = vrm.humanoid.getNormalizedBoneNode('hips');
    if (!hips) return;

    restHipsPositionRef.current = {
      x: hips.position.x,
      y: hips.position.y,
      z: hips.position.z,
    };
  }, [vrm]);

  useEffect(() => {
    if (!vrm) return;

    const scale = settings.avatar?.scale || 1.0;
    let retryFrame: number | null = null;
    let retries = 0;

    const recomputeGround = () => {
      const groundY = solveGroundPositionY(scale);
      if (groundY !== null) {
        setGroundY(groundY);
        return true;
      }
      return false;
    };

    const trySolveGround = () => {
      // 이전 프레임 취소 (resize 재호출 시 누적 방지)
      if (retryFrame !== null) {
        window.cancelAnimationFrame(retryFrame);
        retryFrame = null;
      }
      if (recomputeGround()) {
        return;
      }
      if (retries >= MAX_GROUND_SOLVE_RETRIES) {
        return;
      }
      retries += 1;
      retryFrame = window.requestAnimationFrame(trySolveGround);
    };

    trySolveGround();
    window.addEventListener('resize', trySolveGround);
    return () => {
      if (retryFrame !== null) {
        window.cancelAnimationFrame(retryFrame);
      }
      window.removeEventListener('resize', trySolveGround);
    };
  }, [vrm, settings.avatar?.scale, setGroundY, solveGroundPositionY]);

  // Animation frame update - Base pose and locomotion only
  // Expressions, blinking, gestures, and dance are handled by AnimationManager
  useFrame(() => {
    if (!vrm) return;

    const delta = clockRef.current.getDelta();
    const time = clockRef.current.elapsedTime;
    const clampedDelta = Math.max(delta, 0.001);
    const emotionTuning = getEmotionTuning(emotion);
    // 속도 기반 걷기 판정: 실제로 움직이고 있을 때만 걷기 애니메이션 재생
    const locomotionDemand = movementSpeedRef.current > 5;

    const currentPos = useAvatarStore.getState().position;
    const previousPos = prevScreenPosRef.current;
    if (!previousPos) {
      prevScreenPosRef.current = { x: currentPos.x, y: currentPos.y };
    } else {
      const dx = currentPos.x - previousPos.x;
      const dy = currentPos.y - previousPos.y;
      const almostStill =
        !targetPosition &&
        !isMoving &&
        Math.abs(dx) < POSITION_JITTER_EPSILON &&
        Math.abs(dy) < POSITION_JITTER_EPSILON;
      const horizontalSpeed = Math.abs(dx) / clampedDelta;
      const verticalSpeed = Math.abs(dy) / clampedDelta;
      const rawSpeed = almostStill ? 0 : horizontalSpeed + verticalSpeed * 0.2;
      movementSpeedRef.current +=
        (rawSpeed - movementSpeedRef.current) * Math.min(1, clampedDelta * 20);
      prevScreenPosRef.current = { x: currentPos.x, y: currentPos.y };
    }
    if (!targetPosition && !isMoving && movementSpeedRef.current > 0) {
      movementSpeedRef.current = Math.max(0, movementSpeedRef.current - 360 * clampedDelta);
      if (movementSpeedRef.current < IDLE_SPEED_SNAP) {
        movementSpeedRef.current = 0;
      }
    }

    // Update VRM (including SpringBone physics)
    vrm.update(delta);

    // Update animation mixer
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }

    // Mixamo 클립 재생 후 hips 드리프트 방지 (제스처 재생 중에는 스킵)
    const clipMgrRef = locomotionClipRef.current;
    if (clipMgrRef && !clipMgrRef.isGesturePlaying && (clipMgrRef.isIdling || clipMgrRef.isWalking)) {
      const hipsBone = boneCacheRef.current['hips'];
      if (hipsBone) {
        // XZ 위치를 부드럽게 0으로 수렴 (root motion 제거 보완)
        hipsBone.position.x = THREE.MathUtils.damp(hipsBone.position.x, 0, 8, delta);
        hipsBone.position.z = THREE.MathUtils.damp(hipsBone.position.z, 0, 8, delta);
        if (clipMgrRef.isIdling) {
          // idle 시 Y 위치를 rest pose 높이로 부드럽게 복원
          const restY = restHipsPositionRef.current?.y ?? hipsBone.position.y;
          hipsBone.position.y = THREE.MathUtils.damp(hipsBone.position.y, restY, 8, delta);
        }
      }
    }

    if (faceOnlyModeEnabled) {
      locomotionLatchRef.current = false;
      locomotionBlendRef.current = 0;
      // Mixamo 클립도 정지
      if (locomotionClipRef.current) {
        locomotionClipRef.current.stopAll();
      }

      if (vrm.humanoid) {
        const humanoid = vrm.humanoid;
        const spine = humanoid.getNormalizedBoneNode('spine');
        const chest = humanoid.getNormalizedBoneNode('chest');
        const upperChest = humanoid.getNormalizedBoneNode('upperChest');
        const hips = humanoid.getNormalizedBoneNode('hips');
        const neck = humanoid.getNormalizedBoneNode('neck');
        const head = humanoid.getNormalizedBoneNode('head');
        const leftShoulder = humanoid.getNormalizedBoneNode('leftShoulder');
        const rightShoulder = humanoid.getNormalizedBoneNode('rightShoulder');
        const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
        const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
        const leftLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm');
        const rightLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm');
        const leftHand = humanoid.getNormalizedBoneNode('leftHand');
        const rightHand = humanoid.getNormalizedBoneNode('rightHand');
        const leftUpperLeg = humanoid.getNormalizedBoneNode('leftUpperLeg');
        const rightUpperLeg = humanoid.getNormalizedBoneNode('rightUpperLeg');
        const leftLowerLeg = humanoid.getNormalizedBoneNode('leftLowerLeg');
        const rightLowerLeg = humanoid.getNormalizedBoneNode('rightLowerLeg');
        const leftFoot = humanoid.getNormalizedBoneNode('leftFoot');
        const rightFoot = humanoid.getNormalizedBoneNode('rightFoot');
        const leftToes = humanoid.getNormalizedBoneNode('leftToes');
        const rightToes = humanoid.getNormalizedBoneNode('rightToes');

        const humanoidAny = humanoid as any;
        const getRawBone = typeof humanoidAny.getRawBoneNode === 'function'
          ? (boneName: string) => humanoidAny.getRawBoneNode(boneName as any) as BoneNode
          : () => null;
        const rawLeftLowerArm = getRawBone('leftLowerArm');
        const rawRightLowerArm = getRawBone('rightLowerArm');
        const rawLeftLowerLeg = getRawBone('leftLowerLeg');
        const rawRightLowerLeg = getRawBone('rightLowerLeg');
        if (!hingeProfileRef.current) {
          hingeProfileRef.current = {
            leftElbow: computeHingeAxisWeights(rawLeftLowerArm || leftLowerArm, DEFAULT_ELBOW_WEIGHTS),
            rightElbow: computeHingeAxisWeights(rawRightLowerArm || rightLowerArm, DEFAULT_ELBOW_WEIGHTS),
            leftKnee: computeHingeAxisWeights(rawLeftLowerLeg || leftLowerLeg, DEFAULT_KNEE_WEIGHTS),
            rightKnee: computeHingeAxisWeights(rawRightLowerLeg || rightLowerLeg, DEFAULT_KNEE_WEIGHTS),
          };
        }
        const hingeProfile = hingeProfileRef.current;
        const leftElbowWeights = hingeProfile?.leftElbow ?? DEFAULT_ELBOW_WEIGHTS;
        const rightElbowWeights = hingeProfile?.rightElbow ?? DEFAULT_ELBOW_WEIGHTS;
        const leftKneeWeights = hingeProfile?.leftKnee ?? DEFAULT_KNEE_WEIGHTS;
        const rightKneeWeights = hingeProfile?.rightKnee ?? DEFAULT_KNEE_WEIGHTS;
        const stanceStiffness = 14;
        if (!restHipsPositionRef.current && hips) {
          restHipsPositionRef.current = {
            x: hips.position.x,
            y: hips.position.y,
            z: hips.position.z,
          };
        }
        const hipsRestPosition = restHipsPositionRef.current;

        // Face-only mode baseline stance: 11-shape standing pose with relaxed arms.
        dampBoneRotation(spine, { x: 0, y: 0, z: 0 }, clampedDelta, stanceStiffness);
        dampBoneRotation(chest, { x: 0, y: 0, z: 0 }, clampedDelta, stanceStiffness);
        dampBoneRotation(upperChest, { x: 0, y: 0, z: 0 }, clampedDelta, stanceStiffness);
        dampBoneRotation(hips, { x: 0, y: 0, z: 0 }, clampedDelta, stanceStiffness - 1);
        if (hipsRestPosition) {
          dampBonePosition(hips, hipsRestPosition, clampedDelta, stanceStiffness - 1);
        }
        dampBoneRotation(leftShoulder, { x: 0, y: 0, z: 0.08 }, clampedDelta, stanceStiffness);
        dampBoneRotation(rightShoulder, { x: 0, y: 0, z: -0.08 }, clampedDelta, stanceStiffness);
        dampBoneRotation(leftUpperArm, { x: 0.08, y: 0, z: 1.18 }, clampedDelta, stanceStiffness);
        dampBoneRotation(rightUpperArm, { x: 0.08, y: 0, z: -1.18 }, clampedDelta, stanceStiffness);
        dampBoneRotationPair(
          leftLowerArm,
          rawLeftLowerArm,
          hingeTarget(0.24, -1, leftElbowWeights, { y: -0.1, z: 0 }, 0),
          clampedDelta,
          stanceStiffness
        );
        dampBoneRotationPair(
          rightLowerArm,
          rawRightLowerArm,
          hingeTarget(0.24, 1, rightElbowWeights, { y: 0.1, z: 0 }, 0),
          clampedDelta,
          stanceStiffness
        );
        dampBoneRotation(leftHand, { x: 0.02, y: -0.06, z: 0 }, clampedDelta, stanceStiffness);
        dampBoneRotation(rightHand, { x: 0.02, y: 0.06, z: 0 }, clampedDelta, stanceStiffness);
        dampBoneRotation(leftUpperLeg, { x: 0, y: 0, z: 0 }, clampedDelta, stanceStiffness);
        dampBoneRotation(rightUpperLeg, { x: 0, y: 0, z: 0 }, clampedDelta, stanceStiffness);
        dampBoneRotationPair(
          leftLowerLeg,
          rawLeftLowerLeg,
          hingeTarget(0.05, 1, leftKneeWeights, { x: 0.01 }, 0),
          clampedDelta,
          stanceStiffness
        );
        dampBoneRotationPair(
          rightLowerLeg,
          rawRightLowerLeg,
          hingeTarget(0.05, -1, rightKneeWeights, { x: 0.01 }, 0),
          clampedDelta,
          stanceStiffness
        );
        dampBoneRotation(leftFoot, { x: 0.01, y: 0, z: 0 }, clampedDelta, stanceStiffness);
        dampBoneRotation(rightFoot, { x: 0.01, y: 0, z: 0 }, clampedDelta, stanceStiffness);
        dampBoneRotation(leftToes, { x: 0.01, y: 0, z: 0 }, clampedDelta, stanceStiffness);
        dampBoneRotation(rightToes, { x: 0.01, y: 0, z: 0 }, clampedDelta, stanceStiffness);

        const facePose = FACE_ONLY_HEAD_POSE[emotion] ?? FACE_ONLY_HEAD_POSE.neutral;
        const microYaw = Math.sin(time * 0.9 + 0.8) * 0.02;
        const microPitch = Math.sin(time * 1.2) * 0.012;

        dampBoneRotation(
          neck,
          {
            x: facePose.x * 0.45 + microPitch * 0.4,
            y: facePose.y * 0.4 + microYaw * 0.6,
            z: facePose.z * 0.4,
          },
          clampedDelta,
          13
        );
        dampBoneRotation(
          head,
          {
            x: facePose.x + microPitch,
            y: facePose.y + microYaw,
            z: facePose.z + Math.sin(time * 1.35 + 0.2) * 0.01,
          },
          clampedDelta,
          15
        );
      }

      smoothedYawRef.current = THREE.MathUtils.lerp(
        smoothedYawRef.current,
        IDLE_YAW,
        Math.min(1, clampedDelta * 10)
      );
      if (groupRef.current) {
        groupRef.current.rotation.x = manualRotation.x;
        groupRef.current.rotation.y = smoothedYawRef.current + manualRotation.y;
      }
      publishInteractionBounds();
      return;
    }

    // Skip base pose animation when gesture or dance is active
    // Those controllers will handle the pose
    // Dance should override base pose only when actually dancing in-place.
    // (currentGesture는 Mixamo clipMgr가 처리 — 여기서 early return 불필요)
    if (isDancing && (animationState as string) !== 'walking') {
      const desiredYaw = animationState === 'walking'
        ? (facingRight ? RIGHT_WALK_YAW : LEFT_WALK_YAW)
        : IDLE_YAW;
      smoothedYawRef.current = THREE.MathUtils.lerp(
        smoothedYawRef.current,
        desiredYaw,
        Math.min(1, clampedDelta * 10)
      );
      if (groupRef.current) {
        groupRef.current.rotation.x = manualRotation.x;
        groupRef.current.rotation.y = smoothedYawRef.current + manualRotation.y;
      }
      publishInteractionBounds();
      return;
    }

    const wantsLocomotion =
      animationState === 'walking' &&
      (isMoving || locomotionDemand || movementSpeedRef.current > LOCOMOTION_START_SPEED);
    const shouldStopLocomotion =
      animationState !== 'walking' ||
      (!isMoving && !locomotionDemand && movementSpeedRef.current < LOCOMOTION_STOP_SPEED);

    if (wantsLocomotion) {
      locomotionLatchRef.current = true;
    } else if (shouldStopLocomotion) {
      locomotionLatchRef.current = false;
    }

    const locomotionActive = locomotionLatchRef.current;
    const locomotionBlendTarget = locomotionActive ? 1 : 0;
    locomotionBlendRef.current +=
      (locomotionBlendTarget - locomotionBlendRef.current) *
      Math.min(1, clampedDelta * (locomotionActive ? 11 : 7));
    const locomotionBlend = clamp(locomotionBlendRef.current, 0, 1);

    // --- Mixamo 클립 기반 걷기/Idle 제어 ---
    const clipMgr = locomotionClipRef.current;
    if (clipMgr && useClipLocomotion.current) {
      if (locomotionActive) {
        // 걷기 시작 또는 감정 전환
        if (!clipMgr.isWalking) {
          clipMgr.playWalk(emotion);
        } else {
          clipMgr.switchWalkEmotion(emotion);
        }
        const speedScale = clamp(movementSpeedRef.current / 80, 0.3, 2.0);
        clipMgr.setWalkSpeed(speedScale);
      } else {
        // 정지: 걷기 → Idle 전환 (제스처 재생 중이면 대기)
        if (clipMgr.isWalking) {
          clipMgr.stopWalk();
        }
        if (clipMgr.isGesturePlaying) {
          // 제스처 재생 중 → idle 시작하지 않음 (제스처 완료 후 자동 시작)
        } else if (!clipMgr.isIdling) {
          clipMgr.playIdle(emotion);
        } else {
          clipMgr.switchIdleEmotion(emotion);
        }
      }
    }

    // Apply bone animations based on state (base pose only)
    const b = boneCacheRef.current;
    const rb = rawBoneCacheRef.current;
    if (vrm.humanoid && Object.keys(b).length > 0) {
      // 뼈 노드는 캐시에서 참조 (매 프레임 조회 불필요)
      const { spine, chest, upperChest, hips, neck, head,
        leftShoulder, rightShoulder, leftUpperArm, rightUpperArm,
        leftLowerArm, rightLowerArm, leftHand, rightHand,
        leftUpperLeg, rightUpperLeg, leftLowerLeg, rightLowerLeg,
        leftFoot, rightFoot, leftToes, rightToes,
        leftThumbProximal, leftThumbIntermediate, leftThumbDistal,
        rightThumbProximal, rightThumbIntermediate, rightThumbDistal,
        leftIndexProximal, leftIndexIntermediate, leftIndexDistal,
        rightIndexProximal, rightIndexIntermediate, rightIndexDistal,
        leftMiddleProximal, leftMiddleIntermediate, leftMiddleDistal,
        rightMiddleProximal, rightMiddleIntermediate, rightMiddleDistal,
        leftRingProximal, leftRingIntermediate, leftRingDistal,
        rightRingProximal, rightRingIntermediate, rightRingDistal,
        leftLittleProximal, leftLittleIntermediate, leftLittleDistal,
        rightLittleProximal, rightLittleIntermediate, rightLittleDistal,
      } = b;
      const rawLeftLowerArm = rb.leftLowerArm;
      const rawRightLowerArm = rb.rightLowerArm;
      const rawLeftLowerLeg = rb.leftLowerLeg;
      const rawRightLowerLeg = rb.rightLowerLeg;
      const hingeProfile = hingeProfileRef.current;
      if (hingeProfile && !hingeProfileLoggedRef.current) {
        hingeProfileLoggedRef.current = true;
        const fmt = (weights: AxisWeights) =>
          `x=${weights.x.toFixed(2)},y=${weights.y.toFixed(2)},z=${weights.z.toFixed(2)}`;
        logToTerminal(
          `[HingeAxis] leftElbow(${fmt(hingeProfile.leftElbow)}) rightElbow(${fmt(hingeProfile.rightElbow)}) leftKnee(${fmt(hingeProfile.leftKnee)}) rightKnee(${fmt(hingeProfile.rightKnee)})`
        );
      }
      const leftElbowWeights = hingeProfile?.leftElbow ?? DEFAULT_ELBOW_WEIGHTS;
      const rightElbowWeights = hingeProfile?.rightElbow ?? DEFAULT_ELBOW_WEIGHTS;
      const leftKneeWeights = hingeProfile?.leftKnee ?? DEFAULT_KNEE_WEIGHTS;
      const rightKneeWeights = hingeProfile?.rightKnee ?? DEFAULT_KNEE_WEIGHTS;

      // Mixamo 클립이 재생 중이면 절차적 뼈 제어 전체 스킵
      const clipMgrActive = clipMgr && useClipLocomotion.current && (clipMgr.isWalking || clipMgr.isIdling);

      if (clipMgrActive) {
        // Mixamo AnimationMixer가 뼈를 제어 — 절차적 코드 스킵
        // (yaw 회전과 publishInteractionBounds만 아래에서 실행)
      } else if (!locomotionActive || animationState !== 'walking') {
        // Idle animation - relaxed pose with subtle breathing
        const breathe = Math.sin(time * 1.5) * 0.02;
        const idleSway = Math.sin(time * 0.8) * 0.016 * emotionTuning.upperBodySwingScale;

        // Spine breathing
        dampBoneRotation(spine, { x: breathe, y: 0, z: idleSway * 0.65 }, clampedDelta, emotionTuning.idleDampingStiffness);
        dampBoneRotation(chest, { x: breathe * 0.5, y: idleSway * 0.25, z: idleSway * 0.35 }, clampedDelta, emotionTuning.idleDampingStiffness);
        dampBoneRotation(
          upperChest,
          { x: breathe * 0.35, y: idleSway * 0.16, z: idleSway * 0.2 },
          clampedDelta,
          emotionTuning.idleDampingStiffness
        );
        dampBoneRotation(hips, { x: 0, y: 0, z: -idleSway * 0.35 }, clampedDelta, emotionTuning.idleDampingStiffness - 1);
        dampBoneRotation(neck, { x: 0, y: idleSway * 0.3, z: 0 }, clampedDelta, emotionTuning.idleDampingStiffness);
        dampBoneRotation(leftShoulder, { x: 0, y: idleSway * 0.8, z: 0.1 }, clampedDelta, emotionTuning.idleDampingStiffness - 1);
        dampBoneRotation(rightShoulder, { x: 0, y: -idleSway * 0.8, z: -0.1 }, clampedDelta, emotionTuning.idleDampingStiffness - 1);

        // Arms in relaxed position (not T-pose)
        dampBoneRotation(leftUpperArm, { x: 0.1 + idleSway * 0.6, y: 0, z: 1.2 }, clampedDelta, emotionTuning.idleDampingStiffness);
        dampBoneRotation(rightUpperArm, { x: 0.1 - idleSway * 0.6, y: 0, z: -1.2 }, clampedDelta, emotionTuning.idleDampingStiffness);

        // Slight bend in elbows
        const idleLeftElbowTarget = hingeTarget(
          0.18,
          -1,
          leftElbowWeights,
          { y: -0.1, z: idleSway * 0.15 },
          idleSway
        );
        const idleRightElbowTarget = hingeTarget(
          0.18,
          1,
          rightElbowWeights,
          { y: 0.1, z: -idleSway * 0.15 },
          -idleSway
        );
        dampBoneRotationPair(
          leftLowerArm,
          rawLeftLowerArm,
          idleLeftElbowTarget,
          clampedDelta,
          emotionTuning.idleDampingStiffness
        );
        dampBoneRotationPair(
          rightLowerArm,
          rawRightLowerArm,
          idleRightElbowTarget,
          clampedDelta,
          emotionTuning.idleDampingStiffness
        );
        dampBoneRotation(leftHand, { x: 0.05, y: -0.08, z: idleSway * 0.6 }, clampedDelta, emotionTuning.idleDampingStiffness);
        dampBoneRotation(rightHand, { x: 0.05, y: 0.08, z: -idleSway * 0.6 }, clampedDelta, emotionTuning.idleDampingStiffness);

        // Legs straight
        dampBoneRotation(leftUpperLeg, { x: 0, y: 0, z: 0 }, clampedDelta, emotionTuning.idleDampingStiffness);
        dampBoneRotation(rightUpperLeg, { x: 0, y: 0, z: 0 }, clampedDelta, emotionTuning.idleDampingStiffness);
        dampBoneRotationPair(
          leftLowerLeg,
          rawLeftLowerLeg,
          hingeTarget(0.07, 1, leftKneeWeights, { x: 0.01 }, idleSway * 0.3),
          clampedDelta,
          emotionTuning.idleDampingStiffness
        );
        dampBoneRotationPair(
          rightLowerLeg,
          rawRightLowerLeg,
          hingeTarget(0.07, -1, rightKneeWeights, { x: 0.01 }, -idleSway * 0.3),
          clampedDelta,
          emotionTuning.idleDampingStiffness
        );
        dampBoneRotation(leftFoot, { x: 0.02, y: 0, z: 0 }, clampedDelta, emotionTuning.idleDampingStiffness);
        dampBoneRotation(rightFoot, { x: 0.02, y: 0, z: 0 }, clampedDelta, emotionTuning.idleDampingStiffness);
        dampBoneRotation(leftToes, { x: 0.04, y: 0, z: 0 }, clampedDelta, emotionTuning.idleDampingStiffness);
        dampBoneRotation(rightToes, { x: 0.04, y: 0, z: 0 }, clampedDelta, emotionTuning.idleDampingStiffness);

        const idleFingerCurl = 0.26 + Math.sin(time * 0.9) * 0.03;
        dampFingerChain(
          leftIndexProximal,
          leftIndexIntermediate,
          leftIndexDistal,
          idleFingerCurl,
          -0.06,
          clampedDelta,
          emotionTuning.idleDampingStiffness
        );
        dampFingerChain(
          rightIndexProximal,
          rightIndexIntermediate,
          rightIndexDistal,
          idleFingerCurl,
          0.06,
          clampedDelta,
          emotionTuning.idleDampingStiffness
        );
        dampFingerChain(
          leftMiddleProximal,
          leftMiddleIntermediate,
          leftMiddleDistal,
          idleFingerCurl + 0.04,
          -0.02,
          clampedDelta,
          emotionTuning.idleDampingStiffness
        );
        dampFingerChain(
          rightMiddleProximal,
          rightMiddleIntermediate,
          rightMiddleDistal,
          idleFingerCurl + 0.04,
          0.02,
          clampedDelta,
          emotionTuning.idleDampingStiffness
        );
        dampFingerChain(
          leftRingProximal,
          leftRingIntermediate,
          leftRingDistal,
          idleFingerCurl + 0.07,
          0.02,
          clampedDelta,
          emotionTuning.idleDampingStiffness
        );
        dampFingerChain(
          rightRingProximal,
          rightRingIntermediate,
          rightRingDistal,
          idleFingerCurl + 0.07,
          -0.02,
          clampedDelta,
          emotionTuning.idleDampingStiffness
        );
        dampFingerChain(
          leftLittleProximal,
          leftLittleIntermediate,
          leftLittleDistal,
          idleFingerCurl + 0.1,
          0.08,
          clampedDelta,
          emotionTuning.idleDampingStiffness
        );
        dampFingerChain(
          rightLittleProximal,
          rightLittleIntermediate,
          rightLittleDistal,
          idleFingerCurl + 0.1,
          -0.08,
          clampedDelta,
          emotionTuning.idleDampingStiffness
        );
        dampThumbChain(
          leftThumbProximal,
          leftThumbIntermediate,
          leftThumbDistal,
          idleFingerCurl,
          clampedDelta,
          emotionTuning.idleDampingStiffness,
          true
        );
        dampThumbChain(
          rightThumbProximal,
          rightThumbIntermediate,
          rightThumbDistal,
          idleFingerCurl,
          clampedDelta,
          emotionTuning.idleDampingStiffness,
          false
        );

        // Subtle head movement
        dampBoneRotation(
          head,
          { x: Math.sin(time * 0.5) * 0.02, y: Math.sin(time * 0.3) * 0.05, z: 0 },
          clampedDelta,
          emotionTuning.idleDampingStiffness
        );

      } else if (locomotionActive && !(locomotionClipRef.current && useClipLocomotion.current && locomotionClipRef.current.playing)) {
        // 절차적 걷기 (Mixamo 클립 비활성 시에만 fallback)
        const gait = STYLE_GAIT[locomotionStyle];
        const speedNorm = clamp(
          movementSpeedRef.current / 145,
          0.05,
          1.55
        ) * locomotionBlend;
        const cadence = (movementSpeedRef.current / STRIDE_LENGTH_PX) * (Math.PI * 2) * gait.cadence * emotionTuning.walkCadenceScale;
        gaitPhaseRef.current += cadence * clampedDelta;
        const walkCycle = gaitPhaseRef.current;

        const step = Math.sin(walkCycle);
        const gaitPhase01 = wrapPhase01(walkCycle / (Math.PI * 2));
        const leftLegPhase = gaitPhase01;
        const rightLegPhase = wrapPhase01(gaitPhase01 + 0.5);
        const leftArmPhase = rightLegPhase;
        const rightArmPhase = leftLegPhase;
        const legGain = gait.leg * (0.8 + speedNorm * 0.35);
        const kneeGain = gait.leg * (0.85 + speedNorm * 0.4);
        const armGain = gait.arm * emotionTuning.armSwingScale * (0.8 + speedNorm * 0.35);
        const leftHipFlex = hipFlexFromPhase(leftLegPhase) * legGain;
        const rightHipFlex = hipFlexFromPhase(rightLegPhase) * legGain;
        const leftKneeFlex = clamp(kneeFlexFromPhase(leftLegPhase) * kneeGain, 0.08, 1.55);
        const rightKneeFlex = clamp(kneeFlexFromPhase(rightLegPhase) * kneeGain, 0.08, 1.55);
        const leftAnklePitch = clamp(
          anklePitchFromPhase(leftLegPhase) * (0.85 + speedNorm * 0.3),
          -0.52,
          0.24
        );
        const rightAnklePitch = clamp(
          anklePitchFromPhase(rightLegPhase) * (0.85 + speedNorm * 0.3),
          -0.52,
          0.24
        );
        const leftElbowFlex = clamp(
          0.2 + (elbowFlexFromPhase(leftArmPhase) - 0.2) * armGain,
          0.2,
          1.5
        );
        const rightElbowFlex = clamp(
          0.2 + (elbowFlexFromPhase(rightArmPhase) - 0.2) * armGain,
          0.2,
          1.5
        );
        const armForward = Math.sin(leftArmPhase * Math.PI * 2) * 0.34 * armGain;
        const armForwardOpposite = Math.sin(rightArmPhase * Math.PI * 2) * 0.34 * armGain;
        const bounce =
          Math.abs(step) * 0.025 * gait.bounce * emotionTuning.upperBodySwingScale * (0.6 + speedNorm * 0.4);
        const torsoSway =
          Math.sin(walkCycle + Math.PI / 2) * 0.028 * gait.sway * emotionTuning.upperBodySwingScale;
        const upperBodyTwist = Math.sin(walkCycle * 0.5 + stepAccentRef.current) * 0.05;
        const shoulderDrive = Math.sin(walkCycle + Math.PI * 0.25) * 0.16 * armGain;
        const elbowDrive = Math.sin(walkCycle + Math.PI * 0.55) * 0.22 * armGain;
        const wristTwist = Math.sin(walkCycle * 1.2 + Math.PI * 0.2) * 0.27 * gait.arm * emotionTuning.armSwingScale;
        const handPitch = Math.sin(walkCycle * 1.35 + Math.PI * 0.4) * 0.18 * gait.arm * locomotionBlend;
        const hipYaw = Math.sin(walkCycle + Math.PI * 0.5) * 0.07 * gait.sway * emotionTuning.upperBodySwingScale;
        const hipRoll = Math.sin(walkCycle + Math.PI) * 0.08 * gait.sway * (0.65 + speedNorm * 0.25);
        const upperChestCounter = -upperBodyTwist * 0.42;
        const leftToeExtension = clamp(toeExtensionFromPhase(leftLegPhase) * (0.75 + speedNorm * 0.45), 0, 0.7);
        const rightToeExtension = clamp(toeExtensionFromPhase(rightLegPhase) * (0.75 + speedNorm * 0.45), 0, 0.7);
        const leftFingerCurl = clamp(0.23 + Math.max(0, Math.sin(leftArmPhase * Math.PI * 2)) * 0.24 + speedNorm * 0.05, 0.2, 0.6);
        const rightFingerCurl = clamp(0.23 + Math.max(0, Math.sin(rightArmPhase * Math.PI * 2)) * 0.24 + speedNorm * 0.05, 0.2, 0.6);
        const walkStiffness = emotionTuning.walkDampingStiffness;

        // Body bounce
        dampBoneRotation(
          spine,
          { x: 0.04 + bounce, y: upperBodyTwist * 0.2, z: torsoSway },
          clampedDelta,
          walkStiffness
        );
        dampBoneRotation(chest, { x: 0, y: upperBodyTwist * 0.35, z: upperChestCounter * 0.2 }, clampedDelta, walkStiffness);
        dampBoneRotation(
          upperChest,
          { x: 0, y: upperChestCounter, z: upperChestCounter * 0.22 },
          clampedDelta,
          walkStiffness
        );
        dampBoneRotation(hips, { x: 0, y: hipYaw, z: -torsoSway * 0.35 + hipRoll }, clampedDelta, walkStiffness - 2);
        dampBoneRotation(neck, { x: -0.02, y: upperBodyTwist * 0.18, z: 0 }, clampedDelta, walkStiffness);
        dampBoneRotation(leftShoulder, { x: 0, y: shoulderDrive * 0.25, z: 0.1 }, clampedDelta, walkStiffness);
        dampBoneRotation(rightShoulder, { x: 0, y: -shoulderDrive * 0.25, z: -0.1 }, clampedDelta, walkStiffness);

        // Arms swing opposite to legs
        dampBoneRotation(
          leftUpperArm,
          {
            x: 0.2 + armForward * 0.9,
            y: shoulderDrive * 0.42 + Math.sin(leftArmPhase * Math.PI * 2 + Math.PI / 2) * 0.04,
            z: 1.0 - shoulderDrive * 0.12,
          },
          clampedDelta,
          walkStiffness
        );
        dampBoneRotation(
          rightUpperArm,
          {
            x: 0.2 + armForwardOpposite * 0.9,
            y: -shoulderDrive * 0.42 + Math.sin(rightArmPhase * Math.PI * 2 + Math.PI / 2) * 0.04,
            z: -1.0 + shoulderDrive * 0.12,
          },
          clampedDelta,
          walkStiffness
        );

        // Elbow bend during swing (multi-axis for wider VRM compatibility)
        dampBoneRotationPair(
          leftLowerArm,
          rawLeftLowerArm,
          hingeTarget(
            leftElbowFlex,
            -1,
            leftElbowWeights,
            {
              y: -0.1 + Math.sin(leftArmPhase * Math.PI * 2) * -0.12,
              z: -shoulderDrive * 0.22 + elbowDrive * 0.1,
            },
            Math.sin(leftArmPhase * Math.PI * 2) * 0.18
          ),
          clampedDelta,
          walkStiffness
        );
        dampBoneRotationPair(
          rightLowerArm,
          rawRightLowerArm,
          hingeTarget(
            rightElbowFlex,
            1,
            rightElbowWeights,
            {
              y: 0.1 + Math.sin(rightArmPhase * Math.PI * 2) * 0.12,
              z: shoulderDrive * 0.22 - elbowDrive * 0.1,
            },
            Math.sin(rightArmPhase * Math.PI * 2) * -0.18
          ),
          clampedDelta,
          walkStiffness
        );
        dampBoneRotation(
          leftHand,
          { x: handPitch, y: -0.08 + wristTwist * 0.25, z: wristTwist },
          clampedDelta,
          walkStiffness
        );
        dampBoneRotation(
          rightHand,
          { x: -handPitch, y: 0.08 - wristTwist * 0.25, z: -wristTwist },
          clampedDelta,
          walkStiffness
        );

        // Leg swing
        dampBoneRotation(leftUpperLeg, { x: leftHipFlex, y: 0, z: 0 }, clampedDelta, walkStiffness + 1);
        dampBoneRotation(rightUpperLeg, { x: rightHipFlex, y: 0, z: 0 }, clampedDelta, walkStiffness + 1);

        // Knee bend (multi-axis for VRM rigs with different knee bend axis)
        const kneeSway = Math.sin(walkCycle + Math.PI / 2) * 0.1 * speedNorm;
        dampBoneRotationPair(
          leftLowerLeg,
          rawLeftLowerLeg,
          hingeTarget(
            leftKneeFlex,
            1,
            leftKneeWeights,
            {
              y: Math.sin(leftLegPhase * Math.PI * 2) * 0.03,
            },
            kneeSway
          ),
          clampedDelta,
          walkStiffness + 1
        );
        dampBoneRotationPair(
          rightLowerLeg,
          rawRightLowerLeg,
          hingeTarget(
            rightKneeFlex,
            -1,
            rightKneeWeights,
            {
              y: Math.sin(rightLegPhase * Math.PI * 2) * -0.03,
            },
            -kneeSway
          ),
          clampedDelta,
          walkStiffness + 1
        );
        dampBoneRotation(
          leftFoot,
          { x: leftAnklePitch, y: kneeSway * 0.06, z: -kneeSway * 0.1 },
          clampedDelta,
          walkStiffness
        );
        dampBoneRotation(
          rightFoot,
          { x: rightAnklePitch, y: -kneeSway * 0.06, z: kneeSway * 0.1 },
          clampedDelta,
          walkStiffness
        );
        dampBoneRotation(
          leftToes,
          { x: leftToeExtension, y: 0, z: kneeSway * -0.05 },
          clampedDelta,
          walkStiffness + 0.5
        );
        dampBoneRotation(
          rightToes,
          { x: rightToeExtension, y: 0, z: kneeSway * 0.05 },
          clampedDelta,
          walkStiffness + 0.5
        );

        dampFingerChain(
          leftIndexProximal,
          leftIndexIntermediate,
          leftIndexDistal,
          leftFingerCurl,
          -0.06,
          clampedDelta,
          walkStiffness
        );
        dampFingerChain(
          rightIndexProximal,
          rightIndexIntermediate,
          rightIndexDistal,
          rightFingerCurl,
          0.06,
          clampedDelta,
          walkStiffness
        );
        dampFingerChain(
          leftMiddleProximal,
          leftMiddleIntermediate,
          leftMiddleDistal,
          leftFingerCurl + 0.04,
          -0.02,
          clampedDelta,
          walkStiffness
        );
        dampFingerChain(
          rightMiddleProximal,
          rightMiddleIntermediate,
          rightMiddleDistal,
          rightFingerCurl + 0.04,
          0.02,
          clampedDelta,
          walkStiffness
        );
        dampFingerChain(
          leftRingProximal,
          leftRingIntermediate,
          leftRingDistal,
          leftFingerCurl + 0.08,
          0.02,
          clampedDelta,
          walkStiffness
        );
        dampFingerChain(
          rightRingProximal,
          rightRingIntermediate,
          rightRingDistal,
          rightFingerCurl + 0.08,
          -0.02,
          clampedDelta,
          walkStiffness
        );
        dampFingerChain(
          leftLittleProximal,
          leftLittleIntermediate,
          leftLittleDistal,
          leftFingerCurl + 0.12,
          0.08,
          clampedDelta,
          walkStiffness
        );
        dampFingerChain(
          rightLittleProximal,
          rightLittleIntermediate,
          rightLittleDistal,
          rightFingerCurl + 0.12,
          -0.08,
          clampedDelta,
          walkStiffness
        );
        dampThumbChain(
          leftThumbProximal,
          leftThumbIntermediate,
          leftThumbDistal,
          leftFingerCurl,
          clampedDelta,
          walkStiffness,
          true
        );
        dampThumbChain(
          rightThumbProximal,
          rightThumbIntermediate,
          rightThumbDistal,
          rightFingerCurl,
          clampedDelta,
          walkStiffness,
          false
        );

        if (ENABLE_JOINT_DEBUG && time - lastJointDebugAtRef.current > 1.5) {
          lastJointDebugAtRef.current = time;
          const fmt = (bone: BoneNode) => {
            if (!bone) return 'missing';
            return `x=${bone.rotation.x.toFixed(2)},y=${bone.rotation.y.toFixed(2)},z=${bone.rotation.z.toFixed(2)}`;
          };
          logToTerminal(
            `[JointMotion] nLeftElbow(${fmt(leftLowerArm)}) nRightElbow(${fmt(rightLowerArm)}) nLeftKnee(${fmt(leftLowerLeg)}) nRightKnee(${fmt(rightLowerLeg)})`
          );
          logToTerminal(
            `[JointMotionRaw] rLeftElbow(${fmt(rawLeftLowerArm)}) rRightElbow(${fmt(rawRightLowerArm)}) rLeftKnee(${fmt(rawLeftLowerLeg)}) rRightKnee(${fmt(rawRightLowerLeg)})`
          );
        }

        // Head stays relatively stable
        dampBoneRotation(
          head,
          {
            x: -0.03 + Math.sin(walkCycle + Math.PI * 0.5) * 0.015,
            y: upperBodyTwist * 0.35,
            z: torsoSway * 0.15,
          },
          clampedDelta,
          walkStiffness
        );
      }
    }

    // 응답 중(talking)이면 정면, 걷기 중이면 미세 방향 전환, 그 외 정면
    const isTalking = animationState === 'talking';
    const desiredYaw = isTalking
      ? IDLE_YAW
      : locomotionActive
        ? (facingRight ? RIGHT_WALK_YAW : LEFT_WALK_YAW)
        : IDLE_YAW;
    // idle→정면 빠르게(10), 걷기 중 방향 전환 느리게(4)
    const yawSpeed = locomotionActive ? 4 : 10;
    smoothedYawRef.current = THREE.MathUtils.lerp(
      smoothedYawRef.current,
      desiredYaw,
      Math.min(1, clampedDelta * yawSpeed)
    );
    if (groupRef.current) {
      groupRef.current.rotation.x = manualRotation.x;
      groupRef.current.rotation.y = smoothedYawRef.current + manualRotation.y;
    }
    publishInteractionBounds();
  });

  if (!vrm) return null;

  const worldPos = screenToWorldAtZ(position.x, position.y, 0);
  if (!worldPos) return null;
  const avatarScale = settings.avatar?.scale || 1.0;

  return (
    <group
      ref={groupRef}
      position={[worldPos.x, worldPos.y, worldPos.z]}
      rotation={[manualRotation.x, smoothedYawRef.current + manualRotation.y, 0]}
      scale={[avatarScale, avatarScale, avatarScale]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <primitive object={vrm.scene} />
    </group>
  );
}
