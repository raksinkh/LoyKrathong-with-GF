import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { get, put } from "@vercel/blob";
import pg from "pg";

interface DbGlobals {
  pool?: pg.Pool;
  schemaReady?: Promise<void>;
  local?: Promise<PGlite>;
  persistTimer?: ReturnType<typeof setTimeout> | null;
  persistInFlight?: Promise<void> | null;
  dirty?: boolean;
  /** Serialize PGlite queries + dumps so dumpDataDir never races mid-write. */
  chain?: Promise<unknown>;
  lastMutationAt?: number;
  lastPersistAt?: number;
}

const globalForDb = globalThis as unknown as {
  __moonlightKrathongDb?: DbGlobals;
};

const state = (globalForDb.__moonlightKrathongDb ??= {});

/**
 * Private Blob pathname for PGlite dump when DATABASE_URL is absent (Vercel).
 *
 * Hot-path lesson vs bb0c7bf: dumping on every sky/builder write under burst
 * contended PGlite (dumpDataDir + concurrent SQL) and multi-instance Blob
 * restore races → mid-session 401 kicks. Early main stayed spam-safe because
 * it was pure in-memory with no Blob I/O on the write path.
 *
 * Strategy now: keep memory-first like early main for sky/builder spam;
 * only idle-debounce Blob dumps, plus explicit flush on create/join.
 */
const PGLITE_BLOB_PATH = "loykrathong/pglite-datadir.tar.gz";
/** Wait until writes go quiet before dumping (spam-safe). */
const PERSIST_IDLE_MS = 12_000;
/** Never dump more often than this, even if idle flaps. */
const PERSIST_MIN_INTERVAL_MS = 20_000;

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

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

async function loadDumpFromBlob(): Promise<File | Blob | null> {
  if (!hasBlobToken()) return null;
  try {
    const result = await get(PGLITE_BLOB_PATH, {
      access: "private",
      useCache: false,
    });
    if (!result?.stream) return null;
    const buffer = await new Response(result.stream).arrayBuffer();
    if (buffer.byteLength < 32) return null;
    return new File([buffer], "pglite-datadir.tar.gz", {
      type: "application/gzip",
    });
  } catch {
    return null;
  }
}

async function roomCount(db: PGlite): Promise<number> {
  try {
    const result = await db.query<{ count: string | number }>(
      `select count(*)::int as count from rooms`,
    );
    return Number(result.rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

function enqueueLocal<T>(fn: () => Promise<T>): Promise<T> {
  const prev = state.chain ?? Promise.resolve();
  const next = prev.then(fn, fn);
  state.chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function persistLocalDb(db: PGlite): Promise<void> {
  if (!hasBlobToken()) return;
  try {
    // Never clobber a good Blob dump with an empty cold-start DB.
    const localRooms = await roomCount(db);
    if (localRooms === 0) {
      const existing = await loadDumpFromBlob();
      if (existing) {
        state.dirty = false;
        return;
      }
    }
    const dump = await db.dumpDataDir("gzip");
    await put(PGLITE_BLOB_PATH, dump, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/gzip",
      cacheControlMaxAge: 0,
    });
    state.dirty = false;
    state.lastPersistAt = Date.now();
  } catch {
    // Keep serving from memory; next idle window will retry
  }
}

function scheduleIdlePersist(db: PGlite): void {
  if (!hasBlobToken()) return;
  state.dirty = true;
  state.lastMutationAt = Date.now();
  if (state.persistTimer) clearTimeout(state.persistTimer);
  state.persistTimer = setTimeout(() => {
    state.persistTimer = null;
    void maybeIdlePersist(db);
  }, PERSIST_IDLE_MS);
}

async function maybeIdlePersist(db: PGlite): Promise<void> {
  if (!state.dirty || !hasBlobToken()) return;
  const now = Date.now();
  const sinceMutation = now - (state.lastMutationAt ?? 0);
  const sincePersist = now - (state.lastPersistAt ?? 0);
  if (sinceMutation < PERSIST_IDLE_MS) {
    scheduleIdlePersist(db);
    return;
  }
  if (sincePersist < PERSIST_MIN_INTERVAL_MS) {
    const wait = PERSIST_MIN_INTERVAL_MS - sincePersist;
    state.persistTimer = setTimeout(() => {
      state.persistTimer = null;
      void maybeIdlePersist(db);
    }, wait);
    return;
  }
  await flushPersist(db);
}

/** Awaitable flush — create/join only. Serialized with queries. */
async function flushPersist(db: PGlite): Promise<void> {
  if (!hasBlobToken()) return;
  if (state.persistTimer) {
    clearTimeout(state.persistTimer);
    state.persistTimer = null;
  }
  await enqueueLocal(async () => {
    if (state.persistInFlight) {
      await state.persistInFlight;
    }
    if (!state.dirty && state.lastPersistAt) {
      // Still allow forced flush after create/join (caller sets dirty).
    }
    state.persistInFlight = persistLocalDb(db)
      .catch(() => {})
      .finally(() => {
        state.persistInFlight = null;
      });
    await state.persistInFlight;
  });
}

export async function flushRoomPersist(): Promise<void> {
  if (!state.local) return;
  try {
    const db = await state.local;
    state.dirty = true;
    await flushPersist(db);
  } catch {
    // Ignore
  }
}

async function applyMigrations(db: PGlite): Promise<void> {
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = (await readdir(migrationsDir).catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const migrationSql = await readFile(path.join(migrationsDir, file), "utf8");
    await db.exec(migrationSql);
  }
}

async function startLocal(): Promise<PGlite> {
  const dump = await loadDumpFromBlob();
  let db: PGlite;
  if (dump) {
    try {
      db = await PGlite.create({ loadDataDir: dump });
    } catch {
      db = await PGlite.create();
      await applyMigrations(db);
    }
  } else {
    db = await PGlite.create();
    await applyMigrations(db);
  }

  await db.exec(IDEMPOTENT_SCHEMA_SQL);
  return db;
}

function isHotPathMutation(sqlText: string): boolean {
  // Sky spam + last_seen heartbeats must not trigger Blob I/O.
  return (
    /\bsky_events\b/.test(sqlText) ||
    /\blast_seen_at\b/.test(sqlText) ||
    /\bholding_since\b/.test(sqlText) ||
    /\bp1_steer\b/.test(sqlText) ||
    /\bp2_steer\b/.test(sqlText) ||
    /\bdrift_/.test(sqlText)
  );
}

function isStructuralMutation(sqlText: string): boolean {
  // Room create / invite / session / choice changes — idle-persist these.
  return (
    /\brooms\b/.test(sqlText) ||
    /\bparticipants\b/.test(sqlText)
  );
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

  return enqueueLocal(async () => {
    const result = await db.query<T>(text, params);
    const trimmed = text.trimStart().toLowerCase();
    const isMutation =
      trimmed.startsWith("insert") ||
      trimmed.startsWith("update") ||
      trimmed.startsWith("delete") ||
      trimmed.startsWith("with");

    if (isMutation && isStructuralMutation(trimmed) && !isHotPathMutation(trimmed)) {
      // Idle-debounce only — never dump inline with firework/builder bursts.
      scheduleIdlePersist(db);
    } else if (isMutation) {
      // Hot path: mark dirty for a later idle dump, but do not reschedule aggressively.
      state.dirty = true;
      state.lastMutationAt = Date.now();
      if (!state.persistTimer && hasBlobToken()) {
        scheduleIdlePersist(db);
      } else if (state.persistTimer) {
        // Push idle window out while spam continues
        clearTimeout(state.persistTimer);
        state.persistTimer = setTimeout(() => {
          state.persistTimer = null;
          void maybeIdlePersist(db);
        }, PERSIST_IDLE_MS);
      }
    }

    return result.rows;
  });
}
