/**
 * Quick Actions — 자주 쓰는 설정 토글 (재설계).
 *
 * 사용자가 자주 변경하는 boolean 설정을 빠르게 토글할 수 있도록 모은 모음.
 * 핸드오프 spec의 9개 LLM 프롬프트 액션은 사용자 요청에 따라 설정 토글로 대체.
 *
 * 주의: 이 파일은 settingsStore의 값(런타임)을 import하지 않는다 (순환 의존 방지).
 * 단, TypeScript의 `import type`은 런타임 의존을 만들지 않으므로
 * SettingsState 타입은 안전하게 가져와 사용한다.
 */
import type { SettingsState } from '../../stores/settingsStore';

/** Quick Toggle 카테고리 — 설정 패널에서 그룹화 헤더로 사용 */
export type QuickToggleCategory =
  | 'avatar'
  | 'animation'
  | 'voice'
  | 'screen'
  | 'channels'
  | 'proactive';

export interface QuickToggleDef {
  /** 고유 ID (예: "avatar.freeMovement") — settingsStore.enabledQuickActions에 저장됨 */
  id: string;
  /** i18n 키 — 짧은 라벨 */
  titleKey: string;
  /** i18n 키 — 한 줄 설명 (선택) */
  descKey?: string;
  /** 설정 패널 그룹화에 사용 */
  category: QuickToggleCategory;
  /**
   * Zustand selector — 컴포넌트가 useSettingsStore(def.select)로 구독.
   * `import type`로 가져온 SettingsState를 사용해 런타임 의존 없이 타입 안전성 확보.
   */
  select: (state: SettingsState) => boolean;
  /** 새 값 적용 — store action 호출 */
  apply: (value: boolean) => void;
}

/** Quick Action ID는 자유 문자열 — 런타임에 ALL_QUICK_ACTION_IDS Set으로 검증 */
export type QuickActionId = string;

/**
 * 등록 가능한 토글 ID 전체 — settingsStore.enabledQuickActions 검증/마이그레이션에 사용.
 *
 * catalog.ts의 QUICK_TOGGLES와 동일 순서/내용으로 유지할 것.
 * (catalog.ts가 settingsStore를 import하기 때문에 여기서는 분리.)
 */
export const ALL_QUICK_ACTION_IDS: ReadonlySet<string> = new Set([
  // 아바타
  // (avatar.hidden 제외 — 컨트롤 클러스터에 Eye/EyeOff 버튼이 이미 있음)
  'avatar.freeMovement',
  'avatar.autoRoam',
  'avatar.showSpeechBubble',
  'avatar.physics',
  'avatar.lightingControl',
  // 애니메이션
  'animation.faceOnly',
  'animation.breathing',
  'animation.eyeDrift',
  'animation.gazeFollow',
  'animation.backchannel',
  'animation.gestures',
  'animation.motionClips',
  'animation.dancing',
  // 음성
  'voice.globalShortcut',
  // 화면
  'screen.watch',
  'screen.silentHours',
  // (channels.enabled 제외 — provider 전환·플러그인 setup 등 사이드 이펙트로 부적절)
  // 자발적 대화
  'proactive.enabled',
]);
