import { NextRequest } from "next/server";
import { flushRoomPersist, sql } from "./db";
import {
  ACCENT_OPTIONS,
  AccentStyle,
  BASE_OPTIONS,
  BaseStyle,
  CANDLE_OPTIONS,
  CandleStyle,
  ClientSkyKind,
  DEFAULT_P1_CHOICE,
  DEFAULT_P2_CHOICE,
  FLOWER_OPTIONS,
  FlowerStyle,
  FUSION_STATES,
  FusionState,
  ParticipantActivity,
  RoomStateSnapshot,
  RoomStatus,
  SKY_HUES,
  SKY_KINDS,
  SkyHue,
  SkyKind,
  DriftSnapshot,
  isOneOf,
  normalizeChoice,
} from "./krathong";
import {
  DRIFT_DURATION_MS,
  averageSteer,
  buildDriftCourse,
  clampSteer,
  driftZAt,
  stepDrift,
  type DriftSim,
} from "./drift-game";
import {
  generateParticipantId,
  generateRoomId,
  generateSecretToken,
  getSessionCookie,
  isValidRoomId,
  sha256Hex,
  timingSafeEqualHex,
} from "./security";

export const HOLD_TARGET_MS = 3000;
const HOLD_SERVER_COMMIT_MS = 2600;
const HOLD_STALE_MS = 3500;
const ONLINE_WINDOW_MS = 12000;
const MAX_SKY_EVENTS_PER_ROOM = 40;
const HEART_COMBO_WINDOW_MS = 5000;

interface RoomRow {
  id: string;
  invite_secret_hash: string;
  base_style: string;
  flower_style: string;
  candle_style: string;
  accent_style: string;
  wish_text: string;
  p1_choice: unknown;
  p2_choice: unknown;
  p1_ready: boolean;
  p2_ready: boolean;
  fusion_state: string;
  fused_at: string | Date | null;
  both_holding_since: string | Date | null;
  status: string;
  released_at: string | Date | null;
  krathong_round: number;
  last_edited_by: string | null;
  last_edit_label: string | null;
}

interface ParticipantRow {
  id: string;
  room_id: string;
  slot: number;
  nickname: string;
  session_token_hash: string;
  activity: string;
  holding_since: string | Date | null;
  last_seen_at: string | Date;
}

interface SkyEventRow {
  id: string | number;
  participant_id?: string;
  sender_name: string;
  slot: number | null;
  kind: string;
  x: number;
  y: number;
  hue: string;
  message: string | null;
  created_at: string | Date;
}

function toMs(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export interface AuthParticipant {
  id: string;
  roomId: string;
  slot: 1 | 2;
  nickname: string;
}

export async function authenticateRoomRequest(
  request: NextRequest,
  roomId: string,
): Promise<AuthParticipant | null> {
  if (!isValidRoomId(roomId)) {
    return null;
  }
  const rawToken = getSessionCookie(request);
  if (!rawToken) {
    return null;
  }
  const presentedHash = sha256Hex(rawToken);
  const rows = await sql<ParticipantRow>(
    `select id, room_id, slot, nickname, session_token_hash, activity, holding_since, last_seen_at
     from participants
     where room_id = $1`,
    [roomId],
  );

  for (const row of rows) {
    if (timingSafeEqualHex(presentedHash, row.session_token_hash)) {
      return {
        id: row.id,
        roomId: row.room_id,
        slot: row.slot === 2 ? 2 : 1,
        nickname: row.nickname,
      };
    }
  }
  return null;
}

export async function createRoomWithCreator(nickname: string): Promise<{
  roomId: string;
  inviteSecret: string;
  participantId: string;
  sessionToken: string;
}> {
  const roomId = generateRoomId();
  const inviteSecret = generateSecretToken();
  const inviteSecretHash = sha256Hex(inviteSecret);

  const participantId = generateParticipantId();
  const sessionToken = generateSecretToken();
  const sessionTokenHash = sha256Hex(sessionToken);

  await sql(
    `insert into rooms (id, invite_secret_hash, p1_choice, p2_choice, fusion_state)
     values ($1, $2, $3::jsonb, $4::jsonb, 'building')`,
    [
      roomId,
      inviteSecretHash,
      JSON.stringify(DEFAULT_P1_CHOICE),
      JSON.stringify(DEFAULT_P2_CHOICE),
    ],
  );

  await sql(
    `insert into participants (id, room_id, slot, nickname, session_token_hash, activity, last_seen_at)
     values ($1, $2, 1, $3, $4, 'by_river', now())`,
    [participantId, roomId, nickname, sessionTokenHash],
  );

  await flushRoomPersist();
  return { roomId, inviteSecret, participantId, sessionToken };
}

export type JoinRoomResult =
  | {
      ok: true;
      participantId: string;
      slot: 1 | 2;
      sessionToken?: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function joinRoomWithInvite(
  request: NextRequest,
  roomId: string,
  inviteSecret: string,
  nickname: string,
): Promise<JoinRoomResult> {
  const rooms = await sql<Pick<RoomRow, "id" | "invite_secret_hash">>(
    `select id, invite_secret_hash from rooms where id = $1`,
    [roomId],
  );
  const room = rooms[0];
  if (!room) {
    return { ok: false, status: 404, error: "ไม่พบห้องริมน้ำนี้" };
  }

  const presentedInviteHash = sha256Hex(inviteSecret);
  if (!timingSafeEqualHex(presentedInviteHash, room.invite_secret_hash)) {
    return {
      ok: false,
      status: 403,
      error: "ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว",
    };
  }

  const existingAuth = await authenticateRoomRequest(request, roomId);
  if (existingAuth) {
    await sql(
      `update participants set last_seen_at = now() where id = $1 and room_id = $2`,
      [existingAuth.id, roomId],
    );
    return {
      ok: true,
      participantId: existingAuth.id,
      slot: existingAuth.slot,
    };
  }

  // Re-bind after session loss (serverless cold start): same nickname in this room
  // gets a fresh session cookie instead of being kicked to "ห้องไม่ใช่".
  const nickRows = await sql<
    Pick<ParticipantRow, "id" | "slot" | "nickname">
  >(
    `select id, slot, nickname from participants
     where room_id = $1 and lower(nickname) = lower($2)
     limit 1`,
    [roomId, nickname],
  );
  const nickMatch = nickRows[0];
  if (nickMatch) {
    const sessionToken = generateSecretToken();
    const sessionTokenHash = sha256Hex(sessionToken);
    await sql(
      `update participants
       set session_token_hash = $3, last_seen_at = now(), nickname = $4
       where id = $1 and room_id = $2`,
      [nickMatch.id, roomId, sessionTokenHash, nickname],
    );
    await flushRoomPersist();
    return {
      ok: true,
      participantId: nickMatch.id,
      slot: nickMatch.slot === 2 ? 2 : 1,
      sessionToken,
    };
  }

  const existingParticipants = await sql<{ count: string | number }>(
    `select count(*)::int as count from participants where room_id = $1`,
    [roomId],
  );
  const count = Number(existingParticipants[0]?.count ?? 0);
  if (count >= 2) {
    return {
      ok: false,
      status: 409,
      error: "ห้องนี้มีคู่รักครบ 2 คนแล้ว",
    };
  }

  const participantId = generateParticipantId();
  const sessionToken = generateSecretToken();
  const sessionTokenHash = sha256Hex(sessionToken);

  try {
    await sql(
      `insert into participants (id, room_id, slot, nickname, session_token_hash, activity, last_seen_at)
       values ($1, $2, 2, $3, $4, 'by_river', now())`,
      [participantId, roomId, nickname, sessionTokenHash],
    );
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "23505") {
      return {
        ok: false,
        status: 409,
        error: "ห้องนี้มีคู่รักครบ 2 คนแล้ว",
      };
    }
    throw error;
  }

  // If creator had triggered solo preview before partner arrived, reopen building so partner can customize their half!
  await sql(
    `update rooms
     set fusion_state = case when fusion_state = 'fused' and not (p1_ready and p2_ready) then 'building' else fusion_state end,
         fused_at = case when fusion_state = 'fused' and not (p1_ready and p2_ready) then null else fused_at end,
         both_holding_since = null,
         p1_ready = false,
         p2_ready = false,
         updated_at = now()
     where id = $1 and status = 'building'`,
    [roomId],
  );

  await flushRoomPersist();
  return {
    ok: true,
    participantId,
    slot: 2,
    sessionToken,
  };
}

async function syncHoldAndMaybeRelease(roomId: string): Promise<void> {
  const now = Date.now();
  const roomRows = await sql<
    Pick<RoomRow, "status" | "fusion_state" | "both_holding_since">
  >(
    `select status, fusion_state, both_holding_since from rooms where id = $1`,
    [roomId],
  );
  const room = roomRows[0];
  if (!room || room.status !== "building") {
    return;
  }

  const participants = await sql<
    Pick<ParticipantRow, "id" | "holding_since" | "last_seen_at">
  >(
    `select id, holding_since, last_seen_at
     from participants
     where room_id = $1`,
    [roomId],
  );

  const staleIds: string[] = [];
  let activeHoldCount = 0;

  for (const p of participants) {
    const holdMs = toMs(p.holding_since);
    const seenMs = toMs(p.last_seen_at) ?? 0;
    if (holdMs !== null) {
      if (now - seenMs > HOLD_STALE_MS || room.fusion_state !== "fused") {
        staleIds.push(p.id);
      } else {
        activeHoldCount += 1;
      }
    }
  }

  for (const staleId of staleIds) {
    await sql(
      `update participants
       set holding_since = null, activity = 'by_river'
       where id = $1 and room_id = $2`,
      [staleId, roomId],
    );
  }

  if (
    room.fusion_state === "fused" &&
    participants.length === 2 &&
    activeHoldCount === 2
  ) {
    let bothSinceMs = toMs(room.both_holding_since);
    if (bothSinceMs === null) {
      const updated = await sql<{ both_holding_since: string | Date }>(
        `update rooms
         set both_holding_since = coalesce(both_holding_since, now())
         where id = $1 and fusion_state = 'fused' and status = 'building'
         returning both_holding_since`,
        [roomId],
      );
      bothSinceMs = toMs(updated[0]?.both_holding_since) ?? now;
    }

    if (now - bothSinceMs >= HOLD_SERVER_COMMIT_MS) {
      const released = await sql<{ id: string }>(
        `update rooms
         set status = 'released',
             fusion_state = 'released',
             released_at = coalesce(released_at, now()),
             both_holding_since = null,
             updated_at = now()
         where id = $1 and fusion_state = 'fused' and status = 'building'
         returning id`,
        [roomId],
      );
      if (released.length > 0) {
        await sql(
          `update participants
           set holding_since = null, activity = 'by_river'
           where room_id = $1`,
          [roomId],
        );
      }
    }
  } else if (room.both_holding_since !== null) {
    await sql(
      `update rooms set both_holding_since = null where id = $1`,
      [roomId],
    );
  }
}

const roomLocks = new Map<string, Promise<unknown>>();

function lockRoom<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
  const prev = roomLocks.get(roomId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  roomLocks.set(
    roomId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

function idleDrift(): DriftSnapshot {
  return {
    status: "idle",
    seed: 0,
    score: 0,
    x: 0,
    z: driftZAt(0),
    steer: 0,
    elapsedMs: 0,
    durationMs: DRIFT_DURATION_MS,
    items: [],
  };
}

interface DriftRow {
  status: string;
  drift_status: string | null;
  drift_started_at: string | Date | null;
  drift_seed: number | null;
  drift_score: number | null;
  drift_x: number | null;
  drift_tick_ms: number | null;
  drift_resolved: string | null;
  p1_steer: number | null;
  p2_steer: number | null;
}

async function advanceDrift(
  roomId: string,
  onlineSlots: Array<1 | 2>,
): Promise<DriftSnapshot> {
  const rows = await sql<DriftRow>(
    `select status, drift_status, drift_started_at, drift_seed, drift_score, drift_x,
            drift_tick_ms, drift_resolved, p1_steer, p2_steer
     from rooms
     where id = $1`,
    [roomId],
  );
  const row = rows[0];
  if (!row || row.status !== "released") return idleDrift();

  const status =
    row.drift_status === "playing" || row.drift_status === "done"
      ? row.drift_status
      : "idle";
  if (status === "idle") return idleDrift();

  const startedAtMs = toMs(row.drift_started_at) ?? Date.now();
  let sim: DriftSim = {
    status,
    seed: Number(row.drift_seed) || 1,
    score: Number(row.drift_score) || 0,
    x: Number(row.drift_x) || 0,
    startedAtMs,
    tickMs: Number(row.drift_tick_ms) || startedAtMs,
    resolved: (row.drift_resolved ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0),
  };
  const steer = averageSteer(
    Number(row.p1_steer) || 0,
    Number(row.p2_steer) || 0,
    onlineSlots,
  );

  if (sim.status === "playing") {
    const next = stepDrift(sim, Date.now(), steer);
    await sql(
      `update rooms
       set drift_status = $2,
           drift_score = $3,
           drift_x = $4,
           drift_tick_ms = $5,
           drift_resolved = $6
       where id = $1`,
      [roomId, next.status, next.score, next.x, next.tickMs, next.resolved.join(",")],
    );
    sim = next;
  }

  const elapsedMs =
    sim.status === "idle"
      ? 0
      : Math.max(0, Math.min(DRIFT_DURATION_MS, Date.now() - sim.startedAtMs));
  const resolved = new Set(sim.resolved);
  return {
    status: sim.status,
    seed: sim.seed,
    score: sim.score,
    x: sim.x,
    z: driftZAt(elapsedMs),
    steer,
    elapsedMs,
    durationMs: DRIFT_DURATION_MS,
    items: buildDriftCourse(sim.seed).map((item) => ({
      ...item,
      resolved: resolved.has(item.id),
    })),
  };
}

async function loadRoomStateSnapshot(
  roomId: string,
  callerParticipantId: string,
  touchPresence = true,
): Promise<RoomStateSnapshot | null> {
  if (touchPresence) {
    await sql(
      `update participants
       set last_seen_at = now()
       where id = $1 and room_id = $2`,
      [callerParticipantId, roomId],
    );
  }

  await syncHoldAndMaybeRelease(roomId);

  const rooms = await sql<RoomRow>(
    `select id, base_style, flower_style, candle_style, accent_style, wish_text,
            p1_choice, p2_choice, p1_ready, p2_ready, fusion_state, fused_at,
            both_holding_since, status, released_at, krathong_round,
            last_edited_by, last_edit_label
     from rooms
     where id = $1`,
    [roomId],
  );
  const room = rooms[0];
  if (!room) return null;

  const participantRows = await sql<ParticipantRow>(
    `select id, room_id, slot, nickname, activity, holding_since, last_seen_at
     from participants
     where room_id = $1
     order by slot asc`,
    [roomId],
  );

  const skyRows = await sql<SkyEventRow>(
    `select id, sender_name, slot, kind, x, y, hue, message, created_at
     from sky_events
     where room_id = $1
     order by id desc
     limit $2`,
    [roomId, MAX_SKY_EVENTS_PER_ROOM],
  );

  const now = Date.now();
  const status: RoomStatus =
    room.status === "released" ? "released" : "building";
  const fusionState: FusionState =
    status === "released"
      ? "released"
      : isOneOf(FUSION_STATES, room.fusion_state)
        ? room.fusion_state
        : "building";

  const p1Ready = Boolean(room.p1_ready);
  const p2Ready = Boolean(room.p2_ready);

  const participants = participantRows.map((p) => {
    const slot = (p.slot === 2 ? 2 : 1) as 1 | 2;
    const lastSeenMs = toMs(p.last_seen_at) ?? 0;
    const online = now - lastSeenMs <= ONLINE_WINDOW_MS;
    const holdMs = toMs(p.holding_since);
    const holding =
      fusionState === "fused" &&
      holdMs !== null &&
      now - lastSeenMs <= HOLD_STALE_MS;
    const readyToFuse = slot === 1 ? p1Ready : p2Ready;

    const activity: ParticipantActivity = holding
      ? "holding"
      : fusionState === "building" && readyToFuse
        ? "ready_fuse"
        : p.activity === "decorating" ||
            p.activity === "wishing" ||
            p.activity === "ready_fuse" ||
            p.activity === "by_river"
          ? p.activity
          : "by_river";

    return {
      id: p.id,
      slot,
      nickname: p.nickname,
      isSelf: p.id === callerParticipantId,
      online,
      activity,
      readyToFuse,
      holding,
      holdingSinceMs: holding ? holdMs : null,
    };
  });

  const bothJoined = participants.length === 2;
  const bothHolding =
    bothJoined &&
    fusionState === "fused" &&
    participants.every((p) => p.holding);

  const bothHoldingSinceMs = bothHolding
    ? (toMs(room.both_holding_since) ?? now)
    : null;
  const bothHoldingElapsedMs =
    bothHolding && bothHoldingSinceMs !== null
      ? Math.max(0, now - bothHoldingSinceMs)
      : 0;

  const p1Choice = normalizeChoice(room.p1_choice, DEFAULT_P1_CHOICE);
  const p2Choice = normalizeChoice(room.p2_choice, DEFAULT_P2_CHOICE);

  const drift = await advanceDrift(
    roomId,
    participants.filter((p) => p.online).map((p) => p.slot),
  );

  const skyEvents = skyRows
    .slice()
    .reverse()
    .map((ev) => ({
      id: Number(ev.id),
      senderName: ev.sender_name,
      slot: (ev.slot === 2 ? 2 : 1) as 1 | 2,
      kind: (isOneOf(SKY_KINDS, ev.kind) ? ev.kind : "lantern") as SkyKind,
      x: Number(ev.x),
      y: Number(ev.y),
      hue: (isOneOf(SKY_HUES, ev.hue) ? ev.hue : "amber") as SkyHue,
      message: ev.message ?? "",
      createdAtMs: toMs(ev.created_at) ?? now,
    }));

  return {
    roomId: room.id,
    status,
    fusionState,
    fusedAtMs: toMs(room.fused_at),
    krathongRound: Number(room.krathong_round || 1),
    releasedAtMs: toMs(room.released_at),
    lastEditedBy: room.last_edited_by,
    lastEditLabel: room.last_edit_label,
    krathong: p1Choice,
    p1Choice,
    p2Choice,
    p1Ready,
    p2Ready,
    participants,
    holdSync: {
      bothJoined,
      bothHolding,
      bothHoldingSinceMs,
      bothHoldingElapsedMs,
      targetHoldMs: HOLD_TARGET_MS,
    },
    skyEvents,
    drift,
    serverNowMs: now,
  };
}

export async function getRoomStateSnapshot(
  roomId: string,
  callerParticipantId: string,
  touchPresence = true,
): Promise<RoomStateSnapshot | null> {
  return lockRoom(roomId, () =>
    loadRoomStateSnapshot(roomId, callerParticipantId, touchPresence),
  );
}

export interface KrathongPatchInput {
  baseStyle?: BaseStyle;
  flowerStyle?: FlowerStyle;
  candleStyle?: CandleStyle;
  accentStyle?: AccentStyle;
  wishText?: string;
}

export async function updateParticipantChoice(
  auth: AuthParticipant,
  patch: KrathongPatchInput,
  requestedSlot?: 1 | 2,
): Promise<
  | { ok: true; state: RoomStateSnapshot }
  | { ok: false; status: number; error: string }
> {
  const existingRows = await sql<
    Pick<RoomRow, "status" | "fusion_state" | "p1_choice" | "p2_choice">
  >(
    `select status, fusion_state, p1_choice, p2_choice
     from rooms
     where id = $1`,
    [auth.roomId],
  );
  const current = existingRows[0];
  if (!current) {
    return { ok: false, status: 404, error: "ไม่พบห้องริมน้ำนี้" };
  }
  if (current.status !== "building" || current.fusion_state !== "building") {
    return {
      ok: false,
      status: 409,
      error: "กระทงถูกผสานหรือปล่อยลงสายน้ำแล้ว",
    };
  }

  let effectiveSlot: 1 | 2 = auth.slot;
  if (requestedSlot === 2 && auth.slot === 1) {
    const countRows = await sql<{ count: string | number }>(
      `select count(*)::int as count from participants where room_id = $1`,
      [auth.roomId],
    );
    if (Number(countRows[0]?.count ?? 1) === 1) {
      effectiveSlot = 2;
    }
  }

  const prevChoice =
    effectiveSlot === 1
      ? normalizeChoice(current.p1_choice, DEFAULT_P1_CHOICE)
      : normalizeChoice(current.p2_choice, DEFAULT_P2_CHOICE);

  const nextChoice = {
    baseStyle: patch.baseStyle ?? prevChoice.baseStyle,
    flowerStyle: patch.flowerStyle ?? prevChoice.flowerStyle,
    candleStyle: patch.candleStyle ?? prevChoice.candleStyle,
    accentStyle: patch.accentStyle ?? prevChoice.accentStyle,
    wishText:
      patch.wishText !== undefined ? patch.wishText : prevChoice.wishText,
  };

  let editLabel: string | null = null;
  let nextActivity: ParticipantActivity = "decorating";

  if (patch.baseStyle && patch.baseStyle !== prevChoice.baseStyle) {
    const label =
      BASE_OPTIONS.find((o) => o.id === patch.baseStyle)?.label ?? "ฐานกระทง";
    editLabel = `เปลี่ยนฐานเป็น${label}`;
  } else if (patch.flowerStyle && patch.flowerStyle !== prevChoice.flowerStyle) {
    const label =
      FLOWER_OPTIONS.find((o) => o.id === patch.flowerStyle)?.label ?? "ดอกไม้";
    editLabel = `เปลี่ยนดอกไม้เป็น${label}`;
  } else if (patch.candleStyle && patch.candleStyle !== prevChoice.candleStyle) {
    const label =
      CANDLE_OPTIONS.find((o) => o.id === patch.candleStyle)?.label ?? "เทียน";
    editLabel = `เปลี่ยนสีเทียนเป็น${label}`;
  } else if (patch.accentStyle && patch.accentStyle !== prevChoice.accentStyle) {
    const label =
      ACCENT_OPTIONS.find((o) => o.id === patch.accentStyle)?.label ?? "ของตกแต่ง";
    editLabel = `เพิ่ม${label}`;
  } else if (patch.wishText !== undefined) {
    editLabel = "เขียนคำอธิษฐานแล้ว";
    nextActivity = "wishing";
  }

  if (effectiveSlot === 1) {
    await sql(
      `update rooms
       set p1_choice = $2::jsonb,
           base_style = $3,
           flower_style = $4,
           candle_style = $5,
           accent_style = $6,
           wish_text = $7,
           last_edited_by = $8,
           last_edit_label = coalesce($9, last_edit_label),
           updated_at = now()
       where id = $1 and fusion_state = 'building'`,
      [
        auth.roomId,
        JSON.stringify(nextChoice),
        nextChoice.baseStyle,
        nextChoice.flowerStyle,
        nextChoice.candleStyle,
        nextChoice.accentStyle,
        nextChoice.wishText,
        auth.nickname,
        editLabel,
      ],
    );
  } else {
    await sql(
      `update rooms
       set p2_choice = $2::jsonb,
           last_edited_by = $3,
           last_edit_label = coalesce($4, last_edit_label),
           updated_at = now()
       where id = $1 and fusion_state = 'building'`,
      [auth.roomId, JSON.stringify(nextChoice), auth.nickname, editLabel],
    );
  }

  await sql(
    `update participants
     set activity = case when holding_since is not null then 'holding' else $3 end,
         last_seen_at = now()
     where id = $1 and room_id = $2`,
    [auth.id, auth.roomId, nextActivity],
  );

  const state = await getRoomStateSnapshot(auth.roomId, auth.id, false);
  if (!state) {
    return { ok: false, status: 404, error: "ไม่พบห้องริมน้ำนี้" };
  }
  return { ok: true, state };
}

export async function updateFusionState(
  auth: AuthParticipant,
  action:
    | { type: "set_ready"; ready: boolean }
    | { type: "solo_preview" }
    | { type: "unfuse" },
): Promise<
  | { ok: true; state: RoomStateSnapshot }
  | { ok: false; status: number; error: string }
> {
  const roomRows = await sql<
    Pick<RoomRow, "status" | "fusion_state" | "p1_ready" | "p2_ready">
  >(
    `select status, fusion_state, p1_ready, p2_ready from rooms where id = $1`,
    [auth.roomId],
  );
  const room = roomRows[0];
  if (!room) {
    return { ok: false, status: 404, error: "ไม่พบห้องริมน้ำนี้" };
  }
  if (room.status === "released") {
    return { ok: false, status: 409, error: "กระทงถูกปล่อยลงสายน้ำแล้ว" };
  }

  const countRows = await sql<{ count: string | number }>(
    `select count(*)::int as count from participants where room_id = $1`,
    [auth.roomId],
  );
  const participantCount = Number(countRows[0]?.count ?? 1);

  if (action.type === "unfuse") {
    await sql(
      `update rooms
       set fusion_state = 'building',
           fused_at = null,
           both_holding_since = null,
           p1_ready = false,
           p2_ready = false,
           last_edited_by = $2,
           last_edit_label = 'เปิดกลับมาปรับแต่งกระทงเพิ่มเติม',
           updated_at = now()
       where id = $1 and status = 'building'`,
      [auth.roomId, auth.nickname],
    );
    await sql(
      `update participants
       set holding_since = null, activity = 'by_river', last_seen_at = now()
       where room_id = $1`,
      [auth.roomId],
    );
  } else if (action.type === "solo_preview") {
    if (participantCount >= 2) {
      return {
        ok: false,
        status: 409,
        error: "คนพิเศษเข้าห้องแล้ว กดพร้อมผสานพร้อมกันทั้งสองคนได้เลย",
      };
    }
    await sql(
      `update rooms
       set fusion_state = 'fused',
           fused_at = now(),
           p1_ready = true,
           last_edited_by = $2,
           last_edit_label = 'ลองผสานกระทงสองใจตัวอย่าง',
           updated_at = now()
       where id = $1 and status = 'building'`,
      [auth.roomId, auth.nickname],
    );
  } else {
    const nextP1Ready = auth.slot === 1 ? action.ready : Boolean(room.p1_ready);
    const nextP2Ready = auth.slot === 2 ? action.ready : Boolean(room.p2_ready);
    const shouldFuse = participantCount === 2 && nextP1Ready && nextP2Ready;

    await sql(
      `update rooms
       set p1_ready = $2,
           p2_ready = $3,
           fusion_state = case when $4 then 'fused' else 'building' end,
           fused_at = case when $4 then coalesce(fused_at, now()) else null end,
           both_holding_since = null,
           last_edited_by = $5,
           last_edit_label = $6,
           updated_at = now()
       where id = $1 and status = 'building'`,
      [
        auth.roomId,
        nextP1Ready,
        nextP2Ready,
        shouldFuse,
        auth.nickname,
        shouldFuse
          ? "ผสานกระทงสองใจเป็นหนึ่งเดียวแล้ว!"
          : action.ready
            ? "พร้อมผสานกระทงแล้ว"
            : "ยกเลิกสถานะพร้อมชั่วคราว",
      ],
    );

    await sql(
      `update participants
       set activity = $3, last_seen_at = now()
       where id = $1 and room_id = $2`,
      [auth.id, auth.roomId, action.ready ? "ready_fuse" : "by_river"],
    );
  }

  const state = await getRoomStateSnapshot(auth.roomId, auth.id, false);
  if (!state) {
    return { ok: false, status: 404, error: "ไม่พบห้องริมน้ำนี้" };
  }
  return { ok: true, state };
}

export async function updateParticipantHold(
  auth: AuthParticipant,
  holding: boolean,
): Promise<RoomStateSnapshot | null> {
  const roomRows = await sql<Pick<RoomRow, "fusion_state" | "status">>(
    `select fusion_state, status from rooms where id = $1`,
    [auth.roomId],
  );
  const room = roomRows[0];
  if (!room) return null;

  if (holding && room.fusion_state === "fused" && room.status === "building") {
    await sql(
      `update participants
       set holding_since = coalesce(holding_since, now()),
           activity = 'holding',
           last_seen_at = now()
       where id = $1 and room_id = $2`,
      [auth.id, auth.roomId],
    );
  } else {
    await sql(
      `update participants
       set holding_since = null,
           activity = 'by_river',
           last_seen_at = now()
       where id = $1 and room_id = $2`,
      [auth.id, auth.roomId],
    );
    await sql(
      `update rooms set both_holding_since = null where id = $1`,
      [auth.roomId],
    );
  }

  return getRoomStateSnapshot(auth.roomId, auth.id, false);
}

export async function addSkyEvent(
  auth: AuthParticipant,
  kind: ClientSkyKind,
  x: number,
  y: number,
  hue: SkyHue,
  message: string,
): Promise<RoomStateSnapshot | null> {
  let effectiveKind: SkyKind = kind;

  if (kind === "heart") {
    const recentPartnerHearts = await sql<Pick<SkyEventRow, "id" | "created_at">>(
      `select id, created_at
       from sky_events
       where room_id = $1
         and participant_id <> $2
         and kind = 'heart'
       order by id desc
       limit 1`,
      [auth.roomId, auth.id],
    );
    const partnerHeart = recentPartnerHearts[0];
    const partnerHeartMs = toMs(partnerHeart?.created_at);
    if (
      partnerHeartMs !== null &&
      Date.now() - partnerHeartMs <= HEART_COMBO_WINDOW_MS
    ) {
      effectiveKind = "heart_combo";
    }
  }

  await sql(
    `insert into sky_events (room_id, participant_id, sender_name, slot, kind, x, y, hue, message)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      auth.roomId,
      auth.id,
      auth.nickname,
      auth.slot,
      effectiveKind,
      x,
      y,
      hue,
      kind === "lantern" ? message : "",
    ],
  );

  await sql(
    `delete from sky_events
     where room_id = $1
       and id not in (
         select id from sky_events
         where room_id = $1
         order by id desc
         limit $2
       )`,
    [auth.roomId, MAX_SKY_EVENTS_PER_ROOM],
  );

  return getRoomStateSnapshot(auth.roomId, auth.id, true);
}

export async function startDriftGame(
  auth: AuthParticipant,
): Promise<RoomStateSnapshot | null> {
  return lockRoom(auth.roomId, async () => {
    const rows = await sql<{ status: string; drift_status: string | null }>(
      `select status, drift_status from rooms where id = $1`,
      [auth.roomId],
    );
    const room = rows[0];
    if (!room || room.status !== "released") {
      return loadRoomStateSnapshot(auth.roomId, auth.id, true);
    }
    if (room.drift_status !== "playing") {
      const now = Date.now();
      const seed = Math.floor(Math.random() * 1_000_000_000) + 1;
      await sql(
        `update rooms
         set drift_status = 'playing',
             drift_started_at = now(),
             drift_seed = $2,
             drift_score = 0,
             drift_x = 0,
             drift_tick_ms = $3,
             drift_resolved = '',
             p1_steer = 0,
             p2_steer = 0,
             updated_at = now()
         where id = $1 and status = 'released'`,
        [auth.roomId, seed, now],
      );
    }
    return loadRoomStateSnapshot(auth.roomId, auth.id, true);
  });
}

export async function setDriftSteer(
  auth: AuthParticipant,
  steer: number,
): Promise<RoomStateSnapshot | null> {
  return lockRoom(auth.roomId, async () => {
    const column = auth.slot === 2 ? "p2_steer" : "p1_steer";
    await sql(
      `update rooms set ${column} = $2 where id = $1 and drift_status = 'playing'`,
      [auth.roomId, clampSteer(steer)],
    );
    return loadRoomStateSnapshot(auth.roomId, auth.id, true);
  });
}

export async function resetRoomForNewKrathong(
  auth: AuthParticipant,
): Promise<RoomStateSnapshot | null> {
  await sql(
    `update rooms
     set status = 'building',
         fusion_state = 'building',
         p1_ready = false,
         p2_ready = false,
         fused_at = null,
         both_holding_since = null,
         released_at = null,
         drift_status = 'idle',
         drift_started_at = null,
         drift_seed = 0,
         drift_score = 0,
         drift_x = 0,
         drift_tick_ms = 0,
         drift_resolved = '',
         p1_steer = 0,
         p2_steer = 0,
         krathong_round = krathong_round + 1,
         last_edited_by = $2,
         last_edit_label = 'ชวนมาลอยกระทงใบใหม่ด้วยกัน',
         updated_at = now()
     where id = $1 and status = 'released'`,
    [auth.roomId, auth.nickname],
  );

  await sql(
    `update participants
     set holding_since = null,
         activity = 'by_river'
     where room_id = $1`,
    [auth.roomId],
  );

  return getRoomStateSnapshot(auth.roomId, auth.id, true);
}
