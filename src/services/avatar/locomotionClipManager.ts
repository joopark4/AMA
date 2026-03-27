/**
 * Mixamo 기반 아바타 애니메이션 클립 관리
 *
 * 걷기/Idle/제스처 FBX 파일을 VRM에 리타게팅하여 캐시하고,
 * AnimationMixer를 통해 crossfade 전환을 제공한다.
 *
 * 메모리 관리:
 * - LRU 캐시: 최대 MAX_CACHED_CLIPS개 클립만 유지
 * - 사용하지 않는 클립 자동 언로드
 * - dispose() 시 모든 리소스 완전 해제
 */

import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { loadMixamoAnimation } from './loadMixamoAnimation';
import type { Emotion } from '../../stores/avatarStore';

// ─── FBX 매핑 테이블 ───

const EMOTION_WALK_MAP: Record<string, string> = {
  neutral: '/motions/mixamo/Walking.fbx',
  happy: '/motions/mixamo/Happy Walk.fbx',
  sad: '/motions/mixamo/Sad Walk.fbx',
  angry: '/motions/mixamo/Angry.fbx',
  thinking: '/motions/mixamo/Sneak Walk.fbx',
  relaxed: '/motions/mixamo/Relaxed Walk.fbx',
  surprised: '/motions/mixamo/Surprised Walk.fbx',
};

const EMOTION_IDLE_MAP: Record<string, string> = {
  neutral: '/motions/mixamo/Idle.fbx',
  happy: '/motions/mixamo/Happy Idle.fbx',
  sad: '/motions/mixamo/Sad Idle.fbx',
  angry: '/motions/mixamo/Angry Idle.fbx',
  thinking: '/motions/mixamo/Thinking.fbx',
  surprised: '/motions/mixamo/Surprised.fbx',
  relaxed: '/motions/mixamo/Relaxed Idle.fbx',
};

const GESTURE_FBX_MAP: Record<string, string> = {
  wave: '/motions/mixamo/Waving.fbx',
  nod: '/motions/mixamo/Nodding.fbx',
  shake: '/motions/mixamo/Head Shake.fbx',
  shrug: '/motions/mixamo/Shrug.fbx',
  celebrate: '/motions/mixamo/Celebrate.fbx',
  jump: '/motions/mixamo/Jump.fbx',
};

const CROSSFADE_DURATION = 0.3;
const GESTURE_FADE_IN = 0.2;
const GESTURE_FADE_OUT = 0.3;
const MAX_CACHED_CLIPS = 8; // LRU 캐시 최대 크기

// ─── 클립 매니저 ───

export class LocomotionClipManager {
  private mixer: THREE.AnimationMixer;
  private vrm: VRM;
  private clipCache = new Map<string, THREE.AnimationClip>();
  private clipAccessOrder: string[] = []; // LRU 순서 추적
  private actionCache = new Map<string, THREE.AnimationAction>();
  private currentWalkAction: THREE.AnimationAction | null = null;
  private currentIdleAction: THREE.AnimationAction | null = null;
  private currentGestureAction: THREE.AnimationAction | null = null;
  private gestureFinishedHandler: ((e: { action: THREE.AnimationAction }) => void) | null = null;
  private currentWalkEmotion = '';
  private currentIdleEmotion = '';
  private _isWalking = false;
  private _isIdling = false;
  private loadingPromises = new Map<string, Promise<THREE.AnimationClip | null>>();
  private disposed = false;

  constructor(mixer: THREE.AnimationMixer, vrm: VRM) {
    this.mixer = mixer;
    this.vrm = vrm;
  }

  // ─── 걷기 ───

  async playWalk(emotion: Emotion): Promise<void> {
    if (this.disposed) return;
    const fbxPath = EMOTION_WALK_MAP[emotion] ?? EMOTION_WALK_MAP.neutral;
    if (this._isWalking && this.currentWalkEmotion === emotion) return;

    if (this._isIdling) this.stopIdle();

    this.currentWalkEmotion = emotion;
    this._isWalking = true;

    try {
      const clip = await this.getOrLoadClip(fbxPath, `walk_${emotion}`);
      if (!clip || this.disposed) return;

      const action = this.getOrCreateAction(fbxPath, clip);
      action.setLoop(THREE.LoopRepeat, Infinity);

      if (this.currentWalkAction && this.currentWalkAction !== action) {
        const prev = this.currentWalkAction;
        action.reset().setEffectiveWeight(1).play();
        prev.crossFadeTo(action, CROSSFADE_DURATION, true);
        // crossfade 완료 후 이전 액션 정리
        setTimeout(() => { if (!this.disposed) this.cleanupAction(prev); }, CROSSFADE_DURATION * 1000 + 100);
      } else if (!this.currentWalkAction) {
        action.reset().setEffectiveWeight(1).fadeIn(CROSSFADE_DURATION).play();
      }
      this.currentWalkAction = action;
    } catch (err) {
      console.warn('[ClipManager] Walk clip failed:', err);
    }
  }

  stopWalk(): void {
    if (!this._isWalking) return;
    this._isWalking = false;
    this.currentWalkEmotion = '';
    if (this.currentWalkAction) {
      this.currentWalkAction.fadeOut(CROSSFADE_DURATION);
      this.currentWalkAction = null;
    }
  }

  async switchWalkEmotion(emotion: Emotion): Promise<void> {
    if (!this._isWalking || this.currentWalkEmotion === emotion) return;
    await this.playWalk(emotion);
  }

  setWalkSpeed(speed: number): void {
    if (this.currentWalkAction) {
      this.currentWalkAction.setEffectiveTimeScale(Math.max(0.1, speed));
    }
  }

  get isWalking(): boolean { return this._isWalking; }

  // ─── Idle 대기 ───

  async playIdle(emotion: Emotion): Promise<void> {
    if (this.disposed) return;
    const fbxPath = EMOTION_IDLE_MAP[emotion] ?? EMOTION_IDLE_MAP.neutral;
    if (this._isIdling && this.currentIdleEmotion === emotion) return;

    this.currentIdleEmotion = emotion;
    this._isIdling = true;

    try {
      const clip = await this.getOrLoadClip(fbxPath, `idle_${emotion}`);
      if (!clip || this.disposed) return;

      const action = this.getOrCreateAction(fbxPath, clip);
      action.setLoop(THREE.LoopRepeat, Infinity);

      if (this.currentIdleAction && this.currentIdleAction !== action) {
        const prev = this.currentIdleAction;
        action.reset().setEffectiveWeight(1).play();
        prev.crossFadeTo(action, CROSSFADE_DURATION, true);
        setTimeout(() => { if (!this.disposed) this.cleanupAction(prev); }, CROSSFADE_DURATION * 1000 + 100);
      } else if (!this.currentIdleAction) {
        action.reset().setEffectiveWeight(1).fadeIn(CROSSFADE_DURATION).play();
      }
      this.currentIdleAction = action;
    } catch (err) {
      console.warn('[ClipManager] Idle clip failed:', err);
    }
  }

  stopIdle(): void {
    if (!this._isIdling) return;
    this._isIdling = false;
    this.currentIdleEmotion = '';
    if (this.currentIdleAction) {
      this.currentIdleAction.fadeOut(CROSSFADE_DURATION);
      this.currentIdleAction = null;
    }
  }

  async switchIdleEmotion(emotion: Emotion): Promise<void> {
    if (!this._isIdling || this.currentIdleEmotion === emotion) return;
    await this.playIdle(emotion);
  }

  get isIdling(): boolean { return this._isIdling; }

  // ─── 제스처 ───

  async playGesture(gesture: string): Promise<void> {
    if (this.disposed) return;
    const fbxPath = GESTURE_FBX_MAP[gesture];
    if (!fbxPath) return;

    try {
      const clip = await this.getOrLoadClip(fbxPath, `gesture_${gesture}`);
      if (!clip || this.disposed) return;

      // 이전 제스처 정리
      this.cleanupGesture();

      const action = this.getOrCreateAction(fbxPath, clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.reset().setEffectiveWeight(1).fadeIn(GESTURE_FADE_IN).play();
      this.currentGestureAction = action;

      // 재생 완료 후 자동 정리
      this.gestureFinishedHandler = (e) => {
        if (e.action === action) {
          this.cleanupGesture();
        }
      };
      this.mixer.addEventListener('finished', this.gestureFinishedHandler);
    } catch (err) {
      console.warn('[ClipManager] Gesture clip failed:', err);
    }
  }

  get isGesturePlaying(): boolean {
    return this.currentGestureAction !== null && this.currentGestureAction.isRunning();
  }

  // ─── 공통 ───

  get playing(): boolean { return this._isWalking; }

  stopAll(): void {
    this.stopWalk();
    this.stopIdle();
    this.cleanupGesture();
  }

  /** 리소스 완전 해제 */
  dispose(): void {
    this.disposed = true;
    this.stopAll();

    // 모든 이벤트 리스너 제거
    if (this.gestureFinishedHandler) {
      this.mixer.removeEventListener('finished', this.gestureFinishedHandler);
      this.gestureFinishedHandler = null;
    }

    // 모든 액션 정지 + mixer 캐시 해제
    this.actionCache.forEach((action) => {
      action.stop();
      this.mixer.uncacheAction(action.getClip());
    });
    this.clipCache.forEach((clip) => {
      this.mixer.uncacheClip(clip);
    });
    this.clipCache.clear();
    this.clipAccessOrder = [];
    this.actionCache.clear();
    this.loadingPromises.clear();
  }

  /** neutral 걷기 + idle만 빠르게 로드 */
  async preloadEssentials(): Promise<void> {
    await Promise.allSettled([
      this.getOrLoadClip(EMOTION_WALK_MAP.neutral, 'walk_neutral'),
      this.getOrLoadClip(EMOTION_IDLE_MAP.neutral, 'idle_neutral'),
    ]);
  }

  // ─── Private ───

  private cleanupGesture(): void {
    if (this.gestureFinishedHandler) {
      this.mixer.removeEventListener('finished', this.gestureFinishedHandler);
      this.gestureFinishedHandler = null;
    }
    if (this.currentGestureAction) {
      this.currentGestureAction.fadeOut(GESTURE_FADE_OUT);
      this.currentGestureAction = null;
    }
  }

  /** crossfade 완료 후 이전 액션 정리 */
  private cleanupAction(action: THREE.AnimationAction): void {
    if (action === this.currentWalkAction || action === this.currentIdleAction) return;
    action.stop();
  }

  /** LRU 캐시: 최대 MAX_CACHED_CLIPS 유지, 초과 시 가장 오래된 것 제거 */
  private evictOldClips(): void {
    while (this.clipCache.size > MAX_CACHED_CLIPS && this.clipAccessOrder.length > 0) {
      const oldest = this.clipAccessOrder.shift()!;
      // 현재 사용 중인 클립은 제거하지 않음
      const isInUse = (this.currentWalkAction?.getClip() === this.clipCache.get(oldest)) ||
                      (this.currentIdleAction?.getClip() === this.clipCache.get(oldest)) ||
                      (this.currentGestureAction?.getClip() === this.clipCache.get(oldest));
      if (isInUse) {
        this.clipAccessOrder.push(oldest); // 뒤로 보냄
        continue;
      }
      const clip = this.clipCache.get(oldest);
      if (clip) {
        const action = this.actionCache.get(oldest);
        if (action) {
          action.stop();
          this.mixer.uncacheAction(clip);
          this.actionCache.delete(oldest);
        }
        this.mixer.uncacheClip(clip);
        this.clipCache.delete(oldest);
      }
    }
  }

  private touchCache(key: string): void {
    const idx = this.clipAccessOrder.indexOf(key);
    if (idx !== -1) this.clipAccessOrder.splice(idx, 1);
    this.clipAccessOrder.push(key);
  }

  private async getOrLoadClip(
    fbxPath: string,
    clipName: string,
  ): Promise<THREE.AnimationClip | null> {
    const cached = this.clipCache.get(fbxPath);
    if (cached) {
      this.touchCache(fbxPath);
      return cached;
    }

    const inflight = this.loadingPromises.get(fbxPath);
    if (inflight) return inflight;

    const promise = this.loadClip(fbxPath, clipName);
    this.loadingPromises.set(fbxPath, promise);
    return promise;
  }

  private async loadClip(
    fbxPath: string,
    clipName: string,
  ): Promise<THREE.AnimationClip | null> {
    try {
      const clip = await loadMixamoAnimation(fbxPath, this.vrm, {
        clipName,
        removeRootMotion: true,
      });
      this.clipCache.set(fbxPath, clip);
      this.touchCache(fbxPath);
      this.evictOldClips();
      return clip;
    } catch (err) {
      console.warn(`[ClipManager] Failed to load ${fbxPath}:`, err);
      return null;
    } finally {
      this.loadingPromises.delete(fbxPath);
    }
  }

  private getOrCreateAction(
    key: string,
    clip: THREE.AnimationClip,
  ): THREE.AnimationAction {
    const cached = this.actionCache.get(key);
    if (cached) return cached;

    const action = this.mixer.clipAction(clip);
    this.actionCache.set(key, action);
    return action;
  }
}
