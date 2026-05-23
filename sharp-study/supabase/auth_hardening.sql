-- Auth hardening helpers for Verso.
-- Review before running. The username constraint is NOT VALID so existing rows
-- are not blocked immediately; it still protects new or updated usernames.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_username_policy_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_policy_check
      CHECK (
        username IS NULL OR (
          username = lower(username)
          AND char_length(username) BETWEEN 6 AND 20
          AND username ~ '^[a-z0-9._-]+$'
          AND length(regexp_replace(username, '[^a-z]', '', 'g')) >= 3
          AND username !~ '^[._-]'
          AND username !~ '[._-]$'
          AND username !~ '[._-]{2,}'
        )
      ) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_email_lookup_idx
  ON public.profiles (lower(email));

CREATE INDEX IF NOT EXISTS otp_codes_email_purpose_created_idx
  ON public.otp_codes (email, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS login_attempts_email_created_idx
  ON public.login_attempts (email, created_at DESC);

CREATE INDEX IF NOT EXISTS password_history_user_created_idx
  ON public.password_history (user_id, created_at DESC);

-- After existing usernames are cleaned up, you can validate the constraint:
-- ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_username_policy_check;
