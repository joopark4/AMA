# #021 WKWebView range 슬라이더 트랙 미렌더

## 증상

물리 엔진(중력/강성), 조명(환경광/직사광), 자발적 대화(idle/cooldown 분), Screen Watch 관찰 간격, History Panel 투명도 슬라이더에서 **핸들(원)만 보이고 트랙(rail)이 표시되지 않음**. 클릭/드래그는 정상 동작하나 시각 피드백이 없어 슬라이더로 인지하기 어려움.

## 환경

- macOS 14+ Apple Silicon
- Tauri WKWebView (배포/개발 모두 발생)
- Chromium/Safari 일반 브라우저에서는 정상

## 원인

1. `<input type="range">`의 default appearance를 사용했으나 WKWebView에서는 트랙(`-webkit-slider-runnable-track`)에 `accentColor`/inline `background` 스타일이 반영되지 않음.
2. `appearance: none`만 적용하면 트랙이 완전히 투명해지고 핸들도 native default로 떨어짐.
3. Tailwind의 `accent-[oklch(...)]` utility는 위와 동일한 한계.

## 해결

`-webkit-slider-runnable-track` / `::-webkit-slider-thumb` (+ Firefox용 `::-moz-range-{track,thumb}`)을 명시적으로 스타일링하는 `.ama-slider` 클래스를 `src/index.css`에 정의하고 모든 range input에 적용.

### CSS (src/index.css)

```css
input[type='range'].ama-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 22px;       /* 클릭 영역, 실제 트랙 6px */
  background: transparent;
  cursor: pointer;
  outline: none;
}
input[type='range'].ama-slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 99px;
  background: var(--surface-1);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
input[type='range'].ama-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px; height: 16px;
  border-radius: 99px;
  background: #fff;
  border: 2px solid var(--accent);
  margin-top: -5px;   /* (thumb_h - track_h) / 2 */
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}
/* :focus / :hover / :disabled / -moz-range-* 동등 처리 */
```

### 적용처

- `src/components/settings/forms.tsx` Slider 컴포넌트
- `src/components/settings/AvatarSettings.tsx` (gravity/stiffness/ambient/directional)
- `src/components/settings/CharacterSettings.tsx` (proactive idle/cooldown)
- `src/features/screen-watch/ScreenWatchSettings.tsx` (intervalSeconds)
- `src/components/ui/HistoryPanel.tsx` (opacity)

모두 `className="ama-slider"` + `data-interactive="true"`로 통일.

## 관련 사례

- [#020 WKWebView Toggle 렌더링](./020-wkwebview-toggle-rendering.md) — 동일하게 default form control이 WKWebView에서 invisibly 렌더되는 패턴.

## 회귀 방지

- 신규 슬라이더 추가 시 반드시 `className="ama-slider"` 사용.
- accentColor / background 만으로 트랙 색을 시도하지 말 것 — 일반 브라우저에서만 동작.
