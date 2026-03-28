import { getSharedAudioContext } from '../audio/sharedAudioContext';

export interface AudioAnalysis {
  volume: number;
  frequency: number;
  isSpeaking: boolean;
}

export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isInitialized = false;

  // Manual recording state
  private isManualRecording = false;
  private recordedPcmChunks: Float32Array[] = [];
  private recordingProcessor: ScriptProcessorNode | null = null;
  private silentGain: GainNode | null = null;
  private readonly targetSampleRate = 16000;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = getSharedAudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.source.connect(this.analyser);

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize audio processor:', error);
      throw error;
    }
  }

  analyze(): AudioAnalysis {
    if (!this.analyser) {
      return { volume: 0, frequency: 0, isSpeaking: false };
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate volume (RMS)
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const volume = Math.sqrt(sum / dataArray.length) / 255;

    // Find dominant frequency
    let maxIndex = 0;
    let maxValue = 0;
    for (let i = 0; i < dataArray.length; i++) {
      if (dataArray[i] > maxValue) {
        maxValue = dataArray[i];
        maxIndex = i;
      }
    }
    const frequency = (maxIndex * (this.audioContext?.sampleRate || 44100)) /
      (this.analyser.fftSize * 2);

    // Voice activity detection (simple threshold)
    const isSpeaking = volume > 0.05;

    return { volume, frequency, isSpeaking };
  }

  getWaveformData(sampleCount: number = 64): Float32Array {
    const normalizedSampleCount = Number.isFinite(sampleCount) && sampleCount > 0
      ? Math.floor(sampleCount)
      : 64;
    const waveform = new Float32Array(normalizedSampleCount);

    if (!this.analyser) {
      return waveform;
    }

    const timeDomainData = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(timeDomainData);

    const step = timeDomainData.length / normalizedSampleCount;
    for (let i = 0; i < normalizedSampleCount; i++) {
      const sourceIndex = Math.min(
        timeDomainData.length - 1,
        Math.floor(i * step)
      );
      const value = (timeDomainData[sourceIndex] - 128) / 128;
      waveform[i] = Math.max(-1, Math.min(1, value));
    }

    return waveform;
  }

  // Get lip sync value from audio analysis
  getLipSyncValue(): number {
    const analysis = this.analyze();

    if (!analysis.isSpeaking) {
      return 0;
    }

    // Map volume to lip opening (0-1)
    return Math.min(1, analysis.volume * 3);
  }

  private concatenateChunks(chunks: Float32Array[]): Float32Array {
    if (chunks.length === 0) {
      return new Float32Array(0);
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return merged;
  }

  private resampleLinearPcm(
    input: Float32Array,
    sourceSampleRate: number,
    targetSampleRate: number
  ): Float32Array {
    if (input.length === 0 || sourceSampleRate === targetSampleRate) {
      return input;
    }

    const ratio = sourceSampleRate / targetSampleRate;
    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * ratio;
      const index0 = Math.floor(sourceIndex);
      const index1 = Math.min(index0 + 1, input.length - 1);
      const weight = sourceIndex - index0;
      output[i] = input[index0] + (input[index1] - input[index0]) * weight;
    }

    return output;
  }

  private encodeWavPcm16Mono(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const bytesPerSample = 2;
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
    view.setUint16(32, bytesPerSample, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }

    return buffer;
  }

  private teardownRecordingGraph(): void {
    if (this.recordingProcessor) {
      this.recordingProcessor.onaudioprocess = null;
      this.recordingProcessor.disconnect();
      this.recordingProcessor = null;
    }

    if (this.silentGain) {
      this.silentGain.disconnect();
      this.silentGain = null;
    }
  }

  // Record audio for a duration
  async recordAudio(durationMs: number): Promise<ArrayBuffer> {
    await this.startRecording();
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    return this.stopRecording();
  }

  // Start continuous recording with callback
  startContinuousRecording(
    onData: (data: ArrayBuffer) => void,
    intervalMs: number = 1000
  ): () => void {
    if (!this.mediaStream) {
      throw new Error('Audio processor not initialized');
    }

    let isRecording = true;

    const record = async () => {
      while (isRecording) {
        try {
          const data = await this.recordAudio(intervalMs);
          onData(data);
        } catch (error) {
          console.error('Recording error:', error);
        }
      }
    };

    record();

    // Return stop function
    return () => {
      isRecording = false;
    };
  }

  // Start manual recording - call stopRecording() to get the audio data
  async startRecording(): Promise<void> {
    if (this.isManualRecording) {
      return;
    }

    if (!this.mediaStream || !this.audioContext || !this.source) {
      await this.initialize();
    }

    if (!this.mediaStream || !this.audioContext || !this.source) {
      throw new Error('Failed to initialize media stream');
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.teardownRecordingGraph();
    this.recordedPcmChunks = [];
    this.isManualRecording = true;

    this.recordingProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.silentGain = this.audioContext.createGain();
    this.silentGain.gain.value = 0;

    this.recordingProcessor.onaudioprocess = (event) => {
      if (!this.isManualRecording) return;
      const input = event.inputBuffer.getChannelData(0);
      this.recordedPcmChunks.push(new Float32Array(input));
    };

    this.source.connect(this.recordingProcessor);
    this.recordingProcessor.connect(this.silentGain);
    this.silentGain.connect(this.audioContext.destination);
  }

  // Stop manual recording and return the audio data
  async stopRecording(): Promise<ArrayBuffer> {
    if (!this.isManualRecording) {
      throw new Error('No active recording');
    }

    this.isManualRecording = false;
    this.teardownRecordingGraph();

    const merged = this.concatenateChunks(this.recordedPcmChunks);
    this.recordedPcmChunks = [];

    if (merged.length === 0) {
      throw new Error('Recorded audio is empty');
    }

    const sourceSampleRate = this.audioContext?.sampleRate || this.targetSampleRate;
    const resampled = this.resampleLinearPcm(
      merged,
      sourceSampleRate,
      this.targetSampleRate
    );

    return this.encodeWavPcm16Mono(resampled, this.targetSampleRate);
  }

  // Check if currently recording
  isRecording(): boolean {
    return this.isManualRecording;
  }

  dispose(): void {
    this.isManualRecording = false;
    this.teardownRecordingGraph();
    this.recordedPcmChunks = [];

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // 공유 AudioContext는 close하지 않음 — 다른 모듈이 사용 중일 수 있음
    this.audioContext = null;

    this.analyser = null;
    this.isInitialized = false;
  }
}

export const audioProcessor = new AudioProcessor();
export default audioProcessor;
