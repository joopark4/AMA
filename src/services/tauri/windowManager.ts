import { invoke } from '@tauri-apps/api/core';

export interface WindowSize {
  width: number;
  height: number;
}

export interface CursorPosition {
  x: number;
  y: number;
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
}

export const windowManager = new WindowManager();
export default windowManager;
