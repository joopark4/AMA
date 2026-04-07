/**
 * 캐릭터 프로필 시스템 — 퍼블릭 API
 */

// 타입
export type {
  CharacterProfile,
  CharacterPersonality,
  CharacterArchetype,
  EmotionalTendency,
  Honorific,
  ExampleDialogue,
} from './characterProfile';

// 프로필 + 프롬프트 빌더
export {
  DEFAULT_CHARACTER_PROFILE,
  buildCharacterPrompt,
  migrateFromLegacy,
} from './characterProfile';

// 프리셋
export type { PresetEntry, PresetMeta } from './presets';
export { CHARACTER_PRESETS, getPresetByArchetype } from './presets';

// 감정 분석 (통합)
export type { EmotionMatch } from './analyzeEmotion';
export { analyzeEmotion, EMOTION_KEYWORDS } from './analyzeEmotion';

// 감정 가중치
export { getEmotionWeight } from './emotionWeights';
