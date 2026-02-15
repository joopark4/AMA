import { useEffect, useRef, useCallback } from 'react';
import { windowManager } from '../services/tauri/windowManager';
import { useAvatarStore } from '../stores/avatarStore';
import { useSettingsStore } from '../stores/settingsStore';

// Polling interval in milliseconds
const POLL_INTERVAL = 30;
// Delay before enabling click-through after leaving interactive area
const CLICK_THROUGH_DELAY = 100;

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
    lastStateRef.current = shouldIgnore;

    try {
      await windowManager.setIgnoreCursorEvents(shouldIgnore);
    } catch (error) {
      console.error('Failed to set ignore cursor events:', error);
    }
  }, []);

  const checkCursorPosition = useCallback(async () => {
    try {
      const cursor = await windowManager.getCursorPosition();
      const mouseX = cursor.x;
      const mouseY = cursor.y;

      // Check if mouse is over avatar
      const avatarState = useAvatarStore.getState();
      const settingsState = useSettingsStore.getState();
      const avatarPos = avatarState.position;
      const avatarScale = settingsState.settings.avatar?.scale || 1.0;

      // Avatar hitbox size - fixed minimum size to ensure clickability
      const hitboxWidth = Math.max(300, 400 * avatarScale);
      const hitboxHeight = Math.max(500, 600 * avatarScale);

      const avatarLeft = avatarPos.x - hitboxWidth / 2;
      const avatarRight = avatarPos.x + hitboxWidth / 2;
      const avatarTop = avatarPos.y - hitboxHeight / 2;
      const avatarBottom = avatarPos.y + hitboxHeight / 2;

      const isOverAvatar =
        mouseX >= avatarLeft &&
        mouseX <= avatarRight &&
        mouseY >= avatarTop &&
        mouseY <= avatarBottom;

      // Check if mouse is over sun (lighting control)
      // Sun is positioned relative to avatar center (fixed distance regardless of scale)
      const lightPos = settingsState.settings.avatar?.lighting?.directionalPosition || { x: 0, y: 1, z: 2 };
      const sunOffsetX = (lightPos.x / 5) * 200;
      const sunOffsetY = -(lightPos.y / 5) * 300;
      const avatarCenterY = avatarPos.y - 150;
      const sunX = avatarPos.x + sunOffsetX;
      const sunY = avatarCenterY + sunOffsetY;
      const sunRadius = 30; // Clickable area around sun

      const isOverSun =
        mouseX >= sunX - sunRadius &&
        mouseX <= sunX + sunRadius &&
        mouseY >= sunY - sunRadius &&
        mouseY <= sunY + sunRadius;

      // Check if mouse is over settings area (bottom-right corner)
      // Includes status indicator, error messages, and buttons
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const settingsAreaRight = windowWidth;
      const settingsAreaBottom = windowHeight;
      const settingsAreaWidth = 350;  // Wider for text input form
      const settingsAreaHeight = 200; // Taller for error messages with buttons

      const isOverSettings =
        mouseX >= settingsAreaRight - settingsAreaWidth &&
        mouseX <= settingsAreaRight &&
        mouseY >= settingsAreaBottom - settingsAreaHeight &&
        mouseY <= settingsAreaBottom;

      // Check if settings panel is open (full screen interactive)
      const isSettingsOpen = settingsState.isSettingsOpen;

      const isOverInteractive = isOverAvatar || isOverSun || isOverSettings || isSettingsOpen;

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
