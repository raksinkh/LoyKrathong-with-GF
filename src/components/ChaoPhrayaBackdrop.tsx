"use client";

import React from "react";

interface ChaoPhrayaBackdropProps {
  holdProgress?: number;
  someoneHolding?: boolean;
  released?: boolean;
}

const STARS = [
  { x: 6, y: 8, s: 2, d: 3.4, delay: 0.2 },
  { x: 13, y: 17, s: 1.5, d: 4.8, delay: 1.4 },
  { x: 21, y: 7, s: 2.3, d: 5.1, delay: 0.7 },
  { x: 28, y: 15, s: 1.4, d: 3.9, delay: 2.1 },
  { x: 35, y: 9, s: 2.4, d: 4.5, delay: 0.4 },
  { x: 44, y: 20, s: 1.5, d: 5.3, delay: 1.8 },
  { x: 52, y: 10, s: 2, d: 4.2, delay: 0.9 },
  { x: 60, y: 18, s: 1.6, d: 3.7, delay: 2.5 },
  { x: 69, y: 8, s: 2.4, d: 5.0, delay: 1.1 },
  { x: 84, y: 10, s: 1.8, d: 4.4, delay: 0.6 },
  { x: 92, y: 20, s: 2.2, d: 3.8, delay: 1.9 },
  { x: 9, y: 27, s: 1.5, d: 4.9, delay: 0.3 },
  { x: 25, y: 25, s: 1.8, d: 5.5, delay: 2.2 },
  { x: 47, y: 27, s: 1.4, d: 4.1, delay: 1.5 },
  { x: 89, y: 29, s: 1.6, d: 4.6, delay: 2.8 },
  { x: 17, y: 33, s: 1.5, d: 4.3, delay: 1.0 },
  { x: 63, y: 29, s: 1.7, d: 4.7, delay: 2.3 },
];

const RIVERSIDE_BOKEH = [
  { x: 8, color: "#fbbf24", w: 2.5 },
  { x: 15, color: "#fde68a", w: 3 },
  { x: 22, color: "#f59e0b", w: 4 },
  { x: 31, color: "#fed7aa", w: 2 },
  { x: 41, color: "#fbbf24", w: 2.5 },
  { x: 51, color: "#fda4af", w: 2 },
  { x: 62, color: "#fde68a", w: 3.5 },
  { x: 71, color: "#f59e0b", w: 4 },
  { x: 79, color: "#fef3c7", w: 2.5 },
  { x: 87, color: "#fbbf24", w: 3 },
  { x: 93, color: "#fda4af", w: 2 },
];

const DISTANT_KRATHONGS = [
  { x: 24, y: 54, dur: 17, delay: 0 },
  { x: 38, y: 57, dur: 21, delay: 3 },
  { x: 56, y: 55, dur: 19, delay: 6 },
  { x: 76, y: 56, dur: 22, delay: 2 },
];

export function ChaoPhrayaBackdrop({
  holdProgress = 0,
  someoneHolding = false,
  released = false,
}: ChaoPhrayaBackdropProps) {
  const moonCircumference = 2 * Math.PI * 46;
  const clampedProgress = Math.max(0, Math.min(1, holdProgress));
  const moonDashOffset = moonCircumference * (1 - clampedProgress);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#050816]">
      {/* Deep Chao Phraya midnight sky transitioning to warm riverside horizon & dark indigo water */}
      <div
        className="absolute inset-0 transition-all duration-1000"
        style={{
          background: released
            ? "linear-gradient(180deg, #040714 0%, #09112b 34%, #131e44 55%, #251f3c 62%, #0a1430 64.5%, #060e24 84%, #040919 100%)"
            : "linear-gradient(180deg, #040714 0%, #09112b 26%, #131e44 43%, #251f3c 49%, #0a1430 51.5%, #060e24 76%, #040919 100%)",
        }}
      />

      {/* Twinkling starfield */}
      <div
        className={`absolute inset-x-0 top-0 transition-all duration-1000 ${
          released ? "h-[60%]" : "h-[48%]"
        }`}
      >
        {STARS.map((star, idx) => (
          <span
            key={idx}
            className="animate-twinkle absolute rounded-full bg-amber-100"
            style={
              {
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.s}px`,
                height: `${star.s}px`,
                "--twinkle-dur": `${star.d}s`,
                "--twinkle-delay": `${star.delay}s`,
                boxShadow: "0 0 6px rgba(254, 243, 199, 0.8)",
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Luminous Full Moon + synchronized hold ring */}
      <div
        className={`absolute right-[10%] transition-all duration-700 sm:right-[16%] ${
          released ? "top-[9%]" : "top-[7%]"
        }`}
      >
        <div className="relative flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
          <div
            className={`absolute -inset-12 rounded-full transition-opacity duration-500 ${
              someoneHolding ? "opacity-100" : "opacity-85"
            }`}
            style={{
              background:
                "radial-gradient(circle, rgba(254,243,199,0.38) 0%, rgba(251,191,36,0.14) 45%, rgba(251,191,36,0) 74%)",
            }}
          />

          <svg
            viewBox="0 0 104 104"
            className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] -rotate-90"
          >
            <circle
              cx="52"
              cy="52"
              r="46"
              fill="none"
              stroke="rgba(254, 243, 199, 0.14)"
              strokeWidth="2.5"
            />
            {clampedProgress > 0.005 && (
              <circle
                cx="52"
                cy="52"
                r="46"
                fill="none"
                stroke="#fde047"
                strokeWidth="3.8"
                strokeLinecap="round"
                strokeDasharray={moonCircumference}
                strokeDashoffset={moonDashOffset}
                style={{
                  filter: "drop-shadow(0 0 8px rgba(253, 224, 71, 0.95))",
                }}
              />
            )}
          </svg>

          <div
            className="relative h-16 w-16 rounded-full sm:h-20 sm:w-20"
            style={{
              background:
                "radial-gradient(circle at 35% 35%, #fffef5 0%, #fef3c7 58%, #f3d285 100%)",
              boxShadow:
                "0 0 32px rgba(254, 243, 199, 0.8), 0 0 72px rgba(251, 191, 36, 0.34)",
            }}
          >
            <span className="absolute top-2.5 left-4 h-2.5 w-2.5 rounded-full bg-amber-300/20" />
            <span className="absolute right-3.5 bottom-4 h-4 w-4 rounded-full bg-amber-400/15" />
          </div>
        </div>
      </div>

      {/* CHAO PHRAYA NIGHT PANORAMA: Wat Arun (left) + Bangkok Skyline + Rama VIII Bridge (right-center) */}
      <svg
        viewBox="0 0 1200 220"
        preserveAspectRatio="none"
        className={`absolute inset-x-0 w-full transition-all duration-1000 ${
          released ? "top-[44%] h-[20%]" : "top-[30%] h-[22%]"
        }`}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="watArunGlow" cx="50%" cy="68%" r="55%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.46" />
            <stop offset="52%" stopColor="#f59e0b" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="watGold" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#382518" />
            <stop offset="45%" stopColor="#9c6b2d" />
            <stop offset="82%" stopColor="#f5c66c" />
            <stop offset="100%" stopColor="#fef3c7" />
          </linearGradient>
          <linearGradient id="ramaTower" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#262033" />
            <stop offset="45%" stopColor="#c78a35" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>
        </defs>

        {/* Warm temple floodlight halo behind Wat Arun */}
        <ellipse cx="218" cy="164" rx="145" ry="96" fill="url(#watArunGlow)" />

        {/* Far Bangkok city skyline silhouette */}
        <path
          d="M 0 220 L 0 185 L 25 185 L 25 168 L 52 168 L 52 182 L 88 182 L 88 158 L 116 158 L 116 190 L 340 190 L 352 166 L 378 166 L 378 178 L 410 178 L 410 150 L 438 150 L 438 184 L 485 184 L 485 162 L 512 162 L 512 188 L 620 188 L 620 172 L 660 172 L 660 190 L 945 190 L 945 164 L 978 164 L 978 182 L 1030 182 L 1030 154 L 1068 154 L 1068 176 L 1120 176 L 1120 166 L 1162 166 L 1162 186 L 1200 186 L 1200 220 Z"
          fill="#0a1129"
        />

        {/* WAT ARUN (พระปรางค์วัดอรุณฯ) illuminated silhouette on left bank */}
        <g transform="translate(132, 30)">
          {/* Flanking prangs */}
          <path
            d="M 16 168 L 26 128 L 31 108 L 36 128 L 46 168 Z"
            fill="url(#watGold)"
            opacity="0.82"
          />
          <path
            d="M 124 168 L 134 128 L 139 108 L 144 128 L 154 168 Z"
            fill="url(#watGold)"
            opacity="0.82"
          />
          {/* Inner minor prangs */}
          <path
            d="M 42 168 L 50 116 L 56 96 L 62 116 L 70 168 Z"
            fill="url(#watGold)"
            opacity="0.9"
          />
          <path
            d="M 100 168 L 108 116 L 114 96 L 120 116 L 128 168 Z"
            fill="url(#watGold)"
            opacity="0.9"
          />
          {/* Tall iconic Central Prang with stepped tiers & spire */}
          <path
            d="M 56 172 L 63 142 L 67 142 L 71 112 L 75 112 L 78 82 L 81 82 L 84 52 L 85 26 L 86 52 L 89 82 L 92 82 L 95 112 L 99 112 L 103 142 L 107 142 L 114 172 Z"
            fill="url(#watGold)"
          />
          {/* Temple courtyard base */}
          <rect x="6" y="166" width="158" height="24" fill="#181930" />
          {/* Warm temple uplights */}
          {[28, 56, 85, 114, 142].map((lx) => (
            <circle key={lx} cx={lx} cy="168" r="3" fill="#fde68a" opacity="0.9" />
          ))}
        </g>

        {/* RAMA VIII BRIDGE (สะพานพระราม 8) graceful golden cable-stayed span on right-center */}
        <g>
          {/* Bridge deck line across the river */}
          <line
            x1="540"
            y1="194"
            x2="1140"
            y2="194"
            stroke="#fbbf24"
            strokeOpacity="0.65"
            strokeWidth="3.5"
          />
          <line
            x1="540"
            y1="198"
            x2="1140"
            y2="198"
            stroke="#141a34"
            strokeWidth="5"
          />

          {/* Iconic inverted-Y golden pylon tower */}
          <path
            d="M 852 194 L 870 96 L 876 42 L 882 42 L 888 96 L 906 194 L 896 194 L 879 114 L 862 194 Z"
            fill="url(#ramaTower)"
          />
          {/* Golden beacon atop Rama VIII spire */}
          <circle cx="879" cy="39" r="3.5" fill="#fef08a" />

          {/* Sweeping golden diagonal stay cables (left main span — iconic Rama VIII harp!) */}
          {[575, 608, 642, 676, 710, 744, 778, 812, 842].map((bx, idx) => (
            <line
              key={`cable-l-${idx}`}
              x1={875}
              y1={48 + idx * 9}
              x2={bx}
              y2={193}
              stroke="#fcd34d"
              strokeOpacity={0.55 - idx * 0.025}
              strokeWidth="1.3"
            />
          ))}

          {/* Back-stay cables (right anchor span) */}
          {[935, 965, 995, 1025, 1055, 1085].map((bx, idx) => (
            <line
              key={`cable-r-${idx}`}
              x1={883}
              y1={50 + idx * 11}
              x2={bx}
              y2={193}
              stroke="#fbbf24"
              strokeOpacity={0.48 - idx * 0.03}
              strokeWidth="1.2"
            />
          ))}
        </g>

        {/* Warm riverside skyline window specks */}
        {[98, 106, 362, 420, 428, 496, 636, 960, 1044, 1054, 1138].map((wx, i) => (
          <circle
            key={`win-${i}`}
            cx={wx}
            cy={168 + (i % 3) * 6}
            r="1.8"
            fill={i % 4 === 0 ? "#fda4af" : "#fde68a"}
            opacity="0.72"
          />
        ))}
      </svg>

      {/* Shimmering Chao Phraya water reflections (Moon + Wat Arun + Rama VIII + Bangkok lights) */}
      <div
        className={`absolute inset-x-0 bottom-0 transition-all duration-1000 ${
          released ? "top-[64%]" : "top-[51.5%]"
        }`}
      >
        {/* Full moon reflection column */}
        <div className="absolute top-0 right-[9%] flex h-44 w-28 flex-col items-center gap-2.5 pt-2 sm:right-[15%] sm:w-36">
          {[88, 72, 94, 62, 78, 52, 66, 40].map((w, i) => (
            <div
              key={i}
              className="animate-water-shimmer h-[2px] rounded-full bg-gradient-to-r from-transparent via-amber-200/60 to-transparent"
              style={
                {
                  width: `${w}%`,
                  "--shimmer-dur": `${4.2 + (i % 4) * 0.8}s`,
                  "--shimmer-delay": `${i * 0.35}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* Wat Arun warm golden water shimmer on left */}
        <div className="absolute top-0 left-[12%] flex h-28 w-24 flex-col items-center gap-2 pt-2">
          {[80, 62, 74, 48, 56].map((w, i) => (
            <div
              key={i}
              className="animate-water-shimmer h-[2px] rounded-full bg-gradient-to-r from-transparent via-amber-400/45 to-transparent"
              style={
                {
                  width: `${w}%`,
                  "--shimmer-dur": `${5.0 + i * 0.6}s`,
                  "--shimmer-delay": `${i * 0.4}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* Vertical Bangkok riverside light streaks */}
        {RIVERSIDE_BOKEH.map((b, i) => (
          <div
            key={i}
            className="animate-water-shimmer absolute top-1 h-16 rounded-full opacity-35"
            style={
              {
                left: `${b.x}%`,
                width: `${b.w}px`,
                background: `linear-gradient(180deg, ${b.color}, transparent)`,
                "--shimmer-dur": `${4.5 + (i % 3) * 1.1}s`,
                "--shimmer-delay": `${i * 0.25}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Subtle distant glowing krathongs drifting lazily along the far Chao Phraya horizon */}
      <div className="absolute inset-0">
        {DISTANT_KRATHONGS.map((dk, idx) => (
          <div
            key={idx}
            className="animate-distant-krathong absolute flex flex-col items-center transition-all duration-1000"
            style={
              {
                left: `${dk.x}%`,
                top: `${released ? dk.y + 12 : dk.y}%`,
                "--dk-dur": `${dk.dur}s`,
                "--dk-delay": `${dk.delay}s`,
              } as React.CSSProperties
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_8px_#fbbf24]" />
            <span className="mt-0.5 h-[2px] w-3 rounded-full bg-amber-400/50 blur-[0.5px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
