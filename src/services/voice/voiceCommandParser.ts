export type VoiceCommandType =
  | 'open-settings'
  | 'close-settings'
  | 'open-microphone-settings'
  | 'clear-messages'
  | 'stop-speaking'
  | 'set-language-ko'
  | 'set-language-en'
  | 'show-help';

export interface VoiceCommand {
  type: VoiceCommandType;
}

type VoiceCommandPattern = {
  type: VoiceCommandType;
  patterns: RegExp[];
};

const COMMAND_PATTERNS: VoiceCommandPattern[] = [
  {
    type: 'open-microphone-settings',
    patterns: [
      /(마이크|microphone).*(설정|settings?).*(열어|열기|open|show)/i,
      /(열어|열기|open|show).*(마이크|microphone).*(설정|settings?)/i,
      /(마이크|microphone).*(권한|permission).*(열어|open|show)/i,
    ],
  },
  {
    type: 'open-settings',
    patterns: [
      /(설정|세팅)(\s*(창|패널))?\s*(열어|열기|열어줘|켜|켜줘|보여줘)/i,
      /(열어|열기|열어줘|켜|켜줘|보여줘)\s*(설정|세팅)(\s*(창|패널))?/i,
      /\b(open|show|launch)\b.*\bsettings?\b/i,
      /\bsettings?\b.*\b(open|show|launch)\b/i,
    ],
  },
  {
    type: 'close-settings',
    patterns: [
      /(설정|세팅)(\s*(창|패널))?\s*(닫아|닫기|꺼|숨겨)/i,
      /(닫아|닫기|꺼|숨겨)\s*(설정|세팅)(\s*(창|패널))?/i,
      /\b(close|hide)\b.*\bsettings?\b/i,
      /\bsettings?\b.*\b(close|hide)\b/i,
    ],
  },
  {
    type: 'clear-messages',
    patterns: [
      /(대화|채팅|메시지|기록).*(지워|삭제|초기화|비워)/i,
      /(지워|삭제|초기화|비워).*(대화|채팅|메시지|기록)/i,
      /\b(clear|delete|reset)\b.*\b(chat|messages?|conversation|history)\b/i,
    ],
  },
  {
    type: 'stop-speaking',
    patterns: [
      /(말|음성).*(그만|멈춰|중지|꺼)/i,
      /(그만|멈춰|중지).*(말|음성)/i,
      /조용히/i,
      /\b(stop|mute)\b.*\b(speaking|talking|voice|audio)\b/i,
      /\bbe quiet\b/i,
    ],
  },
  {
    type: 'set-language-ko',
    patterns: [
      /(한국어|korean).*(바꿔|변경|전환|설정|switch|change|set)/i,
      /(바꿔|변경|전환|설정|switch|change|set).*(한국어|korean)/i,
      /한국어로(\s*(해줘|바꿔|전환|설정))?/i,
      /\bin korean\b/i,
    ],
  },
  {
    type: 'set-language-en',
    patterns: [
      /(영어|english).*(바꿔|변경|전환|설정|switch|change|set)/i,
      /(바꿔|변경|전환|설정|switch|change|set).*(영어|english)/i,
      /영어로(\s*(해줘|바꿔|전환|설정))?/i,
      /\bin english\b/i,
    ],
  },
  {
    type: 'show-help',
    patterns: [
      /(음성\s*명령|명령어).*(도움|목록|알려)/i,
      /(voice\s*commands?).*(help|list|show)/i,
      /\b(voice\s*command|commands?)\s+help\b/i,
    ],
  },
];

function isMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function parseVoiceCommand(text: string): VoiceCommand | null {
  const normalized = text.trim();
  if (!normalized) return null;

  for (const command of COMMAND_PATTERNS) {
    if (isMatch(normalized, command.patterns)) {
      return { type: command.type };
    }
  }

  return null;
}

