export const BASE_STYLES = [
  "banana_leaf",
  "lotus_petal",
  "golden_leaf",
  "moon_crystal",
  "coconut_husk",
  "ruby_petal",
] as const;
export type BaseStyle = (typeof BASE_STYLES)[number];

export const FLOWER_STYLES = [
  "lotus_jasmine",
  "marigold_globe",
  "orchid_violet",
  "rose_crimson",
  "white_lotus_pearl",
  "chrysanthemum_peach",
] as const;
export type FlowerStyle = (typeof FLOWER_STYLES)[number];

export const CANDLE_STYLES = [
  "warm_gold",
  "rose_gold",
  "moonlight_violet",
  "aurora_blue",
  "jade_green",
  "pearl_ivory",
] as const;
export type CandleStyle = (typeof CANDLE_STYLES)[number];

export const ACCENT_STYLES = [
  "dok_rak_heart",
  "mini_garland",
  "moon_star",
  "golden_swan",
  "twin_ribbon",
  "lotus_lantern",
] as const;
export type AccentStyle = (typeof ACCENT_STYLES)[number];

export const SKY_KINDS = ["lantern", "sparkle", "heart", "heart_combo"] as const;
export type SkyKind = (typeof SKY_KINDS)[number];

export const CLIENT_SKY_KINDS = ["lantern", "sparkle", "heart"] as const;
export type ClientSkyKind = (typeof CLIENT_SKY_KINDS)[number];

export const SKY_HUES = ["amber", "rose", "moonlight"] as const;
export type SkyHue = (typeof SKY_HUES)[number];

export const FUSION_STATES = ["building", "fused", "released"] as const;
export type FusionState = (typeof FUSION_STATES)[number];

export const ROOM_STATUSES = ["building", "released"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const PARTICIPANT_ACTIVITIES = [
  "by_river",
  "decorating",
  "wishing",
  "ready_fuse",
  "holding",
] as const;
export type ParticipantActivity = (typeof PARTICIPANT_ACTIVITIES)[number];

export interface OptionMeta<T extends string> {
  id: T;
  label: string;
  shortLabel: string;
  subtitle: string;
  swatch: string;
  swatchAccent: string;
}

export const BASE_OPTIONS: OptionMeta<BaseStyle>[] = [
  {
    id: "banana_leaf",
    label: "ใบตองมรกตจีบคลาสสิก",
    shortLabel: "ใบตองมรกต",
    subtitle: "กลีบใบตองมรกตพับจีบเงางามแบบไทยแท้",
    swatch: "#16a34a",
    swatchAccent: "#86efac",
  },
  {
    id: "lotus_petal",
    label: "กลีบบัวชมพูทอง",
    shortLabel: "กลีบบัวชมพูทอง",
    subtitle: "กลีบบัวชมพูอมส้มซ้อนชั้นแต่งขอบทองประกาย",
    swatch: "#f43f8e",
    swatchAccent: "#fde047",
  },
  {
    id: "golden_leaf",
    label: "ใบตองทองอร่าม",
    shortLabel: "ใบตองทองอร่าม",
    subtitle: "กลีบใบตองสีทองเปล่งประกายหรูหราใต้แสงจันทร์",
    swatch: "#f59e0b",
    swatchAccent: "#fef08a",
  },
  {
    id: "moon_crystal",
    label: "คริสตัลจันทรา",
    shortLabel: "คริสตัลจันทรา",
    subtitle: "กลีบแก้วคริสตัลสีน้ำเงินเงินระยิบดุจแสงจันทร์",
    swatch: "#38bdf8",
    swatchAccent: "#e0e7ff",
  },
  {
    id: "coconut_husk",
    label: "กะลามะพร้าวอบอุ่น",
    shortLabel: "กะลามะพร้าว",
    subtitle: "ฐานกะลามะพร้าวน้ำตาลทองกลิ่นหอมแบบโบราณ",
    swatch: "#92400e",
    swatchAccent: "#fcd34d",
  },
  {
    id: "ruby_petal",
    label: "กลีบทับทิมแดง",
    shortLabel: "กลีบทับทิม",
    subtitle: "กลีบแดงทับทิมซ้อนชั้นเปล่งประกายโรแมนติก",
    swatch: "#9f1239",
    swatchAccent: "#fda4af",
  },
];

export const FLOWER_OPTIONS: OptionMeta<FlowerStyle>[] = [
  {
    id: "lotus_jasmine",
    label: "บัวชมพู-มะลิ",
    shortLabel: "บัวชมพู-มะลิ",
    subtitle: "บัวหลวงกลีบชมพูสดล้อมพวงมะลิขาวเรืองแสง",
    swatch: "#fb7185",
    swatchAccent: "#fffbeb",
  },
  {
    id: "marigold_globe",
    label: "ดาวเรืองทอง-บานไม่รู้โรย",
    shortLabel: "ดาวเรือง-บานไม่รู้โรย",
    subtitle: "ดาวเรืองสีเหลืองทองสดใสตัดบานไม่รู้โรยม่วงแดง",
    swatch: "#facc15",
    swatchAccent: "#d946ef",
  },
  {
    id: "orchid_violet",
    label: "กล้วยไม้ม่วง-ชมพู",
    shortLabel: "กล้วยไม้ม่วง-ชมพู",
    subtitle: "กล้วยไม้ไทยกลีบม่วงอเมทิสต์แต้มชมพูและเกสรทอง",
    swatch: "#a855f7",
    swatchAccent: "#f472b6",
  },
  {
    id: "rose_crimson",
    label: "กุหลาบแดง-ทอง",
    shortLabel: "กุหลาบแดง-ทอง",
    subtitle: "กุหลาบแดงกำมะหยี่แทรกใบทองและไข่มุกประกาย",
    swatch: "#e11d48",
    swatchAccent: "#fbbf24",
  },
  {
    id: "white_lotus_pearl",
    label: "บัวขาว-ไข่มุก",
    shortLabel: "บัวขาวมุก",
    subtitle: "ดอกบัวขาวบริสุทธิ์ประดับไข่มุกและเกสรทอง",
    swatch: "#f8fafc",
    swatchAccent: "#fde68a",
  },
  {
    id: "chrysanthemum_peach",
    label: "เบญจมาศพีช-ส้ม",
    shortLabel: "เบญจมาศพีช",
    subtitle: "เบญจมาศกลีบพีชอบอุ่นคู่ส้มแสดริมน้ำ",
    swatch: "#fb923c",
    swatchAccent: "#fecdd3",
  },
];

export const CANDLE_OPTIONS: OptionMeta<CandleStyle>[] = [
  {
    id: "warm_gold",
    label: "ทองอุ่น",
    shortLabel: "ทองอุ่น",
    subtitle: "แสงเทียนขี้ผึ้งทองอบอุ่นส่องประกายทั่วผิวน้ำ",
    swatch: "#fbbf24",
    swatchAccent: "#fef08a",
  },
  {
    id: "rose_gold",
    label: "โรสโกลด์",
    shortLabel: "โรสโกลด์",
    subtitle: "แสงเทียนชมพูโรสโกลด์ละมุนหวานโรแมนติก",
    swatch: "#fb7185",
    swatchAccent: "#fecdd3",
  },
  {
    id: "moonlight_violet",
    label: "ม่วงจันทรา",
    shortLabel: "ม่วงจันทรา",
    subtitle: "แสงเทียนสีม่วงลาเวนเดอร์ชวนฝันใต้คืนเพ็ญ",
    swatch: "#a78bfa",
    swatchAccent: "#ede9fe",
  },
  {
    id: "aurora_blue",
    label: "ฟ้าออโรรา",
    shortLabel: "ฟ้าออโรรา",
    subtitle: "แสงเทียนฟ้าเทอร์ควอยซ์สว่างใสราวแสงเหนือ",
    swatch: "#38bdf8",
    swatchAccent: "#cffafe",
  },
  {
    id: "jade_green",
    label: "เขียวหยก",
    shortLabel: "เขียวหยก",
    subtitle: "แสงเทียนเขียวหยกนิ่มคู่ควันธูปอ่อนๆ",
    swatch: "#34d399",
    swatchAccent: "#a7f3d0",
  },
  {
    id: "pearl_ivory",
    label: "ไข่มุกงาช้าง",
    shortLabel: "ไข่มุกงาช้าง",
    subtitle: "เทียนขาวมุกเรียบหรูพร้อมปลายธูปแดงอุ่น",
    swatch: "#f5f5f4",
    swatchAccent: "#fde68a",
  },
];

export const ACCENT_OPTIONS: OptionMeta<AccentStyle>[] = [
  {
    id: "dok_rak_heart",
    label: "หัวใจดอกรัก",
    shortLabel: "หัวใจดอกรัก",
    subtitle: "ซุ้มหัวใจดอกรักสีมุก-โรสโกลด์ร้อยสื่อรัก",
    swatch: "#f9a8d4",
    swatchAccent: "#ffffff",
  },
  {
    id: "mini_garland",
    label: "พวงมาลัยจิ๋ว",
    shortLabel: "พวงมาลัยจิ๋ว",
    subtitle: "พวงมาลัยมะลิ-กุหลาบอุบะทองคล้องขอบกระทง",
    swatch: "#fef3c7",
    swatchAccent: "#fb7185",
  },
  {
    id: "moon_star",
    label: "ดาวจันทรา",
    shortLabel: "ดาวจันทรา",
    subtitle: "จันทร์เสี้ยวทองคำคู่หมู่ดาวระยิบกลางสายน้ำ",
    swatch: "#fde047",
    swatchAccent: "#93c5fd",
  },
  {
    id: "golden_swan",
    label: "หงส์คู่ทอง",
    shortLabel: "หงส์คู่ทอง",
    subtitle: "หงส์คู่สีทองโค้งคอประกบเป็นรูปหัวใจสุดหรู",
    swatch: "#fbbf24",
    swatchAccent: "#fffbeb",
  },
  {
    id: "twin_ribbon",
    label: "ริบบิ้นคู่รัก",
    shortLabel: "ริบบิ้นคู่",
    subtitle: "ริบบิ้นไหมชมพู-ทองผูกใจสองดวงไว้ด้วยกัน",
    swatch: "#fb7185",
    swatchAccent: "#fde68a",
  },
  {
    id: "lotus_lantern",
    label: "โคมบัวจิ๋ว",
    shortLabel: "โคมบัวจิ๋ว",
    subtitle: "โคมลอยรูปบัวจิ๋วเปล่งแสงนวลกลางกระทง",
    swatch: "#fbbf24",
    swatchAccent: "#fda4af",
  },
];

export interface CandleThemeVisual {
  waxColor: string;
  waxEmissive: string;
  flameOuter: string;
  flameInner: string;
  lightColor: string;
  waterGlowHex: string;
  auraHex: string;
}

export const CANDLE_THEME_VISUALS: Record<CandleStyle, CandleThemeVisual> = {
  warm_gold: {
    waxColor: "#ffd166",
    waxEmissive: "#d97706",
    flameOuter: "#ff9e2c",
    flameInner: "#fffbeb",
    lightColor: "#ffbe4f",
    waterGlowHex: "#ffb938",
    auraHex: "#fbbf24",
  },
  rose_gold: {
    waxColor: "#ff9ebb",
    waxEmissive: "#e11d74",
    flameOuter: "#ff6b9d",
    flameInner: "#fff1f5",
    lightColor: "#ff75a0",
    waterGlowHex: "#ff6b9d",
    auraHex: "#f472b6",
  },
  moonlight_violet: {
    waxColor: "#d8b4fe",
    waxEmissive: "#7c3aed",
    flameOuter: "#c084fc",
    flameInner: "#f5f3ff",
    lightColor: "#b794f4",
    waterGlowHex: "#a855f7",
    auraHex: "#c084fc",
  },
  aurora_blue: {
    waxColor: "#7dd3fc",
    waxEmissive: "#0284c7",
    flameOuter: "#38bdf8",
    flameInner: "#ecfeff",
    lightColor: "#38d9f8",
    waterGlowHex: "#22d3ee",
    auraHex: "#38bdf8",
  },
  jade_green: {
    waxColor: "#6ee7b7",
    waxEmissive: "#047857",
    flameOuter: "#34d399",
    flameInner: "#ecfdf5",
    lightColor: "#34d399",
    waterGlowHex: "#10b981",
    auraHex: "#34d399",
  },
  pearl_ivory: {
    waxColor: "#f5f5f4",
    waxEmissive: "#a8a29e",
    flameOuter: "#fde68a",
    flameInner: "#fffbeb",
    lightColor: "#fef3c7",
    waterGlowHex: "#fcd34d",
    auraHex: "#fde68a",
  },
};

export interface KrathongDesign {
  baseStyle: BaseStyle;
  flowerStyle: FlowerStyle;
  candleStyle: CandleStyle;
  accentStyle: AccentStyle;
  wishText: string;
}

export const DEFAULT_P1_CHOICE: KrathongDesign = {
  baseStyle: "banana_leaf",
  flowerStyle: "lotus_jasmine",
  candleStyle: "warm_gold",
  accentStyle: "dok_rak_heart",
  wishText: "",
};

export const DEFAULT_P2_CHOICE: KrathongDesign = {
  baseStyle: "lotus_petal",
  flowerStyle: "orchid_violet",
  candleStyle: "rose_gold",
  accentStyle: "moon_star",
  wishText: "",
};

export interface ParticipantSnapshot {
  id: string;
  slot: 1 | 2;
  nickname: string;
  isSelf: boolean;
  online: boolean;
  activity: ParticipantActivity;
  readyToFuse: boolean;
  holding: boolean;
  holdingSinceMs: number | null;
}

export interface SkyEventSnapshot {
  id: number;
  senderName: string;
  slot: 1 | 2;
  kind: SkyKind;
  x: number;
  y: number;
  hue: SkyHue;
  message: string;
  createdAtMs: number;
}

export type DriftStatus = "idle" | "playing" | "done";

export interface DriftItemSnapshot {
  id: string;
  kind: "lantern" | "obstacle";
  x: number;
  z: number;
  resolved: boolean;
}

export interface DriftSnapshot {
  status: DriftStatus;
  seed: number;
  score: number;
  x: number;
  z: number;
  steer: number;
  elapsedMs: number;
  durationMs: number;
  items: DriftItemSnapshot[];
}

export interface RoomStateSnapshot {
  roomId: string;
  status: RoomStatus;
  fusionState: FusionState;
  fusedAtMs: number | null;
  krathongRound: number;
  releasedAtMs: number | null;
  lastEditedBy: string | null;
  lastEditLabel: string | null;
  krathong: KrathongDesign;
  p1Choice: KrathongDesign;
  p2Choice: KrathongDesign;
  p1Ready: boolean;
  p2Ready: boolean;
  participants: ParticipantSnapshot[];
  holdSync: {
    bothJoined: boolean;
    bothHolding: boolean;
    bothHoldingSinceMs: number | null;
    bothHoldingElapsedMs: number;
    targetHoldMs: number;
  };
  skyEvents: SkyEventSnapshot[];
  drift: DriftSnapshot;
  serverNowMs: number;
}

export function isOneOf<T extends string>(
  list: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

export function coerceBaseStyle(value: unknown): BaseStyle | null {
  if (isOneOf(BASE_STYLES, value)) return value;
  if (value === "golden_bread") return "golden_leaf";
  return null;
}

export function coerceFlowerStyle(value: unknown): FlowerStyle | null {
  if (isOneOf(FLOWER_STYLES, value)) return value;
  if (value === "rose_orchid") return "orchid_violet";
  return null;
}

export function coerceCandleStyle(value: unknown): CandleStyle | null {
  if (isOneOf(CANDLE_STYLES, value)) return value;
  if (value === "romantic_pink") return "rose_gold";
  if (value === "ivory") return "moonlight_violet";
  return null;
}

export function coerceAccentStyle(value: unknown): AccentStyle | null {
  if (isOneOf(ACCENT_STYLES, value)) return value;
  if (value === "couple_ribbon") return "twin_ribbon";
  return null;
}

export function normalizeChoice(
  raw: unknown,
  fallback: KrathongDesign,
): KrathongDesign {
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  }

  return {
    baseStyle: coerceBaseStyle(obj.baseStyle) ?? fallback.baseStyle,
    flowerStyle: coerceFlowerStyle(obj.flowerStyle) ?? fallback.flowerStyle,
    candleStyle: coerceCandleStyle(obj.candleStyle) ?? fallback.candleStyle,
    accentStyle: coerceAccentStyle(obj.accentStyle) ?? fallback.accentStyle,
    wishText:
      typeof obj.wishText === "string"
        ? obj.wishText.slice(0, 200)
        : fallback.wishText,
  };
}

export function pickRandomKrathongStyles(current?: KrathongDesign): {
  baseStyle: BaseStyle;
  flowerStyle: FlowerStyle;
  candleStyle: CandleStyle;
  accentStyle: AccentStyle;
} {
  const pick = <T extends string>(arr: readonly T[], avoid?: T): T => {
    const pool = avoid && arr.length > 1 ? arr.filter((x) => x !== avoid) : arr;
    return pool[Math.floor(Math.random() * pool.length)]!;
  };
  return {
    baseStyle: pick(BASE_STYLES, current?.baseStyle),
    flowerStyle: pick(FLOWER_STYLES, current?.flowerStyle),
    candleStyle: pick(CANDLE_STYLES, current?.candleStyle),
    accentStyle: pick(ACCENT_STYLES, current?.accentStyle),
  };
}

export function sanitizeNickname(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 1 || cleaned.length > 28) {
    return null;
  }
  return cleaned;
}

export function sanitizeWishText(input: unknown, maxLen = 200): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (cleaned.length > maxLen) {
    return null;
  }
  return cleaned;
}

export function sanitizeLanternMessage(input: unknown): string | null {
  if (input === undefined || input === null || input === "") return "";
  if (typeof input !== "string") return null;
  const cleaned = input
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length > 60) {
    return null;
  }
  return cleaned;
}

export function getActivityThaiLabel(
  activity: ParticipantActivity,
  online: boolean,
): string {
  if (!online) return "กำลังกลับมา...";
  switch (activity) {
    case "holding":
      return "กำลังกดค้างรอปล่อยกระทง";
    case "ready_fuse":
      return "พร้อมผสานกระทงแล้ว";
    case "decorating":
      return "กำลังแต่งกระทงของตัวเอง";
    case "wishing":
      return "กำลังเขียนคำอธิษฐาน";
    case "by_river":
    default:
      return "อยู่ริมน้ำด้วยกัน";
  }
}
