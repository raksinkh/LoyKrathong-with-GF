"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_P1_CHOICE, DEFAULT_P2_CHOICE } from "@/lib/krathong";
import { soundEngine } from "@/lib/sound";
import { ChaoPhrayaBackdrop } from "./ChaoPhrayaBackdrop";
import { Krathong3D } from "./Krathong3D";

export function LandingClient() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeRoomId, setResumeRoomId] = useState<string | null>(null);

  useEffect(() => {
    soundEngine.bindGestureUnlock();
    try {
      const savedId = window.localStorage.getItem("loy_last_room_id");
      if (!savedId || !/^[0-9a-f]{32}$/.test(savedId)) return;
      void fetch(`/api/rooms/${savedId}?_t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      })
        .then((res) => {
          if (res.ok) setResumeRoomId(savedId);
        })
        .catch(() => {});
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError("กรุณาใส่ชื่อเล่นของคุณก่อนนะ");
      return;
    }

    soundEngine.unlock();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch",
        },
        body: JSON.stringify({ nickname: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "ไม่สามารถสร้างห้องได้ในขณะนี้",
        );
        setSubmitting(false);
        return;
      }

      if (
        typeof data.roomId === "string" &&
        typeof data.inviteSecret === "string"
      ) {
        try {
          window.sessionStorage.setItem(
            `lk_invite_${data.roomId}`,
            data.inviteSecret,
          );
          window.localStorage.setItem(
            `lk_invite_${data.roomId}`,
            data.inviteSecret,
          );
          window.sessionStorage.setItem(`lk_nick_${data.roomId}`, trimmed);
          window.localStorage.setItem(`lk_nick_${data.roomId}`, trimmed);
          window.localStorage.setItem("loy_last_room_id", data.roomId);
        } catch {
          // Ignore storage errors
        }
        router.push(`/room/${data.roomId}`);
      } else {
        setError("ข้อมูลห้องไม่ครบถ้วน กรุณาลองใหม่อีกครั้ง");
        setSubmitting(false);
      }
    } catch {
      setError("การเชื่อมต่อขัดข้อง กรุณาลองใหม่อีกครั้ง");
      setSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-dvh w-full overflow-hidden">
      <div className="fixed inset-0 z-0">
        <ChaoPhrayaBackdrop />
        <div className="absolute inset-0">
          <Krathong3D
            p1Choice={DEFAULT_P1_CHOICE}
            p2Choice={DEFAULT_P2_CHOICE}
            fusionState="fused"
            fusionTriggerKey={0}
            focusMode="fused"
            activeSlot={1}
          />
        </div>
      </div>

      <div className="pointer-events-none fixed inset-0 z-10 bg-gradient-to-b from-[#050816]/65 via-transparent to-[#050816]/88" />

      <div className="pointer-events-none relative z-20 mx-auto flex min-h-dvh max-w-md flex-col justify-between px-5 py-7 sm:py-9">
        <header className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-[#0b1330]/70 px-3.5 py-1 text-xs font-medium text-amber-200/95 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_#fcd34d]" />
            <span>คืนวันเพ็ญ 24 พฤศจิกายน 2569 • เจ้าพระยา</span>
          </div>
          <h1 className="font-display mt-3 text-3xl font-medium tracking-wide text-amber-50 drop-shadow-[0_4px_20px_rgba(0,0,0,0.75)] sm:text-4xl">
            ลอยกระทงใต้แสงจันทร์
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-amber-100/85">
            ผสานกระทงสองใจ ปล่อยโคมลอย จุดพลุ แล้วปล่อยลงแม่น้ำเจ้าพระยาพร้อมกัน
          </p>
        </header>

        <div className="flex flex-col items-center justify-end py-2">
          <span className="rounded-full border border-amber-200/20 bg-[#070d23]/55 px-3 py-0.5 text-[11px] text-amber-100/75 backdrop-blur-sm">
            ลากหมุนดูกระทง 3 มิติได้ 360°
          </span>
        </div>

        <section className="pointer-events-auto rounded-3xl border border-amber-200/25 bg-[#0b132e]/84 p-5 shadow-[0_18px_50px_rgba(2,6,20,0.82)] backdrop-blur-xl sm:p-6">
          {resumeRoomId && (
            <Link
              href={`/room/${resumeRoomId}`}
              className="font-display mb-4 flex w-full items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/25"
            >
              กลับเข้าห้องริมน้ำล่าสุดของคุณ →
            </Link>
          )}

          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label
                htmlFor="creator-nickname"
                className="font-display block text-sm font-medium text-amber-100"
              >
                ชื่อเล่นของคุณ
              </label>
              <input
                id="creator-nickname"
                type="text"
                maxLength={28}
                autoComplete="off"
                placeholder="เช่น มิ้นท์, พีท, เฟิร์น..."
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  if (error) setError(null);
                }}
                className="mt-2 w-full rounded-2xl border border-amber-200/25 bg-[#070d23]/88 px-4 py-3 text-base text-amber-50 placeholder:text-slate-400/80 focus:border-amber-300/60 focus:outline-none focus:ring-2 focus:ring-amber-300/20"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="font-display flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 via-amber-400 to-orange-300 px-5 py-3.5 text-[15px] font-semibold text-[#15182e] shadow-[0_8px_28px_rgba(251,191,36,0.38)] transition hover:brightness-105 active:scale-[0.985] disabled:opacity-60"
            >
              {submitting
                ? "กำลังเตรียมท่าน้ำแสงจันทร์..."
                : "สร้างห้องริมน้ำสำหรับเราสองคน"}
            </button>
          </form>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-300/80">
            พื้นที่ส่วนตัวสำหรับ 2 คนเท่านั้น • สร้างห้องแล้วส่งลิงก์ให้คนพิเศษเข้ามาร่วมกันได้ทันที
          </p>
        </section>
      </div>
    </main>
  );
}
