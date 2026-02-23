import { describe, expect, it, vi } from 'vitest';
import manifestJson from '../../config/motionManifest.json';
import {
  clearMotionClipCache,
  loadMotionClipData,
  getMotionManifest,
  validateMotionClipData,
  validateMotionManifest,
} from './motionLibrary';
import type { MotionClipData, MotionClipMeta } from '../../types/motion';

describe('motionLibrary', () => {
  it('loads a manifest with at least 24 clips and required license metadata', () => {
    const clips = getMotionManifest();
    expect(clips.length).toBeGreaterThanOrEqual(24);

    for (const clip of clips) {
      expect(clip.license_class.trim().length).toBeGreaterThan(0);
      expect(clip.source_url.trim().length).toBeGreaterThan(0);
    }
  });

  it('passes manifest validation', () => {
    const errors = validateMotionManifest(manifestJson as any);
    expect(errors).toEqual([]);
  });

  it('rejects clip data with extreme rotations', () => {
    const fakeMeta: MotionClipMeta = {
      id: 'test_extreme',
      emotion_tags: ['happy'],
      intensity: 'high',
      duration_ms: 1000,
      loopable: false,
      speaking_compatible: false,
      priority: 3,
      cooldown_ms: 1000,
      file: 'motions/clips/test_extreme.json',
      license_class: 'mixamo-standard',
      source_url: 'https://www.mixamo.com',
      attribution_required: false,
      redistribution_note: 'test',
      fallback_gesture: 'celebrate',
    };

    const fakeData: MotionClipData = {
      version: 1,
      fps: 30,
      duration_ms: 1000,
      blend_in_ms: 120,
      blend_out_ms: 160,
      keyframes: [
        { bone: 'head', time: 0, rotation: { x: 0 } },
        { bone: 'head', time: 1, rotation: { x: Math.PI } },
      ],
    };

    const errors = validateMotionClipData(fakeMeta, fakeData);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('returns null when motion clip fetch fails (fallback trigger path)', async () => {
    const clip = getMotionManifest()[0];
    expect(clip).toBeDefined();

    const originalFetch = globalThis.fetch;
    const mockedFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = mockedFetch as unknown as typeof fetch;

    try {
      clearMotionClipCache();
      const loaded = await loadMotionClipData(clip!);
      expect(loaded).toBeNull();
      expect(mockedFetch).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      clearMotionClipCache();
    }
  });
});
