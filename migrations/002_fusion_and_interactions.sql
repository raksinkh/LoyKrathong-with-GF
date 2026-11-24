alter table rooms
  add column if not exists p1_choice jsonb not null default '{"baseStyle":"banana_leaf","flowerStyle":"marigold_globe","candleStyle":"warm_gold","accentStyle":"dok_rak_heart","wishText":""}'::jsonb;

alter table rooms
  add column if not exists p2_choice jsonb not null default '{"baseStyle":"lotus_petal","flowerStyle":"rose_orchid","candleStyle":"romantic_pink","accentStyle":"moon_star","wishText":""}'::jsonb;

alter table rooms
  add column if not exists p1_ready boolean not null default false;

alter table rooms
  add column if not exists p2_ready boolean not null default false;

alter table rooms
  add column if not exists fusion_state text not null default 'building';

alter table rooms
  add column if not exists fused_at timestamptz;

alter table rooms
  add column if not exists both_holding_since timestamptz;

alter table sky_events
  add column if not exists message text not null default '';

alter table sky_events
  add column if not exists slot smallint not null default 1;

alter table sky_events
  drop constraint if exists sky_events_kind_check;

alter table sky_events
  drop constraint if exists sky_events_kind_v2_check;

alter table sky_events
  add constraint sky_events_kind_v2_check
  check (kind in ('lantern', 'sparkle', 'firecracker', 'heart', 'heart_combo'));
