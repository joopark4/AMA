# 아바타 시스템

VRM 렌더링, 마우스 상호작용(선택/이동/회전), 표정/제스처/립싱크를 담당합니다.

## 핵심 구성

| 파일 | 역할 |
|------|------|
| `AvatarCanvas.tsx` | Canvas 생성, VRM 미선택/오류 오버레이 |
| `VRMAvatar.tsx` | VRM 로딩, interaction bounds 계산, drag/rotate |
| `AnimationManager.tsx` | 표정/제스처/댄스 레이어 갱신 |
| `AvatarController.tsx` | 이동 상태 업데이트 |
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

## 상호작용

### 1) 선택

- `interactionBounds`를 매 프레임 재계산
- click-through 훅에서 `interactionBounds`를 우선 hit-test
- 커서 좌표 후보는 논리/물리(DPR) 좌표를 기준으로 판정
- 상시 Y축 반전 후보를 제거해 아바타 상단의 거울형 비통과 영역(오검출) 방지

### 2) 이동

- 몸통 영역 pointer drag로 이동
- `setPosition()`으로 즉시 반영

### 3) 회전

- 머리 영역 pointer drag로 수동 회전
- 회전값은 `manualRotation`으로 저장
- pointer up 시 `settings.avatar.initialViewRotation`으로 저장

### 4) 초기 시선 복원

- VRM 로드 후 저장된 `initialViewRotation`을 자동 적용
- 옵션 패널에서 현재 시선 저장/적용/정면 초기화 가능

## 말풍선 위치

- `interactionBounds.top`을 기준으로 말풍선을 아바타 위에 배치
- 아바타 스케일/위치/뷰포트 변경 시 자동 재계산
- 화면 경계를 넘지 않도록 clamp

## 조명 컨트롤

- 라이트 아이콘은 아바타 상대좌표 + 뷰포트 클램프 적용
- 아이콘은 SVG로 렌더되어 폰트 환경과 무관하게 항상 표시
- `data-interactive="true"`로 click-through 보호 대상 포함

## 렌더링 품질/안정화

- `THREE.NoToneMapping`, `SRGBColorSpace` 적용
- VRM 로드 중 stale model은 dispose
- Face mesh render order 보정(눈동자/흰자 이슈 대응)

## 아바타 상태 모델 (`avatarStore`)

주요 상태:
- `position`, `targetPosition`, `bounds`, `interactionBounds`, `groundY`
- `emotion`, `animationState`, `lipSyncValue`
- `currentGesture`, `isDancing`, `locomotionStyle`
- `isDragging`, `isRotating`, `manualRotation`

## 트러블슈팅 체크

1. 아바타 선택이 안 되면 `interactionBounds` 계산 및 click-through 상태 확인
2. 아바타 위쪽에서 클릭이 막히면 `useClickThrough`의 커서 좌표 변환(반전 Y 후보 포함 여부) 확인
3. 아바타가 화면 밖이면 bounds/ground 재계산과 clamp 확인
4. 말풍선 위치가 어긋나면 `SpeechBubble`의 bounds fallback 사용 여부 확인
5. 조명 아이콘이 안 보이면 `lighting.showControl`과 viewport clamp 결과 확인
