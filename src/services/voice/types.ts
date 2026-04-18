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
  emotion?: string;    // 대화 감정 정보 (happy, sad 등)
  style?: string;      // Supertone 스타일 직접 지정
  onPlaybackStart?: () => void;  // 오디오 재생 시작 시 호출 (말풍선 동기화용)
}

export interface VoiceActivityResult {
  isSpeaking: boolean;
  volume: number;
}
