# Issue #001: VRM 모델 색상 왜곡 문제

[← 문서 목록으로](../CLAUDE.md)

## 문제 요약

VRM 아바타 모델이 Three.js/React-Three-Fiber에서 렌더링될 때 원본과 다른 붉은 톤으로 표시되는 문제

## 증상

- 아바타 전체가 붉은색/마룬색 톤으로 표시됨
- 머리카락만 갈색/금색으로 보이고 피부와 옷은 어두운 붉은색
- VRM 파일 자체는 정상 (다른 VRM 뷰어에서는 정상 표시)

## 원인 분석

### React-Three-Fiber 기본 설정 문제

React-Three-Fiber의 Canvas 컴포넌트는 기본적으로 `ACESFilmicToneMapping`을 사용합니다.
이 톤 매핑은 사진/영화 스타일의 색상 보정을 적용하여 VRM의 MToon 셰이더와 충돌합니다.

### Three.js r152+ Color Management

Three.js r152부터 색상 관리(Color Management) 시스템이 변경되었습니다:
- `ColorManagement.enabled = true`가 기본값
- `outputColorSpace`가 자동으로 `SRGBColorSpace`로 설정
- MToon 재질과의 이중 감마 보정 문제 발생 가능

## 시도한 해결책 (실패)

| 시도 | 결과 |
|-----|------|
| `THREE.SRGBColorSpace` 출력 | 붉은 톤 유지 |
| `THREE.LinearSRGBColorSpace` 출력 | 너무 어두움 (검정색) |
| `THREE.ColorManagement.enabled = false` | 효과 없음 |
| 텍스처 `colorSpace = NoColorSpace` | 검정색 |
| 텍스처 `colorSpace = SRGBColorSpace` | 붉은 톤 |
| `linear={true}` + `flat={true}` | 검정색 몸통 |

## 최종 해결책

### Canvas 설정

```tsx
<Canvas
  gl={{
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    toneMapping: THREE.NoToneMapping,  // 핵심!
  }}
>
```

### 조명 설정

```tsx
// 순수 흰색 조명 사용
<ambientLight color={0xffffff} intensity={1.0} />
<directionalLight color={0xffffff} position={[0, 1, 2]} intensity={1.0} />
```

### 재질 수정 최소화

VRM 로딩 후 재질 수정은 최소화합니다. 색상 공간 관련 수정은 하지 않습니다.

```typescript
loadedVRM.scene.traverse((obj) => {
  if ((obj as THREE.Mesh).isMesh) {
    const mesh = obj as THREE.Mesh;
    if (mesh.material) {
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      materials.forEach((mat) => {
        if (mat instanceof THREE.Material) {
          mat.transparent = true;  // 투명 윈도우를 위해 필요
          // 색상 관련 설정은 건드리지 않음!
        }
      });
    }
  }
});
```

## 핵심 포인트

1. **`toneMapping: THREE.NoToneMapping`이 필수**
   - React-Three-Fiber 기본 `ACESFilmicToneMapping` 비활성화
   - VRM/MToon 셰이더의 원래 색상 출력 유지

2. **색상 관리 설정은 기본값 유지**
   - `ColorManagement.enabled` 건드리지 않음
   - `outputColorSpace` 건드리지 않음

3. **조명은 순수 흰색 (0xffffff) 사용**
   - 색온도가 있는 조명은 색상 왜곡 유발

4. **MToon 재질 직접 수정 피하기**
   - `colorSpace` 속성 변경하지 않음
   - three-vrm 라이브러리가 자동 처리하도록 위임

## 관련 링크

- [Three.js Color Management Changes (r152)](https://discourse.threejs.org/t/updates-to-color-management-in-three-js-r152/50791)
- [pixiv/three-vrm GitHub](https://github.com/pixiv/three-vrm)
- [@pixiv/three-vrm npm](https://www.npmjs.com/package/@pixiv/three-vrm)

## 환경 정보

- Three.js: ^0.170.0
- @react-three/fiber: ^8.17.10
- @pixiv/three-vrm: ^3.4.0
- Tauri: 2.0

## 관련 파일

- `src/components/avatar/AvatarCanvas.tsx` - Canvas 및 렌더러 설정
- `src/components/avatar/VRMAvatar.tsx` - VRM 로딩 및 재질 처리
