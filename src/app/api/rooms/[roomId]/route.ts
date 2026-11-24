import { NextRequest } from "next/server";
import {
  authenticateRoomRequest,
  getRoomStateSnapshot,
} from "@/lib/room-service";
import {
  checkRateLimit,
  getClientIp,
  isValidRoomId,
  jsonNoStore,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  if (!isValidRoomId(roomId)) {
    return jsonNoStore({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(`poll:${ip}:${roomId}`, 240, 60 * 1000)) {
    return jsonNoStore({ error: "คำขอถี่เกินไป" }, { status: 429 });
  }

  const auth = await authenticateRoomRequest(request, roomId);
  if (!auth) {
    return jsonNoStore({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
  }

  try {
    const state = await getRoomStateSnapshot(auth.roomId, auth.id, true);
    if (!state) {
      return jsonNoStore({ error: "ไม่พบห้องริมน้ำนี้" }, { status: 404 });
    }
    return jsonNoStore(state);
  } catch {
    return jsonNoStore(
      { error: "ไม่สามารถโหลดสถานะห้องได้ในขณะนี้" },
      { status: 500 },
    );
  }
}
