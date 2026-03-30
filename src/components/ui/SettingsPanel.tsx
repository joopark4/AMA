import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAvatarStore } from '../../stores/avatarStore';
import SettingsSection from '../settings/SettingsSection';
import UserProfile from '../auth/UserProfile';
import LLMSettings from '../settings/LLMSettings';
import AudioDeviceSettings from '../settings/AudioDeviceSettings';
import VoiceSettings from '../settings/VoiceSettings';
import { PremiumVoiceSettings } from '../../features/premium-voice';
import AvatarSettings from '../settings/AvatarSettings';
import LicensesSettings from '../settings/LicensesSettings';
import UpdateSettings from '../settings/UpdateSettings';
import DataCleanupSettings from '../settings/DataCleanupSettings';
import { MCPSettings } from '../../features/channels';
import MonitorSettings from '../settings/MonitorSettings';
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
      <div className="relative bg-gray-100 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
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
        <div className="px-4 py-4 overflow-y-auto max-h-[calc(80vh-140px)] custom-scrollbar space-y-3">
          {/* Account */}
          <SettingsSection title={t('settings.account.title')}>
            <UserProfile />
          </SettingsSection>

          {/* General: Language + Monitor */}
          <SettingsSection title={t('settings.general.title')} defaultOpen>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {t('settings.language')}
              </label>
              <select
                value={settings.language}
                onChange={(e) => setLanguage(e.target.value as 'ko' | 'en' | 'ja')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </div>
            <MonitorSettings />
          </SettingsSection>

          {/* LLM Settings */}
          <SettingsSection title={t('settings.llm.title')}>
            <LLMSettings />
          </SettingsSection>

          {/* Audio Device Settings */}
          <SettingsSection title={t('settings.audioDevice.title')}>
            <AudioDeviceSettings />
          </SettingsSection>

          {/* Voice Settings */}
          <SettingsSection title={t('settings.voice.title')}>
            <VoiceSettings />
          </SettingsSection>

          {/* Premium Voice Settings */}
          <SettingsSection title={t('settings.premium.title')}>
            <PremiumVoiceSettings />
          </SettingsSection>

          {/* Avatar Settings */}
          <SettingsSection title={t('settings.avatar.title')}>
            <AvatarSettings />
          </SettingsSection>

          {/* Claude Code Channels */}
          <SettingsSection title={t('settings.mcp.title')}>
            <MCPSettings />
          </SettingsSection>

          {/* Update Settings */}
          <SettingsSection title={t('settings.update.title')}>
            <UpdateSettings />
          </SettingsSection>

          {/* Data Cleanup Settings */}
          <SettingsSection title={t('settings.dataCleanup.title')}>
            <DataCleanupSettings />
          </SettingsSection>

          {/* License Settings */}
          <SettingsSection title={t('settings.licenses.title')}>
            <LicensesSettings />
          </SettingsSection>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white">
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
