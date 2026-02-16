import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AvatarCanvas from './components/avatar/AvatarCanvas';
import SpeechBubble from './components/ui/SpeechBubble';
import StatusIndicator from './components/ui/StatusIndicator';
import SettingsPanel from './components/ui/SettingsPanel';
import LightingControl from './components/avatar/LightingControl';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { useSettingsStore } from './stores/settingsStore';
import { useConversationStore } from './stores/conversationStore';
import { useClickThrough } from './hooks/useClickThrough';
import { ollamaClient } from './services/ai/ollamaClient';
import { localAiClient } from './services/ai/localAiClient';

function App() {
  const { i18n } = useTranslation();
  const { settings, isSettingsOpen, setLLMSettings } = useSettingsStore();
  const { currentResponse, isProcessing } = useConversationStore();

  // Enable click-through for transparent window (except on interactive elements)
  useClickThrough();

  useEffect(() => {
    i18n.changeLanguage(settings.language);
  }, [settings.language, i18n]);

  // Auto-detect and set available Ollama model on startup
  useEffect(() => {
    if (settings.llm.provider !== 'ollama' && settings.llm.provider !== 'localai') {
      return;
    }

    const loadModels = async () => {
      const models =
        settings.llm.provider === 'localai'
          ? await localAiClient.getAvailableModels()
          : await ollamaClient.getAvailableModels();

      if (models.length > 0 && !models.includes(settings.llm.model)) {
        console.log('[App] Current model not available, switching to:', models[0]);
        setLLMSettings({ model: models[0] });
      }
    };

    loadModels().catch(() => {});
  }, [settings.llm.provider, settings.llm.endpoint, settings.llm.model, setLLMSettings]);


  return (
    <div className="w-full h-full relative">
      {/* Main 3D Avatar Canvas - includes 3D model drag support */}
      <ErrorBoundary name="AvatarCanvas">
        <AvatarCanvas />
      </ErrorBoundary>

      {/* Lighting Control - draggable sun emoji */}
      <ErrorBoundary name="LightingControl">
        <LightingControl />
      </ErrorBoundary>

      {/* Speech Bubble - shows AI responses */}
      {currentResponse && (
        <ErrorBoundary name="SpeechBubble">
          <SpeechBubble message={currentResponse} />
        </ErrorBoundary>
      )}

      {/* Status Indicator - shows listening/processing state */}
      <ErrorBoundary name="StatusIndicator">
        <StatusIndicator isProcessing={isProcessing} />
      </ErrorBoundary>

      {/* Settings Panel - slide-in panel */}
      {isSettingsOpen && (
        <ErrorBoundary name="SettingsPanel">
          <SettingsPanel />
        </ErrorBoundary>
      )}
    </div>
  );
}

export default App;
