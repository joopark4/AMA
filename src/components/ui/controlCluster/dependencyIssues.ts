/**
 * ControlCluster 의존성 이슈 빌더 — LLM provider/key/endpoint/model 상태별 DependencyIssue 생성.
 *
 * ControlCluster.tsx에서 분리. UI와 무관하게 t() + 설정값을 받아 이슈 객체를 반환하는 순수 함수들.
 */
import type { TFunction } from 'i18next';
import type { LLMProvider } from '../../../stores/settingsStore';

export interface DependencyIssue {
  id: string;
  title: string;
  summary: string;
  steps: string[];
}

export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  ollama: 'Ollama',
  localai: 'LocalAI',
  claude: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
  claude_code: 'Claude Code',
  codex: 'Codex',
};

export const CLOUD_DEFAULT_MODELS: Record<'claude' | 'openai' | 'gemini', string> = {
  claude: 'claude-sonnet-4-5',
  openai: 'gpt-5.1',
  gemini: 'gemini-2.5-flash',
};

/** i18n returnObjects helper (string[] 안전 캐스트) */
export function readSteps(
  t: TFunction,
  key: string,
  params?: Record<string, unknown>
): string[] {
  const v = t(key, { returnObjects: true, ...(params ?? {}) }) as unknown;
  return Array.isArray(v) ? (v as string[]) : [];
}

export function buildModelUnsetIssue(t: TFunction, provider: LLMProvider): DependencyIssue {
  if (provider === 'ollama' || provider === 'localai') {
    return {
      id: 'llm-model-unset',
      title: t(`dependency.issue.modelUnset.${provider}.title`),
      summary: t(`dependency.issue.modelUnset.${provider}.summary`),
      steps: readSteps(t, `dependency.issue.modelUnset.${provider}.steps`),
    };
  }
  const providerLabel = PROVIDER_LABELS[provider];
  const defaultModel = CLOUD_DEFAULT_MODELS[provider as 'claude' | 'openai' | 'gemini'];
  return {
    id: 'llm-model-unset',
    title: t('dependency.issue.modelUnset.cloud.title', { provider: providerLabel }),
    summary: t('dependency.issue.modelUnset.cloud.summary', { provider: providerLabel }),
    steps: readSteps(t, 'dependency.issue.modelUnset.cloud.steps', {
      provider: providerLabel,
      defaultModel,
    }),
  };
}

export function buildEndpointUnsetIssue(
  t: TFunction,
  provider: 'ollama' | 'localai'
): DependencyIssue {
  return {
    id: 'llm-endpoint-unset',
    title: t(`dependency.issue.endpointUnset.${provider}.title`),
    summary: t(`dependency.issue.endpointUnset.${provider}.summary`),
    steps: readSteps(t, `dependency.issue.endpointUnset.${provider}.steps`),
  };
}

export function buildCloudApiKeyIssue(
  t: TFunction,
  provider: 'claude' | 'openai' | 'gemini'
): DependencyIssue {
  const apiKeyGuide =
    provider === 'claude'
      ? 'console.anthropic.com'
      : provider === 'openai'
        ? 'platform.openai.com'
        : 'aistudio.google.com';
  const keyPrefix =
    provider === 'openai'
      ? '`sk-...`'
      : provider === 'claude'
        ? '`sk-ant-...`'
        : t('dependency.issue.apiKey.fallbackKeyPrefix', 'API key');
  const providerLabel = PROVIDER_LABELS[provider];
  return {
    id: 'llm-api-key',
    title: t('dependency.issue.apiKey.title', { provider: providerLabel }),
    summary: t('dependency.issue.apiKey.summary', { provider: providerLabel }),
    steps: readSteps(t, 'dependency.issue.apiKey.steps', {
      provider: providerLabel,
      apiKeyGuide,
      keyPrefix,
    }),
  };
}

export function buildLocalServerIssue(
  t: TFunction,
  provider: 'ollama' | 'localai',
  endpoint: string,
  model: string
): DependencyIssue {
  const fallbackEndpoint =
    provider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:8080';
  const fallbackModel = 'deepseek-v3';
  return {
    id: provider === 'ollama' ? 'llm-ollama-server' : 'llm-localai-server',
    title: t(`dependency.issue.localServer.${provider}.title`),
    summary: t(`dependency.issue.localServer.${provider}.summary`),
    steps: readSteps(t, `dependency.issue.localServer.${provider}.steps`, {
      model: model || fallbackModel,
      endpoint: endpoint || fallbackEndpoint,
    }),
  };
}

export function buildLocalModelIssue(
  t: TFunction,
  provider: 'ollama' | 'localai',
  model: string
): DependencyIssue {
  const displayModel =
    model || (t('dependency.issue.localModel.unsetLabel', '(unset)') as string);
  return {
    id: provider === 'ollama' ? 'llm-ollama-model' : 'llm-localai-model',
    title: t(`dependency.issue.localModel.${provider}.title`),
    summary: t(`dependency.issue.localModel.${provider}.summary`, { model: displayModel }),
    steps: readSteps(t, `dependency.issue.localModel.${provider}.steps`, {
      model: model || 'deepseek-v3',
    }),
  };
}
