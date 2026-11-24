export const DRIFT_DURATION_MS = 25000;
export const DRIFT_X_LIMIT = 1.65;
export const DRIFT_STEER_SPEED = 1.7;
const LANTERN_REACH = 0.52;
const OBSTACLE_REACH = 0.4;

export type DriftStatus = "idle" | "playing" | "done";
export type DriftItemKind = "lantern" | "obstacle";

export interface DriftItem {
  id: string;
  kind: DriftItemKind;
  x: number;
  z: number;
}

export interface DriftSim {
  status: DriftStatus;
  seed: number;
  score: number;
  x: number;
  startedAtMs: number;
  tickMs: number;
  resolved: string[];
}

export function clampSteer(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

export function averageSteer(
  p1: number,
  p2: number,
  onlineSlots: ReadonlyArray<1 | 2>,
): number {
  const values: number[] = [];
  if (onlineSlots.includes(1)) values.push(clampSteer(p1));
  if (onlineSlots.includes(2)) values.push(clampSteer(p2));
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDriftCourse(seed: number): DriftItem[] {
  const rand = mulberry32(seed > 0 ? seed : 1);
  const kinds: DriftItemKind[] = [
    "lantern",
    "lantern",
    "obstacle",
    "lantern",
    "obstacle",
    "lantern",
    "lantern",
    "obstacle",
  ];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const swap = kinds[i]!;
    kinds[i] = kinds[j]!;
    kinds[j] = swap;
  }

  const items: DriftItem[] = [];
  let lastX = 0;
  for (let i = 0; i < kinds.length; i++) {
    const z = -2.2 - (i + 0.45) * 0.58;
    let x = (rand() * 2 - 1) * 1.3;
    if (Math.abs(x - lastX) < 0.48) {
      x = Math.max(-1.35, Math.min(1.35, -Math.sign(lastX || 1) * (0.75 + rand() * 0.5)));
    }
    lastX = x;
    items.push({ id: `${kinds[i]}-${i}`, kind: kinds[i]!, x, z });
  }
  return items;
}

export function driftZAt(elapsedMs: number): number {
  const t = Math.max(0, Math.min(1, elapsedMs / DRIFT_DURATION_MS));
  return -1.55 - t * 5.15;
}

export function stepDrift(sim: DriftSim, nowMs: number, steer: number): DriftSim {
  if (sim.status !== "playing") return sim;

  const elapsed = Math.max(0, nowMs - sim.startedAtMs);
  const prevElapsed = Math.max(0, Math.min(DRIFT_DURATION_MS, sim.tickMs - sim.startedAtMs));
  const dt = Math.max(0, Math.min(0.2, (nowMs - sim.tickMs) / 1000));
  const x = Math.max(
    -DRIFT_X_LIMIT,
    Math.min(DRIFT_X_LIMIT, sim.x + clampSteer(steer) * DRIFT_STEER_SPEED * dt),
  );
  const prevZ = driftZAt(prevElapsed);
  const z = driftZAt(Math.min(elapsed, DRIFT_DURATION_MS));
  const resolved = new Set(sim.resolved);
  let score = sim.score;

  if (dt > 0 && z < prevZ) {
    for (const item of buildDriftCourse(sim.seed)) {
      if (resolved.has(item.id)) continue;
      if (prevZ > item.z && z <= item.z) {
        const reach = item.kind === "lantern" ? LANTERN_REACH : OBSTACLE_REACH;
        if (Math.abs(x - item.x) <= reach) {
          score = item.kind === "lantern" ? score + 2 : Math.max(0, score - 1);
        }
        resolved.add(item.id);
      }
    }
  }

  return {
    ...sim,
    x,
    score,
    tickMs: nowMs,
    resolved: [...resolved],
    status: elapsed >= DRIFT_DURATION_MS ? "done" : "playing",
  };
}
