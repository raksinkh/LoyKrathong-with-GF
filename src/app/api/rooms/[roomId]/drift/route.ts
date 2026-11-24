import { NextRequest } from "next/server";
import { setDriftSteer, startDriftGame, authenticateRoomRequest } from "@/lib/room-service";
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const raw =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const action = raw.action === "steer" ? "steer" : "start";

  if (action === "start") {
    if (!checkRateLimit(`drift-start:${auth.roomId}`, 8, 60 * 1000)) {
      return jsonNoStore({ error: "พักสักครู่นะ" }, { status: 429 });
    }
  } else if (!checkRateLimit(`drift-steer:${auth.id}`, 25, 1000)) {
    return jsonNoStore({ error: "ส่งถี่เกินไป" }, { status: 429 });
  }

  try {
    const state =
      action === "steer"
        ? await setDriftSteer(
            auth,
            typeof raw.steer === "number" ? raw.steer : 0,
          )
        : await startDriftGame(auth);
    if (!state) {
      return jsonNoStore({ error: "ไม่พบห้องริมน้ำนี้" }, { status: 404 });
    }
    return jsonNoStore(state);
  } catch {
    return jsonNoStore({ error: "เล่นเกมไม่สำเร็จในขณะนี้" }, { status: 500 });
  }
}
