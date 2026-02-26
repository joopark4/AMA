import { invoke } from '@tauri-apps/api/core';

export interface WindowSize {
  width: number;
  height: number;
}

export interface CursorPosition {
  x: number;
  y: number;
}

export interface MonitorInfo {
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  scale_factor: number;
}

export class WindowManager {
  private isClickThroughEnabled = false;

  async setIgnoreCursorEvents(ignore: boolean): Promise<void> {
    await invoke('set_ignore_cursor_events', { ignore });
    this.isClickThroughEnabled = ignore;
  }

  async enableClickThrough(): Promise<void> {
    await this.setIgnoreCursorEvents(true);
  }

  async disableClickThrough(): Promise<void> {
    await this.setIgnoreCursorEvents(false);
  }

  isClickThrough(): boolean {
    return this.isClickThroughEnabled;
  }

  async setPosition(x: number, y: number): Promise<void> {
    await invoke('set_window_position', { x, y });
  }

  async getSize(): Promise<WindowSize> {
    return await invoke<WindowSize>('get_window_size');
  }

  async toggleClickThrough(): Promise<boolean> {
    await this.setIgnoreCursorEvents(!this.isClickThroughEnabled);
    return this.isClickThroughEnabled;
  }

  async getCursorPosition(): Promise<CursorPosition> {
    return await invoke<CursorPosition>('get_cursor_position');
  }

  async getAvailableMonitors(): Promise<MonitorInfo[]> {
    return await invoke<MonitorInfo[]>('get_available_monitors');
  }

  async moveToMonitor(monitorIndex: number): Promise<MonitorInfo> {
    return await invoke<MonitorInfo>('move_to_monitor', { monitorIndex });
  }

  async getCurrentMonitor(): Promise<MonitorInfo> {
    return await invoke<MonitorInfo>('get_current_monitor');
  }

  async logToTerminal(message: string): Promise<void> {
    await invoke('log_to_terminal', { message });
  }
}

export const windowManager = new WindowManager();
export default windowManager;
