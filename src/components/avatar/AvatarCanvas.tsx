import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';
import VRMAvatar from './VRMAvatar';
import AvatarController from './AvatarController';
import AnimationManager from './AnimationManager';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';

// Enable legacy color management for VRM compatibility
THREE.ColorManagement.enabled = true;


function LoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color="#6366f1" wireframe />
    </mesh>
  );
}

function Scene() {
  const { settings } = useSettingsStore();
  const lighting = settings.avatar?.lighting || {
    ambientIntensity: 1.0,
    directionalIntensity: 1.0,
    directionalPosition: { x: 0, y: 1, z: 2 },
  };

  return (
    <>
      {/* Ambient light */}
      <ambientLight color={0xffffff} intensity={lighting.ambientIntensity} />

      {/* Directional light */}
      <directionalLight
        color={0xffffff}
        position={[
          lighting.directionalPosition.x,
          lighting.directionalPosition.y,
          lighting.directionalPosition.z,
        ]}
        intensity={lighting.directionalIntensity}
      />

      <Suspense fallback={<LoadingFallback />}>
        <VRMAvatar />
      </Suspense>

      {/* Movement controller */}
      <AvatarController />

      {/* Animation layers: Physics, Expressions, Gestures, Dance */}
      <AnimationManager />
    </>
  );
}

export default function AvatarCanvas() {
  const { isLoading, loadError } = useAvatarStore();

  return (
    <div className="w-full h-full absolute inset-0">
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-black/50 rounded-lg px-4 py-2 text-white text-sm">
            Loading avatar...
          </div>
        </div>
      )}

      {/* Error display */}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-red-500/80 rounded-lg px-4 py-2 text-white text-sm max-w-xs">
            {loadError}
          </div>
        </div>
      )}

      <Canvas
        camera={{
          position: [0, 0.8, 4], // Eye level, further back for full body view
          fov: 35,
          near: 0.1,
          far: 1000,
        }}
        gl={{
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
          toneMapping: THREE.NoToneMapping,
          sortObjects: true,
          premultipliedAlpha: false,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        onCreated={({ gl }) => {
          // Ensure proper color space for VRM textures
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        style={{
          background: 'transparent',
        }}
        dpr={[1, 2]}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
