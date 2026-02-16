import { describe, expect, it } from 'vitest';
import { parseVoiceCommand } from './voiceCommandParser';

describe('voiceCommandParser', () => {
  it('parses settings commands', () => {
    expect(parseVoiceCommand('설정 창 열어줘')?.type).toBe('open-settings');
    expect(parseVoiceCommand('close settings')?.type).toBe('close-settings');
  });

  it('parses microphone settings command', () => {
    expect(parseVoiceCommand('마이크 권한 설정 열어줘')?.type).toBe('open-microphone-settings');
  });

  it('parses conversation control commands', () => {
    expect(parseVoiceCommand('대화 기록 지워줘')?.type).toBe('clear-messages');
    expect(parseVoiceCommand('stop speaking')?.type).toBe('stop-speaking');
  });

  it('parses language switch commands', () => {
    expect(parseVoiceCommand('언어를 영어로 바꿔')?.type).toBe('set-language-en');
    expect(parseVoiceCommand('switch to korean')?.type).toBe('set-language-ko');
  });

  it('returns null for plain conversation text', () => {
    expect(parseVoiceCommand('오늘 날씨 어때?')).toBeNull();
  });
});

