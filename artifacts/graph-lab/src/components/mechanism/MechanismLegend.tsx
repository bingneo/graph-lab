/**
 * MechanismLegend
 *
 * A compact, collapsible legend panel for the Mechanism Graph.
 * Rendered as a floating overlay inside the canvas area (absolute positioned, bottom-right).
 * Toggle is a small "图例" pill button.
 *
 * Sections:
 *  1. 连线类型  — main transition (solid) vs compare (dashed)
 *  2. 研发阶段  — 7 block types with color + icon
 *  3. 阶段状态  — 4 block statuses with status dot
 *  4. 筛选说明  — dim = unmatched but context preserved
 */

import { useState } from "react";

// ─── Type & status data (mirrors the block node design system) ────────────────

const BLOCK_TYPES = [
  { icon: "⚗",  label: "系统建立", color: "bg-sky-500"     },
  { icon: "◈",  label: "条件探索", color: "bg-indigo-500"  },
  { icon: "⊛",  label: "参数优化", color: "bg-violet-600"  },
  { icon: "↺",  label: "重复验证", color: "bg-teal-500"    },
  { icon: "◎",  label: "测量验证", color: "bg-orange-500"  },
  { icon: "✓",  label: "结果确认", color: "bg-emerald-600" },
  { icon: "⊕",  label: "综合推进", color: "bg-slate-500"   },
] as const;

const BLOCK_STATUSES = [
  { dot: "bg-blue-400",    label: "探索中" },
  { dot: "bg-violet-500",  label: "整合中" },
  { dot: "bg-emerald-500", label: "已归档" },
  { dot: "bg-orange-400",  label: "调整中" },
] as const;

// ─── Section heading ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {children}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MechanismLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-10 right-3 z-10 flex flex-col items-end gap-2">
      {/* Panel */}
      {open && (
        <div className="w-56 bg-white rounded-xl border border-slate-200 shadow-xl p-3.5 flex flex-col gap-3.5">

          {/* 1. 连线类型 */}
          <Section title="连线">
            <div className="flex items-center gap-2.5">
              {/* Solid line */}
              <svg width="36" height="10" className="shrink-0">
                <line x1="0" y1="5" x2="30" y2="5" stroke="#94A3B8" strokeWidth="2" />
                <polygon points="30,2 36,5 30,8" fill="#94A3B8" />
              </svg>
              <span className="text-[12px] text-slate-600">主链推进</span>
            </div>
            <div className="flex items-center gap-2.5">
              {/* Dashed line */}
              <svg width="36" height="10" className="shrink-0">
                <line x1="0" y1="5" x2="30" y2="5" stroke="#8B5CF6" strokeWidth="2" strokeDasharray="4,3" />
                <polygon points="30,2 36,5 30,8" fill="#8B5CF6" />
              </svg>
              <span className="text-[12px] text-slate-600">阶段对比</span>
            </div>
          </Section>

          <div className="border-t border-slate-100" />

          {/* 2. 研发阶段类型 */}
          <Section title="研发阶段">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
              {BLOCK_TYPES.map((t) => (
                <div key={t.label} className="flex items-center gap-1.5 min-w-0">
                  <span className={`${t.color} w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                    {t.icon}
                  </span>
                  <span className="text-[11px] text-slate-600 truncate">{t.label}</span>
                </div>
              ))}
            </div>
          </Section>

          <div className="border-t border-slate-100" />

          {/* 3. 阶段状态 */}
          <Section title="阶段状态">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
              {BLOCK_STATUSES.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span className={`${s.dot} w-2 h-2 rounded-full shrink-0`} />
                  <span className="text-[11px] text-slate-600">{s.label}</span>
                </div>
              ))}
            </div>
          </Section>

          <div className="border-t border-slate-100" />

          {/* 4. 筛选说明 */}
          <Section title="筛选">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-5 rounded border-2 border-slate-300 bg-white shrink-0" />
                <span className="text-[11px] text-slate-600">命中阶段（正常显示）</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-5 rounded border-2 border-slate-200 bg-slate-100 opacity-30 shrink-0" />
                <span className="text-[11px] text-slate-500">未命中（保留上下文）</span>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "text-[11px] font-semibold px-3 py-1.5 rounded-full border shadow-sm transition-all select-none",
          open
            ? "bg-violet-600 text-white border-violet-700 shadow-violet-200"
            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700",
        ].join(" ")}
      >
        {open ? "✕ 关闭图例" : "? 图例"}
      </button>
    </div>
  );
}
