import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

interface DbGlobals {
  pool?: pg.Pool;
  schemaReady?: Promise<void>;
  local?: Promise<PGlite>;
}

const globalForDb = globalThis as unknown as {
  __moonlightKrathongDb?: DbGlobals;
};

const state = (globalForDb.__moonlightKrathongDb ??= {});

const IDEMPOTENT_SCHEMA_SQL = `
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
  kind text not null,
  x real not null,
  y real not null,
  hue text not null default 'amber',
  created_at timestamptz not null default now()
);

alter table sky_events
  add column if not exists message text not null default '';

alter table sky_events
  add column if not exists slot smallint not null default 1;

alter table sky_events
  drop constraint if exists sky_events_kind_check;

alter table sky_events
  drop constraint if exists sky_events_kind_v2_check;

alter table sky_events
  drop constraint if exists sky_events_kind_v3_check;

update sky_events set kind = 'sparkle' where kind = 'firecracker';

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

create index if not exists idx_participants_room_id on participants(room_id);
create index if not exists idx_sky_events_room_created on sky_events(room_id, id desc);
`;

async function ensureSchema(pool: pg.Pool): Promise<void> {
  if (!state.schemaReady) {
    state.schemaReady = pool
      .query(IDEMPOTENT_SCHEMA_SQL)
      .then(() => undefined)
      .catch((error: unknown) => {
        state.schemaReady = undefined;
        throw error;
      });
  }
  await state.schemaReady;
}

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (databaseUrl !== "") {
    state.pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    await ensureSchema(state.pool);
    const result = await state.pool.query(text, params);
    return result.rows as T[];
  }

  state.local ??= startLocal().catch((error: unknown) => {
    state.local = undefined;
    throw error;
  });
  const db = await state.local;
  const result = await db.query<T>(text, params);
  return result.rows;
}

async function startLocal(): Promise<PGlite> {
  const db = new PGlite();
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = (await readdir(migrationsDir).catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const migrationSql = await readFile(path.join(migrationsDir, file), "utf8");
    await db.exec(migrationSql);
  }
  return db;
}
