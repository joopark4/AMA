import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GLOBAL_SHORTCUT_ACCELERATOR,
  buildGlobalShortcutFromKeyboardEvent,
  formatGlobalShortcutForDisplay,
  isValidGlobalShortcutAccelerator,
  normalizeGlobalShortcutAccelerator,
} from './globalShortcutUtils';

describe('globalShortcutUtils', () => {
  it('normalizes invalid shortcuts to default', () => {
    expect(normalizeGlobalShortcutAccelerator('Space')).toBe(DEFAULT_GLOBAL_SHORTCUT_ACCELERATOR);
    expect(normalizeGlobalShortcutAccelerator('Ctrl+Alt')).toBe(DEFAULT_GLOBAL_SHORTCUT_ACCELERATOR);
  });

  it('validates and normalizes canonical shortcuts', () => {
    expect(isValidGlobalShortcutAccelerator('Command+Shift+Space')).toBe(true);
    expect(normalizeGlobalShortcutAccelerator('cmd+shift+space')).toBe('Command+Shift+Space');
  });

  it('builds shortcut from keyboard event-like objects', () => {
    const built = buildGlobalShortcutFromKeyboardEvent({
      key: ' ',
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: true,
    });
    expect(built).toBe('Command+Shift+Space');
  });

  it('formats shortcut for display', () => {
    expect(formatGlobalShortcutForDisplay('Command+Shift+Space')).toBe('Cmd+Shift+Space');
  });
});
