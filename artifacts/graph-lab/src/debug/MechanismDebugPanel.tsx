/**
 * MechanismDebugPanel
 *
 * Dev-only floating panel (bottom-left of canvas area).
 * Provides one-click buttons to reach every verifiable state in the graph.
 * Never rendered when import.meta.env.DEV === false.
 *
 * Receives all page-level state setters so it can directly manipulate state
 * without adding any debug logic into the business-logic layer.
 */

import { useState } from "react";
import type { MechanismChainGraph, MechanismBlock } from "@/api/types";
import type { FilterState } from "@/utils/filterBlocks";
import { emptyFilterState } from "@/utils/filterBlocks";
import { MOCK_MECHANISM_GRAPH, MOCK_IDS } from "./mechanismDebugFixtures";

// ─── Page-level setters passed in from MechanismGraphPage ─────────────────────

export interface DebugPanelActions {
  setChainState: (s: { data: MechanismChainGraph | null; isLoading: boolean; error: string | null }) => void;
  setOverlay: (o: unknown) => void;
  setIsCompareMode: (v: boolean) => void;
  setCompareSelection: (s: [string | null, string | null]) => void;
  setFilterState: (f: FilterState) => void;
  reloadFromApi: () => void;
  graph: MechanismChainGraph | null;
}

// ─── Section component ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">{title}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Btn({
  label,
  onClick,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger" | "success" | "purple";
}) {
  const cls = {
    default: "bg-white text-slate-600 border-slate-200 hover:border-slate-400",
    danger:  "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
    purple:  "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
  }[variant];

  return (
    <button
      onClick={onClick}
      className={`text-[10px] font-medium px-2 py-0.5 rounded border transition-colors text-left ${cls}`}
    >
      {label}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MechanismDebugPanel({
  setChainState,
  setOverlay,
  setIsCompareMode,
  setCompareSelection,
  setFilterState,
  reloadFromApi,
  graph,
}: DebugPanelActions) {
  const [open, setOpen] = useState(false);

  if (!import.meta.env.DEV) return null;

  // Use mock or real block IDs depending on what's loaded
  const isMock = graph?.sci_note_id === "mock-demo";
  const blocks: MechanismBlock[] = graph?.blocks ?? [];
  const b0 = blocks[0]?.id ?? MOCK_IDS.b1;
  const b1 = blocks[1]?.id ?? MOCK_IDS.b2;
  const b3 = blocks[3]?.id ?? MOCK_IDS.b4;
  const projectId = graph?.project_node?.id ?? MOCK_IDS.project;

  function loadMock() {
    setChainState({ data: MOCK_MECHANISM_GRAPH, isLoading: false, error: null });
    setOverlay(null);
    setIsCompareMode(false);
    setCompareSelection([null, null]);
    setFilterState(emptyFilterState());
  }

  function loadReal() {
    reloadFromApi();
  }

  return (
    <div className="absolute bottom-10 left-3 z-20 flex flex-col items-start gap-2">
      {/* Panel */}
      {open && (
        <div className="w-52 bg-white rounded-xl border-2 border-violet-200 shadow-2xl p-3 flex flex-col gap-2 max-h-[80vh] overflow-y-auto">

          {/* Header */}
          <div className="flex items-center gap-1.5">
            <span className="text-violet-500 text-sm">🛠</span>
            <p className="text-[11px] font-bold text-violet-700">Debug Panel</p>
            <span className="ml-auto text-[9px] text-slate-300 font-mono">DEV ONLY</span>
          </div>

          <div className="border-t border-slate-100" />

          {/* ── Data source ── */}
          <Section title="数据源">
            <Btn label="▶ 加载 Mock 演示数据 (5 blocks)" onClick={loadMock} variant="purple" />
            <Btn label={`↺ 重新请求真实 API ${isMock ? "(当前: Mock)" : "(当前: 真实)"}`} onClick={loadReal} />
          </Section>

          {/* ── State overrides ── */}
          <Section title="特殊状态">
            <Btn label="⬡ 触发空状态" onClick={() => {
              setChainState({ data: null, isLoading: false, error: null });
              setOverlay(null);
            }} />
            <Btn label="⚠ 触发错误状态" onClick={() => {
              setChainState({ data: null, isLoading: false, error: "DEBUG: 模拟 API 请求失败 (timeout)" });
              setOverlay(null);
            }} variant="danger" />
            <Btn label="⌛ 触发加载中" onClick={() => {
              setChainState({ data: null, isLoading: true, error: null });
              setOverlay(null);
            }} />
          </Section>

          {/* ── Dialogs ── */}
          <Section title="打开 Dialog">
            <Btn label="→ Block Detail (阶段 1)" onClick={() => {
              setOverlay({ type: "block-detail", blockId: b0 });
            }} />
            <Btn label="→ Block Detail (阶段 2)" onClick={() => {
              setOverlay({ type: "block-detail", blockId: b1 });
            }} />
            <Btn label="→ Init Transition (阶段 1)" onClick={() => {
              setOverlay({ type: "init-transition-detail", targetBlockId: b0 });
            }} />
            <Btn label="→ Main Transition (1→2)" onClick={() => {
              setOverlay({ type: "main-transition-detail", sourceBlockId: b0, targetBlockId: b1 });
            }} />
            <Btn label="→ Compare Dialog (1 vs 4)" onClick={() => {
              setOverlay({ type: "compare-transition-detail", blockIdA: b0, blockIdB: b3 });
            }} variant="purple" />
          </Section>

          {/* ── Compare mode ── */}
          <Section title="Compare Mode">
            <Btn label="⊕ 进入 Compare Mode (空)" onClick={() => {
              setIsCompareMode(true);
              setCompareSelection([null, null]);
              setOverlay(null);
            }} variant="purple" />
            <Btn label="⊕ Compare Mode + 已选 A" onClick={() => {
              setIsCompareMode(true);
              setCompareSelection([b0, null]);
              setOverlay(null);
            }} variant="purple" />
            <Btn label="⊕ Compare Mode + A+B 完整" onClick={() => {
              setIsCompareMode(true);
              setCompareSelection([b0, b3]);
              setOverlay({ type: "compare-transition-detail", blockIdA: b0, blockIdB: b3 });
            }} variant="purple" />
            <Btn label="✕ 退出 Compare Mode" onClick={() => {
              setIsCompareMode(false);
              setCompareSelection([null, null]);
              setOverlay(null);
            }} />
          </Section>

          {/* ── Filters ── */}
          <Section title="筛选场景">
            <Btn label="✗ 筛选无结果（触发 NoResults）" onClick={() => {
              setFilterState({
                selectedTags: [],
                selectedBlockTypes: ["mixed_progression"],
                selectedStatuses: [],
                focusMode: null,
              });
            }} variant="danger" />
            <Btn label="● 聚焦失败链路" onClick={() => {
              setFilterState({ ...emptyFilterState(), focusMode: "failed" });
            }} />
            <Btn label="● 聚焦验证链路" onClick={() => {
              setFilterState({ ...emptyFilterState(), focusMode: "validated" });
            }} variant="success" />
            <Btn label="● 聚焦确认链路" onClick={() => {
              setFilterState({ ...emptyFilterState(), focusMode: "confirmed" });
            }} variant="success" />
            <Btn label="↺ 清空筛选" onClick={() => setFilterState(emptyFilterState())} />
          </Section>

          {/* ── URL helpers ── */}
          <Section title="URL 快捷链接">
            <p className="text-[9px] text-slate-400 leading-relaxed">
              在地址栏添加参数可自动进入调试状态：
            </p>
            <div className="text-[9px] font-mono text-slate-400 bg-slate-50 rounded p-1.5 leading-relaxed select-all">
              {"?debug=1&mock=1"}<br />
              {"&overlay=compare"}<br />
              {"&aId=block:mock:1"}<br />
              {"&bId=block:mock:4"}
            </div>
          </Section>

          {/* Footer */}
          <div className="border-t border-slate-100 pt-1">
            <p className="text-[9px] text-slate-300 text-center">
              仅在 DEV 模式显示 · 生产环境不可见
            </p>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "text-[10px] font-bold px-3 py-1.5 rounded-full border-2 shadow-sm transition-all select-none flex items-center gap-1.5",
          open
            ? "bg-violet-600 text-white border-violet-700"
            : "bg-violet-50 text-violet-600 border-violet-200 hover:border-violet-400",
        ].join(" ")}
      >
        🛠 {open ? "关闭调试面板" : "调试面板"}
      </button>
    </div>
  );
}
