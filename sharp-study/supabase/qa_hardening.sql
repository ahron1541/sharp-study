-- QA hardening checks for Verso.
-- Run the SELECT checks first. If any duplicate rows appear, resolve them before adding indexes.
-- This file is safe to review in Supabase SQL Editor before applying.

-- Duplicate progress rows would block the unique index below.
SELECT user_id, set_id, COUNT(*) AS duplicate_count
FROM public.flashcard_progress
GROUP BY user_id, set_id
HAVING COUNT(*) > 1;

-- Duplicate activity days would block the unique index below.
SELECT user_id, activity_date, timezone, COUNT(*) AS duplicate_count
FROM public.study_activity_days
GROUP BY user_id, activity_date, timezone
HAVING COUNT(*) > 1;

-- Username rule: 6-20 lowercase characters, at least 3 letters, letters/numbers plus single dots,
-- underscores, or hyphens between characters. No spaces, no other symbols, no leading/trailing
-- symbol, and no repeated symbol group like "..", "__", "--", "._", or "-_".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_username_rules_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_rules_check
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

ALTER TABLE public.profiles
  VALIDATE CONSTRAINT profiles_username_rules_check;

-- Concurrency protection for repeated progress/activity writes.
CREATE UNIQUE INDEX IF NOT EXISTS flashcard_progress_user_set_uidx
  ON public.flashcard_progress(user_id, set_id);

CREATE UNIQUE INDEX IF NOT EXISTS study_activity_days_user_date_tz_uidx
  ON public.study_activity_days(user_id, activity_date, timezone);

-- Query support for auth throttling, OTP cleanup, and recent-login checks.
CREATE INDEX IF NOT EXISTS otp_codes_email_purpose_expires_idx
  ON public.otp_codes(email, purpose, expires_at);

CREATE INDEX IF NOT EXISTS login_attempts_email_created_idx
  ON public.login_attempts(email, created_at DESC);
