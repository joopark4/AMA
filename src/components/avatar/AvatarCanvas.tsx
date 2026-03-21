import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import VRMAvatar from './VRMAvatar';
import AvatarController from './AvatarController';
import AnimationManager from './AnimationManager';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { pickVrmFile } from '../../services/tauri/fileDialog';
import { isDefaultVrmAvailable } from '../../services/tauri/defaultVrm';

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
  const { t } = useTranslation();
  const { isLoading, loadError } = useAvatarStore();
  const { settings, setVrmModelPath } = useSettingsStore();
  const [isSelectingVrm, setIsSelectingVrm] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const vrmPathConfigured = Boolean(settings.vrmModelPath?.trim());
  const [hasDefaultVrm, setHasDefaultVrm] = useState(false);

  useEffect(() => {
    isDefaultVrmAvailable().then(setHasDefaultVrm).catch(() => setHasDefaultVrm(false));
  }, []);

  const handleSelectVRM = useCallback(async () => {
    try {
      setIsSelectingVrm(true);
      const selected = await pickVrmFile();
      if (selected) {
        setPickerError(null);
        setVrmModelPath(selected);
      }
    } catch (error) {
      console.error('Error selecting VRM file:', error);
      setPickerError(t('avatar.selectVrm.error'));
    } finally {
      setIsSelectingVrm(false);
    }
  }, [setVrmModelPath]);

  return (
    <div className="w-full h-full absolute inset-0">
      {!vrmPathConfigured && !hasDefaultVrm && (
        <div className="absolute inset-0 flex items-center justify-center z-20" data-interactive="true">
          <div className="max-w-sm bg-slate-900/85 backdrop-blur-sm rounded-xl px-5 py-4 text-white border border-white/20 shadow-xl">
            <p className="text-sm font-semibold">{t('avatar.selectVrm.title')}</p>
            <p className="text-xs text-slate-200 mt-1">
              {t('avatar.selectVrm.description')}
            </p>
            <p className="text-[11px] text-slate-300 mt-1">
              {t('avatar.selectVrm.changeHint')}
            </p>
            <button
              type="button"
              onClick={handleSelectVRM}
              disabled={isSelectingVrm}
              className="mt-3 w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {isSelectingVrm ? t('avatar.selectVrm.opening') : t('avatar.selectVrm.button')}
            </button>
            {pickerError && (
              <p className="mt-2 text-[11px] text-red-200">{pickerError}</p>
            )}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-black/50 rounded-lg px-4 py-2 text-white text-sm">
            {t('avatar.loading')}
          </div>
        </div>
      )}

      {/* Error display */}
      {loadError && (vrmPathConfigured || hasDefaultVrm) && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-red-500/85 rounded-lg px-4 py-3 text-white text-sm max-w-xs" data-interactive="true">
            <div>{loadError}</div>
            <button
              type="button"
              onClick={handleSelectVRM}
              disabled={isSelectingVrm}
              className="mt-3 w-full px-3 py-2 rounded-md bg-white/20 hover:bg-white/30 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-medium transition-colors"
            >
              {isSelectingVrm ? t('avatar.selectVrm.opening') : t('avatar.changeVrm')}
            </button>
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
