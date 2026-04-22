/**
 * AvatarRestingBadge — 아바타 숨김 상태 안내 (v2 리디자인).
 *
 * `settings.avatarHidden`이 true일 때 ControlCluster의 메뉴바 위 슬롯에
 * 작은 글래시 pill로 표시되어 아바타가 사라진 게 아니라 일시 휴식 중임을 알린다.
 * ControlCluster의 아바타 숨김 토글로 다시 띄울 수 있다.
 *
 * 이름 결정:
 *   character.name 만 사용. settings.avatarName은 OAuth 닉네임으로 자동
 *   덮어써지는 경우가 있어(App.tsx) 폴백에서 제외 — 계정 이름이 노출되는
 *   문제를 방지. character.name이 비어 있으면 i18n fallback("아바타").
 *
 * pointer-events:none — 클릭스루 통과. 인터랙션 없음.
 */
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';

export default function AvatarRestingBadge() {
  const { t } = useTranslation();
  const characterName = useSettingsStore((s) => s.settings.character?.name);

  const name = (characterName || '').trim() || t('app.avatarFallback', '아바타');

  return (
    <div
      className="pointer-events-none"
      style={{
        animation: 'fadeOverlay 220ms var(--ease)',
      }}
      aria-hidden="true"
    >
      <div
        style={{
          padding: '8px 14px',
          borderRadius: 999,
          background: 'oklch(1 0 0 / 0.5)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          boxShadow: 'inset 0 0 0 1px var(--hairline), var(--shadow-sm)',
          color: 'var(--ink-3)',
          fontSize: 12.5,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {t('overlay.avatarResting', { name })}
      </div>
    </div>
  );
}
