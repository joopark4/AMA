# 아바타 시스템

VRM 아바타 렌더링, 마우스 상호작용(선택/이동/회전), 표정/립싱크/제스처를 담당합니다.

## 핵심 구성

| 파일 | 역할 |
|------|------|
| `AvatarCanvas.tsx` | Canvas 생성, VRM 미선택/로드 실패 오버레이 |
| `VRMAvatar.tsx` | VRM 로딩, interaction bounds 계산, 드래그/회전 처리 |
| `AnimationManager.tsx` | 감정/제스처/댄스 레이어 제어 |
| `AvatarController.tsx` | 이동 상태/속도 업데이트 |
| `LightingControl.tsx` | 조명 방향 조절 UI |
| `avatarStore.ts` | 위치/감정/상태 전역 스토어 |

## VRM 로딩 정책

- 기본 VRM은 배포 번들에 포함하지 않습니다.
- `settings.vrmModelPath`가 비어 있으면 파일 선택 오버레이를 표시합니다.
- 선택은 네이티브 picker 우선, 실패 시 plugin-dialog fallback을 사용합니다.

관련 파일:
- `src/components/avatar/AvatarCanvas.tsx`
- `src/services/tauri/fileDialog.ts`
- `src-tauri/src/commands/settings.rs` (`pick_vrm_file`)

## 렌더링 설정

- `THREE.NoToneMapping`으로 VRM 색상 왜곡 방지
- `outputColorSpace = SRGBColorSpace`
- 투명 배경 + always-on-top 윈도우

## 상호작용

### 1) 이동

- 아바타를 마우스로 드래그하여 이동
- 화면 해상도/스케일 기반 bounds를 동적으로 계산
- 기본 가로 여백은 뷰포트의 약 `8%`

### 2) 회전

- 머리/상체 영역 드래그로 수동 회전
- 수동 회전값은 `avatarStore.manualRotation`으로 관리

### 3) 클릭스루 연동

- 아바타 bounds와 UI 인터랙션 영역에서 click-through 해제
- 인터랙션이 없으면 일정 지연 후 click-through 재활성화

## 말풍선 위치 연동

- 말풍선은 아바타 `interactionBounds.top` 기준으로 상단에 배치
- 아바타 스케일/위치/화면 크기 변경에 따라 자동 재계산

관련 파일:
- `src/components/ui/SpeechBubble.tsx`

## 상태 모델 (`avatarStore`)

주요 상태:
- `position`, `targetPosition`, `bounds`, `interactionBounds`
- `emotion`, `animationState`, `lipSyncValue`
- `currentGesture`, `isDancing`, `locomotionStyle`
- `isDragging`, `isRotating`, `manualRotation`

## 애니메이션/표정

- `useConversation`에서 텍스트 감정 분석 후 표정/제스처 트리거
- TTS 재생 중 립싱크 값을 주기적으로 업데이트
- 응답 완료 후 일정 시간 뒤 중립 표정으로 복귀

## 문제 해결 팁

### 아바타가 선택되지 않음
- `interactionBounds`가 정상 계산되는지 로그 확인
- click-through가 강제 활성화된 상태인지 확인
- VRM 로딩 에러 overlay가 떠 있는지 확인

### 아바타가 화면 밖에 배치됨
- 초기 bounds 계산 로직(`avatarStore.getInitialBounds`) 확인
- 해상도 변경 이벤트 이후 position clamp 동작 확인

### 아바타가 겹쳐 보임
- `VRMAvatar`의 stale load cleanup 로직 확인
- 단일 인스턴스가 적용되었는지 확인
