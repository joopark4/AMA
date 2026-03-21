import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../services/adminApi';
import PlanBadge from '../components/PlanBadge';
import QuotaBar from '../components/QuotaBar';

interface UserProfile {
  id: string;
  email: string;
  nickname: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  is_premium: boolean;
  plan_id: string;
  monthly_credit_limit_override: number | null;
  created_at: string;
  last_sign_in_at?: string | null;
}

interface UserUsage {
  monthlyUsed: number;
  monthlySeconds: number;
  monthlyCharacters: number;
  monthlyRequests: number;
}

interface HistoryEntry {
  id: string;
  old_plan_id: string | null;
  new_plan_id: string;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

interface UserDetailResponse {
  user: UserProfile;
  usage: UserUsage;
  history: HistoryEntry[];
}

interface PlanOption {
  id: string;
  name: string;
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<UserDetailResponse | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPlan, setSelectedPlan] = useState('');
  const [planReason, setPlanReason] = useState('');
  const [quotaOverride, setQuotaOverride] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([adminApi.getUserDetail(id), adminApi.getPlans()])
      .then(([userData, plansData]) => {
        setDetail(userData);
        setPlans(plansData.plans || []);
        setSelectedPlan(userData.user.plan_id);
        setQuotaOverride(
          userData.user.monthly_credit_limit_override != null
            ? String(userData.user.monthly_credit_limit_override)
            : '',
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleChangePlan = async () => {
    if (!id || !selectedPlan) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await adminApi.changePlan(id, selectedPlan, planReason || undefined);
      const updated = await adminApi.getUserDetail(id);
      setDetail(updated);
      setPlanReason('');
      setSaveMsg('Plan updated successfully');
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Failed to update plan');
    } finally {
      setSaving(false);
    }
  };

  const handleQuotaOverride = async () => {
    if (!id) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const value = quotaOverride.trim() === '' ? null : Number(quotaOverride);
      await adminApi.setQuotaOverride(id, value);
      const updated = await adminApi.getUserDetail(id);
      setDetail(updated);
      setSaveMsg('Quota override updated');
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Failed to update quota');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAdmin = async () => {
    if (!id || !detail) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await adminApi.toggleAdmin(id, !detail.user.is_admin);
      const updated = await adminApi.getUserDetail(id);
      setDetail(updated);
      setSaveMsg(`Admin ${updated.user.is_admin ? 'granted' : 'revoked'}`);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Failed to toggle admin');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-gray-400 text-center py-12">Loading user details...</div>;
  }

  if (error || !detail) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error || 'User not found'}
        <button
          onClick={() => navigate('/users')}
          className="ml-4 text-blue-600 hover:underline"
        >
          Back to Users
        </button>
      </div>
    );
  }

  const { user, usage, history } = detail;

  return (
    <div>
      <button
        onClick={() => navigate('/users')}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Users
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
          {(user.email[0] ?? '?').toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{user.email}</h1>
          <p className="text-gray-500">
            {user.nickname || 'No nickname'} {user.is_admin && '(Admin)'}
          </p>
        </div>
      </div>

      {saveMsg && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-700 text-sm mb-4">
          {saveMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">User Info</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Email</dt>
              <dd className="text-sm text-gray-900">{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Nickname</dt>
              <dd className="text-sm text-gray-900">{user.nickname || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Admin</dt>
              <dd className="text-sm">
                <button
                  onClick={handleToggleAdmin}
                  disabled={saving}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    user.is_admin
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {user.is_admin ? 'Yes' : 'No'} (click to toggle)
                </button>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Registered</dt>
              <dd className="text-sm text-gray-900">
                {new Date(user.created_at).toLocaleDateString()}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Last Sign In</dt>
              <dd className="text-sm text-gray-900">
                {user.last_sign_in_at
                  ? new Date(user.last_sign_in_at).toLocaleDateString()
                  : 'Never'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Subscription */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h2>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-500">Current Plan:</span>
              <PlanBadge plan={user.plan_id} />
            </div>
            <QuotaBar
              used={usage.monthlyUsed}
              limit={user.monthly_credit_limit_override ?? 0}
              label="Credit Usage"
            />
          </div>

          <div className="border-t pt-4 space-y-4">
            {/* Plan Change */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Change Plan
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleChangePlan}
                  disabled={saving || selectedPlan === user.plan_id}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
              <input
                type="text"
                placeholder="Reason (optional)"
                value={planReason}
                onChange={(e) => setPlanReason(e.target.value)}
                className="w-full mt-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Quota Override */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quota Override
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Leave empty to use plan default"
                  value={quotaOverride}
                  onChange={(e) => setQuotaOverride(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  onClick={handleQuotaOverride}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50"
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription History */}
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription History</h2>
          {history.length === 0 ? (
            <p className="text-gray-400 text-sm">No subscription history.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                      Change
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                      New Plan
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.map((h) => (
                    <tr key={h.id} className="text-sm">
                      <td className="py-2 px-3 text-gray-500">
                        {new Date(h.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-gray-900">
                        {h.old_plan_id ?? '-'} &rarr; {h.new_plan_id}
                      </td>
                      <td className="py-2 px-3">
                        <PlanBadge plan={h.new_plan_id} />
                      </td>
                      <td className="py-2 px-3 text-gray-500">{h.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
