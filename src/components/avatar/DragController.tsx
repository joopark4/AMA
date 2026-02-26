import { useEffect, useRef, useCallback } from 'react';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';

export default function DragController() {
  const {
    position,
    setPosition,
    setIsDragging,
    isDragging,
    bounds,
  } = useAvatarStore();
  const { settings } = useSettingsStore();

  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: MouseEvent) => {
    // Avatar click area calculation
    // The avatar's screen position is affected by the 3D-to-screen projection
    // Position in store represents the target screen location
    const scale = settings.avatar?.scale || 1.0;

    // Base dimensions at scale 1.0
    const baseWidth = 200;
    const baseHeight = 450;

    // Scale affects the visual size
    const avatarWidth = baseWidth * scale;
    const avatarHeight = baseHeight * scale;

    // The avatar is centered horizontally on position.x
    // Vertically, the avatar's feet are around position.y, body extends upward
    // Account for the vertical offset in rendering (-1.0 in world space ≈ screen offset)
    const verticalOffset = 100 * scale; // Approximate offset from world space conversion

    const clickAreaLeft = position.x - avatarWidth / 2;
    const clickAreaRight = position.x + avatarWidth / 2;
    const clickAreaTop = position.y - avatarHeight + verticalOffset;
    const clickAreaBottom = position.y + verticalOffset + 50;

    const isInClickArea =
      e.clientX >= clickAreaLeft &&
      e.clientX <= clickAreaRight &&
      e.clientY >= clickAreaTop &&
      e.clientY <= clickAreaBottom;

    if (isInClickArea) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      positionStartRef.current = { x: position.x, y: position.y };
      e.preventDefault();
    }
  }, [position, setIsDragging, settings.avatar?.scale]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    let newX = positionStartRef.current.x + dx;
    let newY = positionStartRef.current.y + dy;

    const freeMovement = settings.avatar?.freeMovement ?? false;
    if (!freeMovement) {
      // Normal mode: clamp to bounds
      newX = Math.max(bounds.minX, Math.min(bounds.maxX, newX));
      newY = Math.max(bounds.minY, Math.min(bounds.maxY, newY));
    }
    // Free movement: no clamp, allow off-screen

    setPosition({ x: newX, y: newY });
  }, [isDragging, bounds, setPosition, settings.avatar?.freeMovement]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging, setIsDragging]);

  useEffect(() => {
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);

  return null;
}
