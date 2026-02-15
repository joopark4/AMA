import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { open } from '@tauri-apps/plugin-dialog';

export default function AvatarSettings() {
  const { t } = useTranslation();
  const { settings, setVrmModelPath, setAvatarSettings } = useSettingsStore();
  const { setEmotion, emotion } = useAvatarStore();
  const { speak, isSpeaking, stop } = useSpeechSynthesis();

  const handleSelectVRM = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'VRM Model',
            extensions: ['vrm'],
          },
        ],
      });

      if (selected && typeof selected === 'string') {
        setVrmModelPath(selected);
      }
    } catch (error) {
      console.error('Error selecting VRM file:', error);
    }
  };

  const emotions = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'relaxed', 'thinking'] as const;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-800">
        {t('settings.avatar.title')}
      </h3>

      {/* VRM Model Path */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.avatar.model')}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.vrmModelPath}
            readOnly
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm"
          />
          <button
            onClick={handleSelectVRM}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('settings.avatar.select')}
          </button>
        </div>
      </div>

      {/* Avatar Scale */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.avatar.scale', 'Avatar Size')}: {settings.avatar?.scale?.toFixed(1) || '1.0'}x
        </label>
        <input
          type="range"
          min="0.3"
          max="2.0"
          step="0.1"
          value={settings.avatar?.scale || 1.0}
          onChange={(e) => setAvatarSettings({ scale: parseFloat(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0.3x</span>
          <span>1.0x</span>
          <span>2.0x</span>
        </div>
      </div>

      {/* Expression Control */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.avatar.expression', 'Expression')}
        </label>
        <div className="flex flex-wrap gap-2">
          {emotions.map((em) => (
            <button
              key={em}
              onClick={() => setEmotion(em)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                emotion === em
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      {/* TTS Test */}
      <div className="space-y-2 border-t pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-700">TTS Test</h4>
        <p className="text-xs text-gray-500">Test text-to-speech with lip sync</p>
        <button
          onClick={() => {
            if (isSpeaking) {
              stop();
            } else {
              speak('안녕 나는 은연이라고해');
            }
          }}
          disabled={false}
          className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            isSpeaking
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          {isSpeaking ? 'Stop' : 'Speak: "안녕 나는 은연이라고해"'}
        </button>
      </div>

      {/* Physics Settings */}
      <div className="space-y-2 border-t pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-700">Physics</h4>

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">Enable Physics</label>
          <button
            onClick={() => setAvatarSettings({
              physics: {
                ...settings.avatar?.physics,
                enabled: !settings.avatar?.physics?.enabled,
              },
            })}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.avatar?.physics?.enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.avatar?.physics?.enabled ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        {settings.avatar?.physics?.enabled && (
          <>
            <div className="space-y-1">
              <label className="block text-xs text-gray-600">
                Gravity: {(settings.avatar?.physics?.gravityMultiplier ?? 1.0).toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                value={settings.avatar?.physics?.gravityMultiplier ?? 1.0}
                onChange={(e) => setAvatarSettings({
                  physics: {
                    ...settings.avatar?.physics,
                    gravityMultiplier: parseFloat(e.target.value),
                  },
                })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-gray-600">
                Stiffness: {(settings.avatar?.physics?.stiffnessMultiplier ?? 1.0).toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                value={settings.avatar?.physics?.stiffnessMultiplier ?? 1.0}
                onChange={(e) => setAvatarSettings({
                  physics: {
                    ...settings.avatar?.physics,
                    stiffnessMultiplier: parseFloat(e.target.value),
                  },
                })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </>
        )}
      </div>

      {/* Lighting Intensity */}
      <div className="space-y-2 border-t pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-700">
          {t('settings.avatar.lighting', 'Lighting')}
        </h4>

        <div className="space-y-1">
          <label className="block text-xs text-gray-600">
            Ambient: {(settings.avatar?.lighting?.ambientIntensity ?? 1.0).toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            value={settings.avatar?.lighting?.ambientIntensity ?? 1.0}
            onChange={(e) => setAvatarSettings({
              lighting: {
                ...settings.avatar?.lighting,
                ambientIntensity: parseFloat(e.target.value),
              },
            })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-gray-600">
            Directional: {(settings.avatar?.lighting?.directionalIntensity ?? 1.0).toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            value={settings.avatar?.lighting?.directionalIntensity ?? 1.0}
            onChange={(e) => setAvatarSettings({
              lighting: {
                ...settings.avatar?.lighting,
                directionalIntensity: parseFloat(e.target.value),
              },
            })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <div className="flex items-center justify-between mt-3">
          <label className="text-sm text-gray-600">Show Light Icon</label>
          <button
            onClick={() => setAvatarSettings({
              lighting: {
                ...settings.avatar?.lighting,
                showControl: !settings.avatar?.lighting?.showControl,
              },
            })}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.avatar?.lighting?.showControl !== false ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.avatar?.lighting?.showControl !== false ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Drag the sun icon near the avatar to adjust light direction.
        </p>
      </div>

      {/* Avatar Info */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          Supported format: VRM 0.x and 1.0 models.
          Recommended file size: under 30MB for smooth performance.
        </p>
      </div>
    </div>
  );
}
