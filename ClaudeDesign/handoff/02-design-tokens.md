# 02. 디자인 토큰

프로토타입의 `App.jsx` / `AMA Prototype.html` 상단 `<style>`에 정의된 CSS 변수를 기반으로 합니다.  
실제 레포에 적용할 때는 `src/styles/tokens.css` 같은 별도 파일로 분리하고 Tailwind `theme.extend`로도 노출하는 것을 권장합니다.

## 2.1 컬러 (OKLCH)

OKLCH를 사용하는 이유: 동일한 chroma·lightness로 hue만 바꾸면 시각적으로 균일한 대비가 보장됩니다. Tweaks에서 `--accent`의 hue만 조절해도 전체 액센트 계열이 자연스럽게 따라오도록 설계됨.

### 배경 / 표면 (warm neutral)
```css
--bg:        oklch(0.97 0.008 70);   /* 기본 배경 */
--bg-2:      oklch(0.94 0.012 70);   /* 2단계 배경 */
--bg-3:      oklch(0.91 0.015 65);   /* 살짝 음영 */
--surface:   oklch(1 0 0 / 0.62);    /* 글래시 카드 */
--surface-2: oklch(1 0 0 / 0.78);    /* 강한 글래시 (패널) */
--surface-3: oklch(1 0 0 / 0.92);    /* 불투명에 가까운 카드 */
```

### 텍스트 (ink)
```css
--ink:       oklch(0.22 0.012 50);   /* 본문 */
--ink-2:     oklch(0.42 0.012 50);   /* 보조 */
--ink-3:     oklch(0.62 0.012 55);   /* 힌트·placeholder */
--ink-4:     oklch(0.78 0.010 60);   /* 비활성 */
```

### Hairline (디바이더)
```css
--hairline:        oklch(0.20 0.01 50 / 0.10);
--hairline-strong: oklch(0.20 0.01 50 / 0.18);
--top-edge:        oklch(1 0 0 / 0.7);  /* 글래시 상단 하이라이트 */
```

### 액센트 (warm peach)
```css
--accent:      oklch(0.74 0.14 45);    /* primary CTA, voice btn */
--accent-2:    oklch(0.82 0.11 50);    /* hover/secondary */
--accent-soft: oklch(0.93 0.05 50);    /* 토큰 배경 */
--accent-ink:  oklch(0.32 0.10 40);    /* accent 배경 위 텍스트 */
```

### 보조 (glow / status)
```css
--glow:    oklch(0.85 0.12 320);   /* 아바타 오라, listening */
--glow-2:  oklch(0.88 0.10 25);

--ok:      oklch(0.72 0.14 160);   /* speaking */
--warn:    oklch(0.78 0.14 75);
--danger:  oklch(0.65 0.20 25);
```

### 상태별 색상 매핑 (StatusIndicator)
| 상태 | 라벨 | Dot 색상 | 텍스트 색상 |
|---|---|---|---|
| `idle` | 대기 중 | `oklch(0.7 0.01 50)` (회색) | `--ink-3` |
| `listening` | 듣고 있어요 | `--glow` (보라) | `--glow` |
| `transcribing` | 받아쓰는 중 | `--accent` (주황) | `--accent` |
| `thinking` | 생각하는 중 | `oklch(0.82 0.10 260)` | 보라-2 |
| `speaking` | 말하는 중 | `--ok` | `--ok` |

### 자주 쓰는 기능 - 아이콘 칩 배경
9개 feature 각각 고유 색상 (모두 `oklch(0.85 0.10 H)` — chroma·L 동일, hue만 변형)
```
calendar  50    mail    200   translate 320
capture   140   polish  70    focus     25
news      240   files   110   memo      290
```

## 2.2 반경 (radius)
```css
--r-sm: 10px;
--r:    16px;
--r-lg: 22px;
--r-xl: 28px;
```
- 버튼·입력필드: `--r-sm` ~ `10px`
- 카드·섹션: `--r` ~ 14-16px
- 패널 외곽: `--r-lg`
- Pill(원형): `999px`

## 2.3 그림자
```css
--shadow-sm: 0 1px 2px oklch(0.2 0.01 50 / 0.06), 0 4px 12px oklch(0.2 0.01 50 / 0.05);
--shadow:    0 2px 4px oklch(0.2 0.01 50 / 0.08), 0 12px 32px oklch(0.2 0.01 50 / 0.10);
--shadow-lg: 0 6px 16px oklch(0.2 0.01 50 / 0.10), 0 30px 80px oklch(0.2 0.01 50 / 0.18);
```

## 2.4 글래시 효과 (핵심)
```css
.glass {
  background: oklch(1 0 0 / 0.62);
  backdrop-filter: blur(28px) saturate(1.6);
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.7),       /* top edge highlight */
    inset 0 0 0 1px oklch(0.2 0.01 50 / 0.10), /* hairline */
    0 2px 4px rgba(...), 0 12px 32px rgba(...);
}
.glass-strong {   /* 패널용, 더 강한 블러 */
  background: oklch(1 0 0 / 0.78);
  backdrop-filter: blur(40px) saturate(1.8);
}
```

## 2.5 타이포그래피

### 폰트 스택
```css
font-family: 'Pretendard', -apple-system, BlinkMacSystemFont,
             'Apple SD Gothic Neo', system-ui, sans-serif;
letter-spacing: -0.011em;
```
- 본문: **Pretendard** (한글 + 영문 통일감)
- 코드 / kbd / 기술값: **JetBrains Mono**

### 스케일
| 용도 | size | weight | letter-spacing |
|---|---|---|---|
| 패널 제목 (h2) | 19px | 700 | -0.02em |
| 섹션 제목 | 14.5px | 600 | -0.01em |
| 본문 | 13.5px | 400-500 | -0.011em |
| 라벨 (폼) | 12.5px | 500 | 0 |
| 힌트 / 메타 | 11.5px | 400 | 0 |
| Eyebrow (UPPER) | 11px | 600 | 0.4 |
| 말풍선 | 14px | 400 | -0.01em |
| 큰 타이틀 (랜딩) | 32-64px | 700 | -0.03em |

## 2.6 간격 (8px 그리드 기반, 약간의 세밀 조정)

- 섹션 내 row: `10px` (상하 padding)
- 카드 내부 padding: `14px-16px`
- 패널 외부 padding: `20-22px`
- 아이콘과 텍스트 gap: `8-12px`
- 컨트롤 클러스터 gap: `4px` (조밀)

## 2.7 애니메이션

### 이징
```css
--ease: cubic-bezier(0.32, 0.72, 0, 1);  /* spring-out */
```
모든 전환은 이 이징을 기본으로 사용.

### Duration
- Hover / 색 변경: `140-180ms`
- 버튼 상태 변화: `200-240ms`
- 패널 슬라이드 인: `320ms`
- 페이드: `200-220ms`

### 키프레임 (이름 → 용도)
| 이름 | 용도 |
|---|---|
| `auraBreath` | 아바타 오라 숨쉬기 (scale 1 → 1.05) |
| `auraSpin` | 오라 회전 (360°, 매우 느림) |
| `ringPulse` | listening 시 동심원 확산 |
| `wave` | 음성 파형 막대 상하 |
| `thinking` | 3점 로더 |
| `slideUp` | 말풍선 등장 |
| `panelIn` | 설정/히스토리 패널 오른쪽에서 슬라이드 |
| `scaleIn` | 아바타/모달 부드러운 등장 |
| `inputSlide` | 텍스트 입력창 토글 |
| `fade` | 오버레이 페이드 |

## 2.8 Tailwind 매핑 제안

기존 레포가 Tailwind 기반이므로, `tailwind.config.ts`에 아래처럼 확장:

```ts
theme: {
  extend: {
    colors: {
      ink: {
        DEFAULT: 'oklch(0.22 0.012 50)',
        2: 'oklch(0.42 0.012 50)',
        3: 'oklch(0.62 0.012 55)',
      },
      accent: {
        DEFAULT: 'oklch(0.74 0.14 45)',
        soft: 'oklch(0.93 0.05 50)',
        ink: 'oklch(0.32 0.10 40)',
      },
      glow: 'oklch(0.85 0.12 320)',
    },
    borderRadius: {
      card: '16px', panel: '22px', pill: '999px',
    },
    boxShadow: {
      glass: 'inset 0 1px 0 rgba(255,255,255,0.7), inset 0 0 0 1px rgba(20,20,20,0.10), 0 12px 32px rgba(20,20,20,0.10)',
    },
    fontFamily: {
      sans: ['Pretendard', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace'],
    },
  },
}
```

Pretendard는 `@fontsource-variable/pretendard` 패키지로 설치 후 `index.css`에서 import.
