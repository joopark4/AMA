# 메모리 누수 수정 가이드

## P0 (즉시 수정)

### 1. AvatarController.tsx — 중첩 setTimeout 누수 제거

**현재 코드 (문제):**
```typescript
// Line 114-116
const autoMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const verticalVelocityRef = useRef(0);
const emotionActionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// Line 157-211
const scheduleAutoMove = useCallback(() => {
  if (!autoRoam || freeMovement) return;
  if (autoMoveTimerRef.current) clearTimeout(autoMoveTimerRef.current);

  const state = useAvatarStore.getState();
  const profile = getEmotionTuning(state.emotion);
  const delay = AUTO_MOVE_MIN_DELAY + Math.random() * (AUTO_MOVE_MAX_DELAY - AUTO_MOVE_MIN_DELAY);
  const tunedDelay = delay * profile.autoMoveDelayMultiplier;

  // ❌ 문제: 이 타이머가 새로운 타이머를 생성하면서 참조 손실
  autoMoveTimerRef.current = setTimeout(() => {
    const s = useAvatarStore.getState();
    if (s.isDragging) {
      scheduleAutoMove();
      return;
    }

    if (s.targetPosition || s.isMoving) {
      // ❌ 새 타이머 생성 — 이전 참조 덮어씌움
      autoMoveTimerRef.current = setTimeout(() => scheduleAutoMove(), 1000);
      return;
    }

    // ... 액션 실행 ...
    scheduleAutoMove();
  }, tunedDelay);
}, [autoRoam, freeMovement, avatarScale, getScreenBounds]);
```

**수정 코드:**
```typescript
// Line 114-117: 타이머 배열 추가
const autoMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const verticalVelocityRef = useRef(0);
const emotionActionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const pendingAutoMoveTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

const scheduleAutoMove = useCallback(() => {
  if (!autoRoam || freeMovement) return;

  // 이전 주 타이머 정리
  if (autoMoveTimerRef.current) clearTimeout(autoMoveTimerRef.current);

  // 펀딩 중인 내부 타이머도 모두 정리
  pendingAutoMoveTimersRef.current.forEach(clearTimeout);
  pendingAutoMoveTimersRef.current.clear();

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

    if (s.targetPosition || s.isMoving) {
      // ✅ 수정: 내부 타이머를 Set에 추가하여 추적
      const retryTimer = setTimeout(() => scheduleAutoMove(), 1000);
      pendingAutoMoveTimersRef.current.add(retryTimer);
      return;
    }

    // ... 액션 실행 ...
    scheduleAutoMove();
  }, tunedDelay);
}, [autoRoam, freeMovement, avatarScale, getScreenBounds]);

// Line 271-287: cleanup 수정
useEffect(() => {
  if (effectiveAutoRoam) {
    scheduleAutoMove();
  } else {
    if (autoMoveTimerRef.current) clearTimeout(autoMoveTimerRef.current);
    // ✅ 수정: 펀딩 타이머도 정리
    pendingAutoMoveTimersRef.current.forEach(clearTimeout);
    pendingAutoMoveTimersRef.current.clear();

    const state = useAvatarStore.getState();
    state.setTargetPosition(null);
    state.setIsMoving(false);
    state.setAnimationState('idle');
  }
  return () => {
    if (autoMoveTimerRef.current) clearTimeout(autoMoveTimerRef.current);
    if (emotionActionRef.current) clearTimeout(emotionActionRef.current);
    // ✅ 수정: cleanup도 펀딩 타이머 정리
    pendingAutoMoveTimersRef.current.forEach(clearTimeout);
    pendingAutoMoveTimersRef.current.clear();
  };
}, [effectiveAutoRoam, scheduleAutoMove]);
```

---

### 2. VRMAvatar.tsx — requestAnimationFrame 누수 제거

**현재 코드 (문제):**
```typescript
// Line 950-974
useEffect(() => {
  let retries = 0;
  let retryFrame: number | null = null;

  const trySolveGround = () => {
    const solveGroundPositionY = solveGroundPositionY;  // Line 900부터 정의된 콜백

    if (solveGroundPositionY && !isGroundSolved) {
      const result = solveGroundPositionY(vrm, renderer);
      if (result !== null) {
        setGroundY(result);
        return;  // ✅ 성공 시 루프 종료
      }
    }

    if (retries >= MAX_GROUND_SOLVE_RETRIES) return;  // 종료 조건

    retries += 1;
    // ❌ 문제: 이전 frame이 정리되지 않은 채 새 frame 등록
    retryFrame = window.requestAnimationFrame(trySolveGround);
  };

  trySolveGround();
  window.addEventListener('resize', trySolveGround);
  return () => {
    // ❌ 가장 최근 frame만 취소 (중간에 생성된 frame은 미취소)
    if (retryFrame !== null) {
      window.cancelAnimationFrame(retryFrame);
    }
    window.removeEventListener('resize', trySolveGround);
  };
}, [vrm, settings.avatar?.scale, setGroundY, solveGroundPositionY]);
```

**수정 코드:**
```typescript
// Line 950-977
useEffect(() => {
  let retries = 0;
  // ✅ 수정: 모든 requestAnimationFrame ID를 추적
  const pendingFramesRef = { current: new Set<number>() };

  const trySolveGround = () => {
    const solveGroundPositionY = solveGroundPositionY;

    if (solveGroundPositionY && !isGroundSolved) {
      const result = solveGroundPositionY(vrm, renderer);
      if (result !== null) {
        setGroundY(result);
        // 성공 시 모든 펀딩 frame 정리
        pendingFramesRef.current.forEach(cancelAnimationFrame);
        pendingFramesRef.current.clear();
        return;
      }
    }

    if (retries >= MAX_GROUND_SOLVE_RETRIES) {
      // 종료 시에도 정리
      pendingFramesRef.current.forEach(cancelAnimationFrame);
      pendingFramesRef.current.clear();
      return;
    }

    retries += 1;
    // ✅ 수정: frame ID를 Set에 추가하여 추적
    const frameId = window.requestAnimationFrame(trySolveGround);
    pendingFramesRef.current.add(frameId);
  };

  trySolveGround();
  window.addEventListener('resize', trySolveGround);
  return () => {
    // ✅ 수정: 모든 펀딩 frame 정리
    pendingFramesRef.current.forEach(cancelAnimationFrame);
    pendingFramesRef.current.clear();
    window.removeEventListener('resize', trySolveGround);
  };
}, [vrm, settings.avatar?.scale, setGroundY, solveGroundPositionY]);
```

---

### 3. MotionDemoSequence.tsx — 배열 메모리 해제

**현재 코드 (문제):**
```typescript
// Line 100-119
useEffect(() => {
  if (startedRef.current) return;
  startedRef.current = true;

  // ... steps 정의 ...

  let delay = 3000;
  const timers: ReturnType<typeof setTimeout>[] = [];  // ❌ 클로저 캡처

  for (const step of steps) {
    timers.push(
      setTimeout(() => {
        log(step.label);
        step.action();
      }, delay),
    );
    delay += step.durationMs;
  }

  log(`데모 시작...`);

  return () => {
    timers.forEach(clearTimeout);  // 타이머는 정리됨
    settings().setAvatarSettings({ autoRoam: false });
    // ❌ 문제: timers 배열 자체는 메모리에 유지됨
  };
}, []);
```

**수정 코드:**
```typescript
// Line 100-122
useEffect(() => {
  if (startedRef.current) return;
  startedRef.current = true;

  // ... steps 정의 ...

  let delay = 3000;
  const timers: ReturnType<typeof setTimeout>[] = [];

  for (const step of steps) {
    timers.push(
      setTimeout(() => {
        log(step.label);
        step.action();
      }, delay),
    );
    delay += step.durationMs;
  }

  log(`데모 시작...`);

  return () => {
    timers.forEach(clearTimeout);
    timers.length = 0;  // ✅ 수정: 배열 리셋
    settings().setAvatarSettings({ autoRoam: false });
  };
}, []);
```

---

## P1 (1주 내 수정)

### 4. LocomotionClipManager.ts — 지연 정리 타이머 추적

**현재 코드 (문제):**
```typescript
// Line 56-72
export class LocomotionClipManager {
  private mixer: THREE.AnimationMixer;
  private vrm: VRM;
  private clipCache = new Map<string, THREE.AnimationClip>();
  private clipAccessOrder: string[] = [];
  private actionCache = new Map<string, THREE.AnimationAction>();
  private currentWalkAction: THREE.AnimationAction | null = null;
  private currentIdleAction: THREE.AnimationAction | null = null;
  private currentGestureAction: THREE.AnimationAction | null = null;
  private gestureFinishedHandler: ((e: { action: THREE.AnimationAction }) => void) | null = null;
  private currentWalkEmotion = '';
  private currentIdleEmotion = '';
  private _isWalking = false;
  private _isIdling = false;
  private loading = new Set<string>();
  private disposed = false;

  // ... 메서드들 ...

  async playWalk(emotion: Emotion): Promise<void> {
    // ...
    // ❌ 문제: 이 타이머가 dispose 호출 후에도 실행될 수 있음
    setTimeout(() => this.cleanupAction(prev), CROSSFADE_DURATION * 1000 + 100);
  }

  dispose(): void {
    this.disposed = true;
    this.stopAll();

    if (this.gestureFinishedHandler) {
      this.mixer.removeEventListener('finished', this.gestureFinishedHandler);
      this.gestureFinishedHandler = null;
    }

    this.actionCache.forEach((action) => {
      action.stop();
      this.mixer.uncacheAction(action.getClip());
    });
    // ... 정리 ...
  }
}
```

**수정 코드:**
```typescript
// Line 56-77
export class LocomotionClipManager {
  private mixer: THREE.AnimationMixer;
  private vrm: VRM;
  private clipCache = new Map<string, THREE.AnimationClip>();
  private clipAccessOrder: string[] = [];
  private actionCache = new Map<string, THREE.AnimationAction>();
  private currentWalkAction: THREE.AnimationAction | null = null;
  private currentIdleAction: THREE.AnimationAction | null = null;
  private currentGestureAction: THREE.AnimationAction | null = null;
  private gestureFinishedHandler: ((e: { action: THREE.AnimationAction }) => void) | null = null;
  private currentWalkEmotion = '';
  private currentIdleEmotion = '';
  private _isWalking = false;
  private _isIdling = false;
  private loading = new Set<string>();
  private disposed = false;
  // ✅ 수정: 지연 정리 타이머 추적
  private cleanupTimeoutsRef = new Set<ReturnType<typeof setTimeout>>();

  // ... 메서드들 ...

  async playWalk(emotion: Emotion): Promise<void> {
    if (this.disposed) return;
    const fbxPath = EMOTION_WALK_MAP[emotion] ?? EMOTION_WALK_MAP.neutral;
    if (this._isWalking && this.currentWalkEmotion === emotion) return;

    if (this._isIdling) this.stopIdle();

    this.currentWalkEmotion = emotion;
    this._isWalking = true;

    try {
      const clip = await this.getOrLoadClip(fbxPath, `walk_${emotion}`);
      if (!clip || this.disposed) return;

      const action = this.getOrCreateAction(fbxPath, clip);
      action.setLoop(THREE.LoopRepeat, Infinity);

      if (this.currentWalkAction && this.currentWalkAction !== action) {
        const prev = this.currentWalkAction;
        action.reset().setEffectiveWeight(1).play();
        prev.crossFadeTo(action, CROSSFADE_DURATION, true);

        // ✅ 수정: 타이머를 Set에 추가하여 추적
        const timeoutId = setTimeout(() => {
          if (!this.disposed) {
            this.cleanupAction(prev);
          }
          this.cleanupTimeoutsRef.delete(timeoutId);
        }, CROSSFADE_DURATION * 1000 + 100);
        this.cleanupTimeoutsRef.add(timeoutId);
      } else if (!this.currentWalkAction) {
        action.reset().setEffectiveWeight(1).fadeIn(CROSSFADE_DURATION).play();
      }
      this.currentWalkAction = action;
    } catch (err) {
      console.warn('[ClipManager] Walk clip failed:', err);
    }
  }

  async playIdle(emotion: Emotion): Promise<void> {
    if (this.disposed) return;
    const fbxPath = EMOTION_IDLE_MAP[emotion] ?? EMOTION_IDLE_MAP.neutral;
    if (this._isIdling && this.currentIdleEmotion === emotion) return;

    this.currentIdleEmotion = emotion;
    this._isIdling = true;

    try {
      const clip = await this.getOrLoadClip(fbxPath, `idle_${emotion}`);
      if (!clip || this.disposed) return;

      const action = this.getOrCreateAction(fbxPath, clip);
      action.setLoop(THREE.LoopRepeat, Infinity);

      if (this.currentIdleAction && this.currentIdleAction !== action) {
        const prev = this.currentIdleAction;
        action.reset().setEffectiveWeight(1).play();
        prev.crossFadeTo(action, CROSSFADE_DURATION, true);

        // ✅ 수정: 타이머를 Set에 추가하여 추적
        const timeoutId = setTimeout(() => {
          if (!this.disposed) {
            this.cleanupAction(prev);
          }
          this.cleanupTimeoutsRef.delete(timeoutId);
        }, CROSSFADE_DURATION * 1000 + 100);
        this.cleanupTimeoutsRef.add(timeoutId);
      } else if (!this.currentIdleAction) {
        action.reset().setEffectiveWeight(1).fadeIn(CROSSFADE_DURATION).play();
      }
      this.currentIdleAction = action;
    } catch (err) {
      console.warn('[ClipManager] Idle clip failed:', err);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stopAll();

    // ✅ 수정: 모든 대기 중인 정리 타이머 취소
    this.cleanupTimeoutsRef.forEach(clearTimeout);
    this.cleanupTimeoutsRef.clear();

    if (this.gestureFinishedHandler) {
      this.mixer.removeEventListener('finished', this.gestureFinishedHandler);
      this.gestureFinishedHandler = null;
    }

    this.actionCache.forEach((action) => {
      action.stop();
      this.mixer.uncacheAction(action.getClip());
    });
    this.clipCache.forEach((clip) => {
      this.mixer.uncacheClip(clip);
    });
    this.clipCache.clear();
    this.clipAccessOrder = [];
    this.actionCache.clear();
  }
}
```

---

### 5. VRMAvatar.tsx — THREE.js 완전 리소스 정리

**현재 코드 (문제):**
```typescript
// VRMAvatar.tsx에서 VRM 로딩 후 언마운트 시
useEffect(() => {
  // ... VRM 로딩 로직 ...

  return () => {
    // ❌ 문제: 불완전한 정리
    if (locomotionClipRef.current) {
      locomotionClipRef.current.dispose();
    }
    // ❌ mixerRef.current는 정리되지 않음
  };
}, [/* 의존성 */]);
```

**수정 코드:**
```typescript
// VRMAvatar.tsx의 주요 useEffect에 추가
useEffect(() => {
  // ... VRM 로딩 로직 ...

  return () => {
    // ✅ 수정: 완전한 THREE.js 리소스 정리

    // 1. LocomotionClipManager 정리
    if (locomotionClipRef.current) {
      locomotionClipRef.current.dispose();
      locomotionClipRef.current = null;
    }

    // 2. AnimationMixer 정리
    if (mixerRef.current) {
      // 모든 액션 중지
      (mixerRef.current as any)._actions?.forEach((action: THREE.AnimationAction) => {
        action.stop();
      });

      // 모든 캐시 정리
      (mixerRef.current as any)._actionsByClip?.clear?.();
      (mixerRef.current as any)._clips?.clear?.();

      // 이벤트 리스너 제거
      mixerRef.current.uncacheRoot(mixerRef.current.getRoot());
      mixerRef.current = null;
    }

    // 3. VRM 씬 깊은 정리
    if (vrm) {
      // VRM 특화 정리
      if (vrm.scene) {
        VRMUtils.deepDispose(vrm.scene);
      }

      // 표현 관리자 정리
      if (vrm.expressionManager) {
        vrm.expressionManager.resetAll();
      }
    }

    // 4. 기타 refs 정리
    prevScreenPosRef.current = null;
    clockRef.current = new THREE.Clock();
    setManualRotation = { x: 0, y: 0 };
  };
}, [vrm, /* 기타 의존성 */]);
```

---

## P2 (권고 사항)

### 6. DragController.tsx — 의존성 배열 최적화

**현재 코드:**
```typescript
useEffect(() => {
  window.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);

  return () => {
    window.removeEventListener('mousedown', handleMouseDown);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };
}, [handleMouseDown, handleMouseMove, handleMouseUp]);
```

**개선 제안:**
```typescript
// 핸들러들을 메모이제이션하되, 불필요한 의존성 제거
const handleMouseDown = useCallback((e: MouseEvent) => {
  const scale = settings.avatar?.scale || 1.0;
  // ... position과 setIsDragging만 필요
}, [position, setIsDragging, settings.avatar?.scale]);

const handleMouseMove = useCallback((e: MouseEvent) => {
  if (!isDragging) return;
  // ... isDragging, bounds, setPosition만 필요
}, [isDragging, bounds, setPosition]);

const handleMouseUp = useCallback(() => {
  if (isDragging) setIsDragging(false);
}, [isDragging, setIsDragging]);

// 리스너는 의존성 없이 한 번만 등록
useEffect(() => {
  window.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);

  return () => {
    window.removeEventListener('mousedown', handleMouseDown);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };
}, [handleMouseDown, handleMouseMove, handleMouseUp]);
```

---

### 7. ExpressionController.tsx — 타이머 처리 일관성

**현재 코드:**
```typescript
useEffect(() => {
  switch (status) {
    case 'processing':
      if (emotion === 'neutral') {
        setEmotion('thinking');
      }
      break;
    case 'error':
      setEmotion('sad');
      break;
    case 'idle': {
      if (emotion === 'neutral') break;
      const holdMs = Math.max(...);
      const timer = setTimeout(() => setEmotion('neutral'), holdMs);
      return () => clearTimeout(timer);  // ✅ 타이머만 정리
    }
  }
  // ❌ 다른 case는 cleanup 없음 (일관성 부족)
}, [status, setEmotion, emotion]);
```

**개선 제안:**
```typescript
useEffect(() => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  switch (status) {
    case 'processing':
      if (emotion === 'neutral') {
        setEmotion('thinking');
      }
      break;
    case 'error':
      setEmotion('sad');
      break;
    case 'idle': {
      if (emotion === 'neutral') break;
      const holdMs = Math.max(
        emotionTuningGlobal.idleNeutralDelayMs,
        getEmotionTuning(emotion).expressionHoldMs
      );
      timer = setTimeout(() => setEmotion('neutral'), holdMs);
      break;
    }
  }

  return () => {
    if (timer) clearTimeout(timer);
  };
}, [status, setEmotion, emotion]);
```

---

## 📋 검증 체크리스트

각 수정 후 다음 항목을 검증하세요:

- [ ] Chrome DevTools Memory Profiler로 힙 스냅샷 비교
- [ ] 1시간 자동 배회 후 메모리 증가 < 50MB
- [ ] 개발 모드 HMR 10회 반복 후 메모리 안정
- [ ] 아바타 빠른 교체(VRM 변경) 5회 후 이전 mixer 정리 확인
- [ ] `console.log('[Memory]', performance.memory)` 모니터링
- [ ] 유닛 테스트 통과

---

**문서 작성:** 2026-03-26
**관련 감사:** MEMORY_LEAK_AUDIT.md
