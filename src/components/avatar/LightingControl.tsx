import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAvatarStore } from '../../stores/avatarStore';

export default function LightingControl() {
  const { t } = useTranslation();
  const { settings, setAvatarSettings } = useSettingsStore();
  const { position: avatarPosition } = useAvatarStore();

  const [isDragging, setIsDragging] = useState(false);
  const [sunPosition, setSunPosition] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate sun position based on light settings
  // 좌표 범위:
  //   X: lightX ±5 → 화면 offset ±300px
  //   Y: lightY ±5 → 화면 offset ±500px (negative Y = 아바타 위쪽)
  // avatarCenterY는 아바타 머리 근처를 기준으로 하여
  // sunPosition.y = 0이면 머리 옆, 음수면 머리 위.
  useEffect(() => {
    const lightPos = settings.avatar?.lighting?.directionalPosition || { x: 0, y: 1, z: 2 };
    const offsetX = (lightPos.x / 5) * 300;
    const offsetY = -(lightPos.y / 5) * 500;
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

    // 아바타 머리 위까지 갈 수 있도록 상방향(Y 음수) 범위 확대.
    const newX = Math.max(-300, Math.min(300, initialPosRef.current.x + deltaX));
    const newY = Math.max(-500, Math.min(500, initialPosRef.current.y + deltaY));

    setSunPosition({ x: newX, y: newY });

    // 2D offset → 3D light position 역매핑 (범위 확장에 맞춰 분모 조정)
    const lightX = (newX / 300) * 5;
    const lightY = -(newY / 500) * 5;

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

  // Position sun relative to avatar center (fixed distance regardless of scale).
  // avatarPosition.y는 발 위치이므로 머리 근처로 끌어올린다 (아바타 모델 높이 ~250px 기준).
  const avatarCenterX = avatarPosition.x;
  const avatarCenterY = avatarPosition.y - 250;

  // Keep icon visible inside viewport (old/outlier positions can place it off-screen).
  const iconSize = 40;
  const edgePadding = 8;
  const rawLeft = avatarCenterX + sunPosition.x - iconSize / 2;
  const rawTop = avatarCenterY + sunPosition.y - iconSize / 2;
  const clampedLeft = Math.max(
    edgePadding,
    Math.min(viewportSize.width - iconSize - edgePadding, rawLeft)
  );
  const clampedTop = Math.max(
    edgePadding,
    Math.min(viewportSize.height - iconSize - edgePadding, rawTop)
  );

  if (!showControl) {
    return null;
  }

  return (
    <div
      className="fixed pointer-events-auto cursor-grab active:cursor-grabbing select-none z-50"
      data-interactive="true"
      style={{
        left: clampedLeft,
        top: clampedTop,
        fontSize: '40px',
        opacity: isDragging ? 1 : 0.7,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      title={t('lightingControl.dragHint')}
      aria-label="Light direction control"
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="20" cy="20" r="8" fill="#FACC15" stroke="#F59E0B" strokeWidth="2" />
        <line x1="20" y1="3" x2="20" y2="10" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="20" y1="30" x2="20" y2="37" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="3" y1="20" x2="10" y2="20" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="30" y1="20" x2="37" y2="20" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="8.2" y1="8.2" x2="13.1" y2="13.1" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="26.9" y1="26.9" x2="31.8" y2="31.8" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="8.2" y1="31.8" x2="13.1" y2="26.9" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="26.9" y1="13.1" x2="31.8" y2="8.2" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
