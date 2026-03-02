/**
 * 프리미엄 상태/음성목록/사용량/할당량 관리 스토어
 */
import { create } from 'zustand';
import { callEdgeFunction } from '../services/auth/edgeFunctionClient';
import { useAuthStore } from './authStore';
import { supabase } from '../services/auth/supabaseClient';

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
  isChecking: boolean;
  voices: SupertoneVoice[];
  isLoadingVoices: boolean;
  voicesFetchedAt: number | null;
  voicesFetchedVersion: string | null;

  quota: QuotaInfo | null;
  isQuotaExceeded: boolean;

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
  isChecking: false,
  voices: [],
  isLoadingVoices: false,
  voicesFetchedAt: null,
  voicesFetchedVersion: null,

  quota: null,
  isQuotaExceeded: false,

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
      // Restore session on Supabase client (persistSession: false loses it on reload/HMR)
      // 먼저 기존 세션이 있는지 확인 — setSession 반복 호출로 refresh token 소진 방지
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (!existingSession && tokens?.accessToken && tokens?.refreshToken) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        });
        if (sessionError) {
          // refresh token 만료/소진 시 로그아웃 → 재로그인 유도
          if (sessionError.message.includes('Invalid Refresh Token')) {
            useAuthStore.getState().logout();
            set({ isPremium: false, isChecking: false });
            return;
          }
        }

        // setSession이 refresh token을 소비할 수 있으므로 항상 새 토큰 저장
        if (sessionData?.session) {
          useAuthStore.getState().setTokens({
            accessToken: sessionData.session.access_token,
            refreshToken: sessionData.session.refresh_token,
            expiresAt: sessionData.session.expires_at
              ? sessionData.session.expires_at * 1000
              : Date.now() + 3600_000,
          });
        }
      }

      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('is_premium, plan_id, monthly_credit_limit_override')
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
          isPremium: data.is_premium,
          quota: get().quota ? { ...get().quota!, limit: creditLimit } : null,
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

      const data = await callEdgeFunction<{
        totalSeconds: number;
        totalCharacters: number;
        totalRequests: number;
        quota: QuotaInfo;
      }>('supertone-usage', {
        body: { type: 'summary', startDate, endDate },
      });

      set({
        usageSummary: {
          totalSeconds: data.totalSeconds,
          totalCharacters: data.totalCharacters,
          totalRequests: data.totalRequests,
        },
        quota: data.quota,
        isQuotaExceeded: data.quota.remaining <= 0,
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

      const data = await callEdgeFunction<{ records: UsageRecord[] }>('supertone-usage', {
        body: { type: 'daily', startDate, endDate },
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
        isQuotaExceeded: remaining <= 0,
      });
    }
  },

  reset: () => set({
    isPremium: false,
    isChecking: false,
    voices: [],
    isLoadingVoices: false,
    voicesFetchedAt: null,
    voicesFetchedVersion: null,
    quota: null,
    isQuotaExceeded: false,
    usageSummary: null,
    usageDaily: null,
    isLoadingUsage: false,
  }),
}));
