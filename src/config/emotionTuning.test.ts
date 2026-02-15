import { describe, expect, it } from 'vitest';
import { emotionTuningGlobal, getEmotionTuning } from './emotionTuning';

describe('emotionTuning', () => {
  it('returns bounded profiles for each emotion', () => {
    const emotions = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'relaxed', 'thinking'] as const;

    for (const emotion of emotions) {
      const profile = getEmotionTuning(emotion);
      expect(profile.movementSpeedMultiplier).toBeGreaterThanOrEqual(0.5);
      expect(profile.movementSpeedMultiplier).toBeLessThanOrEqual(1.6);
      expect(profile.expressionIntensity).toBeGreaterThanOrEqual(0.2);
      expect(profile.expressionIntensity).toBeLessThanOrEqual(1);
      expect(profile.expressionHoldMs).toBeGreaterThanOrEqual(1000);
      expect(profile.expressionHoldMs).toBeLessThanOrEqual(7000);
      expect(profile.armSwingScale).toBeGreaterThanOrEqual(0.4);
      expect(profile.armSwingScale).toBeLessThanOrEqual(1.8);
      expect(profile.walkCadenceScale).toBeGreaterThanOrEqual(0.55);
      expect(profile.walkCadenceScale).toBeLessThanOrEqual(1.8);
      expect(profile.idleDampingStiffness).toBeGreaterThanOrEqual(6);
      expect(profile.idleDampingStiffness).toBeLessThanOrEqual(18);
      expect(profile.walkDampingStiffness).toBeGreaterThanOrEqual(8);
      expect(profile.walkDampingStiffness).toBeLessThanOrEqual(22);
    }
  });

  it('keeps global timing within safe range', () => {
    expect(emotionTuningGlobal.responseClearMs).toBeGreaterThanOrEqual(2000);
    expect(emotionTuningGlobal.happyDanceMs).toBeGreaterThanOrEqual(1000);
    expect(emotionTuningGlobal.idleNeutralDelayMs).toBeGreaterThanOrEqual(1000);
  });
});
