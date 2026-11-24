import {
  KRATHONG_ACCENTS,
  KRATHONG_BASES,
  KRATHONG_CANDLES,
  KRATHONG_FLOWERS,
  MAX_NICKNAME_LENGTH,
  MAX_WISH_LENGTH,
  SKY_KINDS,
  type KrathongAccent,
  type KrathongBase,
  type KrathongCandle,
  type KrathongFlowers,
  type SkyItemKind,
} from "./types";

const ROOM_ID_RE = /^[a-f0-9]{32}$/;
const SECRET_RE = /^[a-f0-9]{64}$/;

export function isValidRoomId(value: unknown): value is string {
  return typeof value === "string" && ROOM_ID_RE.test(value);
}

export function isValidSecretToken(value: unknown): value is string {
  return typeof value === "string" && SECRET_RE.test(value);
}

export function sanitizeNickname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 1 || cleaned.length > MAX_NICKNAME_LENGTH) {
    return null;
  }
  return cleaned;
}

export function sanitizeWish(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (cleaned.length > MAX_WISH_LENGTH) {
    return null;
  }
  return cleaned;
}

export function isValidBase(value: unknown): value is KrathongBase {
  return typeof value === "string" && (KRATHONG_BASES as readonly string[]).includes(value);
}

export function isValidFlowers(value: unknown): value is KrathongFlowers {
  return typeof value === "string" && (KRATHONG_FLOWERS as readonly string[]).includes(value);
}

export function isValidCandle(value: unknown): value is KrathongCandle {
  return typeof value === "string" && (KRATHONG_CANDLES as readonly string[]).includes(value);
}

export function isValidAccent(value: unknown): value is KrathongAccent {
  return typeof value === "string" && (KRATHONG_ACCENTS as readonly string[]).includes(value);
}

export function isValidSkyKind(value: unknown): value is SkyItemKind {
  return typeof value === "string" && (SKY_KINDS as readonly string[]).includes(value);
}

export function clampCoord(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}
