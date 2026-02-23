export const DEFAULT_GLOBAL_SHORTCUT_ACCELERATOR = 'Command+Shift+Space';

type ShortcutModifier = 'Command' | 'Control' | 'Option' | 'Shift' | 'Super';

const MODIFIER_ORDER: ShortcutModifier[] = [
  'Command',
  'Control',
  'Option',
  'Shift',
  'Super',
];

const MODIFIER_ALIASES: Record<string, ShortcutModifier> = {
  cmd: 'Command',
  command: 'Command',
  meta: 'Command',
  control: 'Control',
  ctrl: 'Control',
  option: 'Option',
  alt: 'Option',
  shift: 'Shift',
  super: 'Super',
  win: 'Super',
  windows: 'Super',
};

function normalizeModifierToken(token: string): ShortcutModifier | null {
  const normalized = token.trim().toLowerCase();
  if (!normalized) return null;
  return MODIFIER_ALIASES[normalized] ?? null;
}

function normalizeShortcutKeyToken(token: string): string | null {
  if (token === ' ') return 'Space';

  const normalized = token.trim();
  if (!normalized) return null;

  const upper = normalized.toUpperCase();
  if (upper === 'SPACE' || upper === 'SPACEBAR') return 'Space';
  if (/^[A-Z]$/.test(upper)) return upper;
  if (/^[0-9]$/.test(upper)) return upper;
  if (/^F([1-9]|1[0-2])$/.test(upper)) return upper;

  return null;
}

interface ParsedShortcut {
  modifiers: ShortcutModifier[];
  key: string;
}

function parseShortcutAccelerator(input: string): ParsedShortcut | null {
  if (typeof input !== 'string') return null;
  const segments = input
    .split('+')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) return null;

  const modifierSet = new Set<ShortcutModifier>();
  let keyToken: string | null = null;

  for (const segment of segments) {
    const modifier = normalizeModifierToken(segment);
    if (modifier) {
      modifierSet.add(modifier);
      continue;
    }

    const key = normalizeShortcutKeyToken(segment);
    if (!key || keyToken) {
      return null;
    }
    keyToken = key;
  }

  if (!keyToken || modifierSet.size === 0) {
    return null;
  }

  const modifiers = MODIFIER_ORDER.filter((modifier) => modifierSet.has(modifier));
  return { modifiers, key: keyToken };
}

export function isValidGlobalShortcutAccelerator(input: string): boolean {
  return parseShortcutAccelerator(input) !== null;
}

export function normalizeGlobalShortcutAccelerator(input: unknown): string {
  if (typeof input !== 'string') {
    return DEFAULT_GLOBAL_SHORTCUT_ACCELERATOR;
  }

  const parsed = parseShortcutAccelerator(input);
  if (!parsed) {
    return DEFAULT_GLOBAL_SHORTCUT_ACCELERATOR;
  }

  return [...parsed.modifiers, parsed.key].join('+');
}

export function formatGlobalShortcutForDisplay(accelerator: string): string {
  const parsed = parseShortcutAccelerator(accelerator);
  if (!parsed) return accelerator;

  const displayModifier: Record<ShortcutModifier, string> = {
    Command: 'Cmd',
    Control: 'Ctrl',
    Option: 'Opt',
    Shift: 'Shift',
    Super: 'Super',
  };

  return [...parsed.modifiers.map((modifier) => displayModifier[modifier]), parsed.key].join('+');
}

export interface KeyboardShortcutEventLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

function isModifierKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  return normalized === 'meta'
    || normalized === 'control'
    || normalized === 'alt'
    || normalized === 'shift';
}

export function buildGlobalShortcutFromKeyboardEvent(
  event: KeyboardShortcutEventLike
): string | null {
  const modifiers: ShortcutModifier[] = [];
  if (event.metaKey) modifiers.push('Command');
  if (event.ctrlKey) modifiers.push('Control');
  if (event.altKey) modifiers.push('Option');
  if (event.shiftKey) modifiers.push('Shift');

  if (modifiers.length === 0 || isModifierKey(event.key)) {
    return null;
  }

  const key = normalizeShortcutKeyToken(event.key);
  if (!key) {
    return null;
  }

  const candidate = [...modifiers, key].join('+');
  return isValidGlobalShortcutAccelerator(candidate)
    ? normalizeGlobalShortcutAccelerator(candidate)
    : null;
}
