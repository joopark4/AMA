import { describe, expect, it } from 'vitest';
import {
  VAD_CATALOG,
  NEUTRAL_MOOD,
  emotionToVec,
  nearestEmotion,
  moodMagnitude,
  lerpMood,
  type MoodVec,
} from './vadCatalog';
import type { Emotion } from '../../stores/avatarStore';

const ALL_EMOTIONS: Emotion[] = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'surprised',
  'relaxed',
  'thinking',
];

describe('vadCatalog', () => {
  it('catalog has entry for every emotion within valid range', () => {
    for (const emotion of ALL_EMOTIONS) {
      const vec = VAD_CATALOG[emotion];
      expect(vec).toBeDefined();
      expect(vec.v).toBeGreaterThanOrEqual(-1);
      expect(vec.v).toBeLessThanOrEqual(1);
      expect(vec.a).toBeGreaterThanOrEqual(-1);
      expect(vec.a).toBeLessThanOrEqual(1);
      expect(vec.d).toBeGreaterThanOrEqual(-1);
      expect(vec.d).toBeLessThanOrEqual(1);
    }
  });

  it('emotionToVec returns a copy (not shared reference)', () => {
    const a = emotionToVec('happy');
    a.v = 0;
    expect(VAD_CATALOG.happy.v).not.toBe(0);
  });

  it('nearestEmotion recovers the catalog label exactly', () => {
    for (const emotion of ALL_EMOTIONS) {
      expect(nearestEmotion(VAD_CATALOG[emotion])).toBe(emotion);
    }
  });

  it('nearestEmotion returns neutral for origin', () => {
    expect(nearestEmotion(NEUTRAL_MOOD)).toBe('neutral');
  });

  it('moodMagnitude clamps to [0, 1]', () => {
    expect(moodMagnitude(NEUTRAL_MOOD)).toBe(0);
    expect(moodMagnitude({ v: 1, a: 1, d: 1 })).toBe(1);
    expect(moodMagnitude({ v: -0.6, a: -0.3, d: 0 })).toBeCloseTo(0.9, 5);
  });

  it('lerpMood with alpha=0 returns current unchanged', () => {
    const result = lerpMood({ v: 0.3, a: 0.2, d: 0.1 }, NEUTRAL_MOOD, 0);
    expect(result).toEqual({ v: 0.3, a: 0.2, d: 0.1 });
  });

  it('lerpMood with alpha=1 returns target', () => {
    const target: MoodVec = { v: 0.7, a: 0.5, d: 0.3 };
    const result = lerpMood(NEUTRAL_MOOD, target, 1);
    expect(result).toEqual(target);
  });

  it('lerpMood interpolates correctly at alpha=0.5', () => {
    const result = lerpMood({ v: 0, a: 0, d: 0 }, { v: 0.8, a: 0.4, d: 0.2 }, 0.5);
    expect(result.v).toBeCloseTo(0.4, 5);
    expect(result.a).toBeCloseTo(0.2, 5);
    expect(result.d).toBeCloseTo(0.1, 5);
  });

  it('sad → neutral transition passes through intermediate state (not instant)', () => {
    // 시작: sad에 가까운 상태
    let current: MoodVec = { ...VAD_CATALOG.sad };
    const target: MoodVec = NEUTRAL_MOOD;

    // alpha=0.35로 한 스텝 진행
    current = lerpMood(current, target, 0.35);

    // 한 번에 neutral에 도달하지 않음
    expect(current).not.toEqual(NEUTRAL_MOOD);
    // 여전히 sad 방향 (또는 그 인근 라벨) — 강도는 줄었지만 부정성 유지
    expect(current.v).toBeLessThan(0);
  });

  it('happy → sad transition gradually shifts over multiple turns', () => {
    let current: MoodVec = { ...VAD_CATALOG.happy };
    const target: MoodVec = VAD_CATALOG.sad;

    const trajectory: Emotion[] = [nearestEmotion(current)];
    for (let i = 0; i < 8; i++) {
      current = lerpMood(current, target, 0.35);
      trajectory.push(nearestEmotion(current));
    }

    // 시작은 happy, 끝은 sad
    expect(trajectory[0]).toBe('happy');
    expect(trajectory[trajectory.length - 1]).toBe('sad');
    // 중간에 neutral/thinking/relaxed 같은 중립 라벨을 최소 1회 경유
    const midLabels = trajectory.slice(1, -1);
    const hasIntermediate = midLabels.some(
      (e) => e === 'neutral' || e === 'thinking' || e === 'relaxed'
    );
    expect(hasIntermediate).toBe(true);
  });
});
