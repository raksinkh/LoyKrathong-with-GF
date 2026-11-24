export const KRATHONG_BASES = [
  "banana_leaf",
  "pink_lotus",
  "golden_bread",
] as const;
export type KrathongBase = (typeof KRATHONG_BASES)[number];

export const KRATHONG_FLOWERS = [
  "marigold_amaranth",
  "lotus_jasmine",
  "rose_orchid",
] as const;
export type KrathongFlowers = (typeof KRATHONG_FLOWERS)[number];

export const KRATHONG_CANDLES = [
  "warm_gold",
  "romantic_pink",
  "ivory",
] as const;
export type KrathongCandle = (typeof KRATHONG_CANDLES)[number];

export const KRATHONG_ACCENTS = [
  "dok_rak_heart",
  "couple_ribbon",
  "moonlight_stars",
] as const;
export type KrathongAccent = (typeof KRATHONG_ACCENTS)[number];

export const SKY_KINDS = ["lantern", "sparkle"] as const;
export type SkyItemKind = (typeof SKY_KINDS)[number];

export type RoomStatus = "building" | "released";

export interface KrathongConfig {
  base: KrathongBase;
  flowers: KrathongFlowers;
  candle: KrathongCandle;
  accent: KrathongAccent;
  wish: string;
}

export interface ParticipantPublic {
  id: string;
  slot: 1 | 2;
  nickname: string;
  isMe: boolean;
  online: boolean;
  holding: boolean;
  holdingSince: number | null;
  activity: "holding" | "editing" | "present" | "offline";
}

export interface SkyItemPublic {
  id: string;
  kind: SkyItemKind;
  x: number;
  y: number;
  senderName: string;
  createdAt: number;
}

export interface RoomStatePublic {
  id: string;
  status: RoomStatus;
  krathong: KrathongConfig;
  lastEditedBy: string | null;
  lastEditedPart: string | null;
  lastEditedAt: number | null;
  krathongCount: number;
  releasedAt: number | null;
  participants: ParticipantPublic[];
  skyItems: SkyItemPublic[];
  bothHoldingSince: number | null;
  holdDurationMs: number;
  serverNow: number;
}

export const HOLD_DURATION_MS = 3000;
export const HOLD_STALE_MS = 4000;
export const ONLINE_THRESHOLD_MS = 12000;
export const MAX_SKY_ITEMS = 30;
export const MAX_NICKNAME_LENGTH = 24;
export const MAX_WISH_LENGTH = 200;

export const BASE_OPTIONS: {
  id: KrathongBase;
  label: string;
  desc: string;
  swatch: string;
}[] = [
  {
    id: "banana_leaf",
    label: "ใบตองจีบคลาสสิก",
    desc: "กลีบใบตองพับประณีตกลิ่นหอมธรรมชาติ",
    swatch: "from-emerald-600 to-green-900",
  },
  {
    id: "pink_lotus",
    label: "กลีบบัวชมพู",
    desc: "กลีบดอกบัวซ้อนอ่อนหวานใต้แสงจันทร์",
    swatch: "from-rose-400 to-pink-700",
  },
  {
    id: "golden_bread",
    label: "ขนมปังสีทอง",
    desc: "กระทงขนมปังอบอุ่นเป็นมิตรกับสายน้ำ",
    swatch: "from-amber-400 to-amber-700",
  },
];

export const FLOWER_OPTIONS: {
  id: KrathongFlowers;
  label: string;
  desc: string;
  swatch: string;
}[] = [
  {
    id: "marigold_amaranth",
    label: "ดาวเรือง-บานไม่รู้โรย",
    desc: "สีทองอร่ามคู่บานไม่รู้โรยรักยืนยาว",
    swatch: "from-amber-400 to-fuchsia-600",
  },
  {
    id: "lotus_jasmine",
    label: "ดอกบัว-มะลิ",
    desc: "มาลัยมะลิหอมอ่อนเคียงดอกบัวละมุน",
    swatch: "from-pink-200 to-rose-400",
  },
  {
    id: "rose_orchid",
    label: "กุหลาบ-กล้วยไม้",
    desc: "กุหลาบแดงโรแมนติกผสานกล้วยไม้ไทย",
    swatch: "from-rose-500 to-purple-700",
  },
];

export const CANDLE_OPTIONS: {
  id: KrathongCandle;
  label: string;
  desc: string;
  swatch: string;
}[] = [
  {
    id: "warm_gold",
    label: "ทองอุ่น",
    desc: "แสงเทียนขี้ผึ้งอบอุ่นละมุนใจ",
    swatch: "from-amber-300 to-amber-600",
  },
  {
    id: "romantic_pink",
    label: "ชมพูโรแมนติก",
    desc: "เทียนสีชมพูหวานท่ามกลางคืนเพ็ญ",
    swatch: "from-pink-300 to-rose-500",
  },
  {
    id: "ivory",
    label: "งาช้าง",
    desc: "เทียนสีงาช้างเรียบหรูสว่างนวล",
    swatch: "from-stone-100 to-amber-100",
  },
];

export const ACCENT_OPTIONS: {
  id: KrathongAccent;
  label: string;
  desc: string;
  swatch: string;
}[] = [
  {
    id: "dok_rak_heart",
    label: "หัวใจดอกรัก",
    desc: "ร้อยดอกรักเป็นรูปหัวใจแทนใจสองดวง",
    swatch: "from-violet-200 to-rose-400",
  },
  {
    id: "couple_ribbon",
    label: "ริบบิ้นคู่",
    desc: "ริบบิ้นไหมผูกคล้องใจไม่ห่างกัน",
    swatch: "from-rose-300 to-amber-300",
  },
  {
    id: "moonlight_stars",
    label: "ดาวแสงจันทร์",
    desc: "เสี้ยวพระจันทร์และดวงดาวนำทาง",
    swatch: "from-amber-200 to-indigo-400",
  },
];

export const PART_LABELS_TH: Record<string, string> = {
  base: "ฐานกระทง",
  flowers: "ดอกไม้และพวงมาลัย",
  candle: "สีเทียนและธูป",
  accent: "ของตกแต่งคู่รัก",
  wish: "คำอธิษฐานร่วมกัน",
};
