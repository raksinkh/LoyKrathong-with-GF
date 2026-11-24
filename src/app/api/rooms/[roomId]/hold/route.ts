import { NextRequest } from "next/server";
import {
  authenticateRoomRequest,
  updateParticipantHold,
} from "@/lib/room-service";
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

  if (!checkRateLimit(`hold:${auth.roomId}:${auth.id}`, 160, 60 * 1000)) {
    return jsonNoStore({ error: "คำขอถี่เกินไป" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const raw =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  if (raw.soloTestRelease === true) {
    return jsonNoStore(
      { error: "ต้องมีสองคนกดค้างพร้อมกันเพื่อปล่อยกระทง" },
      { status: 403 },
    );
  }

  if (typeof raw.holding !== "boolean") {
    return jsonNoStore({ error: "สถานะการกดค้างไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const state = await updateParticipantHold(auth, raw.holding);
    if (!state) {
      return jsonNoStore({ error: "ไม่พบห้องริมน้ำนี้" }, { status: 404 });
    }
    return jsonNoStore(state);
  } catch {
    return jsonNoStore(
      { error: "ไม่สามารถอัปเดตสถานะได้ในขณะนี้" },
      { status: 500 },
    );
  }
}
