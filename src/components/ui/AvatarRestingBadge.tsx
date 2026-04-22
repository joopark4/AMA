/**
 * AvatarRestingBadge — 아바타 숨김 상태 안내 (v2 리디자인).
 *
 * `settings.avatarHidden`이 true일 때 ControlCluster의 메뉴바 위 슬롯에
 * 작은 글래시 pill로 표시되어 아바타가 사라진 게 아니라 일시 휴식 중임을 알린다.
 * ControlCluster의 아바타 숨김 토글로 다시 띄울 수 있다.
 *
 * 이름 결정:
 *   1) settings.character.name (캐릭터 설정 입력)
 *   2) settings.avatarName (onboarding 입력)
 *   3) i18n fallback ("아바타")
 *   App.tsx에서 OAuth 닉네임을 avatarName으로 자동 set 하던 로직은 제거되어,
 *   여기서 노출되는 이름은 사용자가 명시적으로 입력한 값만 사용된다.
 *
 * pointer-events:none — 클릭스루 통과. 인터랙션 없음.
 */
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';

export default function AvatarRestingBadge() {
  const { t } = useTranslation();
  const characterName = useSettingsStore((s) => s.settings.character?.name);
  const avatarName = useSettingsStore((s) => s.settings.avatarName);

  const name =
    (characterName || '').trim() ||
    (avatarName || '').trim() ||
    t('app.avatarFallback', '아바타');

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
