import { NextRequest } from "next/server";
import {
  coerceAccentStyle,
  coerceBaseStyle,
  coerceCandleStyle,
  coerceFlowerStyle,
  sanitizeWishText,
} from "@/lib/krathong";
import {
  KrathongPatchInput,
  authenticateRoomRequest,
  updateParticipantChoice,
} from "@/lib/room-service";
import {
  checkRateLimit,
  isValidRoomId,
  jsonNoStore,
  validateCsrf,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(
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

  if (!checkRateLimit(`krathong:${auth.roomId}:${auth.id}`, 80, 60 * 1000)) {
    return jsonNoStore({ error: "แก้ไขถี่เกินไป กรุณารอสักครู่" }, { status: 429 });
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
  const patch: KrathongPatchInput = {};
  let hasField = false;

  if ("baseStyle" in raw && raw.baseStyle !== undefined) {
    const normalized = coerceBaseStyle(raw.baseStyle);
    if (!normalized) {
      return jsonNoStore({ error: "รูปแบบฐานกระทงไม่ถูกต้อง" }, { status: 400 });
    }
    patch.baseStyle = normalized;
    hasField = true;
  }

  if ("flowerStyle" in raw && raw.flowerStyle !== undefined) {
    const normalized = coerceFlowerStyle(raw.flowerStyle);
    if (!normalized) {
      return jsonNoStore({ error: "รูปแบบดอกไม้ไม่ถูกต้อง" }, { status: 400 });
    }
    patch.flowerStyle = normalized;
    hasField = true;
  }

  if ("candleStyle" in raw && raw.candleStyle !== undefined) {
    const normalized = coerceCandleStyle(raw.candleStyle);
    if (!normalized) {
      return jsonNoStore({ error: "สีเทียนไม่ถูกต้อง" }, { status: 400 });
    }
    patch.candleStyle = normalized;
    hasField = true;
  }

  if ("accentStyle" in raw && raw.accentStyle !== undefined) {
    const normalized = coerceAccentStyle(raw.accentStyle);
    if (!normalized) {
      return jsonNoStore({ error: "ของตกแต่งไม่ถูกต้อง" }, { status: 400 });
    }
    patch.accentStyle = normalized;
    hasField = true;
  }

  if ("wishText" in raw && raw.wishText !== undefined) {
    const cleanWish = sanitizeWishText(raw.wishText, 200);
    if (cleanWish === null) {
      return jsonNoStore(
        { error: "คำอธิษฐานต้องยาวไม่เกิน 200 ตัวอักษร" },
        { status: 400 },
      );
    }
    patch.wishText = cleanWish;
    hasField = true;
  }

  const requestedSlot: 1 | 2 | undefined =
    raw.targetSlot === 1 ? 1 : raw.targetSlot === 2 ? 2 : undefined;

  if (!hasField) {
    return jsonNoStore({ error: "ไม่มีข้อมูลที่จะอัปเดต" }, { status: 400 });
  }

  try {
    const result = await updateParticipantChoice(auth, patch, requestedSlot);
    if (!result.ok) {
      return jsonNoStore({ error: result.error }, { status: result.status });
    }
    return jsonNoStore(result.state);
  } catch {
    return jsonNoStore(
      { error: "ไม่สามารถบันทึกกระทงได้ในขณะนี้" },
      { status: 500 },
    );
  }
}
