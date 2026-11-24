"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  AccentStyle,
  BaseStyle,
  CANDLE_THEME_VISUALS,
  CandleStyle,
  FlowerStyle,
  FusionState,
  KrathongDesign,
} from "@/lib/krathong";
import { DRIFT_DURATION_MS, DRIFT_STEER_SPEED, DRIFT_X_LIMIT, driftZAt } from "@/lib/drift-game";
import { SAMPLE_RIVER_WISHES, type SampleRiverWish } from "@/lib/sample-wishes";

export type CameraFocusMode = "customize" | "both" | "fused" | "released";

export interface FusionOverlaySignal {
  active: boolean;
  phase: "idle" | "charge" | "impact" | "reveal";
  flashOpacity: number;
  burstKey: number;
}

export interface DriftViewItem {
  id: string;
  kind: "lantern" | "obstacle";
  x: number;
  z: number;
  resolved: boolean;
}

export interface DriftView {
  mode: "off" | "playing" | "done";
  x: number;
  z: number;
  steer: number;
  elapsedMs: number;
  receivedAtMs: number;
  items: DriftViewItem[];
}

interface Krathong3DProps {
  p1Choice: KrathongDesign;
  p2Choice: KrathongDesign;
  fusionState: FusionState;
  fusionTriggerKey: number;
  focusMode: CameraFocusMode;
  activeSlot: 1 | 2;
  releasedAtMs?: number | null;
  someoneHolding?: boolean;
  skyFlashKey?: number;
  drift?: DriftView | null;
  onUserOrbit?: () => void;
  onFusionSignal?: (signal: FusionOverlaySignal) => void;
  onDriftSteer?: (steer: number | null) => void;
  onSampleWish?: (wish: Pick<SampleRiverWish, "from" | "text">) => void;
}

// ============================================================================
// PROCEDURAL BOTANICAL GEOMETRY BUILDERS (smooth curved meshes, ZERO blocky shapes)
// ============================================================================

function createCurvedPetalGeometry(
  width: number,
  length: number,
  cupDepth: number,
  tipFlare: number,
  colorBottom: THREE.Color,
  colorMid: THREE.Color,
  colorTip: THREE.Color,
  segU = 10,
  segV = 14,
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const tmpColor = new THREE.Color();

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV; // 0 = base, 1 = tip
    // Natural teardrop/spoon botanical petal width profile
    const widthProfile =
      Math.pow(Math.sin(v * Math.PI), 0.72) * (1 - 0.12 * v * v);
    const halfW = width * 0.5 * widthProfile;

    // Gentle forward curve + outward flare toward the tip
    const zCurve =
      Math.sin(v * Math.PI * 0.85) * cupDepth * 0.45 +
      Math.pow(v, 2.3) * tipFlare;
    const yPos = v * length;

    // Smooth botanical base -> mid -> tip color blend
    if (v < 0.52) {
      tmpColor.lerpColors(colorBottom, colorMid, v / 0.52);
    } else {
      tmpColor.lerpColors(colorMid, colorTip, (v - 0.52) / 0.48);
    }

    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU; // 0..1 across width
      const s = u * 2 - 1; // -1..1
      const xPos = s * halfW;
      // Concave spoon-cup curvature across width
      const cupZ = -(1 - s * s) * Math.sin(v * Math.PI) * cupDepth;
      const edgeLift = s * s * Math.sin(v * Math.PI) * cupDepth * 0.16;

      positions.push(xPos, yPos, zCurve + cupZ + edgeLift);
      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + 1;
      const c = a + (segU + 1);
      const d = c + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  geom.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function createFoldedBananaLeafGeometry(
  cBaseHex = "#186b3a",
  cMidHex = "#2ec262",
  cTipHex = "#a3f78b",
  cSpineHex = "#d4ffba",
): THREE.BufferGeometry {
  // Sculpted curved Thai banana-leaf pleat (กลีบใบตองพับจีบ) with raised center spine & rolled wings
  const segU = 12;
  const segV = 14;
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const cBase = new THREE.Color(cBaseHex);
  const cMid = new THREE.Color(cMidHex);
  const cTip = new THREE.Color(cTipHex);
  const cSpine = new THREE.Color(cSpineHex);
  const tmp = new THREE.Color();

  const width = 0.44;
  const height = 0.52;

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    // Taper smoothly to a pointed banana-leaf crown tip
    const halfW = width * 0.5 * Math.pow(1 - v, 0.78) * (0.65 + 0.35 * Math.sin(Math.min(1, v * 2.2) * Math.PI * 0.5));
    const y = v * height;
    const archOut = Math.sin(v * Math.PI * 0.75) * 0.09 + v * v * 0.06;

    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const s = u * 2 - 1; // -1..1
      const absS = Math.abs(s);
      const x = s * halfW;
      // Classic folded V-pleat ridge in center + soft rolled outer edge
      const foldZ = (1 - absS) * 0.11 * (1 - v * 0.55) - absS * absS * 0.04;
      positions.push(x, y, archOut + foldZ);

      if (v < 0.55) {
        tmp.lerpColors(cBase, cMid, v / 0.55);
      } else {
        tmp.lerpColors(cMid, cTip, (v - 0.55) / 0.45);
      }
      if (absS < 0.22) {
        tmp.lerp(cSpine, (0.22 - absS) * 1.4);
      }
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + 1;
      const c = a + (segU + 1);
      const d = c + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function createCrystalPetalGeometry(): THREE.BufferGeometry {
  // Faceted crystalline moonlight petal (คริสตัลจันทรา) with diamond bevel ridge
  const segU = 4;
  const segV = 6;
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const cBase = new THREE.Color("#2563eb");
  const cMid = new THREE.Color("#38bdf8");
  const cTip = new THREE.Color("#f0f9ff");
  const tmp = new THREE.Color();

  const width = 0.46;
  const height = 0.56;

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    const widthProfile =
      v < 0.35
        ? 0.48 + (v / 0.35) * 0.52
        : Math.max(0.02, 1 - (v - 0.35) / 0.65);
    const halfW = width * 0.5 * widthProfile;
    const y = v * height;
    const archOut = Math.sin(v * Math.PI * 0.8) * 0.1 + v * v * 0.08;

    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const s = u * 2 - 1;
      const absS = Math.abs(s);
      const x = s * halfW;
      const ridgeZ = (1 - absS) * 0.13 * (1 - v * 0.4);
      positions.push(x, y, archOut + ridgeZ);

      if (v < 0.5) tmp.lerpColors(cBase, cMid, v / 0.5);
      else tmp.lerpColors(cMid, cTip, (v - 0.5) / 0.5);
      if (absS < 0.15) tmp.lerp(cTip, 0.35);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + 1;
      const c = a + (segU + 1);
      const d = c + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function createCrescentMoonGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 0.2, 0.35, Math.PI * 2 - 0.35, false);
  shape.absarc(0.08, 0.01, 0.155, Math.PI * 2 - 0.55, 0.55, true);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.016,
    bevelThickness: 0.016,
  });
  geom.center();
  return geom;
}

function createStarGeometry(outerR = 0.09, innerR = 0.04): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.025,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
  });
  geom.center();
  return geom;
}

// ============================================================================
// SHARED BOTANICAL ASSET CACHE (one set of crisp smooth geometries per WebGL scene)
// ============================================================================

interface BotanicalAssets {
  bananaLeaf: THREE.BufferGeometry;
  goldenLeaf: THREE.BufferGeometry;
  crystalPetal: THREE.BufferGeometry;
  lotusBaseOuter: THREE.BufferGeometry;
  lotusBaseInner: THREE.BufferGeometry;
  lotusFlowerOuter: THREE.BufferGeometry;
  lotusFlowerMid: THREE.BufferGeometry;
  lotusFlowerInner: THREE.BufferGeometry;
  lotusBudPetal: THREE.BufferGeometry;
  marigoldPetalOuter: THREE.BufferGeometry;
  marigoldPetalInner: THREE.BufferGeometry;
  globeBract: THREE.BufferGeometry;
  rosePetalOuter: THREE.BufferGeometry;
  rosePetalInner: THREE.BufferGeometry;
  orchidPetal: THREE.BufferGeometry;
  orchidLip: THREE.BufferGeometry;
  smallLeaf: THREE.BufferGeometry;
  jasminePetal: THREE.BufferGeometry;
  crescentMoon: THREE.BufferGeometry;
  star: THREE.BufferGeometry;
  flameOuter: THREE.BufferGeometry;
  flameInner: THREE.BufferGeometry;
  vertexMat: THREE.MeshPhysicalMaterial;
  vertexMatGlossy: THREE.MeshPhysicalMaterial;
  goldLeafMat: THREE.MeshPhysicalMaterial;
  crystalMat: THREE.MeshPhysicalMaterial;
  goldMetalMat: THREE.MeshPhysicalMaterial;
  roseMetalMat: THREE.MeshPhysicalMaterial;
  stamenMat: THREE.MeshStandardMaterial;
  jasmineMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

function createBotanicalAssets(): BotanicalAssets {
  const bananaLeaf = createFoldedBananaLeafGeometry(
    "#186b3a",
    "#2ec262",
    "#a3f78b",
    "#d4ffba",
  );
  const goldenLeaf = createFoldedBananaLeafGeometry(
    "#b45309",
    "#f59e0b",
    "#fef08a",
    "#fffbeb",
  );
  const crystalPetal = createCrystalPetalGeometry();
  const lotusBaseOuter = createCurvedPetalGeometry(
    0.46,
    0.58,
    0.13,
    0.16,
    new THREE.Color("#c92a6a"),
    new THREE.Color("#ff7aa8"),
    new THREE.Color("#fff0f6"),
  );
  const lotusBaseInner = createCurvedPetalGeometry(
    0.38,
    0.5,
    0.12,
    0.1,
    new THREE.Color("#e13b7f"),
    new THREE.Color("#ff9ec0"),
    new THREE.Color("#fff7fa"),
  );

  // Lotus flower (3 overlapping smooth curved spoon-petal rings)
  const lotusFlowerOuter = createCurvedPetalGeometry(
    0.18,
    0.26,
    0.07,
    0.08,
    new THREE.Color("#fff5f8"),
    new THREE.Color("#ff8fb8"),
    new THREE.Color("#ec407a"),
    8,
    10,
  );
  const lotusFlowerMid = createCurvedPetalGeometry(
    0.15,
    0.22,
    0.065,
    0.045,
    new THREE.Color("#fffaf5"),
    new THREE.Color("#ffa9c9"),
    new THREE.Color("#f06292"),
    8,
    10,
  );
  const lotusFlowerInner = createCurvedPetalGeometry(
    0.11,
    0.17,
    0.055,
    0.015,
    new THREE.Color("#fffdf7"),
    new THREE.Color("#ffcce0"),
    new THREE.Color("#f48fb1"),
    7,
    9,
  );
  const lotusBudPetal = createCurvedPetalGeometry(
    0.13,
    0.23,
    0.06,
    -0.02,
    new THREE.Color("#fff5f8"),
    new THREE.Color("#ff8fb8"),
    new THREE.Color("#e91e63"),
    7,
    9,
  );

  // Marigold ruffled petals (vivid tangerine-gold to sunlit bright yellow!)
  const marigoldPetalOuter = createCurvedPetalGeometry(
    0.095,
    0.15,
    0.045,
    0.065,
    new THREE.Color("#ea580c"),
    new THREE.Color("#f59e0b"),
    new THREE.Color("#fde047"),
    6,
    8,
  );
  const marigoldPetalInner = createCurvedPetalGeometry(
    0.075,
    0.115,
    0.04,
    0.03,
    new THREE.Color("#f59e0b"),
    new THREE.Color("#facc15"),
    new THREE.Color("#fef9c3"),
    6,
    8,
  );
  const globeBract = createCurvedPetalGeometry(
    0.065,
    0.09,
    0.03,
    0.01,
    new THREE.Color("#a21caf"),
    new THREE.Color("#e81cff"),
    new THREE.Color("#f9a8d4"),
    5,
    6,
  );

  // Velvet Crimson Rose cupped spiral petals (deep ruby-crimson so roses pop rich red even under bright candle lights)
  const rosePetalOuter = createCurvedPetalGeometry(
    0.16,
    0.19,
    0.07,
    0.07,
    new THREE.Color("#6b0722"),
    new THREE.Color("#d9143c"),
    new THREE.Color("#fb7185"),
    8,
    10,
  );
  const rosePetalInner = createCurvedPetalGeometry(
    0.115,
    0.15,
    0.06,
    0.025,
    new THREE.Color("#4c0519"),
    new THREE.Color("#b91032"),
    new THREE.Color("#f43f5e"),
    7,
    8,
  );

  // Thai Dendrobium Orchid petals (electric amethyst-violet & orchid pink + gold lip)
  const orchidPetal = createCurvedPetalGeometry(
    0.125,
    0.2,
    0.032,
    0.055,
    new THREE.Color("#fae8ff"),
    new THREE.Color("#d946ef"),
    new THREE.Color("#9333ea"),
    7,
    9,
  );
  const orchidLip = createCurvedPetalGeometry(
    0.1,
    0.145,
    0.055,
    0.065,
    new THREE.Color("#fef08a"),
    new THREE.Color("#ec4899"),
    new THREE.Color("#86198f"),
    7,
    8,
  );

  // Curved vivid emerald leaf sprig & luminous jasmine petal
  const smallLeaf = createCurvedPetalGeometry(
    0.1,
    0.22,
    0.03,
    0.06,
    new THREE.Color("#15803d"),
    new THREE.Color("#22c55e"),
    new THREE.Color("#86efac"),
    6,
    8,
  );
  const jasminePetal = createCurvedPetalGeometry(
    0.045,
    0.082,
    0.015,
    0.035,
    new THREE.Color("#fef9e7"),
    new THREE.Color("#ffffff"),
    new THREE.Color("#ffffff"),
    5,
    6,
  );

  const crescentMoon = createCrescentMoonGeometry();
  const star = createStarGeometry();

  // Teardrop 3D candle flame geometries
  const flameOuterPts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.048, 0.045),
    new THREE.Vector2(0.062, 0.11),
    new THREE.Vector2(0.044, 0.2),
    new THREE.Vector2(0.016, 0.29),
    new THREE.Vector2(0.001, 0.34),
  ];
  const flameOuter = new THREE.LatheGeometry(flameOuterPts, 16);
  const flameInnerPts = [
    new THREE.Vector2(0.001, 0.015),
    new THREE.Vector2(0.028, 0.06),
    new THREE.Vector2(0.034, 0.12),
    new THREE.Vector2(0.016, 0.2),
    new THREE.Vector2(0.001, 0.24),
  ];
  const flameInner = new THREE.LatheGeometry(flameInnerPts, 14);

  const vertexMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    emissive: new THREE.Color("#22121a"),
    emissiveIntensity: 0.16,
    roughness: 0.34,
    metalness: 0.04,
    clearcoat: 0.22,
    clearcoatRoughness: 0.35,
    side: THREE.DoubleSide,
  });

  const vertexMatGlossy = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    emissive: new THREE.Color("#181622"),
    emissiveIntensity: 0.15,
    roughness: 0.22,
    metalness: 0.08,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2,
    side: THREE.DoubleSide,
  });

  const goldLeafMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    emissive: new THREE.Color("#92400e"),
    emissiveIntensity: 0.24,
    roughness: 0.2,
    metalness: 0.62,
    clearcoat: 0.72,
    clearcoatRoughness: 0.14,
    side: THREE.DoubleSide,
  });

  const crystalMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    emissive: new THREE.Color("#1d4ed8"),
    emissiveIntensity: 0.36,
    roughness: 0.1,
    metalness: 0.26,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });

  const goldMetalMat = new THREE.MeshPhysicalMaterial({
    color: "#ffd147",
    emissive: "#b45309",
    emissiveIntensity: 0.38,
    roughness: 0.18,
    metalness: 0.82,
    clearcoat: 0.6,
  });

  const roseMetalMat = new THREE.MeshPhysicalMaterial({
    color: "#ff7eb3",
    emissive: "#be185d",
    emissiveIntensity: 0.32,
    roughness: 0.2,
    metalness: 0.58,
    clearcoat: 0.55,
  });

  const stamenMat = new THREE.MeshStandardMaterial({
    color: "#fef08a",
    emissive: "#f59e0b",
    emissiveIntensity: 0.78,
    roughness: 0.28,
  });

  const jasmineMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    emissive: "#fef3c7",
    emissiveIntensity: 0.32,
    roughness: 0.22,
  });

  const geoms = [
    bananaLeaf,
    goldenLeaf,
    crystalPetal,
    lotusBaseOuter,
    lotusBaseInner,
    lotusFlowerOuter,
    lotusFlowerMid,
    lotusFlowerInner,
    lotusBudPetal,
    marigoldPetalOuter,
    marigoldPetalInner,
    globeBract,
    rosePetalOuter,
    rosePetalInner,
    orchidPetal,
    orchidLip,
    smallLeaf,
    jasminePetal,
    crescentMoon,
    star,
    flameOuter,
    flameInner,
  ];
  const mats = [
    vertexMat,
    vertexMatGlossy,
    goldLeafMat,
    crystalMat,
    goldMetalMat,
    roseMetalMat,
    stamenMat,
    jasmineMat,
  ];

  return {
    bananaLeaf,
    goldenLeaf,
    crystalPetal,
    lotusBaseOuter,
    lotusBaseInner,
    lotusFlowerOuter,
    lotusFlowerMid,
    lotusFlowerInner,
    lotusBudPetal,
    marigoldPetalOuter,
    marigoldPetalInner,
    globeBract,
    rosePetalOuter,
    rosePetalInner,
    orchidPetal,
    orchidLip,
    smallLeaf,
    jasminePetal,
    crescentMoon,
    star,
    flameOuter,
    flameInner,
    vertexMat,
    vertexMatGlossy,
    goldLeafMat,
    crystalMat,
    goldMetalMat,
    roseMetalMat,
    stamenMat,
    jasmineMat,
    dispose: () => {
      geoms.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

// ============================================================================
// LUSH ORGANIC 3D FLOWER COMPOSITIONS
// ============================================================================

function buildLotusBloom(assets: BotanicalAssets, scale = 1): THREE.Group {
  const g = new THREE.Group();

  // Outer flared ring (7 spoon petals)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const p = new THREE.Mesh(assets.lotusFlowerOuter, assets.vertexMatGlossy);
    p.rotation.order = "YXZ";
    p.rotation.y = a;
    p.rotation.x = 1.02;
    g.add(p);
  }
  // Middle cupped ring (6 petals staggered)
  for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) / 6) * Math.PI * 2;
    const p = new THREE.Mesh(assets.lotusFlowerMid, assets.vertexMatGlossy);
    p.rotation.order = "YXZ";
    p.rotation.y = a;
    p.rotation.x = 0.68;
    p.position.y = 0.02;
    g.add(p);
  }
  // Inner glowing cupped ring (5 petals)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new THREE.Mesh(assets.lotusFlowerInner, assets.vertexMatGlossy);
    p.rotation.order = "YXZ";
    p.rotation.y = a;
    p.rotation.x = 0.36;
    p.position.y = 0.035;
    g.add(p);
  }

  // Glowing golden stamen crown in center
  const pod = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 10, 8),
    assets.stamenMat,
  );
  pod.scale.set(1, 0.65, 1);
  pod.position.y = 0.055;
  g.add(pod);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 6, 6),
      assets.stamenMat,
    );
    tip.position.set(Math.cos(a) * 0.055, 0.088, Math.sin(a) * 0.055);
    g.add(tip);
  }

  g.scale.setScalar(scale);
  return g;
}

function buildLotusBud(assets: BotanicalAssets): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new THREE.Mesh(assets.lotusBudPetal, assets.vertexMatGlossy);
    p.rotation.order = "YXZ";
    p.rotation.y = a;
    p.rotation.x = 0.24;
    g.add(p);
  }
  return g;
}

function buildJasmineFlower(assets: BotanicalAssets): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new THREE.Mesh(assets.jasminePetal, assets.vertexMatGlossy);
    p.rotation.order = "YXZ";
    p.rotation.y = a;
    p.rotation.x = 1.1;
    g.add(p);
  }
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 6, 6),
    assets.stamenMat,
  );
  core.position.y = 0.015;
  g.add(core);
  return g;
}

function buildMarigoldRosette(assets: BotanicalAssets, scale = 1): THREE.Group {
  // Dense ruffled Thai marigold pom-pom (ดอกดาวเรือง) — 4 staggered layers of fluted petals!
  const g = new THREE.Group();
  const layers = [
    { count: 10, tilt: 1.18, y: 0.01, geom: assets.marigoldPetalOuter, sc: 1.05 },
    { count: 9, tilt: 0.85, y: 0.04, geom: assets.marigoldPetalOuter, sc: 0.92 },
    { count: 7, tilt: 0.54, y: 0.07, geom: assets.marigoldPetalInner, sc: 0.88 },
    { count: 5, tilt: 0.24, y: 0.095, geom: assets.marigoldPetalInner, sc: 0.72 },
  ];
  layers.forEach((layer, li) => {
    for (let i = 0; i < layer.count; i++) {
      const a = ((i + li * 0.45) / layer.count) * Math.PI * 2;
      const p = new THREE.Mesh(layer.geom, assets.vertexMat);
      p.rotation.order = "YXZ";
      p.rotation.y = a;
      p.rotation.x = layer.tilt;
      p.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.14;
      p.position.y = layer.y;
      p.scale.setScalar(layer.sc);
      g.add(p);
    }
  });
  g.scale.setScalar(scale);
  return g;
}

function buildGlobeAmaranth(assets: BotanicalAssets): THREE.Group {
  // Lush magenta-violet bract cluster (ดอกบานไม่รู้โรย)
  const g = new THREE.Group();
  for (let ring = 0; ring < 3; ring++) {
    const count = ring === 0 ? 7 : ring === 1 ? 6 : 4;
    const tilt = ring === 0 ? 1.05 : ring === 1 ? 0.62 : 0.24;
    const y = ring * 0.032;
    for (let i = 0; i < count; i++) {
      const a = ((i + ring * 0.5) / count) * Math.PI * 2;
      const p = new THREE.Mesh(assets.globeBract, assets.vertexMat);
      p.rotation.order = "YXZ";
      p.rotation.y = a;
      p.rotation.x = tilt;
      p.position.y = y;
      g.add(p);
    }
  }
  return g;
}

function buildSpiralRose(assets: BotanicalAssets, scale = 1): THREE.Group {
  // Sculpted cupped spiral rose (กุหลาบ)
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = new THREE.Mesh(assets.rosePetalOuter, assets.vertexMat);
    p.rotation.order = "YXZ";
    p.rotation.y = a;
    p.rotation.x = 0.92;
    p.rotation.z = 0.2;
    p.position.y = 0.015;
    g.add(p);
  }
  for (let i = 0; i < 5; i++) {
    const a = ((i + 0.45) / 5) * Math.PI * 2;
    const p = new THREE.Mesh(assets.rosePetalInner, assets.vertexMat);
    p.rotation.order = "YXZ";
    p.rotation.y = a;
    p.rotation.x = 0.52;
    p.rotation.z = 0.25;
    p.position.y = 0.04;
    g.add(p);
  }
  for (let i = 0; i < 4; i++) {
    const a = ((i + 0.2) / 4) * Math.PI * 2;
    const p = new THREE.Mesh(assets.rosePetalInner, assets.vertexMat);
    p.rotation.order = "YXZ";
    p.rotation.y = a;
    p.rotation.x = 0.22;
    p.rotation.z = 0.3;
    p.scale.setScalar(0.72);
    p.position.y = 0.065;
    g.add(p);
  }
  // Curved emerald leaf sprigs tucking beneath the rose
  for (let i = 0; i < 2; i++) {
    const leaf = new THREE.Mesh(assets.smallLeaf, assets.vertexMatGlossy);
    leaf.rotation.order = "YXZ";
    leaf.rotation.y = i * Math.PI + 0.5;
    leaf.rotation.x = 1.25;
    leaf.position.y = 0.01;
    g.add(leaf);
  }
  g.scale.setScalar(scale);
  return g;
}

function buildThaiOrchid(assets: BotanicalAssets): THREE.Group {
  // 5-petal Thai Dendrobium orchid (กล้วยไม้) with golden-magenta lip
  const g = new THREE.Group();
  const petalAngles = [0, 1.15, -1.15, 2.35, -2.35];
  petalAngles.forEach((a, idx) => {
    const p = new THREE.Mesh(assets.orchidPetal, assets.vertexMatGlossy);
    p.rotation.order = "YXZ";
    p.rotation.y = a;
    p.rotation.x = idx === 0 ? 0.72 : 1.05;
    p.scale.setScalar(idx < 3 ? 1.0 : 0.85);
    g.add(p);
  });
  const lip = new THREE.Mesh(assets.orchidLip, assets.vertexMatGlossy);
  lip.rotation.order = "YXZ";
  lip.rotation.y = Math.PI;
  lip.rotation.x = 0.88;
  lip.position.y = 0.025;
  g.add(lip);
  return g;
}

// ============================================================================
// KRATHONG ASSEMBLY (supports single individual krathong OR fused couple krathong)
// ============================================================================

interface KrathongBuildResult {
  group: THREE.Group;
  flames: THREE.Object3D[];
  candleLights: THREE.PointLight[];
  smokeParticles: { mesh: THREE.Mesh; phase: number; baseX: number; baseZ: number }[];
}

function addBaseElement(
  parent: THREE.Group,
  assets: BotanicalAssets,
  style: BaseStyle,
  angle: number,
  radius: number,
  isInner: boolean,
): void {
  const holder = new THREE.Group();
  holder.rotation.y = angle;
  holder.position.set(Math.sin(angle) * radius, isInner ? 0.16 : 0.06, Math.cos(angle) * radius);

  if (style === "banana_leaf") {
    const mesh = new THREE.Mesh(assets.bananaLeaf, assets.vertexMatGlossy);
    mesh.rotation.x = isInner ? 0.2 : 0.56;
    mesh.scale.setScalar(isInner ? 0.88 : 1.08);
    holder.add(mesh);
  } else if (style === "lotus_petal") {
    const geom = isInner ? assets.lotusBaseInner : assets.lotusBaseOuter;
    const mesh = new THREE.Mesh(geom, assets.vertexMatGlossy);
    mesh.rotation.x = isInner ? 0.42 : 0.92;
    mesh.scale.setScalar(isInner ? 0.95 : 1.08);
    holder.add(mesh);
  } else if (style === "golden_leaf") {
    const mesh = new THREE.Mesh(assets.goldenLeaf, assets.goldLeafMat);
    mesh.rotation.x = isInner ? 0.18 : 0.54;
    mesh.scale.setScalar(isInner ? 0.9 : 1.1);
    holder.add(mesh);
  } else {
    // moon_crystal: faceted crystalline sapphire-silver petals
    const mesh = new THREE.Mesh(assets.crystalPetal, assets.crystalMat);
    mesh.rotation.x = isInner ? 0.26 : 0.66;
    mesh.scale.setScalar(isInner ? 0.92 : 1.08);
    holder.add(mesh);
  }
  parent.add(holder);
}

function addFlowerCluster(
  parent: THREE.Group,
  assets: BotanicalAssets,
  style: FlowerStyle,
  angle: number,
  index: number,
  radius: number,
): void {
  const x = Math.sin(angle) * radius;
  const z = Math.cos(angle) * radius;

  if (style === "lotus_jasmine") {
    if (index % 2 === 0) {
      const lotus = buildLotusBloom(assets, 0.94);
      lotus.position.set(x, 0.34, z);
      lotus.rotation.y = angle;
      lotus.rotation.x = 0.2;
      parent.add(lotus);
    } else {
      const bud = buildLotusBud(assets);
      bud.position.set(x * 0.94, 0.35, z * 0.94);
      bud.rotation.y = angle;
      bud.rotation.x = 0.32;
      parent.add(bud);
    }
    // Delicate scalloped jasmine garland pearls along the rim
    for (let j = -1; j <= 1; j++) {
      const ja = angle + j * 0.14;
      const jas = buildJasmineFlower(assets);
      jas.position.set(
        Math.sin(ja) * (radius + 0.17),
        0.27 + (j === 0 ? 0.03 : 0),
        Math.cos(ja) * (radius + 0.17),
      );
      jas.rotation.y = ja;
      jas.rotation.x = 0.55;
      parent.add(jas);
    }
  } else if (style === "marigold_globe") {
    if (index % 2 === 0) {
      const marigold = buildMarigoldRosette(assets, 1.05);
      marigold.position.set(x, 0.34, z);
      marigold.rotation.y = angle;
      marigold.rotation.x = 0.22;
      parent.add(marigold);
    } else {
      const globe = buildGlobeAmaranth(assets);
      globe.position.set(x * 0.98, 0.35, z * 0.98);
      globe.rotation.y = angle;
      globe.rotation.x = 0.25;
      parent.add(globe);
    }
    const jas = buildJasmineFlower(assets);
    jas.position.set(
      Math.sin(angle + 0.12) * (radius + 0.16),
      0.27,
      Math.cos(angle + 0.12) * (radius + 0.16),
    );
    jas.rotation.x = 0.5;
    parent.add(jas);
  } else if (style === "orchid_violet") {
    if (index % 2 === 0) {
      const orchid = buildThaiOrchid(assets);
      orchid.scale.setScalar(1.12);
      orchid.position.set(x, 0.36, z);
      orchid.rotation.y = angle;
      orchid.rotation.x = 0.32;
      parent.add(orchid);
    } else {
      const bud = buildLotusBud(assets);
      bud.scale.setScalar(0.95);
      bud.position.set(x * 0.95, 0.35, z * 0.95);
      bud.rotation.y = angle;
      bud.rotation.x = 0.28;
      parent.add(bud);
    }
    // Radiant orchid-rose pearls along the rim
    const bead = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 10, 10),
      index % 2 === 0 ? assets.roseMetalMat : assets.jasmineMat,
    );
    bead.position.set(
      Math.sin(angle + 0.12) * (radius + 0.16),
      0.29,
      Math.cos(angle + 0.12) * (radius + 0.16),
    );
    parent.add(bead);
  } else {
    // rose_crimson: velvety ruby-crimson spiral roses with gilded gold leaf sprigs & pearls
    const rose = buildSpiralRose(assets, index % 2 === 0 ? 1.08 : 0.88);
    rose.position.set(x, 0.34, z);
    rose.rotation.y = angle;
    rose.rotation.x = 0.22;
    parent.add(rose);

    // Gilded gold leaf sprig & pearl highlight on outer rim
    const goldLeaf = new THREE.Mesh(assets.smallLeaf, assets.goldMetalMat);
    goldLeaf.position.set(
      Math.sin(angle + 0.15) * (radius + 0.15),
      0.28,
      Math.cos(angle + 0.15) * (radius + 0.15),
    );
    goldLeaf.rotation.order = "YXZ";
    goldLeaf.rotation.y = angle + 0.2;
    goldLeaf.rotation.x = 1.15;
    parent.add(goldLeaf);

    const pearl = new THREE.Mesh(
      new THREE.SphereGeometry(0.034, 8, 8),
      assets.goldMetalMat,
    );
    pearl.position.set(
      Math.sin(angle - 0.14) * (radius + 0.16),
      0.29,
      Math.cos(angle - 0.14) * (radius + 0.16),
    );
    parent.add(pearl);
  }
}

function addCandleAndIncense(
  parent: THREE.Group,
  assets: BotanicalAssets,
  candleStyle: CandleStyle,
  offsetX: number,
  offsetZ: number,
  includeIncense: boolean,
  withPointLight: boolean,
  flames: THREE.Object3D[],
  candleLights: THREE.PointLight[],
  smokeParticles: KrathongBuildResult["smokeParticles"],
): void {
  const theme = CANDLE_THEME_VISUALS[candleStyle] ?? CANDLE_THEME_VISUALS.warm_gold;
  const candleGroup = new THREE.Group();
  candleGroup.position.set(offsetX, 0.34, offsetZ);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: theme.waxColor,
    emissive: theme.waxEmissive,
    emissiveIntensity: 0.38,
    roughness: 0.26,
    metalness: candleStyle === "rose_gold" || candleStyle === "warm_gold" ? 0.22 : 0.1,
    clearcoat: 0.55,
  });

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.078, 0.62, 16),
    bodyMat,
  );
  shaft.position.y = 0.31;
  candleGroup.add(shaft);

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.065, 0.015, 8, 16),
    bodyMat,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.61;
  candleGroup.add(collar);

  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.055, 6),
    new THREE.MeshBasicMaterial({ color: "#1c130d" }),
  );
  wick.position.y = 0.64;
  candleGroup.add(wick);

  const flameHolder = new THREE.Group();
  flameHolder.position.y = 0.66;

  // Tinted outer flame aura matching the chosen candle theme
  const outerFlame = new THREE.Mesh(
    assets.flameOuter,
    new THREE.MeshBasicMaterial({
      color: theme.flameOuter,
      transparent: true,
      opacity: 0.92,
    }),
  );
  const innerFlame = new THREE.Mesh(
    assets.flameInner,
    new THREE.MeshBasicMaterial({ color: theme.flameInner }),
  );
  const glowOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 12),
    new THREE.MeshBasicMaterial({
      color: theme.lightColor,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glowOrb.position.y = 0.13;
  flameHolder.add(outerFlame, innerFlame, glowOrb);
  candleGroup.add(flameHolder);
  flames.push(flameHolder);

  if (withPointLight) {
    const pt = new THREE.PointLight(theme.lightColor, 4.8, 9.0, 1.4);
    pt.position.set(offsetX, 1.18, offsetZ);
    parent.add(pt);
    candleLights.push(pt);
  }

  parent.add(candleGroup);

  if (includeIncense) {
    const stickMat = new THREE.MeshStandardMaterial({
      color: "#b48a56",
      roughness: 0.75,
    });
    const emberMat = new THREE.MeshBasicMaterial({ color: "#fb923c" });
    const smokeMat = new THREE.MeshBasicMaterial({
      color: "#e2e8f0",
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const smokeGeom = new THREE.SphereGeometry(0.028, 7, 7);

    [-0.16, 0, 0.16].forEach((tilt, idx) => {
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.012, 0.92, 8),
        stickMat,
      );
      stick.position.set(offsetX + tilt * 0.55, 0.72, offsetZ - 0.12);
      stick.rotation.z = -tilt * 0.65;
      stick.rotation.x = -0.08;
      parent.add(stick);

      const tipX = offsetX + tilt * 0.85;
      const tipZ = offsetZ - 0.16;
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 8, 8),
        emberMat,
      );
      ember.position.set(tipX, 1.17, tipZ);
      parent.add(ember);

      for (let s = 0; s < 4; s++) {
        const puff = new THREE.Mesh(smokeGeom, smokeMat.clone());
        puff.position.set(tipX, 1.2 + s * 0.14, tipZ);
        parent.add(puff);
        smokeParticles.push({
          mesh: puff,
          phase: idx * 1.1 + s * 0.75,
          baseX: tipX,
          baseZ: tipZ,
        });
      }
    });
  }
}

function addCoupleAccent(
  parent: THREE.Group,
  assets: BotanicalAssets,
  style: AccentStyle,
  angleOffset: number,
): void {
  const holder = new THREE.Group();
  holder.rotation.y = angleOffset;

  if (style === "dok_rak_heart") {
    // 3D heart arch crafted from pearlescent crown-flower blossoms (หัวใจดอกรัก)
    const heartGroup = new THREE.Group();
    heartGroup.position.set(0, 0.58, 0.74);
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3) * 0.0165;
      const hy =
        (13 * Math.cos(t) -
          5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) -
          Math.cos(4 * t)) *
        0.0165;
      const bud = new THREE.Mesh(
        new THREE.SphereGeometry(0.034, 8, 8),
        i % 2 === 0 ? assets.jasmineMat : assets.roseMetalMat,
      );
      bud.position.set(hx, hy, 0);
      heartGroup.add(bud);
    }
    holder.add(heartGroup);
  } else if (style === "mini_garland") {
    // Authentic Thai Phuang Malai mini garland (พวงมาลัยจิ๋ว) draped on the front rim with 3 gold tassels
    const malaiPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      const a = -0.68 + u * 1.36;
      const sag = Math.cos((u - 0.5) * Math.PI) * 0.14;
      const r = 1.07;
      malaiPts.push(new THREE.Vector3(Math.sin(a) * r, 0.44 - sag, Math.cos(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(malaiPts);
    const bodyTube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 24, 0.044, 10, false),
      assets.jasmineMat,
    );
    holder.add(bodyTube);

    // Rose-pink flower collars & golden rings along the garland
    for (const u of [0.12, 0.3, 0.5, 0.7, 0.88]) {
      const pos = curve.getPoint(u);
      const collar = new THREE.Mesh(
        new THREE.SphereGeometry(0.056, 10, 10),
        u === 0.5 ? assets.goldMetalMat : assets.roseMetalMat,
      );
      collar.position.copy(pos);
      holder.add(collar);
    }
    // 3 dangling golden Ubha tassel strands at center bottom
    for (const dx of [-0.075, 0, 0.075]) {
      const strand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.022, dx === 0 ? 0.2 : 0.15, 8),
        assets.goldMetalMat,
      );
      strand.position.set(dx, 0.21 - (dx === 0 ? 0.02 : 0), 1.09);
      holder.add(strand);
      const drop = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 8, 8),
        assets.roseMetalMat,
      );
      drop.position.set(dx, 0.11 - (dx === 0 ? 0.025 : 0), 1.09);
      holder.add(drop);
    }
  } else if (style === "moon_star") {
    // Golden crescent moon + flanking 3D stars floating gracefully
    const moon = new THREE.Mesh(assets.crescentMoon, assets.goldMetalMat);
    moon.position.set(0, 0.64, 0.74);
    moon.rotation.z = -0.25;
    holder.add(moon);

    const starL = new THREE.Mesh(assets.star, assets.goldMetalMat);
    starL.position.set(-0.25, 0.58, 0.7);
    starL.scale.setScalar(0.88);
    const starR = new THREE.Mesh(assets.star, assets.goldMetalMat);
    starR.position.set(0.25, 0.7, 0.7);
    starR.scale.setScalar(0.75);
    holder.add(starL, starR);
  } else {
    // golden_swan: Twin sculpted golden Thai swans (หงส์คู่ทอง) arching face-to-face into a heart!
    const swanPair = new THREE.Group();
    swanPair.position.set(0, 0.36, 0.74);
    for (const dir of [-1, 1]) {
      const neckCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(dir * 0.22, 0.02, -0.02),
        new THREE.Vector3(dir * 0.26, 0.18, 0.02),
        new THREE.Vector3(dir * 0.18, 0.38, 0.03),
        new THREE.Vector3(dir * 0.06, 0.41, 0.03),
        new THREE.Vector3(dir * 0.02, 0.33, 0.03),
      ]);
      const neck = new THREE.Mesh(
        new THREE.TubeGeometry(neckCurve, 22, 0.026, 8, false),
        assets.goldMetalMat,
      );
      swanPair.add(neck);

      // Sculpted swan body & uplifted wing
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 12, 10),
        assets.goldMetalMat,
      );
      body.scale.set(1.25, 0.78, 0.72);
      body.position.set(dir * 0.24, 0.05, -0.03);
      swanPair.add(body);

      const wing = new THREE.Mesh(assets.smallLeaf, assets.goldMetalMat);
      wing.position.set(dir * 0.26, 0.08, -0.04);
      wing.rotation.set(0.35, dir * -0.5, dir * -0.65);
      wing.scale.setScalar(0.95);
      swanPair.add(wing);

      // Head & tiny crown jewel
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.034, 10, 10),
        assets.goldMetalMat,
      );
      head.position.set(dir * 0.045, 0.36, 0.03);
      swanPair.add(head);
    }
    // Tiny glowing pearl heart jewel where the twin beaks meet
    const kissGem = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 10, 10),
      assets.roseMetalMat,
    );
    kissGem.position.set(0, 0.31, 0.04);
    swanPair.add(kissGem);
    holder.add(swanPair);
  }

  parent.add(holder);
}

function buildKrathongMesh(
  assets: BotanicalAssets,
  mode: "single" | "fused",
  primary: KrathongDesign,
  secondary?: KrathongDesign,
): KrathongBuildResult {
  const group = new THREE.Group();
  const flames: THREE.Object3D[] = [];
  const candleLights: THREE.PointLight[] = [];
  const smokeParticles: KrathongBuildResult["smokeParticles"] = [];

  // Core sculpted base disc matching the chosen theme
  const coreColor =
    primary.baseStyle === "golden_leaf"
      ? "#92400e"
      : primary.baseStyle === "lotus_petal"
        ? "#831843"
        : primary.baseStyle === "moon_crystal"
          ? "#1e3a8a"
          : "#165c34";
  const coreMat = new THREE.MeshStandardMaterial({
    color: coreColor,
    emissive: coreColor,
    emissiveIntensity: 0.16,
    roughness: 0.52,
    metalness: primary.baseStyle === "golden_leaf" ? 0.38 : 0.12,
  });
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.96, 0.88, 0.28, 28),
    coreMat,
  );
  core.position.y = 0.14;
  group.add(core);

  // Subtle green lotus pad rim beneath lotus base
  if (
    primary.baseStyle === "lotus_petal" ||
    (mode === "fused" && secondary?.baseStyle === "lotus_petal")
  ) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.36, 1.32, 0.035, 32),
      new THREE.MeshStandardMaterial({
        color: "#1b6b3e",
        emissive: "#0f3d22",
        emissiveIntensity: 0.2,
        roughness: 0.45,
      }),
    );
    pad.position.y = 0.02;
    group.add(pad);
  }

  // Outer & Inner sculpted base petal crowns (14 outer + 12 inner)
  const outerCount = 14;
  for (let i = 0; i < outerCount; i++) {
    const angle = (i / outerCount) * Math.PI * 2;
    const style =
      mode === "fused" && secondary
        ? i % 2 === 0
          ? primary.baseStyle
          : secondary.baseStyle
        : primary.baseStyle;
    addBaseElement(group, assets, style, angle, 0.96, false);
  }

  const innerCount = 12;
  for (let i = 0; i < innerCount; i++) {
    const angle = ((i + 0.5) / innerCount) * Math.PI * 2;
    const style =
      mode === "fused" && secondary
        ? i % 2 === 0
          ? primary.baseStyle
          : secondary.baseStyle
        : primary.baseStyle;
    addBaseElement(group, assets, style, angle, 0.82, true);
  }

  // Shimmering gold trim ring on lotus_petal, golden_leaf, or fused krathong
  if (
    mode === "fused" ||
    primary.baseStyle === "golden_leaf" ||
    primary.baseStyle === "lotus_petal"
  ) {
    const braid = new THREE.Mesh(
      new THREE.TorusGeometry(0.97, 0.036, 10, 40),
      assets.goldMetalMat,
    );
    braid.rotation.x = Math.PI / 2;
    braid.position.y = 0.26;
    group.add(braid);
  }

  // Luminous icy-silver crystal halo ring on moon_crystal
  if (
    primary.baseStyle === "moon_crystal" ||
    (mode === "fused" && secondary?.baseStyle === "moon_crystal")
  ) {
    const crystalRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.01, 0.028, 10, 40),
      new THREE.MeshStandardMaterial({
        color: "#e0f2fe",
        emissive: "#38bdf8",
        emissiveIntensity: 0.72,
        roughness: 0.15,
        metalness: 0.45,
      }),
    );
    crystalRim.rotation.x = Math.PI / 2;
    crystalRim.position.y = 0.24;
    group.add(crystalRim);
  }

  // Lush botanical flower crown (12 rich flower clusters around the top rim)
  const flowerCount = 12;
  for (let i = 0; i < flowerCount; i++) {
    const angle = (i / flowerCount) * Math.PI * 2;
    const style =
      mode === "fused" && secondary
        ? i % 2 === 0
          ? primary.flowerStyle
          : secondary.flowerStyle
        : primary.flowerStyle;
    addFlowerCluster(group, assets, style, angle, i, 0.66);
  }

  // Inner floral moss/petal bed
  const bedColor =
    primary.baseStyle === "moon_crystal"
      ? "#1e3a8a"
      : primary.baseStyle === "golden_leaf"
        ? "#78350f"
        : "#1e6e3e";
  const bed = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.72, 0.08, 24),
    new THREE.MeshStandardMaterial({
      color: bedColor,
      emissive: bedColor,
      emissiveIntensity: 0.14,
      roughness: 0.65,
    }),
  );
  bed.position.y = 0.3;
  group.add(bed);

  // Candles & incense
  if (mode === "fused" && secondary) {
    // Twin radiant couple candles standing side-by-side in harmony — BOTH cast their chosen theme glow!
    addCandleAndIncense(
      group,
      assets,
      primary.candleStyle,
      -0.13,
      0.03,
      true,
      true,
      flames,
      candleLights,
      smokeParticles,
    );
    addCandleAndIncense(
      group,
      assets,
      secondary.candleStyle,
      0.13,
      0.03,
      false,
      true,
      flames,
      candleLights,
      smokeParticles,
    );
    // Both couple accents gracing front and back of the fused krathong
    addCoupleAccent(group, assets, primary.accentStyle, 0);
    addCoupleAccent(group, assets, secondary.accentStyle, Math.PI);
  } else {
    addCandleAndIncense(
      group,
      assets,
      primary.candleStyle,
      0,
      0.02,
      true,
      true,
      flames,
      candleLights,
      smokeParticles,
    );
    addCoupleAccent(group, assets, primary.accentStyle, 0);
  }

  // Generous hero scale so every botanical detail shines
  group.scale.setScalar(1.16);
  return { group, flames, candleLights, smokeParticles };
}

function disposeGroupResources(root: THREE.Object3D, assets: BotanicalAssets): void {
  const sharedGeoms = new Set<THREE.BufferGeometry>([
    assets.bananaLeaf,
    assets.goldenLeaf,
    assets.crystalPetal,
    assets.lotusBaseOuter,
    assets.lotusBaseInner,
    assets.lotusFlowerOuter,
    assets.lotusFlowerMid,
    assets.lotusFlowerInner,
    assets.lotusBudPetal,
    assets.marigoldPetalOuter,
    assets.marigoldPetalInner,
    assets.globeBract,
    assets.rosePetalOuter,
    assets.rosePetalInner,
    assets.orchidPetal,
    assets.orchidLip,
    assets.smallLeaf,
    assets.jasminePetal,
    assets.crescentMoon,
    assets.star,
    assets.flameOuter,
    assets.flameInner,
  ]);
  const sharedMats = new Set<THREE.Material>([
    assets.vertexMat,
    assets.vertexMatGlossy,
    assets.goldLeafMat,
    assets.crystalMat,
    assets.goldMetalMat,
    assets.roseMetalMat,
    assets.stamenMat,
    assets.jasmineMat,
  ]);

  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      if (obj.geometry && !sharedGeoms.has(obj.geometry)) {
        obj.geometry.dispose();
      }
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => {
          if (!sharedMats.has(m)) m.dispose();
        });
      } else if (obj.material && !sharedMats.has(obj.material)) {
        obj.material.dispose();
      }
    }
  });
}

// ============================================================================
// CUSTOM GLSL CHAO PHRAYA MOONLIT WATER SHADER
// ============================================================================

const WATER_VERTEX = `
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WATER_FRAGMENT = `
uniform float uTime;
uniform vec3 uGlowPos1;
uniform vec3 uGlowPos2;
uniform vec3 uGlowColor1;
uniform vec3 uGlowColor2;
uniform float uGlow1Strength;
uniform float uGlow2Strength;
uniform float uRippleIntensity;
uniform float uFlash;
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vec2 p = vWorldPos.xz;
  float distOrigin = length(p);

  // Flowing Chao Phraya dark indigo river ripples
  float wave1 = sin(p.x * 2.4 + uTime * 1.15) * cos(p.y * 2.8 - uTime * 0.85);
  float wave2 = sin(p.x * 5.2 - p.y * 3.9 + uTime * 1.6) * 0.5;
  float shimmer = (wave1 + wave2) * 0.5;

  // Base deep midnight indigo river color
  vec3 waterCol = vec3(0.038, 0.082, 0.21) + vec3(0.022, 0.042, 0.088) * shimmer;

  // Dynamic themed candlelight reflection under Krathong 1 (or Fused Krathong)
  float d1 = length(p - uGlowPos1.xz);
  float glow1 = exp(-d1 * d1 * 0.31) * uGlow1Strength;
  float ring1 = sin(d1 * 7.5 - uTime * 3.2) * exp(-d1 * 0.7) * 0.5 + 0.5;
  waterCol += uGlowColor1 * glow1 * (0.8 + 0.3 * shimmer);
  waterCol += mix(uGlowColor1, vec3(1.0), 0.35) * ring1 * exp(-d1 * 0.55) * 0.24 * uRippleIntensity * uGlow1Strength;

  // Dynamic themed candlelight reflection under Krathong 2 (during building)
  float d2 = length(p - uGlowPos2.xz);
  float glow2 = exp(-d2 * d2 * 0.31) * uGlow2Strength;
  float ring2 = sin(d2 * 7.5 - uTime * 3.0 + 1.2) * exp(-d2 * 0.7) * 0.5 + 0.5;
  waterCol += uGlowColor2 * glow2 * (0.8 + 0.3 * shimmer);
  waterCol += mix(uGlowColor2, vec3(1.0), 0.35) * ring2 * exp(-d2 * 0.55) * 0.22 * uRippleIntensity * uGlow2Strength;

  // Shimmering moonlight river path stretching toward the far Chao Phraya horizon
  float moonTrack = exp(-pow((p.x - 1.3) * 0.42, 2.0)) * smoothstep(2.0, -18.0, p.y);
  float moonWave = pow(max(0.0, sin(p.y * 4.5 + uTime * 1.4 + sin(p.x * 2.0)) * 0.5 + 0.5), 3.0);
  waterCol += vec3(1.0, 0.94, 0.76) * moonTrack * (0.18 + 0.32 * moonWave);

  // Wat Arun & Rama VIII golden riverside bokeh streaks
  float watGlow = exp(-pow((p.x + 5.8) * 0.35, 2.0)) * smoothstep(0.0, -18.0, p.y);
  waterCol += vec3(1.0, 0.72, 0.28) * watGlow * (0.14 + 0.16 * moonWave);

  // Brief warm flash from the fusion burst or fireworks
  waterCol += vec3(1.0, 0.88, 0.56) * uFlash * 0.55;

  // Smooth fade into the panoramic Chao Phraya backdrop at the outer edges
  float edgeFade = 1.0 - smoothstep(12.0, 26.0, distOrigin);
  float backFade = smoothstep(-28.0, -8.5, p.y);
  float alpha = clamp(edgeFade * backFade * 0.92, 0.0, 0.95);

  gl_FragColor = vec4(waterCol, alpha);
}
`;

function createMoonlightEnvironment(
  renderer: THREE.WebGLRenderer,
): THREE.Texture | null {
  try {
    const envCanvas = document.createElement("canvas");
    envCanvas.width = 256;
    envCanvas.height = 128;
    const ctx = envCanvas.getContext("2d");
    if (!ctx) return null;

    // Deep indigo night sky -> luminous lavender-blue horizon -> warm riverside glow -> moonlit river
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 128);
    skyGrad.addColorStop(0.0, "#1d2b64");
    skyGrad.addColorStop(0.32, "#35498e");
    skyGrad.addColorStop(0.5, "#78629e");
    skyGrad.addColorStop(0.58, "#f5c26b");
    skyGrad.addColorStop(0.75, "#233468");
    skyGrad.addColorStop(1.0, "#0f1938");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 256, 128);

    // Bright full moon specular hotspot (gives petals, gold trims & crystal crisp specular glints!)
    const moonGrad = ctx.createRadialGradient(184, 34, 2, 184, 34, 38);
    moonGrad.addColorStop(0, "#ffffff");
    moonGrad.addColorStop(0.35, "#fef3c7");
    moonGrad.addColorStop(1, "rgba(254, 243, 199, 0)");
    ctx.fillStyle = moonGrad;
    ctx.fillRect(140, 0, 90, 76);

    // Warm candlelight front-fill specular reflection hotspot
    const candleGrad = ctx.createRadialGradient(78, 66, 2, 78, 66, 42);
    candleGrad.addColorStop(0, "#fff2c6");
    candleGrad.addColorStop(0.45, "#fbbf24");
    candleGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.fillStyle = candleGrad;
    ctx.fillRect(30, 24, 96, 86);

    const equirect = new THREE.CanvasTexture(envCanvas);
    equirect.mapping = THREE.EquirectangularReflectionMapping;
    equirect.colorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envRT = pmrem.fromEquirectangular(equirect);
    equirect.dispose();
    pmrem.dispose();
    return envRT.texture;
  } catch {
    return null;
  }
}

// ============================================================================
// MAIN THREE.JS COMPONENT
// ============================================================================

export function Krathong3D({
  p1Choice,
  p2Choice,
  fusionState,
  fusionTriggerKey,
  focusMode,
  activeSlot,
  releasedAtMs = null,
  someoneHolding = false,
  skyFlashKey = 0,
  drift = null,
  onUserOrbit,
  onFusionSignal,
  onDriftSteer,
  onSampleWish,
}: Krathong3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  // Keep reactive props available inside the 60fps Three.js render loop without tearing down WebGL!
  const stateRef = useRef({
    p1Choice,
    p2Choice,
    fusionState,
    focusMode,
    activeSlot,
    releasedAtMs,
    someoneHolding,
    drift,
  });
  stateRef.current = {
    p1Choice,
    p2Choice,
    fusionState,
    focusMode,
    activeSlot,
    releasedAtMs,
    someoneHolding,
    drift,
  };

  const onUserOrbitRef = useRef(onUserOrbit);
  onUserOrbitRef.current = onUserOrbit;
  const onFusionSignalRef = useRef(onFusionSignal);
  onFusionSignalRef.current = onFusionSignal;
  const onDriftSteerRef = useRef(onDriftSteer);
  onDriftSteerRef.current = onDriftSteer;
  const onSampleWishRef = useRef(onSampleWish);
  onSampleWishRef.current = onSampleWish;

  const rebuildSignalRef = useRef<(() => void) | null>(null);
  const startFusionAnimRef = useRef<(() => void) | null>(null);
  const flashBumpRef = useRef<(() => void) | null>(null);
  const releaseStartLocalMsRef = useRef<number | null>(null);

  const designKey = JSON.stringify({ p1Choice, p2Choice, fusionState });

  useEffect(() => {
    rebuildSignalRef.current?.();
  }, [designKey]);

  useEffect(() => {
    if (fusionTriggerKey > 0) {
      startFusionAnimRef.current?.();
    }
  }, [fusionTriggerKey]);

  useEffect(() => {
    if (skyFlashKey > 0) {
      flashBumpRef.current?.();
    }
  }, [skyFlashKey]);

  useEffect(() => {
    if (fusionState === "released") {
      if (releaseStartLocalMsRef.current === null) {
        releaseStartLocalMsRef.current = performance.now();
      }
    } else {
      releaseStartLocalMsRef.current = null;
    }
  }, [fusionState]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.36;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 260);
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const envTexture = createMoonlightEnvironment(renderer);
    if (envTexture) {
      scene.environment = envTexture;
    }
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 110);

    // Calibrated vibrant lighting: sky hemisphere fill, full-moon key, warm front candlelight bounce & cool silver-indigo rim
    const hemiLight = new THREE.HemisphereLight("#dcebff", "#2a3c6e", 1.38);
    scene.add(hemiLight);

    const moonDirLight = new THREE.DirectionalLight("#fff6d6", 1.55);
    moonDirLight.position.set(5, 9, -5);
    scene.add(moonDirLight);

    const warmFrontFill = new THREE.DirectionalLight("#ffdca8", 1.08);
    warmFrontFill.position.set(-2.5, 4.5, 6.5);
    scene.add(warmFrontFill);

    const rimLight = new THREE.DirectionalLight("#93c5fd", 0.95);
    rimLight.position.set(-5.5, 3.8, -5.5);
    scene.add(rimLight);

    const flashLight = new THREE.PointLight("#fff2cc", 0, 18, 1.2);
    flashLight.position.set(0, 1.8, 1.5);
    scene.add(flashLight);

    // Chao Phraya Moonlit Water Plane
    const waterUniforms = {
      uTime: { value: 0 },
      uGlowPos1: { value: new THREE.Vector3(-1.42, 0, 0) },
      uGlowPos2: { value: new THREE.Vector3(1.42, 0, 0) },
      uGlowColor1: { value: new THREE.Color("#ffb938") },
      uGlowColor2: { value: new THREE.Color("#ff6b9d") },
      uGlow1Strength: { value: 1.0 },
      uGlow2Strength: { value: 1.0 },
      uRippleIntensity: { value: 1.0 },
      uFlash: { value: 0.0 },
    };
    const waterMat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      uniforms: waterUniforms,
      transparent: true,
      depthWrite: false,
    });
    const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(58, 58), waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = 0;
    scene.add(waterMesh);

    const assets = createBotanicalAssets();

    // Containers for Krathong 1, Krathong 2, and Fused Krathong
    const k1Pivot = new THREE.Group();
    const k2Pivot = new THREE.Group();
    const fusedPivot = new THREE.Group();
    scene.add(k1Pivot, k2Pivot, fusedPivot);

    const driftGroup = new THREE.Group();
    driftGroup.name = "drift-course";
    scene.add(driftGroup);
    let driftMeshKey = "";
    const driftGeometries: THREE.BufferGeometry[] = [];
    const driftMaterials: THREE.Material[] = [];

    const npcGroup = new THREE.Group();
    npcGroup.name = "sample-wishes";
    const npcGeometries: THREE.BufferGeometry[] = [];
    const npcMaterials: THREE.Material[] = [];
    const riverBoatCount = 10;
    for (let index = 0; index < riverBoatCount; index += 1) {
      const wish = SAMPLE_RIVER_WISHES[index % SAMPLE_RIVER_WISHES.length];
      const holder = new THREE.Group();
      holder.userData.wish = { from: wish.from, text: wish.text };
      holder.userData.wishId = wish.id;
      const leafGeom = new THREE.CircleGeometry(0.46, 20);
      const leafMat = new THREE.MeshStandardMaterial({
        color: "#1f8a4d",
        roughness: 0.5,
        side: THREE.DoubleSide,
      });
      const leaf = new THREE.Mesh(leafGeom, leafMat);
      leaf.rotation.x = -Math.PI / 2;
      leaf.position.y = 0.05;
      const ringGeom = new THREE.TorusGeometry(0.34, 0.05, 8, 22);
      const ringMat = new THREE.MeshStandardMaterial({
        color: wish.tint,
        emissive: wish.tint,
        emissiveIntensity: 0.35,
        roughness: 0.4,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.09;
      holder.userData.ringMat = ringMat;
      const candleGeom = new THREE.CylinderGeometry(0.055, 0.055, 0.18, 10);
      const candleMat = new THREE.MeshStandardMaterial({
        color: "#fff7d6",
        emissive: "#f59e0b",
        emissiveIntensity: 0.65,
      });
      const candle = new THREE.Mesh(candleGeom, candleMat);
      candle.position.y = 0.2;
      const flameGeom = new THREE.SphereGeometry(0.05, 10, 8);
      const flameMat = new THREE.MeshBasicMaterial({ color: "#fff4c2" });
      const flame = new THREE.Mesh(flameGeom, flameMat);
      flame.position.y = 0.32;
      holder.add(leaf, ring, candle, flame);
      npcGroup.add(holder);
      npcGeometries.push(leafGeom, ringGeom, candleGeom, flameGeom);
      npcMaterials.push(leafMat, ringMat, candleMat, flameMat);
    }
    scene.add(npcGroup);
    container.dataset.sampleWishes = String(SAMPLE_RIVER_WISHES.length);

    let k1Build: KrathongBuildResult | null = null;
    let k2Build: KrathongBuildResult | null = null;
    let fusedBuild: KrathongBuildResult | null = null;

    // 3D Anime Fusion VFX Objects
    const fusionVfxGroup = new THREE.Group();
    fusionVfxGroup.visible = false;
    scene.add(fusionVfxGroup);

    const aura1Mat = new THREE.MeshBasicMaterial({
      color: "#fbbf24",
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const aura1Ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.42, 0.055, 12, 48),
      aura1Mat,
    );
    aura1Ring.rotation.x = Math.PI / 2;
    fusionVfxGroup.add(aura1Ring);

    const aura2Mat = new THREE.MeshBasicMaterial({
      color: "#f472b6",
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const aura2Ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.42, 0.055, 12, 48),
      aura2Mat,
    );
    aura2Ring.rotation.x = Math.PI / 2;
    fusionVfxGroup.add(aura2Ring);

    // Blazing white-gold 3D collision core sphere
    const coreMat = new THREE.MeshBasicMaterial({
      color: "#fffbeb",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const coreSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 24, 24),
      coreMat,
    );
    coreSphere.position.set(0, 0.88, 0);
    fusionVfxGroup.add(coreSphere);

    // Two tilted anime shockwave impact rings
    const shock1Mat = new THREE.MeshBasicMaterial({
      color: "#fde047",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const shock1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.065, 12, 56),
      shock1Mat,
    );
    shock1.position.set(0, 0.88, 0);
    shock1.rotation.set(Math.PI / 2.2, 0.25, 0);
    fusionVfxGroup.add(shock1);

    const shock2Mat = new THREE.MeshBasicMaterial({
      color: "#f9a8d4",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const shock2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.05, 12, 56),
      shock2Mat,
    );
    shock2.position.set(0, 0.88, 0);
    shock2.rotation.set(Math.PI / 1.8, -0.45, 0.3);
    fusionVfxGroup.add(shock2);

    // 3D Rotating Starburst God-Ray Beams
    const raysGroup = new THREE.Group();
    raysGroup.position.set(0, 0.88, 0);
    const rayMat = new THREE.MeshBasicMaterial({
      color: "#fef08a",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const rayGeom = new THREE.ConeGeometry(0.18, 4.6, 6);
    for (let i = 0; i < 12; i++) {
      const beam = new THREE.Mesh(rayGeom, rayMat);
      const a = (i / 12) * Math.PI * 2;
      beam.rotation.z = a;
      beam.rotation.y = (i % 3) * 0.45;
      raysGroup.add(beam);
    }
    fusionVfxGroup.add(raysGroup);

    // 180-particle 3D Fusion Explosion / Swirl Petals & Stardust
    const burstCount = 180;
    const burstPositions = new Float32Array(burstCount * 3);
    const burstColors = new Float32Array(burstCount * 3);
    const burstDirs: THREE.Vector3[] = [];
    const burstSeeds: number[] = [];
    const palette3 = [
      new THREE.Color("#fef08a"),
      new THREE.Color("#fbbf24"),
      new THREE.Color("#f9a8d4"),
      new THREE.Color("#ffffff"),
    ];
    for (let i = 0; i < burstCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      burstDirs.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi) * 0.72 + 0.25,
          Math.sin(phi) * Math.sin(theta),
        ).normalize(),
      );
      burstSeeds.push(0.6 + Math.random() * 1.4);
      const col = palette3[i % palette3.length]!;
      burstColors[i * 3] = col.r;
      burstColors[i * 3 + 1] = col.g;
      burstColors[i * 3 + 2] = col.b;
    }
    const burstGeom = new THREE.BufferGeometry();
    burstGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(burstPositions, 3),
    );
    burstGeom.setAttribute("color", new THREE.BufferAttribute(burstColors, 3));
    const burstMat = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const burstPoints = new THREE.Points(burstGeom, burstMat);
    fusionVfxGroup.add(burstPoints);

    // Ambient 3D Golden Fireflies hovering over the Chao Phraya water
    const ffCount = 42;
    const ffBase: { x: number; y: number; z: number; sp: number; ph: number }[] =
      [];
    const ffPos = new Float32Array(ffCount * 3);
    for (let i = 0; i < ffCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1.4 + Math.random() * 4.5;
      ffBase.push({
        x: Math.cos(angle) * r,
        y: 0.35 + Math.random() * 2.1,
        z: Math.sin(angle) * r - 0.5,
        sp: 0.5 + Math.random() * 0.9,
        ph: Math.random() * Math.PI * 2,
      });
    }
    const ffGeom = new THREE.BufferGeometry();
    ffGeom.setAttribute("position", new THREE.BufferAttribute(ffPos, 3));
    const ffMat = new THREE.PointsMaterial({
      color: "#fde68a",
      size: 0.085,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ffPoints = new THREE.Points(ffGeom, ffMat);
    scene.add(ffPoints);

    // Rebuild krathongs cleanly whenever designs change
    const rebuildKrathongs = () => {
      if (k1Build) {
        k1Pivot.remove(k1Build.group);
        disposeGroupResources(k1Build.group, assets);
      }
      if (k2Build) {
        k2Pivot.remove(k2Build.group);
        disposeGroupResources(k2Build.group, assets);
      }
      if (fusedBuild) {
        fusedPivot.remove(fusedBuild.group);
        disposeGroupResources(fusedBuild.group, assets);
      }

      const cur = stateRef.current;
      k1Build = buildKrathongMesh(assets, "single", cur.p1Choice);
      k2Build = buildKrathongMesh(assets, "single", cur.p2Choice);
      fusedBuild = buildKrathongMesh(
        assets,
        "fused",
        cur.p1Choice,
        cur.p2Choice,
      );

      k1Pivot.add(k1Build.group);
      k2Pivot.add(k2Build.group);
      fusedPivot.add(fusedBuild.group);

      // Sync water reflection & fusion aura colors to both partners' chosen candle themes
      const c1 = new THREE.Color(
        (CANDLE_THEME_VISUALS[cur.p1Choice.candleStyle] ?? CANDLE_THEME_VISUALS.warm_gold)
          .waterGlowHex,
      );
      const c2 = new THREE.Color(
        (CANDLE_THEME_VISUALS[cur.p2Choice.candleStyle] ?? CANDLE_THEME_VISUALS.rose_gold)
          .waterGlowHex,
      );
      const a1 = new THREE.Color(
        (CANDLE_THEME_VISUALS[cur.p1Choice.candleStyle] ?? CANDLE_THEME_VISUALS.warm_gold)
          .auraHex,
      );
      const a2 = new THREE.Color(
        (CANDLE_THEME_VISUALS[cur.p2Choice.candleStyle] ?? CANDLE_THEME_VISUALS.rose_gold)
          .auraHex,
      );
      aura1Mat.color.copy(a1);
      aura2Mat.color.copy(a2);

      if (cur.fusionState === "fused" || cur.fusionState === "released") {
        // Harmonize both partners' candle glows into a radiant couple reflection on the river
        waterUniforms.uGlowColor1.value.copy(c1).lerp(c2, 0.5);
        waterUniforms.uGlowColor2.value.copy(c2);
      } else {
        waterUniforms.uGlowColor1.value.copy(c1);
        waterUniforms.uGlowColor2.value.copy(c2);
      }
    };

    rebuildKrathongs();
    rebuildSignalRef.current = rebuildKrathongs;

    // Anime Fusion Animation Clock (3.2s)
    let fusionAnimStartMs: number | null = null;
    let fusionBurstCounter = 0;
    let lastOverlayPhase: FusionOverlaySignal["phase"] = "idle";
    let skyFlash = 0;

    startFusionAnimRef.current = () => {
      fusionAnimStartMs = performance.now();
      fusionBurstCounter += 1;
      lastOverlayPhase = "charge";
      onFusionSignalRef.current?.({
        active: true,
        phase: "charge",
        flashOpacity: 0,
        burstKey: fusionBurstCounter,
      });
    };

    flashBumpRef.current = () => {
      skyFlash = 1.0;
    };

    const emitSteer = (event: PointerEvent | null) => {
      if (!onDriftSteerRef.current) return;
      if (!event) {
        onDriftSteerRef.current(null);
        return;
      }
      const rect = dom.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const steer = Math.max(-1, Math.min(1, (nx - 0.5) / 0.36));
      onDriftSteerRef.current(steer);
    };

    // Smooth Damped 360° Orbit + Auto-Zoom Camera Controller
    let userAzimuth = 0.08;
    let targetAzimuth = 0.08;
    let userPolarOffset = 0;
    let targetPolarOffset = 0;
    let userZoomScale = 1.0;
    let targetZoomScale = 1.0;

    const currentLookAt = new THREE.Vector3(0, 0.35, 0);
    const desiredLookAt = new THREE.Vector3(0, 0.35, 0);
    let currentDist = 4.2;
    let currentPolar = 1.06;

    // Pointer drag & pinch-to-zoom handlers
    const activePointers = new Map<number, { x: number; y: number }>();
    let lastPinchDist = 0;
    let isDragging = false;

    const dom = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let steerGesture = false;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let pressedWish: { from: string; text: string } | null = null;

    const wishAtPointer = (event: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      pointerNdc.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
      pointerNdc.y = -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(npcGroup.children, true);
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          const wish = obj.userData.wish as { from: string; text: string } | undefined;
          if (wish) return wish;
          obj = obj.parent;
        }
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (stateRef.current.fusionState === "released") {
        dom.setPointerCapture(e.pointerId);
        isDragging = true;
        steerGesture = false;
        pointerStartX = e.clientX;
        pointerStartY = e.clientY;
        pressedWish = wishAtPointer(e);
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        return;
      }
      if (stateRef.current.drift?.mode === "playing") {
        dom.setPointerCapture(e.pointerId);
        isDragging = true;
        emitSteer(e);
        return;
      }
      dom.setPointerCapture(e.pointerId);
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 1) {
        isDragging = true;
      } else if (activePointers.size === 2) {
        const pts = Array.from(activePointers.values());
        lastPinchDist = Math.hypot(
          pts[0]!.x - pts[1]!.x,
          pts[0]!.y - pts[1]!.y,
        );
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (stateRef.current.fusionState === "released" && isDragging) {
        const moved = Math.hypot(e.clientX - pointerStartX, e.clientY - pointerStartY);
        if (moved > 12) steerGesture = true;
        const prev = activePointers.get(e.pointerId);
        if (prev && steerGesture && stateRef.current.drift?.mode !== "playing") {
          const dx = e.clientX - prev.x;
          targetAzimuth -= dx * 0.0085;
          if (Math.abs(dx) > 1) onUserOrbitRef.current?.();
        }
        if (prev) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (stateRef.current.drift?.mode === "playing" && steerGesture) emitSteer(e);
        return;
      }
      if (stateRef.current.drift?.mode === "playing" && isDragging) {
        emitSteer(e);
        return;
      }
      const prev = activePointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1 && isDragging) {
        targetAzimuth -= dx * 0.0085;
        targetPolarOffset = Math.max(
          -0.48,
          Math.min(0.28, targetPolarOffset - dy * 0.006),
        );
        if (Math.abs(dx) + Math.abs(dy) > 3) {
          onUserOrbitRef.current?.();
        }
      } else if (activePointers.size === 2) {
        const pts = Array.from(activePointers.values());
        const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        if (lastPinchDist > 0) {
          const ratio = lastPinchDist / Math.max(dist, 1);
          targetZoomScale = Math.max(0.72, Math.min(1.42, targetZoomScale * ratio));
        }
        lastPinchDist = dist;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (stateRef.current.fusionState === "released") {
        if (!steerGesture && pressedWish) onSampleWishRef.current?.(pressedWish);
        if (stateRef.current.drift?.mode === "playing") emitSteer(null);
        activePointers.delete(e.pointerId);
        isDragging = false;
        pressedWish = null;
        return;
      }
      if (stateRef.current.drift?.mode === "playing") {
        isDragging = false;
        emitSteer(null);
        return;
      }
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) lastPinchDist = 0;
      if (activePointers.size === 0) isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (stateRef.current.drift?.mode === "playing") return;
      e.preventDefault();
      targetZoomScale = Math.max(
        0.72,
        Math.min(1.42, targetZoomScale + e.deltaY * 0.0008),
      );
    };

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerUp);
    dom.addEventListener("wheel", onWheel, { passive: false });

    const resizeObserver = new ResizeObserver(() => {
      const w = Math.max(container.clientWidth, 300);
      const h = Math.max(container.clientHeight, 260);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
    resizeObserver.observe(container);

    // ========================================================================
    // 60FPS ANIMATION LOOP
    // ========================================================================
    let rafId = 0;
    const startTime = performance.now();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const nowMs = performance.now();
      const t = (nowMs - startTime) * 0.001;
      const cur = stateRef.current;

      waterUniforms.uTime.value = t;
      skyFlash = Math.max(0, skyFlash - 0.035);

      // Gentle ambient rotation when not dragging
      if (!isDragging && cur.fusionState !== "released") {
        targetAzimuth += 0.0022;
      }
      userAzimuth += (targetAzimuth - userAzimuth) * 0.1;
      userPolarOffset += (targetPolarOffset - userPolarOffset) * 0.1;
      userZoomScale += (targetZoomScale - userZoomScale) * 0.1;

      // Animate flickering 3D flames, PointLights & rising incense wisps
      const animateBuild = (build: KrathongBuildResult | null, seed: number) => {
        if (!build) return;
        build.flames.forEach((f, idx) => {
          const flick =
            1 +
            Math.sin(t * 14 + seed + idx * 2) * 0.07 +
            Math.cos(t * 23 + seed) * 0.04;
          f.scale.set(1 / Math.sqrt(flick), flick, 1 / Math.sqrt(flick));
          f.rotation.z = Math.sin(t * 9 + seed) * 0.08;
        });
        build.candleLights.forEach((light) => {
          light.intensity =
            3.2 + Math.sin(t * 13 + seed) * 0.35 + Math.cos(t * 21 + seed) * 0.2;
        });
        build.smokeParticles.forEach((sp) => {
          const cycle = ((t * 0.42 + sp.phase) % 1 + 1) % 1;
          sp.mesh.position.set(
            sp.baseX + Math.sin(cycle * 5 + sp.phase) * 0.07,
            1.18 + cycle * 0.72,
            sp.baseZ + Math.cos(cycle * 4 + sp.phase) * 0.05,
          );
          const mat = sp.mesh.material as THREE.MeshBasicMaterial;
          mat.opacity = Math.sin(cycle * Math.PI) * 0.26;
          sp.mesh.scale.setScalar(0.75 + cycle * 1.45);
        });
      };

      animateBuild(k1Build, 0.3);
      animateBuild(k2Build, 2.7);
      animateBuild(fusedBuild, 5.1);

      // Animate floating 3D golden fireflies
      const ffAttr = ffGeom.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < ffCount; i++) {
        const b = ffBase[i]!;
        ffAttr.setXYZ(
          i,
          b.x + Math.sin(t * b.sp + b.ph) * 0.45,
          b.y + Math.cos(t * b.sp * 0.8 + b.ph) * 0.28,
          b.z + Math.sin(t * b.sp * 0.6 + b.ph * 1.3) * 0.38,
        );
      }
      ffAttr.needsUpdate = true;

      // Determine visibility & choreography: Building vs Anime Collision Fusion vs Fused vs Released
      const fusionElapsed =
        fusionAnimStartMs !== null ? (nowMs - fusionAnimStartMs) * 0.001 : null;
      const isFusing = fusionElapsed !== null && fusionElapsed < 3.2;

      let animeFlash = 0;
      const stageAspect = camera.aspect || 1;
      const isNarrowViewport = stageAspect < 0.95;
      const separationX = isNarrowViewport ? 1.62 : 2.15;

      if (isFusing && fusionElapsed !== null) {
        fusionVfxGroup.visible = true;

        if (fusionElapsed < 1.18) {
          // PHASE 1 (0.0s -> 1.18s): Charge, levitate, spinning aura rings, accelerating collision curve!
          const p = fusionElapsed / 1.18;
          const ease = p * p * (2.2 - 1.2 * p);
          const liftY = Math.sin(p * Math.PI * 0.5) * 0.88;
          const dist = separationX * (1 - ease * 0.94);
          const swirlAngle = ease * Math.PI * 1.45;

          k1Pivot.visible = true;
          k2Pivot.visible = true;
          fusedPivot.visible = false;

          k1Pivot.position.set(
            -Math.cos(swirlAngle) * dist,
            liftY,
            -Math.sin(swirlAngle) * dist * 0.65,
          );
          k2Pivot.position.set(
            Math.cos(swirlAngle) * dist,
            liftY,
            Math.sin(swirlAngle) * dist * 0.65,
          );
          k1Pivot.rotation.y = t * (2.5 + p * 8);
          k2Pivot.rotation.y = -t * (2.5 + p * 8);

          aura1Ring.visible = true;
          aura2Ring.visible = true;
          aura1Ring.position.copy(k1Pivot.position);
          aura1Ring.position.y += 0.25;
          aura1Ring.rotation.z = t * 7;
          aura1Ring.scale.setScalar(0.85 + p * 0.45);
          aura1Mat.opacity = 0.45 + p * 0.5;

          aura2Ring.position.copy(k2Pivot.position);
          aura2Ring.position.y += 0.25;
          aura2Ring.rotation.z = -t * 7;
          aura2Ring.scale.setScalar(0.85 + p * 0.45);
          aura2Mat.opacity = 0.45 + p * 0.5;

          coreMat.opacity = Math.max(0, (p - 0.65) * 2.5);
          coreSphere.scale.setScalar(0.35 + p * 0.9);
          shock1Mat.opacity = 0;
          shock2Mat.opacity = 0;
          rayMat.opacity = Math.max(0, (p - 0.72) * 1.8);
          raysGroup.rotation.y = t * 4;

          // Comet spiral particles rushing inward
          const bAttr = burstGeom.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < burstCount; i++) {
            const ang = i * 0.35 + t * 6;
            const r = (1 - p * 0.75) * (1.2 + (i % 7) * 0.22);
            bAttr.setXYZ(
              i,
              Math.cos(ang) * r,
              0.5 + (i % 10) * 0.1 + liftY * 0.4,
              Math.sin(ang) * r,
            );
          }
          bAttr.needsUpdate = true;
          burstMat.opacity = 0.35 + p * 0.65;

          animeFlash = Math.max(0, (p - 0.85) / 0.15) * 0.55;
          waterUniforms.uGlowPos1.value.copy(k1Pivot.position);
          waterUniforms.uGlowPos2.value.copy(k2Pivot.position);
          waterUniforms.uGlow1Strength.value = 1.3;
          waterUniforms.uGlow2Strength.value = 1.3;
        } else if (fusionElapsed < 1.98) {
          // PHASE 2 (1.18s -> 1.98s): COLLISION IMPACT! Blinding anime flash, 3D shockwaves, starburst rays & explosion!
          const p = (fusionElapsed - 1.18) / 0.8;
          const swapped = p > 0.22;

          k1Pivot.visible = !swapped;
          k2Pivot.visible = !swapped;
          fusedPivot.visible = swapped;

          if (!swapped) {
            k1Pivot.position.set(0, 0.88, 0);
            k2Pivot.position.set(0, 0.88, 0);
          } else {
            fusedPivot.position.set(0, 0.88 - (p - 0.22) * 0.35, 0);
            fusedPivot.rotation.y = (1 - p) * Math.PI * 2;
            const popScale = 0.85 + Math.sin(Math.min(1, (p - 0.22) * 2.2) * Math.PI * 0.5) * 0.2;
            fusedPivot.scale.setScalar(popScale);
          }

          aura1Ring.visible = false;
          aura2Ring.visible = false;

          // Blazing core sphere peaks right across the swap
          const flashBell =
            p < 0.25 ? 0.65 + (p / 0.25) * 0.35 : Math.max(0, 1 - (p - 0.25) / 0.75);
          animeFlash = flashBell;

          coreSphere.scale.setScalar(0.8 + p * 3.8);
          coreMat.opacity = flashBell * 0.96;

          // Two expanding tilted 3D anime shockwave rings
          shock1.scale.setScalar(0.6 + p * 5.2);
          shock1Mat.opacity = Math.max(0, (1 - p) * 0.95);
          shock2.scale.setScalar(0.4 + p * 4.4);
          shock2Mat.opacity = Math.max(0, (1 - p * 0.92) * 0.9);

          // Spinning golden starburst god-rays
          raysGroup.rotation.y = t * 3.5;
          raysGroup.rotation.z = p * 1.4;
          raysGroup.scale.setScalar(0.75 + p * 1.6);
          rayMat.opacity = flashBell * 0.88;

          // Explosive radial burst of 180 golden petals & starlight particles!
          const bAttr = burstGeom.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < burstCount; i++) {
            const dir = burstDirs[i]!;
            const spd = burstSeeds[i]!;
            const dist = p * 5.2 * spd;
            bAttr.setXYZ(
              i,
              dir.x * dist,
              0.88 + dir.y * dist - p * p * 0.7,
              dir.z * dist,
            );
          }
          bAttr.needsUpdate = true;
          burstMat.opacity = Math.max(0, 1 - p * 0.85);

          waterUniforms.uGlowPos1.value.set(0, 0, 0);
          waterUniforms.uGlow1Strength.value = 2.4;
          waterUniforms.uGlow2Strength.value = 0;

          if (lastOverlayPhase !== "impact") {
            lastOverlayPhase = "impact";
            onFusionSignalRef.current?.({
              active: true,
              phase: "impact",
              flashOpacity: 0.96,
              burstKey: fusionBurstCounter,
            });
          }
        } else {
          // PHASE 3 (1.98s -> 3.2s): Radiant fused krathong descends gently onto glowing ripples
          const p = (fusionElapsed - 1.98) / 1.22;
          const easeOut = 1 - Math.pow(1 - p, 3);

          k1Pivot.visible = false;
          k2Pivot.visible = false;
          fusedPivot.visible = true;

          fusedPivot.position.set(0, (1 - easeOut) * 0.52, 0);
          fusedPivot.scale.setScalar(1.0);
          fusedPivot.rotation.y = (1 - easeOut) * 1.2;

          coreMat.opacity = Math.max(0, (1 - p) * 0.25);
          shock1Mat.opacity = 0;
          shock2Mat.opacity = 0;
          rayMat.opacity = Math.max(0, (1 - p) * 0.3);
          burstMat.opacity = Math.max(0, (1 - p) * 0.5);

          waterUniforms.uGlowPos1.value.set(0, 0, 0);
          waterUniforms.uGlow1Strength.value = 1.35;
          waterUniforms.uGlow2Strength.value = 0;

          if (lastOverlayPhase !== "reveal") {
            lastOverlayPhase = "reveal";
            onFusionSignalRef.current?.({
              active: true,
              phase: "reveal",
              flashOpacity: 0,
              burstKey: fusionBurstCounter,
            });
          }
        }
      } else {
        if (fusionAnimStartMs !== null) {
          fusionAnimStartMs = null;
          lastOverlayPhase = "idle";
          onFusionSignalRef.current?.({
            active: false,
            phase: "idle",
            flashOpacity: 0,
            burstKey: fusionBurstCounter,
          });
        }
        fusionVfxGroup.visible = false;

        if (cur.fusionState === "building") {
          // TWO SEPARATE COMPLETE 3D KRATHONGS side-by-side on the moonlit water
          k1Pivot.visible = true;
          k2Pivot.visible = true;
          fusedPivot.visible = false;

          k1Pivot.position.set(
            -separationX,
            Math.sin(t * 1.55) * 0.045,
            Math.cos(t * 0.9) * 0.05,
          );
          k1Pivot.rotation.set(
            Math.sin(t * 1.2) * 0.025,
            Math.sin(t * 0.45) * 0.14,
            Math.cos(t * 1.4) * 0.025,
          );

          k2Pivot.position.set(
            separationX,
            Math.sin(t * 1.55 + 1.4) * 0.045,
            Math.cos(t * 0.9 + 1.1) * 0.05,
          );
          k2Pivot.rotation.set(
            Math.sin(t * 1.2 + 1.2) * 0.025,
            -Math.sin(t * 0.45 + 0.6) * 0.14,
            Math.cos(t * 1.4 + 0.9) * 0.025,
          );

          waterUniforms.uGlowPos1.value.copy(k1Pivot.position);
          waterUniforms.uGlowPos2.value.copy(k2Pivot.position);
          waterUniforms.uGlow1Strength.value = 1.05;
          waterUniforms.uGlow2Strength.value = 1.05;
          waterUniforms.uRippleIntensity.value = 1.0;
        } else if (cur.fusionState === "fused") {
          // SINGLE RADIANT FUSED COUPLE KRATHONG ready for release
          k1Pivot.visible = false;
          k2Pivot.visible = false;
          fusedPivot.visible = true;

          const holdDip = cur.someoneHolding ? -0.04 : 0;
          fusedPivot.position.set(
            0,
            Math.sin(t * 1.65) * 0.048 + holdDip,
            0.25,
          );
          fusedPivot.rotation.set(
            Math.sin(t * 1.2) * 0.025,
            0,
            Math.cos(t * 1.35) * 0.025,
          );
          fusedPivot.scale.setScalar(1.04);

          waterUniforms.uGlowPos1.value.copy(fusedPivot.position);
          waterUniforms.uGlow1Strength.value = cur.someoneHolding ? 1.5 : 1.2;
          waterUniforms.uGlow2Strength.value = 0;
          waterUniforms.uRippleIntensity.value = cur.someoneHolding ? 1.75 : 1.15;
        } else {
          // RELEASED: 30° river view. The steer game switches the camera to top-down.
          k1Pivot.visible = false;
          k2Pivot.visible = false;
          fusedPivot.visible = true;

          const releaseElapsedSec =
            releaseStartLocalMsRef.current !== null
              ? Math.max(0, (nowMs - releaseStartLocalMsRef.current) * 0.001)
              : 0;
          const view = cur.drift;
          const playing = view?.mode === "playing" || view?.mode === "done";
          const bobY = Math.sin(t * 1.9) * 0.045;
          let driftX = Math.sin(releaseElapsedSec * 0.28) * 0.28;
          let driftZ = -1.7 - Math.min(1, releaseElapsedSec / 7) * 1.8;
          let lean = 0;

          if (playing && view) {
            const extraMs = view.mode === "done" ? 0 : Math.max(0, Date.now() - view.receivedAtMs);
            const elapsed = Math.min(DRIFT_DURATION_MS, view.elapsedMs + extraMs);
            const extraSec = Math.min(0.22, extraMs / 1000);
            driftX = Math.max(
              -DRIFT_X_LIMIT,
              Math.min(DRIFT_X_LIMIT, view.x + view.steer * DRIFT_STEER_SPEED * extraSec),
            );
            driftZ = driftZAt(elapsed);
            lean = view.steer;
          }

          fusedPivot.position.set(driftX, bobY, driftZ);
          fusedPivot.rotation.set(
            Math.sin(t * 1.35) * 0.03 + lean * 0.05,
            lean * -0.35,
            Math.cos(t * 1.5) * 0.028 - lean * 0.16,
          );
          fusedPivot.scale.setScalar(1.0);

          waterUniforms.uGlowPos1.value.copy(fusedPivot.position);
          waterUniforms.uGlow1Strength.value = 1.25;
          waterUniforms.uGlow2Strength.value = 0;
          waterUniforms.uRippleIntensity.value = playing ? 1.35 : 1.2;

          const itemKey = (view?.items ?? [])
            .map((item) => `${item.id}:${item.x.toFixed(2)}:${item.z.toFixed(2)}`)
            .join("|");
          if (itemKey !== driftMeshKey) {
            driftMeshKey = itemKey;
            for (const child of [...driftGroup.children]) {
              driftGroup.remove(child);
            }
            for (const geometry of driftGeometries) geometry.dispose();
            for (const material of driftMaterials) material.dispose();
            driftGeometries.length = 0;
            driftMaterials.length = 0;
            for (const item of view?.items ?? []) {
              const holder = new THREE.Group();
              holder.userData.driftId = item.id;
              holder.position.set(item.x, 0, item.z);
              if (item.kind === "lantern") {
                const paperGeom = new THREE.CylinderGeometry(0.11, 0.15, 0.3, 12);
                const paperMat = new THREE.MeshStandardMaterial({
                  color: "#ffd978",
                  emissive: "#ff9a1f",
                  emissiveIntensity: 0.85,
                  roughness: 0.38,
                });
                const paper = new THREE.Mesh(paperGeom, paperMat);
                paper.position.y = 0.38;
                const capGeom = new THREE.ConeGeometry(0.13, 0.1, 12);
                const capMat = new THREE.MeshStandardMaterial({
                  color: "#b45309",
                  emissive: "#f59e0b",
                  emissiveIntensity: 0.35,
                  roughness: 0.5,
                });
                const cap = new THREE.Mesh(capGeom, capMat);
                cap.position.y = 0.56;
                holder.add(paper, cap);
                driftGeometries.push(paperGeom, capGeom);
                driftMaterials.push(paperMat, capMat);
              } else {
                const rockGeom = new THREE.SphereGeometry(0.22, 16, 12);
                const rockMat = new THREE.MeshStandardMaterial({
                  color: "#3d465f",
                  roughness: 0.88,
                  metalness: 0.04,
                });
                const rock = new THREE.Mesh(rockGeom, rockMat);
                rock.scale.set(1.35, 0.42, 0.95);
                rock.position.y = 0.05;
                holder.add(rock);
                driftGeometries.push(rockGeom);
                driftMaterials.push(rockMat);
              }
              driftGroup.add(holder);
            }
          }
          driftGroup.visible = playing;
          for (const child of driftGroup.children) {
            const id = String(child.userData.driftId ?? "");
            const item = view?.items.find((entry) => entry.id === id);
            child.visible = Boolean(item && !item.resolved);
            if (item?.kind === "lantern") {
              child.position.y = Math.sin(t * 2.2 + item.x) * 0.05;
            }
          }
        }
      }

      const combinedFlash = Math.min(1, animeFlash + skyFlash * 0.55);
      waterUniforms.uFlash.value = combinedFlash;
      flashLight.intensity = combinedFlash * 10;

      // ======================================================================
      // SMOOTH AUTO-ZOOM & FRAMING CAMERA CONTROLLER
      // ======================================================================
      const aspect = camera.aspect || 1;
      const isNarrow = aspect < 0.95;
      const driftCameraEnabled = false;
      const topDown =
        driftCameraEnabled &&
        cur.fusionState === "released" &&
        cur.drift?.mode === "playing";
      const wantFov = topDown ? 50 : cur.fusionState === "released" ? 60 : 36;
      if (Math.abs(camera.fov - wantFov) > 0.01) {
        camera.fov = wantFov;
        camera.updateProjectionMatrix();
      }

      let targetDist = 4.2;
      let targetPolar = 1.05;

      if (cur.fusionState !== "released") driftGroup.visible = false;
      npcGroup.visible = cur.fusionState === "released";
      if (npcGroup.visible) {
        const originZ = fusedPivot.position.z;
        const boatCount = npcGroup.children.length;
        npcGroup.children.forEach((child, index) => {
          const speed = 0.9 + (index % 4) * 0.16;
          const span = 12;
          const traveled = t * speed + index * 1.7;
          const travel = traveled % span;
          const lap = Math.floor(traveled / span);
          const wish =
            SAMPLE_RIVER_WISHES[(index + lap * boatCount) % SAMPLE_RIVER_WISHES.length];
          if (child.userData.wishId !== wish.id) {
            child.userData.wish = { from: wish.from, text: wish.text };
            child.userData.wishId = wish.id;
            const ringMat = child.userData.ringMat as THREE.MeshStandardMaterial | undefined;
            if (ringMat) {
              ringMat.color.set(wish.tint);
              ringMat.emissive.set(wish.tint);
            }
          }
          const fromAhead = index % 2 === 1;
          const side = index % 2 === 0 ? -1 : 1;
          const lane = 1.9 + (index % 3) * 0.38;
          const z = originZ + (fromAhead ? -5.2 : -0.15) - travel;
          const enterX = fromAhead ? lane : 3.7;
          const blend = fromAhead ? 1 : Math.min(1, travel / 3.2);
          child.position.set(
            side * (enterX + (lane - enterX) * blend) + Math.sin(t * 0.3 + index) * 0.08,
            Math.sin(t * 1.15 + index) * 0.03,
            z,
          );
          child.rotation.y = Math.sin(t * 0.45 + index) * 0.35;
        });
        container.dataset.npcMotion = npcGroup.children
          .slice(0, 4)
          .map((child) => `${child.position.x.toFixed(2)},${child.position.z.toFixed(2)}`)
          .join("|");
      }

      if (topDown) {
        desiredLookAt.set(fusedPivot.position.x, 0.42, fusedPivot.position.z);
        targetDist = isNarrow ? 8.4 : 7.6;
        targetPolar = 0.02;
      } else if (cur.fusionState === "released") {
        // 30° above the water, orbiting the krathong so a drag spins the view.
        const tilt = (30 * Math.PI) / 180;
        const pitch = (22 * Math.PI) / 180;
        const behind = isNarrow ? 7.2 : 6.4;
        const polar = Math.PI / 2 - pitch;
        const dist = behind / Math.sin(polar);
        const camHeight = behind * Math.tan(tilt);
        desiredLookAt.set(
          fusedPivot.position.x,
          camHeight - dist * Math.cos(polar),
          fusedPivot.position.z,
        );
        targetDist = dist;
        targetPolar = polar;
      } else if (isFusing) {
        desiredLookAt.set(0, 0.55, 0);
        targetDist = isNarrow ? 6.2 : 4.85;
        targetPolar = 1.08;
      } else if (cur.fusionState === "fused") {
        desiredLookAt.set(0, 0.34, 0.25);
        targetDist = (isNarrow ? 3.85 : 3.25) * userZoomScale;
        targetPolar = cur.someoneHolding ? 1.22 : 1.03 + userPolarOffset;
      } else if (cur.focusMode === "customize") {
        const focusX = cur.activeSlot === 1 ? -separationX : separationX;
        desiredLookAt.set(focusX, 0.34, 0);
        targetDist = (isNarrow ? 4.4 : 3.25) * userZoomScale;
        targetPolar = 0.96 + userPolarOffset;
      } else {
        // Dual Overview: BOTH krathongs clearly separated left & right with generous open moonlit water between them!
        desiredLookAt.set(0, 0.34, 0);
        const vFovRad = (camera.fov * Math.PI) / 180;
        const hTan = Math.tan(vFovRad / 2) * Math.max(0.5, aspect);
        const halfSpanX = separationX + 1.24;
        const fitDist = (halfSpanX / hTan) * 1.05;
        targetDist =
          (isNarrow ? Math.min(11.6, Math.max(7.8, fitDist)) : 5.35) *
          userZoomScale;
        targetPolar = (isNarrow ? 1.0 : 1.02) + userPolarOffset;
      }

      const clampedPolar = Math.max(topDown ? 0 : 0.46, Math.min(1.72, targetPolar));
      if (cur.fusionState === "released") {
        currentLookAt.copy(desiredLookAt);
        currentDist = targetDist;
        currentPolar = clampedPolar;
      } else {
        currentLookAt.lerp(desiredLookAt, 0.075);
        currentDist += (targetDist - currentDist) * 0.075;
        currentPolar += (clampedPolar - currentPolar) * 0.075;
      }

      if (topDown) camera.up.set(0, 0, -1);
      else camera.up.set(0, 1, 0);

      const effectiveAzimuth = topDown ? 0 : userAzimuth;

      const camY = Math.max(
        0.55,
        currentLookAt.y + currentDist * Math.cos(currentPolar),
      );
      camera.position.set(
        currentLookAt.x +
          currentDist * Math.sin(currentPolar) * Math.sin(effectiveAzimuth),
        camY,
        currentLookAt.z +
          currentDist * Math.sin(currentPolar) * Math.cos(effectiveAzimuth),
      );
      camera.lookAt(currentLookAt);

      if (cur.fusionState === "released" && !topDown) {
        const horiz = Math.hypot(
          camera.position.x - fusedPivot.position.x,
          camera.position.z - fusedPivot.position.z,
        );
        const tiltDeg = (Math.atan2(camera.position.y, Math.max(horiz, 0.001)) * 180) / Math.PI;
        container.dataset.cameraTilt = tiltDeg.toFixed(1);
        container.dataset.cameraAzimuth = userAzimuth.toFixed(3);
        container.dataset.cameraView = "tilt";
      } else if (topDown && currentPolar < 0.2) {
        container.dataset.cameraView = "top-down";
        container.dataset.cameraTilt = "90";
      } else if (!topDown) {
        container.dataset.cameraView = "angled";
      }

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerUp);
      dom.removeEventListener("wheel", onWheel);
      if (k1Build) disposeGroupResources(k1Build.group, assets);
      if (k2Build) disposeGroupResources(k2Build.group, assets);
      if (fusedBuild) disposeGroupResources(fusedBuild.group, assets);
      assets.dispose();
      waterMat.dispose();
      waterMesh.geometry.dispose();
      ffGeom.dispose();
      ffMat.dispose();
      burstGeom.dispose();
      burstMat.dispose();
      rayGeom.dispose();
      rayMat.dispose();
      if (envTexture) envTexture.dispose();
      for (const geometry of driftGeometries) geometry.dispose();
      for (const material of driftMaterials) material.dispose();
      for (const geometry of npcGeometries) geometry.dispose();
      for (const material of npcMaterials) material.dispose();
      renderer.dispose();
    };
  }, []);

  if (webglFailed) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6 text-center">
        <div className="max-w-xs rounded-2xl border border-amber-200/25 bg-[#080f27]/85 px-5 py-4 text-xs leading-relaxed text-amber-100/90 backdrop-blur-md">
          ไม่สามารถเปิดการแสดงผล 3 มิติ (WebGL) บนเบราว์เซอร์นี้ได้ กรุณาเปิดใช้งาน WebGL หรือรีเฟรชหน้าใหม่อีกครั้ง
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className="h-full w-full cursor-grab active:cursor-grabbing"
      aria-label="กระทง 3 มิติ ลากเพื่อหมุนดูได้ 360 องศา"
    />
  );
}
