import { useTranslation } from 'react-i18next';
import { authService } from '../../services/auth/authService';
import { useAuthStore } from '../../stores/authStore';

export default function UserProfile() {
  const { t } = useTranslation();
  const { user, tokens, logout, setLoading } = useAuthStore();

  if (!user) return null;

  const handleLogout = async () => {
    if (!window.confirm(t('auth.logoutConfirm'))) return;
    setLoading(true);
    try {
      if (tokens?.accessToken) {
        await authService.logout(tokens.accessToken);
      }
    } catch {
      // 로그아웃 API 실패해도 로컬 상태는 초기화
    } finally {
      logout();
      setLoading(false);
    }
  };

  const joinedDate = new Date(user.createdAt).toLocaleDateString();
  const providerLabel = t(`auth.providers.${user.provider}`);

  return (
    <div className="space-y-3 pt-3 border-t border-gray-200">
      <h3 className="text-sm font-semibold text-gray-700">{t('auth.profile.title')}</h3>

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">{t('auth.profile.nickname')}</span>
          <span className="font-medium text-gray-800 truncate max-w-[160px]">{user.nickname}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{t('auth.profile.email')}</span>
          <span className="text-gray-700 truncate max-w-[160px]">{user.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{t('auth.profile.provider')}</span>
          <span className="text-gray-700">{providerLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{t('auth.profile.joinedAt')}</span>
          <span className="text-gray-700">{joinedDate}</span>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full mt-2 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors"
      >
        {t('auth.logout')}
      </button>
    </div>
  );
}
