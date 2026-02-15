import { useState, useCallback, useRef, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAvatarStore } from '../../stores/avatarStore';

export default function LightingControl() {
  const { settings, setAvatarSettings } = useSettingsStore();
  const { position: avatarPosition } = useAvatarStore();

  const [isDragging, setIsDragging] = useState(false);
  const [sunPosition, setSunPosition] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });

  // Calculate sun position based on light settings
  useEffect(() => {
    const lightPos = settings.avatar?.lighting?.directionalPosition || { x: 0, y: 1, z: 2 };
    // Map 3D light position to 2D screen offset from avatar center
    // X: -5 to 5 → -200 to 200 pixels
    // Y: -5 to 5 → 300 to -300 pixels (inverted for screen coords)
    const offsetX = (lightPos.x / 5) * 200;
    const offsetY = -(lightPos.y / 5) * 300;
    setSunPosition({ x: offsetX, y: offsetY });
  }, [settings.avatar?.lighting?.directionalPosition]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPosRef.current = { ...sunPosition };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [sunPosition]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    e.stopPropagation();

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    // Clamp to reasonable bounds (wider range for more control)
    const newX = Math.max(-200, Math.min(200, initialPosRef.current.x + deltaX));
    const newY = Math.max(-300, Math.min(300, initialPosRef.current.y + deltaY));

    setSunPosition({ x: newX, y: newY });

    // Update light position in settings
    // Map 2D offset back to 3D position
    const lightX = (newX / 200) * 5;
    const lightY = -(newY / 300) * 5;

    setAvatarSettings({
      lighting: {
        ...settings.avatar?.lighting,
        directionalPosition: {
          ...settings.avatar?.lighting?.directionalPosition,
          x: lightX,
          y: lightY,
        },
      },
    });
  }, [isDragging, settings.avatar?.lighting, setAvatarSettings]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  // Check if lighting control should be shown
  const showControl = settings.avatar?.lighting?.showControl !== false;

  // Position sun relative to avatar center (fixed distance regardless of scale)
  const avatarCenterX = avatarPosition.x;
  const avatarCenterY = avatarPosition.y - 150;

  if (!showControl) {
    return null;
  }

  return (
    <div
      className="fixed pointer-events-auto cursor-grab active:cursor-grabbing select-none z-50"
      style={{
        left: avatarCenterX + sunPosition.x - 20,
        top: avatarCenterY + sunPosition.y - 20,
        fontSize: '40px',
        filter: isDragging ? 'drop-shadow(0 0 10px rgba(255, 200, 0, 0.8))' : 'drop-shadow(0 0 5px rgba(255, 200, 0, 0.5))',
        transition: isDragging ? 'none' : 'filter 0.2s',
        opacity: isDragging ? 1 : 0.7,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      title="드래그하여 조명 위치 조정"
    >
      ☀️
    </div>
  );
}
