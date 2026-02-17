import { invoke } from '@tauri-apps/api/core';

export class Permissions {
  /**
   * Open system settings for microphone permission
   */
  async openMicrophoneSettings(): Promise<void> {
    console.log('[Permissions] Calling open_microphone_settings...');
    try {
      await invoke('open_microphone_settings');
      console.log('[Permissions] open_microphone_settings succeeded');
    } catch (error) {
      console.error('[Permissions] Failed to open microphone settings:', error);
      throw error;
    }
  }

  /**
   * Open system settings for screen recording permission
   */
  async openScreenRecordingSettings(): Promise<void> {
    try {
      await invoke('open_screen_recording_settings');
    } catch (error) {
      console.error('Failed to open screen recording settings:', error);
      throw error;
    }
  }

  /**
   * Open system settings for accessibility permission
   */
  async openAccessibilitySettings(): Promise<void> {
    try {
      await invoke('open_accessibility_settings');
    } catch (error) {
      console.error('Failed to open accessibility settings:', error);
      throw error;
    }
  }

  async requestMicrophoneAccess(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately, we just needed to request permission
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone access denied:', error);
      return false;
    }
  }

  async requestScreenCaptureAccess(): Promise<boolean> {
    // On macOS, screen capture permission is requested when first capturing
    // We can't pre-request it, so we just return true and handle errors during capture
    return true;
  }

  async checkMicrophoneAccess(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state === 'granted';
    } catch {
      // Some browsers don't support querying microphone permission
      return false;
    }
  }

  async requestAllPermissions(): Promise<{
    microphone: boolean;
    screenCapture: boolean;
  }> {
    const [microphone, screenCapture] = await Promise.all([
      this.requestMicrophoneAccess(),
      this.requestScreenCaptureAccess(),
    ]);

    return { microphone, screenCapture };
  }
}

export const permissions = new Permissions();
export default permissions;
