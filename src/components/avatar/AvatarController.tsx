import { useEffect, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getEmotionTuning } from '../../config/emotionTuning';

const ARRIVAL_THRESHOLD = 10;
const AUTO_MOVE_MIN_DELAY = 2000;
const AUTO_MOVE_MAX_DELAY = 5000;
const GRAVITY = 1800;
const GROUND_MARGIN_PX = 8;
const TURN_PAUSE_DURATION = 0.12;
const MIN_TURN_DISTANCE = 3;
const MIN_CRUISE_SPEED = 40;

// 자동 배회 중 랜덤 액션 확률
const JUMP_IMPULSE = 650;

/** 감정별 자동 배회 제스처 */
const EMOTION_GESTURES: Record<string, string[]> = {
  neutral: ['nod', 'shrug'],
  happy: ['celebrate', 'wave', 'jump'],
  sad: ['shake', 'shrug'],
  angry: ['shake'],
  thinking: ['nod', 'shrug'],
  surprised: ['jump', 'celebrate'],
  relaxed: ['nod', 'wave'],
};

const STYLE_SPEED_MULTIPLIER = {
  stroll: 0.9, brisk: 1.25, sneak: 0.72, bouncy: 1.05,
} as const;
const STYLE_ACCELERATION = {
  stroll: 220, brisk: 430, sneak: 160, bouncy: 300,
} as const;
const STYLE_DECELERATION = {
  stroll: 280, brisk: 360, sneak: 220, bouncy: 290,
} as const;
const STYLE_CADENCE = {
  stroll: 4.8, brisk: 7.1, sneak: 3.6, bouncy: 6.0,
} as const;

function randomChoice<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function chooseLocomotionStyle(
  emotion: ReturnType<typeof useAvatarStore.getState>['emotion']
): ReturnType<typeof useAvatarStore.getState>['locomotionStyle'] {
  if (emotion === 'sad') return 'sneak';
  if (emotion === 'angry') return randomChoice(['brisk', 'brisk', 'stroll']);
  if (emotion === 'happy') return randomChoice(['bouncy', 'brisk', 'stroll']);
  if (emotion === 'surprised') return randomChoice(['brisk', 'bouncy']);
  if (emotion === 'thinking') return randomChoice(['sneak', 'stroll']);
  if (emotion === 'relaxed') return randomChoice(['stroll', 'sneak']);
  return randomChoice(['stroll', 'brisk', 'sneak']);
}

function getFloorY(scale: number, solvedGroundY: number | null): number {
  if (typeof solvedGroundY === 'number' && Number.isFinite(solvedGroundY)) {
    return Math.max(0, Math.min(window.innerHeight, solvedGroundY));
  }
  return window.innerHeight - Math.max(95, 130 * scale) - GROUND_MARGIN_PX;
}

type RoamAction = 'walk' | 'gesture' | 'jump' | 'idle';

/** 실제 위치 기반 방향 결정: 중앙 대비 멀리 있는 쪽 → 반대 방향으로 이동 */
function getRandomTarget(
  current: { x: number; y: number },
  bounds: { minX: number; maxX: number },
  floorY: number,
): { x: number; y: number } {
  const width = bounds.maxX - bounds.minX;
  if (width <= 0) return { x: current.x, y: floorY };

  const posRatio = (current.x - bounds.minX) / width; // 0=왼쪽끝, 1=오른쪽끝

  // 위치 기반 방향 확률: 한쪽 끝에 있으면 반대쪽 확률 증가
  const goRightChance = 1 - posRatio; // 오른쪽 끝이면 0%, 왼쪽 끝이면 100%
  const goRight = Math.random() < goRightChance;

  // 이동 거리: 화면 너비의 20~60% (다양한 거리)
  const minTravel = width * 0.2;
  const maxTravel = width * 0.6;
  const travel = minTravel + Math.random() * (maxTravel - minTravel);

  let x: number;
  if (goRight) {
    x = current.x + travel;
  } else {
    x = current.x - travel;
  }

  return { x: clamp(x, bounds.minX, bounds.maxX), y: floorY };
}

/** 액션 순환 큐: 다양한 액션을 순서대로 실행 */
const ROAM_ACTION_SEQUENCE: RoamAction[] = [
  'walk', 'gesture', 'walk', 'idle', 'walk', 'jump', 'gesture', 'walk', 'idle', 'gesture',
];

export default function AvatarController() {
  // 설정 구독 (반응형)
  const autoRoam = useSettingsStore((s) => s.settings.avatar?.autoRoam ?? false);
  const freeMovement = useSettingsStore((s) => s.settings.avatar?.freeMovement ?? false);
  const avatarScale = useSettingsStore((s) => s.settings.avatar?.scale ?? 1.0);
  const movementSpeed = useSettingsStore((s) => s.settings.avatar?.movementSpeed ?? 120);

  const autoMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verticalVelocityRef = useRef(0);
  const emotionActionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roamActionIndexRef = useRef(0);

  /** 순환 큐에서 다음 액션 선택 */
  const pickRoamAction = useCallback((): RoamAction => {
    const action = ROAM_ACTION_SEQUENCE[roamActionIndexRef.current % ROAM_ACTION_SEQUENCE.length];
    roamActionIndexRef.current++;
    return action;
  }, []);
  const horizontalSpeedRef = useRef(0);
  const turnPauseRef = useRef(0);
  const facingDirectionRef = useRef<1 | -1>(1);
  const stridePhaseRef = useRef(Math.random() * Math.PI * 2);
  const previousDistanceRef = useRef<number | null>(null);
  const stuckTimeRef = useRef(0);
  const hasInitializedBottomRightRef = useRef(false);
  const prevViewportRef = useRef({ width: window.innerWidth, height: window.innerHeight });

  const {
    position, targetPosition, isMoving, animationState,
    setPosition, setTargetPosition, setIsMoving, setAnimationState,
    setFacingRight, facingRight, locomotionStyle, bounds, groundY, isDragging, emotion,
  } = useAvatarStore();

  useEffect(() => {
    facingDirectionRef.current = facingRight ? 1 : -1;
  }, [facingRight]);

  const triggerHop = useCallback((impulse = JUMP_IMPULSE) => {
    if (isDragging) return;
    if (Math.abs(verticalVelocityRef.current) > 5) return;
    verticalVelocityRef.current = -impulse;
  }, [isDragging]);

  // ─── 자동 배회 스케줄링 ───
  /** 자동 배회용 화면 bounds — 화면 양 끝까지 이동 */
  const getScreenBounds = useCallback(() => {
    const marginX = Math.max(20, 40 * avatarScale);
    return { minX: marginX, maxX: window.innerWidth - marginX };
  }, [avatarScale]);

  const scheduleAutoMove = useCallback(() => {
    if (!autoRoam || freeMovement) return;
    if (autoMoveTimerRef.current) clearTimeout(autoMoveTimerRef.current);

    const state = useAvatarStore.getState();
    const profile = getEmotionTuning(state.emotion);
    const delay = AUTO_MOVE_MIN_DELAY + Math.random() * (AUTO_MOVE_MAX_DELAY - AUTO_MOVE_MIN_DELAY);
    const tunedDelay = delay * profile.autoMoveDelayMultiplier;

    autoMoveTimerRef.current = setTimeout(() => {
      const s = useAvatarStore.getState();
      if (s.isDragging) {
        scheduleAutoMove();
        return;
      }

      // 걷기 중이면 도착할 때까지 대기 (1초 후 재확인)
      if (s.targetPosition || s.isMoving) {
        if (autoMoveTimerRef.current) clearTimeout(autoMoveTimerRef.current);
        autoMoveTimerRef.current = setTimeout(() => scheduleAutoMove(), 1000);
        return;
      }

      const floorY = getFloorY(avatarScale, s.groundY);
      const screenBounds = getScreenBounds();
      const action = pickRoamAction();
      const em = s.emotion;

      switch (action) {
        case 'walk': {
          s.setLocomotionStyle(chooseLocomotionStyle(em));
          const target = getRandomTarget(s.position, screenBounds, floorY);
          s.setTargetPosition(target);
          s.setIsMoving(true);
          break;
        }
        case 'gesture': {
          const gestures = EMOTION_GESTURES[em] ?? EMOTION_GESTURES.neutral;
          const gesture = gestures[Math.floor(Math.random() * gestures.length)];
          s.triggerGesture(gesture as any);
          break;
        }
        case 'jump': {
          const impulse = profile.hopImpulse > 0 ? profile.hopImpulse : JUMP_IMPULSE;
          verticalVelocityRef.current = -impulse;
          break;
        }
        case 'idle': {
          // Mixamo idle 클립 자동 재생
          break;
        }
      }

      scheduleAutoMove();
    }, tunedDelay);
  }, [autoRoam, freeMovement, avatarScale, getScreenBounds]);

  // ─── Bounds 업데이트 ───
  useEffect(() => {
    const handleResize = () => {
      const currentGroundY = useAvatarStore.getState().groundY;
      const floorY = getFloorY(avatarScale, currentGroundY);
      const marginX = Math.max(window.innerWidth * 0.08, Math.max(80, 120 * avatarScale));

      const newBounds = {
        minX: freeMovement ? -Infinity : marginX,
        maxX: freeMovement ? Infinity : (window.innerWidth - marginX),
        minY: freeMovement ? -Infinity : floorY,
        maxY: freeMovement ? Infinity : floorY,
      };
      useAvatarStore.getState().setBounds(newBounds);

      const state = useAvatarStore.getState();
      if (!hasInitializedBottomRightRef.current) {
        state.setPosition({ x: window.innerWidth - marginX, y: floorY });
        hasInitializedBottomRightRef.current = true;
        prevViewportRef.current = { width: window.innerWidth, height: window.innerHeight };
        return;
      }
      if (state.isDragging) {
        prevViewportRef.current = { width: window.innerWidth, height: window.innerHeight };
        return;
      }

      const currentPos = state.position;
      const prevWidth = prevViewportRef.current.width;
      const newWidth = window.innerWidth;
      let newX: number;
      if (freeMovement) {
        newX = currentPos.x;
      } else if (prevWidth > 0 && prevWidth !== newWidth) {
        const ratio = currentPos.x / prevWidth;
        newX = clamp(ratio * newWidth, newBounds.minX, newBounds.maxX);
      } else {
        newX = clamp(currentPos.x, newBounds.minX, newBounds.maxX);
      }
      const clampedY = freeMovement ? currentPos.y : floorY;
      prevViewportRef.current = { width: newWidth, height: window.innerHeight };
      if (newX !== currentPos.x || clampedY !== currentPos.y) {
        state.setPosition({ x: newX, y: clampedY });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [avatarScale, freeMovement, groundY]);

  // ─── 자유 이동 ON → 자동 배회 강제 OFF ───
  useEffect(() => {
    if (freeMovement && autoRoam) {
      useSettingsStore.getState().setAvatarSettings({ autoRoam: false });
    }
  }, [freeMovement, autoRoam]);

  // ─── 자동 배회 ON/OFF 반응 ───
  const effectiveAutoRoam = autoRoam && !freeMovement;
  useEffect(() => {
    if (effectiveAutoRoam) {
      scheduleAutoMove();
    } else {
      if (autoMoveTimerRef.current) clearTimeout(autoMoveTimerRef.current);
      const state = useAvatarStore.getState();
      state.setTargetPosition(null);
      state.setIsMoving(false);
      state.setAnimationState('idle');
    }
    return () => {
      if (autoMoveTimerRef.current) clearTimeout(autoMoveTimerRef.current);
      if (emotionActionRef.current) clearTimeout(emotionActionRef.current);
    };
  }, [effectiveAutoRoam, scheduleAutoMove]);

  // ─── 감정 변경 시 즉시 리액션 (자동 배회 ON일 때) ───
  useEffect(() => {
    if (!effectiveAutoRoam) return;

    if (emotionActionRef.current) {
      clearTimeout(emotionActionRef.current);
      emotionActionRef.current = null;
    }

    const profile = getEmotionTuning(emotion);

    if (profile.hopImpulse > 0) {
      // happy/surprised → 점프
      triggerHop(profile.hopImpulse);
    } else if (emotion === 'angry') {
      // angry → 빠른 한걸음
      const state = useAvatarStore.getState();
      if (!state.targetPosition && !state.isDragging) {
        state.setLocomotionStyle('brisk');
        const quickStepX = state.facingRight
          ? Math.min(state.bounds.maxX, state.position.x + profile.quickStepDistance)
          : Math.max(state.bounds.minX, state.position.x - profile.quickStepDistance);
        state.setTargetPosition({ x: quickStepX, y: state.bounds.maxY });
      }
    } else if (emotion === 'sad') {
      // sad → 멈춤
      const state = useAvatarStore.getState();
      state.setIsMoving(false);
      state.setTargetPosition(null);
    }
  }, [emotion, effectiveAutoRoam, triggerHop]);

  // ─── 프레임 업데이트: 이동 물리 ───
  useFrame((_, delta) => {
    const floorY = bounds.maxY;

    // 중력 (자유 이동/자동 배회 모두 적용)
    if (!isDragging && !freeMovement) {
      if (position.y < floorY || Math.abs(verticalVelocityRef.current) > 1) {
        verticalVelocityRef.current += GRAVITY * delta;
        let nextY = position.y + verticalVelocityRef.current * delta;
        if (nextY >= floorY) {
          nextY = floorY;
          verticalVelocityRef.current = 0;
        }
        if (nextY !== position.y) {
          setPosition({ x: position.x, y: nextY });
        }
      } else if (position.y !== floorY) {
        setPosition({ x: position.x, y: floorY });
      }
    }

    // 자동 배회 OFF → 이동 로직 스킵
    if (!effectiveAutoRoam) {
      if (!freeMovement) {
        const clampedX = clamp(position.x, bounds.minX, bounds.maxX);
        if (Math.abs(position.x - clampedX) > 0.05 || Math.abs(position.y - floorY) > 0.05) {
          setPosition({ x: clampedX, y: floorY });
        }
      }
      horizontalSpeedRef.current = 0;
      return;
    }

    // 드래그 중 → 이동 정지
    if (isDragging) {
      if (isMoving) { setIsMoving(false); }
      if (animationState === 'walking') { setAnimationState('idle'); }
      turnPauseRef.current = 0;
      horizontalSpeedRef.current = Math.max(0, horizontalSpeedRef.current - 420 * delta);
      previousDistanceRef.current = null;
      stuckTimeRef.current = 0;
      return;
    }

    // 타겟 없음 → 이동 물리 스킵 (gesture/jump/idle 중일 수 있으므로 animationState 유지)
    if (!targetPosition) {
      if (isMoving) { setIsMoving(false); }
      horizontalSpeedRef.current = Math.max(0, horizontalSpeedRef.current - 420 * delta);
      previousDistanceRef.current = null;
      stuckTimeRef.current = 0;
      return;
    }

    if (!isMoving) setIsMoving(true);

    const dx = targetPosition.x - position.x;
    const distance = Math.abs(dx);

    // 도착 판정
    if (distance <= 1.5 || (distance < ARRIVAL_THRESHOLD && horizontalSpeedRef.current < 18)) {
      setPosition({ x: targetPosition.x, y: floorY });
      setTargetPosition(null);
      setIsMoving(false);
      setAnimationState('idle');
      horizontalSpeedRef.current = 0;
      previousDistanceRef.current = null;
      stuckTimeRef.current = 0;
      return;
    }

    // 방향 전환
    setAnimationState('walking');
    const desiredDirection: 1 | -1 = dx >= 0 ? 1 : -1;
    if (desiredDirection !== facingDirectionRef.current && Math.abs(dx) > MIN_TURN_DISTANCE) {
      facingDirectionRef.current = desiredDirection;
      turnPauseRef.current = TURN_PAUSE_DURATION;
      setFacingRight(desiredDirection > 0);
    }

    // 속도 계산
    const emotionSpeed = getEmotionTuning(emotion).movementSpeedMultiplier;
    const styleSpeed = STYLE_SPEED_MULTIPLIER[locomotionStyle] ?? 1.0;
    const accel = STYLE_ACCELERATION[locomotionStyle] ?? 260;
    const decel = STYLE_DECELERATION[locomotionStyle] ?? 300;
    const cadence = STYLE_CADENCE[locomotionStyle] ?? 5;
    const distanceScale = clamp(distance / 240, 0, 1);
    const cruiseSpeed = Math.max(MIN_CRUISE_SPEED, movementSpeed * emotionSpeed * styleSpeed * (0.35 + distanceScale * 0.75));

    const brakingDistance = (horizontalSpeedRef.current * horizontalSpeedRef.current) / (2 * Math.max(40, decel));
    const shouldBrake = distance < brakingDistance + ARRIVAL_THRESHOLD * 0.8;
    const brakingFactor = shouldBrake ? clamp(distance / Math.max(brakingDistance + ARRIVAL_THRESHOLD, 1), 0.2, 1) : 1;
    const baseTargetSpeed = Math.max(MIN_CRUISE_SPEED * 0.45, cruiseSpeed * brakingFactor);

    // 방향 전환 중 대기
    if (turnPauseRef.current > 0) {
      turnPauseRef.current = Math.max(0, turnPauseRef.current - delta);
      horizontalSpeedRef.current = Math.max(0, horizontalSpeedRef.current - decel * 2.2 * delta);
      previousDistanceRef.current = distance;
      if (turnPauseRef.current > 0) return;
    }

    stridePhaseRef.current += cadence * delta * (0.65 + horizontalSpeedRef.current / 120);
    const pulse = 1 + Math.sin(stridePhaseRef.current) * 0.12;
    const targetSpeed = Math.max(8, baseTargetSpeed * pulse);

    if (horizontalSpeedRef.current < targetSpeed) {
      horizontalSpeedRef.current = Math.min(targetSpeed, horizontalSpeedRef.current + accel * delta);
    } else {
      horizontalSpeedRef.current = Math.max(targetSpeed, horizontalSpeedRef.current - decel * delta);
    }

    const moveDistance = horizontalSpeedRef.current * delta;
    const ratio = Math.min(moveDistance / distance, 1);
    const newX = position.x + Math.sign(dx) * distance * ratio;
    const clampedX = clamp(newX, bounds.minX, bounds.maxX);

    // 경계 도달
    const blockedAtBoundary = (dx < 0 && position.x <= bounds.minX + 0.5) || (dx > 0 && position.x >= bounds.maxX - 0.5);
    const movedThisFrame = Math.abs(clampedX - position.x) > 0.08;

    if (blockedAtBoundary) {
      // 경계 도달 → 반대 방향으로 새 타겟 설정
      horizontalSpeedRef.current = 0;
      previousDistanceRef.current = null;
      stuckTimeRef.current = 0;
      if (effectiveAutoRoam) {
        const flY = bounds.maxY;
        const screenBounds = getScreenBounds();
        const reverseTarget = getRandomTarget(position, screenBounds, flY);
        setTargetPosition(reverseTarget);
        setFacingRight(reverseTarget.x > position.x);
      } else {
        setTargetPosition(null);
        setIsMoving(false);
        setAnimationState('idle');
      }
      return;
    }

    // Stuck 감지
    if (previousDistanceRef.current !== null && distance >= previousDistanceRef.current - 0.15 && !movedThisFrame) {
      stuckTimeRef.current += delta;
    } else {
      stuckTimeRef.current = 0;
    }
    previousDistanceRef.current = distance;

    if (stuckTimeRef.current > 0.22) {
      setTargetPosition(null);
      setIsMoving(false);
      setAnimationState('idle');
      horizontalSpeedRef.current = 0;
      previousDistanceRef.current = null;
      stuckTimeRef.current = 0;
      return;
    }

    if (moveDistance >= distance - 0.25) {
      setPosition({ x: targetPosition.x, y: floorY });
      setTargetPosition(null);
      setIsMoving(false);
      setAnimationState('idle');
      horizontalSpeedRef.current = 0;
      previousDistanceRef.current = null;
      stuckTimeRef.current = 0;
      return;
    }

    if (movedThisFrame) {
      setPosition({ x: clampedX, y: floorY });
    }
  });

  return null;
}
