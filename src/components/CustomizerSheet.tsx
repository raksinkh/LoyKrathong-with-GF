"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACCENT_OPTIONS,
  BASE_OPTIONS,
  CANDLE_OPTIONS,
  FLOWER_OPTIONS,
  MAX_WISH_LENGTH,
  type KrathongConfig,
} from "@/lib/types";

type TabId = "base" | "flowers" | "candle" | "accent" | "wish";

interface CustomizerSheetProps {
  krathong: KrathongConfig;
  onPatch: (patch: Partial<KrathongConfig>) => void;
  saving?: boolean;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "base", label: "ฐานกระทง" },
  { id: "flowers", label: "ดอกไม้" },
  { id: "candle", label: "สีเทียน" },
  { id: "accent", label: "ของคู่รัก" },
  { id: "wish", label: "คำอธิษฐาน" },
];

export function CustomizerSheet({
  krathong,
  onPatch,
  saving = false,
}: CustomizerSheetProps) {
  const [activeTab, setActiveTab] = useState<TabId>("base");
  const [wishDraft, setWishDraft] = useState(krathong.wish);
  const [isEditingWish, setIsEditingWish] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isEditingWish) {
      setWishDraft(krathong.wish);
    }
  }, [krathong.wish, isEditingWish]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleWishChange = (value: string) => {
    const trimmedMax = value.slice(0, MAX_WISH_LENGTH);
    setWishDraft(trimmedMax);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onPatch({ wish: trimmedMax });
    }, 550);
  };

  const handleWishBlur = () => {
    setIsEditingWish(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (wishDraft.trim() !== krathong.wish) {
      onPatch({ wish: wishDraft.trim() });
    }
  };

  return (
    <section
      aria-label="แต่งกระทงร่วมกัน"
      className="glass-panel rounded-3xl px-3.5 py-3 sm:px-4 sm:py-3.5 shadow-[0_-8px_32px_rgba(0,0,0,0.45)]"
    >
      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2.5">
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                active
                  ? "bg-amber-400/25 text-amber-100 border border-amber-300/50 shadow-[0_0_12px_rgba(251,191,36,0.2)]"
                  : "bg-slate-900/45 text-indigo-200/75 border border-white/8 hover:text-amber-100"
              }`}
            >
              {tab.label}
              {tab.id === "wish" && krathong.wish.trim().length > 0 && (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-300 align-middle" />
              )}
            </button>
          );
        })}
        {saving && (
          <span className="ml-auto shrink-0 text-[10px] text-amber-200/70 pr-1">
            กำลังซิงก์...
          </span>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === "base" && (
        <div className="grid grid-cols-3 gap-2">
          {BASE_OPTIONS.map((opt) => {
            const selected = krathong.base === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPatch({ base: opt.id })}
                className={`group rounded-2xl p-2.5 text-left transition-all cursor-pointer border ${
                  selected
                    ? "bg-amber-400/18 border-amber-300/65 shadow-[0_0_16px_rgba(251,191,36,0.22)]"
                    : "bg-slate-900/45 border-white/10 hover:border-amber-200/35"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`h-5 w-5 rounded-full bg-gradient-to-br ${opt.swatch} ring-1 ring-white/25`}
                  />
                  {selected && (
                    <span className="text-amber-300" aria-hidden="true">
                      <svg viewBox="0 0 16 16" className="h-4 w-4">
                        <path
                          d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="text-xs font-medium text-amber-50 leading-snug">
                  {opt.label}
                </div>
                <div className="mt-0.5 text-[10px] text-indigo-200/70 line-clamp-2 hidden sm:block">
                  {opt.desc}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {activeTab === "flowers" && (
        <div className="grid grid-cols-3 gap-2">
          {FLOWER_OPTIONS.map((opt) => {
            const selected = krathong.flowers === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPatch({ flowers: opt.id })}
                className={`group rounded-2xl p-2.5 text-left transition-all cursor-pointer border ${
                  selected
                    ? "bg-amber-400/18 border-amber-300/65 shadow-[0_0_16px_rgba(251,191,36,0.22)]"
                    : "bg-slate-900/45 border-white/10 hover:border-amber-200/35"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`h-5 w-5 rounded-full bg-gradient-to-br ${opt.swatch} ring-1 ring-white/25`}
                  />
                  {selected && (
                    <span className="text-amber-300" aria-hidden="true">
                      <svg viewBox="0 0 16 16" className="h-4 w-4">
                        <path
                          d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="text-xs font-medium text-amber-50 leading-snug">
                  {opt.label}
                </div>
                <div className="mt-0.5 text-[10px] text-indigo-200/70 line-clamp-2 hidden sm:block">
                  {opt.desc}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {activeTab === "candle" && (
        <div className="grid grid-cols-3 gap-2">
          {CANDLE_OPTIONS.map((opt) => {
            const selected = krathong.candle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPatch({ candle: opt.id })}
                className={`group rounded-2xl p-2.5 text-left transition-all cursor-pointer border ${
                  selected
                    ? "bg-amber-400/18 border-amber-300/65 shadow-[0_0_16px_rgba(251,191,36,0.22)]"
                    : "bg-slate-900/45 border-white/10 hover:border-amber-200/35"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`h-5 w-5 rounded-full bg-gradient-to-br ${opt.swatch} ring-1 ring-white/25`}
                  />
                  {selected && (
                    <span className="text-amber-300" aria-hidden="true">
                      <svg viewBox="0 0 16 16" className="h-4 w-4">
                        <path
                          d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="text-xs font-medium text-amber-50 leading-snug">
                  {opt.label}
                </div>
                <div className="mt-0.5 text-[10px] text-indigo-200/70 line-clamp-2 hidden sm:block">
                  {opt.desc}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {activeTab === "accent" && (
        <div className="grid grid-cols-3 gap-2">
          {ACCENT_OPTIONS.map((opt) => {
            const selected = krathong.accent === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPatch({ accent: opt.id })}
                className={`group rounded-2xl p-2.5 text-left transition-all cursor-pointer border ${
                  selected
                    ? "bg-amber-400/18 border-amber-300/65 shadow-[0_0_16px_rgba(251,191,36,0.22)]"
                    : "bg-slate-900/45 border-white/10 hover:border-amber-200/35"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`h-5 w-5 rounded-full bg-gradient-to-br ${opt.swatch} ring-1 ring-white/25`}
                  />
                  {selected && (
                    <span className="text-amber-300" aria-hidden="true">
                      <svg viewBox="0 0 16 16" className="h-4 w-4">
                        <path
                          d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="text-xs font-medium text-amber-50 leading-snug">
                  {opt.label}
                </div>
                <div className="mt-0.5 text-[10px] text-indigo-200/70 line-clamp-2 hidden sm:block">
                  {opt.desc}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {activeTab === "wish" && (
        <div className="space-y-1.5">
          <textarea
            value={wishDraft}
            onFocus={() => setIsEditingWish(true)}
            onBlur={handleWishBlur}
            onChange={(e) => handleWishChange(e.target.value)}
            maxLength={MAX_WISH_LENGTH}
            rows={2}
            placeholder="เขียนคำอธิษฐานร่วมกันคืนนี้ เช่น ขอให้เราได้เจอกันไวๆ และอยู่ข้างกันทุกคืนเพ็ญ..."
            className="w-full resize-none rounded-2xl bg-[#070d24]/80 border border-amber-200/25 px-3.5 py-2.5 text-sm text-amber-50 placeholder:text-indigo-200/45 focus:outline-none focus:border-amber-300/65"
          />
          <div className="flex items-center justify-between text-[11px] text-indigo-200/70 px-1">
            <span>แสดงใต้แสงจันทร์เมื่อปล่อยกระทงพร้อมกัน</span>
            <span>
              {wishDraft.length}/{MAX_WISH_LENGTH}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
