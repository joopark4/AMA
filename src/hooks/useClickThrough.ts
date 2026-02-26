import { useEffect, useRef, useCallback } from 'react';
import { windowManager } from '../services/tauri/windowManager';
import { useAvatarStore } from '../stores/avatarStore';
import { useSettingsStore } from '../stores/settingsStore';

// Polling interval in milliseconds
const POLL_INTERVAL = 30;
// Delay before enabling click-through after leaving interactive area
const CLICK_THROUGH_DELAY = 180;
const CURSOR_SANITY_MARGIN = 120;

// Tight body-only hitbox (fallback when interactionBounds not available).
// These define a slim column around the avatar's feet position.
const BODY_HALF_WIDTH = 100;
const BODY_HEIGHT_ABOVE_FEET = 450;
const BODY_HEIGHT_BELOW_FEET = 30;

function isPointInsideRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Hook to manage click-through behavior for transparent windows.
 * Uses global cursor position polling since mouse events are not received
 * when click-through is enabled.
 *
 * The Rust backend returns cursor position already converted to
 * window-local coordinates (logical pixels), so no frontend
 * coordinate conversion is needed.
 *
 * The avatar hit area uses the center of the 3D AABB (interactionBounds)
 * with a tight body-only rectangle, ignoring hair/accessories that make
 * the raw AABB much larger than the visible body.
 * interactionBounds updates every animation frame, so the hit area
 * tracks the avatar's position and scale in real time.
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
      // Rust returns window-local coordinates (logical pixels)
      const cursor = await windowManager.getCursorPosition();
      const mouseX = cursor.x;
      const mouseY = cursor.y;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Check if cursor is within or near the window
      const isPlausible =
        mouseX >= -CURSOR_SANITY_MARGIN &&
        mouseX <= viewportWidth + CURSOR_SANITY_MARGIN &&
        mouseY >= -CURSOR_SANITY_MARGIN &&
        mouseY <= viewportHeight + CURSOR_SANITY_MARGIN;

      // If cursor is far from window, enable click-through
      if (!isPlausible) {
        await updateClickThrough(true);
        return;
      }

      // Check if mouse is over avatar
      const avatarState = useAvatarStore.getState();
      const settingsState = useSettingsStore.getState();
      const avatarPos = avatarState.position;
      const interactionBounds = avatarState.interactionBounds;
      const avatarScale = settingsState.settings.avatar?.scale || 1.0;

      // Build a body hitbox from the 3D AABB (interactionBounds).
      // The AABB includes hair, accessories, etc. so we trim it to the
      // visible body area. Use 55% of width (body + shoulders) centered,
      // and skip top 15% (hair tips only).
      // When unavailable, fall back to fixed constants around avatar feet.
      let hitLeft: number, hitRight: number, hitTop: number, hitBottom: number;
      if (interactionBounds) {
        const ibW = interactionBounds.right - interactionBounds.left;
        const ibH = interactionBounds.bottom - interactionBounds.top;
        const centerX = (interactionBounds.left + interactionBounds.right) / 2;

        // Body column: 55% of AABB width (body + shoulders)
        const bodyW = ibW * 0.55;
        hitLeft = centerX - bodyW / 2;
        hitRight = centerX + bodyW / 2;

        // Vertical: keep bottom 85% of AABB (skip top 15% = hair tips only)
        hitTop = interactionBounds.top + ibH * 0.15;
        hitBottom = interactionBounds.bottom;
      } else {
        const hw = BODY_HALF_WIDTH * avatarScale;
        hitLeft = avatarPos.x - hw;
        hitRight = avatarPos.x + hw;
        hitTop = avatarPos.y - BODY_HEIGHT_ABOVE_FEET * avatarScale;
        hitBottom = avatarPos.y + BODY_HEIGHT_BELOW_FEET * avatarScale;
      }

      const isOverAvatar =
        mouseX >= hitLeft &&
        mouseX <= hitRight &&
        mouseY >= hitTop &&
        mouseY <= hitBottom;

      // Check if mouse is over sun (lighting control)
      const lightPos = settingsState.settings.avatar?.lighting?.directionalPosition || { x: 0, y: 1, z: 2 };
      const sunOffsetX = (lightPos.x / 5) * 200;
      const sunOffsetY = -(lightPos.y / 5) * 300;
      const avatarCenterY = avatarPos.y - 150;
      const sunX = avatarPos.x + sunOffsetX;
      const sunY = avatarCenterY + sunOffsetY;
      const sunRadius = 30;

      const isOverSun =
        mouseX >= sunX - sunRadius &&
        mouseX <= sunX + sunRadius &&
        mouseY >= sunY - sunRadius &&
        mouseY <= sunY + sunRadius;

      // Check any declared interactive DOM region.
      const interactiveElements = Array.from(
        document.querySelectorAll<HTMLElement>('[data-interactive="true"]')
      );
      const isOverInteractiveDom = interactiveElements.some((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        return isPointInsideRect(mouseX, mouseY, rect);
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
