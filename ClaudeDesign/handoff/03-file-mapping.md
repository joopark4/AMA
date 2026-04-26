# 03. 파일 매핑표

프로토타입의 JSX 파일 ↔ 실제 레포의 TSX 파일 1:1 매핑

## 3.1 매핑 개요

| 프로토타입 파일 | 실제 레포 대상 파일 | 작업 유형 |
|---|---|---|
| `src/App.jsx` — 전역 토큰, 레이아웃 | `src/index.css` + `tailwind.config.ts` | 토큰 이식 |
| `src/Avatar.jsx` — 글로우 오라 | (신규) `src/components/avatar/AvatarAura.tsx` | 신규 |
| `src/Overlay.jsx` — 컨트롤 클러스터 | (신규) `src/components/ui/ControlCluster.tsx` + `App.tsx` 수정 | 신규 |
| `src/Overlay.jsx` — SpeechBubble | `src/components/ui/SpeechBubble.tsx` | 리디자인 |
| `src/Overlay.jsx` — StatusPill | `src/components/ui/StatusIndicator.tsx` | 리디자인 + 위치 이동 |
| `src/Settings.jsx` — Panel shell | `src/components/ui/SettingsPanel.tsx` | 리디자인 |
| `src/Settings.jsx` — Section | `src/components/settings/SettingsSection.tsx` | 리디자인 |
| `src/Settings.jsx` — LLM 섹션 | `src/components/settings/LLMSettings.tsx` | 리디자인 |
| `src/Settings.jsx` — 음성 섹션 | `src/components/settings/VoiceSettings.tsx` | 리디자인 |
| `src/Settings.jsx` — 프리미엄 | `src/features/premium-voice/PremiumVoiceSettings.tsx` | 리디자인 |
| `src/Settings.jsx` — 아바타 | `src/components/settings/AvatarSettings.tsx` | 리디자인 |
| `src/Settings.jsx` — Channels | `src/features/channels/MCPSettings.tsx` | 리디자인 |
| `src/Settings.jsx` — 자주 쓰는 기능 섹션 | (신규) `src/components/settings/QuickActionsSettings.tsx` | **신규** |
| `src/QuickActions.jsx` | (신규) `src/components/ui/QuickActionsPalette.tsx` | **신규** |
| `src/features.jsx` — 기능 카탈로그 | (신규) `src/features/quick-actions/catalog.ts` | **신규** |
| `src/History.jsx` | `src/components/ui/HistoryPanel.tsx` | 리디자인 |
| `src/Onboarding.jsx` | `src/components/ui/ModelDownloadModal.tsx` + 새 컴포넌트 | 리디자인 + 확장 |
| `src/Auth.jsx` | `src/components/auth/AuthScreen.tsx` + `TermsModal.tsx` | 리디자인 |
| `src/Premium.jsx` | `src/features/premium-voice/*` | 리디자인 |
| `src/icons.jsx` | 기존 인라인 SVG → `src/components/ui/icons/*` 또는 `lucide-react` | 교체 권장 |

## 3.2 신규 스토어 필드

### `settingsStore.ts`에 추가
```ts
export interface Settings {
  // ... 기존 필드
  
  /** 자주 쓰는 기능 — 등록된 feature id 배열 */
  enabledQuickActions: string[];  // 기본값: ['calendar', 'mail', 'translate', 'capture']
  
  /** 아바타 숨김 상태 (세션 유지) */
  avatarHidden: boolean;  // 기본값: false
}
```

```ts
// 액션 추가
interface SettingsState {
  // ...
  setEnabledQuickActions: (ids: string[]) => void;
  toggleQuickAction: (id: string) => void;
  setAvatarHidden: (hidden: boolean) => void;
  toggleAvatarHidden: () => void;
}
```

### 마이그레이션
`version` bump + `normalizeSettings`에 기본값 merge.

## 3.3 신규 feature 모듈 구조

```
src/features/quick-actions/
  catalog.ts          # 전체 기능 정의 (id, icon, label, handler 명세)
  types.ts            # QuickAction 타입
  useQuickActions.ts  # 등록된 기능 호출 훅 (실행 dispatch)
  index.ts            # re-export
```

## 3.4 아이콘 정책

프로토타입은 인라인 SVG로 `I.Calendar`, `I.Mail` 등을 정의했습니다.  
레포에는 이미 `lucide-react` 같은 라이브러리가 있거나 인라인 SVG를 쓸 수 있으니 **하나의 방식으로 통일**:

- 권장: `lucide-react` 설치 → `import { Calendar, Mail, ... } from 'lucide-react'`
- stroke width: 1.6-1.8 (프로토타입 기본값 1.8)
- 기본 size: 16px (아이콘 칩 안쪽), 14px (리스트 inline)

## 3.5 i18n 키 추가 제안

`locales/ko/translation.json` (및 en, ja)에 아래 키 추가 필요:

```json
{
  "settings": {
    "quickActions": {
      "title": "자주 쓰는 기능",
      "description": "자주 사용하는 기능을 등록하면 ✨ 아이콘에서 바로 불러올 수 있어요. 음성으로도 호출 가능해요.",
      "registered": "등록됨",
      "clearAll": "모두 해제",
      "empty": "아직 등록된 기능이 없어요. 위에서 체크해보세요."
    }
  },
  "quickActions": {
    "title": "자주 쓰는 기능",
    "searchPlaceholder": "기능 찾기 또는 명령어 입력…",
    "manage": "설정에서 관리",
    "empty": "등록된 기능이 없어요",
    "emptyDesc": "설정에서 자주 쓰는 기능을 등록하면 여기에 나타나요.",
    "register": "기능 등록하러 가기"
  },
  "overlay": {
    "voiceHint": "무엇이든 물어보세요",
    "textInputPlaceholder": "메시지를 입력하세요",
    "toggleKeyboard": "키보드로 입력",
    "closeKeyboard": "키보드 닫기",
    "hideAvatar": "아바타 숨기기",
    "showAvatar": "아바타 보이기",
    "avatarResting": "{{name}}는 잠깐 쉬는 중이에요"
  },
  "status": {
    "idle": "대기 중",
    "listening": "듣고 있어요",
    "transcribing": "받아쓰는 중",
    "thinking": "생각하는 중",
    "speaking": "말하는 중"
  }
}
```
