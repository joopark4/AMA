import type { TTSResult, TTSClient, TTSOptions } from './types';
import { getSupertonicClient } from './supertonicClient';
import { useSettingsStore } from '../../stores/settingsStore';
import { invoke } from '@tauri-apps/api/core';

// Helper function to log to terminal
const log = (...args: any[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  console.log('[TTSRouter]', ...args);
  invoke('log_to_terminal', { message: `[TTSRouter] ${message}` }).catch(() => {});
};

class TTSRouter {
  private client: TTSClient;
  private audioContext: AudioContext | null = null;

  constructor() {
    this.client = getSupertonicClient();
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    return this.client.synthesize(text, options);
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await this.client.isAvailable();
    } catch {
      return false;
    }
  }

  // 테스트 비프음 재생
  async playTestBeep(): Promise<void> {
    log('Playing test beep...');
    const audioContext = this.getAudioContext();
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 440; // A4 음
    gainNode.gain.value = 0.3;

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5); // 0.5초 재생

    return new Promise((resolve) => {
      oscillator.onended = () => {
        log('Test beep ended');
        resolve();
      };
    });
  }

  // Data URL 방식으로 재생 (Tauri WebView 호환)
  async playAudio(text: string): Promise<void> {
    log('playAudio called');
    const { settings } = useSettingsStore.getState();
    const result = await this.synthesize(text, {
      voice: settings.tts.voice,
    });
    log('Synthesize complete, audioData size:', result.audioData.byteLength);
    try {
      await this.playViaHtmlAudio(result.audioData);
      return;
    } catch (htmlAudioError) {
      log('HTMLAudio playback failed, fallback to WebAudio decode:', htmlAudioError);
      await this.playViaWebAudio(result.audioData);
    }
  }

  // 기존 blob URL 방식 (fallback)
  async speak(text: string): Promise<string> {
    const { settings } = useSettingsStore.getState();
    const result = await this.synthesize(text, {
      voice: settings.tts.voice,
    });

    const blob = new Blob([result.audioData], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  private async playViaHtmlAudio(audioData: ArrayBuffer): Promise<void> {
    const blob = new Blob([audioData], { type: 'audio/wav' });
    const objectUrl = URL.createObjectURL(blob);
    log('Blob URL created for HTMLAudio playback');

    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.volume = 1.0;
      audio.preload = 'auto';
      let released = false;
      let lastLoggedSecond = -1;

      const release = () => {
        if (released) return;
        released = true;
        URL.revokeObjectURL(objectUrl);
      };

      audio.onloadedmetadata = () => {
        log('Audio metadata loaded, duration:', audio.duration);
      };

      audio.oncanplaythrough = () => {
        log('Audio canplaythrough');
      };

      audio.onended = () => {
        log('Audio playback ended at:', audio.currentTime);
        release();
        resolve();
      };

      audio.onerror = () => {
        const mediaError = audio.error?.message || audio.error?.code || 'unknown';
        log('Audio error:', mediaError);
        release();
        reject(new Error(`Audio playback error: ${mediaError}`));
      };

      audio.ontimeupdate = () => {
        const currentSecond = Math.floor(audio.currentTime);
        if (currentSecond !== lastLoggedSecond) {
          lastLoggedSecond = currentSecond;
          log('Playing:', currentSecond, '/', Math.floor(audio.duration), 'sec');
        }
      };

      audio.src = objectUrl;
      audio.play().then(() => {
        log('Audio play() started, duration:', audio.duration);
      }).catch((err) => {
        release();
        log('Audio play() failed:', err);
        reject(err);
      });
    });
  }

  private async playViaWebAudio(audioData: ArrayBuffer): Promise<void> {
    const audioContext = this.getAudioContext();
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0));
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    gain.gain.value = 1.2;

    source.buffer = audioBuffer;
    source.connect(gain);
    gain.connect(audioContext.destination);

    return new Promise((resolve) => {
      source.onended = () => {
        log('WebAudio playback ended');
        resolve();
      };
      source.start(0);
      log('WebAudio playback started');
    });
  }
}

export const ttsRouter = new TTSRouter();
export default ttsRouter;
