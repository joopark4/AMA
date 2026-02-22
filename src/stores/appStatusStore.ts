import { create } from 'zustand';

interface AppStatusState {
  globalShortcutRegisterError: string | null;
  setGlobalShortcutRegisterError: (error: string | null) => void;
}

export const useAppStatusStore = create<AppStatusState>((set) => ({
  globalShortcutRegisterError: null,
  setGlobalShortcutRegisterError: (error) => set({ globalShortcutRegisterError: error }),
}));
