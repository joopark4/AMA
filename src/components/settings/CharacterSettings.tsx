import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { Row, Toggle } from './forms';
import {
  CHARACTER_PRESETS,
  DEFAULT_CHARACTER_PROFILE,
  type CharacterArchetype,
  type EmotionalTendency,
  type Honorific,
  type ExampleDialogue,
} from '../../services/character';

export default function CharacterSettings() {
  const { t } = useTranslation();
  const { settings, setCharacter, applyCharacterPreset, setProactive } = useSettingsStore();
  const character = settings.character ?? DEFAULT_CHARACTER_PROFILE;
  const [newTrait, setNewTrait] = useState('');
  const [newLike, setNewLike] = useState('');
  const [newDislike, setNewDislike] = useState('');

  const handlePresetApply = (archetype: CharacterArchetype) => {
    if (archetype === 'custom') return;
    const preset = CHARACTER_PRESETS.find(p => p.meta.id === archetype);
    if (!preset) return;
    if (!confirm(t('settings.character.applyPresetConfirm'))) return;
    // 프리셋 적용은 baseline으로 초기화해 이전 archetype의 optional 필드를 누수시키지 않음
    applyCharacterPreset(preset.profile);
  };

  const handleAddTrait = () => {
    const trimmed = newTrait.trim();
    if (!trimmed) return;
    const current = character.personality.traits || [];
    if (current.length >= 5) return;
    setCharacter({
      personality: { ...character.personality, traits: [...current, trimmed] },
    });
    setNewTrait('');
  };

  const handleRemoveTrait = (index: number) => {
    const current = [...(character.personality.traits || [])];
    current.splice(index, 1);
    setCharacter({
      personality: { ...character.personality, traits: current },
    });
  };

  const handleAddTag = (
    field: 'likes' | 'dislikes',
    value: string,
    setter: (v: string) => void,
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const current = character[field] || [];
    if (current.length >= 10) return;
    setCharacter({ [field]: [...current, trimmed] });
    setter('');
  };

  const handleRemoveTag = (field: 'likes' | 'dislikes', index: number) => {
    const current = [...(character[field] || [])];
    current.splice(index, 1);
    setCharacter({ [field]: current });
  };

  const handleAddExample = () => {
    const current = character.exampleDialogues || [];
    if (current.length >= 5) return;
    setCharacter({
      exampleDialogues: [...current, { user: '', assistant: '' }],
    });
  };

  const handleUpdateExample = (index: number, field: keyof ExampleDialogue, value: string) => {
    const current = [...(character.exampleDialogues || [])];
    current[index] = { ...current[index], [field]: value };
    setCharacter({ exampleDialogues: current });
  };

  const handleRemoveExample = (index: number) => {
    const current = [...(character.exampleDialogues || [])];
    current.splice(index, 1);
    setCharacter({ exampleDialogues: current });
  };

  const selectedPreset = CHARACTER_PRESETS.find(p => p.meta.id === character.personality.archetype);

  return (
    <div className="space-y-4">
      {/* Preset Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
          {t('settings.character.preset')}
        </label>
        <div className="flex flex-wrap gap-2">
          {CHARACTER_PRESETS.map((preset) => {
            const active = character.personality.archetype === preset.meta.id;
            return (
              <button
                key={preset.meta.id}
                onClick={() => handlePresetApply(preset.meta.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
                style={
                  active
                    ? { background: 'var(--accent)', color: 'white' }
                    : {
                        background: 'oklch(1 0 0 / 0.7)',
                        color: 'var(--ink-2)',
                        boxShadow: 'inset 0 0 0 1px var(--hairline)',
                      }
                }
                title={t(preset.meta.descriptionKey)}
              >
                {t(preset.meta.labelKey)}
              </button>
            );
          })}
          {(() => {
            const active = character.personality.archetype === 'custom';
            return (
              <button
                className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
                style={
                  active
                    ? { background: 'var(--accent)', color: 'white' }
                    : {
                        background: 'oklch(1 0 0 / 0.7)',
                        color: 'var(--ink-2)',
                        boxShadow: 'inset 0 0 0 1px var(--hairline)',
                      }
                }
                onClick={() => setCharacter({ personality: { ...character.personality, archetype: 'custom' } })}
              >
                {t('settings.character.presetCustom')}
              </button>
            );
          })()}
        </div>
        {selectedPreset && (
          <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
            {t(selectedPreset.meta.descriptionKey)}
            {' · '}
            {t('settings.character.recommendedVoice', { voice: selectedPreset.meta.recommendedVoice })}
          </p>
        )}
      </div>

      {/* Character Name */}
      <div className="space-y-1">
        <label className="block text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
          {t('settings.character.name')}
        </label>
        <input
          type="text"
          value={character.name}
          onChange={(e) => setCharacter({ name: e.target.value })}
          placeholder={t('settings.character.namePlaceholder')}
          maxLength={40}
          className="w-full px-3 py-2 border rounded-lg focus:border-transparent text-sm"
          style={{ borderColor: 'var(--hairline)', boxShadow: 'none' }}
          onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-soft)'; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>

      {/* Age & Species */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
            {t('settings.character.age')}
          </label>
          <input
            type="text"
            value={character.age || ''}
            onChange={(e) => setCharacter({ age: e.target.value || undefined })}
            placeholder={t('settings.character.agePlaceholder')}
            maxLength={40}
            className="w-full px-3 py-1.5 border rounded-lg text-sm"
            style={{ borderColor: 'var(--hairline)' }}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
            {t('settings.character.species')}
          </label>
          <input
            type="text"
            value={character.species || ''}
            onChange={(e) => setCharacter({ species: e.target.value || undefined })}
            placeholder={t('settings.character.speciesPlaceholder')}
            maxLength={40}
            className="w-full px-3 py-1.5 border rounded-lg text-sm"
            style={{ borderColor: 'var(--hairline)' }}
          />
        </div>
      </div>

      {/* Personality Traits */}
      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
          {t('settings.character.traits')}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(character.personality.traits || []).map((trait, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}
            >
              {trait}
              <button
                onClick={() => handleRemoveTrait(i)}
                className="hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                x
              </button>
            </span>
          ))}
        </div>
        {(character.personality.traits || []).length < 5 && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newTrait}
              onChange={(e) => setNewTrait(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTrait()}
              placeholder={t('settings.character.traitsPlaceholder')}
              maxLength={20}
              className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
              style={{ borderColor: 'var(--hairline)' }}
            />
            <button
              onClick={handleAddTrait}
              className="px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-[oklch(0.92_0.02_60_/_0.7)]"
              style={{ background: 'var(--surface-1)', color: 'var(--ink-2)' }}
            >
              {t('settings.character.addTrait')}
            </button>
          </div>
        )}
      </div>

      {/* Speech Style */}
      <div className="space-y-1">
        <label className="block text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
          {t('settings.character.speechStyle')}
        </label>
        <input
          type="text"
          value={character.personality.speechStyle}
          onChange={(e) => setCharacter({ personality: { ...character.personality, speechStyle: e.target.value } })}
          placeholder={t('settings.character.speechStylePlaceholder')}
          maxLength={100}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          style={{ borderColor: 'var(--hairline)' }}
        />
      </div>

      {/* Emotional Tendency */}
      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
          {t('settings.character.emotionalTendency')}
        </label>
        <div className="flex flex-wrap gap-2">
          {(['expressive', 'reserved', 'tsundere', 'balanced'] as EmotionalTendency[]).map((tendency) => (
            <button
              key={tendency}
              onClick={() => setCharacter({ personality: { ...character.personality, emotionalTendency: tendency } })}
              className="px-3 py-1 text-xs font-medium rounded-full transition-colors"
              style={
                character.personality.emotionalTendency === tendency
                  ? { background: 'var(--accent)', color: 'white' }
                  : { background: 'var(--surface-1)', color: 'var(--ink-2)' }
              }
            >
              {t(`settings.character.tendency${tendency.charAt(0).toUpperCase() + tendency.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      {/* User Relation & Honorific */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
            {t('settings.character.userRelation')}
          </label>
          <input
            type="text"
            value={character.userRelation}
            onChange={(e) => setCharacter({ userRelation: e.target.value })}
            placeholder={t('settings.character.userRelationPlaceholder')}
            maxLength={40}
            className="w-full px-3 py-1.5 border rounded-lg text-sm"
            style={{ borderColor: 'var(--hairline)' }}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
            {t('settings.character.honorific')}
          </label>
          <select
            value={character.honorific}
            onChange={(e) => setCharacter({ honorific: e.target.value as Honorific })}
            className="w-full px-3 py-1.5 border rounded-lg text-sm"
            style={{ borderColor: 'var(--hairline)' }}
          >
            <option value="casual">{t('settings.character.honorificCasual')}</option>
            <option value="polite">{t('settings.character.honorificPolite')}</option>
            <option value="mixed">{t('settings.character.honorificMixed')}</option>
          </select>
        </div>
      </div>

      {/* Background */}
      <div className="space-y-1">
        <label className="block text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
          {t('settings.character.background')}
        </label>
        <textarea
          value={character.background || ''}
          onChange={(e) => setCharacter({ background: e.target.value || undefined })}
          placeholder={t('settings.character.backgroundPlaceholder')}
          maxLength={500}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg text-sm resize-y"
          style={{ borderColor: 'var(--hairline)' }}
        />
        <p className="text-xs text-right" style={{ color: 'var(--ink-3)' }}>
          {(character.background || '').length}/500
        </p>
      </div>

      {/* Likes & Dislikes
          grid cell과 input에 min-w-0을 달아 placeholder가 컬럼을 침범하지 않게 한다
          (flex/grid item의 기본 min-width: auto가 input min-content를 따라가 오버플로우 발생). */}
      <div className="grid grid-cols-2 gap-3">
        {/* Likes */}
        <div className="space-y-2 min-w-0">
          <label className="block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
            {t('settings.character.likes')}
          </label>
          <div className="flex flex-wrap gap-1">
            {(character.likes || []).map((like, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full"
                style={{ background: 'oklch(0.94 0.06 160 / 0.6)', color: 'oklch(0.42 0.12 160)' }}
              >
                {like}
                <button
                  onClick={() => handleRemoveTag('likes', i)}
                  className="hover:underline"
                  style={{ color: 'var(--ok)' }}
                >x</button>
              </span>
            ))}
          </div>
          {(character.likes || []).length < 10 && (
            <div className="flex gap-1">
              <input
                type="text"
                value={newLike}
                onChange={(e) => setNewLike(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag('likes', newLike, setNewLike)}
                placeholder={t('settings.character.likesPlaceholder')}
                maxLength={20}
                className="flex-1 min-w-0 px-2 py-1 border rounded text-xs"
                style={{ borderColor: 'var(--hairline)' }}
              />
              <button
                onClick={() => handleAddTag('likes', newLike, setNewLike)}
                className="shrink-0 px-2 py-1 text-xs rounded hover:bg-[oklch(0.92_0.02_60_/_0.7)]"
                style={{ background: 'var(--surface-1)', color: 'var(--ink-2)' }}
              >
                {t('settings.character.addLike')}
              </button>
            </div>
          )}
        </div>

        {/* Dislikes */}
        <div className="space-y-2 min-w-0">
          <label className="block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
            {t('settings.character.dislikes')}
          </label>
          <div className="flex flex-wrap gap-1">
            {(character.dislikes || []).map((dislike, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full"
                style={{ background: 'oklch(0.95 0.04 25 / 0.6)', color: 'oklch(0.45 0.18 25)' }}
              >
                {dislike}
                <button
                  onClick={() => handleRemoveTag('dislikes', i)}
                  className="hover:underline"
                  style={{ color: 'var(--danger)' }}
                >x</button>
              </span>
            ))}
          </div>
          {(character.dislikes || []).length < 10 && (
            <div className="flex gap-1">
              <input
                type="text"
                value={newDislike}
                onChange={(e) => setNewDislike(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag('dislikes', newDislike, setNewDislike)}
                placeholder={t('settings.character.dislikesPlaceholder')}
                maxLength={20}
                className="flex-1 min-w-0 px-2 py-1 border rounded text-xs"
                style={{ borderColor: 'var(--hairline)' }}
              />
              <button
                onClick={() => handleAddTag('dislikes', newDislike, setNewDislike)}
                className="shrink-0 px-2 py-1 text-xs rounded hover:bg-[oklch(0.92_0.02_60_/_0.7)]"
                style={{ background: 'var(--surface-1)', color: 'var(--ink-2)' }}
              >
                {t('settings.character.addDislike')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Example Dialogues */}
      <div className="space-y-2 border-t pt-4 mt-4" style={{ borderColor: 'var(--hairline)' }}>
        <label className="block text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
          {t('settings.character.exampleDialogues')}
        </label>

        {(character.exampleDialogues || []).map((example, i) => (
          <div
            key={i}
            className="space-y-1 p-3 rounded-lg border"
            style={{ background: 'oklch(1 0 0 / 0.45)', borderColor: 'var(--hairline)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}>#{i + 1}</span>
              <button
                onClick={() => handleRemoveExample(i)}
                className="text-xs hover:underline"
                style={{ color: 'var(--danger)' }}
              >
                {t('settings.character.removeExample')}
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--ink-3)' }}>{t('settings.character.exampleUser')}</label>
              <input
                type="text"
                value={example.user}
                onChange={(e) => handleUpdateExample(i, 'user', e.target.value)}
                maxLength={100}
                className="w-full px-2 py-1 border rounded text-sm"
                style={{ borderColor: 'var(--hairline)' }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--ink-3)' }}>{t('settings.character.exampleAssistant')}</label>
              <input
                type="text"
                value={example.assistant}
                onChange={(e) => handleUpdateExample(i, 'assistant', e.target.value)}
                maxLength={200}
                className="w-full px-2 py-1 border rounded text-sm"
                style={{ borderColor: 'var(--hairline)' }}
              />
            </div>
          </div>
        ))}

        {(character.exampleDialogues || []).length < 5 && (
          <button
            onClick={handleAddExample}
            className="w-full px-3 py-2 text-sm font-medium rounded-lg hover:bg-[oklch(0.92_0.02_60_/_0.7)] transition-colors"
            style={{ background: 'var(--surface-1)', color: 'var(--ink-2)' }}
          >
            {t('settings.character.addExample')}
          </button>
        )}
      </div>

      {/* Proactive Chat (Phase 3) */}
      <div className="space-y-3 border-t pt-4 mt-4" style={{ borderColor: 'var(--hairline)' }}>
        <h4 className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
          {t('settings.proactive.title')}
        </h4>

        <Row
          label={t('settings.proactive.enabled')}
          description={t('settings.proactive.enabledDesc')}
        >
          <Toggle
            on={settings.proactive?.enabled ?? false}
            onChange={(v) => setProactive({ enabled: v })}
          />
        </Row>

        {settings.proactive?.enabled && (
          <>
            <div className="space-y-1">
              <label className="block text-xs" style={{ color: 'var(--ink-2)' }}>
                {t('settings.proactive.idleMinutes', { value: settings.proactive?.idleMinutes ?? 5 })}
              </label>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={settings.proactive?.idleMinutes ?? 5}
                onChange={(e) => setProactive({ idleMinutes: parseInt(e.target.value) })}
                className="ama-slider"
                data-interactive="true"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs" style={{ color: 'var(--ink-2)' }}>
                {t('settings.proactive.cooldownMinutes', { value: settings.proactive?.cooldownMinutes ?? 10 })}
              </label>
              <input
                type="range"
                min="1"
                max="60"
                step="1"
                value={settings.proactive?.cooldownMinutes ?? 10}
                onChange={(e) => setProactive({ cooldownMinutes: parseInt(e.target.value) })}
                className="ama-slider"
                data-interactive="true"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
