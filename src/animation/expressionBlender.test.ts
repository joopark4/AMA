import { describe, expect, it } from 'vitest';
import { findExpressionName, getExpressionForEmotion } from './expressionBlender';

describe('expressionBlender', () => {
  it('maps canonical expression names to model-specific names', () => {
    const available = ['Happy', 'Blink', 'Aa'];
    expect(findExpressionName('happy', available)).toBe('Happy');
    expect(findExpressionName('blink', available)).toBe('Blink');
    expect(findExpressionName('aa', available)).toBe('Aa');
  });

  it('returns emotion presets', () => {
    const happy = getExpressionForEmotion('happy');
    const neutral = getExpressionForEmotion('neutral');

    expect((happy.happy ?? 0) > 0).toBe(true);
    expect((neutral.relaxed ?? 0) > 0).toBe(true);
  });
});
