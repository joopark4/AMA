import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getRhythmAnalyzer, type BeatInfo } from '../../services/audio/rhythmAnalyzer';

// Dance move generators
type DanceMoveFunc = (phase: number, energy: number, time: number) => Record<string, { x?: number; y?: number; z?: number }>;

const DANCE_MOVES: Record<string, DanceMoveFunc> = {
  headBob: (phase, energy) => ({
    head: {
      x: Math.sin(phase * Math.PI * 2) * 0.08 * energy,
      y: Math.sin(phase * Math.PI * 4) * 0.03 * energy,
    },
    neck: {
      x: Math.sin(phase * Math.PI * 2) * 0.04 * energy,
    },
  }),

  bodyBounce: (phase, energy) => ({
    spine: {
      y: Math.abs(Math.sin(phase * Math.PI * 2)) * 0.03 * energy,
    },
    chest: {
      x: Math.sin(phase * Math.PI * 2) * 0.02 * energy,
    },
  }),

  shoulderMove: (phase, energy) => ({
    leftShoulder: {
      z: Math.sin(phase * Math.PI * 2) * 0.1 * energy,
    },
    rightShoulder: {
      z: -Math.sin(phase * Math.PI * 2) * 0.1 * energy,
    },
  }),

  armSway: (phase, energy, _time) => ({
    leftUpperArm: {
      z: 1.0 + Math.sin(phase * Math.PI * 2) * 0.2 * energy,
      x: 0.1 + Math.sin(phase * Math.PI * 2 + Math.PI) * 0.15 * energy,
    },
    rightUpperArm: {
      z: -1.0 - Math.sin(phase * Math.PI * 2 + Math.PI) * 0.2 * energy,
      x: 0.1 + Math.sin(phase * Math.PI * 2) * 0.15 * energy,
    },
    leftLowerArm: {
      y: -0.2 - Math.sin(phase * Math.PI * 4) * 0.1 * energy,
    },
    rightLowerArm: {
      y: 0.2 + Math.sin(phase * Math.PI * 4) * 0.1 * energy,
    },
  }),

  hipSway: (phase, energy) => ({
    hips: {
      z: Math.sin(phase * Math.PI * 2) * 0.08 * energy,
      y: Math.sin(phase * Math.PI * 4) * 0.03 * energy,
    },
  }),

  legBounce: (phase, energy) => ({
    leftUpperLeg: {
      x: Math.max(0, Math.sin(phase * Math.PI * 2)) * 0.1 * energy,
    },
    rightUpperLeg: {
      x: Math.max(0, Math.sin(phase * Math.PI * 2 + Math.PI)) * 0.1 * energy,
    },
    leftLowerLeg: {
      x: Math.max(0, Math.sin(phase * Math.PI * 2)) * 0.15 * energy,
    },
    rightLowerLeg: {
      x: Math.max(0, Math.sin(phase * Math.PI * 2 + Math.PI)) * 0.15 * energy,
    },
  }),
};

// Combine all moves with weights
function combineDanceMoves(
  phase: number,
  energy: number,
  time: number,
  intensity: number
): Record<string, { x: number; y: number; z: number }> {
  const result: Record<string, { x: number; y: number; z: number }> = {};

  // Apply each dance move
  for (const moveFunc of Object.values(DANCE_MOVES)) {
    const moveResult = moveFunc(phase, energy, time);

    for (const [boneName, rotation] of Object.entries(moveResult)) {
      if (!result[boneName]) {
        result[boneName] = { x: 0, y: 0, z: 0 };
      }
      result[boneName].x += (rotation.x ?? 0) * intensity;
      result[boneName].y += (rotation.y ?? 0) * intensity;
      result[boneName].z += (rotation.z ?? 0) * intensity;
    }
  }

  return result;
}

export default function DanceController() {
  const vrm = useAvatarStore((state) => state.vrm);
  const {
    isDancing,
    animationState,
    setDanceEnergy,
    setBeatPhase,
  } = useAvatarStore();
  const { settings } = useSettingsStore();

  const rhythmAnalyzer = useRef(getRhythmAnalyzer());
  const basePoseRef = useRef<Record<string, { x: number; y: number; z: number }>>({});
  const smoothEnergyRef = useRef(0);
  const beatPulseRef = useRef(0);

  // Capture base pose when starting to dance
  useEffect(() => {
    if (isDancing && vrm?.humanoid) {
      const boneNames = [
        'head', 'neck', 'spine', 'chest', 'hips',
        'leftShoulder', 'rightShoulder',
        'leftUpperArm', 'rightUpperArm',
        'leftLowerArm', 'rightLowerArm',
        'leftUpperLeg', 'rightUpperLeg',
        'leftLowerLeg', 'rightLowerLeg',
      ];

      for (const boneName of boneNames) {
        const bone = vrm.humanoid.getNormalizedBoneNode(boneName as any);
        if (bone) {
          basePoseRef.current[boneName] = {
            x: bone.rotation.x,
            y: bone.rotation.y,
            z: bone.rotation.z,
          };
        }
      }
    }
  }, [isDancing, vrm]);

  // Auto-start dancing when enabled in settings (for demo purposes)
  useEffect(() => {
    if (settings.avatar?.animation?.enableDancing && !isDancing) {
      // Can start dancing automatically or wait for trigger
    }
  }, [settings.avatar?.animation?.enableDancing, isDancing]);

  useFrame((_, delta) => {
    if (!vrm?.humanoid) return;
    if (!settings.avatar?.animation?.enableDancing) return;
    if (!isDancing || animationState === 'walking') return;

    const time = performance.now() * 0.001;
    const intensity = settings.avatar?.animation?.danceIntensity ?? 0.7;

    // Get rhythm info (simulated if no audio connected)
    let beatInfo: BeatInfo;
    if (rhythmAnalyzer.current.isConnected) {
      beatInfo = rhythmAnalyzer.current.analyze();
    } else {
      // Simulate a beat for testing
      beatInfo = rhythmAnalyzer.current.simulateBeat(110);
    }

    // Update store state
    setBeatPhase(beatInfo.phase);

    // Smooth energy transition
    const targetEnergy = beatInfo.energy;
    smoothEnergyRef.current += (targetEnergy - smoothEnergyRef.current) * Math.min(1, delta * 5);
    setDanceEnergy(smoothEnergyRef.current);

    // Beat pulse effect (decays over time)
    if (beatInfo.isBeat) {
      beatPulseRef.current = 1.0;
    } else {
      beatPulseRef.current *= 0.9;
    }

    // Calculate combined energy (smooth energy + beat pulse)
    const combinedEnergy = smoothEnergyRef.current + beatPulseRef.current * 0.3;

    // Get dance move rotations
    const danceRotations = combineDanceMoves(
      beatInfo.phase,
      combinedEnergy,
      time,
      intensity
    );

    // Apply dance moves to bones
    const humanoid = vrm.humanoid;

    for (const [boneName, rotation] of Object.entries(danceRotations)) {
      const bone = humanoid.getNormalizedBoneNode(boneName as any);
      if (!bone) continue;

      const basePose = basePoseRef.current[boneName] || { x: 0, y: 0, z: 0 };

      // Additive blending with base pose
      bone.rotation.x = basePose.x + rotation.x;
      bone.rotation.y = basePose.y + rotation.y;
      bone.rotation.z = basePose.z + rotation.z;
    }
  });

  return null;
}

// Hook for controlling dance from outside
export function useDanceControls() {
  const { startDancing, stopDancing, isDancing } = useAvatarStore();
  const rhythmAnalyzer = getRhythmAnalyzer();

  const connectAudio = (audioElement: HTMLAudioElement): boolean => {
    const connected = rhythmAnalyzer.connect(audioElement);
    if (connected) {
      startDancing();
    }
    return connected;
  };

  const disconnectAudio = () => {
    rhythmAnalyzer.disconnect();
    stopDancing();
  };

  const toggleDance = () => {
    if (isDancing) {
      stopDancing();
    } else {
      startDancing();
    }
  };

  return {
    startDancing,
    stopDancing,
    toggleDance,
    connectAudio,
    disconnectAudio,
    isDancing,
  };
}
