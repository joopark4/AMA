import { useEffect, useCallback } from 'react';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useAvatarStore } from '../stores/avatarStore';

export function useVRM(modelPath: string) {
  const {
    vrm,
    isLoading,
    loadError,
    setVRM,
    setIsLoading,
    setLoadError,
  } = useAvatarStore();

  const loadVRM = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    try {
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(
          modelPath,
          resolve,
          undefined,
          reject
        );
      });

      const loadedVRM = gltf.userData.vrm as VRM;

      if (!loadedVRM) {
        throw new Error('Failed to parse VRM data');
      }

      // Optimize
      VRMUtils.removeUnnecessaryJoints(gltf.scene);
      VRMUtils.removeUnnecessaryVertices(gltf.scene);

      setVRM(loadedVRM);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load VRM');
    } finally {
      setIsLoading(false);
    }
  }, [modelPath, setVRM, setIsLoading, setLoadError]);

  useEffect(() => {
    loadVRM();

    return () => {
      if (vrm) {
        VRMUtils.deepDispose(vrm.scene);
        setVRM(null);
      }
    };
  }, [modelPath]);

  return { vrm, isLoading, loadError, reload: loadVRM };
}

export default useVRM;
