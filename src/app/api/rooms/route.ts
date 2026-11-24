import { NextRequest } from "next/server";
import { sanitizeNickname } from "@/lib/krathong";
import { createRoomWithCreator } from "@/lib/room-service";
import {
  checkRateLimit,
  getClientIp,
  jsonNoStore,
  setSessionCookie,
  validateCsrf,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return jsonNoStore({ error: "คำขอไม่ถูกต้อง" }, { status: 403 });
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(`create-room:${ip}`, 15, 10 * 60 * 1000)) {
    return jsonNoStore(
      { error: "สร้างห้องบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const nickname =
    typeof body === "object" && body !== null && "nickname" in body
      ? sanitizeNickname((body as { nickname?: unknown }).nickname)
      : null;

  if (!nickname) {
    return jsonNoStore(
      { error: "กรุณาใส่ชื่อเล่นของคุณ (1–28 ตัวอักษร)" },
      { status: 400 },
    );
  }

  try {
    const created = await createRoomWithCreator(nickname);
    const response = jsonNoStore(
      {
        roomId: created.roomId,
        inviteSecret: created.inviteSecret,
        participantId: created.participantId,
        slot: 1,
      },
      { status: 201 },
    );
    setSessionCookie(response, request, created.sessionToken);
    return response;
  } catch {
    return jsonNoStore(
      { error: "ไม่สามารถสร้างห้องได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}
