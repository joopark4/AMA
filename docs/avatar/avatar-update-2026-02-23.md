# Avatar Update Log (2026-02-23)

## 범위
이번 반영은 다음 사용자 요청을 기준으로 진행되었습니다.

1. `Face/Expression Only Mode` 추가
2. 전신 모션 비활성화 시 표정/얼굴 방향/시선만 동작하도록 구성
3. T포즈 이슈 수정(차렷/11자 고정 자세)
4. 사용자가 아바타 성격을 직접 가이드할 수 있는 프롬프트 입력 기능 추가
5. 성격 프롬프트 입력 시 공백(띄어쓰기) 손실 이슈 수정

## 주요 변경 사항

### 1) Face/Expression Only Mode
- 설정에서 `Face/Expression Only Mode` 토글 가능
- 모드 ON 시 전신 모션 레이어를 차단
  - Clip motion
  - Gesture fallback
  - Dance
  - Motion sequence demo (dev)
- 감정은 표정/머리/시선에만 반영

### 2) Face-only 자세 안정화 (T포즈 -> 차렷)
- face-only 분기에서 전신 본을 0 회전으로 고정하던 로직 제거
- 차렷 자세(11자) 기준으로 상체/팔/하체를 고정하는 스탠스 로직 추가
- 머리/목만 감정별 pose + 미세 움직임을 유지

### 3) 성격 가이드 프롬프트
- 설정에 `성격 가이드 프롬프트` 텍스트 입력창 추가(최대 800자)
- 입력값을 전역 설정에 영속 저장
- 대화 시 시스템 프롬프트에 사용자 지정 성격 가이드를 병합

### 4) 공백 입력 이슈 수정
- 성격 프롬프트 저장 정규화에서 `trim()` 제거
- 입력 중 띄어쓰기/줄바꿈을 그대로 보존

## 코드 변경 파일
- `src/stores/settingsStore.ts`
- `src/components/settings/AvatarSettings.tsx`
- `src/components/avatar/AnimationManager.tsx`
- `src/components/avatar/VRMAvatar.tsx`
- `src/components/avatar/LookAtController.tsx`
- `src/hooks/useConversation.ts`

## 동작 확인 체크리스트

1. 설정 > Avatar에서 `Face/Expression Only Mode` ON
2. 아바타가 전신 모션 없이 차렷 자세로 유지되는지 확인
3. 대화 시 감정에 따라 표정/머리 방향/시선만 변화하는지 확인
4. 설정 > `성격 가이드 프롬프트`에 문장 입력
5. 띄어쓰기/줄바꿈이 즉시 사라지지 않는지 확인
6. 동일 세션 대화 응답 톤에 성격 가이드가 반영되는지 확인

## 참고
- 로컬 타입체크(`tsc --noEmit`)는 기존 `import.meta.env` 타입 선언 이슈로 일부 파일에서 실패할 수 있음
- 앱 실행 시 모델 루트는 필요 시 다음 환경변수로 지정
  - `PREPARE_MODELS_DIR="/absolute/path/to/models"`
