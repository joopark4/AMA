import { useEffect, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getEmotionTuning } from '../../config/emotionTuning';

const ARRIVAL_THRESHOLD = 10; // pixels
const AUTO_MOVE_MIN_DELAY = 3500; // ms
const AUTO_MOVE_MAX_DELAY = 9000; // ms
const MIN_MOVE_DISTANCE = 140; // pixels
const GRAVITY = 1800; // px/s^2
const GROUND_MARGIN_PX = 8;

const STYLE_SPEED_MULTIPLIER = {
  stroll: 0.9,
  brisk: 1.25,
  sneak: 0.72,
  bouncy: 1.05,
} as const;

const STYLE_ACCELERATION = {
  stroll: 220,
  brisk: 430,
  sneak: 160,
  bouncy: 300,
} as const;

const STYLE_DECELERATION = {
  stroll: 280,
  brisk: 360,
  sneak: 220,
  bouncy: 290,
} as const;

const STYLE_CADENCE = {
  stroll: 4.8,
  brisk: 7.1,
  sneak: 3.6,
  bouncy: 6.0,
} as const;

// Keep avatar idle (no autonomous wandering), but preserve user-dragged position.
const FORCE_IDLE_NO_AUTOMOVE = true;

const TURN_PAUSE_DURATION = 0.12;
const MIN_TURN_DISTANCE = 3;
const MIN_CRUISE_SPEED = 16;

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

  // Fallback used before VRM bounds/camera-based ground is solved.
  return window.innerHeight - Math.max(95, 130 * scale) - GROUND_MARGIN_PX;
}

function getRandomTarget(
  current: { x: number; y: number },
  bounds: { minX: number; maxX: number },
  floorY: number
): { x: number; y: number } {
  const width = bounds.maxX - bounds.minX;

  for (let i = 0; i < 10; i++) {
    const x = bounds.minX + Math.random() * width;
    const y = floorY;
    const dx = x - current.x;
    const dy = y - current.y;
    if (Math.sqrt(dx * dx + dy * dy) >= MIN_MOVE_DISTANCE) {
      return { x, y };
    }
  }

  return {
    x: bounds.minX + Math.random() * width,
    y: floorY,
  };
}

export default function AvatarController() {
  const { settings } = useSettingsStore();
  const autoMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verticalVelocityRef = useRef(0);
  const emotionActionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const horizontalSpeedRef = useRef(0);
  const turnPauseRef = useRef(0);
  const facingDirectionRef = useRef<1 | -1>(1);
  const stridePhaseRef = useRef(Math.random() * Math.PI * 2);
  const previousDistanceRef = useRef<number | null>(null);
  const stuckTimeRef = useRef(0);
  const hasInitializedBottomRightRef = useRef(false);
  const prevViewportRef = useRef({ width: window.innerWidth, height: window.innerHeight });

  const {
    position,
    targetPosition,
    isMoving,
    animationState,
    setPosition,
    setTargetPosition,
    setIsMoving,
    setAnimationState,
    setFacingRight,
    facingRight,
    locomotionStyle,
    bounds,
    groundY,
    isDragging,
    emotion,
  } = useAvatarStore();

  useEffect(() => {
    facingDirectionRef.current = facingRight ? 1 : -1;
  }, [facingRight]);

  const triggerHop = useCallback((impulse = 720) => {
    if (isDragging) return;
    // Do not stack hops aggressively
    if (Math.abs(verticalVelocityRef.current) > 5) return;
    verticalVelocityRef.current = -impulse;
  }, [isDragging]);

  const scheduleAutoMove = useCallback(() => {
    if (FORCE_IDLE_NO_AUTOMOVE) return;
    if (autoMoveTimerRef.current) {
      clearTimeout(autoMoveTimerRef.current);
    }

    const state = useAvatarStore.getState();
    const profile = getEmotionTuning(state.emotion);
    const delay =
      AUTO_MOVE_MIN_DELAY +
      Math.random() * (AUTO_MOVE_MAX_DELAY - AUTO_MOVE_MIN_DELAY);
    const tunedDelay = delay * profile.autoMoveDelayMultiplier;

    autoMoveTimerRef.current = setTimeout(() => {
      const state = useAvatarStore.getState();
      if (!state.isDragging && !state.targetPosition) {
        const scale = settings.avatar?.scale || 1.0;
        const floorY = getFloorY(scale, state.groundY);
        state.setLocomotionStyle(chooseLocomotionStyle(state.emotion));
        const target = getRandomTarget(
          state.position,
          { minX: state.bounds.minX, maxX: state.bounds.maxX },
          floorY
        );
        state.setTargetPosition(target);
        state.setIsMoving(true);
      }
      scheduleAutoMove();
    }, tunedDelay);
  }, [settings.avatar?.scale, groundY]);

  // Update bounds on window resize (account for avatar scale)
  useEffect(() => {
    const handleResize = () => {
      const avatarScale = settings.avatar?.scale || 1.0;
      const freeMovement = settings.avatar?.freeMovement ?? false;
      const floorY = getFloorY(avatarScale, useAvatarStore.getState().groundY);
      // Horizontal margin target: 8% of viewport width.
      const marginX = Math.max(
        window.innerWidth * 0.08,
        Math.max(80, 120 * avatarScale)
      );

      const newBounds = {
        minX: freeMovement ? -Infinity : marginX,
        maxX: freeMovement ? Infinity : (window.innerWidth - marginX),
        minY: freeMovement ? -Infinity : floorY,
        maxY: freeMovement ? Infinity : floorY,
      };

      useAvatarStore.getState().setBounds(newBounds);

      const state = useAvatarStore.getState();

      // On launch, place avatar at bottom-right based on the actual window resolution.
      if (!hasInitializedBottomRightRef.current) {
        state.setPosition({ x: window.innerWidth - marginX, y: floorY });
        hasInitializedBottomRightRef.current = true;
        prevViewportRef.current = { width: window.innerWidth, height: window.innerHeight };
        return;
      }

      // Skip proportional repositioning while user is dragging to avoid interference.
      if (state.isDragging) {
        prevViewportRef.current = { width: window.innerWidth, height: window.innerHeight };
        return;
      }

      // On subsequent resizes, use proportional repositioning for horizontal axis.
      const currentPos = state.position;
      const prevWidth = prevViewportRef.current.width;
      const newWidth = window.innerWidth;

      let newX: number;
      if (freeMovement) {
        // Free movement: keep current position as-is
        newX = currentPos.x;
      } else if (prevWidth > 0 && prevWidth !== newWidth) {
        const ratio = currentPos.x / prevWidth;
        newX = Math.max(newBounds.minX, Math.min(newBounds.maxX, ratio * newWidth));
      } else {
        newX = Math.max(newBounds.minX, Math.min(newBounds.maxX, currentPos.x));
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
  }, [settings.avatar?.scale, settings.avatar?.freeMovement, groundY]);

  // Autonomous movement loop
  useEffect(() => {
    if (FORCE_IDLE_NO_AUTOMOVE) {
      if (autoMoveTimerRef.current) {
        clearTimeout(autoMoveTimerRef.current);
      }
      return () => {
        if (autoMoveTimerRef.current) {
          clearTimeout(autoMoveTimerRef.current);
        }
        if (emotionActionRef.current) {
          clearTimeout(emotionActionRef.current);
        }
      };
    }
    scheduleAutoMove();
    return () => {
      if (autoMoveTimerRef.current) {
        clearTimeout(autoMoveTimerRef.current);
      }
      if (emotionActionRef.current) {
        clearTimeout(emotionActionRef.current);
      }
    };
  }, [scheduleAutoMove]);

  // Emotion-driven motion behavior
  useEffect(() => {
    if (FORCE_IDLE_NO_AUTOMOVE) {
      const state = useAvatarStore.getState();
      state.setTargetPosition(null);
      state.setIsMoving(false);
      state.setAnimationState('idle');
      return;
    }

    if (emotionActionRef.current) {
      clearTimeout(emotionActionRef.current);
      emotionActionRef.current = null;
    }

    const profile = getEmotionTuning(emotion);

    if (profile.hopImpulse > 0) {
      triggerHop(profile.hopImpulse);
    } else if (emotion === 'angry') {
      const state = useAvatarStore.getState();
      if (!state.targetPosition && !state.isDragging) {
        state.setLocomotionStyle('brisk');
        const quickStepX = state.facingRight
          ? Math.min(state.bounds.maxX, state.position.x + profile.quickStepDistance)
          : Math.max(state.bounds.minX, state.position.x - profile.quickStepDistance);
        state.setTargetPosition({ x: quickStepX, y: state.bounds.maxY });
      }
    } else if (emotion === 'sad') {
      const state = useAvatarStore.getState();
      state.setIsMoving(false);
      state.setTargetPosition(null);
    }
  }, [emotion, triggerHop]);

  // Movement logic
  useFrame((_, delta) => {
    if (FORCE_IDLE_NO_AUTOMOVE) {
      const freeMovement = useSettingsStore.getState().settings.avatar?.freeMovement ?? false;

      if (!freeMovement) {
        // Normal mode: clamp to bounds + force Y to floorY
        const clampedX = clamp(position.x, bounds.minX, bounds.maxX);
        const floorY = bounds.maxY;
        if (Math.abs(position.x - clampedX) > 0.05 || Math.abs(position.y - floorY) > 0.05) {
          setPosition({ x: clampedX, y: floorY });
        }
      }
      // Free movement: keep current position as-is (no clamp)

      if (targetPosition) {
        setTargetPosition(null);
      }
      if (isMoving) {
        setIsMoving(false);
      }
      if (animationState !== 'idle') {
        setAnimationState('idle');
      }
      horizontalSpeedRef.current = 0;
      verticalVelocityRef.current = 0;
      turnPauseRef.current = 0;
      previousDistanceRef.current = null;
      stuckTimeRef.current = 0;
      return;
    }

    const floorY = bounds.maxY;

    // Vertical physics against the monitor floor
    if (!isDragging) {
      let nextY = position.y;
      if (position.y < floorY || Math.abs(verticalVelocityRef.current) > 1) {
        verticalVelocityRef.current += GRAVITY * delta;
        nextY += verticalVelocityRef.current * delta;
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

    if (isDragging || !targetPosition) {
      if (isMoving) {
        setIsMoving(false);
      }
      if (animationState !== 'idle') {
        setAnimationState('idle');
      }
      turnPauseRef.current = 0;
      horizontalSpeedRef.current = Math.max(0, horizontalSpeedRef.current - 420 * delta);
      previousDistanceRef.current = null;
      stuckTimeRef.current = 0;
      return;
    }

    if (!isMoving) {
      setIsMoving(true);
    }

    const dx = targetPosition.x - position.x;
    const distance = Math.abs(dx);

    if (distance <= 1.5) {
      setPosition({ x: targetPosition.x, y: floorY });
      setTargetPosition(null);
      setIsMoving(false);
      setAnimationState('idle');
      horizontalSpeedRef.current = 0;
      previousDistanceRef.current = null;
      stuckTimeRef.current = 0;
      return;
    }

    // Check if we've arrived
    if (distance < ARRIVAL_THRESHOLD && horizontalSpeedRef.current < 18) {
      setTargetPosition(null);
      setIsMoving(false);
      setAnimationState('idle');
      turnPauseRef.current = 0;
      horizontalSpeedRef.current = 0;
      previousDistanceRef.current = null;
      stuckTimeRef.current = 0;
      return;
    }

    // Set animation and facing direction
    setAnimationState('walking');
    const desiredDirection: 1 | -1 = dx >= 0 ? 1 : -1;
    if (
      desiredDirection !== facingDirectionRef.current &&
      Math.abs(dx) > MIN_TURN_DISTANCE
    ) {
      facingDirectionRef.current = desiredDirection;
      turnPauseRef.current = TURN_PAUSE_DURATION;
      setFacingRight(desiredDirection > 0);
    }

    // Calculate movement with speed from settings
    const movementSpeed = settings.avatar?.movementSpeed || 50;
    const emotionSpeed = getEmotionTuning(emotion).movementSpeedMultiplier;
    const styleSpeed = STYLE_SPEED_MULTIPLIER[locomotionStyle] ?? 1.0;
    const accel = STYLE_ACCELERATION[locomotionStyle] ?? 260;
    const decel = STYLE_DECELERATION[locomotionStyle] ?? 300;
    const cadence = STYLE_CADENCE[locomotionStyle] ?? 5;
    const distanceScale = clamp(distance / 240, 0, 1);
    const cruiseSpeed = Math.max(
      MIN_CRUISE_SPEED,
      movementSpeed * emotionSpeed * styleSpeed * (0.35 + distanceScale * 0.75)
    );

    // Biomechanical-ish braking curve: reduce cruise speed when near stop zone.
    const brakingDistance =
      (horizontalSpeedRef.current * horizontalSpeedRef.current) /
      (2 * Math.max(40, decel));
    const shouldBrake = distance < brakingDistance + ARRIVAL_THRESHOLD * 0.8;
    const brakingFactor = shouldBrake
      ? clamp(distance / Math.max(brakingDistance + ARRIVAL_THRESHOLD, 1), 0.2, 1)
      : 1;
    const baseTargetSpeed = Math.max(MIN_CRUISE_SPEED * 0.45, cruiseSpeed * brakingFactor);

    // Turn in place briefly before translating to avoid instantaneous side flips.
    if (turnPauseRef.current > 0) {
      turnPauseRef.current = Math.max(0, turnPauseRef.current - delta);
      horizontalSpeedRef.current = Math.max(0, horizontalSpeedRef.current - decel * 2.2 * delta);
      previousDistanceRef.current = distance;
      if (turnPauseRef.current > 0) {
        return;
      }
    }

    // Step pulse follows gait phase (instead of wall clock) to reduce drift-like movement.
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
    const newY = floorY;

    // Clamp to bounds
    const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, newX));
    const clampedY = Math.min(newY, bounds.maxY);

    const blockedAtBoundary =
      (dx < 0 && position.x <= bounds.minX + 0.5) ||
      (dx > 0 && position.x >= bounds.maxX - 0.5);
    const movedThisFrame = Math.abs(clampedX - position.x) > 0.08;

    if (blockedAtBoundary) {
      setTargetPosition(null);
      setIsMoving(false);
      setAnimationState('idle');
      turnPauseRef.current = 0;
      horizontalSpeedRef.current = 0;
      previousDistanceRef.current = null;
      stuckTimeRef.current = 0;
      return;
    }

    if (
      previousDistanceRef.current !== null &&
      distance >= previousDistanceRef.current - 0.15 &&
      !movedThisFrame
    ) {
      stuckTimeRef.current += delta;
    } else {
      stuckTimeRef.current = 0;
    }
    previousDistanceRef.current = distance;

    if (stuckTimeRef.current > 0.22) {
      setTargetPosition(null);
      setIsMoving(false);
      setAnimationState('idle');
      turnPauseRef.current = 0;
      horizontalSpeedRef.current = 0;
      previousDistanceRef.current = null;
      stuckTimeRef.current = 0;
      return;
    }

    if (moveDistance >= distance - 0.25) {
      setPosition({ x: targetPosition.x, y: clampedY });
      setTargetPosition(null);
      setIsMoving(false);
      setAnimationState('idle');
      turnPauseRef.current = 0;
      horizontalSpeedRef.current = 0;
      previousDistanceRef.current = null;
      stuckTimeRef.current = 0;
      return;
    }

    if (movedThisFrame || Math.abs(clampedY - position.y) > 0.05) {
      setPosition({ x: clampedX, y: clampedY });
    }
  });

  return null;
}
