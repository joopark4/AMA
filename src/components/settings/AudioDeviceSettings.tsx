/**
 * AudioDeviceSettings - 오디오 입력(마이크)/출력(스피커) 디바이스 선택 + 피크 미터
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { getSharedAudioContext } from '../../services/audio/sharedAudioContext';
import { ttsRouter } from '../../services/voice/ttsRouter';

export default function AudioDeviceSettings() {
  const { t } = useTranslation();
  const { settings, setSTTSettings, setTTSSettings } = useSettingsStore();

  // 디바이스 목록
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [micFallbackMessage, setMicFallbackMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // 마이크 피크 미터
  const [micLevel, setMicLevel] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micRafRef = useRef<number>(0);

  // --- 디바이스 열거 ---
  const refreshDevices = useCallback(async () => {
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      const hasLabels = devices.some((d) => d.label);
      if (!hasLabels && devices.some((d) => d.kind === 'audioinput')) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
          devices = await navigator.mediaDevices.enumerateDevices();
        } catch (err) {
          console.warn('Failed to get user media for device enumeration:', err);
        }
      }
      setMicrophones(devices.filter((d) => d.kind === 'audioinput'));
      setSpeakers(devices.filter((d) => d.kind === 'audiooutput'));
    } catch {
      setMicrophones([]);
      setSpeakers([]);
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
      };
    }
  }, [refreshDevices]);

  // 저장된 입력 deviceId 폴백
  useEffect(() => {
    const savedId = settings.stt.audioInputDeviceId;
    if (savedId && microphones.length > 0 && !microphones.some((d) => d.deviceId === savedId)) {
      setSTTSettings({ audioInputDeviceId: undefined });
      setMicFallbackMessage(t('settings.voice.stt.micFallback'));
    } else {
      setMicFallbackMessage(null);
    }
  }, [microphones, settings.stt.audioInputDeviceId, setSTTSettings, t]);

  // 저장된 출력 deviceId 폴백
  useEffect(() => {
    const savedId = settings.tts.audioOutputDeviceId;
    if (savedId && speakers.length > 0 && !speakers.some((d) => d.deviceId === savedId)) {
      setTTSSettings({ audioOutputDeviceId: undefined });
    }
  }, [speakers, settings.tts.audioOutputDeviceId, setTTSSettings]);

  // --- 마이크 피크 미터 ---
  // 마이크 변경 시 피크 미터 재시작
  useEffect(() => {
    let cancelled = false;

    const stopMeter = () => {
      cancelled = true;
      cancelAnimationFrame(micRafRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      micAnalyserRef.current = null;
      setMicLevel(0);
    };

    (async () => {
      // 기존 정리
      stopMeter();
      cancelled = false;

      try {
        const constraints: MediaStreamConstraints = {
          audio: settings.stt.audioInputDeviceId
            ? { deviceId: { exact: settings.stt.audioInputDeviceId } }
            : true,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // await 후 unmount/재호출 되었으면 스트림 즉시 해제
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;

        const ctx = getSharedAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        micAnalyserRef.current = analyser;

        const METER_SENSITIVITY = 3;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (cancelled) return;
          analyser.getByteFrequencyData(data);
          const sum = data.reduce((a, b) => a + b, 0);
          setMicLevel(Math.min(1, (sum / data.length / 255) * METER_SENSITIVITY));
          micRafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        if (!cancelled) setMicLevel(0);
      }
    })();

    return () => {
      stopMeter();
    };
  }, [settings.stt.audioInputDeviceId]);



  return (
    <div className="space-y-5">
      {/* 마이크 (입력) */}
      <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          {t('settings.audioDevice.microphone')}
        </h4>

        {microphones.length === 0 ? (
          <p className="text-xs text-gray-400">{t('settings.audioDevice.micNotFound')}</p>
        ) : (
          <select
            value={settings.stt.audioInputDeviceId || ''}
            onChange={(e) => {
              setSTTSettings({ audioInputDeviceId: e.target.value || undefined });
              setMicFallbackMessage(null);
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{t('settings.audioDevice.default')}</option>
            {microphones.map((mic, i) => {
              const isDefault = mic.deviceId === 'default' ||
                (!microphones.some((d) => d.deviceId === 'default') && i === 0);
              return (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {(mic.label || `Microphone (${mic.deviceId.slice(0, 12)}...)`) +
                    (isDefault ? ` (${t('settings.audioDevice.default')})` : '')}
                </option>
              );
            })}
          </select>
        )}
        {micFallbackMessage && (
          <p className="text-xs text-amber-600">{micFallbackMessage}</p>
        )}

        {/* 마이크 피크 미터 — 세그먼트 게이지 */}
        <div className="space-y-1">
          <span className="text-xs text-gray-500">{t('settings.audioDevice.inputLevel')}</span>
          <div className="flex gap-[2px] h-3">
            {Array.from({ length: 20 }, (_, i) => {
              const threshold = (i + 1) / 20;
              const active = micLevel >= threshold;
              let colorClass: string;
              if (i >= 16) colorClass = active ? 'bg-red-500' : 'bg-red-200';
              else if (i >= 12) colorClass = active ? 'bg-amber-500' : 'bg-amber-100';
              else colorClass = active ? 'bg-green-500' : 'bg-gray-200';
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-sm transition-colors duration-75 ${colorClass}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 스피커 (출력) */}
      <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          {t('settings.audioDevice.speaker')}
        </h4>

        {speakers.length === 0 ? (
          <p className="text-xs text-gray-400">{t('settings.audioDevice.speakerNotFound')}</p>
        ) : (
          <select
            value={settings.tts.audioOutputDeviceId || ''}
            onChange={(e) => {
              const deviceId = e.target.value || undefined;
              setTTSSettings({ audioOutputDeviceId: deviceId });
              // 사용자 클릭(제스처) 컨텍스트에서 setSinkId 미리 적용
              ttsRouter.prepareOutputDevice(deviceId);
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{t('settings.audioDevice.default')}</option>
            {speakers.map((spk, i) => {
              const isDefault = spk.deviceId === 'default' ||
                (!speakers.some((d) => d.deviceId === 'default') && i === 0);
              return (
                <option key={spk.deviceId} value={spk.deviceId}>
                  {(spk.label || `Speaker (${spk.deviceId.slice(0, 12)}...)`) +
                    (isDefault ? ` (${t('settings.audioDevice.default')})` : '')}
                </option>
              );
            })}
          </select>
        )}

        {/* 테스트 버튼 */}
        <button
          onClick={async () => {
            if (isTesting) return;
            setIsTesting(true);
            try {
              await ttsRouter.playTestBeep();
            } catch {
              // ignore
            } finally {
              setIsTesting(false);
            }
          }}
          disabled={isTesting}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
            isTesting
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
        >
          {isTesting ? t('settings.audioDevice.testing') : t('settings.audioDevice.testSpeaker')}
        </button>

      </div>
    </div>
  );
}
