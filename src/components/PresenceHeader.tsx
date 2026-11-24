"use client";

import type { ParticipantPublic, SkyItemKind } from "@/lib/types";

interface PresenceHeaderProps {
  participants: ParticipantPublic[];
  skyMode: SkyItemKind;
  onSkyModeChange: (mode: SkyItemKind) => void;
  hasInviteLink: boolean;
  inviteCopied: boolean;
  onCopyInvite: () => void;
  onShareInvite?: () => void;
  canNativeShare: boolean;
}

function getPartnerStatusText(partner: ParticipantPublic | undefined): string {
  if (!partner) return "กำลังรอแฟนเข้าห้องริมน้ำ...";
  if (!partner.online) return `${partner.nickname} ออฟไลน์ชั่วคราว`;
  if (partner.activity === "holding") {
    return `${partner.nickname} กำลังกดค้างรอปล่อยกระทง`;
  }
  if (partner.activity === "editing") {
    return `${partner.nickname} กำลังแต่งกระทง`;
  }
  return `อยู่ริมน้ำด้วยกันกับ ${partner.nickname}`;
}

export function PresenceHeader({
  participants,
  skyMode,
  onSkyModeChange,
  hasInviteLink,
  inviteCopied,
  onCopyInvite,
  onShareInvite,
  canNativeShare,
}: PresenceHeaderProps) {
  const me = participants.find((p) => p.isMe);
  const partner = participants.find((p) => !p.isMe);
  const partnerHolding = partner?.activity === "holding";

  return (
    <header className="relative z-20 w-full px-3 pt-3 sm:px-5 sm:pt-4 pointer-events-none">
      <div className="mx-auto max-w-2xl flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          {/* Couple Presence Pill */}
          <div
            className={`pointer-events-auto glass-pill rounded-2xl px-3 py-2 flex items-center gap-2.5 min-w-0 max-w-[66%] transition-all duration-300 ${
              partnerHolding
                ? "border-amber-300/65 shadow-[0_0_22px_rgba(251,191,36,0.28)]"
                : ""
            }`}
          >
            <div className="flex -space-x-1.5 shrink-0">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-[11px] font-semibold text-slate-950 ring-2 ring-[#09112b]"
                title={me?.nickname ?? "คุณ"}
              >
                {(me?.nickname ?? "ค").slice(0, 2)}
              </span>
              {partner ? (
                <span
                  className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ring-2 ring-[#09112b] ${
                    partner.online
                      ? "bg-gradient-to-br from-rose-300 to-pink-600 text-slate-950"
                      : "bg-slate-700 text-slate-300"
                  }`}
                  title={partner.nickname}
                >
                  {partner.nickname.slice(0, 2)}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#09112b] ${
                      partner.online ? "bg-emerald-400" : "bg-slate-500"
                    }`}
                  />
                </span>
              ) : (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-amber-200/45 bg-slate-900/60 text-[11px] text-amber-200/75 ring-2 ring-[#09112b]">
                  ?
                </span>
              )}
            </div>

            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-50 truncate">
                <span className="truncate">{me?.nickname ?? "คุณ"}</span>
                <span className="text-amber-300/70">&amp;</span>
                <span className="truncate text-amber-100/90">
                  {partner ? partner.nickname : "รอแฟน"}
                </span>
              </div>
              <div
                className={`text-[11px] truncate ${
                  partnerHolding ? "text-amber-300 font-medium" : "text-indigo-200/80"
                }`}
              >
                {getPartnerStatusText(partner)}
              </div>
            </div>
          </div>

          {/* Interactive Sky Tool Toggle */}
          <div
            className="pointer-events-auto glass-pill rounded-full p-1 flex items-center gap-1 shrink-0"
            role="group"
            aria-label="เลือกของที่จะปล่อยบนท้องฟ้า"
          >
            <button
              type="button"
              onClick={() => onSkyModeChange("lantern")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                skyMode === "lantern"
                  ? "bg-amber-400/25 text-amber-100 border border-amber-300/45 shadow-[0_0_12px_rgba(251,191,36,0.25)]"
                  : "text-indigo-200/75 hover:text-amber-100 border border-transparent"
              }`}
            >
              <svg viewBox="0 0 18 22" className="h-3.5 w-3 shrink-0" aria-hidden="true">
                <path
                  d="M4 3 C4 1, 14 1, 14 3 L16 12 C16 16, 13 19, 11 20 L7 20 C5 19, 2 16, 2 12 Z"
                  fill="currentColor"
                  opacity="0.9"
                />
              </svg>
              <span>โคมลอย</span>
            </button>
            <button
              type="button"
              onClick={() => onSkyModeChange("sparkle")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                skyMode === "sparkle"
                  ? "bg-amber-400/25 text-amber-100 border border-amber-300/45 shadow-[0_0_12px_rgba(251,191,36,0.25)]"
                  : "text-indigo-200/75 hover:text-amber-100 border border-transparent"
              }`}
            >
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                <path
                  d="M10 1 L11.8 8.2 L19 10 L11.8 11.8 L10 19 L8.2 11.8 L1 10 L8.2 8.2 Z"
                  fill="currentColor"
                />
              </svg>
              <span>ประกายไฟ</span>
            </button>
          </div>
        </div>

        {/* Waiting for Partner Invite Strip */}
        {!partner && hasInviteLink && (
          <div className="pointer-events-auto glass-panel rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 border-amber-300/30">
            <div className="text-xs text-amber-100/90 leading-snug">
              <span className="font-medium text-amber-200">ส่งลิงก์ให้แฟนเข้ามาลอยด้วยกัน</span>
              <p className="text-[11px] text-indigo-200/75">
                ห้องนี้เข้าได้เฉพาะคุณสองคน แต่งกระทงรอก่อนได้เลยนะ
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onCopyInvite}
                className="rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/45 px-3 py-1.5 text-xs font-medium text-amber-100 transition cursor-pointer"
              >
                {inviteCopied ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์ชวนแฟน"}
              </button>
              {canNativeShare && onShareInvite && (
                <button
                  type="button"
                  onClick={onShareInvite}
                  className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.35)] hover:brightness-105 transition cursor-pointer"
                >
                  แชร์ให้แฟน
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
