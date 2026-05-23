-- Read-only checks for gamification XP.
-- This does not change data.

select
  routine_name,
  data_type,
  type_udt_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('award_gamification_event', 'record_study_activity', 'calculate_gamification_level')
order by routine_name;

select
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments,
  pg_get_function_result(oid) as result
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('award_gamification_event', 'record_study_activity', 'calculate_gamification_level')
order by proname, arguments;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('gamification_events', 'user_badges', 'study_activity_days', 'user_gamification_summary')
order by tablename, indexname;

select
  'duplicate gamification idempotency keys' as check_name,
  count(*) as duplicate_groups
from (
  select user_id, idempotency_key
  from public.gamification_events
  group by user_id, idempotency_key
  having count(*) > 1
) duplicates;

select
  'duplicate user badges' as check_name,
  count(*) as duplicate_groups
from (
  select user_id, badge_key
  from public.user_badges
  group by user_id, badge_key
  having count(*) > 1
) duplicates;

select
  'duplicate activity days' as check_name,
  count(*) as duplicate_groups
from (
  select user_id, activity_date
  from public.study_activity_days
  group by user_id, activity_date
  having count(*) > 1
) duplicates;

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
    sum(greatest(coalesce(xp_delta, 0), 0))::integer as xp_from_events
  from deduped_events
  group by user_id
)
select
  profiles.email,
  profiles.id as user_id,
  coalesce(summary.xp_total, 0) as summary_xp,
  coalesce(event_totals.xp_from_events, 0) as event_xp,
  coalesce(event_totals.xp_from_events, 0) - coalesce(summary.xp_total, 0) as missing_xp
from public.profiles profiles
left join public.user_gamification_summary summary
  on summary.user_id = profiles.id
left join event_totals
  on event_totals.user_id = profiles.id
where coalesce(event_totals.xp_from_events, 0) <> coalesce(summary.xp_total, 0)
order by missing_xp desc
limit 50;
