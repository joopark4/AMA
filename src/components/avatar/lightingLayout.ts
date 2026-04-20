/**
 * 조명 아이콘과 히트박스 공유 레이아웃 상수.
 *
 * `LightingControl.tsx`(렌더 위치)와 `useClickThrough.ts`(히트 테스트)가
 * 동일한 좌표계를 사용해야 클릭스루가 조명 아이콘을 정확히 감지한다.
 * 한쪽만 바뀌면 히트박스 오프셋이 어긋나므로 공용 상수로 관리.
 */

/** `directionalPosition.x/y`가 표현하는 입력 범위 (± 값). */
export const LIGHT_INPUT_HALF_RANGE = 5;

/** 조명 아이콘 화면 X 오프셋의 최대 반경(px). */
export const LIGHT_SCREEN_HALF_RANGE_X = 300;

/** 조명 아이콘 화면 Y 오프셋의 최대 반경(px). 머리 위 도달 가능. */
export const LIGHT_SCREEN_HALF_RANGE_Y = 500;

/**
 * 아바타 발 위치(`avatarPosition.y`) 기준 머리 근처까지의 Y 오프셋(px).
 * 조명 아이콘의 중심 기준점으로 사용 — `avatarCenterY = avatarPosition.y - AVATAR_HEAD_OFFSET_Y`.
 */
export const AVATAR_HEAD_OFFSET_Y = 250;

/**
 * `directionalPosition` → 화면 offset 변환.
 * Y는 음수가 위쪽(viewport 좌표계 기준).
 */
export function lightPosToScreenOffset(lightPos: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return {
    x: (lightPos.x / LIGHT_INPUT_HALF_RANGE) * LIGHT_SCREEN_HALF_RANGE_X,
    y: -(lightPos.y / LIGHT_INPUT_HALF_RANGE) * LIGHT_SCREEN_HALF_RANGE_Y,
  };
}

/**
 * 화면 offset → `directionalPosition` 역변환.
 * 드래그 시 사용.
 */
export function screenOffsetToLightPos(offset: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return {
    x: (offset.x / LIGHT_SCREEN_HALF_RANGE_X) * LIGHT_INPUT_HALF_RANGE,
    y: -(offset.y / LIGHT_SCREEN_HALF_RANGE_Y) * LIGHT_INPUT_HALF_RANGE,
  };
}
