/**
 * SettingsPanel — 우측 슬라이드 인 글래시 패널 (v2 리디자인).
 *
 * 핸드오프 04-components.md spec:
 * - top:64+, right:12, bottom:12, width:420
 * - .glass-strong + panelIn 320ms
 * - 헤더: 설정 / 부제 / X 버튼
 * - 사용자 pill (헤더 아래) — 아바타 이니셜 + 이름 + 이메일 · "관리"
 * - 섹션 리스트(스크롤): 새 SettingsSection(아이콘 칩) + forms 프리미티브
 *
 * 주의: 기존 handleSave는 manualRotation을 initialViewRotation에 저장한다.
 * 명시적 Save 버튼이 없어졌으므로 모든 close 경로(X, 백드롭, ESC)에서 호출.
 * Reset은 스크롤 하단에 작은 텍스트 버튼으로 유지.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Brain,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Code,
  Download,
  Globe,
  Mic,
  Monitor as MonitorIcon,
  ScanEye,
  ScrollText,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
  User,
  UserRound,
  Volume2,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAvatarStore } from '../../stores/avatarStore';
import SettingsSection from '../settings/SettingsSection';
import UserProfile from '../auth/UserProfile';
import LLMSettings from '../settings/LLMSettings';
import AudioDeviceSettings from '../settings/AudioDeviceSettings';
import VoiceSettings from '../settings/VoiceSettings';
import { PremiumVoiceSettings } from '../../features/premium-voice';
import AvatarSettings from '../settings/AvatarSettings';
import CharacterSettings from '../settings/CharacterSettings';
import LicensesSettings from '../settings/LicensesSettings';
import UpdateSettings from '../settings/UpdateSettings';
import DataCleanupSettings from '../settings/DataCleanupSettings';
import { MCPSettings } from '../../features/channels';
import { ScreenWatchSettings } from '../../features/screen-watch';
import { QuickActionsSettings } from '../../features/quick-actions';
import MonitorSettings from '../settings/MonitorSettings';

/* ─────────────────────── User pill (헤더용 컴팩트) ─────────────────────── */

function HeaderUserPill() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();

  const displayName = isAuthenticated && user
    ? user.nickname
    : t('settings.guestUser');
  const subtitle = isAuthenticated && user
    ? user.email
    : t('settings.loggedOut');
  const initial = isAuthenticated && user && user.nickname
    ? user.nickname.charAt(0).toUpperCase()
    : '?';

  return (
    <div
      className="flex items-center"
      style={{
        padding: '12px 14px',
        borderRadius: 16,
        background: 'oklch(1 0 0 / 0.55)',
        boxShadow: 'inset 0 0 0 1px var(--hairline)',
        gap: 12,
      }}
    >
      <div
        className="grid place-items-center shrink-0"
        style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), var(--glow))',
          color: 'white',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="truncate"
          style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}
        >
          {displayName}
        </div>
        <div
          className="truncate"
          style={{ fontSize: 11.5, color: 'var(--ink-3)' }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── 메인 SettingsPanel ─────────────────────── */

export default function SettingsPanel() {
  const { t } = useTranslation();
  const { closeSettings, resetSettings, setAvatarSettings } = useSettingsStore();
  const { manualRotation } = useAvatarStore();

  /** 닫기 + 현재 manualRotation을 initialViewRotation에 저장 */
  const handleClose = () => {
    setAvatarSettings({
      initialViewRotation: {
        x: Math.max(-0.5, Math.min(0.5, manualRotation.x)),
        y: manualRotation.y,
      },
    });
    closeSettings();
  };

  // ESC로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualRotation.x, manualRotation.y]);

  const handleResetAll = () => {
    if (window.confirm(t('settings.resetConfirm'))) {
      resetSettings();
    }
  };

  /* ─── 가로 스크롤 페이지 네비게이션 ─── */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // 1px 미만 차이는 노이즈 (트랙패드 스크롤 등) — 작은 epsilon으로 양 끝 판단
    const SCROLL_EDGE_EPSILON = 4;
    setCanScrollLeft(el.scrollLeft > SCROLL_EDGE_EPSILON);
    setCanScrollRight(
      el.scrollLeft + el.clientWidth < el.scrollWidth - SCROLL_EDGE_EPSILON
    );
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => updateScrollState();
    el.addEventListener('scroll', handleScroll, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      ro.disconnect();
    };
  }, [updateScrollState]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="fixed inset-0 z-[100]" data-interactive="true">
      {/* Backdrop — 클릭 시 닫힘 */}
      <div
        className="absolute inset-0"
        onClick={handleClose}
        style={{
          background: 'oklch(0.2 0 0 / 0.16)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          animation: 'fadeOverlay 200ms var(--ease)',
        }}
        data-interactive="true"
      />

      {/* Panel — 우측 슬라이드 인 (멀티컬럼: 너비에 따라 자동 분배) */}
      <div
        className="glass-strong absolute flex flex-col overflow-hidden"
        style={{
          top: 'max(env(safe-area-inset-top), 64px)',
          right: 12,
          bottom: 12,
          // 화면 너비에 비례해 확장 (단일 컬럼 ~420 → 최대 3컬럼 ~1200)
          width: 'min(1200px, calc(100vw - 24px))',
          minWidth: 'min(420px, calc(100vw - 24px))',
          padding: 0,
          animation: 'panelIn 320ms var(--ease)',
        }}
        data-interactive="true"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '20px 22px 16px', gap: 12 }}
        >
          <div className="min-w-0">
            <div
              style={{
                fontSize: 19,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--ink)',
              }}
            >
              {t('settings.title')}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: 'var(--ink-3)',
                marginTop: 2,
              }}
            >
              {t('settings.subtitle')}
            </div>
          </div>

          <div className="flex items-center" style={{ gap: 8 }}>
            {/* 페이지 네비게이션 (가로 스크롤 양 끝 도달 시 비활성) */}
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              disabled={!canScrollLeft}
              className="grid place-items-center focus-ring"
              style={{
                width: 32,
                height: 32,
                borderRadius: 99,
                background: 'oklch(1 0 0 / 0.5)',
                boxShadow: 'inset 0 0 0 1px var(--hairline)',
                color: canScrollLeft ? 'var(--ink-2)' : 'var(--ink-4)',
                opacity: canScrollLeft ? 1 : 0.4,
                cursor: canScrollLeft ? 'pointer' : 'not-allowed',
                transition: 'opacity 160ms var(--ease)',
              }}
              title="이전 페이지"
              aria-label="Previous page"
              data-interactive="true"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              disabled={!canScrollRight}
              className="grid place-items-center focus-ring"
              style={{
                width: 32,
                height: 32,
                borderRadius: 99,
                background: 'oklch(1 0 0 / 0.5)',
                boxShadow: 'inset 0 0 0 1px var(--hairline)',
                color: canScrollRight ? 'var(--ink-2)' : 'var(--ink-4)',
                opacity: canScrollRight ? 1 : 0.4,
                cursor: canScrollRight ? 'pointer' : 'not-allowed',
                transition: 'opacity 160ms var(--ease)',
              }}
              title="다음 페이지"
              aria-label="Next page"
              data-interactive="true"
            >
              <ChevronRight size={16} />
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="grid place-items-center focus-ring"
              style={{
                width: 32,
                height: 32,
                borderRadius: 99,
                background: 'oklch(1 0 0 / 0.5)',
                boxShadow: 'inset 0 0 0 1px var(--hairline)',
                color: 'var(--ink-2)',
              }}
              title={t('history.close')}
              data-interactive="true"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* User pill */}
        <div style={{ padding: '0 22px 14px' }}>
          <HeaderUserPill />
        </div>

        {/* Sections — CSS columns 가로 흐름 + overflow-x로 페이지 스크롤.
            높이는 패널 가용 영역에 고정되어 콘텐츠가 가로로 흘러 페이지 단위로 이동. */}
        <div
          ref={scrollRef}
          className="scroll flex-1"
          style={{
            padding: '0 22px 22px',
            columnWidth: 340,
            columnGap: 14,
            columnFill: 'auto',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollBehavior: 'smooth',
          }}
          data-interactive="true"
        >
          {[
            { key: 'lang', icon: <Globe size={16} />, title: t('settings.language'), Comp: LanguageSection, defaultOpen: true },
            { key: 'llm', icon: <Brain size={16} />, title: t('settings.llm.title'), Comp: LLMSettings, defaultOpen: true },
            { key: 'audio', icon: <Volume2 size={16} />, title: t('settings.audioDevice.title'), Comp: AudioDeviceSettings, defaultOpen: true },
            { key: 'voice', icon: <Mic size={16} />, title: t('settings.voice.title'), Comp: VoiceSettings, defaultOpen: true },
            { key: 'premium', icon: <Cloud size={16} />, title: t('settings.premium.title'), Comp: PremiumVoiceSettings, defaultOpen: true },
            { key: 'character', icon: <User size={16} />, title: t('settings.character.title'), Comp: CharacterSettings, defaultOpen: true },
            { key: 'quick', icon: <Sparkles size={16} />, title: t('settings.quickActions.title'), Comp: QuickActionsSettings, defaultOpen: true },
            { key: 'avatar', icon: <Box size={16} />, title: t('settings.avatar.title'), Comp: AvatarSettings, defaultOpen: true },
            { key: 'screen', icon: <ScanEye size={16} />, title: t('settings.screenWatch.title', '화면 관찰'), Comp: ScreenWatchSettings, defaultOpen: true },
            { key: 'monitor', icon: <MonitorIcon size={16} />, title: t('settings.monitor.title'), Comp: MonitorSettings, defaultOpen: true },
            { key: 'mcp', icon: <Code size={16} />, title: t('settings.mcp.title'), Comp: MCPSettings, defaultOpen: true },
            { key: 'update', icon: <Download size={16} />, title: t('settings.update.title'), Comp: UpdateSettings, defaultOpen: true },
            { key: 'account', icon: <UserRound size={16} />, title: t('settings.account.title'), Comp: UserProfile, defaultOpen: true },
            { key: 'cleanup', icon: <Trash2 size={16} />, title: t('settings.dataCleanup.title'), Comp: DataCleanupSettings, defaultOpen: true },
            { key: 'licenses', icon: <ScrollText size={16} />, title: t('settings.licenses.title'), Comp: LicensesSettings, defaultOpen: false },
          ].map(({ key, icon, title, Comp, defaultOpen }) => (
            <div
              key={key}
              style={{
                breakInside: 'avoid',
                pageBreakInside: 'avoid',
                marginBottom: 12,
              }}
            >
              <SettingsSection icon={icon} title={title} defaultOpen={defaultOpen}>
                <Comp />
              </SettingsSection>
            </div>
          ))}

          {/* 전체 초기화 — 마지막 컬럼 끝에 위치 */}
          <div
            style={{
              breakInside: 'avoid',
              pageBreakInside: 'avoid',
              textAlign: 'center',
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={handleResetAll}
              className="focus-ring"
              style={{
                padding: '10px 14px',
                fontSize: 11.5,
                color: 'var(--ink-3)',
                background: 'transparent',
                borderRadius: 8,
              }}
              data-interactive="true"
            >
              <SettingsIcon size={11} className="inline mr-1.5 align-text-bottom" />
              {t('settings.resetAll')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── 작은 인라인 섹션: 언어 ─────────────────────── */

function LanguageSection() {
  const { t } = useTranslation();
  const { settings, setLanguage } = useSettingsStore();
  return (
    <div style={{ padding: '4px 0' }}>
      <label
        className="block"
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: 'var(--ink-2)',
          marginBottom: 6,
        }}
      >
        {t('settings.language')}
      </label>
      <select
        value={settings.language}
        onChange={(e) => setLanguage(e.target.value as 'ko' | 'en' | 'ja')}
        className="focus-ring w-full appearance-none"
        style={{
          padding: '9px 12px',
          fontSize: 13.5,
          borderRadius: 10,
          border: 0,
          background: 'oklch(1 0 0 / 0.7)',
          boxShadow: 'inset 0 0 0 1px var(--hairline)',
          color: 'var(--ink)',
        }}
        data-interactive="true"
      >
        <option value="ko">한국어</option>
        <option value="en">English</option>
        <option value="ja">日本語</option>
      </select>
    </div>
  );
}
