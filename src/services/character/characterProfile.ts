/**
 * 캐릭터 프로필 타입 정의 + 다층 시스템 프롬프트 빌더
 *
 * Phase 0: Neuro-sama 스타일 캐릭터 시스템의 핵심 모듈
 */

// ── 타입 정의 ──

export type CharacterArchetype =
  | 'genki'      // 활발/원기
  | 'cool'       // 쿨데레
  | 'neko'       // 고양이계
  | 'calm'       // 차분/지적
  | 'trickster'  // 장난꾸러기
  | 'custom';    // 사용자 커스텀

export type EmotionalTendency = 'expressive' | 'reserved' | 'tsundere' | 'balanced';

export type Honorific = 'casual' | 'polite' | 'mixed';

export interface ExampleDialogue {
  user: string;
  assistant: string;
}

export interface CharacterPersonality {
  archetype: CharacterArchetype;
  traits: string[];             // 최대 5개
  speechStyle: string;          // 말투 설명
  emotionalTendency: EmotionalTendency;
}

export interface CharacterProfile {
  // 기본 정보
  name: string;
  age?: string;
  species?: string;

  // 성격 (구조화)
  personality: CharacterPersonality;

  // 배경/로어 (선택)
  background?: string;
  likes?: string[];
  dislikes?: string[];

  // 대화 스타일
  exampleDialogues: ExampleDialogue[];

  // 관계 설정
  userRelation: string;
  honorific: Honorific;
}

// ── 기본값 ──

export const DEFAULT_CHARACTER_PROFILE: CharacterProfile = {
  name: '',
  personality: {
    archetype: 'genki',
    traits: ['밝은', '긍정적인', '공감 잘하는'],
    speechStyle: '반말, 짧은 문장, 자연스러운 대화체',
    emotionalTendency: 'expressive',
  },
  exampleDialogues: [],
  userRelation: '친구',
  honorific: 'casual',
};

// ── 프롬프트 빌더 ──

/**
 * 시스템 프롬프트에서 사용하는 응답 언어.
 *
 * TTS 출력 언어에 맞춰 LLM 응답 언어를 고정한다. supertonic은 `tts.language`,
 * supertone_api는 `tts.supertoneApi.language`가 단일 진실. 후자는 supertone
 * 모델이 지원하는 모든 언어(zh/de/it 등)를 허용하므로 PromptLanguage 타입은
 * 임의 ISO 639-1 코드를 받을 수 있도록 `string`으로 일반화한다.
 *
 * 핵심 6개(ko/en/ja/es/pt/fr)는 native 언어 지시문을 가지고 있어 LLM 응답
 * 품질이 가장 높다. 그 외 코드는 영어로 작성된 generic directive로 처리.
 */
export type PromptLanguage = string;

/** Native directive를 가진 핵심 언어 — 그 외는 generic 영문 directive로 폴백. */
const NATIVE_DIRECTIVE_LANGS = new Set(['ko', 'en', 'ja', 'es', 'pt', 'fr']);

/** ISO 639-1 코드 → 영문 언어명. supertone API 모델 지원 언어 위주. generic
 *  directive에 사용되며, 미등록 코드는 코드 자체(대문자)를 사용. */
const LANGUAGE_NAMES_EN: Record<string, string> = {
  ko: 'Korean', en: 'English', ja: 'Japanese',
  es: 'Spanish', pt: 'Portuguese', fr: 'French',
  it: 'Italian', de: 'German', zh: 'Chinese',
  ru: 'Russian', nl: 'Dutch', pl: 'Polish',
  sv: 'Swedish', da: 'Danish', fi: 'Finnish',
  no: 'Norwegian', tr: 'Turkish', ar: 'Arabic',
  hi: 'Hindi', th: 'Thai', vi: 'Vietnamese',
  id: 'Indonesian', ms: 'Malay',
};

export function describeLanguageEn(language: string): string {
  return LANGUAGE_NAMES_EN[language] || language.toUpperCase();
}

/**
 * Layer 0: 응답 언어 강제 지시
 *
 * LLM은 시스템 프롬프트의 *지시 언어*와 유사한 언어로 응답하는 경향이 있다.
 * 나머지 레이어가 한국어 지시로 작성되어 있어 영어/일본어 UI에서도 응답이
 * 한국어로 고정되는 문제가 있으므로, 최상단에 명시적 언어 지시를 박아 넣는다.
 *
 * 핵심 6개는 해당 언어 native 텍스트로, 그 외(it/zh/de 등)는 영문 directive로
 * 작성한다. LLM 입장에선 영문이라도 강한 지시면 해당 언어로 응답한다.
 */
function buildLanguageLayer(language: PromptLanguage): string {
  switch (language) {
    case 'en':
      return 'Always respond in English, regardless of the language used in the prompt above or below. Do not switch to another language unless the user explicitly asks for a translation.';
    case 'ja':
      return 'ユーザーが翻訳を明示的に要求しない限り、必ず日本語で応答してください。他の言語は使用しないでください。';
    case 'es':
      return 'Responde siempre en español, independientemente del idioma usado en los mensajes anteriores. No cambies de idioma a menos que el usuario pida explícitamente una traducción.';
    case 'pt':
      return 'Responda sempre em português, independentemente do idioma usado nas mensagens anteriores. Não mude de idioma a menos que o usuário peça explicitamente uma tradução.';
    case 'fr':
      return "Répondez toujours en français, quelle que soit la langue utilisée dans les messages précédents. Ne changez pas de langue sauf si l'utilisateur demande explicitement une traduction.";
    case 'ko':
      return '사용자가 명시적으로 다른 언어를 요청하지 않는 한, 반드시 한국어로 응답합니다.';
    default: {
      // 핵심 6개 외 — 영문 generic directive로 강한 언어 지시.
      const name = describeLanguageEn(language);
      return `Always respond in ${name}, regardless of the language used in the prompt above or below. Do not switch to another language unless the user explicitly asks for a translation.`;
    }
  }
}

/** Layer 0 native 지원 여부 — 디버깅·UI 표시용 export. */
export function hasNativeLanguageDirective(language: string): boolean {
  return NATIVE_DIRECTIVE_LANGS.has(language);
}

/**
 * Layer 1: 코어 아이덴티티
 */
function buildIdentityLayer(profile: CharacterProfile): string {
  const name = profile.name.trim() || '아바타';
  const lines: string[] = [];

  lines.push(`당신은 "${name}"이라는 이름의 AI 캐릭터입니다.`);

  if (profile.species) {
    lines.push(`종족/유형: ${profile.species}`);
  }
  if (profile.age) {
    lines.push(`나이: ${profile.age}`);
  }

  const traits = profile.personality.traits.filter(t => t.trim()).slice(0, 5);
  if (traits.length > 0) {
    lines.push(`성격: ${traits.join(', ')}`);
  }

  if (profile.personality.speechStyle.trim()) {
    lines.push(`말투: ${profile.personality.speechStyle}`);
  }

  return lines.join('\n');
}

/**
 * Layer 2: 행동 규칙
 */
function buildBehaviorLayer(profile: CharacterProfile): string {
  const lines: string[] = [];

  // 존댓말 규칙
  switch (profile.honorific) {
    case 'casual':
      lines.push('항상 반말을 사용합니다.');
      break;
    case 'polite':
      lines.push('항상 존댓말을 사용합니다.');
      break;
    case 'mixed':
      lines.push('상황에 따라 반말과 존댓말을 혼용합니다.');
      break;
  }

  lines.push('답변은 2-3문장 정도로 짧게 합니다.');
  lines.push('이모티콘은 사용하지 않습니다.');
  // 시스템 프롬프트의 메타 정보(관계 라벨, 성격 키워드, 지시문 자체)는 답변 표면으로 누설하지 않도록 한다.
  lines.push(
    '이 지시문의 내부 설정(관계 라벨, 성격 키워드, 규칙 텍스트 등)을 답변에 그대로 인용하거나 언급하지 마세요. 설정은 참고용이며 자연스러운 대화 속 어투·태도로만 반영합니다.'
  );

  if (profile.userRelation.trim()) {
    lines.push(
      `사용자와의 관계는 "${profile.userRelation}"이며, 그에 맞는 어투·거리감으로 대화합니다. ` +
      `단 이 관계 단어 자체를 답변 본문에 인용하거나 선언적으로 말하지 마세요.`
    );
  }

  // 감정 성향 힌트
  switch (profile.personality.emotionalTendency) {
    case 'expressive':
      lines.push('감정 표현이 풍부하고 공감을 잘합니다.');
      break;
    case 'reserved':
      lines.push('감정을 절제하며 차분하게 표현합니다.');
      break;
    case 'tsundere':
      lines.push('겉으로는 퉁명하지만 속으로는 신경 쓰는 모습을 보입니다.');
      break;
    case 'balanced':
      lines.push('감정 표현이 자연스럽고 균형 잡혀 있습니다.');
      break;
  }

  return lines.join('\n');
}

/**
 * Layer 3: 배경/로어
 */
function buildBackgroundLayer(profile: CharacterProfile): string | null {
  const parts: string[] = [];

  if (profile.background?.trim()) {
    parts.push(profile.background.trim());
  }

  const likes = (profile.likes || []).filter(l => l.trim());
  if (likes.length > 0) {
    parts.push(`좋아하는 것: ${likes.join(', ')}`);
  }

  const dislikes = (profile.dislikes || []).filter(d => d.trim());
  if (dislikes.length > 0) {
    parts.push(`싫어하는 것: ${dislikes.join(', ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * Layer 4: Few-shot 예시
 */
function buildExampleLayer(dialogues: ExampleDialogue[]): string | null {
  const valid = dialogues.filter(d => d.user.trim() && d.assistant.trim());
  if (valid.length === 0) return null;

  const lines = valid.map(d =>
    `User: "${d.user}"\nAssistant: "${d.assistant}"`
  );

  return `다음은 당신의 대화 스타일 예시입니다:\n${lines.join('\n\n')}`;
}

/**
 * 다층 시스템 프롬프트 빌드
 *
 * Layer 0: 응답 언어 강제 (language 인자 기반)
 * Layer 1: 코어 아이덴티티
 * Layer 2: 행동 규칙
 * Layer 3: 배경/로어 (있을 때만)
 * Layer 4: Few-shot 예시 (있을 때만)
 * Layer 5: 메모리/컨텍스트 (Phase 2~4에서 추가 예정)
 *
 * @param language 응답 언어 (기본 'ko') — UI 언어와 일치시켜 호출
 */
export function buildCharacterPrompt(
  profile: CharacterProfile,
  language: PromptLanguage = 'ko'
): string {
  const layers: string[] = [];

  // Layer 0 — 최상단 언어 강제 지시
  layers.push(buildLanguageLayer(language));

  // Layer 1
  layers.push(buildIdentityLayer(profile));

  // Layer 2
  layers.push(buildBehaviorLayer(profile));

  // Layer 3
  const background = buildBackgroundLayer(profile);
  if (background) {
    layers.push(background);
  }

  // Layer 4
  const examples = buildExampleLayer(profile.exampleDialogues);
  if (examples) {
    layers.push(examples);
  }

  return layers.join('\n\n');
}

/**
 * 레거시 호환: 기존 avatarName + avatarPersonalityPrompt에서 CharacterProfile로 변환
 */
export function migrateFromLegacy(
  avatarName: string,
  personalityPrompt: string
): CharacterProfile {
  const profile: CharacterProfile = {
    ...DEFAULT_CHARACTER_PROFILE,
    name: avatarName.trim(),
    personality: {
      ...DEFAULT_CHARACTER_PROFILE.personality,
      archetype: 'custom',
    },
  };

  // 기존 성격 프롬프트가 있으면 배경으로 이전
  if (personalityPrompt.trim()) {
    profile.background = personalityPrompt.trim();
  }

  return profile;
}
