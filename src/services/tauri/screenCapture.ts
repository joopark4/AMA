import { invoke } from '@tauri-apps/api/core';

export interface ScreenshotResult {
  data: string; // base64 encoded PNG
  width: number;
  height: number;
}

export class ScreenCapture {
  async capture(): Promise<ScreenshotResult> {
    return await invoke<ScreenshotResult>('capture_screen');
  }

  async captureAsBlob(): Promise<Blob> {
    const result = await this.capture();
    const binaryString = atob(result.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'image/png' });
  }

  async captureAsDataUrl(): Promise<string> {
    const result = await this.capture();
    return `data:image/png;base64,${result.data}`;
  }
}

export const screenCapture = new ScreenCapture();
export default screenCapture;
