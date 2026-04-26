# 05. 신규 기능 구현 가이드

이 리디자인에서 **새로 생긴 3가지 기능**의 구현 디테일. 기존 기능은 04번 문서에서 커버됨.

---

## 5.1 자주 쓰는 기능 (Quick Actions)

### 5.1.1 데이터 모델

#### `src/features/quick-actions/types.ts`
```ts
import type { LucideIcon } from 'lucide-react';

export type QuickActionId =
  | 'calendar' | 'mail' | 'translate' | 'capture'
  | 'polish' | 'focus' | 'news' | 'files' | 'memo';

export interface QuickActionDef {
  id: QuickActionId;
  icon: LucideIcon;
  labelKey: string;   // i18n key
  hintKey: string;
  descKey: string;
  accent: string;     // oklch color for icon chip
}

export interface QuickActionContext {
  sendMessage: (text: string) => Promise<void>;
  readClipboard: () => Promise<string>;
  captureScreen: () => Promise<string>;  // returns image path
  // ...other capabilities via injection
}

export type QuickActionHandler = (ctx: QuickActionContext) => Promise<void>;
```

#### `src/features/quick-actions/catalog.ts`
```ts
import { Calendar, Mail, Languages, Camera, Pen, Music, Zap, Folder, Brain } from 'lucide-react';
import type { QuickActionDef, QuickActionHandler } from './types';

export const QUICK_ACTION_DEFS: QuickActionDef[] = [
  { id: 'calendar',  icon: Calendar,  labelKey: 'quick.calendar.label',  hintKey: 'quick.calendar.hint',  descKey: 'quick.calendar.desc',  accent: 'oklch(0.85 0.10 50)'  },
  { id: 'mail',      icon: Mail,      labelKey: 'quick.mail.label',      hintKey: 'quick.mail.hint',      descKey: 'quick.mail.desc',      accent: 'oklch(0.85 0.10 200)' },
  { id: 'translate', icon: Languages, labelKey: 'quick.translate.label', hintKey: 'quick.translate.hint', descKey: 'quick.translate.desc', accent: 'oklch(0.85 0.10 320)' },
  { id: 'capture',   icon: Camera,    labelKey: 'quick.capture.label',   hintKey: 'quick.capture.hint',   descKey: 'quick.capture.desc',   accent: 'oklch(0.85 0.10 140)' },
  { id: 'polish',    icon: Pen,       labelKey: 'quick.polish.label',    hintKey: 'quick.polish.hint',    descKey: 'quick.polish.desc',    accent: 'oklch(0.85 0.10 70)'  },
  { id: 'focus',     icon: Music,     labelKey: 'quick.focus.label',     hintKey: 'quick.focus.hint',     descKey: 'quick.focus.desc',     accent: 'oklch(0.85 0.10 25)'  },
  { id: 'news',      icon: Zap,       labelKey: 'quick.news.label',      hintKey: 'quick.news.hint',      descKey: 'quick.news.desc',      accent: 'oklch(0.85 0.10 240)' },
  { id: 'files',     icon: Folder,    labelKey: 'quick.files.label',     hintKey: 'quick.files.hint',     descKey: 'quick.files.desc',     accent: 'oklch(0.85 0.10 110)' },
  { id: 'memo',      icon: Brain,     labelKey: 'quick.memo.label',      hintKey: 'quick.memo.hint',      descKey: 'quick.memo.desc',      accent: 'oklch(0.85 0.10 290)' },
];

export const QUICK_ACTION_HANDLERS: Record<QuickActionId, QuickActionHandler> = {
  calendar:  async (ctx) => ctx.sendMessage('오늘 일정을 요약해줘.'),
  mail:      async (ctx) => ctx.sendMessage('읽지 않은 메일을 요약해줘.'),
  translate: async (ctx) => {
    const text = await ctx.readClipboard();
    ctx.sendMessage(`다음을 번역해줘:\n${text}`);
  },
  capture:   async (ctx) => {
    const path = await ctx.captureScreen();
    ctx.sendMessage(`[screenshot:${path}] 이 화면을 설명해줘.`);
  },
  polish:    async (ctx) => {
    const text = await ctx.readClipboard();
    ctx.sendMessage(`다음 글을 맞춤법과 톤을 다듬어줘:\n${text}`);
  },
  focus:     async () => { /* play focus audio */ },
  news:      async (ctx) => ctx.sendMessage('오늘 주요 뉴스 3개만 짧게 알려줘.'),
  files:     async (ctx) => ctx.sendMessage('다운로드 폴더를 정리하는 방법 알려줘.'),
  memo:      async (ctx) => ctx.sendMessage('방금 내용을 메모에 저장해줘.'),
};
```

### 5.1.2 스토어 변경 (`settingsStore.ts`)

```ts
// Settings 인터페이스에 추가
enabledQuickActions: QuickActionId[];

// defaultSettings에 추가
enabledQuickActions: ['calendar', 'mail', 'translate', 'capture'],

// 액션 추가
setEnabledQuickActions: (ids) => set((state) => ({
  settings: { ...state.settings, enabledQuickActions: ids }
})),

toggleQuickAction: (id) => set((state) => {
  const curr = state.settings.enabledQuickActions ?? [];
  const next = curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id];
  return { settings: { ...state.settings, enabledQuickActions: next } };
}),

// normalizeSettings에 마이그레이션 추가
enabledQuickActions: Array.isArray(source.enabledQuickActions)
  ? source.enabledQuickActions.filter(id => VALID_IDS.has(id))
  : defaultSettings.enabledQuickActions,

// persist version bump
version: 14,
```

### 5.1.3 UI 컴포넌트

#### 설정 섹션: `src/components/settings/QuickActionsSettings.tsx`
프로토타입 `src/Settings.jsx`의 "자주 쓰는 기능" 블럭을 그대로 TSX로 포팅.  
- `useSettingsStore((s) => s.settings.enabledQuickActions)` 구독
- `toggleQuickAction(id)` 호출로 체크박스 동작
- 하단 pill 미리보기 유지

#### 팔레트: `src/components/ui/QuickActionsPalette.tsx`
프로토타입 `src/QuickActions.jsx`를 TSX로 포팅.  
- Props: `{ open: boolean; onClose: () => void; }`
- 내부에서 스토어 구독 + 핸들러 dispatch
- 단축키: `Cmd+Shift+A` 권장 (global shortcut 또는 in-app)

### 5.1.4 App.tsx 연결
```tsx
// ControlCluster의 ✨ 버튼 onClick → setQuickOpen(true)
const [quickOpen, setQuickOpen] = useState(false);
// ...
{quickOpen && <QuickActionsPalette open onClose={() => setQuickOpen(false)} />}
```

---

## 5.2 아바타 숨기기

### 5.2.1 스토어
```ts
// settingsStore.ts - Settings 인터페이스
avatarHidden: boolean;  // 세션 간 유지 (persist)

// defaultSettings
avatarHidden: false,

// 액션
setAvatarHidden: (hidden) => set((state) => ({
  settings: { ...state.settings, avatarHidden: hidden }
})),
toggleAvatarHidden: () => set((state) => ({
  settings: { ...state.settings, avatarHidden: !state.settings.avatarHidden }
})),
```

### 5.2.2 `App.tsx` 렌더링 분기
```tsx
const avatarHidden = useSettingsStore((s) => s.settings.avatarHidden);

{!avatarHidden && (
  <ErrorBoundary name="AvatarCanvas">
    <AvatarCanvas />
  </ErrorBoundary>
)}

{avatarHidden && <AvatarRestingBadge name={settings.avatarName} />}
```

### 5.2.3 `AvatarRestingBadge` (신규)
- 중앙 정렬 glass pill
- "{name}는 잠깐 쉬는 중이에요"
- fade 220ms 애니메이션

### 5.2.4 ControlCluster 버튼
```tsx
<ClusterButton
  icon={avatarHidden ? EyeOff : Eye}
  label={t(avatarHidden ? 'overlay.showAvatar' : 'overlay.hideAvatar')}
  active={avatarHidden}
  onClick={() => toggleAvatarHidden()}
/>
```

### 주의
- 숨김 상태에서도 음성 인식·응답은 **계속 동작** (말풍선은 표시)
- VRM 렌더링 비용이 크므로 `AvatarCanvas` 자체를 unmount 하는 게 성능상 이득

---

## 5.3 텍스트 입력 토글 (음성 우선)

### 5.3.1 동기
- AMA는 음성이 주 입력 수단 → 화면을 항상 점유하는 텍스트 바는 과잉
- 키보드 입력이 필요한 순간은 드물므로 토글 UI가 적절

### 5.3.2 ControlCluster 내부 상태
```tsx
// ControlCluster.tsx
const [showInput, setShowInput] = useState(false);
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (showInput) {
    const t = setTimeout(() => inputRef.current?.focus(), 180);
    return () => clearTimeout(t);
  }
}, [showInput]);

const closeInput = () => { setShowInput(false); setText(''); };
```

### 5.3.3 렌더링
```tsx
{showInput && (
  <div className="glass-strong text-input-row" style={{ animation: 'inputSlide 240ms var(--ease)' }}>
    <KeyboardIcon />
    <input
      ref={inputRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') send();
        else if (e.key === 'Escape') closeInput();
      }}
      placeholder={t('overlay.textInputPlaceholder')}
    />
    <button onClick={closeInput}><CloseIcon /></button>
    <button onClick={send} disabled={!text.trim()} className="send-btn">
      <SendIcon />
    </button>
  </div>
)}
```

### 5.3.4 키보드 토글 버튼
```tsx
<ClusterButton
  icon={Keyboard}
  label={t(showInput ? 'overlay.closeKeyboard' : 'overlay.toggleKeyboard')}
  active={showInput}
  onClick={() => setShowInput(v => !v)}
/>
```

### 5.3.5 CSS 키프레임
```css
@keyframes inputSlide {
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

### 5.3.6 접근성
- `aria-expanded={showInput}` on 토글 버튼
- ESC로 닫힘 (위에 이미 포함)
- 포커스 트랩은 불필요 (플로팅 요소)

---

## 5.4 StatusIndicator 위치 이동

### 이전 → 이후
- **이전**: 우상단 `top: 18; right: 24`, 독립 배치
- **이후**: ControlCluster 내부 최상단, 우측 정렬 (paddingRight: 8)

### 구현 변경
- 기존 `StatusIndicator.tsx`의 스타일은 Pill 형태로 축소 (26958 bytes → 훨씬 작아짐)
- 구독하는 state는 동일 (`conversationStore.isProcessing`, STT 상태 등)
- `App.tsx`에서 기존 `<StatusIndicator />` 제거 → ControlCluster 내부에 포함

```tsx
// ControlCluster.tsx
<div style={{ paddingRight: 8, marginBottom: -4 }}>
  <StatusPill state={currentState} />
</div>
{showInput && <TextInputRow ... />}
<div className="cluster-buttons glass-strong">...</div>
```
