import { create } from 'zustand';
import type { VRM } from '@pixiv/three-vrm';

export type Emotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'relaxed' | 'thinking';
export type AnimationState = 'idle' | 'walking' | 'talking' | 'waving' | 'thinking' | 'gesturing' | 'dancing';
export type GestureType = 'wave' | 'nod' | 'shake' | 'shrug' | 'thinking' | 'celebrate' | 'jump' | null;
export type MotionClipId = string;
export type LocomotionStyle = 'stroll' | 'brisk' | 'sneak' | 'bouncy';

export interface Position {
  x: number;
  y: number;
}

export interface AvatarBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface AvatarInteractionBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface AvatarState {
  vrm: VRM | null;
  isLoaded: boolean;
  isLoading: boolean;
  loadError: string | null;

  position: Position;
  targetPosition: Position | null;
  velocity: Position;

  emotion: Emotion;
  animationState: AnimationState;
  lipSyncValue: number;

  // Gesture state
  currentGesture: GestureType;
  gestureProgress: number;
  gestureQueue: GestureType[];

  // Motion clip state
  currentMotionClip: MotionClipId | null;
  motionProgress: number;
  motionQueue: MotionClipId[];
  recentMotionIds: MotionClipId[];
  motionCooldownMap: Record<string, number>;

  // Dance state
  isDancing: boolean;
  danceEnergy: number;
  beatPhase: number;

  // Expression blending
  targetExpressionValues: Record<string, number>;
  currentExpressionValues: Record<string, number>;

  bounds: AvatarBounds;
  interactionBounds: AvatarInteractionBounds | null;
  groundY: number | null;
  locomotionStyle: LocomotionStyle;
  isDragging: boolean;
  isRotating: boolean;
  isMoving: boolean;
  facingRight: boolean;

  // Manual rotation (from head drag)
  manualRotation: { x: number; y: number };

  setVRM: (vrm: VRM | null) => void;
  setIsLoaded: (isLoaded: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setLoadError: (error: string | null) => void;

  setPosition: (position: Position) => void;
  setTargetPosition: (target: Position | null) => void;
  setVelocity: (velocity: Position) => void;

  setEmotion: (emotion: Emotion) => void;
  setAnimationState: (state: AnimationState) => void;
  setLipSyncValue: (value: number) => void;

  // Gesture actions
  triggerGesture: (gesture: GestureType) => void;
  setGestureProgress: (progress: number) => void;
  clearGesture: () => void;
  resetGestures: () => void;

  // Motion clip actions
  triggerMotionClip: (motionId: MotionClipId) => void;
  setMotionProgress: (progress: number) => void;
  clearMotionClip: () => void;
  registerMotionSelection: (motionId: MotionClipId, cooldownMs: number) => void;
  resetMotionState: () => void;

  // Dance actions
  startDancing: () => void;
  stopDancing: () => void;
  setDanceEnergy: (energy: number) => void;
  setBeatPhase: (phase: number) => void;

  // Expression actions
  setTargetExpression: (expressions: Record<string, number>) => void;
  setCurrentExpression: (expressions: Record<string, number>) => void;

  setBounds: (bounds: AvatarBounds) => void;
  setInteractionBounds: (bounds: AvatarInteractionBounds | null) => void;
  setGroundY: (groundY: number | null) => void;
  setLocomotionStyle: (style: LocomotionStyle) => void;
  setIsDragging: (isDragging: boolean) => void;
  setIsRotating: (isRotating: boolean) => void;
  setIsMoving: (isMoving: boolean) => void;
  setFacingRight: (facingRight: boolean) => void;
  setManualRotation: (rotation: { x: number; y: number }) => void;
}

const getInitialBounds = (): AvatarBounds => {
  if (typeof window !== 'undefined') {
    const defaultScale = 1.0;
    // Horizontal margin target: 8% of viewport width.
    const marginX = Math.max(
      window.innerWidth * 0.08,
      Math.max(80, 120 * defaultScale)
    );
    const floorY = window.innerHeight - Math.max(95, 130 * defaultScale) - 8;

    return {
      minX: marginX,
      maxX: window.innerWidth - marginX,
      minY: floorY,
      maxY: floorY,
    };
  }
  return { minX: 120, maxX: 1800, minY: 900, maxY: 900 };
};

const getInitialPosition = (): Position => {
  const initialBounds = getInitialBounds();
  return {
    x: initialBounds.maxX,
    y: initialBounds.maxY,
  };
};

export const useAvatarStore = create<AvatarState>((set, get) => ({
  vrm: null,
  isLoaded: false,
  isLoading: false,
  loadError: null,

  position: getInitialPosition(),
  targetPosition: null,
  velocity: { x: 0, y: 0 },

  emotion: 'neutral',
  animationState: 'idle',
  lipSyncValue: 0,

  // Gesture state
  currentGesture: null,
  gestureProgress: 0,
  gestureQueue: [],

  // Motion clip state
  currentMotionClip: null,
  motionProgress: 0,
  motionQueue: [],
  recentMotionIds: [],
  motionCooldownMap: {},

  // Dance state
  isDancing: false,
  danceEnergy: 0,
  beatPhase: 0,

  // Expression blending
  targetExpressionValues: {},
  currentExpressionValues: {},

  bounds: getInitialBounds(),
  interactionBounds: null,
  groundY: null,
  locomotionStyle: 'stroll',
  isDragging: false,
  isRotating: false,
  isMoving: false,
  facingRight: true,
  manualRotation: { x: 0, y: 0 },

  setVRM: (vrm) =>
    set({
      vrm,
      isLoaded: vrm !== null,
      loadError: null,
      currentGesture: null,
      gestureProgress: 0,
      gestureQueue: [],
      currentMotionClip: null,
      motionProgress: 0,
      motionQueue: [],
    }),
  setIsLoaded: (isLoaded) => set({ isLoaded }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setLoadError: (error) => set({ loadError: error, isLoading: false }),

  setPosition: (position) => set({ position }),
  setTargetPosition: (target) => set({ targetPosition: target }),
  setVelocity: (velocity) => set({ velocity }),

  setEmotion: (emotion) => set({ emotion }),
  setAnimationState: (state) => set({ animationState: state }),
  setLipSyncValue: (value) => set({ lipSyncValue: Math.max(0, Math.min(1, value)) }),

  // Gesture actions
  triggerGesture: (gesture) => {
    const { currentGesture, gestureQueue } = get();
    if (currentGesture === null) {
      set({ currentGesture: gesture, gestureProgress: 0 });
    } else {
      // Queue the gesture if one is already playing
      set({ gestureQueue: [...gestureQueue, gesture] });
    }
  },
  setGestureProgress: (progress) => set({ gestureProgress: progress }),
  clearGesture: () => {
    const { gestureQueue } = get();
    if (gestureQueue.length > 0) {
      const [nextGesture, ...rest] = gestureQueue;
      set({ currentGesture: nextGesture, gestureProgress: 0, gestureQueue: rest });
    } else {
      set({ currentGesture: null, gestureProgress: 0 });
    }
  },
  resetGestures: () => set({ currentGesture: null, gestureProgress: 0, gestureQueue: [] }),

  // Motion clip actions
  triggerMotionClip: (motionId) => {
    if (!motionId) return;
    const { currentMotionClip, motionQueue } = get();
    if (currentMotionClip === null) {
      set({ currentMotionClip: motionId, motionProgress: 0 });
    } else {
      set({ motionQueue: [...motionQueue, motionId] });
    }
  },
  setMotionProgress: (progress) =>
    set({ motionProgress: Math.max(0, Math.min(1, progress)) }),
  clearMotionClip: () => {
    const { motionQueue } = get();
    if (motionQueue.length > 0) {
      const [nextMotionId, ...rest] = motionQueue;
      set({ currentMotionClip: nextMotionId, motionProgress: 0, motionQueue: rest });
    } else {
      set({ currentMotionClip: null, motionProgress: 0 });
    }
  },
  registerMotionSelection: (motionId, cooldownMs) =>
    set((state) => {
      const nextRecent = [
        motionId,
        ...state.recentMotionIds.filter((id) => id !== motionId),
      ].slice(0, 12);

      const now = Date.now();
      const nextCooldownMap = Object.fromEntries(
        Object.entries(state.motionCooldownMap).filter(([, until]) => until > now)
      ) as Record<string, number>;

      nextCooldownMap[motionId] = now + Math.max(0, cooldownMs);

      return {
        recentMotionIds: nextRecent,
        motionCooldownMap: nextCooldownMap,
      };
    }),
  resetMotionState: () =>
    set({
      currentMotionClip: null,
      motionProgress: 0,
      motionQueue: [],
      recentMotionIds: [],
      motionCooldownMap: {},
    }),
  // Dance actions
  startDancing: () => set({ isDancing: true, danceEnergy: 0.5 }),
  stopDancing: () => set({ isDancing: false, danceEnergy: 0, beatPhase: 0 }),
  setDanceEnergy: (energy) => set({ danceEnergy: Math.max(0, Math.min(1, energy)) }),
  setBeatPhase: (phase) => set({ beatPhase: phase }),

  // Expression actions
  setTargetExpression: (expressions) => set({ targetExpressionValues: expressions }),
  setCurrentExpression: (expressions) => set({ currentExpressionValues: expressions }),

  setBounds: (bounds) => set({ bounds }),
  setInteractionBounds: (interactionBounds) => set({ interactionBounds }),
  setGroundY: (groundY) => set({ groundY }),
  setLocomotionStyle: (locomotionStyle) => set({ locomotionStyle }),
  setIsDragging: (isDragging) => set({ isDragging }),
  setIsRotating: (isRotating) => set({ isRotating }),
  setIsMoving: (isMoving) => set({ isMoving }),
  setFacingRight: (facingRight) => set({ facingRight }),
  setManualRotation: (rotation) => set({ manualRotation: rotation }),
}));
