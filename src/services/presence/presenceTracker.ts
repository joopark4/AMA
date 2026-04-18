/**
 * Presence Tracker — 사용자 현존/활동 멀티 시그널 수집 (v2)
 *
 * 기존 `proactiveEngine.notifyUserActivity()` 단일 신호(sendMessage 호출)를 대체하여
 * DOM 이벤트(키보드/마우스/포커스/visibility)를 종합해 실제 유휴 여부를 정확히 판정한다.
 *
 * 신호:
 * - idleSec: 마지막 입력 이벤트 이후 경과 초
 * - typingRate: 최근 60초간 keydown 횟수 (keys/min proxy)
 * - mouseActivityRate: 최근 60초간 mousemove throttle 카운트
 * - isWindowFocused: `document.hasFocus()`
 * - isPageVisible: `document.visibilityState === 'visible'`
 *
 * 구독 모델: 1초 tick 또는 상태 변화 시 listener에 Presence snapshot 전달.
 * idle 경계(기본 5분 통과) 시 `idleCrossed` 이벤트 플래그 1회만 true.
 */

export interface Presence {
  idleSec: number;
  typingRate: number;
  mouseActivityRate: number;
  isWindowFocused: boolean;
  isPageVisible: boolean;
  /** 이 스냅샷 시점에 idle 임계값을 방금 넘어섰는가 (1회성 플래그) */
  idleCrossed: boolean;
  /** 이 스냅샷 시점에 포커스/visibility가 복귀했는가 (1회성 플래그) */
  returnedFromAway: boolean;
}

type Listener = (presence: Presence) => void;

const MOUSEMOVE_THROTTLE_MS = 150;
const ACTIVITY_WINDOW_MS = 60_000;
const DEFAULT_IDLE_THRESHOLD_MS = 5 * 60_000;

function nowMs(): number {
  return Date.now();
}

export class PresenceTracker {
  private lastActivityAt = nowMs();
  private keyTimestamps: number[] = [];
  private mouseTimestamps: number[] = [];
  private lastMouseMoveAt = 0;

  private isWindowFocused = true;
  private isPageVisible = true;
  private wasAway = false;
  private wasIdle = false;

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<Listener>();
  private domBound = false;
  private idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS;

  /** 테스트/외부 주입용 — 실제 시각을 대체. 기본은 Date.now. */
  private clock: () => number = nowMs;

  setIdleThresholdMs(ms: number): void {
    this.idleThresholdMs = Math.max(1000, ms);
  }

  setClock(clock: () => number): void {
    this.clock = clock;
    this.lastActivityAt = clock();
  }

  /** DOM 이벤트 바인딩 (브라우저 환경에서만). 재호출 안전. */
  bindDOM(): void {
    if (this.domBound || typeof window === 'undefined') return;
    this.domBound = true;

    window.addEventListener('keydown', this.onKey, { passive: true });
    window.addEventListener('mousemove', this.onMouseMove, { passive: true });
    window.addEventListener('mousedown', this.onMouseDown, { passive: true });
    window.addEventListener('focus', this.onFocus);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.isWindowFocused = document.hasFocus();
    this.isPageVisible = document.visibilityState === 'visible';
  }

  unbindDOM(): void {
    if (!this.domBound || typeof window === 'undefined') return;
    this.domBound = false;
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('focus', this.onFocus);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  /** 1초 tick 시작. 구독자에게 Presence 스냅샷 전달. */
  start(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), 1000);
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 외부에서 활동 알림 (예: 음성 입력 완료, sendMessage). */
  notifyActivity(): void {
    this.markActivity();
  }

  /** 현재 스냅샷 (이벤트 플래그는 항상 false). */
  getSnapshot(): Presence {
    const idleSec = Math.max(0, (this.clock() - this.lastActivityAt) / 1000);
    return {
      idleSec,
      typingRate: this.computeRate(this.keyTimestamps),
      mouseActivityRate: this.computeRate(this.mouseTimestamps),
      isWindowFocused: this.isWindowFocused,
      isPageVisible: this.isPageVisible,
      idleCrossed: false,
      returnedFromAway: false,
    };
  }

  // ── internal ──

  private markActivity(): void {
    this.lastActivityAt = this.clock();
  }

  private onKey = (): void => {
    const t = this.clock();
    this.keyTimestamps.push(t);
    this.pruneOld(this.keyTimestamps, t);
    this.markActivity();
  };

  private onMouseMove = (): void => {
    const t = this.clock();
    // throttle — mousemove는 초당 수십회 발생
    if (t - this.lastMouseMoveAt < MOUSEMOVE_THROTTLE_MS) return;
    this.lastMouseMoveAt = t;
    this.mouseTimestamps.push(t);
    this.pruneOld(this.mouseTimestamps, t);
    this.markActivity();
  };

  private onMouseDown = (): void => {
    this.markActivity();
  };

  private onFocus = (): void => {
    this.isWindowFocused = true;
    this.markActivity();
  };

  private onBlur = (): void => {
    this.isWindowFocused = false;
  };

  private onVisibilityChange = (): void => {
    this.isPageVisible = document.visibilityState === 'visible';
    if (this.isPageVisible) this.markActivity();
  };

  private pruneOld(arr: number[], now: number): void {
    const cutoff = now - ACTIVITY_WINDOW_MS;
    while (arr.length && arr[0] < cutoff) arr.shift();
  }

  private computeRate(arr: number[]): number {
    const t = this.clock();
    this.pruneOld(arr, t);
    // events per minute
    return arr.length;
  }

  private tick(): void {
    const snap = this.getSnapshot();
    const idleMs = snap.idleSec * 1000;
    const isAway = !snap.isWindowFocused || !snap.isPageVisible;
    const isIdle = idleMs >= this.idleThresholdMs;

    const idleCrossed = !this.wasIdle && isIdle;
    const returnedFromAway = this.wasAway && !isAway;

    this.wasIdle = isIdle;
    this.wasAway = isAway;

    if (this.listeners.size === 0) return;
    const payload: Presence = {
      ...snap,
      idleCrossed,
      returnedFromAway,
    };
    for (const l of this.listeners) {
      try {
        l(payload);
      } catch (err) {
        console.error('[presenceTracker] listener error', err);
      }
    }
  }

  /** 테스트 전용: tick 강제 실행. */
  _tickForTest(): void {
    this.tick();
  }
}

export const presenceTracker = new PresenceTracker();
