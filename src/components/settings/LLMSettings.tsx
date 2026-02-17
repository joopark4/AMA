import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, LLMProvider } from '../../stores/settingsStore';
import { ollamaClient } from '../../services/ai/ollamaClient';
import { localAiClient } from '../../services/ai/localAiClient';

const CLOUD_MODELS: Record<string, string[]> = {
  claude: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-haiku-20241022'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  gemini: ['gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash'],
};

export default function LLMSettings() {
  const { t } = useTranslation();
  const { settings, setLLMSettings } = useSettingsStore();
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch Ollama models on mount and when provider changes
  useEffect(() => {
    if (settings.llm.provider !== 'ollama' && settings.llm.provider !== 'localai') {
      return;
    }

    let isCancelled = false;

    const loadModels = async () => {
      setIsLoadingModels(true);

      const models =
        settings.llm.provider === 'localai'
          ? await localAiClient.getAvailableModels()
          : await ollamaClient.getAvailableModels();

      if (isCancelled) return;

      setOllamaModels(models);
      if (models.length > 0 && !models.includes(settings.llm.model)) {
        setLLMSettings({ model: models[0] });
      }
      setIsLoadingModels(false);
    };

    loadModels().catch(() => {
      if (isCancelled) return;
      setOllamaModels([]);
      setIsLoadingModels(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [settings.llm.provider, settings.llm.endpoint, settings.llm.model, setLLMSettings]);

  const getModelsForProvider = (provider: LLMProvider): string[] => {
    if (provider === 'ollama' || provider === 'localai') {
      return ollamaModels;
    }
    return CLOUD_MODELS[provider] || [];
  };

  const getDefaultEndpoint = (provider: LLMProvider): string | undefined => {
    if (provider === 'ollama') return 'http://localhost:11434';
    if (provider === 'localai') return 'http://localhost:8080';
    return undefined;
  };

  const isCloudProvider = ['claude', 'openai', 'gemini'].includes(settings.llm.provider);
  const isLocalProvider = ['ollama', 'localai'].includes(settings.llm.provider);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <h3 className="text-lg font-medium text-gray-800">{t('settings.llm.title')}</h3>
        <span className="text-xs text-gray-500">
          {isExpanded ? t('settings.llm.collapse') : t('settings.llm.expand')}
        </span>
      </button>

      {isExpanded && (
        <>
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.llm.provider')}
            </label>
            <select
              value={settings.llm.provider}
              onChange={(e) => {
                const provider = e.target.value as LLMProvider;
                const models = getModelsForProvider(provider);
                const endpoint = getDefaultEndpoint(provider);
                setLLMSettings({
                  provider,
                  model: models[0] || '',
                  endpoint,
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ollama">{t('settings.llm.providers.ollama')}</option>
              <option value="localai">{t('settings.llm.providers.localai')}</option>
              <option value="claude">{t('settings.llm.providers.claude')}</option>
              <option value="openai">{t('settings.llm.providers.openai')}</option>
              <option value="gemini">{t('settings.llm.providers.gemini')}</option>
            </select>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.llm.model')}
              {isLoadingModels && <span className="ml-2 text-xs text-gray-400">Loading...</span>}
            </label>
            {getModelsForProvider(settings.llm.provider).length > 0 ? (
              <select
                value={settings.llm.model}
                onChange={(e) => setLLMSettings({ model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {getModelsForProvider(settings.llm.provider).map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 border border-orange-300 rounded-lg bg-orange-50 text-sm text-orange-700">
                {isLocalProvider
                  ? 'No models found. Run: ollama pull <model-name>'
                  : 'No models available'}
              </div>
            )}
          </div>

          {/* API Key (for cloud providers) */}
          {isCloudProvider && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {t('settings.llm.apiKey')}
              </label>
              <input
                type="password"
                value={settings.llm.apiKey || ''}
                onChange={(e) => setLLMSettings({ apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500">
                {settings.llm.provider === 'claude' && 'Get your API key from console.anthropic.com'}
                {settings.llm.provider === 'openai' && 'Get your API key from platform.openai.com'}
                {settings.llm.provider === 'gemini' && 'Get your API key from aistudio.google.com'}
              </p>
            </div>
          )}

          {/* Endpoint (for local providers) */}
          {isLocalProvider && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {t('settings.llm.endpoint')}
              </label>
              <input
                type="text"
                value={settings.llm.endpoint || ''}
                onChange={(e) => setLLMSettings({ endpoint: e.target.value })}
                placeholder={settings.llm.provider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:8080'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Local provider info */}
          {isLocalProvider && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                {settings.llm.provider === 'ollama' && (
                  <>Make sure Ollama is running: <code className="bg-blue-100 px-1 rounded">ollama serve</code></>
                )}
                {settings.llm.provider === 'localai' && (
                  <>Make sure LocalAI is running with OpenAI-compatible API</>
                )}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
