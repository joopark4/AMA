-- ============================================================
-- MyPartnerAI — 초기 DB 스키마
-- 적용: Supabase SQL Editor 에서 순서대로 실행
-- ============================================================

-- ── 1. profiles ─────────────────────────────────────────────
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname    TEXT NOT NULL,
  avatar_url  TEXT,
  provider    TEXT NOT NULL
                CHECK (provider IN ('google', 'apple', 'facebook', 'twitter')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 신규 가입 자동 프로필 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, avatar_url, provider)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'user_name',
      NEW.email,
      '사용자'
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_app_meta_data->>'provider', 'google')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. user_settings ────────────────────────────────────────
CREATE TABLE public.user_settings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language       TEXT NOT NULL DEFAULT 'ko' CHECK (language IN ('ko', 'en')),
  avatar_name    TEXT,
  llm_provider   TEXT,
  settings       JSONB NOT NULL DEFAULT '{}',  -- apiKey 제외 후 저장
  schema_version INT NOT NULL DEFAULT 7,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

-- ── 3. user_consents ────────────────────────────────────────
CREATE TABLE public.user_consents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_type   TEXT NOT NULL CHECK (terms_type IN ('terms', 'privacy')),
  terms_ver    TEXT NOT NULL,   -- 약관 버전 (예: '2026.02')
  agreed       BOOLEAN NOT NULL DEFAULT TRUE,
  agreed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, terms_type, terms_ver)
);

-- ── 4. RLS 정책 ──────────────────────────────────────────────

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인 프로필 조회"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "본인 프로필 수정"   ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인 설정 접근"     ON public.user_settings FOR ALL USING (auth.uid() = user_id);

-- user_consents
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인 동의 이력 접근" ON public.user_consents FOR ALL USING (auth.uid() = user_id);
