-- Removes the old XP/level system while keeping streaks, study activity, and badges.
-- Run once in the Supabase SQL editor after deploying the matching backend/frontend code.
--
-- This intentionally drops:
--   - gamification_events, which stored XP event history
--   - user_gamification_summary, which stored xp_total and level
--   - XP/level helper RPC functions
--
-- This intentionally keeps:
--   - user_streaks
--   - study_activity_days
--   - user_badges

begin;

-- Preserve badge events that may not have been copied into user_badges yet.
do $$
begin
  if to_regclass('public.gamification_events') is not null
     and to_regclass('public.user_badges') is not null then
    insert into public.user_badges (
      user_id,
      badge_key,
      label,
      description,
      metadata,
      earned_at
    )
    select distinct on (event.user_id, event.badge_key)
      event.user_id,
      event.badge_key,
      coalesce(nullif(event.badge_label, ''), initcap(replace(event.badge_key, '_', ' '))),
      nullif(event.metadata ->> 'badge_description', ''),
      coalesce(event.metadata, '{}'::jsonb),
      coalesce(event.created_at, now())
    from public.gamification_events event
    where nullif(event.badge_key, '') is not null
      and not exists (
        select 1
        from public.user_badges badge
        where badge.user_id = event.user_id
          and badge.badge_key = event.badge_key
      )
    order by event.user_id, event.badge_key, event.created_at;
  end if;
end $$;

do $$
declare
  routine_signature text;
begin
  for routine_signature in
    select proc.oid::regprocedure::text
    from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname = 'record_study_activity'
  loop
    execute format('drop function if exists %s', routine_signature);
  end loop;
end $$;

create function public.record_study_activity(
  p_user_id uuid,
  p_activity_type text default 'study_activity',
  p_occurred_at timestamp with time zone default now(),
  p_timezone text default 'Asia/Manila'
)
returns table (
  current_count integer,
  longest_count integer,
  last_activity_date date,
  today_activity_count integer,
  timezone text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity_date date;
  v_activity_type text := lower(trim(coalesce(p_activity_type, 'study_activity')));
  v_day_id uuid;
  v_day_count integer := 0;
  v_counts jsonb := '{}'::jsonb;
  v_type_count integer := 0;
  v_previous_date date;
  v_previous_current integer := 0;
  v_previous_longest integer := 0;
  v_next_current integer := 1;
  v_next_longest integer := 1;
  v_timezone text := coalesce(nullif(p_timezone, ''), 'Asia/Manila');
begin
  if p_user_id is null then
    raise exception 'record_study_activity requires p_user_id';
  end if;

  if v_activity_type !~ '^[a-z0-9_.-]{1,64}$' then
    v_activity_type := 'study_activity';
  end if;

  v_activity_date := (coalesce(p_occurred_at, now()) at time zone v_timezone)::date;

  select
    day.id,
    day.activity_count,
    coalesce(day.activity_counts, '{}'::jsonb)
  into v_day_id, v_day_count, v_counts
  from public.study_activity_days day
  where day.user_id = p_user_id
    and day.activity_date = v_activity_date
  order by day.created_at asc
  limit 1
  for update;

  v_counts := coalesce(v_counts, '{}'::jsonb);

  if (v_counts ->> v_activity_type) ~ '^[0-9]+$' then
    v_type_count := (v_counts ->> v_activity_type)::integer;
  end if;

  v_day_count := coalesce(v_day_count, 0) + 1;
  v_counts := jsonb_set(v_counts, array[v_activity_type], to_jsonb(v_type_count + 1), true);

  if v_day_id is null then
    insert into public.study_activity_days (
      user_id,
      activity_date,
      timezone,
      activity_count,
      activity_counts,
      first_activity_at,
      last_activity_at
    )
    values (
      p_user_id,
      v_activity_date,
      v_timezone,
      v_day_count,
      v_counts,
      coalesce(p_occurred_at, now()),
      coalesce(p_occurred_at, now())
    );
  else
    update public.study_activity_days day
    set activity_count = v_day_count,
        activity_counts = v_counts,
        last_activity_at = coalesce(p_occurred_at, now()),
        updated_at = now()
    where day.id = v_day_id;
  end if;

  select
    streak.current_count,
    streak.longest_count,
    streak.last_activity_date
  into v_previous_current, v_previous_longest, v_previous_date
  from public.user_streaks streak
  where streak.user_id = p_user_id
  for update;

  if v_previous_date = v_activity_date then
    v_next_current := greatest(1, coalesce(v_previous_current, 0));
  elsif v_previous_date = v_activity_date - 1 then
    v_next_current := coalesce(v_previous_current, 0) + 1;
  else
    v_next_current := 1;
  end if;

  v_next_longest := greatest(coalesce(v_previous_longest, 0), v_next_current);

  insert into public.user_streaks (
    user_id,
    current_count,
    longest_count,
    last_activity_date,
    timezone,
    updated_at
  )
  values (
    p_user_id,
    v_next_current,
    v_next_longest,
    v_activity_date,
    v_timezone,
    now()
  )
  on conflict (user_id) do update
  set current_count = excluded.current_count,
      longest_count = excluded.longest_count,
      last_activity_date = excluded.last_activity_date,
      timezone = excluded.timezone,
      updated_at = now();

  return query select
    v_next_current,
    v_next_longest,
    v_activity_date,
    v_day_count,
    v_timezone;
end;
$$;

do $$
declare
  routine_signature text;
begin
  for routine_signature in
    select proc.oid::regprocedure::text
    from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname in ('award_gamification_event', 'calculate_gamification_level')
  loop
    execute format('drop function if exists %s', routine_signature);
  end loop;
end $$;

drop table if exists public.user_gamification_summary;
drop table if exists public.gamification_events;

update public.profiles
set preferences = coalesce(preferences, '{}'::jsonb) - 'xp' - 'level'
where coalesce(preferences, '{}'::jsonb) ?| array['xp', 'level'];

alter table public.profiles
alter column preferences set default
'{
  "streak": {
    "current": 0,
    "longest": 0,
    "last_date": null
  },
  "font_size": 16,
  "atmosphere": "classic-solid",
  "daily_goals": {
    "target_minutes": 30,
    "completed_today": false
  },
  "font_family": "dm-sans",
  "display_mode": "light"
}'::jsonb;

commit;
