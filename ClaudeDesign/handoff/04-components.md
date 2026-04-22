# 04. 컴포넌트 상세 사양

각 컴포넌트의 props, 상태, 인터랙션, 애니메이션. 프로토타입 소스(`src/*.jsx`)와 대조하며 구현하세요.

## 4.1 ControlCluster (우하단 컨트롤)

**위치**: 화면 우하단 `right: 24px; bottom: 24px`, `position: fixed`  
**레이아웃**: 세로 flex column, gap 12px, 아이템 우측 정렬

### 구성 요소 (위 → 아래)
1. **StatusPill** (선택적, 우측 정렬, 작은 여백)
2. **TextInput row** (showInput이 true일 때만 렌더)
3. **Button cluster** (항상 표시, glass-strong pill)

### Button cluster 내부 (좌 → 우)
| 버튼 | 아이콘 | 동작 | 활성 조건 |
|---|---|---|---|
| 자주 쓰는 기능 | `Sparkles` | QuickActions 팔레트 열기 | - |
| 대화 기록 | `History` | HistoryPanel 열기 | - |
| 키보드 토글 | `Keyboard` | `showInput` 토글 | `showInput=true` 시 accent |
| 아바타 숨기기 | `Eye` / `EyeOff` | `avatarHidden` 토글 | `avatarHidden=true` 시 accent |
| Divider | - | 1px 세로 구분선 | - |
| **Voice (primary)** | `Mic` / `Waveform` | STT 토글 | `state=listening` 시 glow+scale |
| Divider | - | - | - |
| 설정 | `Settings` | SettingsPanel 열기 | - |

### Voice 버튼 사양
- 크기: 52x52, 원형
- Idle: `background: var(--accent)`, `box-shadow: 0 6px 18px oklch(0.74 0.14 45 / 0.4)`
- Listening: `linear-gradient(135deg, var(--glow), var(--accent))`, `transform: scale(1.05)`, 외곽 ring 6px
- Transition: 240ms `var(--ease)`
- 내용: 평상시 Mic 아이콘, listening 시 `<Waveform active/>` (5개 막대 애니메이션)

### ClusterBtn (보조 버튼)
- 40x40, 원형, transparent 배경
- Hover: `oklch(0.92 0.02 60 / 0.7)`, ink 색상 진해짐
- Active (토글 on): `background: var(--accent-soft)`, `color: var(--accent-ink)`

### 인터랙션
- 키보드 토글 시 `inputSlide` 애니메이션 (240ms)
- 입력창 열리면 자동 포커스 (180ms 지연)
- ESC → 입력창 닫기 + 텍스트 클리어

## 4.2 SpeechBubble

**위치**: 화면 하단 중앙-ish, 아바타 위쪽 `position: absolute; bottom: 190px; left: 50%`  
**전환**: `slideUp` 애니메이션 (opacity 0→1 + translateY 8→0, 300ms)

### Props
```ts
{ message: string; state?: 'speaking' | 'thinking' }
```

### 스타일
- `.glass-strong` 적용 (blur 40px)
- Padding `16px 20px`, max-width 460px
- Border-radius `22px`
- Tail (꼬리): 하단 중앙에 작은 삼각형 또는 없음 (깔끔한 버전 권장)

### thinking 상태
텍스트 대신 3점 로더 (`thinking` 키프레임)

## 4.3 StatusPill (StatusIndicator 리디자인)

**위치**: ControlCluster 내부 최상단 (우측 정렬)  
**이전 위치**: 우상단 (`top: 18; right: 24`) → **제거**

### 구조
```
[● dot]  [label]
```
- Dot: 8x8 원, 상태별 색 + `auraBreath` 애니메이션 (idle 제외)
- Label: 11.5px, 상태별 색
- Padding: `6px 12px 6px 10px`
- Background: `oklch(1 0 0 / 0.6)`, `backdrop-filter: blur(16px)`
- Border-radius: 999px (pill)
- Hairline inset shadow

### 상태
섹션 2.1의 상태 테이블 참고.

## 4.4 Avatar (글로우 오라)

**역할**: 실제 VRM 뒤/주변에 렌더링되는 발광 오라.  
프로토타입은 VRM 대신 오라만 그림 — **실제 구현 시 VRMAvatar 뒤 레이어로 배치**.

### 구조 (z-order 바닥 → 위)
1. Outer glow (radial gradient, blur 24px, auraBreath)
2. Orbit ring (conic-gradient, auraSpin 30s)
3. Inner disc (accent-soft)
4. (실제 앱에서는) VRM 캔버스
5. Listening 시: ringPulse 확산 (2개 겹쳐서 지연)

### 상태별 색
| state | auraColor |
|---|---|
| idle | `oklch(0.85 0.10 50)` |
| listening | `oklch(0.82 0.13 320)` |
| thinking | `oklch(0.85 0.10 280)` |
| speaking | `oklch(0.80 0.14 160)` |

### 하단 이름 라벨
- 13px, weight 500, `var(--ink-3)`

### 숨김 상태
- `avatarHidden=true` → 아바타 영역 자체 unmount
- 중앙에 작은 글래시 pill: "{name}는 잠깐 쉬는 중이에요" (fade 220ms)

## 4.5 SettingsPanel

**레이아웃**
- 오른쪽 슬라이드 인, `panelIn` 320ms
- 너비 420px, `top: 70; right: 12; bottom: 12`
- `.glass-strong` + 내부 padding 0 (섹션에서 개별 처리)

### 섹션 순서 (중요!)
1. 언어
2. AI 모델 (Provider, Model, API Key) — **default open**
3. 음성 (STT / TTS / 단축키)
4. 프리미엄 음성
5. **자주 쓰는 기능** 🆕
6. 아바타 (이름, 크기, VRM, 자유이동, 말풍선)
7. Claude Code Channels
8. 앱 업데이트
9. (생략된 기존: 데이터 정리, 라이선스, 모니터 — 기존 위치 유지)

### 상단 헤더
- "설정" (19px, weight 700)
- "AMA를 내 방식대로 다듬기" (12.5px, ink-3)
- 우측 X 버튼 (32x32 원형, glass)

### 사용자 pill (헤더 아래)
- 아바타 이니셜 (그라디언트 원), 이름, 이메일·플랜, [관리] 버튼

## 4.6 SettingsSection (아코디언)

### Props
```ts
{
  icon: ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}
```

### 스타일
- 카드: `radius 18px`, `background: oklch(1 0 0 / 0.55)`, hairline inset
- 헤더: `padding: 14px 16px`, 아이콘 칩 32x32 (`--accent-soft` + `--accent-ink`)
- ChevDown rotate 180° when open
- Content: `padding: 4px 16px 18px`, `fade 220ms` 등장

## 4.7 QuickActionsSettings (🆕 자주 쓰는 기능 섹션)

**섹션 아이콘**: `Sparkles`  
**섹션 제목**: "자주 쓰는 기능"

### 구조
1. **안내문**: "자주 사용하는 기능을 등록하면 ✨ 아이콘에서 바로 불러올 수 있어요. 음성으로도 호출 가능해요." (12.5px, ink-2, line-height 1.55)
2. **체크리스트 카드**: radius 12, 내부에 `QUICK_FEATURES` 전체 row 렌더
3. **등록된 리스트 미리보기**: 상단에 "등록됨 · N개" + "모두 해제" 버튼, 아래 pill 형태로 나열

### 체크리스트 row
- Padding `11px 12px`, 위아래 border `1px solid var(--hairline)` (첫 항목 제외)
- Hover: `background: oklch(1 0 0 / 0.5)`
- 내부 구성 (좌 → 우):
  - 체크박스 18x18, radius 6. 체크 시 `--accent` 배경 + 흰색 체크마크. 미체크 시 inset ring 1.5px
  - 아이콘 칩 30x30, radius 9, 고유 accent 색
  - 라벨 (13.5px, weight 500) + 설명 (11.5px, ink-3, 한 줄 ellipsis)

### Pill (등록된 항목)
- `padding: 5px 10px 5px 6px`, radius 999
- 아이콘 미니 (18x18) + 라벨 + X 버튼
- `oklch(1 0 0 / 0.7)` 배경, hairline

## 4.8 QuickActionsPalette (🆕 ✨ 버튼 팔레트)

**열림**: ✨ 버튼 클릭 또는 단축키  
**닫힘**: ESC, 배경 클릭, 아이템 선택

### 레이아웃
- 중앙 모달, 640x80vh (max), `scaleIn 240ms`
- 배경: `oklch(0.2 0 0 / 0.18)` + blur 4px

### 구조
1. **검색 바** (상단, 보더바텀)
   - Search 아이콘 + input + `esc` kbd
2. **등록된 기능 헤더**
   - "등록된 기능 · N개" (eyebrow 스타일)
   - "⚙ 설정에서 관리" accent pill 버튼
3. **기능 카드 그리드** (3열, gap 8px)
   - 빈 상태: centered empty card + "기능 등록하러 가기" CTA
4. **최근 사용 리스트** (검색어 없을 때만)
5. **푸터**: 힌트 + 단축키 레전드

### 카드
- Padding 14, radius 16, glass-ish
- Hover: `transform: translateY(-1px)`, 배경 더 진하게
- 구성: 아이콘 칩 36x36 + 라벨 + 힌트

## 4.9 feature 카탈로그 (`catalog.ts` 스펙)

```ts
export type QuickActionId =
  | 'calendar' | 'mail' | 'translate' | 'capture'
  | 'polish' | 'focus' | 'news' | 'files' | 'memo';

export interface QuickAction {
  id: QuickActionId;
  icon: LucideIcon;      // lucide-react 아이콘 컴포넌트
  label: string;         // i18n 키 or 직접 문자열
  hint: string;          // 한 줄 힌트
  desc: string;          // 설정에서 보이는 상세 설명
  accent: string;        // 아이콘 칩 배경 (oklch)
  handler: () => Promise<void>;  // 실제 실행 로직
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'calendar',  icon: Calendar,  label: '오늘 일정',  hint: '캘린더 요약',    desc: '...', accent: 'oklch(0.85 0.10 50)',  handler: ... },
  // ... 9개
];
```

### handler 연결 가이드
- `calendar` → 대화 API에 "오늘 일정 알려줘" 자동 전송
- `capture` → Tauri IPC로 스크린샷 캡처 → 이미지 첨부 대화 시작
- `translate` → 클립보드 읽어서 번역 프롬프트 삽입
- `focus` → audio element로 lo-fi 재생 (외부 URL 또는 번들)
- `memo` → conversationStore에 메모 저장 (태그 'memo')
- 나머지도 대화 API에 프롬프트 주입 방식으로 시작 (MVP)

## 4.10 HistoryPanel

- 드래그 가능한 플로팅 창 (기존 `historyPanel.position/size` 유지)
- `.glass-strong`, 기본 위치 좌측 상단 근처
- 헤더: "대화 기록" + 검색 + 닫기
- 리스트: 대화 쌍 (user + assistant), 타임스탬프, 말풍선 작은 버전
- 하단: "내보내기", "모두 지우기"

## 4.11 Auth (로그인)

- 전체 화면, 중앙 정렬 카드 480px
- 배경: desktop-bg 살짝 블러
- 로고 + "{avatarName}를 만나보세요" 타이틀
- Google 로그인 버튼 (primary)
- 약관 링크 (아래 작게)

## 4.12 Onboarding

3단계:
1. **모델 다운로드** — Whisper base + Supertonic (진행률 바, 크기 표시)
2. **아바타 이름 입력** — 텍스트 필드 + 예시 이름 pill
3. **VRM 선택** — 번들된 프리셋 그리드 또는 "직접 업로드"

## 4.13 Premium / 구독

- 플랜 비교 카드 (Free / Pro)
- 월 / 연 토글
- 프리미엄 음성 샘플 미리듣기
- 결제 CTA (외부 링크)

## 4.14 Landing

- Hero: 타이틀 + 아바타 시각 + 다운로드 CTA
- Feature grid (음성, 로컬 우선, 커스터마이즈)
- 다운로드 (macOS / Windows)
- 푸터
