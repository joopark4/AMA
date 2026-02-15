/**
 * useSpeechSynthesis - TTS 재생 훅
 *
 * Supertonic TTS를 사용하여 음성을 재생합니다.
 * 립싱크 애니메이션과 연동됩니다.
 */
import { useState, useCallback, useRef } from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useAvatarStore } from '../stores/avatarStore';
import { ttsRouter } from '../services/voice/ttsRouter';
import { invoke } from '@tauri-apps/api/core';

// Helper function to log to terminal
const log = (...args: any[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  console.log('[TTS]', ...args);
  invoke('log_to_terminal', { message: `[TTS] ${message}` }).catch(() => {});
};

interface UseSpeechSynthesisReturn {
  isSpeaking: boolean;
  error: string | null;
  speak: (text: string) => Promise<void>;
  stop: () => void;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lipSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { setStatus, setIsSpeaking: setStoreSpeaking } = useConversationStore();
  const { setLipSyncValue } = useAvatarStore();

  // 립싱크 애니메이션 시작
  const startLipSync = useCallback(() => {
    let phase = 0;
    lipSyncIntervalRef.current = setInterval(() => {
      phase += 0.3;
      const lipValue = Math.abs(Math.sin(phase)) * 0.7 + Math.random() * 0.3;
      setLipSyncValue(Math.min(1, lipValue));
    }, 80);
  }, [setLipSyncValue]);

  // 립싱크 애니메이션 종료
  const stopLipSync = useCallback(() => {
    if (lipSyncIntervalRef.current) {
      clearInterval(lipSyncIntervalRef.current);
      lipSyncIntervalRef.current = null;
    }
    setLipSyncValue(0);
  }, [setLipSyncValue]);

  // 상태 정리
  const cleanup = useCallback(() => {
    stopLipSync();
    setIsSpeaking(false);
    setStoreSpeaking(false);
    setStatus('idle');
  }, [stopLipSync, setStoreSpeaking, setStatus]);

  const speak = useCallback(async (text: string) => {
    log('speak() called with text:', text?.substring(0, 30) + '...');

    // 진행 중인 음성 중지
    if (audioRef.current) {
      log('Stopping previous audio');
      audioRef.current.pause();
      audioRef.current = null;
    }
    stopLipSync();

    setError(null);
    setIsSpeaking(true);
    setStoreSpeaking(true);
    setStatus('speaking');

    try {
      log('Synthesizing and playing with Web Audio API...');
      startLipSync();

      // Web Audio API를 사용한 직접 재생
      await ttsRouter.playAudio(text);

      log('Audio playback completed');
      cleanup();
    } catch (err) {
      log('TTS Error:', err);
      setError((err as Error).message);
      cleanup();
    }
  }, [setStatus, setStoreSpeaking, startLipSync, stopLipSync, cleanup]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    cleanup();
  }, [cleanup]);

  return {
    isSpeaking,
    error,
    speak,
    stop,
  };
}

export default useSpeechSynthesis;
