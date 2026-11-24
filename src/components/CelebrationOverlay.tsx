"use client";

import React, { useMemo, useState } from "react";
import { SkyEventSnapshot, SkyHue } from "@/lib/krathong";
import { ActiveFireworkItem, FireworksOverlay } from "./FireworksOverlay";
import { FusionOverlaySignal } from "./Krathong3D";

export interface VisualSkyEvent {
  event: SkyEventSnapshot;
  spawnedAtMs: number;
}

interface CelebrationOverlayProps {
  visualEvents: VisualSkyEvent[];
  fusionSignal: FusionOverlaySignal;
}

const LANTERN_COLORS: Record<
  SkyHue,
  { core: string; mid: string; edge: string; glow: string }
> = {
  amber: {
    core: "#fffef0",
    mid: "#fde047",
    edge: "#ea580c",
    glow: "rgba(251, 191, 36, 0.72)",
  },
  rose: {
    core: "#fff5f7",
    mid: "#fda4af",
    edge: "#e11d48",
    glow: "rgba(251, 113, 133, 0.7)",
  },
  moonlight: {
    core: "#f0f9ff",
    mid: "#93c5fd",
    edge: "#3b82f6",
    glow: "rgba(147, 197, 253, 0.68)",
  },
};

const ANIME_PETALS = Array.from({ length: 56 }, (_, i) => {
  const angle = (i / 56) * Math.PI * 2 + (i % 3) * 0.08;
  const dist = 110 + (i % 7) * 48;
  return {
    id: i,
    tx: Math.round(Math.cos(angle) * dist),
    ty: Math.round(Math.sin(angle) * dist * 0.82),
    rot: (i % 2 === 0 ? 1 : -1) * (160 + (i % 5) * 45),
    size: 7 + (i % 5) * 3,
    isStar: i % 3 === 0,
    color:
      i % 4 === 0
        ? "#fef08a"
        : i % 4 === 1
          ? "#fbbf24"
          : i % 4 === 2
            ? "#f9a8d4"
            : "#fffbeb",
    delay: (i % 6) * 0.028,
  };
});

export function CelebrationOverlay({
  visualEvents,
  fusionSignal,
}: CelebrationOverlayProps) {
  const [selectedLantern, setSelectedLantern] =
    useState<SkyEventSnapshot | null>(null);

  const fireworks = useMemo<ActiveFireworkItem[]>(() => {
    return visualEvents
      .filter((v) => v.event.kind === "sparkle")
      .map((v) => ({
        id: v.event.id,
        xPercent: v.event.x,
        yPercent: v.event.y,
        senderName: v.event.senderName,
        spawnedAtMs: v.spawnedAtMs,
      }));
  }, [visualEvents]);

  const domEvents = useMemo(
    () =>
      visualEvents.filter((v) => v.event.kind !== "sparkle"),
    [visualEvents],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {/* High-DPI 60fps HTML5 Canvas Fireworks (พลุ) */}
      <FireworksOverlay items={fireworks} />

      {/* Depth-layered Khom Loy Sky Lanterns, Hearts & Heart Combo */}
      {domEvents.map(({ event: ev }) => {
        const palette = LANTERN_COLORS[ev.hue] ?? LANTERN_COLORS.amber;

        if (ev.kind === "lantern") {
          const hasMsg = ev.message.trim().length > 0;
          const depthIndex = Math.abs(ev.id) % 3;
          const depthClass =
            depthIndex === 0
              ? "animate-lantern-near"
              : depthIndex === 1
                ? "animate-lantern-mid"
                : "animate-lantern-far";
          const zIdx = depthIndex === 0 ? 28 : depthIndex === 1 ? 23 : 18;
          const windSway = depthIndex === 0 ? 18 : depthIndex === 1 ? -15 : 11;

          return (
            <button
              key={`lan-${ev.id}`}
              type="button"
              data-lantern-id={ev.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedLantern(ev);
              }}
              className={`${depthClass} pointer-events-auto absolute flex flex-col items-center focus:outline-none`}
              style={
                {
                  left: `${ev.x}%`,
                  top: `${Math.max(38, Math.min(64, ev.y + 18))}%`,
                  zIndex: zIdx,
                  "--wind-sway": `${windSway}px`,
                } as React.CSSProperties
              }
              aria-label={`โคมลอยของ ${ev.senderName}`}
            >
              <div
                className="relative flex items-center justify-center transition-transform hover:scale-110"
                style={{
                  filter: `drop-shadow(0 0 ${depthIndex === 0 ? 24 : depthIndex === 1 ? 18 : 13}px ${palette.glow})`,
                }}
              >
                <svg viewBox="0 0 60 80" className="h-22 w-16 sm:h-25 sm:w-18">
                  <defs>
                    <radialGradient
                      id={`lan-grad-${ev.id}`}
                      cx="50%"
                      cy="66%"
                      r="58%"
                    >
                      <stop offset="0%" stopColor={palette.core} />
                      <stop offset="40%" stopColor={palette.mid} />
                      <stop offset="82%" stopColor={palette.edge} />
                      <stop offset="100%" stopColor="#9a3412" />
                    </radialGradient>
                    <radialGradient
                      id={`lan-halo-${ev.id}`}
                      cx="50%"
                      cy="54%"
                      r="50%"
                    >
                      <stop
                        offset="0%"
                        stopColor={palette.mid}
                        stopOpacity="0.45"
                      />
                      <stop
                        offset="100%"
                        stopColor={palette.edge}
                        stopOpacity="0"
                      />
                    </radialGradient>
                  </defs>
                  <ellipse
                    cx="30"
                    cy="40"
                    rx="28"
                    ry="34"
                    fill={`url(#lan-halo-${ev.id})`}
                  />
                  <path
                    d="M 11 16 Q 30 3 49 16 L 53 48 Q 30 63 7 48 Z"
                    fill={`url(#lan-grad-${ev.id})`}
                    stroke="rgba(255,248,220,0.62)"
                    strokeWidth="1.1"
                  />
                  <path
                    d="M 21 12 Q 19 34 21 55 M 30 10 L 30 57 M 39 12 Q 41 34 39 55"
                    fill="none"
                    stroke="rgba(255, 250, 230, 0.28)"
                    strokeWidth="0.9"
                  />
                  <ellipse
                    cx="30"
                    cy="55"
                    rx="13.5"
                    ry="4.5"
                    fill="#7c2d12"
                    opacity="0.82"
                  />
                  <ellipse cx="30" cy="53" rx="6.5" ry="4" fill="#fffbeb" />
                  <circle cx="30" cy="50" r="3" fill="#ffffff" />
                </svg>
                {hasMsg && (
                  <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-[#1a152e] shadow-md">
                    ✦
                  </span>
                )}
              </div>
              <span className="mt-0.5 max-w-[130px] truncate rounded-full bg-[#090f24]/78 px-2.5 py-0.5 text-[10px] font-medium text-amber-100 shadow backdrop-blur-[2px]">
                {ev.senderName}
                {hasMsg ? " • แตะอ่าน" : ""}
              </span>
            </button>
          );
        }

        if (ev.kind === "heart") {
          return (
            <div
              key={`hrt-${ev.id}`}
              data-heart-id={ev.id}
              className="animate-heart-float pointer-events-none absolute z-25 flex flex-col items-center"
              style={
                {
                  left: `${ev.x}%`,
                  top: `${ev.y}%`,
                  "--heart-drift": `${ev.slot === 1 ? 20 : -20}px`,
                } as React.CSSProperties
              }
            >
              <svg
                viewBox="0 0 36 34"
                className="h-10 w-10"
                style={{
                  filter: "drop-shadow(0 0 14px rgba(244, 114, 182, 0.82))",
                }}
              >
                <path
                  d="M18 31s-13.5-8.4-13.5-18A7.6 7.6 0 0 1 18 7.6 7.6 7.6 0 0 1 31.5 13C31.5 22.6 18 31 18 31Z"
                  fill={ev.slot === 1 ? "#fb7185" : "#f472b6"}
                  stroke="#ffe4e6"
                  strokeWidth="1.2"
                />
              </svg>
              <span className="mt-0.5 rounded-full bg-[#090f24]/70 px-2 py-0.5 text-[10px] text-rose-100">
                {ev.senderName}
              </span>
            </div>
          );
        }

        return (
          <div
            key={`combo-${ev.id}`}
            data-heart-combo={ev.id}
            className="animate-heart-combo pointer-events-none absolute top-[34%] left-1/2 z-30 flex flex-col items-center"
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute h-28 w-28 rounded-full bg-amber-300/35 blur-2xl" />
              <div className="rounded-full border border-amber-200/80 bg-gradient-to-r from-rose-500/90 via-amber-400/90 to-rose-400/90 px-5 py-2 text-center shadow-[0_0_38px_rgba(251,191,36,0.8)] backdrop-blur-md">
                <div className="font-display text-sm font-semibold text-[#15182e]">
                  ใจตรงกัน! ส่งหัวใจพร้อมกันใต้แสงจันทร์
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Tap-to-read Lantern Wish Tooltip */}
      {selectedLantern && (
        <div
          data-lantern-tooltip="open"
          className="pointer-events-auto absolute inset-x-0 top-16 z-40 mx-auto max-w-xs px-4"
          onClick={() => setSelectedLantern(null)}
        >
          <div className="rounded-2xl border border-amber-200/45 bg-[#0c1433]/94 p-3.5 text-center shadow-[0_14px_40px_rgba(2,6,20,0.85)] backdrop-blur-xl">
            <div className="text-[11px] font-medium text-amber-300">
              โคมลอยของ {selectedLantern.senderName}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-amber-50">
              {selectedLantern.message
                ? `“${selectedLantern.message}”`
                : "ปล่อยโคมอธิษฐานขึ้นสู่ท้องฟ้าคืนวันเพ็ญ"}
            </p>
            <span className="mt-2 inline-block text-[10px] text-amber-200/60">
              แตะเพื่อปิด
            </span>
          </div>
        </div>
      )}

      {/* UNMISTAKABLE ANIME COLLISION FUSION BLOOM FLASH + GOD-RAYS + PETALS */}
      {fusionSignal.active && fusionSignal.phase === "impact" && (
        <div
          key={`anime-burst-${fusionSignal.burstKey}`}
          data-anime-fusion-flash="active"
          className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
        >
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              background:
                "radial-gradient(circle at 50% 48%, rgba(255,255,250,0.98) 0%, rgba(254,240,138,0.92) 28%, rgba(251,191,36,0.68) 58%, rgba(244,114,182,0.28) 100%)",
              opacity: fusionSignal.flashOpacity,
            }}
          />

          <div className="animate-anime-rays absolute top-[48%] left-1/2 h-[140vmax] w-[140vmax]">
            <svg viewBox="0 0 200 200" className="h-full w-full">
              {Array.from({ length: 24 }, (_, idx) => {
                const deg = (idx / 24) * 360;
                return (
                  <polygon
                    key={idx}
                    points="100,100 96,4 104,4"
                    fill={idx % 2 === 0 ? "#ffffff" : "#fde047"}
                    fillOpacity={idx % 2 === 0 ? "0.85" : "0.6"}
                    transform={`rotate(${deg} 100 100)`}
                  />
                );
              })}
            </svg>
          </div>

          <div className="absolute top-[48%] left-1/2">
            {ANIME_PETALS.map((petal) => (
              <span
                key={petal.id}
                className="animate-anime-petal absolute block"
                style={
                  {
                    width: `${petal.size}px`,
                    height: `${petal.isStar ? petal.size : petal.size * 1.45}px`,
                    backgroundColor: petal.color,
                    borderRadius: petal.isStar
                      ? "9999px"
                      : "65% 35% 65% 35% / 75% 25% 75% 25%",
                    boxShadow: `0 0 12px ${petal.color}`,
                    animationDelay: `${petal.delay}s`,
                    "--tx": `${petal.tx}px`,
                    "--ty": `${petal.ty}px`,
                    "--rot": `${petal.rot}deg`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
