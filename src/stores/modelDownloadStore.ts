import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface ModelStatus {
  supertonicReady: boolean;
  whisperBaseReady: boolean;
  whisperSmallReady: boolean;
  whisperMediumReady: boolean;
  supertonicVersionOk: boolean;
}

export interface DownloadProgress {
  modelType: string;
  fileName: string;
  downloadedBytes: number;
  totalBytes: number;
  fileIndex: number;
  totalFiles: number;
}

interface ModelDownloadState {
  status: ModelStatus | null;
  isChecking: boolean;
  isDownloading: boolean;
  currentModel: string | null;
  progress: DownloadProgress | null;
  error: string | null;

  checkModelStatus: () => Promise<ModelStatus>;
  downloadModel: (modelType: string) => Promise<void>;
  downloadRequiredModels: () => Promise<void>;
  clearError: () => void;
}

let progressUnlisten: UnlistenFn | null = null;

export const useModelDownloadStore = create<ModelDownloadState>()((set, get) => ({
  status: null,
  isChecking: false,
  isDownloading: false,
  currentModel: null,
  progress: null,
  error: null,

  checkModelStatus: async () => {
    set({ isChecking: true, error: null });
    try {
      const status = await invoke<ModelStatus>('check_model_status');
      set({ status, isChecking: false });
      return status;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[ModelDownload] checkModelStatus failed:', message);
      set({ isChecking: false, error: message });
      throw err;
    }
  },

  downloadModel: async (modelType: string) => {
    set({ isDownloading: true, currentModel: modelType, error: null, progress: null });

    // Start listening for progress events
    if (!progressUnlisten) {
      progressUnlisten = await listen<DownloadProgress>('model-download-progress', (event) => {
        set({ progress: event.payload });
      });
    }

    try {
      await invoke('download_model', { modelType });

      // Refresh status after download
      const status = await invoke<ModelStatus>('check_model_status');
      set({ status, isDownloading: false, currentModel: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ isDownloading: false, currentModel: null, error: message });
      throw err;
    }
  },

  downloadRequiredModels: async () => {
    const { downloadModel, checkModelStatus } = get();

    try {
      const status = await checkModelStatus();

      if (!status.supertonicReady) {
        await downloadModel('supertonic');
      }

      // Re-check after supertonic download
      const updatedStatus = await checkModelStatus();

      if (!updatedStatus.whisperBaseReady) {
        await downloadModel('whisper-base');
      }

      // Final status check
      await checkModelStatus();
    } catch {
      // Error already set in downloadModel
    }
  },

  clearError: () => set({ error: null }),
}));
