import { useEffect, useCallback, useRef } from 'react';
import { useAvatarStore } from '../stores/avatarStore';

interface UseWindowDragReturn {
  isDragging: boolean;
  startDrag: (e: React.MouseEvent | React.TouchEvent) => void;
}

export function useWindowDrag(): UseWindowDragReturn {
  const {
    position,
    bounds,
    isDragging,
    setPosition,
    setIsDragging,
    setTargetPosition,
    setIsMoving,
    setAnimationState,
  } = useAvatarStore();

  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const startDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();

    // Get initial position
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragOffsetRef.current = {
      x: clientX - position.x,
      y: clientY - position.y,
    };

    setIsDragging(true);
    setTargetPosition(null); // Cancel any ongoing movement
    setIsMoving(false);
    setAnimationState('idle');
  }, [position, setIsDragging, setTargetPosition, setIsMoving, setAnimationState]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;

    const newX = clientX - dragOffsetRef.current.x;
    const newY = clientY - dragOffsetRef.current.y;

    // Clamp to bounds
    const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, newX));
    const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, newY));

    setPosition({ x: clampedX, y: clampedY });
  }, [isDragging, bounds, setPosition]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  }, [handleMove]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [handleMove]);

  const endDrag = useCallback(() => {
    setIsDragging(false);
  }, [setIsDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', endDrag);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', endDrag);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', endDrag);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', endDrag);
      };
    }
  }, [isDragging, handleMouseMove, handleTouchMove, endDrag]);

  return {
    isDragging,
    startDrag,
  };
}

export default useWindowDrag;
