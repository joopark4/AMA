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

/**
 * `model` 필드가 사용자 선택 의미를 가지는 provider 집합.
 *
 * `claude_code`는 외부 Claude Code 세션이, `codex`는 Codex CLI(app-server)가
 * 자체적으로 모델을 결정하므로 `settings.llm.model`이 비어 있어도 이슈가 아니다.
 * 이 두 provider는 모델 미설정 가이드 흐름에서 제외한다.
 */
export type ModelSelectableProvider = Exclude<LLMProvider, 'claude_code' | 'codex'>;

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

/**
 * provider가 모델 선택이 필요한 종류인지 (claude_code/codex 제외).
 * 호출 지점에서 좁히기 가드로 사용 — 좁힌 결과를 buildModelUnsetIssue 등에 전달.
 */
export function isModelSelectableProvider(
  provider: LLMProvider
): provider is ModelSelectableProvider {
  return provider !== 'claude_code' && provider !== 'codex';
}

/** i18n returnObjects helper (string[] 안전 캐스트) */
export function readSteps(
  t: TFunction,
  key: string,
  params?: Record<string, unknown>
): string[] {
  const v = t(key, { returnObjects: true, ...(params ?? {}) }) as unknown;
  return Array.isArray(v) ? (v as string[]) : [];
}

/**
 * 모델 미설정 이슈 빌더.
 *
 * provider 타입을 ModelSelectableProvider로 좁혀 받아
 * claude_code/codex가 도달해 CLOUD_DEFAULT_MODELS lookup이 undefined가 되는
 * 케이스를 컴파일 단계에서 차단한다 (이전 `as` 단언 제거).
 *
 * 호출 지점은 `isModelSelectableProvider` 가드로 먼저 좁혀 호출할 것.
 */
export function buildModelUnsetIssue(
  t: TFunction,
  provider: ModelSelectableProvider
): DependencyIssue {
  if (provider === 'ollama' || provider === 'localai') {
    return {
      id: 'llm-model-unset',
      title: t(`dependency.issue.modelUnset.${provider}.title`),
      summary: t(`dependency.issue.modelUnset.${provider}.summary`),
      steps: readSteps(t, `dependency.issue.modelUnset.${provider}.steps`),
    };
  }
  // 여기서 provider는 'claude' | 'openai' | 'gemini'로 좁혀짐 — as 단언 불필요.
  const providerLabel = PROVIDER_LABELS[provider];
  const defaultModel = CLOUD_DEFAULT_MODELS[provider];
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
