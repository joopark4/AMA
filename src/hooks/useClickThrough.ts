import { useEffect, useRef, useCallback } from 'react';
import { windowManager } from '../services/tauri/windowManager';
import { useAvatarStore } from '../stores/avatarStore';
import { useSettingsStore } from '../stores/settingsStore';

// Polling interval in milliseconds
const POLL_INTERVAL = 30;
// Delay before enabling click-through after leaving interactive area
const CLICK_THROUGH_DELAY = 180;
const CURSOR_SANITY_MARGIN = 120;
const AVATAR_FALLBACK_HALF_WIDTH = 280;
const AVATAR_FALLBACK_HEIGHT_ABOVE_FEET = 780;
const AVATAR_FALLBACK_HEIGHT_BELOW_FEET = 160;

function isPointInsideRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

type CursorPoint = { x: number; y: number };

function buildCursorCandidates(
  cursorX: number,
  cursorY: number,
  windowLeft: number,
  windowTop: number,
  dpr: number
): CursorPoint[] {
  const base: CursorPoint[] = [
    // Global -> local (logical)
    { x: cursorX - windowLeft, y: cursorY - windowTop },
    // Global physical -> local logical
    { x: cursorX / dpr - windowLeft, y: cursorY / dpr - windowTop },
    // Raw fallback (some environments already report local-ish values)
    { x: cursorX, y: cursorY },
    { x: cursorX / dpr, y: cursorY / dpr },
  ];

  // Deduplicate near-identical candidates to keep checks lightweight.
  const unique: CursorPoint[] = [];
  for (const p of base) {
    const exists = unique.some(
      (u) => Math.abs(u.x - p.x) < 0.5 && Math.abs(u.y - p.y) < 0.5
    );
    if (!exists) unique.push(p);
  }
  return unique;
}

/**
 * Hook to manage click-through behavior for transparent windows.
 * Uses global cursor position polling since mouse events are not received
 * when click-through is enabled.
 */
export function useClickThrough() {
  const lastStateRef = useRef<boolean | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clickThroughDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOverInteractiveRef = useRef<boolean>(false);

  const updateClickThrough = useCallback(async (shouldIgnore: boolean) => {
    // Only update if state changed
    if (lastStateRef.current === shouldIgnore) return;

    try {
      await windowManager.setIgnoreCursorEvents(shouldIgnore);
      lastStateRef.current = shouldIgnore;
    } catch (error) {
      console.error('Failed to set ignore cursor events:', error);
    }
  }, []);

  const checkCursorPosition = useCallback(async () => {
    try {
      const cursor = await windowManager.getCursorPosition();
      const windowLeft = window.screenX || 0;
      const windowTop = window.screenY || 0;

      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const mouseCandidates = buildCursorCandidates(
        cursor.x,
        cursor.y,
        windowLeft,
        windowTop,
        dpr
      );

      const anyCursorMatches = (predicate: (x: number, y: number) => boolean) =>
        mouseCandidates.some((p) => predicate(p.x, p.y));

      const hasPlausibleCursorCandidate = mouseCandidates.some(
        (p) =>
          p.x >= -CURSOR_SANITY_MARGIN &&
          p.x <= viewportWidth + CURSOR_SANITY_MARGIN &&
          p.y >= -CURSOR_SANITY_MARGIN &&
          p.y <= viewportHeight + CURSOR_SANITY_MARGIN
      );

      // If cursor conversion looks invalid, fail-safe to interactive mode
      // so avatar/buttons remain selectable instead of becoming unclickable.
      if (!hasPlausibleCursorCandidate) {
        await updateClickThrough(false);
        return;
      }

      // Check if mouse is over avatar
      const avatarState = useAvatarStore.getState();
      const settingsState = useSettingsStore.getState();
      const avatarPos = avatarState.position;
      const interactionBounds = avatarState.interactionBounds;

      // Fallback hitbox scaled by avatar size setting.
      const avatarScale = settingsState.settings.avatar?.scale || 1.0;
      const fallbackHalfWidth = AVATAR_FALLBACK_HALF_WIDTH * avatarScale;
      const fallbackHeightAbove = AVATAR_FALLBACK_HEIGHT_ABOVE_FEET * avatarScale;
      const fallbackHeightBelow = AVATAR_FALLBACK_HEIGHT_BELOW_FEET * avatarScale;

      const avatarLeft = avatarPos.x - fallbackHalfWidth;
      const avatarRight = avatarPos.x + fallbackHalfWidth;
      const avatarTop = avatarPos.y - fallbackHeightAbove;
      const avatarBottom = avatarPos.y + fallbackHeightBelow;

      const isOverAvatar = interactionBounds
        ? anyCursorMatches(
            (x, y) =>
              x >= interactionBounds.left &&
              x <= interactionBounds.right &&
              y >= interactionBounds.top &&
              y <= interactionBounds.bottom
          )
        : anyCursorMatches(
            (x, y) =>
              x >= avatarLeft &&
              x <= avatarRight &&
              y >= avatarTop &&
              y <= avatarBottom
          );

      // Check if mouse is over sun (lighting control)
      // Sun is positioned relative to avatar center (fixed distance regardless of scale)
      const lightPos = settingsState.settings.avatar?.lighting?.directionalPosition || { x: 0, y: 1, z: 2 };
      const sunOffsetX = (lightPos.x / 5) * 200;
      const sunOffsetY = -(lightPos.y / 5) * 300;
      const avatarCenterY = avatarPos.y - 150;
      const sunX = avatarPos.x + sunOffsetX;
      const sunY = avatarCenterY + sunOffsetY;
      const sunRadius = 30; // Clickable area around sun

      const isOverSun = anyCursorMatches(
        (x, y) =>
          x >= sunX - sunRadius &&
          x <= sunX + sunRadius &&
          y >= sunY - sunRadius &&
          y <= sunY + sunRadius
      );

      // Check any declared interactive DOM region.
      // This is more robust than hardcoded bottom-right bounds.
      const interactiveElements = Array.from(
        document.querySelectorAll<HTMLElement>('[data-interactive="true"]')
      );
      const isOverInteractiveDom = interactiveElements.some((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        return mouseCandidates.some((p) => isPointInsideRect(p.x, p.y, rect));
      });

      // Check if settings panel is open (full screen interactive)
      const isSettingsOpen = settingsState.isSettingsOpen;

      // Keep window interactive while dragging/rotating avatar so gestures don't get interrupted.
      const isAvatarManipulating = avatarState.isDragging || avatarState.isRotating;
      const isOverInteractive =
        isAvatarManipulating ||
        isOverAvatar ||
        isOverSun ||
        isOverInteractiveDom ||
        isSettingsOpen;

      // Track interactive state changes with delay
      if (isOverInteractive !== isOverInteractiveRef.current) {
        isOverInteractiveRef.current = isOverInteractive;

        // Clear any pending delay
        if (clickThroughDelayRef.current) {
          clearTimeout(clickThroughDelayRef.current);
          clickThroughDelayRef.current = null;
        }

        if (isOverInteractive) {
          // Immediately disable click-through when entering interactive area
          await updateClickThrough(false);
        } else {
          // Delay enabling click-through when leaving interactive area
          clickThroughDelayRef.current = setTimeout(async () => {
            await updateClickThrough(true);
          }, CLICK_THROUGH_DELAY);
        }
      }
    } catch (error) {
      // If we can't get cursor position, default to allowing clicks
      console.error('Failed to get cursor position:', error);
      await updateClickThrough(false);
    }
  }, [updateClickThrough]);

  useEffect(() => {
    // Initial state: allow clicks
    updateClickThrough(false);

    // Start polling for cursor position
    pollIntervalRef.current = setInterval(checkCursorPosition, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (clickThroughDelayRef.current) {
        clearTimeout(clickThroughDelayRef.current);
      }
      // Reset to allow clicks when unmounting
      updateClickThrough(false);
    };
  }, [checkCursorPosition, updateClickThrough]);
}

export default useClickThrough;
