create table if not exists rooms (
  id text primary key,
  invite_secret_hash text not null,
  base_style text not null default 'banana_leaf',
  flower_style text not null default 'marigold_globe',
  candle_style text not null default 'warm_gold',
  accent_style text not null default 'dok_rak_heart',
  wish_text text not null default '',
  status text not null default 'building',
  released_at timestamptz,
  krathong_round integer not null default 1,
  last_edited_by text,
  last_edit_label text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists participants (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  slot smallint not null check (slot in (1, 2)),
  nickname text not null,
  session_token_hash text not null unique,
  activity text not null default 'by_river',
  holding_since timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (room_id, slot)
);

create table if not exists sky_events (
  id bigserial primary key,
  room_id text not null references rooms(id) on delete cascade,
  participant_id text not null references participants(id) on delete cascade,
  sender_name text not null,
  kind text not null check (kind in ('lantern', 'sparkle')),
  x real not null,
  y real not null,
  hue text not null default 'amber',
  created_at timestamptz not null default now()
);

create index if not exists idx_participants_room_id on participants(room_id);
create index if not exists idx_sky_events_room_created on sky_events(room_id, id desc);
