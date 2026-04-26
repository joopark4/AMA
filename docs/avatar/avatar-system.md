# 아바타 시스템

VRM 렌더링, 마우스 상호작용(선택/이동/회전), 표정/제스처/립싱크를 담당합니다.

## 핵심 구성

| 파일 | 역할 |
|------|------|
| `AvatarCanvas.tsx` | Canvas 생성, VRM 미선택/오류 오버레이 |
| `VRMAvatar.tsx` | VRM 로딩, Mixamo FBX 애니메이션 구동, interaction bounds 계산, drag/rotate |
| `AnimationManager.tsx` | 표정/물리/댄스/IdleFidget/Gaze/Backchannel 레이어 오케스트레이션 |
| `GazeFollowController.tsx` | 마우스 커서 추적(Rust polling) + head/neck additive 회전 |
| `BackchannelController.tsx` | listening 상태에서 주기적 끄덕임 (head bone sine bob) |
| `AvatarController.tsx` | 자동 배회/이동 물리/감정 리액션 |
| `IdleFidgetController.tsx` | 호흡 애니메이션 + 시선 미세 이동 (설정 토글 연동) |
| `LightingControl.tsx` | 조명 방향 드래그 컨트롤 |
| `SpeechBubble.tsx` | 아바타 상단 말풍선 위치 계산 |
| `avatarStore.ts` | 위치/상태/인터랙션 전역 상태 |

## VRM 로딩 정책

- 배포 번들에는 기본 VRM을 포함하지 않음
- `settings.vrmModelPath`가 비어 있으면 선택 오버레이 표시
- 파일 선택은 native picker 우선, 실패 시 dialog plugin fallback
- URL 로드 실패 시 fs read + parse fallback 처리

## 초기 위치/이동 경계

- 기본 위치는 우측 하단 기준
- 초기 가로 여백은 뷰포트의 `8%`
- 지면은 화면 하단으로 재계산(`GROUND_MARGIN_PX = 8`)
- 위치 이동 시 `avatarStore.bounds` 범위로 clamp

### 자유 이동 모드

`settings.avatar.freeMovement: true` 시 이동 제한이 해제된다.

- Y축 고정 해제: 화면 어디든 배치 가능
- 화면 밖 이동 허용: bounds를 `-Infinity ~ Infinity`로 설정
- 드래그 시 clamp 비적용
- OFF 전환 시 아바타가 기존 하단 위치로 자동 복귀
- 자동 배회와 상호 배타: 자유 이동 ON → 자동 배회 강제 OFF
- 관련 파일: `AvatarController.tsx` (bounds 계산), `DragController.tsx` (드래그 clamp)

### 자동 배회 모드

`settings.avatar.autoRoam: true` 시 아바타가 화면 내에서 자동으로 걸어다닌다.

- 감정별 걷기 스타일 자동 선택 (stroll/brisk/sneak/bouncy)
- 순환 액션 큐: walk → gesture → walk → idle → walk → jump → gesture (다양한 동작)
- 감정 변경 시 즉시 리액션 (happy → 점프, angry → 빠른 한걸음, sad → 멈춤)
- 화면 경계 도달 시 반대 방향으로 자동 전환
- 자유 이동 모드와 상호 배타: 자유 이동 ON → 자동 배회 자동 OFF
- 관련 파일: `AvatarController.tsx`

## 상호작용

### 1) 선택

- `interactionBounds`를 매 프레임 재계산 (3D AABB → 2D 투영)
- click-through 훅에서 `interactionBounds` 기반 몸통 히트박스 hit-test
- 커서 좌표는 Rust 백엔드에서 윈도우-로컬 좌표로 직접 계산 (멀티 모니터 대응)

### 2) 이동

- 몸통 영역 pointer drag로 이동
- `setPosition()`으로 즉시 반영
- 자유 이동 모드 시 bounds clamp 비적용

### 3) 회전

- 머리 영역 pointer drag로 수동 회전
- 회전값은 `manualRotation`으로 저장
- pointer up 시 `settings.avatar.initialViewRotation`으로 저장

### 4) 초기 시선 복원

- VRM 로드 후 저장된 `initialViewRotation`을 자동 적용
- 옵션 패널에서 현재 시선 저장/적용/정면 초기화 가능

## 말풍선

- `interactionBounds.top`을 기준으로 말풍선을 아바타 위에 배치
- 아바타 스케일/위치/뷰포트 변경 시 자동 재계산
- 화면 경계를 넘지 않도록 clamp
- `settings.avatar.showSpeechBubble` 토글로 표시/숨김 제어 (기본: 표시)
- 숨김 시에도 대화 내용은 히스토리 패널에서 확인 가능

## 조명 컨트롤

- 라이트 아이콘은 아바타 상대좌표 + 뷰포트 클램프 적용
- 아이콘은 SVG로 렌더되어 폰트 환경과 무관하게 항상 표시
- `data-interactive="true"`로 click-through 보호 대상 포함
- 이동 범위 (v1.5.0): X ±300px, Y ±500px (아바타 머리 위까지 도달 가능)
- 기준점: 아바타 발 위치(`position.y`)에서 `-250px` (머리 근처)
- `useClickThrough` sun hitbox도 동일 좌표계로 동기화

## 렌더링 품질/안정화

- `THREE.NoToneMapping`, `SRGBColorSpace` 적용
- VRM 로드 중 stale model은 dispose
- Face mesh render order 보정(눈동자/흰자 이슈 대응)

## 모션 시스템

### Mixamo FBX 기반 애니메이션

기존 JSON 클립 시스템을 Mixamo FBX 기반으로 전면 교체.

| 모듈 | 역할 |
|------|------|
| `loadMixamoAnimation.ts` | FBX → VRM 본 리타겟팅 + AnimationClip 생성 |
| `mixamoVRMRigMap.ts` | Mixamo ↔ VRM 본 이름 매핑 테이블 |
| `locomotionClipManager.ts` | Idle/Walk 클립 로딩 + AnimationMixer 관리 |
| `boneUtils.ts` | T-Pose 저장/복원, 본 보정 유틸리티 |
| `proceduralGait.ts` | 걷기 바운스/스트라이드 절차적 생성 |
| `vrmUrlUtils.ts` | VRM URL 해석 유틸리티 |

- FBX 에셋: `motions/mixamo/` (Idle, Walking, Happy Walk, Sad Walk 등 20종)
- `public/motions/mixamo` 심볼릭 링크로 런타임 접근

### 대기 동작 (IdleFidgetController)

아바타가 가만히 있을 때의 미세 움직임을 제어한다.

- **호흡 애니메이션**: spine/chest 본의 미세 확장/수축 (설정: `enableBreathing`)
- **시선 미세 이동**: head 본의 자연스러운 흔들림 (설정: `enableEyeDrift`)
- 두 기능 모두 설정 패널에서 개별 ON/OFF 가능

### 애니메이션 레이어 구조

| 레이어 | 컨트롤러 | 설명 |
|--------|---------|------|
| Layer 0 | VRMAvatar (LocomotionClipManager) | Mixamo FBX 기반 Idle/Walk |
| Layer 1 | IdleFidgetController | 호흡 + 시선 미세 이동 |
| Layer 2 | PhysicsController | SpringBone (머리카락/옷) |
| Layer 3a | ExpressionController + EyeController + LookAtController | 표정/눈 깜빡임/시선 |
| Layer 3b | GazeFollowController | 커서 추적 + head/neck additive 회전 (v1.5.0) |
| Layer 3c | BackchannelController | listening 상태 주기적 끄덕임 (v1.5.0) |
| Layer 4 | DanceController | 리듬 기반 댄스 |
| Layer 5 | HumanoidSyncController | VRM 호환 최종 동기화 |

## 아바타 크기 조절 (v1.5.0)

- `settings.avatar.scale`은 **`camera.zoom`** 으로 반영 (group scale 제거)
- 아바타는 월드에서 항상 1.0 사이즈로 렌더 → SpringBone 물리가 scale 변경에 영향 받지 않음
- 시각 크기는 camera projection 경유로 동일 UX 유지
- 과거 `<group scale={[s,s,s]}>` 방식은 scale<1.0에서 hair/cloth가 위로 떠오르는 버그 유발 (center-space 캐시 불일치)
- ground 계산은 항상 월드 1.0 기준 (`solveGroundPositionY(1.0)`) — projection이 zoom 자동 보정

## 아바타 상태 모델 (`avatarStore`)

주요 상태:
- `position`, `targetPosition`, `bounds`, `interactionBounds`, `groundY`
- `emotion`, `animationState`, `lipSyncValue`
- `currentGesture`, `isDancing`, `locomotionStyle`
- `isDragging`, `isRotating`, `manualRotation`

## 클릭스루 (멀티 모니터 대응)

- Rust `get_cursor_position`에서 윈도우-로컬 좌표를 직접 계산
- macOS: `NSEvent::mouseLocation` → `app.run_on_main_thread()`로 메인 스레드 실행
- Y좌표 변환: `NSScreen::screens()[0]` (프라이머리 스크린) 높이 기준
- 윈도우 오프셋: `window.outer_position()` (Tauri API) 사용 — WKWebView의 `window.screenX/Y`는 세컨더리 모니터에서 부정확
- 프런트엔드는 좌표 변환 없이 Rust 반환값을 직접 사용
- 히트박스: `interactionBounds` AABB의 55% 너비(몸통), 85% 높이(머리카락 제외)

## 트러블슈팅 체크

1. 아바타 선택이 안 되면 `interactionBounds` 계산 및 click-through 상태 확인
2. 클릭스루가 멀티 모니터에서 안 되면 `get_cursor_position`의 좌표 변환 확인 (screens()[0] 사용 여부)
3. 아바타가 화면 밖이면 bounds/ground 재계산과 clamp 확인
4. 말풍선 위치가 어긋나면 `SpeechBubble`의 bounds fallback 사용 여부 확인
5. 조명 아이콘이 안 보이면 `lighting.showControl`과 viewport clamp 결과 확인
6. 자유 이동 모드에서 아바타가 안 움직이면 `freeMovement` 설정과 bounds 값 확인
