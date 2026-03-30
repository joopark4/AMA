/**
 * 프리미엄 상태/음성목록/사용량/할당량 관리 스토어
 */
import { create } from 'zustand';
import { callEdgeFunction, ensureSession } from '../../services/auth/edgeFunctionClient';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/auth/supabaseClient';

export interface SupertoneSample {
  language: string;
  style: string;
  model: string;
  url: string;
}

export interface SupertoneVoice {
  voice_id: string;
  name: string;
  gender: string;
  languages: string[];
  styles: string[];
  samples?: SupertoneSample[];
}

export interface QuotaInfo {
  limit: number;
  used: number;
  remaining: number;
}

export interface ApiCreditsInfo {
  balance: number;
  used: number;
  total: number;
}

export interface UsageRecord {
  date: string;
  seconds: number;
  characters: number;
  requests: number;
}

interface UsageSummary {
  totalSeconds: number;
  totalCharacters: number;
  totalRequests: number;
}

interface VoiceSearchFilters {
  language?: string;
  style?: string;
  gender?: string;
}

/** 음성 목록 캐시 유효 기간: 7일 */
const VOICES_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const APP_VERSION = __APP_VERSION__;

interface PremiumState {
  isPremium: boolean;
  isAdmin: boolean;
  isChecking: boolean;
  voices: SupertoneVoice[];
  isLoadingVoices: boolean;
  voicesFetchedAt: number | null;
  voicesFetchedVersion: string | null;

  quota: QuotaInfo | null;
  isQuotaExceeded: boolean;
  apiCredits: ApiCreditsInfo | null;

  usageSummary: UsageSummary | null;
  usageDaily: UsageRecord[] | null;
  isLoadingUsage: boolean;

  checkPremiumStatus: () => Promise<void>;
  fetchVoices: (filters?: VoiceSearchFilters) => Promise<void>;
  refreshVoices: () => Promise<void>;
  fetchUsageSummary: () => Promise<void>;
  fetchUsageDaily: () => Promise<void>;
  updateQuotaFromTtsResponse: (headers: Headers) => void;
  reset: () => void;
}

/** checkPremiumStatus 이중 호출 방지 (React StrictMode) */
let checkingPromise: Promise<void> | null = null;

export const usePremiumStore = create<PremiumState>((set, get) => ({
  isPremium: false,
  isAdmin: false,
  isChecking: false,
  voices: [],
  isLoadingVoices: false,
  voicesFetchedAt: null,
  voicesFetchedVersion: null,

  quota: null,
  isQuotaExceeded: false,
  apiCredits: null,

  usageSummary: null,
  usageDaily: null,
  isLoadingUsage: false,

  checkPremiumStatus: async () => {
    // 이미 실행 중이면 기존 Promise 재사용 (이중 호출 방지)
    if (checkingPromise) return checkingPromise;
    checkingPromise = (async () => {
    const { isAuthenticated, user, tokens } = useAuthStore.getState();
    if (!isAuthenticated || !user || !supabase || !tokens) {
      set({ isPremium: false, isChecking: false });
      return;
    }

    set({ isChecking: true });
    try {
      // 세션 복원을 edgeFunctionClient와 동일한 경로로 통일
      // (동시 호출 시 refresh token 경합 방지)
      try {
        await ensureSession();
      } catch (sessionErr) {
        const msg = sessionErr instanceof Error ? sessionErr.message : String(sessionErr);
        if (msg.includes('Not authenticated') || msg.includes('Session restore failed')) {
          set({ isPremium: false, isChecking: false });
          return;
        }
      }

      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('is_premium, is_admin, plan_id, monthly_credit_limit_override')
        .eq('id', user.id)
        .single();

      if (queryError) {
        console.warn('[PremiumStore] Profile query error:', queryError.message);
      }

      if (data) {
        let creditLimit = 0;
        if (data.monthly_credit_limit_override != null) {
          creditLimit = data.monthly_credit_limit_override;
        } else {
          const { data: plan } = await supabase
            .from('subscription_plans')
            .select('monthly_credit_limit')
            .eq('id', data.plan_id)
            .single();
          creditLimit = plan?.monthly_credit_limit ?? 0;
        }

        set({
          isPremium: data.is_premium || data.is_admin === true,
          isAdmin: data.is_admin === true,
          quota: get().quota
            ? { ...get().quota!, limit: creditLimit }
            : { limit: creditLimit, used: 0, remaining: creditLimit },
        });
      }
    } catch (err) {
      console.error('[PremiumStore] Failed to check premium status:', err);
    } finally {
      set({ isChecking: false });
    }
    })();
    try {
      await checkingPromise;
    } finally {
      checkingPromise = null;
    }
  },

  fetchVoices: async (_filters?: VoiceSearchFilters) => {
    const { voices, voicesFetchedAt, voicesFetchedVersion } = get();

    // 캐시 유효성 검사: 목록이 있고, 7일 이내이고, 앱 버전이 같으면 생략
    if (voices.length > 0 && voicesFetchedAt && voicesFetchedVersion) {
      const isExpired = Date.now() - voicesFetchedAt > VOICES_CACHE_TTL;
      const isVersionChanged = voicesFetchedVersion !== APP_VERSION;
      if (!isExpired && !isVersionChanged) return;
    }

    await get().refreshVoices();
  },

  refreshVoices: async () => {
    set({ isLoadingVoices: true });
    try {
      const data = await callEdgeFunction<unknown>('supertone-voices', { params: {} });

      // Supertone API 응답 형식: { items: [...], total: N } 또는 배열
      let voiceList: SupertoneVoice[];
      if (Array.isArray(data)) {
        voiceList = data;
      } else if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        if (Array.isArray(obj.items)) {
          voiceList = obj.items as SupertoneVoice[];
        } else if (Array.isArray(obj.voices)) {
          voiceList = obj.voices as SupertoneVoice[];
        } else {
          console.warn('[PremiumStore] Unexpected voices response format');
          voiceList = [];
        }
      } else {
        voiceList = [];
      }

      // Supertone API의 'language' 필드를 'languages'로 정규화
      voiceList = voiceList.map(v => ({
        ...v,
        languages: v.languages || (v as unknown as { language?: string[] }).language || [],
      }));

      set({
        voices: voiceList,
        voicesFetchedAt: Date.now(),
        voicesFetchedVersion: APP_VERSION,
      });
    } catch (err) {
      console.error('[PremiumStore] Failed to fetch voices:', err);
      set({ voices: [] });
    } finally {
      set({ isLoadingVoices: false });
    }
  },

  fetchUsageSummary: async () => {
    set({ isLoadingUsage: true });
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endDate = now.toISOString();
      const { isAdmin } = get();

      const data = await callEdgeFunction<{
        totalSeconds: number;
        totalCharacters: number;
        totalRequests: number;
        quota: QuotaInfo;
        apiCredits?: ApiCreditsInfo;
      }>('supertone-usage', {
        body: { type: 'summary', startDate, endDate, ...(isAdmin ? { scope: 'all' } : {}) },
      });

      set({
        usageSummary: {
          totalSeconds: data.totalSeconds,
          totalCharacters: data.totalCharacters,
          totalRequests: data.totalRequests,
        },
        quota: data.quota,
        isQuotaExceeded: isAdmin ? false : data.quota.remaining <= 0,
        apiCredits: data.apiCredits ?? null,
      });
    } catch (err) {
      console.error('[PremiumStore] Failed to fetch usage summary:', err);
    } finally {
      set({ isLoadingUsage: false });
    }
  },

  fetchUsageDaily: async () => {
    try {
      const now = new Date();
      const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = now.toISOString();
      const { isAdmin } = get();

      const data = await callEdgeFunction<{ records: UsageRecord[] }>('supertone-usage', {
        body: { type: 'daily', startDate, endDate, ...(isAdmin ? { scope: 'all' } : {}) },
      });

      set({ usageDaily: data.records });
    } catch (err) {
      console.error('[PremiumStore] Failed to fetch daily usage:', err);
    }
  },

  updateQuotaFromTtsResponse: (headers: Headers) => {
    const used = parseFloat(headers.get('X-Quota-Used') || '');
    const limit = parseFloat(headers.get('X-Quota-Limit') || '');
    const remaining = parseFloat(headers.get('X-Quota-Remaining') || '');

    if (!isNaN(used) && !isNaN(limit) && !isNaN(remaining)) {
      set({
        quota: { used, limit, remaining },
        isQuotaExceeded: get().isAdmin ? false : remaining <= 0,
      });
    }
  },

  reset: () => set({
    isPremium: false,
    isAdmin: false,
    isChecking: false,
    voices: [],
    isLoadingVoices: false,
    voicesFetchedAt: null,
    voicesFetchedVersion: null,
    quota: null,
    isQuotaExceeded: false,
    apiCredits: null,
    usageSummary: null,
    usageDaily: null,
    isLoadingUsage: false,
  }),
}));
