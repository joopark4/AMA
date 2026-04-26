import { describe, expect, it } from 'vitest';
import { computeUrgency, urgencyToCooldownMs } from './proactiveEngine';

describe('computeUrgency', () => {
  it('returns 0 for completely idle-baseline with no signals', () => {
    const u = computeUrgency({
      idleSec: 0,
      idleThresholdSec: 300,
      returnedFromAway: false,
      crossedIdle: false,
      isFirstProactive: false,
      moodIntensity: 0,
    });
    expect(u).toBe(0);
  });

  it('spikes when idle boundary crossed', () => {
    const u = computeUrgency({
      idleSec: 300,
      idleThresholdSec: 300,
      returnedFromAway: false,
      crossedIdle: true,
      isFirstProactive: false,
      moodIntensity: 0,
    });
    expect(u).toBeCloseTo(0.5, 5);
  });

  it('combines returnedFromAway + firstProactive', () => {
    const u = computeUrgency({
      idleSec: 0,
      idleThresholdSec: 300,
      returnedFromAway: true,
      crossedIdle: false,
      isFirstProactive: true,
      moodIntensity: 0,
    });
    // 0.35 (return) + 0.2 (first)
    expect(u).toBeCloseTo(0.55, 5);
  });

  it('adds mood intensity contribution', () => {
    const u = computeUrgency({
      idleSec: 0,
      idleThresholdSec: 300,
      returnedFromAway: false,
      crossedIdle: false,
      isFirstProactive: false,
      moodIntensity: 1.0,
    });
    expect(u).toBeCloseTo(0.15, 5);
  });

  it('clamps to 1 for all signals maxed', () => {
    const u = computeUrgency({
      idleSec: 600,
      idleThresholdSec: 300,
      returnedFromAway: true,
      crossedIdle: true,
      isFirstProactive: true,
      moodIntensity: 1.0,
    });
    expect(u).toBe(1);
  });

  it('idle ratio contribution scales sub-threshold', () => {
    const u = computeUrgency({
      idleSec: 150,
      idleThresholdSec: 300,
      returnedFromAway: false,
      crossedIdle: false,
      isFirstProactive: false,
      moodIntensity: 0,
    });
    // 0.5 ratio * 0.3 = 0.15
    expect(u).toBeCloseTo(0.15, 5);
  });
});

describe('urgencyToCooldownMs', () => {
  it('high urgency (>=0.9) returns 2 minutes', () => {
    expect(urgencyToCooldownMs(0.9, 10)).toBe(2 * 60_000);
    expect(urgencyToCooldownMs(1.0, 10)).toBe(2 * 60_000);
  });

  it('mid urgency (0.5..0.9) caps at base cooldown up to 10 min', () => {
    expect(urgencyToCooldownMs(0.6, 5)).toBe(5 * 60_000);
    expect(urgencyToCooldownMs(0.6, 20)).toBe(10 * 60_000);
  });

  it('low urgency (<0.5) uses max of base or 30 min', () => {
    expect(urgencyToCooldownMs(0.3, 10)).toBe(30 * 60_000);
    expect(urgencyToCooldownMs(0.3, 45)).toBe(45 * 60_000);
  });

  it('boundary values behave monotonically', () => {
    const c1 = urgencyToCooldownMs(0.95, 10);
    const c2 = urgencyToCooldownMs(0.7, 10);
    const c3 = urgencyToCooldownMs(0.2, 10);
    expect(c1).toBeLessThan(c2);
    expect(c2).toBeLessThan(c3);
  });
});
