/**
 * SupertonicClient - Supertonic 2 TTS 클라이언트
 *
 * Supertone의 Supertonic TTS 엔진을 onnxruntime-web으로 브라우저에서 실행
 * - WebGPU 가속 지원 (Chrome 113+)
 * - WASM 폴백 지원
 * - 한국어/영어 포함 5개 언어 지원
 * - 10종 음성 스타일 (M1-M5, F1-F5)
 *
 * @see https://github.com/supertone-inc/supertonic
 */
import type { TTSResult, TTSClient, TTSOptions } from './types';
import { useSettingsStore } from '../../stores/settingsStore';
import { invoke } from '@tauri-apps/api/core';

// Helper function to log to terminal
const log = (...args: any[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  console.log('[Supertonic]', ...args);
  invoke('log_to_terminal', { message: `[Supertonic] ${message}` }).catch(() => {});
};

// ONNX Runtime은 동적으로 import (Vite 최적화 우회)
let ort: any = null;

async function getOrt() {
  if (!ort) {
    // @ts-ignore - ESM 직접 import
    ort = await import('/node_modules/onnxruntime-web/dist/esm/ort.min.js');
    ort.env.wasm.wasmPaths = '/';
  }
  return ort;
}

// Supertonic 음성 스타일
export type SupertonicVoice = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'F1' | 'F2' | 'F3' | 'F4' | 'F5';

// 지원 언어
export type SupertonicLanguage = 'en' | 'ko' | 'es' | 'pt' | 'fr';
const AVAILABLE_LANGS: SupertonicLanguage[] = ['en', 'ko', 'es', 'pt', 'fr'];

// 음성 메타데이터
export const SUPERTONIC_VOICES: Record<SupertonicVoice, { label: string; gender: 'male' | 'female' }> = {
  M1: { label: '남성 1', gender: 'male' },
  M2: { label: '남성 2', gender: 'male' },
  M3: { label: '남성 3', gender: 'male' },
  M4: { label: '남성 4', gender: 'male' },
  M5: { label: '남성 5', gender: 'male' },
  F1: { label: '여성 1', gender: 'female' },
  F2: { label: '여성 2', gender: 'female' },
  F3: { label: '여성 3', gender: 'female' },
  F4: { label: '여성 4', gender: 'female' },
  F5: { label: '여성 5', gender: 'female' },
};

// 모델 설정
interface SupertonicConfig {
  basePath: string;
  defaultVoice: SupertonicVoice;
  defaultSpeed: number;
  defaultSteps: number;
}

const DEFAULT_CONFIG: SupertonicConfig = {
  basePath: '/models/supertonic',
  defaultVoice: 'F1',
  defaultSpeed: 1.05,
  defaultSteps: 2,
};

// TTS 설정 (tts.json에서 로드)
interface TTSConfigs {
  ae: {
    sample_rate: number;
    base_chunk_size: number;
  };
  ttl: {
    chunk_compress_factor: number;
    latent_dim: number;
  };
}

// 음성 스타일 텐서 (ort.Tensor 타입 - 동적 로드로 인해 any 사용)
class Style {
  constructor(
    public ttl: any,
    public dp: any
  ) {}
}

/**
 * Unicode 텍스트 처리기
 */
class UnicodeProcessor {
  constructor(private indexer: number[]) {}

  call(textList: string[], langList: SupertonicLanguage[]): { textIds: number[][]; textMask: number[][][] } {
    const processedTexts = textList.map((text, i) => this.preprocessText(text, langList[i]));

    const textIdsLengths = processedTexts.map(text => text.length);
    const maxLen = Math.max(...textIdsLengths);

    const textIds = processedTexts.map(text => {
      const row = new Array(maxLen).fill(0);
      for (let j = 0; j < text.length; j++) {
        const codePoint = text.codePointAt(j)!;
        row[j] = (codePoint < this.indexer.length) ? this.indexer[codePoint] : -1;
      }
      return row;
    });

    const textMask = this.getTextMask(textIdsLengths);
    return { textIds, textMask };
  }

  preprocessText(text: string, lang: SupertonicLanguage): string {
    // Unicode 정규화
    text = text.normalize('NFKD');

    // 이모지 제거
    const emojiPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu;
    text = text.replace(emojiPattern, '');

    // 특수 문자 대체
    const replacements: Record<string, string> = {
      '–': '-', '‑': '-', '—': '-', '_': ' ',
      '\u201C': '"', '\u201D': '"', '\u2018': "'", '\u2019': "'",
      '´': "'", '`': "'", '[': ' ', ']': ' ', '|': ' ', '/': ' ',
      '#': ' ', '→': ' ', '←': ' ',
    };
    for (const [k, v] of Object.entries(replacements)) {
      text = text.replaceAll(k, v);
    }

    // 특수 기호 제거
    text = text.replace(/[♥☆♡©\\]/g, '');

    // 알려진 표현 대체
    text = text.replaceAll('@', ' at ');
    text = text.replaceAll('e.g.,', 'for example, ');
    text = text.replaceAll('i.e.,', 'that is, ');

    // 구두점 공백 수정
    text = text.replace(/ ,/g, ',');
    text = text.replace(/ \./g, '.');
    text = text.replace(/ !/g, '!');
    text = text.replace(/ \?/g, '?');
    text = text.replace(/ ;/g, ';');
    text = text.replace(/ :/g, ':');
    text = text.replace(/ '/g, "'");

    // 중복 따옴표 제거
    while (text.includes('""')) text = text.replace('""', '"');
    while (text.includes("''")) text = text.replace("''", "'");

    // 여분의 공백 제거
    text = text.replace(/\s+/g, ' ').trim();

    // 문장 부호로 끝나지 않으면 마침표 추가
    if (!/[.!?;:,'\"')\]}…。」』】〉》›»]$/.test(text)) {
      text += '.';
    }

    // 언어 태그로 감싸기
    text = `<${lang}>${text}</${lang}>`;

    return text;
  }

  getTextMask(textIdsLengths: number[]): number[][][] {
    const maxLen = Math.max(...textIdsLengths);
    return this.lengthToMask(textIdsLengths, maxLen);
  }

  lengthToMask(lengths: number[], maxLen?: number): number[][][] {
    const actualMaxLen = maxLen || Math.max(...lengths);
    return lengths.map(len => {
      const row = new Array(actualMaxLen).fill(0.0);
      for (let j = 0; j < Math.min(len, actualMaxLen); j++) {
        row[j] = 1.0;
      }
      return [row];
    });
  }
}

/**
 * 텍스트 청킹 함수
 */
function chunkText(text: string, maxLen = 300): string[] {
  const paragraphs = text.trim().split(/\n\s*\n+/).filter(p => p.trim());
  const chunks: string[] = [];

  for (let paragraph of paragraphs) {
    paragraph = paragraph.trim();
    if (!paragraph) continue;

    const sentences = paragraph.split(/(?<!Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Sr\.|Jr\.|etc\.|e\.g\.|i\.e\.|vs\.)(?<!\b[A-Z]\.)(?<=[.!?])\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length + 1 <= maxLen) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

export class SupertonicClient implements TTSClient {
  private config: SupertonicConfig;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  // ONNX 세션들 (동적 로드로 인해 any 사용)
  private dpOrt: any = null;
  private textEncOrt: any = null;
  private vectorEstOrt: any = null;
  private vocoderOrt: any = null;

  // 설정 및 프로세서
  private cfgs: TTSConfigs | null = null;
  private textProcessor: UnicodeProcessor | null = null;
  private sampleRate = 44100;

  // 캐시된 음성 스타일
  private voiceStyles: Map<SupertonicVoice, Style> = new Map();

  constructor(config: Partial<SupertonicConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 모델 및 음성 스타일 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      console.log('[Supertonic] Loading configuration from', this.config.basePath);

      // tts.json 설정 로드
      const cfgsUrl = `${this.config.basePath}/onnx/tts.json`;
      console.log('[Supertonic] Fetching config from:', cfgsUrl);
      const cfgsResponse = await fetch(cfgsUrl);
      if (!cfgsResponse.ok) {
        throw new Error(`Failed to fetch tts.json: ${cfgsResponse.status} ${cfgsResponse.statusText}`);
      }
      this.cfgs = await cfgsResponse.json();
      console.log('[Supertonic] Config loaded, sample_rate:', this.cfgs!.ae.sample_rate);
      this.sampleRate = this.cfgs!.ae.sample_rate;

      // unicode_indexer.json 로드
      const indexerResponse = await fetch(`${this.config.basePath}/onnx/unicode_indexer.json`);
      const indexer = await indexerResponse.json();
      this.textProcessor = new UnicodeProcessor(indexer);

      // 동적으로 ort 가져오기
      const ortModule = await getOrt();

      // 공식 Supertonic 구현과 동일: WebGPU 시도 후 WASM 폴백
      const loadOnnx = async (onnxPath: string, options: any): Promise<any> => {
        console.log(`[Supertonic] Loading ${onnxPath}...`);
        const session = await ortModule.InferenceSession.create(onnxPath, options);
        console.log(`[Supertonic] ${onnxPath} loaded`);
        return session;
      };

      const modelNames = ['duration_predictor', 'text_encoder', 'vector_estimator', 'vocoder'];
      const modelPaths = modelNames.map(name => `${this.config.basePath}/onnx/${name}.onnx`);

      // WebGPU 시도
      let sessionOptions: any = {
        executionProviders: ['webgpu'],
        graphOptimizationLevel: 'all',
      };

      try {
        console.log('[Supertonic] Trying WebGPU...');
        const sessions: any[] = [];
        for (let i = 0; i < modelPaths.length; i++) {
          console.log(`[Supertonic] Loading ${modelNames[i]} (${i + 1}/${modelPaths.length})...`);
          const session = await loadOnnx(modelPaths[i], sessionOptions);
          sessions.push(session);
        }
        [this.dpOrt, this.textEncOrt, this.vectorEstOrt, this.vocoderOrt] = sessions;
        console.log('[Supertonic] WebGPU loaded successfully');
      } catch (webgpuError) {
        console.log('[Supertonic] WebGPU failed, trying WASM...', webgpuError);

        // WASM 폴백
        sessionOptions = {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        };

        const sessions: any[] = [];
        for (let i = 0; i < modelPaths.length; i++) {
          console.log(`[Supertonic] Loading ${modelNames[i]} with WASM (${i + 1}/${modelPaths.length})...`);
          const session = await loadOnnx(modelPaths[i], sessionOptions);
          sessions.push(session);
        }
        [this.dpOrt, this.textEncOrt, this.vectorEstOrt, this.vocoderOrt] = sessions;
        console.log('[Supertonic] WASM loaded successfully');
      }

      // 기본 음성 스타일 로드
      console.log('[Supertonic] Loading default voice style...');
      await this.loadVoiceStyle(this.config.defaultVoice);

      this.isInitialized = true;
      console.log('[Supertonic] Initialization complete');
    } catch (error) {
      console.error('[Supertonic] Initialization failed:', error);
      this.initPromise = null;
      throw error;
    }
  }

  /**
   * 음성 스타일 로드
   */
  async loadVoiceStyle(voice: SupertonicVoice): Promise<Style> {
    if (this.voiceStyles.has(voice)) {
      return this.voiceStyles.get(voice)!;
    }

    const stylePath = `${this.config.basePath}/voice_styles/${voice}.json`;
    console.log('[Supertonic] Loading voice style:', stylePath);

    const response = await fetch(stylePath);
    if (!response.ok) {
      throw new Error(`Failed to load voice style: ${response.status}`);
    }

    const voiceStyle = await response.json();
    const ortModule = await getOrt();

    // TTL 텐서 생성
    const ttlData = voiceStyle.style_ttl.data.flat(Infinity);
    const ttlDims = voiceStyle.style_ttl.dims;
    const ttlTensor = new ortModule.Tensor('float32', new Float32Array(ttlData), ttlDims);

    // DP 텐서 생성
    const dpData = voiceStyle.style_dp.data.flat(Infinity);
    const dpDims = voiceStyle.style_dp.dims;
    const dpTensor = new ortModule.Tensor('float32', new Float32Array(dpData), dpDims);

    const style = new Style(ttlTensor, dpTensor);
    this.voiceStyles.set(voice, style);

    return style;
  }

  /**
   * 텍스트를 음성으로 변환
   */
  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const { settings } = useSettingsStore.getState();
    const voice = (options?.voice || settings.tts.voice || this.config.defaultVoice) as SupertonicVoice;
    const speed = options?.speed || this.config.defaultSpeed;
    const language = this.detectLanguage(text, settings.language);
    const totalStep = this.config.defaultSteps;

    log('Synthesizing:', { voice, language, speed, totalStep, textLength: text.length });

    // 음성 스타일 로드
    const style = await this.loadVoiceStyle(voice);

    // 텍스트 청킹 (한국어는 120자, 그 외는 300자)
    const maxLen = language === 'ko' ? 120 : 300;
    const textList = chunkText(text, maxLen);
    log('Text chunks:', textList.length, 'chunks, first:', textList[0]?.substring(0, 30));

    let wavCat: number[] = [];
    let durCat = 0;
    const silenceDuration = 0.3;

    for (let i = 0; i < textList.length; i++) {
      log(`Processing chunk ${i + 1}/${textList.length}:`, textList[i].substring(0, 30));
      const { wav, duration } = await this._infer([textList[i]], [language], style, totalStep, speed);
      log(`Chunk ${i + 1} result: wav length=${wav.length}, duration=${duration[0].toFixed(2)}s`);

      if (wavCat.length === 0) {
        wavCat = wav;
        durCat = duration[0];
      } else {
        const silenceLen = Math.floor(silenceDuration * this.sampleRate);
        const silence = new Array(silenceLen).fill(0);
        wavCat = [...wavCat, ...silence, ...wav];
        durCat += duration[0] + silenceDuration;
      }
    }

    // WAV 변환
    log('Audio data stats:', {
      length: wavCat.length,
      min: Math.min(...wavCat),
      max: Math.max(...wavCat),
      sampleRate: this.sampleRate,
      duration: durCat
    });

    const audioData = this.writeWavFile(wavCat, this.sampleRate);

    return {
      audioData,
      duration: durCat,
    };
  }

  /**
   * 추론 실행
   */
  private async _infer(
    textList: string[],
    langList: SupertonicLanguage[],
    style: Style,
    totalStep: number,
    speed: number
  ): Promise<{ wav: number[]; duration: number[] }> {
    if (!this.dpOrt || !this.textEncOrt || !this.vectorEstOrt || !this.vocoderOrt || !this.textProcessor || !this.cfgs) {
      throw new Error('Models not initialized');
    }

    const ortModule = await getOrt();
    const bsz = textList.length;

    // 텍스트 처리
    const { textIds, textMask } = this.textProcessor.call(textList, langList);

    const textIdsFlat = new BigInt64Array(textIds.flat().map(x => BigInt(x)));
    const textIdsShape = [bsz, textIds[0].length];
    const textIdsTensor = new ortModule.Tensor('int64', textIdsFlat, textIdsShape);

    const textMaskFlat = new Float32Array(textMask.flat(2));
    const textMaskShape = [bsz, 1, textMask[0][0].length];
    const textMaskTensor = new ortModule.Tensor('float32', textMaskFlat, textMaskShape);

    // Duration 예측
    const dpOutputs = await this.dpOrt.run({
      text_ids: textIdsTensor,
      style_dp: style.dp,
      text_mask: textMaskTensor
    });
    const duration = Array.from(dpOutputs.duration.data as Float32Array);

    // Speed 적용
    for (let i = 0; i < duration.length; i++) {
      duration[i] /= speed;
    }

    // 텍스트 인코딩
    const textEncOutputs = await this.textEncOrt.run({
      text_ids: textIdsTensor,
      style_ttl: style.ttl,
      text_mask: textMaskTensor
    });
    const textEmb = textEncOutputs.text_emb;

    // Noisy latent 샘플링
    const { xt, latentMask } = this.sampleNoisyLatent(duration);

    const latentMaskFlat = new Float32Array(latentMask.flat(2));
    const latentMaskShape = [bsz, 1, latentMask[0][0].length];
    const latentMaskTensor = new ortModule.Tensor('float32', latentMaskFlat, latentMaskShape);

    const totalStepArray = new Float32Array(bsz).fill(totalStep);
    const totalStepTensor = new ortModule.Tensor('float32', totalStepArray, [bsz]);

    // Denoising 루프
    let currentXt = xt;
    for (let step = 0; step < totalStep; step++) {
      const currentStepArray = new Float32Array(bsz).fill(step);
      const currentStepTensor = new ortModule.Tensor('float32', currentStepArray, [bsz]);

      const xtFlat = new Float32Array(currentXt.flat(2));
      const xtShape = [bsz, currentXt[0].length, currentXt[0][0].length];
      const xtTensor = new ortModule.Tensor('float32', xtFlat, xtShape);

      const vectorEstOutputs = await this.vectorEstOrt.run({
        noisy_latent: xtTensor,
        text_emb: textEmb,
        style_ttl: style.ttl,
        latent_mask: latentMaskTensor,
        text_mask: textMaskTensor,
        current_step: currentStepTensor,
        total_step: totalStepTensor
      });

      const denoised = Array.from(vectorEstOutputs.denoised_latent.data as Float32Array);

      // 3D로 reshape
      const latentDim = currentXt[0].length;
      const latentLen = currentXt[0][0].length;
      currentXt = [];
      let idx = 0;
      for (let b = 0; b < bsz; b++) {
        const batch: number[][] = [];
        for (let d = 0; d < latentDim; d++) {
          const row: number[] = [];
          for (let t = 0; t < latentLen; t++) {
            row.push(denoised[idx++]);
          }
          batch.push(row);
        }
        currentXt.push(batch);
      }
    }

    // Waveform 생성
    const finalXtFlat = new Float32Array(currentXt.flat(2));
    const finalXtShape = [bsz, currentXt[0].length, currentXt[0][0].length];
    const finalXtTensor = new ortModule.Tensor('float32', finalXtFlat, finalXtShape);

    // Vocoder 입력 상태 확인
    const latentStats = {
      shape: finalXtShape,
      min: Math.min(...finalXtFlat),
      max: Math.max(...finalXtFlat),
      mean: finalXtFlat.reduce((a, b) => a + b, 0) / finalXtFlat.length
    };
    log('Vocoder input (latent):', latentStats);

    const vocoderOutputs = await this.vocoderOrt.run({
      latent: finalXtTensor
    });

    // Vocoder 출력 분석
    const wavOutput = vocoderOutputs.wav_tts;
    log('Vocoder output:', {
      dims: wavOutput.dims,
      type: wavOutput.type,
      dataLength: wavOutput.data.length
    });

    const wav = Array.from(wavOutput.data as Float32Array);
    log('Vocoder output length:', wav.length);

    // 오디오 통계 확인 (디버깅용)
    const maxAbs = Math.max(...wav.map(v => Math.abs(v)));
    log('Audio stats: maxAbs:', maxAbs.toFixed(4));

    return { wav, duration };
  }

  /**
   * Noisy latent 샘플링
   */
  private sampleNoisyLatent(duration: number[]): { xt: number[][][]; latentMask: number[][][] } {
    const bsz = duration.length;
    const maxDur = Math.max(...duration);

    const wavLenMax = Math.floor(maxDur * this.sampleRate);
    const wavLengths = duration.map(d => Math.floor(d * this.sampleRate));

    const chunkSize = this.cfgs!.ae.base_chunk_size * this.cfgs!.ttl.chunk_compress_factor;
    const latentLen = Math.floor((wavLenMax + chunkSize - 1) / chunkSize);
    const latentDimVal = this.cfgs!.ttl.latent_dim * this.cfgs!.ttl.chunk_compress_factor;

    const xt: number[][][] = [];
    for (let b = 0; b < bsz; b++) {
      const batch: number[][] = [];
      for (let d = 0; d < latentDimVal; d++) {
        const row: number[] = [];
        for (let t = 0; t < latentLen; t++) {
          // Box-Muller 변환
          const u1 = Math.max(0.0001, Math.random());
          const u2 = Math.random();
          const val = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
          row.push(val);
        }
        batch.push(row);
      }
      xt.push(batch);
    }

    const latentLengths = wavLengths.map(len => Math.floor((len + chunkSize - 1) / chunkSize));
    const latentMask = this.lengthToMask(latentLengths, latentLen);

    // 마스크 적용
    for (let b = 0; b < bsz; b++) {
      for (let d = 0; d < latentDimVal; d++) {
        for (let t = 0; t < latentLen; t++) {
          xt[b][d][t] *= latentMask[b][0][t];
        }
      }
    }

    return { xt, latentMask };
  }

  private lengthToMask(lengths: number[], maxLen?: number): number[][][] {
    const actualMaxLen = maxLen || Math.max(...lengths);
    return lengths.map(len => {
      const row = new Array(actualMaxLen).fill(0.0);
      for (let j = 0; j < Math.min(len, actualMaxLen); j++) {
        row[j] = 1.0;
      }
      return [row];
    });
  }

  /**
   * 언어 감지
   */
  private detectLanguage(text: string, defaultLang: 'ko' | 'en'): SupertonicLanguage {
    if (/[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/.test(text)) {
      return 'ko';
    }
    return AVAILABLE_LANGS.includes(defaultLang as SupertonicLanguage)
      ? (defaultLang as SupertonicLanguage)
      : 'en';
  }

  /**
   * WAV 파일 생성
   */
  private writeWavFile(audioData: number[], sampleRate: number): ArrayBuffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = audioData.length * 2;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    const int16Data = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      const clamped = Math.max(-1.0, Math.min(1.0, audioData[i]));
      int16Data[i] = Math.floor(clamped * 32767);
    }

    const dataView = new Uint8Array(buffer, 44);
    dataView.set(new Uint8Array(int16Data.buffer));

    return buffer;
  }

  /**
   * 사용 가능 여부 확인
   */
  async isAvailable(): Promise<boolean> {
    try {
      const modelPath = `${this.config.basePath}/onnx/tts.json`;
      const response = await fetch(modelPath, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 초기화 상태 확인
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 리소스 해제
   */
  async dispose(): Promise<void> {
    if (this.dpOrt) await this.dpOrt.release();
    if (this.textEncOrt) await this.textEncOrt.release();
    if (this.vectorEstOrt) await this.vectorEstOrt.release();
    if (this.vocoderOrt) await this.vocoderOrt.release();

    this.dpOrt = null;
    this.textEncOrt = null;
    this.vectorEstOrt = null;
    this.vocoderOrt = null;
    this.voiceStyles.clear();
    this.isInitialized = false;
    this.initPromise = null;
  }
}

// 싱글톤 인스턴스
let supertonicInstance: SupertonicClient | null = null;

export function getSupertonicClient(): SupertonicClient {
  if (!supertonicInstance) {
    supertonicInstance = new SupertonicClient();
  }
  return supertonicInstance;
}

export default SupertonicClient;
