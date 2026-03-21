import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useAutoUpdateStore } from './useAutoUpdate';
import { useSettingsStore } from '../stores/settingsStore';
import { useMonitorStore } from '../stores/monitorStore';
import { useAboutStore } from '../stores/aboutStore';

/**
 * macOS 네이티브 메뉴바 이벤트 리스너를 등록하는 훅.
 * - menu-check-update → 업데이트 확인
 * - menu-open-settings → 설정 패널 열기
 * - menu-move-monitor-next → 다음 모니터로 이동
 * - menu-about → About 모달 열기
 */
export function useMenuListeners(): void {
  useEffect(() => {
    const unlistenUpdate = listen('menu-check-update', () => {
      useAutoUpdateStore.getState().checkForUpdate();
    });
    const unlistenSettings = listen('menu-open-settings', () => {
      useSettingsStore.getState().openSettings();
    });
    const unlistenMonitor = listen('menu-move-monitor-next', () => {
      useMonitorStore.getState().moveToNextMonitor();
    });
    const unlistenAbout = listen('menu-about', () => {
      useAboutStore.getState().open();
    });

    return () => {
      unlistenUpdate.then((fn) => fn());
      unlistenSettings.then((fn) => fn());
      unlistenMonitor.then((fn) => fn());
      unlistenAbout.then((fn) => fn());
    };
  }, []);
}
