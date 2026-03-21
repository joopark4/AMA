/**
 * Supertone API 클라이언트 — Edge Function 프록시를 통한 클라우드 TTS
 */
import type { TTSClient, TTSResult, TTSOptions } from '../../services/voice/types';
import type { SupertoneVoice } from './premiumStore';
import { usePremiumStore } from './premiumStore';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { callEdgeFunction } from '../../services/auth/edgeFunctionClient';
import { invoke } from '@tauri-apps/api/core';

const log = (...args: unknown[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  invoke('log_to_terminal', { message: `[SupertoneAPI] ${message}` }).catch(() => {});
};

/** Supertone API 모델별 지원 언어 */
const MODEL_LANGUAGES: Record<string, string[]> = {
  sona_speech_1: ['ko', 'en', 'ja'],
  sona_speech_2: ['ko', 'en', 'ja', 'zh', 'de', 'fr', 'es', 'pt', 'it', 'ru', 'nl', 'pl', 'sv', 'da', 'fi', 'no', 'tr', 'ar', 'hi', 'th', 'vi', 'id', 'ms'],
  sona_speech_2_flash: ['ko', 'en', 'ja', 'zh', 'de', 'fr', 'es', 'pt', 'it', 'ru', 'nl', 'pl', 'sv', 'da', 'fi', 'no', 'tr', 'ar', 'hi', 'th', 'vi', 'id', 'ms'],
};

/** AMA 감정 → Supertone 스타일 매핑 */
const EMOTION_STYLE_MAP: Record<string, string> = {
  happy: 'happy',
  sad: 'sad',
  angry: 'angry',
  surprised: 'surprised',
  relaxed: 'neutral',
  thinking: 'neutral',
  neutral: 'neutral',
};

/** 텍스트를 300자 이하 청크로 분할 */
function chunkText(text: string, maxLen = 300): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?。！？\n])\s*/);
  let current = '';

  for (const sentence of sentences) {
    if (sentence.length > maxLen) {
      if (current) { chunks.push(current); current = ''; }
      for (let i = 0; i < sentence.length; i += maxLen) {
        chunks.push(sentence.slice(i, i + maxLen));
      }
    } else if ((current + ' ' + sentence).trim().length > maxLen) {
      if (current) chunks.push(current);
      current = sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

/** WAV 청크를 결합하여 단일 WAV 반환 */
function combineWavChunks(chunks: ArrayBuffer[]): ArrayBuffer {
  if (chunks.length === 1) return chunks[0];

  // 각 청크에서 PCM 데이터 추출 (44바이트 WAV 헤더 스킵)
  const pcmChunks: Uint8Array[] = [];
  let sampleRate = 44100;
  let bitsPerSample = 16;
  let numChannels = 1;

  for (let i = 0; i < chunks.length; i++) {
    const view = new DataView(chunks[i]);
    if (i === 0 && chunks[i].byteLength > 44) {
      // 첫 청크에서 WAV 헤더 정보 추출
      numChannels = view.getUint16(22, true);
      sampleRate = view.getUint32(24, true);
      bitsPerSample = view.getUint16(34, true);
    }
    // PCM 데이터 (44바이트 이후)
    if (chunks[i].byteLength > 44) {
      pcmChunks.push(new Uint8Array(chunks[i], 44));
    }

    // 청크 사이에 100ms 무음 삽입 (마지막 청크 제외)
    if (i < chunks.length - 1) {
      const silenceSamples = Math.floor(sampleRate * 0.1) * numChannels * (bitsPerSample / 8);
      pcmChunks.push(new Uint8Array(silenceSamples)); // 0으로 초기화 = 무음
    }
  }

  // 총 PCM 데이터 크기 계산
  const totalPcmSize = pcmChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);

  // 새 WAV 파일 생성
  const wavBuffer = new ArrayBuffer(44 + totalPcmSize);
  const wavView = new DataView(wavBuffer);
  const wavBytes = new Uint8Array(wavBuffer);

  // WAV 헤더 작성
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) wavView.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  wavView.setUint32(4, 36 + totalPcmSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  wavView.setUint32(16, 16, true);                          // fmt chunk size
  wavView.setUint16(20, 1, true);                           // PCM format
  wavView.setUint16(22, numChannels, true);
  wavView.setUint32(24, sampleRate, true);
  wavView.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // byte rate
  wavView.setUint16(32, numChannels * (bitsPerSample / 8), true); // block align
  wavView.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  wavView.setUint32(40, totalPcmSize, true);

  // PCM 데이터 복사
  let offset = 44;
  for (const chunk of pcmChunks) {
    wavBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return wavBuffer;
}

export function getModelLanguages(model: string): string[] {
  return MODEL_LANGUAGES[model] || MODEL_LANGUAGES.sona_speech_1;
}

export class SupertoneApiClient implements TTSClient {
  private lastRequestTime = 0;
  private readonly minRequestInterval = 1000; // 1초 최소 간격

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    const { settings } = useSettingsStore.getState();
    const apiSettings = settings.tts.supertoneApi;

    if (!apiSettings?.voiceId) {
      throw new Error('Supertone API voice not configured');
    }

    // Rate limiting
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - elapsed));
    }

    // 언어 결정: 설정 언어가 모델에서 지원되지 않으면 'en' 폴백
    const supportedLanguages = getModelLanguages(apiSettings.model);
    let language = apiSettings.language || 'ko';
    if (!supportedLanguages.includes(language)) {
      log(`Language '${language}' not supported by ${apiSettings.model}, falling back to 'en'`);
      language = 'en';
    }

    // 스타일 결정: 감정 자동 매핑 또는 수동 선택
    const baseStyle = apiSettings.style || 'neutral';
    let style = baseStyle;
    if (apiSettings.autoEmotionStyle && options?.emotion) {
      const mappedStyle = EMOTION_STYLE_MAP[options.emotion] || 'neutral';
      // 선택된 음성이 해당 스타일을 지원하는지 확인
      const voices = usePremiumStore.getState().voices;
      const selectedVoice = voices.find(v => v.voice_id === apiSettings.voiceId);
      const supportedStyles = selectedVoice?.styles || [];

      if (supportedStyles.length === 0 || supportedStyles.includes(mappedStyle)) {
        style = mappedStyle;
      } else {
        // 지원하지 않는 스타일이면 사용자 설정 스타일로 폴백
        log(`Style '${mappedStyle}' not supported by voice '${apiSettings.voiceName}', using '${baseStyle}'`);
        style = supportedStyles.includes(baseStyle) ? baseStyle : (supportedStyles[0] || 'neutral');
      }
      log(`Emotion '${options.emotion}' → style '${style}'`);
    }
    if (options?.style) {
      style = options.style; // 직접 지정 시 오버라이드
    }

    // 청크 분할
    const chunks = chunkText(text);
    log(`Text length: ${text.length}, chunks: ${chunks.length}`);

    const audioChunks: ArrayBuffer[] = [];
    let totalDuration = 0;

    for (let i = 0; i < chunks.length; i++) {
      log(`Synthesizing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);
      this.lastRequestTime = Date.now();

      const response = await callEdgeFunction<{ data: ArrayBuffer; headers: Headers }>(
        'supertone-tts',
        {
          body: {
            text: chunks[i],
            voiceId: apiSettings.voiceId,
            voiceName: apiSettings.voiceName,
            language,
            style,
            model: apiSettings.model,
            outputFormat: 'wav',
            voiceSettings: apiSettings.voiceSettings,
          },
          responseType: 'arraybuffer',
        }
      );

      audioChunks.push(response.data);

      // 할당량 정보 업데이트 (마지막 청크에서)
      if (response.headers) {
        usePremiumStore.getState().updateQuotaFromTtsResponse(response.headers);

        const audioLength = parseFloat(response.headers.get('X-Audio-Length') || '0');
        totalDuration += audioLength;
      }
    }

    // 청크 결합
    const combinedAudio = combineWavChunks(audioChunks);
    log(`Synthesis complete, total audio size: ${combinedAudio.byteLength}, duration: ${totalDuration}s`);

    return {
      audioData: combinedAudio,
      duration: totalDuration,
    };
  }

  async listVoices(filters?: { language?: string; style?: string; gender?: string }): Promise<SupertoneVoice[]> {
    const params: Record<string, string> = {};
    if (filters?.language) params.language = filters.language;
    if (filters?.style) params.style = filters.style;
    if (filters?.gender) params.gender = filters.gender;

    return callEdgeFunction<SupertoneVoice[]>('supertone-voices', { params });
  }

  async isAvailable(): Promise<boolean> {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) return false;

    const { isPremium } = usePremiumStore.getState();
    return isPremium;
  }
}

// 지연 초기화 싱글톤
let _instance: SupertoneApiClient | null = null;
export function getSupertoneApiClient(): SupertoneApiClient {
  if (!_instance) {
    _instance = new SupertoneApiClient();
  }
  return _instance;
}
