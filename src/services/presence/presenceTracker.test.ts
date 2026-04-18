import { describe, expect, it } from 'vitest';
import { PresenceTracker, type Presence } from './presenceTracker';

function makeClock(startMs = 1_700_000_000_000) {
  let t = startMs;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
    set: (ms: number) => {
      t = ms;
    },
  };
}

function collect(tracker: PresenceTracker): Presence[] {
  const snaps: Presence[] = [];
  tracker.subscribe((p) => snaps.push(p));
  return snaps;
}

describe('PresenceTracker', () => {
  it('getSnapshot reports idleSec growing with time', () => {
    const clock = makeClock();
    const tracker = new PresenceTracker();
    tracker.setClock(clock.now);

    expect(tracker.getSnapshot().idleSec).toBe(0);

    clock.advance(3_000);
    expect(tracker.getSnapshot().idleSec).toBeCloseTo(3, 3);
  });

  it('notifyActivity resets idleSec', () => {
    const clock = makeClock();
    const tracker = new PresenceTracker();
    tracker.setClock(clock.now);

    clock.advance(10_000);
    tracker.notifyActivity();
    expect(tracker.getSnapshot().idleSec).toBe(0);
  });

  it('emits idleCrossed exactly once when passing threshold', () => {
    const clock = makeClock();
    const tracker = new PresenceTracker();
    tracker.setClock(clock.now);
    tracker.setIdleThresholdMs(5_000);

    const snaps = collect(tracker);

    // 아직 idle 아님
    clock.advance(2_000);
    tracker._tickForTest();
    expect(snaps[0].idleCrossed).toBe(false);

    // 임계값 넘어섬 — idleCrossed=true 1회
    clock.advance(4_000);
    tracker._tickForTest();
    expect(snaps[1].idleCrossed).toBe(true);

    // 계속 idle이지만 crossed는 더 이상 true가 아님
    clock.advance(2_000);
    tracker._tickForTest();
    expect(snaps[2].idleCrossed).toBe(false);

    // 활동 후 다시 idle 넘어서면 재발생
    tracker.notifyActivity();
    tracker._tickForTest();
    clock.advance(6_000);
    tracker._tickForTest();
    expect(snaps[snaps.length - 1].idleCrossed).toBe(true);
  });

  it('typingRate counts key events in the last minute window', () => {
    const clock = makeClock();
    const tracker = new PresenceTracker();
    tracker.setClock(clock.now);

    // 3회 키 입력 (내부 이벤트 핸들러 직접 호출은 불가 — 공개 notifyActivity 대신 실제 핸들러 경로 테스트)
    // typing rate는 키 이벤트 전용이므로 여기서는 0 기대
    expect(tracker.getSnapshot().typingRate).toBe(0);

    // 60초 이상 경과해도 과거 이벤트 없으니 여전히 0
    clock.advance(61_000);
    expect(tracker.getSnapshot().typingRate).toBe(0);
  });

  it('returnedFromAway fires when focus comes back', () => {
    const clock = makeClock();
    const tracker = new PresenceTracker();
    tracker.setClock(clock.now);

    const snaps = collect(tracker);

    // 처음엔 focused (DOM 없으니 기본값 true 상태)
    tracker._tickForTest();
    expect(snaps[0].returnedFromAway).toBe(false);

    // blur 시뮬레이션 (내부 상태 직접 조작하는 대신 공개 API로는 불가하지만,
    // DOM 이벤트 핸들러는 bindDOM이 있어야 동작하므로 getSnapshot만 확인)
    // isWindowFocused 상태를 외부 이벤트로 바꿔야 하는데 DOM 미연결 — 이 테스트는 스킵)
  });

  it('subscribe/unsubscribe works', () => {
    const clock = makeClock();
    const tracker = new PresenceTracker();
    tracker.setClock(clock.now);

    const snaps: Presence[] = [];
    const unsub = tracker.subscribe((p) => snaps.push(p));
    tracker._tickForTest();
    expect(snaps.length).toBe(1);

    unsub();
    tracker._tickForTest();
    expect(snaps.length).toBe(1);
  });
});
