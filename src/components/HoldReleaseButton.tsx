"use client";

import React, { useCallback, useEffect, useRef } from "react";

interface HoldReleaseButtonProps {
  bothJoined: boolean;
  selfHolding: boolean;
  partnerHolding: boolean;
  partnerName: string | null;
  holdProgress: number; // 0..1
  disabled?: boolean;
  onHoldChange: (holding: boolean) => void;
}

export function HoldReleaseButton({
  bothJoined,
  selfHolding,
  partnerHolding,
  partnerName,
  holdProgress,
  disabled = false,
  onHoldChange,
}: HoldReleaseButtonProps) {
  const activePointerId = useRef<number | null>(null);
  const holdingRef = useRef(false);

  const stopHolding = useCallback(() => {
    if (holdingRef.current) {
      holdingRef.current = false;
      activePointerId.current = null;
      onHoldChange(false);
    }
  }, [onHoldChange]);

  useEffect(() => {
    const handleBlur = () => stopHolding();
    const handleVisibility = () => {
      if (document.hidden) stopHolding();
    };
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [stopHolding]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || !bothJoined) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported
    }
    activePointerId.current = e.pointerId;
    if (!holdingRef.current) {
      holdingRef.current = true;
      onHoldChange(true);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) {
      return;
    }
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    stopHolding();
  };

  const clamped = Math.max(0, Math.min(1, holdProgress));
  const secondsLeft = Math.max(1, Math.ceil((1 - clamped) * 3));
  const bothHolding = selfHolding && partnerHolding;
  const ringRadius = 21;
  const circumference = 2 * Math.PI * ringRadius;
  const dashOffset = circumference * (1 - clamped);

  let primaryLabel = "กดค้างเพื่อปล่อยกระทงพร้อมกัน";
  let subLabel = "กดค้างพร้อมกัน 3 วินาทีเพื่อปล่อยลงสายน้ำ";

  if (!bothJoined) {
    primaryLabel = "รอคนพิเศษเข้าห้องมาก่อนนะ";
    subLabel = "ส่งลิงก์ด้านบนให้แฟน เพื่อมาปล่อยกระทงด้วยกัน";
  } else if (bothHolding) {
    primaryLabel = `กำลังปล่อยกระทงพร้อมกัน... ${secondsLeft}`;
    subLabel = "จับมือกันค้างไว้จนแสงจันทร์เต็มวง";
  } else if (selfHolding && !partnerHolding) {
    primaryLabel = `รอ ${partnerName ?? "แฟน"} กดค้างพร้อมกัน...`;
    subLabel = "กดค้างไว้ก่อนนะ แสงกำลังส่งสัญญาณไปหาอีกฝั่ง";
  } else if (!selfHolding && partnerHolding) {
    primaryLabel = `${partnerName ?? "แฟน"} กดค้างรออยู่แล้ว!`;
    subLabel = "กดค้างปุ่มนี้พร้อมกันเลย เพื่อปล่อยกระทงลงน้ำ";
  }

  return (
    <button
      type="button"
      disabled={disabled || !bothJoined}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
      className={`group relative flex w-full select-none touch-none items-center gap-3.5 overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all duration-300 ${
        !bothJoined
          ? "cursor-not-allowed border-white/10 bg-[#101836]/70 text-slate-400"
          : bothHolding
            ? "scale-[0.985] border-amber-300/80 bg-gradient-to-r from-amber-500/35 via-amber-400/25 to-rose-400/30 text-amber-50 shadow-[0_0_36px_rgba(251,191,36,0.42)]"
            : selfHolding || partnerHolding
              ? "animate-hold-pulse border-amber-300/65 bg-gradient-to-r from-amber-500/25 via-amber-400/15 to-indigo-900/60 text-amber-50"
              : "border-amber-300/35 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-indigo-950/75 text-amber-50 hover:border-amber-300/60 active:scale-[0.985]"
      }`}
    >
      {/* Horizontal fill bar behind content when both are holding */}
      {clamped > 0.005 && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400/30 via-amber-300/25 to-rose-300/25 transition-[width] duration-75"
          style={{ width: `${Math.round(clamped * 100)}%` }}
        />
      )}

      {/* Circular glowing icon with SVG progress ring */}
      <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center">
        <svg viewBox="0 0 50 50" className="absolute inset-0 h-12 w-12 -rotate-90">
          <circle
            cx="25"
            cy="25"
            r={ringRadius}
            fill="none"
            stroke="rgba(254, 243, 199, 0.18)"
            strokeWidth="3"
          />
          {clamped > 0.005 && (
            <circle
              cx="25"
              cy="25"
              r={ringRadius}
              fill="none"
              stroke="#fde047"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          )}
        </svg>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full text-base transition-colors ${
            bothHolding
              ? "bg-amber-300 text-[#12172f]"
              : selfHolding || partnerHolding
                ? "bg-amber-400/30 text-amber-200"
                : bothJoined
                  ? "bg-amber-400/20 text-amber-200"
                  : "bg-white/5 text-slate-400"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3c2 2.8 4 5.2 4 8a4 4 0 1 1-8 0c0-2.8 2-5.2 4-8Z" />
            <path d="M5 17c2.3 1.8 4.6 2.5 7 2.5s4.7-.7 7-2.5" />
          </svg>
        </span>
      </div>

      {/* Labels */}
      <div className="relative z-10 min-w-0 flex-1">
        <div className="font-display truncate text-[15px] font-medium tracking-wide">
          {primaryLabel}
        </div>
        <div className="truncate text-xs text-amber-100/75">{subLabel}</div>
      </div>
    </button>
  );
}
