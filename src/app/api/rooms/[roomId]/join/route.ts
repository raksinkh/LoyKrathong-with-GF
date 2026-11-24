import { NextRequest } from "next/server";
import { sanitizeNickname } from "@/lib/krathong";
import { joinRoomWithInvite } from "@/lib/room-service";
import {
  checkRateLimit,
  getClientIp,
  isValidRoomId,
  isValidTokenHex,
  jsonNoStore,
  setSessionCookie,
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
    return jsonNoStore({ error: "ลิงก์ห้องไม่ถูกต้อง" }, { status: 400 });
  }

  const ip = getClientIp(request);
  if (
    !checkRateLimit(`join-ip:${ip}`, 20, 5 * 60 * 1000) ||
    !checkRateLimit(`join-room:${roomId}`, 30, 5 * 60 * 1000)
  ) {
    return jsonNoStore(
      { error: "ลองเข้าห้องหลายครั้งเกินไป กรุณารอสักครู่" },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const rawInvite =
    typeof body === "object" && body !== null && "inviteSecret" in body
      ? (body as { inviteSecret?: unknown }).inviteSecret
      : null;
  const rawNickname =
    typeof body === "object" && body !== null && "nickname" in body
      ? (body as { nickname?: unknown }).nickname
      : null;

  if (!isValidTokenHex(rawInvite)) {
    return jsonNoStore(
      { error: "ลิงก์เชิญไม่ถูกต้อง กรุณาขอลิงก์ใหม่จากคนพิเศษของคุณ" },
      { status: 403 },
    );
  }

  const nickname = sanitizeNickname(rawNickname);
  if (!nickname) {
    return jsonNoStore(
      { error: "กรุณาใส่ชื่อเล่นของคุณ (1–28 ตัวอักษร)" },
      { status: 400 },
    );
  }

  try {
    const result = await joinRoomWithInvite(
      request,
      roomId,
      rawInvite,
      nickname,
    );
    if (!result.ok) {
      return jsonNoStore({ error: result.error }, { status: result.status });
    }

    const response = jsonNoStore({
      roomId,
      participantId: result.participantId,
      slot: result.slot,
    });
    if (result.sessionToken) {
      setSessionCookie(response, request, result.sessionToken);
    }
    return response;
  } catch {
    return jsonNoStore(
      { error: "ไม่สามารถเข้าร่วมห้องได้ในขณะนี้" },
      { status: 500 },
    );
  }
}
