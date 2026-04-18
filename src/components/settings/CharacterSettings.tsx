import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
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
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.character.preset')}
        </label>
        <div className="flex flex-wrap gap-2">
          {CHARACTER_PRESETS.map((preset) => (
            <button
              key={preset.meta.id}
              onClick={() => handlePresetApply(preset.meta.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                character.personality.archetype === preset.meta.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title={t(preset.meta.descriptionKey)}
            >
              {t(preset.meta.labelKey)}
            </button>
          ))}
          <button
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              character.personality.archetype === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => setCharacter({ personality: { ...character.personality, archetype: 'custom' } })}
          >
            {t('settings.character.presetCustom')}
          </button>
        </div>
        {selectedPreset && (
          <p className="text-xs text-gray-500">
            {t(selectedPreset.meta.descriptionKey)}
            {' · '}
            {t('settings.character.recommendedVoice', { voice: selectedPreset.meta.recommendedVoice })}
          </p>
        )}
      </div>

      {/* Character Name */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.character.name')}
        </label>
        <input
          type="text"
          value={character.name}
          onChange={(e) => setCharacter({ name: e.target.value })}
          placeholder={t('settings.character.namePlaceholder')}
          maxLength={40}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Age & Species */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">
            {t('settings.character.age')}
          </label>
          <input
            type="text"
            value={character.age || ''}
            onChange={(e) => setCharacter({ age: e.target.value || undefined })}
            placeholder={t('settings.character.agePlaceholder')}
            maxLength={40}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">
            {t('settings.character.species')}
          </label>
          <input
            type="text"
            value={character.species || ''}
            onChange={(e) => setCharacter({ species: e.target.value || undefined })}
            placeholder={t('settings.character.speciesPlaceholder')}
            maxLength={40}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Personality Traits */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.character.traits')}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(character.personality.traits || []).map((trait, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
            >
              {trait}
              <button
                onClick={() => handleRemoveTrait(i)}
                className="text-blue-500 hover:text-blue-800"
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
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
            <button
              onClick={handleAddTrait}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300"
            >
              {t('settings.character.addTrait')}
            </button>
          </div>
        )}
      </div>

      {/* Speech Style */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.character.speechStyle')}
        </label>
        <input
          type="text"
          value={character.personality.speechStyle}
          onChange={(e) => setCharacter({ personality: { ...character.personality, speechStyle: e.target.value } })}
          placeholder={t('settings.character.speechStylePlaceholder')}
          maxLength={100}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {/* Emotional Tendency */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.character.emotionalTendency')}
        </label>
        <div className="flex flex-wrap gap-2">
          {(['expressive', 'reserved', 'tsundere', 'balanced'] as EmotionalTendency[]).map((tendency) => (
            <button
              key={tendency}
              onClick={() => setCharacter({ personality: { ...character.personality, emotionalTendency: tendency } })}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                character.personality.emotionalTendency === tendency
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t(`settings.character.tendency${tendency.charAt(0).toUpperCase() + tendency.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      {/* User Relation & Honorific */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">
            {t('settings.character.userRelation')}
          </label>
          <input
            type="text"
            value={character.userRelation}
            onChange={(e) => setCharacter({ userRelation: e.target.value })}
            placeholder={t('settings.character.userRelationPlaceholder')}
            maxLength={40}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">
            {t('settings.character.honorific')}
          </label>
          <select
            value={character.honorific}
            onChange={(e) => setCharacter({ honorific: e.target.value as Honorific })}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="casual">{t('settings.character.honorificCasual')}</option>
            <option value="polite">{t('settings.character.honorificPolite')}</option>
            <option value="mixed">{t('settings.character.honorificMixed')}</option>
          </select>
        </div>
      </div>

      {/* Background */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.character.background')}
        </label>
        <textarea
          value={character.background || ''}
          onChange={(e) => setCharacter({ background: e.target.value || undefined })}
          placeholder={t('settings.character.backgroundPlaceholder')}
          maxLength={500}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y"
        />
        <p className="text-xs text-gray-500 text-right">
          {(character.background || '').length}/500
        </p>
      </div>

      {/* Likes & Dislikes */}
      <div className="grid grid-cols-2 gap-3">
        {/* Likes */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-600">
            {t('settings.character.likes')}
          </label>
          <div className="flex flex-wrap gap-1">
            {(character.likes || []).map((like, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                {like}
                <button onClick={() => handleRemoveTag('likes', i)} className="text-green-500 hover:text-green-800">x</button>
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
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
              />
              <button
                onClick={() => handleAddTag('likes', newLike, setNewLike)}
                className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded hover:bg-gray-300"
              >
                {t('settings.character.addLike')}
              </button>
            </div>
          )}
        </div>

        {/* Dislikes */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-600">
            {t('settings.character.dislikes')}
          </label>
          <div className="flex flex-wrap gap-1">
            {(character.dislikes || []).map((dislike, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                {dislike}
                <button onClick={() => handleRemoveTag('dislikes', i)} className="text-red-500 hover:text-red-800">x</button>
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
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
              />
              <button
                onClick={() => handleAddTag('dislikes', newDislike, setNewDislike)}
                className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded hover:bg-gray-300"
              >
                {t('settings.character.addDislike')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Example Dialogues */}
      <div className="space-y-2 border-t pt-4 mt-4">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.character.exampleDialogues')}
        </label>

        {(character.exampleDialogues || []).map((example, i) => (
          <div key={i} className="space-y-1 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">#{i + 1}</span>
              <button
                onClick={() => handleRemoveExample(i)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                {t('settings.character.removeExample')}
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">{t('settings.character.exampleUser')}</label>
              <input
                type="text"
                value={example.user}
                onChange={(e) => handleUpdateExample(i, 'user', e.target.value)}
                maxLength={100}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">{t('settings.character.exampleAssistant')}</label>
              <input
                type="text"
                value={example.assistant}
                onChange={(e) => handleUpdateExample(i, 'assistant', e.target.value)}
                maxLength={200}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
        ))}

        {(character.exampleDialogues || []).length < 5 && (
          <button
            onClick={handleAddExample}
            className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            {t('settings.character.addExample')}
          </button>
        )}
      </div>

      {/* Proactive Chat (Phase 3) */}
      <div className="space-y-3 border-t pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-700">
          {t('settings.proactive.title')}
        </h4>

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm text-gray-600">
              {t('settings.proactive.enabled')}
            </span>
            <span className="text-xs text-gray-400">
              {t('settings.proactive.enabledDesc')}
            </span>
          </div>
          <button
            onClick={() => setProactive({ enabled: !(settings.proactive?.enabled ?? false) })}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
              settings.proactive?.enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.proactive?.enabled ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        {settings.proactive?.enabled && (
          <>
            <div className="space-y-1">
              <label className="block text-xs text-gray-600">
                {t('settings.proactive.idleMinutes', { value: settings.proactive?.idleMinutes ?? 5 })}
              </label>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={settings.proactive?.idleMinutes ?? 5}
                onChange={(e) => setProactive({ idleMinutes: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-gray-600">
                {t('settings.proactive.cooldownMinutes', { value: settings.proactive?.cooldownMinutes ?? 10 })}
              </label>
              <input
                type="range"
                min="1"
                max="60"
                step="1"
                value={settings.proactive?.cooldownMinutes ?? 10}
                onChange={(e) => setProactive({ cooldownMinutes: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
