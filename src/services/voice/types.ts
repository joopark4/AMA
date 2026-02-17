export interface STTResult {
  text: string;
  confidence?: number;
  language?: string;
}

export interface STTClient {
  transcribe(audioData: ArrayBuffer): Promise<STTResult>;
  isAvailable(): Promise<boolean>;
}

export interface TTSResult {
  audioData: ArrayBuffer;
  duration?: number;
}

export interface TTSClient {
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;
  isAvailable(): Promise<boolean>;
}

export interface TTSOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
}

export interface VoiceActivityResult {
  isSpeaking: boolean;
  volume: number;
}
