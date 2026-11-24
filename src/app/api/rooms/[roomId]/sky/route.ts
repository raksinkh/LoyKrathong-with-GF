import { NextRequest } from "next/server";
import {
  CLIENT_SKY_KINDS,
  SKY_HUES,
  SkyHue,
  isOneOf,
  sanitizeLanternMessage,
} from "@/lib/krathong";
import { addSkyEvent, authenticateRoomRequest } from "@/lib/room-service";
import {
  checkRateLimit,
  isValidRoomId,
  jsonNoStore,
  validateCsrf,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return jsonNoStore({ error: "คำขอไม่ถูกต้อง" }, { status: 403 });
  }

  const { roomId } = await context.params;
  if (!isValidRoomId(roomId)) {
    return jsonNoStore({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
  }

  const auth = await authenticateRoomRequest(request, roomId);
  if (!auth) {
    return jsonNoStore({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
  }

  if (!checkRateLimit(`sky:${auth.roomId}`, 90, 60 * 1000)) {
    return jsonNoStore(
      { error: "ส่งลูกเล่นถี่เกินไป พักชมท้องฟ้าสักครู่นะ" },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return jsonNoStore({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const normalizedKind = raw.kind === "firework" ? "sparkle" : raw.kind;
  if (!isOneOf(CLIENT_SKY_KINDS, normalizedKind)) {
    return jsonNoStore({ error: "ประเภทลูกเล่นไม่ถูกต้อง" }, { status: 400 });
  }

  const x =
    typeof raw.x === "number" && Number.isFinite(raw.x)
      ? Math.max(4, Math.min(96, raw.x))
      : 50;
  const y =
    typeof raw.y === "number" && Number.isFinite(raw.y)
      ? Math.max(6, Math.min(82, raw.y))
      : raw.kind === "heart"
        ? 68
        : 36;

  const hue: SkyHue = isOneOf(SKY_HUES, raw.hue)
    ? raw.hue
    : auth.slot === 1
      ? "amber"
      : "rose";

  const message = sanitizeLanternMessage(raw.message);
  if (message === null) {
    return jsonNoStore(
      { error: "ข้อความบนโคมลอยต้องยาวไม่เกิน 60 ตัวอักษร" },
      { status: 400 },
    );
  }

  try {
    const state = await addSkyEvent(auth, normalizedKind, x, y, hue, message);
    if (!state) {
      return jsonNoStore({ error: "ไม่พบห้องริมน้ำนี้" }, { status: 404 });
    }
    return jsonNoStore(state, { status: 201 });
  } catch {
    return jsonNoStore(
      { error: "ไม่สามารถส่งลูกเล่นได้ในขณะนี้" },
      { status: 500 },
    );
  }
}
