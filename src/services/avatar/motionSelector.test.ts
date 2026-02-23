import { describe, expect, it } from 'vitest';
import { getMotionManifest } from './motionLibrary';
import { selectMotionClip } from './motionSelector';
import type { Emotion } from '../../stores/avatarStore';

const EMOTIONS: Emotion[] = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'surprised',
  'relaxed',
  'thinking',
];

describe('motionSelector', () => {
  it('returns only allowed emotion tags for each emotion', () => {
    const clips = getMotionManifest();

    for (const emotion of EMOTIONS) {
      const result = selectMotionClip(
        {
          emotion,
          emotionScore: 2,
          isSpeaking: false,
          isMoving: false,
          diversityStrength: 1,
          recentMotionIds: [],
          cooldownMap: {},
          now: 0,
        },
        clips,
        () => 0.01
      );

      expect(result.selected).not.toBeNull();
      expect(
        result.selected!.emotion_tags.includes(emotion) ||
          result.selected!.emotion_tags.includes('bridge')
      ).toBe(true);
    }
  });

  it('suppresses long same-clip streaks with recent-history penalty', () => {
    const clips = getMotionManifest();
    const recent: string[] = [];
    let previous: string | null = null;
    let streak = 0;
    let maxStreak = 0;

    for (let i = 0; i < 20; i++) {
      const result = selectMotionClip(
        {
          emotion: 'happy',
          emotionScore: 3,
          isSpeaking: false,
          isMoving: false,
          diversityStrength: 1,
          recentMotionIds: [...recent],
          cooldownMap: {},
          now: i * 1000,
        },
        clips,
        () => 0.01
      );

      expect(result.selected).not.toBeNull();
      const id = result.selected!.id;

      if (id === previous) {
        streak += 1;
      } else {
        streak = 1;
      }

      maxStreak = Math.max(maxStreak, streak);
      previous = id;

      recent.unshift(id);
      while (recent.length > 12) recent.pop();
    }

    expect(maxStreak).toBeLessThanOrEqual(2);
  });

  it('allows recent clips when diversityStrength is disabled', () => {
    const source = [
      {
        id: 'motion_happy_recent',
        emotion_tags: ['happy'],
        intensity: 'mid',
        duration_ms: 1200,
        loopable: false,
        speaking_compatible: true,
        priority: 5,
        cooldown_ms: 1000,
        file: 'motions/clips/motion_happy_recent.json',
        license_class: 'mixamo-standard',
        source_url: 'https://www.mixamo.com',
        attribution_required: false,
        redistribution_note: 'n/a',
      },
      {
        id: 'motion_happy_other',
        emotion_tags: ['happy'],
        intensity: 'mid',
        duration_ms: 1200,
        loopable: false,
        speaking_compatible: true,
        priority: 1,
        cooldown_ms: 1000,
        file: 'motions/clips/motion_happy_other.json',
        license_class: 'mixamo-standard',
        source_url: 'https://www.mixamo.com',
        attribution_required: false,
        redistribution_note: 'n/a',
      },
    ] as const;

    const result = selectMotionClip(
      {
        emotion: 'happy',
        emotionScore: 2,
        isSpeaking: false,
        isMoving: false,
        diversityStrength: 0,
        recentMotionIds: ['motion_happy_recent'],
        cooldownMap: {},
        now: 0,
      },
      [...source],
      () => 0.01
    );

    expect(result.selected).not.toBeNull();
    expect(result.selected!.id).toBe('motion_happy_recent');
  });

  it('keeps same-input 20-turn streak>=3 frequency under 5%', () => {
    const clips = getMotionManifest();

    function seededRng(seed: number): () => number {
      let t = seed >>> 0;
      return () => {
        t += 0x6D2B79F5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
      };
    }

    const trials = 200;
    let streak3OrMoreCount = 0;

    for (let trial = 0; trial < trials; trial++) {
      const recent: string[] = [];
      const cooldownMap: Record<string, number> = {};
      const rng = seededRng(trial + 1);

      let now = 0;
      let previous: string | null = null;
      let streak = 0;
      let hasTriple = false;

      for (let turn = 0; turn < 20; turn++) {
        const result = selectMotionClip(
          {
            emotion: 'happy',
            emotionScore: 3,
            isSpeaking: false,
            isMoving: false,
            diversityStrength: 1,
            recentMotionIds: [...recent],
            cooldownMap: { ...cooldownMap },
            now,
          },
          clips,
          rng
        );

        expect(result.selected).not.toBeNull();
        const id = result.selected!.id;

        if (id === previous) {
          streak += 1;
        } else {
          streak = 1;
        }
        if (streak >= 3) hasTriple = true;

        previous = id;
        recent.unshift(id);
        while (recent.length > 12) recent.pop();

        cooldownMap[id] = now + result.selected!.cooldown_ms;
        now += 1000;
        for (const [key, until] of Object.entries(cooldownMap)) {
          if (until <= now) delete cooldownMap[key];
        }
      }

      if (hasTriple) streak3OrMoreCount += 1;
    }

    const frequencyPercent = (streak3OrMoreCount / trials) * 100;
    expect(frequencyPercent).toBeLessThan(5);
  });

  it('honors speaking + moving constraints', () => {
    const clips = getMotionManifest();

    const result = selectMotionClip(
      {
        emotion: 'thinking',
        emotionScore: 2,
        isSpeaking: true,
        isMoving: true,
        diversityStrength: 1,
        recentMotionIds: [],
        cooldownMap: {},
        now: Date.now(),
      },
      clips,
      () => 0.2
    );

    expect(result.selected).not.toBeNull();
    expect(result.selected!.speaking_compatible).toBe(true);
    expect(result.selected!.loopable).toBe(false);
  });

  it('biases toward high-intensity clips when dynamic boost is enabled', () => {
    const clips = getMotionManifest();

    function seededRng(seed: number): () => number {
      let t = seed >>> 0;
      return () => {
        t += 0x6D2B79F5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
      };
    }

    const trials = 800;
    let baseHigh = 0;
    let boostedHigh = 0;

    for (let i = 0; i < trials; i++) {
      const base = selectMotionClip(
        {
          emotion: 'happy',
          emotionScore: 2,
          isSpeaking: false,
          isMoving: false,
          diversityStrength: 0,
          dynamicBoost: 0,
          recentMotionIds: [],
          cooldownMap: {},
          now: i * 1000,
        },
        clips,
        seededRng(i + 11)
      );
      const boosted = selectMotionClip(
        {
          emotion: 'happy',
          emotionScore: 2,
          isSpeaking: false,
          isMoving: false,
          diversityStrength: 0,
          dynamicBoost: 1.2,
          recentMotionIds: [],
          cooldownMap: {},
          now: i * 1000,
        },
        clips,
        seededRng(i + 11)
      );

      expect(base.selected).not.toBeNull();
      expect(boosted.selected).not.toBeNull();

      if (base.selected?.intensity === 'high') baseHigh += 1;
      if (boosted.selected?.intensity === 'high') boostedHigh += 1;
    }

    expect(boostedHigh / trials).toBeGreaterThan(baseHigh / trials + 0.08);
  });
});
