/**
 * Quick Toggles 카탈로그 — 자주 사용하는 boolean 설정 모음.
 *
 * 사용자는 설정 패널에서 원하는 항목을 체크 → ✨ 팔레트에 토글로 노출됨.
 * 각 정의는 select(zustand selector) + apply(store action 호출)로
 * 양방향 바인딩.
 */
import { useSettingsStore } from '../../stores/settingsStore';
import type { AnimationSettings } from '../../stores/settingsStore';
import type { QuickToggleCategory, QuickToggleDef } from './types';

/** avatar.animation.<key> boolean 토글용 헬퍼 */
function applyAnim(key: keyof AnimationSettings) {
  return (value: boolean) => {
    const st = useSettingsStore.getState();
    const current = st.settings.avatar?.animation;
    st.setAvatarSettings({
      animation: { ...current, [key]: value } as AnimationSettings,
    });
  };
}

export const QUICK_TOGGLES: QuickToggleDef[] = [
  /* ─── 아바타 ─── */
  {
    id: 'avatar.hidden',
    titleKey: 'quick.avatarHidden.title',
    descKey: 'quick.avatarHidden.desc',
    category: 'avatar',
    select: (s) => s.settings.avatarHidden,
    apply: (v) => useSettingsStore.getState().setAvatarHidden(v),
  },
  {
    id: 'avatar.freeMovement',
    titleKey: 'quick.freeMovement.title',
    descKey: 'quick.freeMovement.desc',
    category: 'avatar',
    select: (s) => s.settings.avatar?.freeMovement ?? false,
    apply: (v) => useSettingsStore.getState().setAvatarSettings({ freeMovement: v }),
  },
  {
    id: 'avatar.autoRoam',
    titleKey: 'quick.autoRoam.title',
    descKey: 'quick.autoRoam.desc',
    category: 'avatar',
    select: (s) => s.settings.avatar?.autoRoam ?? false,
    apply: (v) => useSettingsStore.getState().setAvatarSettings({ autoRoam: v }),
  },
  {
    id: 'avatar.showSpeechBubble',
    titleKey: 'quick.showSpeechBubble.title',
    descKey: 'quick.showSpeechBubble.desc',
    category: 'avatar',
    select: (s) => s.settings.avatar?.showSpeechBubble !== false,
    apply: (v) => useSettingsStore.getState().setAvatarSettings({ showSpeechBubble: v }),
  },
  {
    id: 'avatar.physics',
    titleKey: 'quick.physics.title',
    descKey: 'quick.physics.desc',
    category: 'avatar',
    select: (s) => s.settings.avatar?.physics?.enabled ?? true,
    apply: (v) => {
      const st = useSettingsStore.getState();
      st.setAvatarSettings({
        physics: { ...st.settings.avatar.physics, enabled: v },
      });
    },
  },
  {
    id: 'avatar.lightingControl',
    titleKey: 'quick.lightingControl.title',
    descKey: 'quick.lightingControl.desc',
    category: 'avatar',
    select: (s) => s.settings.avatar?.lighting?.showControl !== false,
    apply: (v) => {
      const st = useSettingsStore.getState();
      st.setAvatarSettings({
        lighting: { ...st.settings.avatar.lighting, showControl: v },
      });
    },
  },

  /* ─── 애니메이션 ─── */
  {
    id: 'animation.faceOnly',
    titleKey: 'quick.faceOnly.title',
    descKey: 'quick.faceOnly.desc',
    category: 'animation',
    select: (s) => s.settings.avatar?.animation?.faceExpressionOnlyMode ?? false,
    apply: applyAnim('faceExpressionOnlyMode'),
  },
  {
    id: 'animation.breathing',
    titleKey: 'quick.breathing.title',
    descKey: 'quick.breathing.desc',
    category: 'animation',
    select: (s) => s.settings.avatar?.animation?.enableBreathing ?? true,
    apply: applyAnim('enableBreathing'),
  },
  {
    id: 'animation.eyeDrift',
    titleKey: 'quick.eyeDrift.title',
    descKey: 'quick.eyeDrift.desc',
    category: 'animation',
    select: (s) => s.settings.avatar?.animation?.enableEyeDrift ?? true,
    apply: applyAnim('enableEyeDrift'),
  },
  {
    id: 'animation.gazeFollow',
    titleKey: 'quick.gazeFollow.title',
    descKey: 'quick.gazeFollow.desc',
    category: 'animation',
    select: (s) => s.settings.avatar?.animation?.gazeFollow ?? true,
    apply: applyAnim('gazeFollow'),
  },
  {
    id: 'animation.backchannel',
    titleKey: 'quick.backchannel.title',
    descKey: 'quick.backchannel.desc',
    category: 'animation',
    select: (s) => s.settings.avatar?.animation?.backchannel ?? true,
    apply: applyAnim('backchannel'),
  },
  {
    id: 'animation.gestures',
    titleKey: 'quick.gestures.title',
    descKey: 'quick.gestures.desc',
    category: 'animation',
    select: (s) => s.settings.avatar?.animation?.enableGestures ?? true,
    apply: applyAnim('enableGestures'),
  },
  {
    id: 'animation.motionClips',
    titleKey: 'quick.motionClips.title',
    descKey: 'quick.motionClips.desc',
    category: 'animation',
    select: (s) => s.settings.avatar?.animation?.enableMotionClips ?? true,
    apply: applyAnim('enableMotionClips'),
  },
  {
    id: 'animation.dancing',
    titleKey: 'quick.dancing.title',
    descKey: 'quick.dancing.desc',
    category: 'animation',
    select: (s) => s.settings.avatar?.animation?.enableDancing ?? true,
    apply: applyAnim('enableDancing'),
  },

  /* ─── 음성 ─── */
  {
    id: 'voice.globalShortcut',
    titleKey: 'quick.globalShortcut.title',
    descKey: 'quick.globalShortcut.desc',
    category: 'voice',
    select: (s) => s.settings.globalShortcut?.enabled ?? true,
    apply: (v) =>
      useSettingsStore.getState().setGlobalShortcutSettings({ enabled: v }),
  },

  /* ─── 화면 ─── */
  {
    id: 'screen.watch',
    titleKey: 'quick.screenWatch.title',
    descKey: 'quick.screenWatch.desc',
    category: 'screen',
    select: (s) => s.settings.screenWatch?.enabled ?? false,
    apply: (v) =>
      useSettingsStore.getState().setScreenWatchSettings({ enabled: v }),
  },
  {
    id: 'screen.silentHours',
    titleKey: 'quick.silentHours.title',
    descKey: 'quick.silentHours.desc',
    category: 'screen',
    select: (s) => s.settings.screenWatch?.silentHours?.enabled ?? false,
    apply: (v) => {
      const st = useSettingsStore.getState();
      st.setScreenWatchSettings({
        silentHours: { ...st.settings.screenWatch.silentHours, enabled: v },
      });
    },
  },

  /* ─── Channels ─── */
  {
    id: 'channels.enabled',
    titleKey: 'quick.channels.title',
    descKey: 'quick.channels.desc',
    category: 'channels',
    select: (s) => s.settings.mcpEnabled,
    apply: (v) => useSettingsStore.getState().setSettings({ mcpEnabled: v }),
  },

  /* ─── 자발적 대화 ─── */
  {
    id: 'proactive.enabled',
    titleKey: 'quick.proactive.title',
    descKey: 'quick.proactive.desc',
    category: 'proactive',
    select: (s) => s.settings.proactive?.enabled ?? false,
    apply: (v) =>
      useSettingsStore.getState().setProactive({ enabled: v }),
  },
];

const TOGGLE_BY_ID: Record<string, QuickToggleDef> = QUICK_TOGGLES.reduce(
  (acc, def) => ({ ...acc, [def.id]: def }),
  {} as Record<string, QuickToggleDef>
);

export function getQuickToggle(id: string): QuickToggleDef | undefined {
  return TOGGLE_BY_ID[id];
}

/** 카테고리별 그룹화 (설정 체크리스트용) */
export const QUICK_TOGGLES_BY_CATEGORY: Record<QuickToggleCategory, QuickToggleDef[]> =
  QUICK_TOGGLES.reduce((acc, def) => {
    acc[def.category] = acc[def.category] || [];
    acc[def.category].push(def);
    return acc;
  }, {} as Record<QuickToggleCategory, QuickToggleDef[]>);

/** Settings persist 마이그레이션/검증에 사용 */
export const ALL_QUICK_ACTION_IDS: ReadonlySet<string> = new Set(
  QUICK_TOGGLES.map((d) => d.id)
);

/** 카테고리 표시 순서 + i18n 키 */
export const CATEGORY_ORDER: QuickToggleCategory[] = [
  'avatar',
  'animation',
  'voice',
  'screen',
  'channels',
  'proactive',
];

export const CATEGORY_LABEL_KEY: Record<QuickToggleCategory, string> = {
  avatar: 'quick.category.avatar',
  animation: 'quick.category.animation',
  voice: 'quick.category.voice',
  screen: 'quick.category.screen',
  channels: 'quick.category.channels',
  proactive: 'quick.category.proactive',
};
