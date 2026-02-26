import { create } from 'zustand';
import { windowManager, type MonitorInfo } from '../services/tauri/windowManager';
import { useSettingsStore } from './settingsStore';

interface MonitorState {
  monitors: MonitorInfo[];
  currentMonitorName: string;
  isMoving: boolean;
  fetchMonitors: () => Promise<void>;
  moveToMonitor: (index: number) => Promise<void>;
  moveToNextMonitor: () => Promise<void>;
}

export const useMonitorStore = create<MonitorState>()((set, get) => ({
  monitors: [],
  currentMonitorName: '',
  isMoving: false,

  fetchMonitors: async () => {
    try {
      const monitors = await windowManager.getAvailableMonitors();
      const current = await windowManager.getCurrentMonitor();
      set({ monitors, currentMonitorName: current.name });
    } catch (error) {
      console.error('Failed to fetch monitors:', error);
    }
  },

  moveToMonitor: async (index: number) => {
    const { monitors, isMoving } = get();
    if (isMoving || index < 0 || index >= monitors.length) return;

    set({ isMoving: true });
    try {
      const result = await windowManager.moveToMonitor(index);
      set({ currentMonitorName: result.name });
      useSettingsStore.getState().setSettings({ preferredMonitorName: result.name });
    } catch (error) {
      console.error('Failed to move to monitor:', error);
    } finally {
      set({ isMoving: false });
    }
  },

  moveToNextMonitor: async () => {
    const { monitors, currentMonitorName } = get();
    if (monitors.length <= 1) return;

    // If currentMonitorName is not found, currentIndex is -1 → nextIndex becomes 0 (first monitor).
    const currentIndex = monitors.findIndex((m) => m.name === currentMonitorName);
    const nextIndex = (currentIndex + 1) % monitors.length;
    await get().moveToMonitor(nextIndex);
  },
}));
