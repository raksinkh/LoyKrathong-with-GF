import { get, put } from "@vercel/blob";
import { sql } from "./db";

/**
 * Per-room Blob JSON — shared source of truth across serverless instances.
 *
 * Full PGlite dumps are per-instance memory + occasional backup. Host create on
 * instance A + guest join on instance B was 404ing because B never saw the room.
 * These per-room files fix multi-person join without requiring Postgres.
 */

const ROOM_BLOB_PREFIX = "loykrathong/rooms/";

type SqlRow = Record<string, unknown>;

export interface SyncedRoomBlob {
  v: 1;
  updatedAt: number;
  room: SqlRow;
  participants: SqlRow[];
  skyEvents: SqlRow[];
}

interface SyncGlobals {
  publishTimers?: Map<string, ReturnType<typeof setTimeout>>;
  publishInFlight?: Map<string, Promise<void>>;
  lastPulledAt?: Map<string, number>;
  /** Rooms mutated locally and not yet successfully published to Blob. */
  dirtyRooms?: Set<string>;
}

const globalForSync = globalThis as unknown as {
  __moonlightRoomBlobSync?: SyncGlobals;
};

const syncState = (globalForSync.__moonlightRoomBlobSync ??= {
  publishTimers: new Map(),
  publishInFlight: new Map(),
  lastPulledAt: new Map(),
  dirtyRooms: new Set(),
});

export function markRoomLocalDirty(roomId: string): void {
  syncState.dirtyRooms ??= new Set();
  syncState.dirtyRooms.add(roomId);
}

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function roomBlobPath(roomId: string): string {
  return `${ROOM_BLOB_PREFIX}${roomId}.json`;
}

function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return String(value);
}

function jsonCell(value: unknown): string {
  if (typeof value === "string") {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(value);
    }
  }
  return JSON.stringify(value ?? {});
}

async function readRoomBlob(roomId: string): Promise<SyncedRoomBlob | null> {
  if (!hasBlobToken()) return null;
  try {
    const result = await get(roomBlobPath(roomId), {
      access: "private",
      useCache: false,
    });
    if (!result?.stream) return null;
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as SyncedRoomBlob;
    if (!parsed || parsed.v !== 1 || !parsed.room?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeRoomBlob(roomId: string, payload: SyncedRoomBlob): Promise<void> {
  if (!hasBlobToken()) return;
  await put(roomBlobPath(roomId), JSON.stringify(payload), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

async function snapshotRoomFromLocal(roomId: string): Promise<SyncedRoomBlob | null> {
  const rooms = await sql<SqlRow>(
    `select id, invite_secret_hash, base_style, flower_style, candle_style, accent_style,
            wish_text, p1_choice, p2_choice, p1_ready, p2_ready, fusion_state, fused_at,
            both_holding_since, status, released_at, krathong_round, last_edited_by,
            last_edit_label, drift_status, drift_started_at, drift_seed, drift_score,
            drift_x, drift_tick_ms, drift_resolved, p1_steer, p2_steer,
            updated_at, created_at
     from rooms where id = $1`,
    [roomId],
  );
  const room = rooms[0];
  if (!room) return null;

  const participants = await sql<SqlRow>(
    `select id, room_id, slot, nickname, session_token_hash, activity,
            holding_since, last_seen_at, created_at
     from participants where room_id = $1 order by slot asc`,
    [roomId],
  );

  const skyEvents = await sql<SqlRow>(
    `select id, room_id, participant_id, sender_name, slot, kind, x, y, hue, message, created_at
     from sky_events where room_id = $1 order by id desc limit 40`,
    [roomId],
  );

  return {
    v: 1,
    updatedAt: Date.now(),
    room,
    participants,
    skyEvents: skyEvents.reverse(),
  };
}

async function applyRoomBlobLocally(blob: SyncedRoomBlob): Promise<void> {
  const r = blob.room;
  const roomId = String(r.id);

  // Drop dependents first (sky → participants), then upsert shared room state.
  await sql(`delete from sky_events where room_id = $1`, [roomId]);
  await sql(`delete from participants where room_id = $1`, [roomId]);

  await sql(
    `insert into rooms (
       id, invite_secret_hash, base_style, flower_style, candle_style, accent_style,
       wish_text, p1_choice, p2_choice, p1_ready, p2_ready, fusion_state, fused_at,
       both_holding_since, status, released_at, krathong_round, last_edited_by,
       last_edit_label, drift_status, drift_started_at, drift_seed, drift_score,
       drift_x, drift_tick_ms, drift_resolved, p1_steer, p2_steer, updated_at, created_at
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
       $20,$21,$22,$23,$24,$25,$26,$27,$28,coalesce($29::timestamptz, now()), coalesce($30::timestamptz, now())
     )
     on conflict (id) do update set
       invite_secret_hash = excluded.invite_secret_hash,
       base_style = excluded.base_style,
       flower_style = excluded.flower_style,
       candle_style = excluded.candle_style,
       accent_style = excluded.accent_style,
       wish_text = excluded.wish_text,
       p1_choice = excluded.p1_choice,
       p2_choice = excluded.p2_choice,
       p1_ready = excluded.p1_ready,
       p2_ready = excluded.p2_ready,
       fusion_state = excluded.fusion_state,
       fused_at = excluded.fused_at,
       both_holding_since = excluded.both_holding_since,
       status = excluded.status,
       released_at = excluded.released_at,
       krathong_round = excluded.krathong_round,
       last_edited_by = excluded.last_edited_by,
       last_edit_label = excluded.last_edit_label,
       drift_status = excluded.drift_status,
       drift_started_at = excluded.drift_started_at,
       drift_seed = excluded.drift_seed,
       drift_score = excluded.drift_score,
       drift_x = excluded.drift_x,
       drift_tick_ms = excluded.drift_tick_ms,
       drift_resolved = excluded.drift_resolved,
       p1_steer = excluded.p1_steer,
       p2_steer = excluded.p2_steer,
       updated_at = excluded.updated_at`,
    [
      r.id,
      r.invite_secret_hash,
      r.base_style ?? "banana_leaf",
      r.flower_style ?? "marigold_globe",
      r.candle_style ?? "warm_gold",
      r.accent_style ?? "dok_rak_heart",
      r.wish_text ?? "",
      jsonCell(r.p1_choice),
      jsonCell(r.p2_choice),
      Boolean(r.p1_ready),
      Boolean(r.p2_ready),
      r.fusion_state ?? "building",
      toIso(r.fused_at),
      toIso(r.both_holding_since),
      r.status ?? "building",
      toIso(r.released_at),
      Number(r.krathong_round ?? 1),
      r.last_edited_by ?? null,
      r.last_edit_label ?? null,
      r.drift_status ?? "idle",
      toIso(r.drift_started_at),
      Number(r.drift_seed ?? 0),
      Number(r.drift_score ?? 0),
      Number(r.drift_x ?? 0),
      Number(r.drift_tick_ms ?? 0),
      r.drift_resolved ?? "",
      Number(r.p1_steer ?? 0),
      Number(r.p2_steer ?? 0),
      toIso(r.updated_at),
      toIso(r.created_at),
    ],
  );

  for (const p of blob.participants) {
    await sql(
      `insert into participants (
         id, room_id, slot, nickname, session_token_hash, activity,
         holding_since, last_seen_at, created_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9::timestamptz, now()))`,
      [
        p.id,
        p.room_id ?? roomId,
        Number(p.slot),
        p.nickname,
        p.session_token_hash,
        p.activity ?? "by_river",
        toIso(p.holding_since),
        toIso(p.last_seen_at) ?? new Date().toISOString(),
        toIso(p.created_at),
      ],
    );
  }

  let maxSkyId = 0;
  for (const ev of blob.skyEvents) {
    const idNum = Number(ev.id);
    if (Number.isFinite(idNum) && idNum > maxSkyId) maxSkyId = idNum;
    await sql(
      `insert into sky_events (
         id, room_id, participant_id, sender_name, slot, kind, x, y, hue, message, created_at
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,coalesce($11::timestamptz, now())
       )`,
      [
        ev.id,
        ev.room_id ?? roomId,
        ev.participant_id,
        ev.sender_name,
        Number(ev.slot ?? 1),
        ev.kind,
        Number(ev.x ?? 50),
        Number(ev.y ?? 36),
        ev.hue ?? "amber",
        ev.message ?? "",
        toIso(ev.created_at),
      ],
    );
  }

  if (maxSkyId > 0) {
    try {
      await sql(
        `select setval(pg_get_serial_sequence('sky_events', 'id'), $1, true)`,
        [maxSkyId],
      );
    } catch {
      // PGlite may not expose setval the same way — ignore
    }
  }
}

/**
 * Pull shared room into local PGlite when missing or stale.
 * Call before auth/join/get for a roomId.
 */
export async function ensureRoomLocal(roomId: string): Promise<boolean> {
  if (!hasBlobToken()) {
    const local = await sql<{ id: string }>(
      `select id from rooms where id = $1`,
      [roomId],
    );
    return Boolean(local[0]);
  }

  const local = await sql<{ id: string }>(
    `select id from rooms where id = $1`,
    [roomId],
  );
  const hasLocal = Boolean(local[0]);

  // Don't clobber in-flight local writes (sky/builder) with a stale Blob GET.
  if (hasLocal && syncState.dirtyRooms?.has(roomId)) {
    return true;
  }

  // Prefer shared Blob so host/guest on different instances converge.
  const blob = await readRoomBlob(roomId);
  if (!blob) {
    return hasLocal;
  }

  await applyRoomBlobLocally(blob);
  syncState.lastPulledAt?.set(roomId, Date.now());
  return true;
}

/** Immediate publish after create/join/session changes. */
export async function publishRoomNow(roomId: string): Promise<void> {
  if (!hasBlobToken()) return;
  const timers = syncState.publishTimers!;
  const existingTimer = timers.get(roomId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    timers.delete(roomId);
  }

  const inFlight = syncState.publishInFlight!;
  const prev = inFlight.get(roomId);
  if (prev) await prev.catch(() => {});

  markRoomLocalDirty(roomId);

  const run = (async () => {
    const snap = await snapshotRoomFromLocal(roomId);
    if (!snap) return;
    await writeRoomBlob(roomId, snap);
    syncState.lastPulledAt?.set(roomId, Date.now());
    syncState.dirtyRooms?.delete(roomId);
  })();

  inFlight.set(roomId, run);
  try {
    await run;
  } finally {
    if (inFlight.get(roomId) === run) inFlight.delete(roomId);
  }
}

/** Debounced publish for sky/builder spam (still shared across instances). */
export function publishRoomSoon(roomId: string, delayMs = 250): void {
  if (!hasBlobToken()) return;
  markRoomLocalDirty(roomId);
  const timers = syncState.publishTimers!;
  const existing = timers.get(roomId);
  if (existing) clearTimeout(existing);
  timers.set(
    roomId,
    setTimeout(() => {
      timers.delete(roomId);
      void publishRoomNow(roomId);
    }, delayMs),
  );
}
