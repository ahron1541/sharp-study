-- Repair script for gamification/streak rewards.
-- Run this once in the Supabase SQL editor before relying on the RPC path.

begin;

-- Keep one event per user/idempotency key so rewards cannot be double-counted.
with ranked_events as (
  select
    id,
    row_number() over (
      partition by user_id, idempotency_key
      order by created_at asc, id asc
    ) as row_number
  from public.gamification_events
)
delete from public.gamification_events event
using ranked_events ranked
where event.id = ranked.id
  and ranked.row_number > 1;

with ranked_badges as (
  select
    id,
    row_number() over (
      partition by user_id, badge_key
      order by earned_at asc, id asc
    ) as row_number
  from public.user_badges
)
delete from public.user_badges badge
using ranked_badges ranked
where badge.id = ranked.id
  and ranked.row_number > 1;

with ranked_activity_days as (
  select
    id,
    user_id,
    activity_date,
    row_number() over (
      partition by user_id, activity_date
      order by created_at asc, id asc
    ) as row_number,
    sum(activity_count) over (partition by user_id, activity_date) as merged_activity_count,
    min(first_activity_at) over (partition by user_id, activity_date) as merged_first_activity_at,
    max(last_activity_at) over (partition by user_id, activity_date) as merged_last_activity_at
  from public.study_activity_days
),
activity_count_entries as (
  select
    day.user_id,
    day.activity_date,
    entry.key,
    sum(
      case
        when entry.value ~ '^[0-9]+$' then entry.value::integer
        else 0
      end
    ) as value
  from public.study_activity_days day
  cross join lateral jsonb_each_text(coalesce(day.activity_counts, '{}'::jsonb)) as entry(key, value)
  group by day.user_id, day.activity_date, entry.key
),
merged_activity_counts as (
  select
    user_id,
    activity_date,
    jsonb_object_agg(key, value) as activity_counts
  from activity_count_entries
  group by user_id, activity_date
),
activity_day_keepers as (
  select *
  from ranked_activity_days
  where row_number = 1
)
update public.study_activity_days day
set activity_count = keeper.merged_activity_count,
    activity_counts = coalesce(merged.activity_counts, '{}'::jsonb),
    first_activity_at = keeper.merged_first_activity_at,
    last_activity_at = keeper.merged_last_activity_at,
    updated_at = now()
from activity_day_keepers keeper
left join merged_activity_counts merged
  on merged.user_id = keeper.user_id
 and merged.activity_date = keeper.activity_date
where day.id = keeper.id;

with ranked_activity_days as (
  select
    id,
    row_number() over (
      partition by user_id, activity_date
      order by created_at asc, id asc
    ) as row_number
  from public.study_activity_days
)
delete from public.study_activity_days day
using ranked_activity_days ranked
where day.id = ranked.id
  and ranked.row_number > 1;

create unique index if not exists gamification_events_user_id_idempotency_key_key
  on public.gamification_events (user_id, idempotency_key);

create unique index if not exists user_badges_user_id_badge_key_key
  on public.user_badges (user_id, badge_key);

create unique index if not exists study_activity_days_user_id_activity_date_key
  on public.study_activity_days (user_id, activity_date);

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

create or replace function public.award_gamification_event(
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
begin
  if p_user_id is null or nullif(trim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'user_id and idempotency_key are required';
  end if;

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
    trim(p_idempotency_key)
  )
  on conflict (user_id, idempotency_key) do nothing
  returning * into v_event;

  if v_event.id is not null then
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
    on conflict (user_id) do update
      set xp_total = public.user_gamification_summary.xp_total + v_xp_delta,
          level = public.calculate_gamification_level(public.user_gamification_summary.xp_total + v_xp_delta),
          updated_at = now()
    returning * into v_summary;

    if v_event.badge_key is not null then
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
      )
      on conflict (user_id, badge_key) do nothing;
    end if;
  else
    select *
    into v_event
    from public.gamification_events existing
    where existing.user_id = p_user_id
      and existing.idempotency_key = trim(p_idempotency_key)
    limit 1;

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

create or replace function public.record_study_activity(
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
  v_activity_date date := (coalesce(p_occurred_at, now()) at time zone coalesce(nullif(trim(p_timezone), ''), 'Asia/Manila'))::date;
  v_today_activity_count integer;
  v_previous public.user_streaks%rowtype;
  v_next_current integer;
  v_next_longest integer;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

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
    coalesce(p_occurred_at, now()),
    coalesce(p_occurred_at, now()),
    now()
  )
  on conflict (user_id, activity_date) do update
    set activity_count = public.study_activity_days.activity_count + 1,
        activity_counts = jsonb_set(
          coalesce(public.study_activity_days.activity_counts, '{}'::jsonb),
          array[v_activity_type],
          to_jsonb(coalesce((public.study_activity_days.activity_counts ->> v_activity_type)::integer, 0) + 1),
          true
        ),
        last_activity_at = greatest(public.study_activity_days.last_activity_at, coalesce(p_occurred_at, now())),
        timezone = v_timezone,
        updated_at = now()
  returning activity_count into v_today_activity_count;

  select *
  into v_previous
  from public.user_streaks streak
  where streak.user_id = p_user_id
  for update;

  if not found then
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

  return query
  select
    v_next_current,
    v_next_longest,
    v_activity_date,
    v_today_activity_count,
    v_timezone;
end;
$$;

commit;
