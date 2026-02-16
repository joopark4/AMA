import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useConversation } from '../../hooks/useConversation';

interface StatusIndicatorProps {
  isProcessing: boolean;
}

export default function StatusIndicator({ isProcessing }: StatusIndicatorProps) {
  const { t } = useTranslation();
  const { status, isListening, isSpeaking } = useConversationStore();
  const { openSettings } = useSettingsStore();
  const {
    isListening: isVoiceListening,
    transcript,
    error: voiceError,
    needsMicrophonePermission,
    voiceInputUnavailableReason,
    startListening,
    stopListening,
    sendMessage,
    openMicrophoneSettings,
  } = useConversation();

  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const isVoiceButtonDisabled = false;

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      sendMessage(textInput.trim());
      setTextInput('');
    }
  };

  const handleVoiceToggle = () => {
    if (isVoiceListening) {
      stopListening();
    } else {
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

      {!voiceError && voiceInputUnavailableReason && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded-lg text-xs max-w-xs" data-interactive="true">
          <div>{voiceInputUnavailableReason}</div>
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
    </div>
  );
}
