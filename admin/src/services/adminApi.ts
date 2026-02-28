import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function getAccessToken(): Promise<string> {
  const { data } = await supabase!.auth.getSession();
  if (!data.session?.access_token) throw new Error('Not authenticated');
  return data.session.access_token;
}

async function callFunction(
  name: string,
  options: { method?: string; body?: unknown; params?: Record<string, string> } = {},
) {
  const token = await getAccessToken();
  const url = new URL(`${SUPABASE_URL}/functions/v1/${name}`);
  if (options.params) {
    Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    method: options.method || (options.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || 'Request failed');
  }
  return res.json();
}

export const adminApi = {
  getStats: () => callFunction('admin-stats'),

  getUsers: (
    params: { limit?: number; offset?: number; search?: string; plan?: string } = {},
  ) =>
    callFunction('admin-users', {
      params: {
        limit: String(params.limit || 20),
        offset: String(params.offset || 0),
        ...(params.search ? { search: params.search } : {}),
        ...(params.plan ? { plan: params.plan } : {}),
      },
    }),

  getUserDetail: (userId: string) =>
    callFunction('admin-users', { params: { userId } }),

  changePlan: (userId: string, planId: string, reason?: string) =>
    callFunction('admin-subscriptions', {
      body: { action: 'change-plan', userId, planId, reason },
    }),

  setQuotaOverride: (userId: string, creditLimit: number | null) =>
    callFunction('admin-subscriptions', {
      body: { action: 'set-quota-override', userId, creditLimit },
    }),

  toggleAdmin: (userId: string, isAdmin: boolean) =>
    callFunction('admin-subscriptions', {
      body: { action: 'toggle-admin', userId, isAdmin },
    }),

  getPlans: () => callFunction('admin-subscriptions', { method: 'GET' }),

  updatePlan: (
    planId: string,
    updates: { name?: string; monthlyCredits?: number; isActive?: boolean },
  ) =>
    callFunction('admin-subscriptions', {
      body: { action: 'update-plan', planId, ...updates },
    }),
};
