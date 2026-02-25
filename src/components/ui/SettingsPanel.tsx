import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAvatarStore } from '../../stores/avatarStore';
import LLMSettings from '../settings/LLMSettings';
import VoiceSettings from '../settings/VoiceSettings';
import AvatarSettings from '../settings/AvatarSettings';
import LicensesSettings from '../settings/LicensesSettings';
import UpdateSettings from '../settings/UpdateSettings';
import UserProfile from '../auth/UserProfile';

export default function SettingsPanel() {
  const { t } = useTranslation();
  const { closeSettings, setLanguage, settings, resetSettings, setAvatarSettings } = useSettingsStore();
  const { manualRotation } = useAvatarStore();

  const handleSave = () => {
    setAvatarSettings({
      initialViewRotation: {
        x: Math.max(-0.5, Math.min(0.5, manualRotation.x)),
        y: manualRotation.y,
      },
    });
    closeSettings();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" data-interactive="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeSettings}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            {t('settings.title')}
          </h2>
          <button
            onClick={closeSettings}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg
              className="w-6 h-6 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)] custom-scrollbar space-y-6">
          {/* Account */}
          <UserProfile />

          {/* Language Setting */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.language')}
            </label>
            <select
              value={settings.language}
              onChange={(e) => setLanguage(e.target.value as 'ko' | 'en')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
          </div>

          {/* LLM Settings */}
          <LLMSettings />

          {/* Voice Settings */}
          <VoiceSettings />

          {/* Avatar Settings */}
          <AvatarSettings />

          {/* Update Settings */}
          <UpdateSettings />

          {/* License Settings */}
          <LicensesSettings />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={resetSettings}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            {t('settings.reset')}
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
