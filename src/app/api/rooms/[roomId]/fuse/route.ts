import { NextRequest } from "next/server";
import {
  authenticateRoomRequest,
  updateFusionState,
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

  if (!checkRateLimit(`fuse:${auth.roomId}:${auth.id}`, 30, 60 * 1000)) {
    return jsonNoStore({ error: "คำขอถี่เกินไป กรุณารอสักครู่" }, { status: 429 });
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
  let action:
    | { type: "set_ready"; ready: boolean }
    | { type: "solo_preview" }
    | { type: "unfuse" }
    | null = null;

  if (raw.unfuse === true) {
    action = { type: "unfuse" };
  } else if (raw.soloPreview === true) {
    action = { type: "solo_preview" };
  } else if (typeof raw.ready === "boolean") {
    action = { type: "set_ready", ready: raw.ready };
  }

  if (!action) {
    return jsonNoStore({ error: "คำสั่งผสานกระทงไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const result = await updateFusionState(auth, action);
    if (!result.ok) {
      return jsonNoStore({ error: result.error }, { status: result.status });
    }
    return jsonNoStore(result.state);
  } catch {
    return jsonNoStore(
      { error: "ไม่สามารถอัปเดตสถานะการผสานได้ในขณะนี้" },
      { status: 500 },
    );
  }
}
