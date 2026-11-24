update sky_events set kind = 'sparkle' where kind = 'firecracker';

alter table sky_events drop constraint if exists sky_events_kind_check;
alter table sky_events drop constraint if exists sky_events_kind_v2_check;
alter table sky_events drop constraint if exists sky_events_kind_v3_check;

alter table sky_events
  add constraint sky_events_kind_v3_check
  check (kind in ('lantern', 'sparkle', 'heart', 'heart_combo'));

alter table rooms add column if not exists drift_status text not null default 'idle';
alter table rooms add column if not exists drift_started_at timestamptz;
alter table rooms add column if not exists drift_seed integer not null default 0;
alter table rooms add column if not exists drift_score integer not null default 0;
alter table rooms add column if not exists drift_x real not null default 0;
alter table rooms add column if not exists drift_tick_ms double precision not null default 0;
alter table rooms add column if not exists drift_resolved text not null default '';
alter table rooms add column if not exists p1_steer real not null default 0;
alter table rooms add column if not exists p2_steer real not null default 0;
