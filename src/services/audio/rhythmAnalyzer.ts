export interface BeatInfo {
  isBeat: boolean;
  energy: number; // 0-1, current audio energy
  bassEnergy: number; // 0-1, low frequency energy
  tempo: number; // estimated BPM
  phase: number; // 0-1, position in current beat cycle
}

export class RhythmAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;

  // Beat detection state
  private energyHistory: number[] = [];
  private beatTimes: number[] = [];
  private lastBeatTime: number = 0;
  private estimatedTempo: number = 120; // Default BPM
  private beatThreshold: number = 1.3; // Energy spike threshold

  // Configurable parameters
  private readonly FFT_SIZE = 256;
  private readonly HISTORY_SIZE = 43; // ~1 second at 60fps
  private readonly MIN_BEAT_INTERVAL = 200; // ms, prevents double triggers
  private readonly BASS_FREQ_RANGE = [20, 200]; // Hz

  constructor() {
    this.energyHistory = [];
    this.beatTimes = [];
  }

  /**
   * Connect to an audio element for analysis
   */
  connect(audioElement: HTMLAudioElement): boolean {
    try {
      // Create audio context if needed
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      // Create analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.FFT_SIZE;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect source
      this.sourceNode = this.audioContext.createMediaElementSource(audioElement);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      // Create data array
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;

      return true;
    } catch (error) {
      console.error('Failed to connect audio analyzer:', error);
      return false;
    }
  }

  /**
   * Disconnect from audio source
   */
  disconnect(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // Already disconnected
      }
      this.sourceNode = null;
    }
    this.analyser = null;
    this.energyHistory = [];
    this.beatTimes = [];
  }

  /**
   * Analyze current audio frame and return beat information
   */
  analyze(): BeatInfo {
    if (!this.analyser || !this.dataArray) {
      return {
        isBeat: false,
        energy: 0,
        bassEnergy: 0,
        tempo: this.estimatedTempo,
        phase: 0,
      };
    }

    // Get frequency data
    this.analyser.getByteFrequencyData(this.dataArray);

    // Calculate overall energy
    const energy = this.calculateEnergy(this.dataArray);

    // Calculate bass energy (low frequencies)
    const bassEnergy = this.calculateBassEnergy(this.dataArray);

    // Detect beat
    const isBeat = this.detectBeat(bassEnergy);

    // Calculate phase (position in beat cycle)
    const phase = this.calculatePhase();

    return {
      isBeat,
      energy: Math.min(1, energy),
      bassEnergy: Math.min(1, bassEnergy),
      tempo: this.estimatedTempo,
      phase,
    };
  }

  /**
   * Calculate overall audio energy
   */
  private calculateEnergy(data: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return sum / (data.length * 255);
  }

  /**
   * Calculate bass (low frequency) energy
   */
  private calculateBassEnergy(data: Uint8Array): number {
    if (!this.audioContext) return 0;

    const nyquist = this.audioContext.sampleRate / 2;
    const binWidth = nyquist / data.length;

    const startBin = Math.floor(this.BASS_FREQ_RANGE[0] / binWidth);
    const endBin = Math.min(Math.floor(this.BASS_FREQ_RANGE[1] / binWidth), data.length - 1);

    let sum = 0;
    let count = 0;
    for (let i = startBin; i <= endBin; i++) {
      sum += data[i];
      count++;
    }

    return count > 0 ? sum / (count * 255) : 0;
  }

  /**
   * Detect if current frame is a beat
   */
  private detectBeat(currentEnergy: number): boolean {
    // Add to history
    this.energyHistory.push(currentEnergy);
    if (this.energyHistory.length > this.HISTORY_SIZE) {
      this.energyHistory.shift();
    }

    // Need enough history
    if (this.energyHistory.length < 10) {
      return false;
    }

    // Calculate average energy
    const avgEnergy =
      this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;

    // Check for energy spike (beat)
    const now = performance.now();
    const timeSinceLastBeat = now - this.lastBeatTime;

    if (
      currentEnergy > avgEnergy * this.beatThreshold &&
      timeSinceLastBeat > this.MIN_BEAT_INTERVAL
    ) {
      this.lastBeatTime = now;
      this.beatTimes.push(now);

      // Keep only recent beat times for tempo estimation
      const cutoff = now - 5000; // Last 5 seconds
      this.beatTimes = this.beatTimes.filter((t) => t > cutoff);

      // Update tempo estimate
      this.updateTempoEstimate();

      return true;
    }

    return false;
  }

  /**
   * Update estimated tempo based on beat history
   */
  private updateTempoEstimate(): void {
    if (this.beatTimes.length < 4) return;

    // Calculate intervals between beats
    const intervals: number[] = [];
    for (let i = 1; i < this.beatTimes.length; i++) {
      intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
    }

    // Get median interval (more robust than average)
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];

    // Convert to BPM
    if (medianInterval > 0) {
      const bpm = 60000 / medianInterval;
      // Clamp to reasonable range
      this.estimatedTempo = Math.max(60, Math.min(200, bpm));
    }
  }

  /**
   * Calculate current position in beat cycle (0-1)
   */
  private calculatePhase(): number {
    if (this.estimatedTempo <= 0) return 0;

    const beatDuration = 60000 / this.estimatedTempo; // ms per beat
    const now = performance.now();
    const timeSinceLastBeat = now - this.lastBeatTime;

    return Math.min(1, timeSinceLastBeat / beatDuration);
  }

  /**
   * Create a simulated beat pattern when no audio is playing
   * Useful for testing or idle dancing
   */
  simulateBeat(bpm: number = 120): BeatInfo {
    const beatDuration = 60000 / bpm;
    const now = performance.now();
    const phase = (now % beatDuration) / beatDuration;
    const isBeat = phase < 0.05 && now - this.lastBeatTime > beatDuration * 0.9;

    if (isBeat) {
      this.lastBeatTime = now;
    }

    // Simulate energy based on phase
    const energy = Math.pow(Math.cos(phase * Math.PI * 2), 2) * 0.5 + 0.3;
    const bassEnergy = isBeat ? 0.9 : energy * 0.8;

    return {
      isBeat,
      energy,
      bassEnergy,
      tempo: bpm,
      phase,
    };
  }

  /**
   * Get current audio context state
   */
  get isConnected(): boolean {
    return this.analyser !== null && this.sourceNode !== null;
  }

  /**
   * Get current tempo
   */
  get currentTempo(): number {
    return this.estimatedTempo;
  }
}

// Singleton instance
let rhythmAnalyzerInstance: RhythmAnalyzer | null = null;

export function getRhythmAnalyzer(): RhythmAnalyzer {
  if (!rhythmAnalyzerInstance) {
    rhythmAnalyzerInstance = new RhythmAnalyzer();
  }
  return rhythmAnalyzerInstance;
}
