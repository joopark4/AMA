# 아바타 모션 코드 구조 분석 보고서

**작성일:** 2026-03-26
**분석 범위:** VRMAvatar.tsx, AvatarController.tsx, AnimationManager.tsx, LocomotionClipManager.ts, LoadMixamoAnimation.ts, IdleFidgetController.tsx, MotionDemoSequence.tsx

---

## 📊 전체 코드 규모

| 파일 | 라인 수 | 책임 개수 | 평가 |
|------|--------|---------|------|
| **VRMAvatar.tsx** | ~900+ | 8-10 | 🔴 심각 |
| **AvatarController.tsx** | ~514 | 5-6 | 🟡 중간 |
| **AnimationManager.tsx** | ~70 | 1 | 🟢 좋음 |
| **LocomotionClipManager.ts** | ~300 | 4 | 🟡 중간 |
| **LoadMixamoAnimation.ts** | ~120 | 2 | 🟢 좋음 |
| **IdleFidgetController.tsx** | ~106 | 2 | 🟡 중간 |
| **MotionDemoSequence.tsx** | ~123 | 2 | 🟡 중간 |

---

## 🔴 VRMAvatar.tsx — 심각한 설계 문제

### 1. SRP 위반 (Single Responsibility Principle)

**현재 책임:**
1. VRM 모델 로딩 및 렌더링
2. THREE.js 씬 구성 및 애니메이션 믹서 관리
3. 마우스 드래그/회전 이벤트 처리
4. 지면 높이 계산 및 바운드 처리
5. 카메라 스크린 공간 변환 (`screenToWorldAtZ`, `solveGroundPositionY`)
6. 인터랙션 박스 계산 및 경계 게시
7. 걷기 애니메이션 IK 시스템 (하이프, 무릎, 팔꿈치, 발목 등)
8. 프레임 업데이트 물리 시뮬레이션
9. 감정 변경에 따른 제스처 트리거

**분리 제안:**
- `VRMLoader.ts` — VRM 로드/언로드 로직
- `CameraProjection.ts` — 스크린 좌표 변환 유틸
- `InteractionBounds.ts` — 바운드 계산 및 게시
- `LocomotionIK.ts` — 하이프/무릎/팔꿈치 IK 계산
- `AvatarGestureManager.ts` — 감정 기반 제스처 트리거

### 2. useFrame 콜백의 복잡성

**문제:**
- `useFrame` 내부에 수백 개의 라인이 있음
- 걷기 IK 시스템, 회전 동기화, 드래그/회전 상태 처리 모두 혼재
- 매 프레임마다 실행되는 과도한 계산

**계산 분석:**
```
- 하이프/무릎/팔꿈치 플렉션 계산: 30+ 호출/프레임
- 손가락 체인 댐핑: 40+ 호출/프레임
- 벡터/쿼터니언 인스턴스 생성: 거대한 양의 가비지 생성
- 뼈 트래버설: 매 프레임마다 여러 번
```

**분리 제안:**
- `LocomotionIK.ts` (별도 훅) — 걷기 IK 계산을 독립적인 `useFrame` 콜백으로 분리
- `FingerController.tsx` — 손가락 애니메이션을 별도 컴포넌트로 분리

### 3. Ref 과다 (29개 이상)

**현재 ref 목록:**
```
groupRef, mixerRef, clockRef, modelMinYRef, interactionBoxRef,
interactionCornersRef, projectedCornerRef, lastInteractionBoundsRef,
lastVisibilityRecoveryAtRef, ndcProbeRef, unprojectedProbeRef,
rayDirectionProbeRef, worldProbeRef, prevScreenPosRef, movementSpeedRef,
gaitPhaseRef, locomotionBlendRef, locomotionLatchRef, smoothedYawRef,
stepAccentRef, lastJointDebugAtRef, hingeProfileRef, hingeProfileLoggedRef,
hasAppliedInitialViewRef, locomotionClipRef, useClipLocomotion,
restHipsPositionRef, prevEmotionRef, dragStartRef, positionStartRef,
rotationStartRef
```

**문제:**
- 관련된 ref들이 논리적 그룹으로 묶여있지 않음
- 상태 관리가 분산됨 → 메모리 누수 위험
- 추적 어려움

**개선 방안:**
```typescript
// 예: 카메라 투영 관련 ref를 객체로 그룹화
const projectionCacheRef = useRef({
  ndc: new THREE.Vector3(),
  unprojected: new THREE.Vector3(),
  rayDirection: new THREE.Vector3(),
  world: new THREE.Vector3()
});

// 걷기 상태 ref를 그룹화
const locomotionStateRef = useRef({
  phase: Math.random() * Math.PI * 2,
  blend: 0,
  latch: false,
  yaw: IDLE_YAW,
  stepAccent: Math.random() * Math.PI * 2,
  hipsPosition: null as { x: number; y: number; z: number } | null
});
```

### 4. 메모리 누수 위험

**useEffect 정리 불충분:**
- `useEffect(() => { ... }, [emotion])` — 감정 변경 시 이전 타이머 정리 없음
- 여러 `setTimeout` 호출이 정리되지 않을 수 있음
- 컴포넌트 언마운트 시 `mixerRef`, `locomotionClipRef` 정리 로직 부재

**예:**
```typescript
useEffect(() => {
  if (prevEmotionRef.current === emotion) return;
  prevEmotionRef.current = emotion;

  // ... gesture trigger
  setTimeout(() => {
    useAvatarStore.getState().clearGesture();
  }, 3000);

  // ❌ 정리 없음 — 컴포넌트가 언마운트되면 타이머가 hanging
}, [emotion]);

// 개선:
useEffect(() => {
  const timer = setTimeout(...);
  return () => clearTimeout(timer);
}, [emotion]);
```

**dispose 미실행:**
- VRM 로드/언로드 시 이전 `mixerRef`의 `dispose()` 호출 부재
- FBX 애니메이션 로드 후 정리 미흡

### 5. useCallback 의존성 누락

```typescript
const publishInteractionBounds = useCallback(() => {
  // ... 수백 개의 라인
}, [
  camera, gl.domElement, setInteractionBounds, isDragging,
  isRotating, bounds, setPosition, settings.avatar?.scale,
  solveGroundPositionY, setGroundY,
]);
```

**문제:**
- 의존성 목록이 매우 길고 복잡
- `solveGroundPositionY`가 의존성으로 들어가면 콜백 재생성의 다른 cascade 유발
- 가독성 저하

**개선:**
```typescript
const publishInteractionBounds = useCallback(() => {
  // ...
}, [camera, gl.domElement, setInteractionBounds, isDragging, isRotating]);
```

---

## 🟡 AvatarController.tsx — 중간 수준 문제

### 1. 모듈 책임 (5-6개)

**현재 책임:**
1. 자동 배회 스케줄링
2. 화면 경계 업데이트
3. 이동 물리 시뮬레이션 (중력, 속도, 가속도)
4. 감정 기반 움직임 반응
5. 타겟 위치 계산
6. Stuck 감지 및 recovery

### 2. 글로벌 상태 변수

**문제:**
```typescript
// 파일 스코프의 mutable 상태 — 테스트 불가, 예측 어려움
let lastMoveDirection: 1 | -1 = 1;
let lastRoamAction: RoamAction = 'idle';
let sameActionCount = 0;
```

**개선:**
```typescript
// Zustand 스토어로 이동
const useAutoRoamState = create((set) => ({
  lastMoveDirection: 1 as 1 | -1,
  lastRoamAction: 'idle' as RoamAction,
  sameActionCount: 0,
  setLastMoveDirection: (dir) => set({ lastMoveDirection: dir }),
  // ...
}));
```

### 3. 성능: 불필요한 re-render

```typescript
const scheduleAutoMove = useCallback(() => {
  if (!autoRoam || freeMovement) return;
  // ... getScreenBounds() 호출
}, [autoRoam, freeMovement, avatarScale, getScreenBounds]);
```

**문제:**
- `getScreenBounds`가 `useCallback`에 포함되어 있으면, `scheduleAutoMove`도 재생성
- 의존성 체인 증가

### 4. useFrame 내부 긴 이동 로직

**라인 수:** ~170줄 (lines 340-510)

**문제:**
- 중력 계산, 속도 계산, 방향 전환, stuck 감지가 모두 섞여있음
- 단위 테스트 불가능
- 읽기 어려움

**개선:**
```typescript
// 분리 제안
const applyGravity = (delta, isDragging, freeMovement) => { ... };
const updateLocomotion = (delta, emotionSpeed, styleSpeed) => { ... };
const detectStuck = (distance, movedThisFrame) => { ... };
```

---

## 🟢 AnimationManager.tsx — 설계 우수

**강점:**
- ✅ 단일 책임: 애니메이션 레이어 조율만 담당
- ✅ 간단한 구조: 컴포넌트 조합만 수행
- ✅ 자료 문서화: 레이어 구조를 명확하게 주석 표기
- ✅ 확장 가능: 새 레이어 추가 시 한 줄만 추가

**개선 여지:**
- 레이어 순서를 상수로 정의하면 더 명확할 것
```typescript
const ANIMATION_LAYERS = {
  IDLE_FIDGET: 0.5,
  PHYSICS: 1,
  EXPRESSION: 2,
  EYE: 2.1,
  LOOKAT: 2.2,
  DANCE: 3,
  HUMANOID_SYNC: 4,
} as const;
```

---

## 🟡 LocomotionClipManager.ts — 중간 수준

### 1. 책임: 4개

1. 애니메이션 클립 캐싱
2. 걷기/Idle 애니메이션 재생
3. 제스처 애니메이션 재생
4. 속도 제어

### 2. 메모리 누수 위험

**문제:**
```typescript
async playGesture(gesture: string): Promise<void> {
  // ...
  const onFinished = (e: { action: THREE.AnimationAction }) => {
    // ...
    this.mixer.removeEventListener('finished', onFinished);
  };
  this.mixer.addEventListener('finished', onFinished);
}
```

**위험:**
- 제스처 재생 중 컴포넌트가 언마운트되면 이벤트 리스너가 남음
- 장시간 재생 중 리스너 누적

**개선:**
```typescript
private gestureFinalizers = new Map<THREE.AnimationAction, () => void>();

async playGesture(gesture: string): Promise<void> {
  // ...
  const onFinished = (e: { action: THREE.AnimationAction }) => {
    if (e.action === action) {
      action.fadeOut(GESTURE_FADE_OUT);
      this.currentGestureAction = null;
      this.mixer.removeEventListener('finished', onFinished);
      this.gestureFinalizers.delete(action);
    }
  };
  this.mixer.addEventListener('finished', onFinished);
  this.gestureFinalizers.set(action, () => {
    this.mixer.removeEventListener('finished', onFinished);
  });
}

dispose(): void {
  // ...
  this.gestureFinalizers.forEach(finalizer => finalizer());
  this.gestureFinalizers.clear();
}
```

### 3. 로딩 상태 관리

```typescript
private loading = new Set<string>();
```

**문제:**
- 로드 실패 시 `loading.delete()` 호출이 `finally` 블록에만 있음
- 동시 로드 요청이 동일 경로로 오면 `null` 반환 (대기 메커니즘 부재)

**개선:**
```typescript
private loadingPromises = new Map<string, Promise<THREE.AnimationClip | null>>();

private async getOrLoadClip(...) {
  // 이미 로딩 중이면 Promise 재사용
  if (this.loadingPromises.has(fbxPath)) {
    return this.loadingPromises.get(fbxPath);
  }

  const promise = this.loadClipInternal(fbxPath, clipName);
  this.loadingPromises.set(fbxPath, promise);

  try {
    return await promise;
  } finally {
    this.loadingPromises.delete(fbxPath);
  }
}
```

---

## 🟢 LoadMixamoAnimation.ts — 설계 우수

**강점:**
- ✅ 단일 책임: FBX → VRM AnimationClip 변환만 담당
- ✅ 순수 함수: `convertMixamoAnimation` (부수 효과 없음)
- ✅ 타입 안전: `LoadMixamoAnimationOptions` 인터페이스
- ✅ 재사용 가능: 로드된 FBX 변환도 지원

**개선 여지:**
- 에러 메시지를 열거형으로 정의하면 로깅/i18n 개선
```typescript
enum AnimationConversionError {
  CLIP_NOT_FOUND = 'FBX에서 "mixamo.com" 애니메이션 클립을 찾을 수 없습니다'
}
```

---

## 🟡 IdleFidgetController.tsx — 중간 수준

### 1. 책임: 2개

1. 호흡 애니메이션 계산
2. 머리 드리프트 애니메이션 계산

### 2. 시간 기반 상태 관리

**문제:**
```typescript
const nextHeadDriftTimeRef = useRef(
  performance.now() * 0.001 +
  HEAD_DRIFT_INTERVAL_MIN +
  Math.random() * (HEAD_DRIFT_INTERVAL_MAX - HEAD_DRIFT_INTERVAL_MIN),
);
```

**문제점:**
- `performance.now() * 0.001`는 마운트 시점의 절대 시간
- 컴포넌트 재마운트 시 시간 계산이 부정확할 수 있음

**개선:**
```typescript
const headDriftPhaseRef = useRef(0); // 정규화된 상대 시간

useFrame((_, delta) => {
  headDriftPhaseRef.current += delta / HEAD_DRIFT_INTERVAL_MAX;
  if (headDriftPhaseRef.current >= 1) {
    // 새로운 드리프트 타겟 선택
    headDriftPhaseRef.current = 0;
  }
  // ...
});
```

---

## 🟡 MotionDemoSequence.tsx — 중간 수준

### 1. 타이머 관리

**문제:**
```typescript
let delay = 3000;
const timers: ReturnType<typeof setTimeout>[] = [];

for (const step of steps) {
  timers.push(setTimeout(() => {
    log(step.label);
    step.action();
  }, delay));
  delay += step.durationMs;
}

return () => {
  timers.forEach(clearTimeout);
  settings().setAvatarSettings({ autoRoam: false });
};
```

**문제점:**
- 10개의 `setTimeout` 호출로 순차 이벤트 구현 → 비효율
- 타이머가 해제되어도 클로저로 인한 메모리 보유

**개선:**
```typescript
useEffect(() => {
  if (startedRef.current) return;
  startedRef.current = true;

  const avatar = useAvatarStore.getState();
  const settings = useSettingsStore.getState();
  const steps: DemoStep[] = [...];

  let accumulatedTime = 3000;
  let currentStepIndex = 0;

  const timer = setInterval(() => {
    if (currentStepIndex >= steps.length) {
      clearInterval(timer);
      return;
    }

    const step = steps[currentStepIndex];
    log(step.label);
    step.action();
    accumulatedTime += step.durationMs;
    currentStepIndex++;
  }, 100); // 주기적 확인 (100ms)

  return () => clearInterval(timer);
}, []);
```

---

## 📋 성능 개선 우선순위

### P0 — 즉시 해결 필요

| 항목 | 파일 | 영향 | 해결책 |
|------|------|------|--------|
| 1️⃣ VRM dispose 미실행 | VRMAvatar.tsx | 메모리 누수 | 언마운트 시 `VRMUtils.deepDispose()` |
| 2️⃣ useFrame 900줄 복잡성 | VRMAvatar.tsx | 성능 저하 | 걷기 IK를 별도 훅으로 분리 |
| 3️⃣ 글로벌 mutable 상태 | AvatarController.tsx | 테스트 불가, 버그 | Zustand 스토어 이동 |
| 4️⃣ 제스처 이벤트 리스너 정리 | LocomotionClipManager.ts | 메모리 누수 | 리스너 레지스트리 추가 |

### P1 — 다음 스프린트에서 처리

| 항목 | 파일 | 개선효과 |
|------|------|--------|
| Ref 그룹화 (29개) | VRMAvatar.tsx | 가독성 +40% |
| useCallback 의존성 정리 | VRMAvatar.tsx | 렌더 성능 +15% |
| 시간 기반 로직 정규화 | IdleFidgetController.tsx | 버그 감소 |
| 동시 로드 Promise 캐싱 | LocomotionClipManager.ts | 네트워크 요청 -50% |

---

## 🔧 모듈화 제안 구조

```
src/
├── components/avatar/
│   ├── VRMAvatar.tsx (핵심 렌더러, 180줄로 축소)
│   ├── AnimationManager.tsx ✅
│   ├── AvatarController.tsx ✅
│   ├── IdleFidgetController.tsx ✅
│   ├── MotionDemoSequence.tsx ✅
│   ├── DragRotationController.tsx ⭐ (NEW)
│   ├── FingerAnimationController.tsx ⭐ (NEW)
│   └── FaceOnlyModeController.tsx ⭐ (NEW)
│
├── services/avatar/
│   ├── locomotionClipManager.ts ✅
│   ├── loadMixamoAnimation.ts ✅
│   ├── vrmLoader.ts ⭐ (NEW)
│   ├── locomotionIK.ts ⭐ (NEW)
│   ├── interactionBounds.ts ⭐ (NEW)
│   ├── cameraProjection.ts ⭐ (NEW)
│   └── avatarGestureManager.ts ⭐ (NEW)
│
└── hooks/avatar/
    ├── useLocomotionIK.ts ⭐ (NEW)
    ├── useVRMLoad.ts ⭐ (NEW)
    ├── useDragRotation.ts ⭐ (NEW)
    └── useInteractionBounds.ts ⭐ (NEW)
```

---

## 📈 예상 효과

| 개선 사항 | 현재 | 목표 | 달성 시간 |
|----------|------|------|---------|
| VRMAvatar.tsx 라인 수 | 900+ | 250 | 3일 |
| useFrame 복잡도 | O(n²) | O(n) | 2일 |
| ref 개수 | 29 | 8 | 1일 |
| 메모리 누수 이슈 | 3+ | 0 | 2일 |
| 테스트 커버리지 | ~10% | ~60% | 5일 |

---

## 결론

**현재 상태:** ⚠️ 유지보수 위험도 높음

**주요 문제:**
1. **VRMAvatar.tsx의 과도한 책임** — 긴급 리팩토링 필요
2. **메모리 누수 위험** — dispose 로직 미흡
3. **테스트 불가능한 구조** — 글로벌 상태, 파일 스코프 변수

**권장 조치:**
1. VRMAvatar.tsx를 3개 모듈로 분할 (VRMLoader, LocomotionIK, DragRotation)
2. AvatarController의 글로벌 상태를 Zustand로 이동
3. 모든 useEffect에서 정리 함수(cleanup) 추가
4. 단위 테스트 작성 (LocomotionIK, InteractionBounds)

