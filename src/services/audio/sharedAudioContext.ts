/**
 * 공유 AudioContext 싱글턴.
 * 브라우저는 AudioContext 수를 제한하므로(Chrome ≤6) 단일 인스턴스를 공유한다.
 * close() 후 재사용이 필요하면 자동으로 새 인스턴스를 생성한다.
 */

let shared: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (!shared || shared.state === 'closed') {
    shared = new AudioContext();
  }
  return shared;
}

/** 앱 종료 등 명시적 해제가 필요할 때만 호출 */
export function closeSharedAudioContext(): void {
  if (shared && shared.state !== 'closed') {
    shared.close();
  }
  shared = null;
}
