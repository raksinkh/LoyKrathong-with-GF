import { NextRequest } from "next/server";
import {
  authenticateRoomRequest,
  resetRoomForNewKrathong,
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

  if (!checkRateLimit(`reset:${auth.roomId}`, 10, 60 * 1000)) {
    return jsonNoStore({ error: "กรุณารอสักครู่ก่อนเริ่มกระทงใบใหม่" }, { status: 429 });
  }

  try {
    const state = await resetRoomForNewKrathong(auth);
    if (!state) {
      return jsonNoStore({ error: "ไม่พบห้องริมน้ำนี้" }, { status: 404 });
    }
    return jsonNoStore(state);
  } catch {
    return jsonNoStore(
      { error: "ไม่สามารถเริ่มกระทงใบใหม่ได้ในขณะนี้" },
      { status: 500 },
    );
  }
}
