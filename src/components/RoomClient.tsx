"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ACCENT_OPTIONS,
  AccentStyle,
  BASE_OPTIONS,
  BaseStyle,
  CANDLE_OPTIONS,
  CandleStyle,
  ClientSkyKind,
  DEFAULT_P1_CHOICE,
  DEFAULT_P2_CHOICE,
  FLOWER_OPTIONS,
  FlowerStyle,
  RoomStateSnapshot,
  getActivityThaiLabel,
  pickRandomKrathongStyles,
} from "@/lib/krathong";
import { soundEngine } from "@/lib/sound";
import { CelebrationOverlay, VisualSkyEvent } from "./CelebrationOverlay";
import { ChaoPhrayaBackdrop } from "./ChaoPhrayaBackdrop";
import { HoldReleaseButton } from "./HoldReleaseButton";
import {
  CameraFocusMode,
  FusionOverlaySignal,
  Krathong3D,
} from "./Krathong3D";

function copyTextFallback(text: string): boolean {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function RoomClient({ roomId }: { roomId: string }) {
  const searchParams = useSearchParams();
  const urlInvite =
    searchParams.get("invite") ?? searchParams.get("key") ?? "";

  const [phase, setPhase] = useState<
    "loading" | "needs_join" | "unauthorized" | "ready"
  >("loading");
  const [roomState, setRoomState] = useState<RoomStateSnapshot | null>(null);

  // Join gate state
  const [joinNickname, setJoinNickname] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Invite secret + bulletproof copy state
  const [storedInviteSecret, setStoredInviteSecret] = useState<string | null>(
    null,
  );
  const [copiedState, setCopiedState] = useState<"idle" | "copied" | "manual">(
    "idle",
  );
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  // Audio mute toggle (SFX only — no BGM until a licensed track is provided)
  const [soundMuted, setSoundMuted] = useState(false);
  const [reconnectNotice, setReconnectNotice] = useState<string | null>(null);
  const authFailStreakRef = useRef(0);
  const hadReadySessionRef = useRef(false);
  const lastSoftRejoinAtRef = useRef(0);

  // Clean lightweight personal wish input & tactile Krathong Builder tray
  const [wishDraft, setWishDraft] = useState("");
  const isEditingWishRef = useRef(false);
  const wishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savingWish, setSavingWish] = useState(false);
  const [orbitHintVisible, setOrbitHintVisible] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderTab, setBuilderTab] = useState<
    "base" | "flower" | "candle" | "accent"
  >("base");
  const [builderZoomSelf, setBuilderZoomSelf] = useState(true);
  const [savingStyle, setSavingStyle] = useState(false);
  const [releasedWishesOpen, setReleasedWishesOpen] = useState(false);
  const [sampleWish, setSampleWish] = useState<{ from: string; text: string } | null>(
    null,
  );

  // Zero-clock-skew cross-device visual event queue
  const [visualEvents, setVisualEvents] = useState<VisualSkyEvent[]>([]);
  const seenSkyEventIdsRef = useRef<Set<number>>(new Set());
  const initialHydratedRef = useRef(false);
  const lastLaunchTimeRef = useRef<Record<string, number>>({});

  // Fusion & celebration animations
  const [fusionTriggerKey, setFusionTriggerKey] = useState(0);
  const [fusionSignal, setFusionSignal] = useState<FusionOverlaySignal>({
    active: false,
    phase: "idle",
    flashOpacity: 0,
    burstKey: 0,
  });
  const [skyFlashKey, setSkyFlashKey] = useState(0);
  const driftReceivedAtRef = useRef(Date.now());
  const prevDriftScoreRef = useRef(0);
  const driftScoreReadyRef = useRef(false);
  const pointerSteerRef = useRef<number | null>(null);
  const tiltSteerRef = useRef(0);
  const pendingSteerRef = useRef<number | null>(null);
  const steerPostingRef = useRef(false);
  const prevFusionStateRef = useRef<string | null>(null);

  // Sky lantern popup modal
  const [lanternModalOpen, setLanternModalOpen] = useState(false);
  const [lanternMessage, setLanternMessage] = useState("");
  const [launchingLantern, setLaunchingLantern] = useState(false);

  // Partner live notice
  const lastEditKeyRef = useRef<string | null>(null);
  const [partnerEditNotice, setPartnerEditNotice] = useState<string | null>(
    null,
  );

  // Polling concurrency & stale-write protection
  const pollInFlightRef = useRef(false);
  const writeEpochRef = useRef(0);

  // Synchronized hold-to-release state (server-elapsed based -> zero clock skew!)
  const [localHolding, setLocalHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdAnchorRef = useRef<{
    baseElapsedMs: number;
    receivedAtMs: number;
    targetMs: number;
  } | null>(null);
  const holdFinalTriggeredRef = useRef(false);
  const [busyAction, setBusyAction] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator);
    try {
      const saved =
        window.localStorage.getItem(`lk_invite_${roomId}`) ||
        window.sessionStorage.getItem(`lk_invite_${roomId}`);
      if (saved) {
        setStoredInviteSecret(saved);
        window.localStorage.setItem(`lk_invite_${roomId}`, saved);
        window.sessionStorage.setItem(`lk_invite_${roomId}`, saved);
      }
      if (urlInvite) {
        setStoredInviteSecret(urlInvite);
        window.localStorage.setItem(`lk_invite_${roomId}`, urlInvite);
        window.sessionStorage.setItem(`lk_invite_${roomId}`, urlInvite);
      }
      const savedNick =
        window.sessionStorage.getItem(`lk_nick_${roomId}`) ||
        window.localStorage.getItem(`lk_nick_${roomId}`);
      if (savedNick && !joinNickname) {
        setJoinNickname(savedNick);
      }
    } catch {
      // Ignore private mode errors
    }
    // Prefill once per room; joinNickname omitted so typing is not reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/room invite hydrate only
  }, [roomId, urlInvite]);

  // iOS/Android: unlock AudioContext on first user gesture
  useEffect(() => {
    soundEngine.bindGestureUnlock();
  }, []);

  // Periodically prune expired visual events cleanly
  useEffect(() => {
    const prune = setInterval(() => {
      const now = Date.now();
      setVisualEvents((prev) => {
        const next = prev.filter(({ event, spawnedAtMs }) => {
          const age = now - spawnedAtMs;
          const maxAge =
            event.kind === "lantern" ? 20500 : event.kind === "sparkle" ? 2600 : 4800;
          return age < maxAge;
        });
        return next.length === prev.length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(prune);
  }, []);

  const toggleSound = () => {
    soundEngine.unlock();
    const nextMuted = !soundMuted;
    setSoundMuted(nextMuted);
    soundEngine.setMuted(nextMuted);
    if (!nextMuted) {
      soundEngine.playHeartPop(false);
    }
  };

  const triggerEventAudioAndHaptics = useCallback(
    (ev: RoomStateSnapshot["skyEvents"][number]) => {
      const canVibrate =
        typeof navigator !== "undefined" &&
        "vibrate" in navigator &&
        Boolean(navigator.userActivation?.hasBeenActive);
      if (ev.kind === "sparkle") {
        setSkyFlashKey((k) => k + 1);
        soundEngine.playFireworkBurst();
      } else if (ev.kind === "lantern") {
        soundEngine.playLanternChime();
      } else if (ev.kind === "heart_combo") {
        soundEngine.playHeartPop(true);
        if (canVibrate) {
          try {
            navigator.vibrate([40, 40, 80]);
          } catch {
            // Ignore
          }
        }
      } else if (ev.kind === "heart") {
        soundEngine.playHeartPop(false);
      }
    },
    [],
  );

  const applyServerState = useCallback(
    (next: RoomStateSnapshot) => {
      // Save last authenticated room id so refreshing / can also jump right back in
      try {
        window.localStorage.setItem("loy_last_room_id", next.roomId);
      } catch {
        // Ignore
      }

      // Clean invite query param from URL bar once authenticated (so refresh stays clean!)
      if (
        typeof window !== "undefined" &&
        (window.location.search.includes("invite=") ||
          window.location.search.includes("key="))
      ) {
        window.history.replaceState(null, "", `/room/${next.roomId}`);
      }

      // Detect fusion / release state transitions
      const prevFusion = prevFusionStateRef.current;
      if (prevFusion === "building" && next.fusionState === "fused") {
        setFusionTriggerKey((k) => k + 1);
        soundEngine.playFusionChime();
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([30, 80, 30, 80, 120]);
          } catch {
            // Ignore
          }
        }
      } else if (prevFusion === "fused" && next.fusionState === "released") {
        soundEngine.playReleaseBell();
      }
      prevFusionStateRef.current = next.fusionState;

      // Update server-synced hold progress anchor (zero clock skew!)
      if (next.holdSync.bothHolding && next.fusionState === "fused") {
        holdAnchorRef.current = {
          baseElapsedMs: next.holdSync.bothHoldingElapsedMs,
          receivedAtMs: performance.now(),
          targetMs: next.holdSync.targetHoldMs,
        };
      } else {
        holdAnchorRef.current = null;
        holdFinalTriggeredRef.current = false;
      }

      // Zero-clock-skew cross-device event sync via seenSkyEventIdsRef!
      const nowLocal = Date.now();
      if (!initialHydratedRef.current) {
        initialHydratedRef.current = true;
        const recentLanterns: VisualSkyEvent[] = [];
        next.skyEvents.forEach((ev) => {
          seenSkyEventIdsRef.current.add(ev.id);
          const serverAgeMs = next.serverNowMs - ev.createdAtMs;
          if (ev.kind === "lantern" && serverAgeMs >= -3000 && serverAgeMs < 14000) {
            recentLanterns.push({ event: ev, spawnedAtMs: nowLocal });
          }
        });
        if (recentLanterns.length > 0) {
          setVisualEvents(recentLanterns);
        }
      } else {
        const newlyArrived: VisualSkyEvent[] = [];
        next.skyEvents.forEach((ev) => {
          if (!seenSkyEventIdsRef.current.has(ev.id)) {
            seenSkyEventIdsRef.current.add(ev.id);
            newlyArrived.push({ event: ev, spawnedAtMs: nowLocal });
            triggerEventAudioAndHaptics(ev);
          }
        });
        if (newlyArrived.length > 0) {
          setVisualEvents((prev) => [...prev, ...newlyArrived].slice(-45));
        }
      }

      setRoomState(next);

      const self = next.participants.find((p) => p.isSelf);
      const myChoice = self?.slot === 2 ? next.p2Choice : next.p1Choice;

      if (
        next.lastEditedBy &&
        next.lastEditLabel &&
        self &&
        next.lastEditedBy !== self.nickname
      ) {
        const key = `${next.lastEditedBy}:${next.lastEditLabel}:${next.fusionState}:${next.p1Ready}:${next.p2Ready}:${next.krathongRound}`;
        if (lastEditKeyRef.current !== null && lastEditKeyRef.current !== key) {
          setPartnerEditNotice(`${next.lastEditedBy} ${next.lastEditLabel}`);
        }
        lastEditKeyRef.current = key;
      }

      if (!isEditingWishRef.current) {
        setWishDraft(myChoice.wishText);
      }

      if (next.fusionState === "released") {
        setLocalHolding(false);
        setHoldProgress(0);
      }

      driftReceivedAtRef.current = Date.now();
      if (
        driftScoreReadyRef.current &&
        next.drift.status === "playing" &&
        next.drift.score > prevDriftScoreRef.current
      ) {
        soundEngine.playCollect();
      }
      driftScoreReadyRef.current = true;
      prevDriftScoreRef.current = next.drift.score;

      if (next.participants.length >= 2) {
        // Keep invite in localStorage for soft-rejoin after cold starts;
        // only clear the banner/UI secret once partner has joined.
        setStoredInviteSecret(null);
      }
      const me = next.participants.find((p) => p.isSelf);
      if (me?.nickname) {
        try {
          window.sessionStorage.setItem(`lk_nick_${roomId}`, me.nickname);
          window.localStorage.setItem(`lk_nick_${roomId}`, me.nickname);
        } catch {
          // Ignore
        }
      }
    },
    [roomId, triggerEventAudioAndHaptics],
  );

  useEffect(() => {
    if (!partnerEditNotice) return;
    const t = setTimeout(() => setPartnerEditNotice(null), 2800);
    return () => clearTimeout(t);
  }, [partnerEditNotice]);

  const readStoredInvite = useCallback((): string => {
    try {
      return (
        urlInvite ||
        window.localStorage.getItem(`lk_invite_${roomId}`) ||
        window.sessionStorage.getItem(`lk_invite_${roomId}`) ||
        ""
      );
    } catch {
      return urlInvite || "";
    }
  }, [roomId, urlInvite]);

  const readStoredNickname = useCallback((): string => {
    try {
      return (
        window.sessionStorage.getItem(`lk_nick_${roomId}`) ||
        window.localStorage.getItem(`lk_nick_${roomId}`) ||
        ""
      );
    } catch {
      return "";
    }
  }, [roomId]);

  // Soft rejoin after transient auth loss (e.g. serverless cold start wiping ephemeral DB)
  const trySoftRejoin = useCallback(async (): Promise<boolean> => {
    const inviteSecret = readStoredInvite();
    const nickname = readStoredNickname().trim();
    if (!nickname || !inviteSecret) return false;
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch",
        },
        body: JSON.stringify({
          inviteSecret,
          nickname,
        }),
      });
      if (!res.ok) return false;
      try {
        window.sessionStorage.setItem(`lk_invite_${roomId}`, inviteSecret);
        window.localStorage.setItem(`lk_invite_${roomId}`, inviteSecret);
        window.sessionStorage.setItem(`lk_nick_${roomId}`, nickname);
        window.localStorage.setItem(`lk_nick_${roomId}`, nickname);
        setStoredInviteSecret(inviteSecret);
      } catch {
        // Ignore
      }
      // Join only sets the cookie; re-fetch room state with the new session.
      const poll = await fetch(`/api/rooms/${roomId}?_t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      if (!poll.ok) return false;
      const data = (await poll.json()) as RoomStateSnapshot;
      applyServerState(data);
      setPhase("ready");
      setReconnectNotice(null);
      authFailStreakRef.current = 0;
      hadReadySessionRef.current = true;
      return true;
    } catch {
      return false;
    }
  }, [roomId, readStoredInvite, readStoredNickname, applyServerState]);

  // Authenticated GET poll (always checks session cookie FIRST before ever showing Join form!)
  const fetchRoomState = useCallback(
    async (isBackgroundPoll = false) => {
      if (isBackgroundPoll && pollInFlightRef.current) return false;
      const pollEpoch = writeEpochRef.current;
      pollInFlightRef.current = true;
      try {
        const res = await fetch(`/api/rooms/${roomId}?_t=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });
        if (res.status === 401) {
          // Mid-session 401s are usually a brief wrong-instance blip. Soft-rejoin
          // silently; only surface the banner after a sustained streak so normal
          // use stays quiet (user reported the banner flashing too often).
          if (hadReadySessionRef.current || isBackgroundPoll) {
            authFailStreakRef.current += 1;
            const streak = authFailStreakRef.current;
            if (streak >= 6) {
              setReconnectNotice("กำลังเชื่อมต่อห้องใหม่...");
            }
            const now = Date.now();
            const rejoinCooldownMs = 4000;
            if (
              streak === 1 ||
              now - lastSoftRejoinAtRef.current >= rejoinCooldownMs
            ) {
              lastSoftRejoinAtRef.current = now;
              const rejoined = await trySoftRejoin();
              if (rejoined) return true;
            }
            if (streak < 30) {
              return false;
            }
            // Still have invite? Stay ready forever rather than join-gate mid-session.
            if (readStoredInvite() && readStoredNickname()) {
              authFailStreakRef.current = 10;
              return false;
            }
          }
          setPhase(urlInvite || readStoredInvite() ? "needs_join" : "unauthorized");
          setReconnectNotice(null);
          return false;
        }
        if (!res.ok) return false;
        const data = (await res.json()) as RoomStateSnapshot;
        if (isBackgroundPoll && pollEpoch !== writeEpochRef.current) {
          return true;
        }
        applyServerState(data);
        authFailStreakRef.current = 0;
        hadReadySessionRef.current = true;
        setReconnectNotice(null);
        setPhase("ready");
        return true;
      } catch {
        return false;
      } finally {
        pollInFlightRef.current = false;
      }
    },
    [roomId, urlInvite, applyServerState, trySoftRejoin, readStoredInvite],
  );

  useEffect(() => {
    void fetchRoomState(false);
  }, [fetchRoomState]);

  const anyoneHolding = useMemo(() => {
    if (!roomState) return false;
    return localHolding || roomState.participants.some((p) => p.holding);
  }, [roomState, localHolding]);

  // Responsive ~600ms polling (300ms while holding) with in-flight guard
  useEffect(() => {
    if (phase !== "ready") return;
    const driftPlaying = roomState?.drift.status === "playing";
    const intervalMs = driftPlaying ? 180 : anyoneHolding ? 300 : 600;
    const timer = setInterval(() => {
      void fetchRoomState(true);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [phase, anyoneHolding, roomState?.drift.status, fetchRoomState]);

  const sendHoldStatus = useCallback(
    async (holding: boolean) => {
      soundEngine.unlock();
      writeEpochRef.current += 1;
      try {
        const res = await fetch(`/api/rooms/${roomId}/hold`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "fetch",
          },
          body: JSON.stringify({ holding }),
        });
        if (res.ok) {
          const data = (await res.json()) as RoomStateSnapshot;
          applyServerState(data);
        }
      } catch {
        // Polling will resync
      }
    },
    [roomId, applyServerState],
  );

  // 500ms hold heartbeat while pressing
  useEffect(() => {
    if (phase !== "ready" || !localHolding) return;
    const hb = setInterval(() => {
      void sendHoldStatus(true);
    }, 500);
    return () => clearInterval(hb);
  }, [phase, localHolding, sendHoldStatus]);

  // 60fps smooth progress ring driven purely from server-computed elapsed ms (ZERO clock skew!)
  const bothHolding = Boolean(roomState?.holdSync.bothHolding);
  useEffect(() => {
    if (!bothHolding || roomState?.fusionState !== "fused") {
      setHoldProgress(0);
      holdFinalTriggeredRef.current = false;
      return;
    }

    let rafId = 0;
    const tick = () => {
      const anchor = holdAnchorRef.current;
      if (!anchor) {
        setHoldProgress(0);
        return;
      }
      const elapsed = anchor.baseElapsedMs + (performance.now() - anchor.receivedAtMs);
      const progress = Math.max(0, Math.min(1, elapsed / anchor.targetMs));
      setHoldProgress(progress);
      if (progress >= 0.92 && !holdFinalTriggeredRef.current && localHolding) {
        holdFinalTriggeredRef.current = true;
        void sendHoldStatus(true);
      }
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [bothHolding, roomState?.fusionState, localHolding, sendHoldStatus]);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = joinNickname.trim();
    if (!trimmed) {
      setJoinError("กรุณาใส่ชื่อเล่นของคุณก่อนนะ");
      return;
    }

    // After auth, invite is stripped from the URL — still join with localStorage copy.
    const inviteSecret = readStoredInvite();
    if (!inviteSecret) {
      setJoinError(
        "ลิงก์เชิญไม่ถูกต้อง กรุณาขอลิงก์ใหม่จากคนพิเศษของคุณ",
      );
      return;
    }

    setJoining(true);
    setJoinError(null);
    soundEngine.unlock();
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch",
        },
        body: JSON.stringify({
          inviteSecret,
          nickname: trimmed,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setJoinError(
          typeof data.error === "string"
            ? data.error
            : "ไม่สามารถเข้าห้องได้ กรุณาตรวจสอบลิงก์เชิญ",
        );
        setJoining(false);
        return;
      }

      try {
        window.sessionStorage.setItem(`lk_nick_${roomId}`, trimmed);
        window.localStorage.setItem(`lk_nick_${roomId}`, trimmed);
        window.sessionStorage.setItem(`lk_invite_${roomId}`, inviteSecret);
        window.localStorage.setItem(`lk_invite_${roomId}`, inviteSecret);
        setStoredInviteSecret(inviteSecret);
      } catch {
        // Ignore
      }
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `/room/${roomId}`);
      }
      hadReadySessionRef.current = true;
      await fetchRoomState(false);
      setJoining(false);
    } catch {
      setJoinError("การเชื่อมต่อขัดข้อง กรุณาลองใหม่อีกครั้ง");
      setJoining(false);
    }
  };

  const self = roomState?.participants.find((p) => p.isSelf) ?? null;
  const partner = roomState?.participants.find((p) => !p.isSelf) ?? null;
  const isSolo = (roomState?.participants.length ?? 1) === 1;

  const updateMyChoice = useCallback(
    async (patch: {
      baseStyle?: BaseStyle;
      flowerStyle?: FlowerStyle;
      candleStyle?: CandleStyle;
      accentStyle?: AccentStyle;
      wishText?: string;
    }) => {
      soundEngine.unlock();
      writeEpochRef.current += 1;

      // Instant optimistic 3D update for zero-latency tactile feel
      setRoomState((prev) => {
        if (!prev) return prev;
        const me = prev.participants.find((p) => p.isSelf);
        const slot = me?.slot ?? 1;
        if (slot === 2) {
          return {
            ...prev,
            p2Choice: { ...prev.p2Choice, ...patch },
          };
        }
        return {
          ...prev,
          p1Choice: { ...prev.p1Choice, ...patch },
          krathong: { ...prev.krathong, ...patch },
        };
      });

      setSavingStyle(true);
      try {
        const res = await fetch(`/api/rooms/${roomId}/krathong`, {
          method: "PATCH",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "fetch",
          },
          body: JSON.stringify(patch),
        });
        if (res.ok) {
          const data = (await res.json()) as RoomStateSnapshot;
          applyServerState(data);
        }
      } catch {
        // Polling will resync
      } finally {
        setSavingStyle(false);
      }
    },
    [roomId, applyServerState],
  );

  const handleRandomizeKrathong = useCallback(() => {
    const me = roomState?.participants.find((p) => p.isSelf);
    const currentChoice =
      me?.slot === 2 ? roomState?.p2Choice : roomState?.p1Choice;
    const randomStyles = pickRandomKrathongStyles(currentChoice);
    void updateMyChoice(randomStyles);
  }, [roomState, updateMyChoice]);

  const handleWishChange = (value: string) => {
    setWishDraft(value);
    isEditingWishRef.current = true;
    setSavingWish(true);
    if (wishTimerRef.current) clearTimeout(wishTimerRef.current);
    wishTimerRef.current = setTimeout(async () => {
      await updateMyChoice({ wishText: value });
      isEditingWishRef.current = false;
      setSavingWish(false);
    }, 350);
  };

  const handleFuseAction = async (payload: {
    ready?: boolean;
    soloPreview?: boolean;
    unfuse?: boolean;
  }) => {
    soundEngine.unlock();
    writeEpochRef.current += 1;
    setBusyAction(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/ready`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch",
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = (await res.json()) as RoomStateSnapshot;
        applyServerState(data);
      }
    } finally {
      setBusyAction(false);
    }
  };

  const sendCelebrationEvent = useCallback(
    async (kind: ClientSkyKind, options?: { message?: string }) => {
      const now = Date.now();
      const last = lastLaunchTimeRef.current[kind] ?? 0;
      if (now - last < 350) return;
      lastLaunchTimeRef.current[kind] = now;

      soundEngine.unlock();
      writeEpochRef.current += 1;
      const hue = self?.slot === 2 ? "rose" : "amber";
      const x =
        kind === "sparkle"
          ? Math.round(18 + Math.random() * 64)
          : Math.round(16 + Math.random() * 68);
      const y =
        kind === "heart"
          ? 64
          : kind === "sparkle"
            ? Math.round(12 + Math.random() * 30)
            : Math.round(24 + Math.random() * 18);

      try {
        const res = await fetch(`/api/rooms/${roomId}/sky`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "fetch",
          },
          body: JSON.stringify({
            kind,
            x,
            y,
            hue,
            message: options?.message ?? "",
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as RoomStateSnapshot;
          applyServerState(data);
        }
      } catch {
        // Ignore transient failure
      }
    },
    [roomId, self?.slot, applyServerState],
  );

  const handleLaunchLanternFromModal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (launchingLantern) return;
    setLaunchingLantern(true);
    const trimmed = lanternMessage.trim().slice(0, 60);
    setLanternModalOpen(false);
    setLanternMessage("");
    await sendCelebrationEvent("lantern", { message: trimmed });
    setLaunchingLantern(false);
  };

  const handleResetKrathong = async () => {
    soundEngine.unlock();
    writeEpochRef.current += 1;
    setBusyAction(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/reset`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch",
        },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = (await res.json()) as RoomStateSnapshot;
        applyServerState(data);
      }
    } finally {
      setBusyAction(false);
    }
  };

  const inviteUrl = useMemo(() => {
    if (!storedInviteSecret || typeof window === "undefined") return null;
    return `${window.location.origin}/room/${roomId}?invite=${storedInviteSecret}`;
  }, [storedInviteSecret, roomId]);

  const handleCopyInvite = async () => {
    if (!inviteUrl) return;
    let copied = false;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied) {
      copied = copyTextFallback(inviteUrl);
    }
    setCopiedState(copied ? "copied" : "manual");
    setShowInviteInput(true);
    setTimeout(() => setCopiedState("idle"), 3000);
  };

  const handleShareInvite = async () => {
    if (!inviteUrl || !canNativeShare) return;
    try {
      await navigator.share({
        title: "มาลอยกระทงใต้แสงจันทร์ด้วยกันนะ",
        text: "เรารออยู่ริมแม่น้ำเจ้าพระยาแล้ว กดลิงก์นี้เข้ามาผสานกระทงแล้วปล่อยพร้อมกันนะ",
        url: inviteUrl,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  const postDriftSteer = useCallback(
    async (steer: number) => {
      if (steerPostingRef.current) return;
      const pending = pendingSteerRef.current;
      pendingSteerRef.current = null;
      const value = pending ?? steer;
      steerPostingRef.current = true;
      writeEpochRef.current += 1;
      try {
        const res = await fetch(`/api/rooms/${roomId}/drift`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "fetch",
          },
          body: JSON.stringify({ action: "steer", steer: value }),
        });
        if (res.ok) {
          applyServerState((await res.json()) as RoomStateSnapshot);
        }
      } catch {
        // The next poll resyncs the shared krathong.
      } finally {
        steerPostingRef.current = false;
        if (pendingSteerRef.current !== null) {
          const next = pendingSteerRef.current;
          pendingSteerRef.current = null;
          void postDriftSteer(next);
        }
      }
    },
    [roomId, applyServerState],
  );

  const lastSteerSentAtRef = useRef(0);
  const queueDriftSteer = useCallback(
    (steer: number) => {
      if (roomState?.drift.status !== "playing") return;
      pendingSteerRef.current = Math.max(-1, Math.min(1, steer));
      if (steerPostingRef.current) return;
      const wait = 120 - (Date.now() - lastSteerSentAtRef.current);
      if (wait > 0) return;
      lastSteerSentAtRef.current = Date.now();
      void postDriftSteer(pendingSteerRef.current);
    },
    [roomState?.drift.status, postDriftSteer],
  );

  const handleDriftSteer = useCallback(
    (steer: number | null) => {
      pointerSteerRef.current = steer;
      queueDriftSteer(steer ?? tiltSteerRef.current);
    },
    [queueDriftSteer],
  );

  const handleStartDrift = async () => {
    soundEngine.unlock();
    const orientation = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<PermissionState | string>;
    };
    if (typeof orientation.requestPermission === "function") {
      try {
        await orientation.requestPermission();
      } catch {
        // Tilt stays optional. Drag still steers.
      }
    }
    writeEpochRef.current += 1;
    setBusyAction(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/drift`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch",
        },
        body: JSON.stringify({ action: "start" }),
      });
      if (res.ok) {
        applyServerState((await res.json()) as RoomStateSnapshot);
      }
    } finally {
      setBusyAction(false);
    }
  };

  useEffect(() => {
    if (roomState?.drift.status !== "playing") return;
    const flush = window.setInterval(() => {
      if (steerPostingRef.current || pendingSteerRef.current === null) return;
      if (Date.now() - lastSteerSentAtRef.current < 120) return;
      lastSteerSentAtRef.current = Date.now();
      void postDriftSteer(pendingSteerRef.current);
    }, 120);
    const onTilt = (event: DeviceOrientationEvent) => {
      if (pointerSteerRef.current !== null) return;
      if (typeof event.gamma !== "number") return;
      const steer = Math.max(-1, Math.min(1, event.gamma / 26));
      tiltSteerRef.current = steer;
      queueDriftSteer(steer);
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => {
      window.clearInterval(flush);
      window.removeEventListener("deviceorientation", onTilt);
    };
  }, [roomState?.drift.status, queueDriftSteer, postDriftSteer]);

  // --- LOADING ---
  if (phase === "loading") {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#050816]">
        <ChaoPhrayaBackdrop />
        <div className="relative z-10 rounded-3xl border border-amber-200/20 bg-[#0b132e]/85 px-6 py-5 text-center backdrop-blur-xl">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber-300/30 border-t-amber-300" />
          <p className="font-display mt-3 text-sm text-amber-100">
            กำลังเปิดท่าน้ำเจ้าพระยาใต้แสงจันทร์...
          </p>
        </div>
      </main>
    );
  }

  // --- JOIN GATE FOR PARTNER 2 ---
  if (phase === "needs_join") {
    return (
      <main className="relative min-h-dvh w-full overflow-hidden">
        <div className="fixed inset-0 z-0">
          <ChaoPhrayaBackdrop />
          <div className="absolute inset-0">
            <Krathong3D
              p1Choice={DEFAULT_P1_CHOICE}
              p2Choice={DEFAULT_P2_CHOICE}
              fusionState="building"
              fusionTriggerKey={0}
              focusMode="both"
              activeSlot={2}
            />
          </div>
        </div>
        <div className="pointer-events-none fixed inset-0 z-10 bg-gradient-to-b from-[#050816]/65 via-transparent to-[#050816]/88" />
        <div className="pointer-events-none relative z-20 mx-auto flex min-h-dvh max-w-md flex-col justify-between px-5 py-8">
          <header className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-[#0b1330]/75 px-3.5 py-1 text-xs text-amber-200 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-300 shadow-[0_0_8px_#fda4af]" />
              <span>มีคนพิเศษชวนคุณมาลอยกระทงใต้แสงจันทร์</span>
            </div>
            <h1 className="font-display mt-3 text-3xl font-medium text-amber-50">
              เข้าร่วมริมแม่น้ำด้วยกัน
            </h1>
            <p className="mt-2 text-sm text-amber-100/80">
              ใส่ชื่อเล่นของคุณเพื่อผสานกระทงและปล่อยลงแม่น้ำเจ้าพระยาพร้อมกันคืนนี้
            </p>
          </header>

          <section className="pointer-events-auto rounded-3xl border border-amber-200/25 bg-[#0b132e]/88 p-5 shadow-[0_18px_50px_rgba(2,6,20,0.85)] backdrop-blur-xl sm:p-6">
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="join-nickname"
                  className="font-display block text-sm font-medium text-amber-100"
                >
                  ชื่อเล่นของคุณ
                </label>
                <input
                  id="join-nickname"
                  type="text"
                  maxLength={28}
                  autoComplete="off"
                  placeholder="ใส่ชื่อเล่นของคุณ..."
                  value={joinNickname}
                  onChange={(e) => {
                    setJoinNickname(e.target.value);
                    if (joinError) setJoinError(null);
                  }}
                  className="mt-2 w-full rounded-2xl border border-amber-200/25 bg-[#070d23]/90 px-4 py-3 text-base text-amber-50 placeholder:text-slate-400/80 focus:border-amber-300/60 focus:outline-none focus:ring-2 focus:ring-amber-300/20"
                />
              </div>

              {joinError && (
                <p className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                  {joinError}
                </p>
              )}

              <button
                type="submit"
                disabled={joining}
                className="font-display flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-amber-300 via-amber-400 to-rose-300 px-5 py-3.5 text-[15px] font-semibold text-[#15182e] shadow-[0_8px_28px_rgba(251,191,36,0.35)] transition hover:brightness-105 active:scale-[0.985] disabled:opacity-60"
              >
                {joining ? "กำลังเดินไปที่ริมน้ำ..." : "เข้าห้องไปหาคนพิเศษ"}
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  // --- UNAUTHORIZED ---
  if (phase === "unauthorized" || !roomState) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5">
        <ChaoPhrayaBackdrop />
        <div className="relative z-10 max-w-sm rounded-3xl border border-amber-200/20 bg-[#0b132e]/88 p-6 text-center backdrop-blur-xl">
          <h1 className="font-display text-xl font-medium text-amber-50">
            ห้องริมน้ำนี้เป็นพื้นที่ส่วนตัว
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-amber-100/75">
            กรุณาเปิดผ่านลิงก์เชิญที่คนพิเศษของคุณส่งให้ หรือสร้างห้องใหม่สำหรับเราสองคน
          </p>
          <Link
            href="/"
            className="font-display mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-amber-300 to-amber-400 px-5 py-3 text-sm font-semibold text-[#15182e]"
          >
            กลับไปหน้าแรกเพื่อสร้างห้องใหม่
          </Link>
        </div>
      </main>
    );
  }

  // --- AUTHENTICATED COUPLE ROOM ---
  const isBuilding = roomState.fusionState === "building";
  const isFused = roomState.fusionState === "fused";
  const isReleased = roomState.fusionState === "released";
  const showDriftGame = false;

  const selfReady = self?.slot === 2 ? roomState.p2Ready : roomState.p1Ready;
  const partnerReady =
    self?.slot === 2 ? roomState.p1Ready : roomState.p2Ready;

  const p1Name =
    roomState.participants.find((p) => p.slot === 1)?.nickname ?? "ฝั่งที่ 1";
  const p2Name =
    roomState.participants.find((p) => p.slot === 2)?.nickname ?? "รอคนพิเศษ";
  const coupleNamesLabel =
    roomState.participants.length === 2
      ? `${p1Name} ♥ ${p2Name}`
      : `${p1Name} ♥ คนพิเศษ`;

  const partnerActivityLabel = partner
    ? getActivityThaiLabel(partner.activity, partner.online)
    : "รอคนพิเศษเข้าห้อง...";

  const effectiveCameraMode: CameraFocusMode = isReleased
    ? "released"
    : isFused
      ? "fused"
      : builderOpen && builderZoomSelf
        ? "customize"
        : "both";

  const myChoice =
    self?.slot === 2 ? roomState.p2Choice : roomState.p1Choice;

  const celebrationActionRow = (
    <div
      data-celebration-bar="true"
      className="pointer-events-auto grid w-full max-w-md grid-cols-3 gap-1 rounded-2xl border border-amber-200/25 bg-[#080f27]/86 p-1.5 shadow-[0_10px_30px_rgba(2,6,20,0.78)] backdrop-blur-xl sm:max-w-xl sm:gap-2"
    >
      <button
        type="button"
        onClick={() => {
          soundEngine.unlock();
          setLanternModalOpen(true);
        }}
        className="font-display flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-amber-300/45 bg-gradient-to-b from-amber-400/90 to-amber-500/85 px-1 py-2 text-[10px] leading-tight font-semibold whitespace-nowrap text-[#15182e] shadow transition hover:brightness-105 active:scale-95 sm:flex-row sm:gap-1.5 sm:text-xs"
      >
        <span aria-hidden="true" className="text-sm">
          🏮
        </span>
        <span className="truncate">ปล่อยโคมลอย</span>
      </button>

      <button
        type="button"
        onClick={() => void sendCelebrationEvent("sparkle")}
        className="font-display flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-indigo-300/40 bg-gradient-to-b from-indigo-500/85 to-purple-600/85 px-1 py-2 text-[10px] leading-tight font-medium whitespace-nowrap text-amber-50 shadow transition hover:brightness-110 active:scale-95 sm:flex-row sm:gap-1.5 sm:text-xs"
      >
        <span aria-hidden="true" className="text-sm">
          🎆
        </span>
        <span className="truncate">จุดพลุ</span>
      </button>

      <button
        type="button"
        onClick={() => void sendCelebrationEvent("heart")}
        className="font-display flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-rose-300/45 bg-gradient-to-b from-rose-500/85 to-pink-600/85 px-1 py-2 text-[10px] leading-tight font-medium whitespace-nowrap text-rose-50 shadow transition hover:brightness-110 active:scale-95 sm:flex-row sm:gap-1.5 sm:text-xs"
      >
        <span aria-hidden="true" className="text-sm">
          💗
        </span>
        <span className="truncate">ส่งหัวใจ</span>
      </button>
    </div>
  );

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-[#050816]">
      {/* FULL-SCREEN, UNCLUTTERED 3D CHAO PHRAYA RIVER STAGE */}
      <section className="relative min-h-0 w-full flex-1 transition-all duration-700">
        <ChaoPhrayaBackdrop
          holdProgress={holdProgress}
          someoneHolding={anyoneHolding}
          released={isReleased}
        />

        <div className="absolute inset-0 z-10">
          <Krathong3D
            p1Choice={roomState.p1Choice}
            p2Choice={roomState.p2Choice}
            fusionState={roomState.fusionState}
            fusionTriggerKey={fusionTriggerKey}
            focusMode={effectiveCameraMode}
            activeSlot={self?.slot ?? 1}
            releasedAtMs={roomState.releasedAtMs}
            someoneHolding={anyoneHolding}
            skyFlashKey={skyFlashKey}
            drift={
              isReleased
                ? {
                    mode:
                      roomState.drift.status === "playing"
                        ? "playing"
                        : roomState.drift.status === "done"
                          ? "done"
                          : "off",
                    x: roomState.drift.x,
                    z: roomState.drift.z,
                    steer: roomState.drift.steer,
                    elapsedMs: roomState.drift.elapsedMs,
                    receivedAtMs: driftReceivedAtRef.current,
                    items: roomState.drift.items,
                  }
                : null
            }
            onUserOrbit={() => setOrbitHintVisible(false)}
            onFusionSignal={setFusionSignal}
            onDriftSteer={handleDriftSteer}
            onSampleWish={setSampleWish}
          />
        </div>

        <CelebrationOverlay
          visualEvents={visualEvents}
          fusionSignal={fusionSignal}
        />

        {/* CLEAN TOP BAR: PRESENCE + SOUND TOGGLE + INVITE COPY (NO SKY MODE TOGGLE!) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 mx-auto max-w-xl px-3 pt-2.5 sm:px-5 sm:pt-3.5">
          {reconnectNotice && (
            <div className="pointer-events-none mb-2 rounded-xl border border-amber-300/40 bg-amber-400/15 px-3 py-1.5 text-center text-[11px] text-amber-100 backdrop-blur-md">
              {reconnectNotice}
            </div>
          )}
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl border border-amber-200/20 bg-[#080f27]/78 px-3 py-1.5 shadow-lg backdrop-blur-md">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-amber-50">
                    {self?.nickname ?? "คุณ"}{" "}
                    <span className="text-[10px] text-amber-200/65">(คุณ)</span>
                  </div>
                  <div className="truncate text-[10px] text-amber-100/65">
                    {localHolding
                      ? "กำลังกดค้างรอปล่อยกระทง"
                      : getActivityThaiLabel(self?.activity ?? "by_river", true)}
                  </div>
                </div>
              </div>

              <span className="shrink-0 text-xs text-rose-300" aria-hidden="true">
                ♥
              </span>

              <div className="flex min-w-0 items-center justify-end gap-2 text-right">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-amber-50">
                    {partner ? partner.nickname : "รอคนพิเศษ..."}
                  </div>
                  <div className="truncate text-[10px] text-amber-100/75">
                    {partnerActivityLabel}
                  </div>
                </div>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    partner?.online
                      ? partner.holding || partner.readyToFuse
                        ? "animate-ping bg-amber-300"
                        : "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                      : "bg-slate-500"
                  }`}
                />
              </div>
            </div>

            {/* SFX Mute / Unmute Button */}
            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundMuted ? "เปิดเสียงเอฟเฟกต์" : "ปิดเสียงเอฟเฟกต์"}
              title={soundMuted ? "เปิดเสียงเอฟเฟกต์" : "ปิดเสียงเอฟเฟกต์"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-200/20 bg-[#080f27]/78 text-amber-100 shadow-lg backdrop-blur-md transition hover:border-amber-300/50 active:scale-95"
            >
              {soundMuted ? (
                <svg
                  viewBox="0 0 24 24"
                  className="h-4.5 w-4.5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                  <line x1="22" y1="9" x2="16" y2="15" />
                  <line x1="16" y1="9" x2="22" y2="15" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="h-4.5 w-4.5 text-amber-300"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              )}
            </button>
          </div>

          {/* BULLETPROOF INVITE BANNER (shown until Partner 2 joins) */}
          {!partner && inviteUrl && (
            <div className="pointer-events-auto mt-2 rounded-2xl border border-amber-300/35 bg-[#10193c]/88 px-3 py-2 shadow-lg backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display truncate text-xs font-medium text-amber-100">
                    ส่งลิงก์ชวนคนพิเศษมาลอยกระทงด้วยกัน
                  </p>
                  {copiedState === "copied" && (
                    <p className="text-[11px] font-medium text-emerald-300">
                      คัดลอกแล้ว! ส่งให้คนพิเศษได้เลย
                    </p>
                  )}
                  {copiedState === "manual" && (
                    <p className="text-[11px] text-amber-200">
                      แตะช่องลิงก์ด้านล่างเพื่อคัดลอกได้เลย
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="font-display rounded-xl bg-amber-300 px-3 py-1.5 text-xs font-semibold text-[#15182e] transition hover:brightness-105 active:scale-95"
                  >
                    {copiedState === "copied"
                      ? "คัดลอกแล้ว!"
                      : "คัดลอกลิงก์ชวนแฟน"}
                  </button>
                  {canNativeShare && (
                    <button
                      type="button"
                      onClick={handleShareInvite}
                      className="rounded-xl border border-amber-200/30 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-white/15 active:scale-95"
                    >
                      แชร์
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowInviteInput((v) => !v)}
                    className="rounded-xl border border-amber-200/20 bg-white/5 px-2 py-1.5 text-[11px] text-amber-200/80 hover:bg-white/10"
                  >
                    {showInviteInput ? "ซ่อน" : "ลิงก์"}
                  </button>
                </div>
              </div>

              {showInviteInput && (
                <div className="mt-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteUrl}
                    aria-label="ลิงก์เชิญคนพิเศษ"
                    onFocus={(e) => e.currentTarget.select()}
                    onClick={(e) => e.currentTarget.select()}
                    className="w-full rounded-xl border border-amber-200/25 bg-[#060c20]/90 px-2.5 py-1.5 font-mono text-[11px] text-amber-100 select-all focus:border-amber-300 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Left / Right partner krathong badges in building mode */}
          {isBuilding && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-[#080f27]/72 px-2.5 py-0.5 text-[11px] text-amber-100 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                <span>{p1Name}</span>
                {roomState.p1Ready && (
                  <span className="text-emerald-300">• พร้อมแล้ว</span>
                )}
              </span>

              {orbitHintVisible && (
                <span className="hidden rounded-full border border-amber-200/15 bg-[#070d23]/60 px-2.5 py-0.5 text-[10px] text-amber-100/75 backdrop-blur-sm sm:inline-block">
                  ลากหมุนดู 360°
                </span>
              )}

              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/30 bg-[#080f27]/72 px-2.5 py-0.5 text-[11px] text-rose-100 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
                <span>{p2Name}</span>
                {roomState.p2Ready && (
                  <span className="text-emerald-300">• พร้อมแล้ว</span>
                )}
              </span>
            </div>
          )}

          {isFused && (
            <div className="mt-2 flex justify-center">
              <div className="rounded-full border border-amber-300/45 bg-amber-400/20 px-3.5 py-0.5 text-[11px] font-medium text-amber-100 backdrop-blur-md">
                กระทงสองใจผสานกันแล้ว • ลากหมุนดู 360°
              </div>
            </div>
          )}

          {partnerEditNotice && (
            <div className="mt-1.5 flex justify-center">
              <div className="rounded-full border border-amber-200/35 bg-[#0b1330]/85 px-3.5 py-1 text-[11px] text-amber-100 shadow backdrop-blur-md">
                {partnerEditNotice}
              </div>
            </div>
          )}
          {/* SLEEK RELEASED KEEPSAKE PILL (stacked cleanly inside top-bar column -> zero overlap!) */}
          {isReleased && (
            <div className="mt-2 flex flex-col items-center">
              <button
                type="button"
                onClick={() => setReleasedWishesOpen((v) => !v)}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-amber-200/35 bg-[#09112b]/76 px-4 py-1.5 text-xs text-amber-50 shadow-[0_8px_24px_rgba(3,7,22,0.7)] backdrop-blur-xl transition hover:border-amber-300/60"
              >
                <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_#fde047]" />
                <span className="font-display font-medium">
                  ลอยแล้ว • {coupleNamesLabel}
                </span>
                {roomState.krathongRound > 1 && (
                  <span className="text-[10px] text-amber-200/80">
                    (ใบที่ {roomState.krathongRound})
                  </span>
                )}
                {(roomState.p1Choice.wishText || roomState.p2Choice.wishText) && (
                  <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] text-amber-200">
                    {releasedWishesOpen ? "ซ่อนคำอธิษฐาน" : "คำอธิษฐาน"}
                  </span>
                )}
              </button>

              {releasedWishesOpen &&
                (roomState.p1Choice.wishText || roomState.p2Choice.wishText) && (
                  <div className="pointer-events-auto mt-2 w-full max-w-sm space-y-1.5 rounded-2xl border border-amber-200/30 bg-[#09112b]/88 p-3 text-left shadow-2xl backdrop-blur-xl">
                    {roomState.p1Choice.wishText && (
                      <div className="rounded-xl border border-amber-200/15 bg-[#060c20]/75 px-3 py-1.5 text-xs leading-relaxed text-amber-50">
                        <span className="font-medium text-amber-300">
                          {p1Name}:{" "}
                        </span>
                        “{roomState.p1Choice.wishText}”
                      </div>
                    )}
                    {roomState.p2Choice.wishText && (
                      <div className="rounded-xl border border-rose-200/15 bg-[#060c20]/75 px-3 py-1.5 text-xs leading-relaxed text-rose-50">
                        <span className="font-medium text-rose-300">
                          {p2Name}:{" "}
                        </span>
                        “{roomState.p2Choice.wishText}”
                      </div>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>

        {/* BOTTOM CELEBRATION BAR (when building or fused, sits neatly at stage bottom) */}
        {!isReleased && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2.5 z-30 mx-auto flex max-w-xl justify-center px-3">
            {celebrationActionRow}
          </div>
        )}

        {/* RELEASED BOTTOM CONTROLS */}
        {isReleased && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3.5 z-30 mx-auto flex max-w-md flex-col items-center gap-2 px-3 sm:bottom-5 sm:max-w-xl">
            {sampleWish && (
              <button
                type="button"
                data-sample-wish="true"
                onClick={() => setSampleWish(null)}
                className="pointer-events-auto w-full rounded-2xl border border-rose-100/35 bg-[#120818]/90 px-3 py-2 text-left shadow-lg backdrop-blur-xl"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold tracking-wide text-rose-200">
                    คำอธิษฐานจากกระทงสาธารณะ
                  </span>
                  <span className="text-[10px] text-rose-100/70">แตะเพื่อปิด</span>
                </div>
                <p className="text-[10px] text-rose-100/60">ชื่อต้นหรือชื่อเล่น จากลอยกระทงกระทรวงพาณิชย์</p>
                <p className="mt-1 text-xs leading-relaxed text-rose-50">
                  <span className="font-medium text-amber-100">{sampleWish.from}: </span>
                  {sampleWish.text}
                </p>
              </button>
            )}
            {showDriftGame && (
            <div
              data-drift-panel="true"
              className="pointer-events-auto w-full rounded-2xl border border-amber-200/30 bg-[#080f27]/88 px-3 py-2 text-center shadow-lg backdrop-blur-xl"
            >
              {roomState.drift.status === "playing" ? (
                <>
                  <div className="flex items-center justify-between gap-2 text-amber-50">
                    <span data-drift-score="true" className="font-display text-sm font-semibold">
                      คะแนน {roomState.drift.score}
                    </span>
                    <span className="text-xs text-amber-100/80">
                      {Math.max(
                        0,
                        Math.ceil(
                          (roomState.drift.durationMs - roomState.drift.elapsedMs) / 1000,
                        ),
                      )}{" "}
                      วิ
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-amber-100/75">
                    ลากซ้ายขวา หรือเอียงเครื่อง เก็บโคม หลบหิน แตะกระทงใบอื่นเพื่ออ่านคำอธิษฐาน
                  </p>
                </>
              ) : roomState.drift.status === "done" ? (
                <>
                  <p data-drift-score="true" className="font-display text-sm font-semibold text-amber-50">
                    คะแนนของเรา {roomState.drift.score}
                  </p>
                  <button
                    type="button"
                    data-play-drift="true"
                    disabled={busyAction}
                    onClick={() => void handleStartDrift()}
                    className="font-display mt-1.5 rounded-full border border-amber-200/40 px-3 py-1 text-[11px] text-amber-100"
                  >
                    เล่นอีกครั้ง
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  data-play-drift="true"
                  disabled={busyAction}
                  onClick={() => void handleStartDrift()}
                  className="font-display inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-rose-200 via-amber-200 to-amber-300 px-4 py-2 text-sm font-semibold text-[#15182e]"
                >
                  เล่นเกม
                </button>
              )}
            </div>
            )}

            {celebrationActionRow}
          </div>
        )}
      </section>

      {/* SLIM, TACTILE BOTTOM DOCK: BUILDING PHASE ("แต่งกระทง" Builder + Wish Input + Ready to Fuse) */}
      {isBuilding && (
        <section className="relative z-30 shrink-0 overflow-hidden rounded-t-3xl border-t border-amber-200/20 bg-[#080f27]/95 shadow-[0_-14px_40px_rgba(2,6,20,0.82)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-xl flex-col gap-2 px-3.5 pt-2.5 pb-3 sm:px-4">
            {/* Builder Toggle Row: แต่งกระทง + สุ่มกระทง + Zoom toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-builder-toggle="true"
                  onClick={() => {
                    soundEngine.unlock();
                    setBuilderOpen((v) => !v);
                  }}
                  className={`font-display inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                    builderOpen
                      ? "border-amber-300/70 bg-amber-300 text-[#15182e] shadow-[0_0_18px_rgba(251,191,36,0.35)]"
                      : "border-amber-300/40 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25"
                  }`}
                >
                  <span aria-hidden="true">🪷</span>
                  <span>{builderOpen ? "ซ่อนแผงแต่งกระทง" : "แต่งกระทง"}</span>
                </button>

                <button
                  type="button"
                  data-randomize-krathong="true"
                  disabled={savingStyle}
                  onClick={handleRandomizeKrathong}
                  className="font-display inline-flex items-center gap-1 rounded-xl border border-rose-300/35 bg-rose-500/15 px-2.5 py-1.5 text-xs font-medium text-rose-100 transition hover:bg-rose-500/25 active:scale-95 disabled:opacity-60"
                >
                  <span aria-hidden="true">🎲</span>
                  <span>สุ่มกระทง</span>
                </button>
              </div>

              {builderOpen ? (
                <button
                  type="button"
                  onClick={() => setBuilderZoomSelf((v) => !v)}
                  className="rounded-xl border border-amber-200/25 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-amber-100/90 transition hover:bg-white/10"
                >
                  {builderZoomSelf ? "ดูคู่กัน" : "ซูมฝั่งฉัน"}
                </button>
              ) : (
                <span className="truncate text-[11px] text-amber-200/70">
                  {savingStyle ? "กำลังอัปเดต 3D..." : "แตะแต่งกระทงได้ตามใจ"}
                </span>
              )}
            </div>

            {/* Collapsible 4-Tab Tactile Krathong Builder Tray */}
            {builderOpen && (
              <div
                data-builder-tray="open"
                className="space-y-2 rounded-2xl border border-amber-200/20 bg-[#060c20]/85 p-2.5"
              >
                {/* 4 Category Tabs */}
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      { id: "base", label: "ฐานกระทง" },
                      { id: "flower", label: "ดอกไม้" },
                      { id: "candle", label: "เทียนแสง" },
                      { id: "accent", label: "ของตกแต่ง" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      data-builder-tab={tab.id}
                      onClick={() => setBuilderTab(tab.id)}
                      className={`font-display rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition ${
                        builderTab === tab.id
                          ? "bg-amber-300/95 text-[#15182e] shadow"
                          : "bg-white/5 text-amber-100/75 hover:bg-white/10"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* 4 Vivid Style Cards for Active Tab */}
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {builderTab === "base" &&
                    BASE_OPTIONS.map((opt) => {
                      const active = myChoice.baseStyle === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-style-option={`base:${opt.id}`}
                          onClick={() =>
                            void updateMyChoice({ baseStyle: opt.id })
                          }
                          className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition active:scale-[0.98] ${
                            active
                              ? "border-amber-300 bg-amber-400/20 text-amber-50 shadow-[0_0_14px_rgba(251,191,36,0.28)]"
                              : "border-white/10 bg-white/5 text-amber-100/85 hover:border-amber-200/35"
                          }`}
                        >
                          <span
                            className="h-5 w-5 shrink-0 rounded-full border border-white/35 shadow-inner"
                            style={{
                              background: `linear-gradient(135deg, ${opt.swatch}, ${opt.swatchAccent})`,
                            }}
                          />
                          <span className="font-display truncate text-[11px] font-medium">
                            {opt.shortLabel}
                          </span>
                        </button>
                      );
                    })}

                  {builderTab === "flower" &&
                    FLOWER_OPTIONS.map((opt) => {
                      const active = myChoice.flowerStyle === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-style-option={`flower:${opt.id}`}
                          onClick={() =>
                            void updateMyChoice({ flowerStyle: opt.id })
                          }
                          className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition active:scale-[0.98] ${
                            active
                              ? "border-amber-300 bg-amber-400/20 text-amber-50 shadow-[0_0_14px_rgba(251,191,36,0.28)]"
                              : "border-white/10 bg-white/5 text-amber-100/85 hover:border-amber-200/35"
                          }`}
                        >
                          <span
                            className="h-5 w-5 shrink-0 rounded-full border border-white/35 shadow-inner"
                            style={{
                              background: `linear-gradient(135deg, ${opt.swatch}, ${opt.swatchAccent})`,
                            }}
                          />
                          <span className="font-display truncate text-[11px] font-medium">
                            {opt.shortLabel}
                          </span>
                        </button>
                      );
                    })}

                  {builderTab === "candle" &&
                    CANDLE_OPTIONS.map((opt) => {
                      const active = myChoice.candleStyle === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-style-option={`candle:${opt.id}`}
                          onClick={() =>
                            void updateMyChoice({ candleStyle: opt.id })
                          }
                          className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition active:scale-[0.98] ${
                            active
                              ? "border-amber-300 bg-amber-400/20 text-amber-50 shadow-[0_0_14px_rgba(251,191,36,0.28)]"
                              : "border-white/10 bg-white/5 text-amber-100/85 hover:border-amber-200/35"
                          }`}
                        >
                          <span
                            className="h-5 w-5 shrink-0 rounded-full border border-white/35 shadow"
                            style={{
                              background: `radial-gradient(circle at 35% 35%, ${opt.swatchAccent}, ${opt.swatch})`,
                              boxShadow: `0 0 10px ${opt.swatch}88`,
                            }}
                          />
                          <span className="font-display truncate text-[11px] font-medium">
                            {opt.shortLabel}
                          </span>
                        </button>
                      );
                    })}

                  {builderTab === "accent" &&
                    ACCENT_OPTIONS.map((opt) => {
                      const active = myChoice.accentStyle === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-style-option={`accent:${opt.id}`}
                          onClick={() =>
                            void updateMyChoice({ accentStyle: opt.id })
                          }
                          className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition active:scale-[0.98] ${
                            active
                              ? "border-amber-300 bg-amber-400/20 text-amber-50 shadow-[0_0_14px_rgba(251,191,36,0.28)]"
                              : "border-white/10 bg-white/5 text-amber-100/85 hover:border-amber-200/35"
                          }`}
                        >
                          <span
                            className="h-5 w-5 shrink-0 rounded-full border border-white/35 shadow-inner"
                            style={{
                              background: `linear-gradient(135deg, ${opt.swatch}, ${opt.swatchAccent})`,
                            }}
                          />
                          <span className="font-display truncate text-[11px] font-medium">
                            {opt.shortLabel}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Compact Personal Wish Input */}
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <label
                  htmlFor="personal-wish-input"
                  className="font-display font-medium text-amber-100"
                >
                  คำอธิษฐานของคุณ ({self?.nickname ?? "คุณ"})
                </label>
                <span className="text-[10px] text-amber-200/65">
                  {savingWish ? "กำลังบันทึก..." : `${wishDraft.length}/200`}
                </span>
              </div>
              <input
                id="personal-wish-input"
                type="text"
                maxLength={200}
                placeholder="เขียนคำอธิษฐานคืนวันเพ็ญของคุณ (ไม่ใส่ก็ได้)..."
                value={wishDraft}
                onChange={(e) => handleWishChange(e.target.value)}
                onBlur={() => {
                  isEditingWishRef.current = false;
                }}
                className="w-full rounded-2xl border border-amber-200/20 bg-[#060c20]/90 px-3.5 py-2 text-sm text-amber-50 placeholder:text-slate-400/75 focus:border-amber-300/60 focus:outline-none"
              />
            </div>

            <div>
              {isSolo ? (
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => void handleFuseAction({ soloPreview: true })}
                  className="font-display flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 via-amber-400 to-rose-300 px-4 py-2.5 text-sm font-semibold text-[#15182e] shadow-[0_8px_28px_rgba(251,191,36,0.35)] transition hover:brightness-105 active:scale-[0.985] disabled:opacity-60"
                >
                  <span>ลองผสานดูตัวอย่าง</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => void handleFuseAction({ ready: !selfReady })}
                  className={`font-display flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.985] disabled:opacity-60 ${
                    selfReady
                      ? "border border-amber-300/60 bg-amber-400/20 text-amber-100"
                      : partnerReady
                        ? "animate-hold-pulse bg-gradient-to-r from-amber-300 via-amber-400 to-rose-300 text-[#15182e] shadow-[0_8px_28px_rgba(251,191,36,0.42)]"
                        : "bg-gradient-to-r from-amber-300 via-amber-400 to-orange-300 text-[#15182e] shadow-[0_8px_24px_rgba(251,191,36,0.32)]"
                  }`}
                >
                  {selfReady
                    ? `รอ ${partner?.nickname ?? "แฟน"} กดพร้อมผสาน... (แตะเพื่อยกเลิก)`
                    : partnerReady
                      ? `${partner?.nickname} พร้อมแล้ว! กดผสานกระทงเลย`
                      : "พร้อมผสานกระทง"}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* SLIM BOTTOM DOCK: FUSED PHASE (Dual 3s Press-and-Hold Release Together) */}
      {isFused && (
        <section className="relative z-30 shrink-0 overflow-hidden rounded-t-3xl border-t border-amber-200/25 bg-[#080f27]/95 shadow-[0_-14px_40px_rgba(2,6,20,0.82)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-xl flex-col gap-2.5 px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-display truncate text-sm font-medium text-amber-50">
                  กระทงสองใจของ {coupleNamesLabel} พร้อมแล้ว
                </h2>
                <p className="text-[11px] text-amber-100/70">
                  กดค้าง 3 วินาทีพร้อมกันเพื่อปล่อยลงแม่น้ำเจ้าพระยา
                </p>
              </div>
              <button
                type="button"
                disabled={busyAction}
                onClick={() => void handleFuseAction({ unfuse: true })}
                className="shrink-0 rounded-xl border border-amber-200/25 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-amber-100/85 hover:bg-white/10"
              >
                แก้คำอธิษฐาน
              </button>
            </div>

            <div className="mt-2 space-y-2">
              <HoldReleaseButton
                bothJoined={roomState.holdSync.bothJoined}
                selfHolding={localHolding}
                partnerHolding={Boolean(partner?.holding)}
                partnerName={partner?.nickname ?? null}
                holdProgress={holdProgress}
                onHoldChange={(holding) => {
                  setLocalHolding(holding);
                  void sendHoldStatus(holding);
                }}
              />
            </div>
          </div>
        </section>
      )}

      {/* DEDICATED SKY LANTERN POPUP MODAL ("ปล่อยโคมลอย") */}
      {lanternModalOpen && (
        <div
          data-lantern-modal="open"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#040714]/70 px-5 backdrop-blur-sm"
          onClick={() => setLanternModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-amber-200/35 bg-[#0c1434]/95 p-5 shadow-[0_24px_65px_rgba(2,6,20,0.9)] backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-medium text-amber-50">
                ปล่อยโคมลอยขึ้นสู่ท้องฟ้า
              </h3>
              <button
                type="button"
                onClick={() => setLanternModalOpen(false)}
                className="rounded-full px-2 py-0.5 text-xs text-amber-200/70 hover:text-amber-50"
              >
                ปิด
              </button>
            </div>
            <p className="mt-1 text-xs text-amber-100/75">
              โคมลอยจะลอยขึ้นบนท้องฟ้าของทั้งสองคนพร้อมกัน และแตะอ่านข้อความได้
            </p>

            <form
              onSubmit={handleLaunchLanternFromModal}
              className="mt-3.5 space-y-3"
            >
              <div>
                <input
                  type="text"
                  autoFocus
                  maxLength={60}
                  value={lanternMessage}
                  onChange={(e) => setLanternMessage(e.target.value)}
                  placeholder="เขียนคำอธิษฐานติดโคม (ไม่ใส่ก็ได้)"
                  className="w-full rounded-2xl border border-amber-200/25 bg-[#060c20]/90 px-3.5 py-2.5 text-sm text-amber-50 placeholder:text-slate-400/80 focus:border-amber-300/70 focus:outline-none"
                />
                <div className="mt-1 text-right text-[10px] text-amber-200/60">
                  {lanternMessage.length}/60
                </div>
              </div>

              <button
                type="submit"
                disabled={launchingLantern}
                className="font-display flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 via-amber-400 to-orange-300 px-4 py-3 text-sm font-semibold text-[#15182e] shadow-[0_8px_24px_rgba(251,191,36,0.35)] transition hover:brightness-105 active:scale-[0.985]"
              >
                <span>ปล่อยโคมทันที</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
