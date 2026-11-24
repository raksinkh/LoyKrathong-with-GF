import crypto from "node:crypto";

export function generateRandomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length || aHex.length === 0 || aHex.length % 2 !== 0) {
    return false;
  }
  if (!/^[a-f0-9]+$/i.test(aHex) || !/^[a-f0-9]+$/i.test(bHex)) {
    return false;
  }
  const bufA = Buffer.from(aHex, "hex");
  const bufB = Buffer.from(bHex, "hex");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
