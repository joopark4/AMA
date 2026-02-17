import { describe, expect, it } from 'vitest';
import { findGestureFromEmotion, findGestureFromText } from './gestureDefinitions';

describe('gestureDefinitions', () => {
  it('detects gestures from text keywords', () => {
    expect(findGestureFromText('안녕 반가워')).toBe('wave');
    expect(findGestureFromText('응 좋아 알겠어')).toBe('nod');
  });

  it('detects gestures from emotion', () => {
    expect(findGestureFromEmotion('thinking')).toBe('thinking');
    expect(findGestureFromEmotion('neutral')).toBeNull();
  });
});
