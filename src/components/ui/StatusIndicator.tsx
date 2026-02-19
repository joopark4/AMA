import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore, type LLMProvider } from '../../stores/settingsStore';
import { useConversation } from '../../hooks/useConversation';
import { llmRouter } from '../../services/ai/llmRouter';
import { ollamaClient } from '../../services/ai/ollamaClient';
import { localAiClient } from '../../services/ai/localAiClient';

interface StatusIndicatorProps {
  isProcessing: boolean;
}

interface DependencyIssue {
  id: string;
  title: string;
  summary: string;
  steps: string[];
}

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  ollama: 'Ollama',
  localai: 'LocalAI',
  claude: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
};

const CLOUD_DEFAULT_MODELS: Record<'claude' | 'openai' | 'gemini', string> = {
  claude: 'claude-sonnet-4-5',
  openai: 'gpt-5.1',
  gemini: 'gemini-2.5-flash',
};

function buildModelUnsetIssue(provider: LLMProvider): DependencyIssue {
  if (provider === 'ollama') {
    return {
      id: 'llm-model-unset',
      title: 'LLM 모델 설정 (Ollama)',
      summary: 'Ollama 모델이 선택되지 않았습니다.',
      steps: [
        '옵션(설정)에서 LLM Provider를 Ollama로 선택합니다.',
        '터미널에서 `ollama list`를 실행해 설치된 모델을 확인합니다.',
        '모델이 없으면 `ollama pull deepseek-v3` 후 Model 항목에서 해당 모델을 선택합니다.',
      ],
    };
  }

  if (provider === 'localai') {
    return {
      id: 'llm-model-unset',
      title: 'LLM 모델 설정 (LocalAI)',
      summary: 'LocalAI 모델이 선택되지 않았습니다.',
      steps: [
        '옵션(설정)에서 LLM Provider를 LocalAI로 선택합니다.',
        'LocalAI `/v1/models` 응답에 노출된 모델 id를 확인합니다.',
        'Model 항목에 해당 id와 동일한 모델명을 선택/입력합니다.',
      ],
    };
  }

  const defaultModel = CLOUD_DEFAULT_MODELS[provider as 'claude' | 'openai' | 'gemini'];
  return {
    id: 'llm-model-unset',
    title: `LLM 모델 설정 (${PROVIDER_LABELS[provider]})`,
    summary: `${PROVIDER_LABELS[provider]} 모델이 선택되지 않았습니다.`,
    steps: [
      `옵션(설정)에서 LLM Provider를 ${PROVIDER_LABELS[provider]}로 선택합니다.`,
      `Model 항목에서 사용 모델을 선택합니다. 예: \`${defaultModel}\``,
      '설정 저장 후 다시 질문을 입력해 응답을 확인합니다.',
    ],
  };
}

function buildEndpointUnsetIssue(provider: 'ollama' | 'localai'): DependencyIssue {
  if (provider === 'ollama') {
    return {
      id: 'llm-endpoint-unset',
      title: 'LLM 엔드포인트 설정 (Ollama)',
      summary: 'Ollama 서버 주소가 비어 있습니다.',
      steps: [
        '옵션(설정)에서 LLM Provider를 Ollama로 유지합니다.',
        'Endpoint에 `http://localhost:11434`를 입력합니다.',
        '`ollama serve` 실행 후 다시 질문을 입력합니다.',
      ],
    };
  }

  return {
    id: 'llm-endpoint-unset',
    title: 'LLM 엔드포인트 설정 (LocalAI)',
    summary: 'LocalAI 서버 주소가 비어 있습니다.',
    steps: [
      '옵션(설정)에서 LLM Provider를 LocalAI로 유지합니다.',
      'Endpoint에 LocalAI OpenAI 호환 주소를 입력합니다. 예: `http://localhost:8080`',
      'LocalAI 서버 실행 후 다시 질문을 입력합니다.',
    ],
  };
}

function buildCloudApiKeyIssue(provider: 'claude' | 'openai' | 'gemini'): DependencyIssue {
  const apiKeyGuide =
    provider === 'claude'
      ? 'console.anthropic.com'
      : provider === 'openai'
        ? 'platform.openai.com'
        : 'aistudio.google.com';

  const keyPrefix = provider === 'openai' ? '`sk-...`' : provider === 'claude' ? '`sk-ant-...`' : '발급된 API 키';

  return {
    id: 'llm-api-key',
    title: `LLM API 키 설정 (${PROVIDER_LABELS[provider]})`,
    summary: `${PROVIDER_LABELS[provider]} API 키가 설정되지 않아 답변을 생성할 수 없습니다.`,
    steps: [
      `옵션(설정)에서 LLM Provider를 ${PROVIDER_LABELS[provider]}로 선택합니다.`,
      `${apiKeyGuide}에서 API 키를 발급받습니다.`,
      `API Key 입력란에 ${keyPrefix} 형식의 키를 입력하고 저장합니다.`,
    ],
  };
}

function buildLocalServerIssue(
  provider: 'ollama' | 'localai',
  endpoint: string,
  model: string
): DependencyIssue {
  if (provider === 'ollama') {
    return {
      id: 'llm-ollama-server',
      title: 'LLM 서버 연결 실패 (Ollama)',
      summary: 'Ollama 서버에 연결할 수 없습니다.',
      steps: [
        'macOS에서 `brew install ollama`로 설치합니다.',
        '터미널에서 `ollama serve`를 실행합니다.',
        `필요 모델을 \`ollama pull ${model || 'deepseek-v3'}\`로 내려받습니다.`,
        `Endpoint가 올바른지 확인합니다. 현재 값: ${endpoint || 'http://localhost:11434'}`,
      ],
    };
  }

  return {
    id: 'llm-localai-server',
    title: 'LLM 서버 연결 실패 (LocalAI)',
    summary: 'LocalAI 서버에 연결할 수 없습니다.',
    steps: [
      'LocalAI 서버를 실행하고 OpenAI 호환 API가 활성화되어 있는지 확인합니다.',
      '헬스체크로 `GET /v1/models` 응답이 오는지 확인합니다.',
      `Endpoint를 LocalAI 주소로 맞춥니다. 현재 값: ${endpoint || 'http://localhost:8080'}`,
      '모델 로드 로그를 확인한 뒤 다시 질문을 입력합니다.',
    ],
  };
}

function buildLocalModelIssue(provider: 'ollama' | 'localai', model: string): DependencyIssue {
  if (provider === 'ollama') {
    return {
      id: 'llm-ollama-model',
      title: 'LLM 모델 누락 (Ollama)',
      summary: `선택된 모델(${model || '미설정'})이 Ollama에 준비되어 있지 않습니다.`,
      steps: [
        `터미널에서 \`ollama pull ${model || 'deepseek-v3'}\`를 실행합니다.`,
        '`ollama list`로 모델이 내려받아졌는지 확인합니다.',
        '앱 설정에서 동일한 모델명을 선택한 뒤 다시 질문합니다.',
      ],
    };
  }

  return {
    id: 'llm-localai-model',
    title: 'LLM 모델 누락 (LocalAI)',
    summary: `선택된 모델(${model || '미설정'})이 LocalAI에 준비되어 있지 않습니다.`,
    steps: [
      'LocalAI 모델 디렉터리에 원하는 모델 파일을 배치합니다.',
      'LocalAI 설정 파일/실행 옵션에서 모델을 로드합니다.',
      '앱 설정의 Model 값을 LocalAI의 모델 id와 동일하게 맞춥니다.',
    ],
  };
}

export default function StatusIndicator({ isProcessing }: StatusIndicatorProps) {
  const { t } = useTranslation();
  const { status, isListening, isSpeaking } = useConversationStore();
  const { openSettings, settings, isHistoryOpen, toggleHistory } = useSettingsStore();
  const {
    isListening: isVoiceListening,
    isVoiceInputRuntimeBlocked,
    transcript,
    error: voiceError,
    needsMicrophonePermission,
    voiceInputUnavailableReason,
    ttsUnavailableReason,
    startListening,
    stopListening,
    sendMessage,
    openMicrophoneSettings,
  } = useConversation();

  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [showDependencyGuide, setShowDependencyGuide] = useState(false);
  const [hasTriedChat, setHasTriedChat] = useState(false);
  const [hasTriedVoiceInput, setHasTriedVoiceInput] = useState(false);
  const [hasAutoShownConfigGuide, setHasAutoShownConfigGuide] = useState(false);
  const [llmDependencyIssue, setLlmDependencyIssue] = useState<DependencyIssue | null>(null);
  const isVoiceButtonDisabled = false;

  useEffect(() => {
    let cancelled = false;

    const updateLlmDependencyIssue = async () => {
      const provider = settings.llm.provider;
      const model = settings.llm.model || '';
      const endpoint = settings.llm.endpoint || '';
      const apiKey = settings.llm.apiKey || '';

      if (!model.trim()) {
        if (!cancelled) {
          setLlmDependencyIssue(buildModelUnsetIssue(provider));
        }
        return;
      }

      if ((provider === 'ollama' || provider === 'localai') && !endpoint.trim()) {
        if (!cancelled) {
          setLlmDependencyIssue(buildEndpointUnsetIssue(provider));
        }
        return;
      }

      if (provider === 'openai' || provider === 'claude' || provider === 'gemini') {
        if (!apiKey.trim()) {
          if (!cancelled) {
            setLlmDependencyIssue(buildCloudApiKeyIssue(provider));
          }
          return;
        }

        if (!cancelled) {
          setLlmDependencyIssue(null);
        }
        return;
      }

      if (!hasTriedChat) {
        if (!cancelled) {
          setLlmDependencyIssue(null);
        }
        return;
      }

      const isAvailable = await llmRouter.isAvailable();
      if (!isAvailable) {
        if (!cancelled) {
          if (provider === 'ollama' || provider === 'localai') {
            setLlmDependencyIssue(buildLocalServerIssue(provider, endpoint, model));
          }
        }
        return;
      }

      if (provider === 'ollama') {
        const models = await ollamaClient.getAvailableModels();
        if (!cancelled) {
          if (!model || !models.includes(model)) {
            setLlmDependencyIssue(buildLocalModelIssue(provider, model));
          } else {
            setLlmDependencyIssue(null);
          }
        }
        return;
      }

      if (provider === 'localai') {
        const models = await localAiClient.getAvailableModels();
        if (!cancelled) {
          if (!model || !models.includes(model)) {
            setLlmDependencyIssue(buildLocalModelIssue(provider, model));
          } else {
            setLlmDependencyIssue(null);
          }
        }
        return;
      }

      if (!cancelled) {
        setLlmDependencyIssue(null);
      }
    };

    void updateLlmDependencyIssue();

    return () => {
      cancelled = true;
    };
  }, [
    hasTriedChat,
    settings.llm.provider,
    settings.llm.model,
    settings.llm.endpoint,
    settings.llm.apiKey,
  ]);

  const isImmediateLlmConfigIssue =
    llmDependencyIssue?.id === 'llm-api-key' ||
    llmDependencyIssue?.id === 'llm-model-unset' ||
    llmDependencyIssue?.id === 'llm-endpoint-unset';

  useEffect(() => {
    if (isImmediateLlmConfigIssue && !hasAutoShownConfigGuide) {
      setShowDependencyGuide(true);
      setHasAutoShownConfigGuide(true);
      return;
    }

    if (!isImmediateLlmConfigIssue) {
      setHasAutoShownConfigGuide(false);
    }
  }, [isImmediateLlmConfigIssue, hasAutoShownConfigGuide]);

  const dependencyIssues = useMemo<DependencyIssue[]>(() => {
    const issues: DependencyIssue[] = [];

    if (hasTriedVoiceInput && voiceInputUnavailableReason) {
      issues.push({
        id: 'stt-whisper',
        title: '음성 인식 (Whisper)',
        summary: voiceInputUnavailableReason,
        steps: isVoiceInputRuntimeBlocked
          ? [
              '원격 연결 세션을 종료한 뒤 앱을 다시 실행합니다.',
              '로컬 환경에서 마이크 권한을 허용하고 다시 시도합니다.',
            ]
          : [
              'macOS에서 `brew install whisper-cpp`로 whisper-cli를 설치합니다.',
              '`ggml-base.bin` 파일을 `models/whisper/` 경로에 배치합니다.',
              '필요 시 `WHISPER_MODEL_PATH` 환경 변수로 모델 경로를 지정합니다.',
            ],
      });
    }

    if (hasTriedChat && ttsUnavailableReason) {
      issues.push({
        id: 'tts-supertonic',
        title: '음성 합성 (Supertonic)',
        summary: ttsUnavailableReason,
        steps: [
          '`models/supertonic/onnx` 폴더에 ONNX 모델 파일을 배치합니다.',
          '`models/supertonic/voice_styles` 폴더에 보이스 스타일 JSON 파일을 배치합니다.',
          '앱을 완전히 종료한 뒤 다시 실행합니다.',
        ],
      });
    }

    if ((hasTriedChat || isImmediateLlmConfigIssue) && llmDependencyIssue) {
      issues.push(llmDependencyIssue);
    }

    return issues;
  }, [
    voiceInputUnavailableReason,
    ttsUnavailableReason,
    llmDependencyIssue,
    isImmediateLlmConfigIssue,
    isVoiceInputRuntimeBlocked,
    hasTriedChat,
    hasTriedVoiceInput,
  ]);

  useEffect(() => {
    if (dependencyIssues.length === 0 && showDependencyGuide) {
      setShowDependencyGuide(false);
    }
  }, [dependencyIssues.length, showDependencyGuide]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      setHasTriedChat(true);
      sendMessage(textInput.trim());
      setTextInput('');
    }
  };

  const handleVoiceToggle = () => {
    if (isVoiceListening) {
      stopListening();
    } else {
      setHasTriedVoiceInput(true);
      void startListening();
    }
  };

  const getStatusText = () => {
    if (isVoiceListening && transcript) {
      return transcript.length > 30 ? transcript.slice(-30) + '...' : transcript;
    }
    switch (status) {
      case 'listening':
        return t('status.listening');
      case 'processing':
        return t('status.processing');
      case 'speaking':
        return t('status.speaking');
      case 'error':
        return t('status.error');
      default:
        return t('status.idle');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'listening':
        return 'bg-green-500';
      case 'processing':
        return 'bg-yellow-500';
      case 'speaking':
        return 'bg-blue-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div
      className="fixed flex flex-col items-end gap-2 z-50"
      style={{
        right: 'max(env(safe-area-inset-right), 1rem)',
        bottom: 'max(env(safe-area-inset-bottom), 1rem)',
      }}
      data-interactive="true"
    >
      {dependencyIssues.length > 0 && (
        <div className="bg-slate-900/85 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg text-xs max-w-xs" data-interactive="true">
          <div>필수 구성 요소 확인 필요 ({dependencyIssues.length})</div>
          <button
            type="button"
            onClick={() => setShowDependencyGuide(true)}
            className="mt-2 w-full px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs"
          >
            설치 안내 보기
          </button>
        </div>
      )}

      {/* Error display */}
      {voiceError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-lg text-xs max-w-xs" data-interactive="true">
          <div>{voiceError}</div>
          {needsMicrophonePermission && (
            <button
              onClick={openMicrophoneSettings}
              data-interactive="true"
              className="mt-2 w-full px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs font-medium cursor-pointer"
            >
              시스템 설정 열기
            </button>
          )}
        </div>
      )}

      {!voiceError && hasTriedVoiceInput && voiceInputUnavailableReason && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded-lg text-xs max-w-xs" data-interactive="true">
          <div>{voiceInputUnavailableReason}</div>
        </div>
      )}

      {!voiceError && hasTriedChat && ttsUnavailableReason && (
        <div className="bg-orange-100 border border-orange-400 text-orange-700 px-3 py-2 rounded-lg text-xs max-w-xs" data-interactive="true">
          <div>{ttsUnavailableReason}</div>
        </div>
      )}

      {/* Debug info - shows transcript when listening */}
      {isVoiceListening && transcript && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-3 py-1 rounded-lg text-xs max-w-xs">
          인식중: {transcript}
        </div>
      )}

      {/* Processing indicator */}
      {status === 'processing' && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-1 rounded-lg text-xs">
          LLM 처리중...
        </div>
      )}

      {/* Text input form */}
      {showTextInput && (
        <form onSubmit={handleTextSubmit} className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="메시지 입력..."
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
            autoFocus
          />
          <button
            type="submit"
            disabled={!textInput.trim() || status === 'processing'}
            className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
          >
            전송
          </button>
        </form>
      )}

      <div className="flex items-center gap-2">
      {/* Status badge */}
      <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-gray-200">
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${
          (isListening || isProcessing || isSpeaking) ? 'animate-pulse' : ''
        }`} />

        {/* Status text */}
        <span className="text-sm text-gray-700">
          {getStatusText()}
        </span>

        {/* Processing spinner */}
        {isProcessing && (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full loading-spinner" />
        )}
      </div>

      {/* Text input toggle button */}
      <button
        onClick={() => setShowTextInput(!showTextInput)}
        className={`p-2 backdrop-blur-sm rounded-full shadow-lg border transition-colors ${
          showTextInput
            ? 'bg-green-500 border-green-400 hover:bg-green-600'
            : 'bg-gray-500 border-gray-400 hover:bg-gray-600'
        }`}
        title="텍스트 입력"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

      {/* Voice input button */}
      <button
        onClick={handleVoiceToggle}
        disabled={isVoiceButtonDisabled}
        className={`p-2 backdrop-blur-sm rounded-full shadow-lg border transition-colors ${
          isVoiceButtonDisabled
            ? 'bg-gray-400 border-gray-300 cursor-not-allowed'
            : isVoiceListening
            ? 'bg-red-500 border-red-400 hover:bg-red-600 animate-pulse'
            : 'bg-blue-500 border-blue-400 hover:bg-blue-600'
        }`}
        title={
          isVoiceButtonDisabled
            ? voiceInputUnavailableReason || 'Voice input unavailable'
            : isVoiceListening
              ? 'Stop listening'
              : 'Start voice input'
        }
      >
        {isVoiceListening ? (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      {/* History button */}
      <button
        onClick={toggleHistory}
        className={`p-2 backdrop-blur-sm rounded-full shadow-lg border transition-colors ${
          isHistoryOpen
            ? 'bg-purple-500 border-purple-400 hover:bg-purple-600'
            : 'bg-white/90 border-gray-200 hover:bg-gray-100'
        }`}
        title={t('history.button')}
      >
        <svg
          className={`w-5 h-5 ${isHistoryOpen ? 'text-white' : 'text-gray-600'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </button>

      {/* Settings button */}
      <button
        onClick={openSettings}
        className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 hover:bg-gray-100 transition-colors"
        title={t('settings.title')}
      >
        <svg
          className="w-5 h-5 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
      </div>

      {showDependencyGuide && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" data-interactive="true">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">설치 안내</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openSettings}
                  className="px-3 py-1 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                >
                  설정 열기
                </button>
                <button
                  type="button"
                  onClick={() => setShowDependencyGuide(false)}
                  className="px-3 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  닫기
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-4">
              {dependencyIssues.map((issue) => (
                <div key={issue.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="text-sm font-semibold text-slate-800">{issue.title}</div>
                  <div className="mt-1 text-xs text-slate-600">{issue.summary}</div>
                  <ol className="mt-2 list-decimal list-inside space-y-1 text-xs text-slate-700">
                    {issue.steps.map((step, index) => (
                      <li key={`${issue.id}-${index}`}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
