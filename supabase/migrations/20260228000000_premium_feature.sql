-- 구독 플랜 테이블
CREATE TABLE public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_credit_limit NUMERIC NOT NULL,
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.subscription_plans (id, name, monthly_credit_limit, description, sort_order) VALUES
  ('free',  'Free',  0,    '무료 플랜 — 로컬 TTS만 사용', 0),
  ('basic', 'Basic', 300,  'Basic — 월 300크레딧 (5분)', 1),
  ('pro',   'Pro',   1200, 'Pro — 월 1200크레딧 (20분)', 2);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_select_all" ON public.subscription_plans
  FOR SELECT USING (true);

-- profiles 확장
ALTER TABLE public.profiles
  ADD COLUMN is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN plan_id TEXT NOT NULL DEFAULT 'free' REFERENCES public.subscription_plans(id),
  ADD COLUMN monthly_credit_limit_override NUMERIC,
  ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN plan_changed_at TIMESTAMPTZ;

-- 구독 변경 이력
CREATE TABLE public.subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_plan_id TEXT REFERENCES public.subscription_plans(id),
  new_plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id),
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_history_select_own" ON public.subscription_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sub_history_insert_admin" ON public.subscription_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    OR auth.uid() = user_id
  );

-- TTS 사용량 추적
CREATE TABLE public.tts_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_id TEXT NOT NULL,
  voice_name TEXT,
  model TEXT NOT NULL,
  language TEXT NOT NULL,
  style TEXT,
  text_length INT NOT NULL,
  audio_duration NUMERIC,
  credits_used NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tts_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tts_usage_select_own" ON public.tts_usage
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tts_usage_insert_service" ON public.tts_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_tts_usage_user_date ON public.tts_usage(user_id, created_at DESC);

-- Admin 체크 함수 (SECURITY DEFINER로 RLS 우회하여 무한 재귀 방지)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Admin RLS 정책 (함수 호출로 재귀 방지)
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR public.is_admin()
  );

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    public.is_admin()
  );

CREATE POLICY "tts_usage_select_admin" ON public.tts_usage
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_admin()
  );

CREATE POLICY "sub_history_select_admin" ON public.subscription_history
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_admin()
  );
