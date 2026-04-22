# #020 Tauri WKWebView에서 커스텀 Toggle이 렌더되지 않는 문제

**발생일**: 2026-04-20
**영향**: 설정 패널 전체 (아바타/화면 관찰/캐릭터 등 모든 토글 스위치)
**해결**: SVG 기반 Toggle 컴포넌트
**관련 커밋 범위**: `3eda29f` ~ `abe4b7f` (브랜치 `feature/redesign-v2`)

## 문제

설정 패널의 커스텀 Toggle 컴포넌트(forms.Toggle)가 Tauri macOS 앱의 WKWebView에서
보이지 않는 현상. 브라우저(Chrome/Safari)에서는 정상 렌더됐으나 Tauri 앱에서만
반복적으로 투명/미표시.

```
DOM 상태 (브라우저 devtools):
- width: 38~44px ✓
- height: 22~24px ✓
- display: block/inline-flex ✓
- opacity: 1 ✓
- visibility: visible ✓
- 뷰포트 내 위치: 정상 ✓
→ DOM에는 있으나 페인팅이 안 됨
```

## 진단 과정

### 1차: 레이아웃 의심
- 긴 설명 텍스트가 flex-1로 토글을 밀어내는지 확인 → 텍스트 div에
  `flex-1 min-w-0 pr-3` 추가하여 overflow 방지. 효과 없음.

### 2차: 색 대비 의심
- 글래시 카드 배경(oklch 0.97) + 토글 OFF(oklch 0.78) 대비 약함 추정 →
  OFF 색을 oklch 0.70으로 진하게, 크기 38x22 → 44x24로 확대. 효과 없음.

### 3차: WKWebView `-webkit-appearance: button` 추정
- Tailwind preflight가 버튼에 native 스타일 강제 → 인라인 `background`
  무시되는 가설. `appearance: none`, `WebkitAppearance: none`, hex 컬러
  추가. 효과 없음.

### 4차: 엘리먼트 타입 변경 — 네이티브 체크박스로 테스트
```tsx
<input type="checkbox" />  // ← 이것만 렌더됨 ✓
```
네이티브 폼 요소는 WKWebView에서 강제 렌더. **커스텀 `<button>`의
인라인 스타일이 특정 조건에서 페인팅 단계에서 탈락한다는 가설 확정**.

### 5차: label + hidden input + div visual — 실패
- 여전히 안 보임. absolute 자식 div의 페인팅이 누락됨.

### 6차: div role=switch + inline-block + absolute handle — 실패
- 순수 div, form 요소 없음. 여전히 안 보임.

### 7차: 디버그 (red/lime + 3px blue border + 텍스트 자식) — 성공
- 극단적으로 시인성 높은 스타일로 DOM 존재 확인 → **보임**.
- 이를 accent peach + 1px border + 빈 span 자식으로 축소 → 다시 안 보임.
- **결론: 엘리먼트 자체 문제가 아닌, 특정 CSS 조합이 WKWebView 페인팅
  파이프라인에서 탈락**.

### 8차: SVG 기반 재구현 — 성공
```tsx
<svg width="44" height="24" viewBox="0 0 44 24">
  <rect x="0.5" y="0.5" width="43" height="23" rx="11.5" fill="..." stroke="..."/>
  <circle cx={on ? 32 : 12} cy="12" r="9.5" fill="#fff"/>
</svg>
```
SVG는 HTML 페인팅 파이프라인과 분리된 vector 렌더러로 처리되므로
Tailwind preflight / WKWebView HTML 버튼 이슈의 영향 없음.

## 재현 조건 (추정)

확정되지 않았으나 다음 조합이 반복적으로 실패:
- `<button>` 또는 `<div>` 엘리먼트
- `display: inline-flex`
- 작은 크기 (44x24 이하)
- 자식이 `<span>` (빈 콘텐츠, width/height만 설정)
- 자식 또는 부모에 `position: absolute`
- 인라인 `background` + `border`

브라우저(Chrome/Safari 17+)에서는 모두 정상 렌더. Tauri의 시스템 WebKit
(macOS Apple Silicon)에서만 재현.

## 해결책

**SVG로 Toggle 트랙 + 핸들 렌더**

- `<div role="switch">` 외부 컨테이너 (접근성 + 키보드 이벤트)
- `<svg>` 내부에 `<rect>` (트랙) + `<circle>` (핸들)
- 색상은 CSS 커스텀 프로퍼티로 토큰화 (`var(--accent)`, `var(--toggle-off-track)` 등)
- `cx` 애니메이션으로 핸들 좌우 슬라이드

파일: `src/components/settings/forms.tsx`

## 학습 / 예방

1. **새 커스텀 UI 요소 추가 시 Tauri 앱에서 반드시 시각 검증**. 브라우저
   렌더링은 보장 없음.
2. **WKWebView 호환 어려운 조합 발견 시 SVG fallback 고려**. 특히 작은
   크기의 round-rect + handle 패턴.
3. **네이티브 폼 요소(input, select)는 WKWebView에서 안정적**. 접근성 +
   안정성 두 관점에서 선호.
4. **`-webkit-appearance: none`이 항상 충분하지 않음**. `<button>` 커스텀
   스타일이 필요하면 `<div role="button">`이 더 안전.

## 관련 이슈

- #013 Tauri WebView 외부 오디오 — WKWebView 제약 일반
- #018 Audio output device routing — WKWebView + setSinkId 제스처 제약

## 커밋 히스토리 요약

총 15개 디버깅 커밋이 feature/redesign-v2 브랜치에 기록됨:

| Sha | 시도 |
|-----|------|
| `9c56635` | OFF 시인성 개선 (oklch 진하게) |
| `994bf9a` | 모든 인라인 토글 forms.Toggle로 통일 |
| `3eda29f` | flex-1 min-w-0 (overflow 방지) |
| `35f6ea0` | 크기/대비/border 강화 (44x24) |
| `2afde94` | appearance:none + hex 컬러 |
| `c67a326` | 네이티브 체크박스 테스트 (성공) |
| `a1ddb7b` | label + hidden input + absolute div |
| `a21ce27` | label + inline-flex + margin 핸들 |
| `7580611` | div role=switch |
| `ed53322` | inline-block + absolute handle |
| `abe4b7f` | **SVG 기반 (최종 해결)** |
| `cbea6fb` | tokens rgba 단순화 (부수 수정) |
| `52caf46` | 입력 pill 외곽 shadow 제거 (부수) |
| `75ec1f4` | 입력 focus-ring 제거 (부수) |
| `3077d3e` | 음성 버튼 그림자 축소 (부수) |
