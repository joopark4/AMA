import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAvatarStore } from '../../stores/avatarStore';
import { findExpressionName } from '../../animation/expressionBlender';

// Eye movement configuration
const EYE_CONFIG = {
  // Look target change interval range (seconds)
  minLookInterval: 1.5,
  maxLookInterval: 4.0,

  // Maximum eye rotation (radians)
  maxHorizontal: 0.15, // left/right
  maxVertical: 0.08, // up/down

  // Smooth movement speed
  lookSpeed: 3.0,

  // Blink configuration
  minBlinkInterval: 3.0,
  maxBlinkInterval: 7.0,
  blinkDuration: 0.15, // seconds
  doubleBlinkChance: 0.2, // 20% chance for double blink
};

export default function EyeController() {
  const vrm = useAvatarStore((state) => state.vrm);

  // Cache the blink expression name for this VRM model
  const blinkExpressionName = useMemo(() => {
    if (!vrm?.expressionManager) return null;

    const availableNames = vrm.expressionManager.expressions.map(e => e.expressionName);
    return findExpressionName('blink', availableNames);
  }, [vrm]);

  // Eye movement state (currently disabled - kept for future use)
  // const nextLookTimeRef = useRef(0);
  // const targetLookRef = useRef({ x: 0, y: 0 });
  // const currentLookRef = useRef({ x: 0, y: 0 });

  // Blink state - start with a delay so eyes are open initially
  const nextBlinkTimeRef = useRef(performance.now() * 0.001 + 3); // First blink after 3 seconds
  const blinkStateRef = useRef<'idle' | 'closing' | 'opening' | 'closed'>('idle');
  const blinkProgressRef = useRef(0);
  const doubleBlinkRef = useRef(false);
  const blinkCountRef = useRef(0);

  useFrame((_, delta) => {
    if (!vrm) return;

    const time = performance.now() * 0.001;

    // === Eye Look Direction ===
    updateEyeLook(time, delta);

    // === Natural Blinking ===
    updateBlink(time, delta);
  });

  function updateEyeLook(_time: number, _delta: number) {
    // DISABLED: Eye bone rotation might be causing pupils to not render correctly
    // Some VRM models use blendshapes for eye movement instead of bone rotation
    // The VRM has lookUp, lookDown, lookLeft, lookRight expressions that should be used instead
    return;
  }

  function updateBlink(time: number, delta: number) {
    if (!vrm?.expressionManager || !blinkExpressionName) return;

    const expressionManager = vrm.expressionManager;

    // State machine for blinking
    switch (blinkStateRef.current) {
      case 'idle':
        // Ensure eyes are open when idle
        expressionManager.setValue(blinkExpressionName, 0);
        // Check if it's time to blink
        if (time >= nextBlinkTimeRef.current) {
          blinkStateRef.current = 'closing';
          blinkProgressRef.current = 0;
          doubleBlinkRef.current = Math.random() < EYE_CONFIG.doubleBlinkChance;
          blinkCountRef.current = 0;
        }
        break;

      case 'closing':
        blinkProgressRef.current += delta / EYE_CONFIG.blinkDuration;
        if (blinkProgressRef.current >= 1) {
          blinkProgressRef.current = 1;
          blinkStateRef.current = 'closed';
        }
        // Apply closing animation
        expressionManager.setValue(blinkExpressionName, easeInQuad(blinkProgressRef.current));
        break;

      case 'closed':
        // Very brief pause at closed
        blinkStateRef.current = 'opening';
        blinkProgressRef.current = 1;
        break;

      case 'opening':
        blinkProgressRef.current -= delta / EYE_CONFIG.blinkDuration;
        if (blinkProgressRef.current <= 0) {
          blinkProgressRef.current = 0;
          blinkCountRef.current++;

          // Check for double blink
          if (doubleBlinkRef.current && blinkCountRef.current < 2) {
            blinkStateRef.current = 'closing';
          } else {
            blinkStateRef.current = 'idle';
            // Schedule next blink
            const interval =
              EYE_CONFIG.minBlinkInterval +
              Math.random() * (EYE_CONFIG.maxBlinkInterval - EYE_CONFIG.minBlinkInterval);
            nextBlinkTimeRef.current = time + interval;
          }
        }
        // Apply opening animation
        expressionManager.setValue(blinkExpressionName, easeOutQuad(blinkProgressRef.current));
        break;
    }
  }

  return null;
}

// Easing functions for natural blink
function easeInQuad(t: number): number {
  return t * t;
}

function easeOutQuad(t: number): number {
  return t * (2 - t);
}
