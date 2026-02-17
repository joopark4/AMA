import { useEffect, useRef, useCallback } from 'react';
import { useAvatarStore } from '../stores/avatarStore';
import { useConversationStore } from '../stores/conversationStore';

export function useLipSync() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { setLipSyncValue } = useAvatarStore();
  const { isSpeaking } = useConversationStore();

  // Initialize audio context
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
    }
  }, []);

  // Analyze audio and update lip sync
  const analyzeLipSync = useCallback(() => {
    if (!analyserRef.current) {
      setLipSyncValue(0);
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate volume (focus on speech frequencies: 85-255 Hz)
    const speechRange = dataArray.slice(2, 8);
    let sum = 0;
    for (let i = 0; i < speechRange.length; i++) {
      sum += speechRange[i];
    }
    const volume = sum / (speechRange.length * 255);

    // Map to lip sync value with some smoothing
    const lipValue = Math.min(1, volume * 2.5);
    setLipSyncValue(lipValue);

    if (isSpeaking) {
      animationFrameRef.current = requestAnimationFrame(analyzeLipSync);
    }
  }, [setLipSyncValue, isSpeaking]);

  // Connect audio element for lip sync analysis
  const connectAudio = useCallback((audioElement: HTMLAudioElement) => {
    initAudioContext();

    if (audioContextRef.current && analyserRef.current) {
      // Disconnect previous source if exists
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }

      sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }
  }, [initAudioContext]);

  // Start lip sync analysis
  const startLipSync = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    analyzeLipSync();
  }, [analyzeLipSync]);

  // Stop lip sync analysis
  const stopLipSync = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setLipSyncValue(0);
  }, [setLipSyncValue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Auto-stop when not speaking
  useEffect(() => {
    if (!isSpeaking) {
      stopLipSync();
    }
  }, [isSpeaking, stopLipSync]);

  return {
    connectAudio,
    startLipSync,
    stopLipSync,
  };
}

export default useLipSync;
