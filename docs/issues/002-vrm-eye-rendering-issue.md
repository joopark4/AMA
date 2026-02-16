# Issue #002: VRM 모델 눈동자(Iris/Pupil) 렌더링 문제

[← 문서 목록으로](../CLAUDE.md)

## 문제 요약

VRM 아바타 모델의 눈동자(iris/pupil)가 보이지 않고 눈이 완전히 흰색으로 표시되는 문제

## 증상

- 아바타의 눈이 완전히 흰색으로 렌더링됨
- 눈동자(iris), 동공(pupil)이 보이지 않음
- 다른 VRM 뷰어 (Windows 서드파티 앱)에서는 정상적으로 표시됨
- 표정 변경, 눈 깜빡임 등은 정상 작동

## 원인 분석

### VRM 모델의 눈 구조

이 VRM 모델(`eunyeon_ps.vrm`)의 얼굴은 8개의 메시로 구성됨:
- `Face_1` ~ `Face_8`

각 메시의 역할:
| 메시 | transparent | side | 역할 (추정) |
|------|-------------|------|------------|
| Face_1 | false | 0 (front) | 기본 얼굴 |
| Face_2 | true | 0 (front) | 투명 오버레이 |
| Face_3 | true | 2 (double) | 투명 오버레이 |
| Face_4 | false | 2 (double) | 눈 내부/안구 |
| Face_5 | false | 0 (front) | **눈 흰자 (sclera)** |
| Face_6 | true | 2 (double) | 투명 오버레이 |
| Face_7 | true | 2 (double) | 투명 오버레이 |
| Face_8 | true | 2 (double) | 투명 오버레이 |

### 렌더 순서 문제

**근본 원인**: `Face_5`(눈 흰자)가 눈동자 메시보다 **나중에** 렌더링되어 눈동자를 가림

Three.js는 기본적으로 불투명 메시를 먼저, 투명 메시를 나중에 렌더링합니다.
그러나 `Face_5`(불투명, 눈 흰자)가 눈동자보다 위에 렌더링되면서 눈동자가 가려졌습니다.

### 디버깅 과정

1. **F5 버튼으로 Face_5 토글 시** → 흰색 눈이 검은색으로 변함
2. 이를 통해 `Face_5`가 눈 흰자임을 확인
3. 눈동자는 다른 Face 메시(투명)에 있지만, `Face_5`에 가려져 안 보임

## 시도한 해결책 (실패)

| 시도 | 결과 |
|-----|------|
| 눈 뼈(eye bone) 회전 | 효과 없음 |
| lookAt 표현식 테스트 | 효과 없음 |
| 투명 배경 → 불투명 배경 | 효과 없음 |
| Color Management 설정 변경 | 효과 없음 |
| depthWrite/depthTest 조정 | 부분적 효과 |

## 최종 해결책

### VRM 로딩 시 렌더 순서 조정

`Face_5`(눈 흰자)의 `renderOrder`를 낮춰서 먼저 렌더링되도록 설정:

```typescript
// VRMAvatar.tsx - VRM 로딩 후
loadedVRM.scene.traverse((obj) => {
  if ((obj as THREE.Mesh).isMesh) {
    const mesh = obj as THREE.Mesh;

    // Face_5 (눈 흰자)는 먼저 렌더링 (낮은 renderOrder)
    if (mesh.name === 'Face_5') {
      mesh.renderOrder = -10;
    }

    // 투명한 Face 메시들은 나중에 렌더링 (높은 renderOrder)
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
```

### 렌더 순서 설명

```
렌더링 순서 (낮은 값 → 높은 값):
-10: Face_5 (눈 흰자) - 먼저 렌더링
  0: 기타 불투명 메시 (기본값)
 10: 투명 Face 메시들 (눈동자 포함) - 나중에 렌더링
```

## 핵심 포인트

1. **VRM 모델마다 눈 구조가 다를 수 있음**
   - 이 모델은 `Face_5`가 눈 흰자
   - 다른 모델은 다른 메시가 눈일 수 있음

2. **renderOrder로 렌더링 순서 제어**
   - 낮은 값: 먼저 렌더링 (뒤에 위치)
   - 높은 값: 나중에 렌더링 (앞에 위치)

3. **디버그 도구 활용**
   - 개별 Face 메시 토글 버튼으로 각 메시의 역할 파악
   - 터미널 로그로 메시 정보 확인

## 추가된 디버그 도구

`AvatarSettings.tsx`에 다음 디버그 버튼들 추가:

- **F1~F8**: 각 Face 메시 개별 토글
- **Log Eye Bones**: 눈 뼈 정보 로그
- **Log Face Morphs**: 얼굴 모프 타겟 로그
- **Fix Transparent**: 투명 메시 렌더 순서 수정 시도

## 환경 정보

- Three.js: ^0.170.0
- @react-three/fiber: ^8.17.10
- @pixiv/three-vrm: ^3.4.0
- Tauri: 2.0
- VRM 모델: eunyeon_ps.vrm

## 관련 파일

- `src/components/avatar/VRMAvatar.tsx` - VRM 로딩 및 렌더 순서 수정
- `src/components/avatar/AvatarCanvas.tsx` - Canvas 설정
- `src/components/settings/AvatarSettings.tsx` - 디버그 도구 UI

## 참고: 다른 VRM 모델 적용 시

다른 VRM 모델에서 같은 문제가 발생할 경우:

1. F1~F8 버튼으로 각 Face 메시 토글하여 눈 흰자 메시 찾기
2. 해당 메시의 `renderOrder`를 낮은 값으로 설정
3. 필요 시 `VRMAvatar.tsx`의 메시 이름 조건 수정
