import type { TTSResult, TTSClient, TTSOptions } from './types';
import { getSupertonicClient } from './supertonicClient';
import { getSupertoneApiClient, usePremiumStore } from '../../features/premium-voice';
import { useSettingsStore } from '../../stores/settingsStore';
import { QuotaExceededError } from '../auth/edgeFunctionClient';
import { invoke } from '@tauri-apps/api/core';
import { getSharedAudioContext } from '../audio/sharedAudioContext';

const log = (...args: unknown[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  console.log(`[TTSRouter] ${message}`);
  invoke('log_to_terminal', { message: `[TTSRouter] ${message}` }).catch(() => {});
};

class TTSRouter {
  private supertonicClient: TTSClient;
  private activePlaybackStopper: (() => void) | null = null;
  /** 사용자 제스처 컨텍스트에서 미리 setSinkId 적용된 Audio (재사용) */
  private deviceAudio: HTMLAudioElement | null = null;

  constructor() {
    this.supertonicClient = getSupertonicClient();
  }

  /**
   * 출력 디바이스 변경 시 호출 — 반드시 사용자 제스처(클릭) 컨텍스트에서 호출해야 함.
   * WKWebView에서 setSinkId는 제스처 없이 호출하면 거부됨.
   */
  async prepareOutputDevice(deviceId?: string): Promise<void> {
    const audio = new Audio();
    if (deviceId && 'setSinkId' in audio) {
      try {
        await (audio as any).setSinkId(deviceId);
        log('prepareOutputDevice: OK deviceId=', deviceId);
      } catch (err) {
        log('prepareOutputDevice: FAILED:', (err as Error).message);
      }
    }
    this.deviceAudio = audio;
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
    return this.getActiveClient().synthesize(text, options);
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
      log('Failed to stop playback:', error);
    }
  }

  /** 테스트 비프음 재생 — 선택된 출력 디바이스로 (버튼 클릭 = 제스처 컨텍스트) */
  async playTestBeep(): Promise<void> {
    const outputDeviceId = useSettingsStore.getState().settings.tts.audioOutputDeviceId;

    const audio = new Audio();
    if (outputDeviceId && 'setSinkId' in audio) {
      try {
        await (audio as any).setSinkId(outputDeviceId);
      } catch (err) {
        log('playTestBeep setSinkId FAILED:', (err as Error).message);
      }
    }

    const audioContext = this.getAudioContext();
    if (audioContext.state === 'suspended') await audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const dest = audioContext.createMediaStreamDestination();

    oscillator.connect(gainNode);
    gainNode.connect(dest);
    oscillator.frequency.value = 440;
    gainNode.gain.value = 0.3;

    audio.srcObject = dest.stream;
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);

    try {
      await audio.play();
    } catch (err) {
      log('playTestBeep play failed:', (err as Error).message);
    }

    return new Promise((resolve) => {
      oscillator.onended = () => {
        audio.srcObject = null;
        if (!this.deviceAudio) this.deviceAudio = audio;
        resolve();
      };
    });
  }

  /** TTS 합성 + 재생 */
  async playAudio(text: string, options?: TTSOptions): Promise<void> {
    log('playAudio called');
    this.stopPlayback();

    const { settings } = useSettingsStore.getState();
    const ttsOptions: TTSOptions = { voice: settings.tts.voice, ...options };

    try {
      const result = await this.synthesize(text, ttsOptions);
      log('synthesize done, size:', result.audioData.byteLength);
      await this.playViaMediaStream(result.audioData);
    } catch (error) {
      console.error('[TTSRouter] Synthesize FAILED:', error);

      // 할당량 소진 시 로컬 폴백
      if (error instanceof QuotaExceededError) {
        log('Quota exceeded, falling back to local Supertonic');
        usePremiumStore.getState().updateQuotaFromTtsResponse(error.headers);
        window.dispatchEvent(new CustomEvent('ama-toast', {
          detail: { type: 'warning', messageKey: 'settings.premium.quota.fallbackToast' },
        }));
        const fallbackResult = await this.supertonicClient.synthesize(text, ttsOptions);
        await this.playViaMediaStream(fallbackResult.audioData).catch(() => {});
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
          await this.playViaMediaStream(fallbackResult.audioData);
          return;
        } catch (localError) {
          log('Local fallback also failed:', localError);
        }
      }

      throw error;
    }
  }

  /**
   * AudioContext → BufferSource → MediaStreamDestination → HTML Audio(setSinkId).
   * WKWebView에서 setSinkId는 srcObject(MediaStream) + 제스처 컨텍스트에서만 동작하므로,
   * prepareOutputDevice() 또는 playTestBeep()에서 미리 적용된 deviceAudio를 재사용한다.
   */
  private async playViaMediaStream(audioData: ArrayBuffer): Promise<void> {
    const audioContext = this.getAudioContext();
    if (audioContext.state === 'suspended') await audioContext.resume();

    const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0));

    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    gain.gain.value = 1.0;
    const dest = audioContext.createMediaStreamDestination();

    source.buffer = audioBuffer;
    source.connect(gain);
    gain.connect(dest);

    const audio = this.deviceAudio ?? new Audio();
    this.deviceAudio = null;
    audio.volume = 1.0;
    audio.srcObject = dest.stream;

    let cancelled = false;
    this.activePlaybackStopper = () => {
      cancelled = true;
      try { audio.pause(); audio.srcObject = null; source.stop(0); } catch { /* ignore */ }
    };

    if (cancelled) return;

    return new Promise((resolve, reject) => {
      let settled = false;
      let stopCurrent: (() => void) | null = null;

      const settle = (done: () => void) => {
        if (settled) return;
        settled = true;
        if (this.activePlaybackStopper === stopCurrent) {
          this.activePlaybackStopper = null;
        }
        audio.onended = null;
        audio.onerror = null;
        source.onended = null;
        try { audio.srcObject = null; } catch { /* ignore */ }
        try { source.disconnect(); } catch { /* ignore */ }
        try { gain.disconnect(); } catch { /* ignore */ }
        if (!this.deviceAudio) this.deviceAudio = audio;
        done();
      };

      audio.onended = () => settle(resolve);
      source.onended = () => setTimeout(() => settle(resolve), 50);
      audio.onerror = () => {
        const msg = audio.error?.message || audio.error?.code || 'unknown';
        settle(() => reject(new Error(`Audio error: ${msg}`)));
      };

      stopCurrent = () => {
        if (settled) return;
        try { audio.pause(); audio.srcObject = null; source.stop(0); } catch { /* ignore */ }
        settle(resolve);
      };
      this.activePlaybackStopper = stopCurrent;

      source.start(0);
      audio.play().catch((err) => settle(() => reject(err)));
    });
  }
}

export const ttsRouter = new TTSRouter();
export default ttsRouter;
