-- profiles에 email 컬럼 추가 (admin 쿼리에서 auth.users 조인 없이 접근 가능)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

-- 기존 프로필에 auth.users의 email 역채움
UPDATE public.profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id AND p.email IS NULL;

-- 신규 가입 트리거에 email 포함하도록 재정의
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, avatar_url, provider, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'user_name',
      NEW.email,
      '사용자'
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_app_meta_data->>'provider', 'google'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
