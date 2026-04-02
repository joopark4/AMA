import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { useSettingsStore, LLMProvider } from '../../stores/settingsStore';
import { ollamaClient } from '../../services/ai/ollamaClient';
import { localAiClient } from '../../services/ai/localAiClient';
import { CLAUDE_CODE_PROVIDER, BRIDGE_DEFAULT_ENDPOINT, BRIDGE_DEFAULT_MODEL } from '../../features/channels';
import { CODEX_PROVIDER, CODEX_DEFAULT_MODEL, CodexSettings } from '../../features/codex';

const CLOUD_MODELS: Record<'claude' | 'openai' | 'gemini', string[]> = {
  claude: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-6'],
  openai: ['gpt-5.1', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o-mini'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
};

type CloudProvider = 'claude' | 'openai' | 'gemini';
type ModelStatus = 'available' | 'unavailable' | 'unknown';

interface CloudModelCheckResult {
  statuses: Record<string, ModelStatus>;
  note?: string;
}

interface CloudModelListResult {
  models: string[];
  note?: string;
}

const MODEL_CHECK_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Model check timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isRateLimitErrorMessage(message: string): boolean {
  return /\b429\b|rate.?limit|quota|resource_exhausted|too many requests/i.test(message);
}

function isCloudProviderValue(provider: LLMProvider): provider is CloudProvider {
  return provider === 'claude' || provider === 'openai' || provider === 'gemini';
}

function normalizeModelId(provider: CloudProvider, rawId: string): string {
  const trimmed = (rawId || '').trim();
  if (!trimmed) return '';
  if (provider === 'gemini' && trimmed.startsWith('models/')) {
    return trimmed.slice('models/'.length);
  }
  return trimmed;
}

function isUsefulCloudModelId(provider: CloudProvider, modelId: string): boolean {
  const id = modelId.toLowerCase();

  if (provider === 'openai') {
    if (/^chatgpt-/.test(id)) return true;
    if (/^o[1-9]/.test(id)) return !/(audio|transcribe|tts|embedding|moderation|realtime|search|image)/.test(id);
    if (/^gpt-/.test(id)) return !/(audio|transcribe|tts|embedding|moderation|realtime|search|image|instruct)/.test(id);
    return false;
  }

  if (provider === 'claude') {
    return id.startsWith('claude-');
  }

  return id.startsWith('gemini-');
}

function rankSortModels(models: string[], preferred: string[]): string[] {
  const preferredIndex = new Map(preferred.map((model, idx) => [model, idx]));
  return [...models].sort((a, b) => {
    const aRank = preferredIndex.has(a) ? preferredIndex.get(a)! : Number.MAX_SAFE_INTEGER;
    const bRank = preferredIndex.has(b) ? preferredIndex.get(b)! : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.localeCompare(b);
  });
}

function buildCloudCandidateModels(
  provider: CloudProvider,
  currentModel?: string,
  discoveredModels?: string[]
): string[] {
  const merged = [
    ...(discoveredModels || []),
    ...(CLOUD_MODELS[provider] || []),
    (currentModel || '').trim(),
  ].filter(Boolean);

  const normalized = [...new Set(merged.map((m) => normalizeModelId(provider, m)))].filter(Boolean);
  const filtered = normalized.filter((model) => isUsefulCloudModelId(provider, model));
  return rankSortModels(filtered, CLOUD_MODELS[provider] || []);
}

async function listOpenAIModels(apiKey: string): Promise<CloudModelListResult> {
  const client = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 0,
  });
  const response = await withTimeout(client.models.list(), MODEL_CHECK_TIMEOUT_MS);
  const models = response.data
    .map((m) => m.id)
    .filter((id): id is string => typeof id === 'string')
    .map((id) => normalizeModelId('openai', id))
    .filter((id) => isUsefulCloudModelId('openai', id));

  return {
    models: rankSortModels([...new Set(models)], CLOUD_MODELS.openai),
    note: `OpenAI API 기준 사용 가능한 모델 ${new Set(models).size}개를 확인했습니다.`,
  };
}

async function listClaudeModels(apiKey: string): Promise<CloudModelListResult> {
  const response = await withTimeout(
    fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    }),
    MODEL_CHECK_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Claude models API failed (${response.status})`);
  }

  const payload = await withTimeout(response.json(), MODEL_CHECK_TIMEOUT_MS) as {
    data?: Array<{ id?: string }>;
  };

  const models = (payload.data || [])
    .map((m) => (typeof m?.id === 'string' ? m.id : ''))
    .map((id) => normalizeModelId('claude', id))
    .filter((id) => isUsefulCloudModelId('claude', id));

  return {
    models: rankSortModels([...new Set(models)], CLOUD_MODELS.claude),
    note: `Claude API 기준 사용 가능한 모델 ${new Set(models).size}개를 확인했습니다.`,
  };
}

async function listGeminiModels(apiKey: string): Promise<CloudModelListResult> {
  const response = await withTimeout(
    fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey,
      },
    }),
    MODEL_CHECK_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Gemini models API failed (${response.status})`);
  }

  const payload = await withTimeout(response.json(), MODEL_CHECK_TIMEOUT_MS) as {
    models?: Array<{
      name?: string;
      baseModelId?: string;
      supportedGenerationMethods?: string[];
    }>;
  };

  const models = (payload.models || [])
    .filter((m) => {
      const methods = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
      return methods.length === 0 || methods.includes('generateContent');
    })
    .map((m) => (typeof m?.name === 'string' ? m.name : (typeof m?.baseModelId === 'string' ? m.baseModelId : '')))
    .map((id) => normalizeModelId('gemini', id))
    .filter((id) => isUsefulCloudModelId('gemini', id));

  return {
    models: rankSortModels([...new Set(models)], CLOUD_MODELS.gemini),
    note: `Gemini API 기준 사용 가능한 모델 ${new Set(models).size}개를 확인했습니다.`,
  };
}

async function listCloudModels(provider: CloudProvider, apiKey: string): Promise<CloudModelListResult> {
  if (provider === 'openai') {
    return listOpenAIModels(apiKey);
  }
  if (provider === 'gemini') {
    return listGeminiModels(apiKey);
  }
  return listClaudeModels(apiKey);
}

async function checkOpenAIModels(apiKey: string, candidates: string[]): Promise<CloudModelCheckResult> {
  const statuses = Object.fromEntries(candidates.map((model) => [model, 'unknown'])) as Record<string, ModelStatus>;

  try {
    const client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
      maxRetries: 0,
    });

    const response = await withTimeout(client.models.list(), MODEL_CHECK_TIMEOUT_MS);
    const available = new Set(response.data.map((model) => model.id));

    for (const model of candidates) {
      statuses[model] = available.has(model) ? 'available' : 'unavailable';
    }

    return { statuses };
  } catch (error) {
    const message = normalizeError(error);
    const fallbackStatus: ModelStatus = isRateLimitErrorMessage(message) ? 'unknown' : 'unavailable';
    for (const model of candidates) {
      statuses[model] = fallbackStatus;
    }

    return {
      statuses,
      note: fallbackStatus === 'unknown'
        ? 'OpenAI 모델 확인이 일시적으로 제한되었습니다(429/쿼터). 잠시 후 다시 시도해 주세요.'
        : `OpenAI 모델 확인 실패: ${message}`,
    };
  }
}

async function checkGeminiModels(apiKey: string, candidates: string[]): Promise<CloudModelCheckResult> {
  const statuses = Object.fromEntries(candidates.map((model) => [model, 'unknown'])) as Record<string, ModelStatus>;
  let hasRateLimitFailure = false;
  const failedDetails: string[] = [];

  try {
    const client = new GoogleGenAI({ apiKey });
    for (const model of candidates) {
      try {
        await withTimeout(
          client.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
            config: {
              temperature: 0,
              maxOutputTokens: 1,
            },
          }),
          MODEL_CHECK_TIMEOUT_MS
        );
        statuses[model] = 'available';
      } catch (error) {
        const message = normalizeError(error);
        statuses[model] = 'unavailable';
        if (isRateLimitErrorMessage(message)) {
          hasRateLimitFailure = true;
        }
        failedDetails.push(`${model}: ${message}`);
      }
    }

    if (!failedDetails.length) {
      return { statuses };
    }

    return {
      statuses,
      note: hasRateLimitFailure
        ? 'Gemini 모델 확인 중 429/쿼터 제한이 감지되었습니다. 현재 키에서 사용 가능한 모델만 선택해 주세요.'
        : `Gemini 모델 확인 실패: ${failedDetails.join(' | ')}`,
    };
  } catch (error) {
    const message = normalizeError(error);
    const fallbackStatus: ModelStatus = isRateLimitErrorMessage(message) ? 'unknown' : 'unavailable';
    for (const model of candidates) {
      statuses[model] = fallbackStatus;
    }

    return {
      statuses,
      note: fallbackStatus === 'unknown'
        ? 'Gemini 모델 확인이 일시적으로 제한되었습니다(429/쿼터). 잠시 후 다시 시도해 주세요.'
        : `Gemini 모델 확인 실패: ${message}`,
    };
  }
}

async function checkClaudeModels(apiKey: string, candidates: string[]): Promise<CloudModelCheckResult> {
  const statuses = Object.fromEntries(candidates.map((model) => [model, 'unknown'])) as Record<string, ModelStatus>;
  let hasRateLimitFailure = false;
  const failedDetails: string[] = [];

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 0,
  });

  for (const model of candidates) {
    try {
      await withTimeout(
        client.messages.create({
          model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        MODEL_CHECK_TIMEOUT_MS
      );
      statuses[model] = 'available';
    } catch (error) {
      const message = normalizeError(error);
      if (isRateLimitErrorMessage(message)) {
        statuses[model] = 'unknown';
        hasRateLimitFailure = true;
      } else {
        statuses[model] = 'unavailable';
      }
      failedDetails.push(`${model}: ${message}`);
    }
  }

  if (!failedDetails.length) {
    return { statuses };
  }

  return {
    statuses,
    note: hasRateLimitFailure
      ? 'Claude 모델 확인 중 429/쿼터 제한이 감지되었습니다. 잠시 후 다시 시도해 주세요.'
      : `Claude 모델 확인 실패: ${failedDetails.join(' | ')}`,
  };
}

async function checkCloudModels(
  provider: CloudProvider,
  apiKey: string,
  candidates: string[]
): Promise<CloudModelCheckResult> {
  if (provider === 'openai') {
    return checkOpenAIModels(apiKey, candidates);
  }
  if (provider === 'gemini') {
    return checkGeminiModels(apiKey, candidates);
  }
  return checkClaudeModels(apiKey, candidates);
}

function createModelStatusMap(models: string[], status: ModelStatus): Record<string, ModelStatus> {
  return Object.fromEntries(models.map((model) => [model, status])) as Record<string, ModelStatus>;
}

function pickFirstAvailableModel(
  candidates: string[],
  statuses: Record<string, ModelStatus>,
  currentModel: string
): string | undefined {
  if (statuses[currentModel] === 'available') {
    return undefined;
  }
  return candidates.find((model) => statuses[model] === 'available');
}

interface CloudModelEvaluation {
  modelListForProvider: string[];
  statuses: Record<string, ModelStatus>;
  note: string | null;
  recommendedModel?: string;
}

async function evaluateCloudProviderModels(
  provider: CloudProvider,
  apiKey: string,
  currentModel: string
): Promise<CloudModelEvaluation> {
  const trimmedApiKey = (apiKey || '').trim();

  if (!trimmedApiKey) {
    const defaultCandidates = buildCloudCandidateModels(provider, currentModel);
    return {
      modelListForProvider: defaultCandidates,
      statuses: createModelStatusMap(defaultCandidates, 'unknown'),
      note: 'API Key를 입력하면 사용 가능한 모델을 자동 확인합니다.',
    };
  }

  try {
    const listResult = await listCloudModels(provider, trimmedApiKey);
    if (listResult.models.length > 0) {
      const candidateModels = buildCloudCandidateModels(provider, currentModel, listResult.models);
      const availableSet = new Set(listResult.models);
      const statuses = Object.fromEntries(
        candidateModels.map((model) => [model, availableSet.has(model) ? 'available' : 'unknown'])
      ) as Record<string, ModelStatus>;

      return {
        modelListForProvider: listResult.models,
        statuses,
        note: listResult.note || null,
        recommendedModel: availableSet.has(currentModel)
          ? undefined
          : candidateModels.find((model) => availableSet.has(model)),
      };
    }
  } catch {
    // Fallback: static candidate probes (works even when list endpoints are blocked)
  }

  const fallbackCandidates = buildCloudCandidateModels(provider, currentModel);
  const checkResult = await checkCloudModels(provider, trimmedApiKey, fallbackCandidates);
  const fallbackNote =
    checkResult.note || '모델 목록 API 조회에 실패하여 기본 후보 모델로 사용 가능 여부를 점검했습니다.';

  return {
    modelListForProvider: fallbackCandidates,
    statuses: checkResult.statuses,
    note: fallbackNote,
    recommendedModel: pickFirstAvailableModel(fallbackCandidates, checkResult.statuses, currentModel),
  };
}

function getModelStatusLabel(status: ModelStatus): string {
  if (status === 'available') return '사용 가능';
  if (status === 'unavailable') return '사용 불가';
  return '확인 필요';
}

export default function LLMSettings() {
  const { t } = useTranslation();
  const { settings, setLLMSettings } = useSettingsStore();
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [cloudModels, setCloudModels] = useState<Partial<Record<CloudProvider, string[]>>>({});
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});
  const [modelCheckNote, setModelCheckNote] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  // isExpanded state removed — collapse is now handled by SettingsSection wrapper

  const currentProvider = settings.llm.provider;
  const isCloudProvider = isCloudProviderValue(currentProvider);
  const isLocalProvider = currentProvider === 'ollama' || currentProvider === 'localai';
  const isClaudeCode = currentProvider === CLAUDE_CODE_PROVIDER;
  const isCodex = currentProvider === CODEX_PROVIDER;

  // Load local provider models (Ollama / LocalAI)
  useEffect(() => {
    if (!isLocalProvider) {
      return;
    }

    let isCancelled = false;

    const loadModels = async () => {
      setIsLoadingModels(true);
      setModelCheckNote(null);

      const models =
        currentProvider === 'localai'
          ? await localAiClient.getAvailableModels()
          : await ollamaClient.getAvailableModels();

      if (isCancelled) return;

      setLocalModels(models);
      setModelStatuses(
        Object.fromEntries(models.map((model) => [model, 'available'])) as Record<string, ModelStatus>
      );

      if (models.length > 0 && !models.includes(settings.llm.model)) {
        setLLMSettings({ model: models[0] });
      }

      setIsLoadingModels(false);
    };

    loadModels().catch((error) => {
      if (isCancelled) return;
      setLocalModels([]);
      setModelStatuses({});
      setModelCheckNote(`로컬 모델 확인 실패: ${normalizeError(error)}`);
      setIsLoadingModels(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [isLocalProvider, currentProvider, settings.llm.endpoint, settings.llm.model, setLLMSettings]);

  // Check cloud provider model availability
  useEffect(() => {
    if (!isCloudProvider) {
      return;
    }

    let isCancelled = false;
    const runCloudModelCheck = async () => {
      setIsLoadingModels(true);
      try {
        const evaluation = await evaluateCloudProviderModels(
          currentProvider,
          settings.llm.apiKey || '',
          settings.llm.model
        );
        if (isCancelled) return;

        setCloudModels((prev) => ({ ...prev, [currentProvider]: evaluation.modelListForProvider }));
        setModelStatuses(evaluation.statuses);
        setModelCheckNote(evaluation.note);
        if (evaluation.recommendedModel) {
          setLLMSettings({ model: evaluation.recommendedModel });
        }
      } catch (error) {
        if (isCancelled) return;
        const fallbackCandidates = buildCloudCandidateModels(currentProvider, settings.llm.model);
        setCloudModels((prev) => ({ ...prev, [currentProvider]: fallbackCandidates }));
        setModelStatuses(createModelStatusMap(fallbackCandidates, 'unknown'));
        setModelCheckNote(`모델 확인 중 오류가 발생했습니다: ${normalizeError(error)}`);
      } finally {
        if (!isCancelled) {
          setIsLoadingModels(false);
        }
      }
    };

    const timer = window.setTimeout(() => {
      runCloudModelCheck().catch((error) => {
        if (isCancelled) return;
        setModelCheckNote(`모델 확인 중 오류가 발생했습니다: ${normalizeError(error)}`);
        setIsLoadingModels(false);
      });
    }, 450);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [isCloudProvider, currentProvider, settings.llm.apiKey, settings.llm.model, setLLMSettings]);

  const getModelsForProvider = (provider: LLMProvider): string[] => {
    if (provider === CLAUDE_CODE_PROVIDER) return [BRIDGE_DEFAULT_MODEL];
    if (provider === CODEX_PROVIDER) return [CODEX_DEFAULT_MODEL];
    if (provider === 'ollama' || provider === 'localai') {
      return localModels;
    }

    return buildCloudCandidateModels(
      provider,
      settings.llm.model,
      cloudModels[provider]
    );
  };

  const getDefaultEndpoint = (provider: LLMProvider): string | undefined => {
    if (provider === 'ollama') return 'http://localhost:11434';
    if (provider === 'localai') return 'http://localhost:8080';
    if (provider === CLAUDE_CODE_PROVIDER) return BRIDGE_DEFAULT_ENDPOINT;
    return undefined;
  };

  const visibleModels = getModelsForProvider(currentProvider);

  const mcpLocked = settings.mcpEnabled;

  return (
    <div className="space-y-4">
          {/* Channels 활성 시 잠금 안내 */}
          {mcpLocked && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                {t('settings.mcp.llmLocked')}
              </p>
            </div>
          )}

          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.llm.provider')}
            </label>
            <select
              value={currentProvider}
              disabled={mcpLocked}
              onChange={(e) => {
                const provider = e.target.value as LLMProvider;
                const models = provider === CLAUDE_CODE_PROVIDER
                  ? [BRIDGE_DEFAULT_MODEL]
                  : provider === CODEX_PROVIDER
                    ? [CODEX_DEFAULT_MODEL]
                    : provider === 'ollama' || provider === 'localai'
                      ? localModels
                      : buildCloudCandidateModels(provider, '', cloudModels[provider]);
                const endpoint = getDefaultEndpoint(provider);
                setLLMSettings({
                  provider,
                  model: models[0] || '',
                  endpoint,
                });
              }}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${mcpLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
            >
              <option value="ollama">{t('settings.llm.providers.ollama')}</option>
              <option value="localai">{t('settings.llm.providers.localai')}</option>
              <option value="claude">{t('settings.llm.providers.claude')}</option>
              <option value="openai">{t('settings.llm.providers.openai')}</option>
              <option value="gemini">{t('settings.llm.providers.gemini')}</option>
              <option value={CLAUDE_CODE_PROVIDER}>{t('settings.llm.providers.claude_code')}</option>
              <option value={CODEX_PROVIDER}>{t('settings.llm.providers.codex')}</option>
            </select>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.llm.model')}
              {isLoadingModels && <span className="ml-2 text-xs text-gray-400">Loading...</span>}
            </label>

            {visibleModels.length > 0 ? (
              <select
                value={settings.llm.model}
                disabled={mcpLocked}
                onChange={(e) => setLLMSettings({ model: e.target.value })}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${mcpLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
              >
                {visibleModels.map((model) => {
                  const status = modelStatuses[model] || 'unknown';
                  const shouldAnnotate = isCloudProvider;
                  return (
                    <option
                      key={model}
                      value={model}
                      disabled={isCloudProvider && status === 'unavailable'}
                    >
                      {shouldAnnotate ? `${model} (${getModelStatusLabel(status)})` : model}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="px-3 py-2 border border-orange-300 rounded-lg bg-orange-50 text-sm text-orange-700">
                {isLocalProvider
                  ? 'No models found. Run: ollama pull <model-name>'
                  : 'No models available'}
              </div>
            )}
          </div>

          {isCloudProvider && (
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 space-y-1">
              <p>선택한 Provider에서 모델 사용 가능 여부를 자동 점검합니다.</p>
              {modelCheckNote && (
                <p className="text-amber-700">{modelCheckNote}</p>
              )}
            </div>
          )}

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
                {currentProvider === 'claude' && 'Get your API key from console.anthropic.com'}
                {currentProvider === 'openai' && 'Get your API key from platform.openai.com'}
                {currentProvider === 'gemini' && 'Get your API key from aistudio.google.com'}
              </p>
            </div>
          )}

          {/* Endpoint (for local providers + Claude Code) */}
          {(isLocalProvider || isClaudeCode) && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {t('settings.llm.endpoint')}
              </label>
              <input
                type="text"
                value={settings.llm.endpoint || ''}
                disabled={mcpLocked}
                onChange={(e) => setLLMSettings({ endpoint: e.target.value })}
                placeholder={
                  currentProvider === 'ollama' ? 'http://localhost:11434'
                    : currentProvider === CLAUDE_CODE_PROVIDER ? BRIDGE_DEFAULT_ENDPOINT
                      : 'http://localhost:8080'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Claude Code info */}
          {isClaudeCode && (
            <div className="p-3 bg-purple-50 rounded-lg">
              <p className="text-xs text-purple-700">
                {t('settings.llm.providers.claudeCodeInfo')}
              </p>
            </div>
          )}

          {/* Codex settings */}
          {isCodex && <CodexSettings />}

          {/* Local provider info */}
          {isLocalProvider && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                {currentProvider === 'ollama' && (
                  <>Make sure Ollama is running: <code className="bg-blue-100 px-1 rounded">ollama serve</code></>
                )}
                {currentProvider === 'localai' && (
                  <>Make sure LocalAI is running with OpenAI-compatible API</>
                )}
              </p>
            </div>
          )}
    </div>
  );
}
