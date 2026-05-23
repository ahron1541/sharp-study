-- Safer gamification repair.
-- This script does not delete reward/activity data.
-- It drops and recreates the two RPC functions because PostgreSQL cannot
-- change a function's OUT/return table shape with CREATE OR REPLACE.

begin;

create or replace function public.calculate_gamification_level(p_xp_total integer)
returns integer
language sql
immutable
as $$
  select greatest(floor(sqrt(greatest(coalesce(p_xp_total, 0), 0)::numeric / 100))::integer + 1, 1);
$$;

drop function if exists public.award_gamification_event(
  uuid,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
);

create function public.award_gamification_event(
  p_user_id uuid,
  p_event_type text,
  p_label text,
  p_xp_delta integer,
  p_idempotency_key text,
  p_badge_key text default null,
  p_badge_label text default null,
  p_badge_description text default null,
  p_source_type text default null,
  p_source_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  event_type text,
  label text,
  xp_delta integer,
  badge_key text,
  badge_label text,
  source_type text,
  source_id text,
  metadata jsonb,
  idempotency_key text,
  created_at timestamp with time zone,
  xp_total integer,
  level integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.gamification_events%rowtype;
  v_summary public.user_gamification_summary%rowtype;
  v_xp_delta integer := greatest(coalesce(p_xp_delta, 0), 0);
  v_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
begin
  if p_user_id is null or v_idempotency_key = '' then
    raise exception 'user_id and idempotency_key are required';
  end if;

  select *
  into v_event
  from public.gamification_events existing
  where existing.user_id = p_user_id
    and existing.idempotency_key = v_idempotency_key
  order by existing.created_at asc, existing.id asc
  limit 1;

  if v_event.id is null then
    insert into public.gamification_events (
      user_id,
      event_type,
      label,
      xp_delta,
      badge_key,
      badge_label,
      source_type,
      source_id,
      metadata,
      idempotency_key
    )
    values (
      p_user_id,
      coalesce(nullif(trim(p_event_type), ''), 'reward'),
      coalesce(nullif(trim(p_label), ''), 'Reward'),
      v_xp_delta,
      nullif(trim(coalesce(p_badge_key, '')), ''),
      nullif(trim(coalesce(p_badge_label, '')), ''),
      nullif(trim(coalesce(p_source_type, '')), ''),
      nullif(trim(coalesce(p_source_id, '')), ''),
      coalesce(p_metadata, '{}'::jsonb),
      v_idempotency_key
    )
    returning * into v_event;

    update public.user_gamification_summary summary
    set xp_total = summary.xp_total + v_xp_delta,
        level = public.calculate_gamification_level(summary.xp_total + v_xp_delta),
        updated_at = now()
    where summary.user_id = p_user_id
    returning * into v_summary;

    if v_summary.user_id is null then
      insert into public.user_gamification_summary (
        user_id,
        xp_total,
        level,
        updated_at
      )
      values (
        p_user_id,
        v_xp_delta,
        public.calculate_gamification_level(v_xp_delta),
        now()
      )
      returning * into v_summary;
    end if;

    if v_event.badge_key is not null and not exists (
      select 1
      from public.user_badges existing_badge
      where existing_badge.user_id = p_user_id
        and existing_badge.badge_key = v_event.badge_key
    ) then
      insert into public.user_badges (
        user_id,
        badge_key,
        label,
        description,
        metadata
      )
      values (
        p_user_id,
        v_event.badge_key,
        coalesce(v_event.badge_label, v_event.label),
        p_badge_description,
        coalesce(p_metadata, '{}'::jsonb)
      );
    end if;
  else
    select *
    into v_summary
    from public.user_gamification_summary existing_summary
    where existing_summary.user_id = p_user_id;
  end if;

  return query
  select
    v_event.id,
    v_event.event_type,
    v_event.label,
    v_event.xp_delta,
    v_event.badge_key,
    v_event.badge_label,
    v_event.source_type,
    v_event.source_id,
    v_event.metadata,
    v_event.idempotency_key,
    v_event.created_at,
    coalesce(v_summary.xp_total, 0),
    coalesce(v_summary.level, 1);
end;
$$;

drop function if exists public.record_study_activity(
  uuid,
  text,
  timestamp with time zone,
  text
);

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
  v_activity_type text := coalesce(nullif(trim(p_activity_type), ''), 'study_activity');
  v_timezone text := coalesce(nullif(trim(p_timezone), ''), 'Asia/Manila');
  v_occurred_at timestamp with time zone := coalesce(p_occurred_at, now());
  v_activity_date date := (coalesce(p_occurred_at, now()) at time zone coalesce(nullif(trim(p_timezone), ''), 'Asia/Manila'))::date;
  v_today_activity_count integer;
  v_day public.study_activity_days%rowtype;
  v_previous public.user_streaks%rowtype;
  v_next_current integer;
  v_next_longest integer;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  select *
  into v_day
  from public.study_activity_days existing_day
  where existing_day.user_id = p_user_id
    and existing_day.activity_date = v_activity_date
  order by existing_day.created_at asc, existing_day.id asc
  limit 1
  for update;

  if v_day.id is null then
    insert into public.study_activity_days (
      user_id,
      activity_date,
      timezone,
      activity_count,
      activity_counts,
      first_activity_at,
      last_activity_at,
      updated_at
    )
    values (
      p_user_id,
      v_activity_date,
      v_timezone,
      1,
      jsonb_build_object(v_activity_type, 1),
      v_occurred_at,
      v_occurred_at,
      now()
    )
    returning activity_count into v_today_activity_count;
  else
    update public.study_activity_days day
    set activity_count = day.activity_count + 1,
        activity_counts = jsonb_set(
          coalesce(day.activity_counts, '{}'::jsonb),
          array[v_activity_type],
          to_jsonb(coalesce((day.activity_counts ->> v_activity_type)::integer, 0) + 1),
          true
        ),
        last_activity_at = greatest(day.last_activity_at, v_occurred_at),
        timezone = v_timezone,
        updated_at = now()
    where day.id = v_day.id
    returning activity_count into v_today_activity_count;
  end if;

  select *
  into v_previous
  from public.user_streaks streak
  where streak.user_id = p_user_id
  for update;

  if v_previous.user_id is null then
    v_next_current := 1;
    v_next_longest := 1;
  elsif v_previous.last_activity_date = v_activity_date then
    v_next_current := greatest(v_previous.current_count, 1);
    v_next_longest := greatest(v_previous.longest_count, v_next_current);
  elsif v_previous.last_activity_date = v_activity_date - 1 then
    v_next_current := v_previous.current_count + 1;
    v_next_longest := greatest(v_previous.longest_count, v_next_current);
  else
    v_next_current := 1;
    v_next_longest := greatest(v_previous.longest_count, 1);
  end if;

  update public.user_streaks streak
  set current_count = v_next_current,
      longest_count = v_next_longest,
      last_activity_date = v_activity_date,
      timezone = v_timezone,
      updated_at = now()
  where streak.user_id = p_user_id;

  if not found then
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
    );
  end if;

  return query
  select
    v_next_current,
    v_next_longest,
    v_activity_date,
    v_today_activity_count,
    v_timezone;
end;
$$;

with deduped_events as (
  select distinct on (user_id, idempotency_key)
    user_id,
    idempotency_key,
    xp_delta,
    created_at
  from public.gamification_events
  where coalesce(idempotency_key, '') <> ''
  order by user_id, idempotency_key, created_at asc
),
event_totals as (
  select
    user_id,
    sum(greatest(coalesce(xp_delta, 0), 0))::integer as xp_total
  from deduped_events
  group by user_id
)
update public.user_gamification_summary summary
set xp_total = greatest(summary.xp_total, event_totals.xp_total),
    level = public.calculate_gamification_level(greatest(summary.xp_total, event_totals.xp_total)),
    updated_at = now()
from event_totals
where summary.user_id = event_totals.user_id;

with deduped_events as (
  select distinct on (user_id, idempotency_key)
    user_id,
    idempotency_key,
    xp_delta,
    created_at
  from public.gamification_events
  where coalesce(idempotency_key, '') <> ''
  order by user_id, idempotency_key, created_at asc
),
event_totals as (
  select
    user_id,
    sum(greatest(coalesce(xp_delta, 0), 0))::integer as xp_total
  from deduped_events
  group by user_id
)
insert into public.user_gamification_summary (
  user_id,
  xp_total,
  level,
  updated_at
)
select
  event_totals.user_id,
  event_totals.xp_total,
  public.calculate_gamification_level(event_totals.xp_total),
  now()
from event_totals
where not exists (
  select 1
  from public.user_gamification_summary summary
  where summary.user_id = event_totals.user_id
);

do $$
begin
  if not exists (
    select 1
    from (
      select user_id, idempotency_key
      from public.gamification_events
      group by user_id, idempotency_key
      having count(*) > 1
      limit 1
    ) duplicates
  ) then
    execute 'create unique index if not exists gamification_events_user_id_idempotency_key_key on public.gamification_events (user_id, idempotency_key)';
  else
    raise notice 'Skipped unique gamification_events index because duplicate idempotency rows exist.';
  end if;

  if not exists (
    select 1
    from (
      select user_id, badge_key
      from public.user_badges
      group by user_id, badge_key
      having count(*) > 1
      limit 1
    ) duplicates
  ) then
    execute 'create unique index if not exists user_badges_user_id_badge_key_key on public.user_badges (user_id, badge_key)';
  else
    raise notice 'Skipped unique user_badges index because duplicate badge rows exist.';
  end if;

  if not exists (
    select 1
    from (
      select user_id, activity_date
      from public.study_activity_days
      group by user_id, activity_date
      having count(*) > 1
      limit 1
    ) duplicates
  ) then
    execute 'create unique index if not exists study_activity_days_user_id_activity_date_key on public.study_activity_days (user_id, activity_date)';
  else
    raise notice 'Skipped unique study_activity_days index because duplicate activity-day rows exist.';
  end if;
end $$;

commit;
