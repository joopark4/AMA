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
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingResolve: ((data: ArrayBuffer) => void) | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new AudioContext();
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

  // Get lip sync value from audio analysis
  getLipSyncValue(): number {
    const analysis = this.analyze();

    if (!analysis.isSpeaking) {
      return 0;
    }

    // Map volume to lip opening (0-1)
    return Math.min(1, analysis.volume * 3);
  }

  // Record audio for a duration
  async recordAudio(durationMs: number): Promise<ArrayBuffer> {
    if (!this.mediaStream) {
      throw new Error('Audio processor not initialized');
    }

    return new Promise((resolve, reject) => {
      const mediaRecorder = new MediaRecorder(this.mediaStream!, {
        mimeType: 'audio/webm',
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        resolve(arrayBuffer);
      };

      mediaRecorder.onerror = (event) => {
        reject(new Error(`Recording error: ${event}`));
      };

      mediaRecorder.start();

      setTimeout(() => {
        mediaRecorder.stop();
      }, durationMs);
    });
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
    if (!this.mediaStream) {
      await this.initialize();
    }

    if (!this.mediaStream) {
      throw new Error('Failed to initialize media stream');
    }

    this.recordedChunks = [];

    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
      mimeType: 'audio/webm',
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = async () => {
      const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      if (this.recordingResolve) {
        this.recordingResolve(arrayBuffer);
        this.recordingResolve = null;
      }
    };

    this.mediaRecorder.start(100); // Collect data every 100ms
  }

  // Stop manual recording and return the audio data
  async stopRecording(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('No active recording'));
        return;
      }

      this.recordingResolve = resolve;
      this.mediaRecorder.stop();
    });
  }

  // Check if currently recording
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  dispose(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.isInitialized = false;
  }
}

export const audioProcessor = new AudioProcessor();
export default audioProcessor;
