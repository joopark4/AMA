import type { TTSResult, TTSClient, TTSOptions } from './types';
import { getSupertonicClient } from './supertonicClient';
import { getSupertoneApiClient, usePremiumStore } from '../../features/premium-voice';
import { useSettingsStore } from '../../stores/settingsStore';
import { QuotaExceededError } from '../auth/edgeFunctionClient';
import { invoke } from '@tauri-apps/api/core';
import { getSharedAudioContext } from '../audio/sharedAudioContext';

const log = (...args: unknown[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  invoke('log_to_terminal', { message: `[TTSRouter] ${message}` }).catch(() => {});
};

class TTSRouter {
  private supertonicClient: TTSClient;
  private activePlaybackStopper: (() => void) | null = null;

  constructor() {
    this.supertonicClient = getSupertonicClient();
  }

  private getAudioContext(): AudioContext {
    return getSharedAudioContext();
  }

  /** 현재 설정 + 할당량 상태에 따라 적절한 클라이언트 선택 */
  private getActiveClient(): TTSClient {
    const { settings } = useSettingsStore.getState();
    if (settings.tts.engine === 'supertone_api') {
      return getSupertoneApiClient();
    }

    return this.supertonicClient;
  }

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    const client = this.getActiveClient();
    return client.synthesize(text, options);
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await this.supertonicClient.isAvailable();
    } catch {
      return false;
    }
  }

  stopPlayback(): void {
    const stopper = this.activePlaybackStopper;
    this.activePlaybackStopper = null;
    if (!stopper) return;
    try {
      stopper();
    } catch (error) {
      log('Failed to stop active playback:', error);
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
  async playAudio(text: string, options?: TTSOptions): Promise<void> {
    log('playAudio called, engine:', useSettingsStore.getState().settings.tts.engine);
    this.stopPlayback();

    const { settings } = useSettingsStore.getState();
    const ttsOptions: TTSOptions = {
      voice: settings.tts.voice,
      ...options,
    };

    try {
      log('Calling synthesize with engine:', settings.tts.engine);
      const result = await this.synthesize(text, ttsOptions);
      log('Synthesize complete, audioData size:', result.audioData.byteLength);

      try {
        await this.playViaHtmlAudio(result.audioData);
        return;
      } catch (htmlAudioError) {
        log('HTMLAudio playback failed, fallback to WebAudio decode:', htmlAudioError);
        await this.playViaWebAudio(result.audioData);
      }
    } catch (error) {
      console.error('[TTSRouter] Synthesize FAILED:', error);
      // 할당량 소진 시 로컬 폴백 + 토스트 알림
      if (error instanceof QuotaExceededError) {
        log('Quota exceeded, falling back to local Supertonic');
        usePremiumStore.getState().updateQuotaFromTtsResponse(error.headers);

        // 토스트 이벤트 발행
        window.dispatchEvent(new CustomEvent('ama-toast', {
          detail: { type: 'warning', messageKey: 'settings.premium.quota.fallbackToast' },
        }));

        // 로컬 폴백
        const fallbackResult = await this.supertonicClient.synthesize(text, ttsOptions);
        try {
          await this.playViaHtmlAudio(fallbackResult.audioData);
        } catch {
          await this.playViaWebAudio(fallbackResult.audioData);
        }
        return;
      }

      // 네트워크/서버 에러 시 로컬 폴백
      if (settings.tts.engine === 'supertone_api') {
        log('Supertone API error, falling back to local:', error);
        window.dispatchEvent(new CustomEvent('ama-toast', {
          detail: { type: 'error', messageKey: 'errors.supertoneApiFail' },
        }));

        try {
          const fallbackResult = await this.supertonicClient.synthesize(text, ttsOptions);
          try {
            await this.playViaHtmlAudio(fallbackResult.audioData);
          } catch {
            await this.playViaWebAudio(fallbackResult.audioData);
          }
          return;
        } catch (localError) {
          log('Local fallback also failed:', localError);
        }
      }

      throw error;
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

    // 선택된 출력 디바이스 적용 — play() 전에 완료되어야 함
    const outputDeviceId = useSettingsStore.getState().settings.tts.audioOutputDeviceId;
    const audio = new Audio();
    audio.volume = 1.0;
    audio.preload = 'auto';

    if (outputDeviceId && 'setSinkId' in audio) {
      try {
        await (audio as any).setSinkId(outputDeviceId);
      } catch (err) {
        log('setSinkId failed, using default output:', (err as Error).message);
      }
    }

    return new Promise((resolve, reject) => {
      let released = false;
      let lastLoggedSecond = -1;
      let settled = false;
      let stopCurrent: (() => void) | null = null;

      const release = () => {
        if (released) return;
        released = true;
        URL.revokeObjectURL(objectUrl);
      };

      const clearHandlers = () => {
        audio.onloadedmetadata = null;
        audio.oncanplaythrough = null;
        audio.onended = null;
        audio.onerror = null;
        audio.ontimeupdate = null;
      };

      const settle = (done: () => void) => {
        if (settled) return;
        settled = true;
        if (this.activePlaybackStopper === stopCurrent) {
          this.activePlaybackStopper = null;
        }
        clearHandlers();
        release();
        done();
      };

      audio.onloadedmetadata = () => {
        log('Audio metadata loaded, duration:', audio.duration);
      };

      audio.oncanplaythrough = () => {
        log('Audio canplaythrough');
      };

      audio.onended = () => {
        log('Audio playback ended at:', audio.currentTime);
        settle(resolve);
      };

      audio.onerror = () => {
        const mediaError = audio.error?.message || audio.error?.code || 'unknown';
        log('Audio error:', mediaError);
        settle(() => reject(new Error(`Audio playback error: ${mediaError}`)));
      };

      audio.ontimeupdate = () => {
        const currentSecond = Math.floor(audio.currentTime);
        if (currentSecond !== lastLoggedSecond) {
          lastLoggedSecond = currentSecond;
          log('Playing:', currentSecond, '/', Math.floor(audio.duration), 'sec');
        }
      };

      stopCurrent = () => {
        if (settled) return;
        log('HTMLAudio playback cancelled');
        // handlers를 먼저 제거하여 audio.src='' 시 onerror 발생 방지
        clearHandlers();
        try {
          audio.pause();
          audio.currentTime = 0;
          audio.src = '';
        } catch {
          // ignore cancellation cleanup errors
        }
        settle(resolve);
      };
      this.activePlaybackStopper = stopCurrent;

      audio.src = objectUrl;
      audio.play().then(() => {
        log('Audio play() started, duration:', audio.duration);
      }).catch((err) => {
        log('Audio play() failed:', err);
        settle(() => reject(err));
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
    gain.gain.value = 1.0;

    source.buffer = audioBuffer;
    source.connect(gain);
    gain.connect(audioContext.destination);

    return new Promise((resolve, reject) => {
      let settled = false;
      let stopCurrent: (() => void) | null = null;

      const settle = (done: () => void) => {
        if (settled) return;
        settled = true;
        if (this.activePlaybackStopper === stopCurrent) {
          this.activePlaybackStopper = null;
        }
        source.onended = null;
        try {
          source.disconnect();
        } catch {
          // ignore disconnect errors
        }
        try {
          gain.disconnect();
        } catch {
          // ignore disconnect errors
        }
        done();
      };

      stopCurrent = () => {
        if (settled) return;
        log('WebAudio playback cancelled');
        try {
          source.stop(0);
        } catch {
          // source may already be stopped
        }
        settle(resolve);
      };
      this.activePlaybackStopper = stopCurrent;

      source.onended = () => {
        log('WebAudio playback ended');
        settle(resolve);
      };
      try {
        source.start(0);
        log('WebAudio playback started');
      } catch (err) {
        settle(() => reject(err));
      }
    });
  }
}

export const ttsRouter = new TTSRouter();
export default ttsRouter;
