"use client";

import React, { useEffect, useRef } from "react";

export interface ActiveFireworkItem {
  id: number;
  xPercent: number;
  yPercent: number;
  senderName: string;
  spawnedAtMs: number;
}

interface FireworksOverlayProps {
  items: ActiveFireworkItem[];
}

interface FireworkParticle {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  twinklePhase: number;
  willow: boolean;
}

interface FireworkRuntime {
  id: number;
  targetXNorm: number;
  targetYNorm: number;
  spawnedAtMs: number;
  exploded: boolean;
  palette: string[];
  haloLife: number;
}

const FIREWORK_PALETTES = [
  ["#fffbeb", "#fef08a", "#fbbf24", "#f59e0b"], // Warm champagne gold
  ["#fff1f2", "#fda4af", "#fb7185", "#fde68a"], // Blush rose & gold
  ["#f8fafc", "#e0e7ff", "#c4b5fd", "#fde047"], // Moonlight lavender & champagne
  ["#fffbeb", "#fed7aa", "#fb923c", "#f472b6"], // Romantic festive sunset
];

const LAUNCH_MS = 350;
const TOTAL_LIFETIME_MS = 2300;

export function FireworksOverlay({ items }: FireworksOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rocketsRef = useRef<Map<number, FireworkRuntime>>(new Map());
  const particlesRef = useRef<FireworkParticle[]>([]);
  const startLoopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const now = performance.now();
    let added = false;
    for (const item of items) {
      if (!rocketsRef.current.has(item.id)) {
        const elapsed = Math.max(0, Date.now() - item.spawnedAtMs);
        if (elapsed < TOTAL_LIFETIME_MS) {
          rocketsRef.current.set(item.id, {
            id: item.id,
            targetXNorm: Math.max(0.08, Math.min(0.92, item.xPercent / 100)),
            targetYNorm: Math.max(0.1, Math.min(0.46, item.yPercent / 100)),
            spawnedAtMs: now - elapsed,
            exploded: false,
            palette:
              FIREWORK_PALETTES[Math.abs(item.id) % FIREWORK_PALETTES.length]!,
            haloLife: 0,
          });
          added = true;
        }
      }
    }
    if (added || rocketsRef.current.size > 0) {
      startLoopRef.current?.();
    }
  }, [items]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let running = false;
    let lastTime = performance.now();

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : window.innerWidth;
      const h = parent ? parent.clientHeight : window.innerHeight;
      // Match Three.js capture mode (?capture=1 / loy_capture_perf) for steady 30fps stories
      const capturePerf =
        new URLSearchParams(window.location.search).get("capture") === "1" ||
        window.localStorage.getItem("loy_capture_perf") === "1";
      const dpr = Math.min(window.devicePixelRatio || 1, capturePerf ? 1 : 2);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const explodeRocket = (cx: number, cy: number, palette: string[], isCompact: boolean) => {
      const scale = isCompact ? 0.78 : 1.0;
      // Outer chrysanthemum / willow burst (42 glowing trails)
      const outerCount = 42;
      for (let i = 0; i < outerCount; i++) {
        const ang = (i / outerCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
        const speed = (105 + Math.random() * 68) * scale;
        particlesRef.current.push({
          x: cx,
          y: cy,
          prevX: cx,
          prevY: cy,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 18 * scale,
          color: palette[i % palette.length]!,
          size: 2.1 + Math.random() * 1.1,
          life: 0,
          maxLife: 1.35 + Math.random() * 0.45,
          twinklePhase: Math.random() * Math.PI * 2,
          willow: i % 2 === 0,
        });
      }

      // Inner bright glittering core ring (18 faster champagne sparks)
      const innerCount = 18;
      for (let i = 0; i < innerCount; i++) {
        const ang = (i / innerCount) * Math.PI * 2 + 0.14;
        const speed = (52 + Math.random() * 32) * scale;
        particlesRef.current.push({
          x: cx,
          y: cy,
          prevX: cx,
          prevY: cy,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 10 * scale,
          color: palette[0]!,
          size: 1.8 + Math.random() * 0.8,
          life: 0,
          maxLife: 0.95 + Math.random() * 0.35,
          twinklePhase: Math.random() * Math.PI * 2,
          willow: false,
        });
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));
      lastTime = now;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const isCompact = w < 520;
      ctx.clearRect(0, 0, w, h);

      // Update & draw launching firework comets + bloom sky halo + water shimmer hint
      for (const [id, rocket] of rocketsRef.current) {
        const ageMs = now - rocket.spawnedAtMs;
        if (ageMs > TOTAL_LIFETIME_MS) {
          rocketsRef.current.delete(id);
          continue;
        }

        const tx = rocket.targetXNorm * w;
        const ty = rocket.targetYNorm * h;
        const startY = h * 0.54;

        if (ageMs < LAUNCH_MS) {
          const p = ageMs / LAUNCH_MS;
          const ease = 1 - Math.pow(1 - p, 2.2);
          const cx = tx + Math.sin(p * Math.PI) * 5;
          const cy = startY + (ty - startY) * ease;
          const tailY = Math.min(startY, cy + 32);

          // Glowing golden launch comet streak
          const streak = ctx.createLinearGradient(cx, cy, cx, tailY);
          streak.addColorStop(0, "rgba(255, 251, 235, 0.95)");
          streak.addColorStop(0.45, "rgba(251, 191, 36, 0.65)");
          streak.addColorStop(1, "rgba(251, 191, 36, 0)");
          ctx.strokeStyle = streak;
          ctx.lineWidth = 2.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx, tailY);
          ctx.stroke();

          ctx.fillStyle = "#fffbeb";
          ctx.beginPath();
          ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          if (!rocket.exploded) {
            rocket.exploded = true;
            rocket.haloLife = 1;
            explodeRocket(tx, ty, rocket.palette, isCompact);
          }

          if (rocket.haloLife > 0.01) {
            rocket.haloLife = Math.max(0, rocket.haloLife - dt * 1.45);
            // Warm sky bloom halo at explosion center
            const haloR = (isCompact ? 85 : 120) * (1.25 - rocket.haloLife * 0.4);
            const halo = ctx.createRadialGradient(tx, ty, 2, tx, ty, haloR);
            halo.addColorStop(0, `rgba(255, 250, 230, ${rocket.haloLife * 0.55})`);
            halo.addColorStop(0.45, `rgba(251, 191, 36, ${rocket.haloLife * 0.22})`);
            halo.addColorStop(1, "rgba(251, 191, 36, 0)");
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(tx, ty, haloR, 0, Math.PI * 2);
            ctx.fill();

            // Subtle shimmering reflection hint on the Chao Phraya water below
            const waterY = h * 0.62;
            const refl = ctx.createRadialGradient(tx, waterY, 2, tx, waterY, 55);
            refl.addColorStop(0, `rgba(254, 240, 138, ${rocket.haloLife * 0.22})`);
            refl.addColorStop(1, "rgba(251, 191, 36, 0)");
            ctx.fillStyle = refl;
            ctx.beginPath();
            ctx.ellipse(tx, waterY, 55, 16, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Render glowing chrysanthemum / willow burst trails & twinkling glitter tips
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const pt = particlesRef.current[i]!;
        pt.life += dt;
        if (pt.life >= pt.maxLife) {
          particlesRef.current.splice(i, 1);
          continue;
        }
        pt.prevX = pt.x;
        pt.prevY = pt.y;
        const drag = pt.willow ? 1.55 : 2.1;
        pt.vx *= Math.max(0.85, 1 - drag * dt);
        pt.vy = pt.vy * Math.max(0.85, 1 - drag * dt) + (pt.willow ? 96 : 68) * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;

        const progress = pt.life / pt.maxLife;
        const fade = Math.max(0, 1 - Math.pow(progress, 1.55));
        const twinkle =
          progress > 0.5
            ? 0.55 + 0.45 * Math.sin(pt.life * 28 + pt.twinklePhase)
            : 1;
        const alpha = fade * twinkle;

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = pt.size * (1 - progress * 0.45);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(pt.prevX, pt.prevY);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();

        // Bright twinkling glitter tip
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = alpha * 0.9;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(0.8, pt.size * 0.55), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (rocketsRef.current.size > 0 || particlesRef.current.length > 0) {
        rafId = requestAnimationFrame(tick);
      } else {
        running = false;
        ctx.clearRect(0, 0, w, h);
      }
    };

    const startLoop = () => {
      if (running) return;
      running = true;
      lastTime = performance.now();
      rafId = requestAnimationFrame(tick);
    };
    startLoopRef.current = startLoop;

    if (rocketsRef.current.size > 0 || particlesRef.current.length > 0) {
      startLoop();
    }

    return () => {
      running = false;
      startLoopRef.current = null;
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-fireworks-canvas="true"
      className="pointer-events-none absolute inset-0 z-[25] h-full w-full"
      aria-hidden="true"
    />
  );
}
