/**
 * MechanismGraphPage
 *
 * Full-screen mechanism chain view. Owns all page state:
 *
 * ── Normal mode ──────────────────────────────────────────────────────────────
 *   Block click  → overlay: "block-detail"
 *   Main edge    → overlay: "main-transition-detail"
 *   Init edge    → overlay: "init-transition-detail"
 *
 * ── Compare mode ─────────────────────────────────────────────────────────────
 *   isCompareMode = true
 *   compareSelection: [blockIdA | null, blockIdB | null]
 *   Block click (1st) → compareSelection = [A, null]
 *   Block click (2nd) → compareSelection = [A, B] + overlay: "compare-transition-detail"
 *   Compare edge click → re-open overlay: "compare-transition-detail"
 *   Exit compare → clear all compare state
 *
 * ── Record navigation ────────────────────────────────────────────────────────
 *   Clicking a record inside BlockDetailDialog calls onRecordNavigate(recordId),
 *   which lives in GraphLabPage and switches to the lineage tab + loads snapshot.
 */

import { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import type { MechanismChainGraph, MechanismBlock } from "@/api/types";
import { fetchMechanismChain } from "@/api/graphApi";
// ── Debug imports ─────────────────────────────────────────────────────────────
// parseMechanismDebugQuery: static import kept — it is a tiny (~400 B) utility
// whose internal guard (if (!import.meta.env.DEV) return NULL_CONFIG) already
// makes it a no-op in production. Synchronous access is required by useMemo.
import { parseMechanismDebugQuery } from "@/debug/parseMechanismDebugQuery";
// DebugPanelActions: type-only import — completely erased at build time (zero
// runtime cost; Rollup never sees MechanismDebugPanel as a runtime dependency).
import type { DebugPanelActions } from "@/debug/MechanismDebugPanel";
// MOCK_MECHANISM_GRAPH and MechanismDebugPanel are loaded exclusively via
// _devBundle through a conditional dynamic import() so they never enter
// the production bundle (Vite replaces import.meta.env.DEV → false, Rollup
// eliminates the unreachable import() call and the entire _devBundle module).
const LazyMechanismDebugPanel: ReturnType<
  typeof lazy<React.ComponentType<DebugPanelActions>>
> | null = import.meta.env.DEV
  ? lazy(() =>
      import("@/debug/_devBundle").then((m) => ({ default: m.MechanismDebugPanel }))
    )
  : null;
import { MechanismGraphCanvas } from "@/components/mechanism/MechanismGraphCanvas";
import { FilterBar } from "@/components/mechanism/FilterBar";
import { MechanismLegend } from "@/components/mechanism/MechanismLegend";
import { MechanismHints } from "@/components/mechanism/MechanismHints";
import { MechanismNoResults } from "@/components/mechanism/MechanismNoResults";
import {
  MechanismLoadingState,
  MechanismEmptyState,
  MechanismErrorState,
} from "@/components/mechanism/MechanismEmptyState";
import { BlockDetailDialog } from "@/components/mechanism/dialogs/BlockDetailDialog";
import { MainTransitionDialog } from "@/components/mechanism/dialogs/MainTransitionDialog";
import { InitTransitionDialog } from "@/components/mechanism/dialogs/InitTransitionDialog";
import { CompareTransitionDialog } from "@/components/mechanism/dialogs/CompareTransitionDialog";
import {
  emptyFilterState,
  computeFilterResult,
  type FilterState,
} from "@/utils/filterBlocks";

// ─── Overlay state (discriminated union) ───────────────────────────────────────

type OverlayState =
  | { type: "block-detail"; blockId: string }
  | { type: "main-transition-detail"; sourceBlockId: string; targetBlockId: string }
  | { type: "init-transition-detail"; targetBlockId: string }
  | { type: "compare-transition-detail"; blockIdA: string; blockIdB: string };

// ─── Async state ───────────────────────────────────────────────────────────────

interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MechanismGraphPageProps {
  sciNoteId: string;
  onRecordNavigate: (recordId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MechanismGraphPage({
  sciNoteId,
  onRecordNavigate,
}: MechanismGraphPageProps) {
  // ── Graph data ────────────────────────────────────────────────────────────
  const [chainState, setChainState] = useState<AsyncState<MechanismChainGraph>>({
    data: null,
    isLoading: false,
    error: null,
  });

  // ── Overlay state (page-level, not in node components) ────────────────────
  const [overlay, setOverlay] = useState<OverlayState | null>(null);

  // ── Compare mode state ────────────────────────────────────────────────────
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<[string | null, string | null]>([null, null]);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filterState, setFilterState] = useState<FilterState>(emptyFilterState());

  // ── Debug config (parsed once from URL, constant for the component's life) ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debugConfig = useMemo(() => parseMechanismDebugQuery(), []);

  // ── Apply debug initial state (overlay, compare mode) after graph loads ────
  const applyDebugInitialState = useCallback(() => {
    if (!import.meta.env.DEV) return;
    const cfg = debugConfig;

    // Initial overlay
    if (cfg.initialOverlay) {
      const ov = cfg.initialOverlay;
      if (ov.type === "block-detail")
        setOverlay({ type: "block-detail", blockId: ov.blockId });
      else if (ov.type === "main-transition")
        setOverlay({ type: "main-transition-detail", sourceBlockId: ov.srcId, targetBlockId: ov.tgtId });
      else if (ov.type === "init-transition")
        setOverlay({ type: "init-transition-detail", targetBlockId: ov.tgtId });
      else if (ov.type === "compare")
        setOverlay({ type: "compare-transition-detail", blockIdA: ov.aId, blockIdB: ov.bId });
    }

    // Compare mode
    if (cfg.compareMode || cfg.compareA) {
      setIsCompareMode(true);
      setCompareSelection([cfg.compareA, cfg.compareB]);
    }

    // Filter no-results scenario
    if (cfg.filterNoResults) {
      setFilterState({
        selectedTags: [],
        selectedBlockTypes: ["mixed_progression"],
        selectedStatuses: [],
        focusMode: null,
      });
    }
  }, [debugConfig]);

  // Store applyDebugInitialState in a ref so loadGraph can access latest without dep change
  const applyDebugRef = useRef(applyDebugInitialState);
  applyDebugRef.current = applyDebugInitialState;

  // ── Load graph (also used as retry handler) ────────────────────────────────

  const loadGraph = useCallback(() => {
    setChainState({ data: null, isLoading: true, error: null });
    setOverlay(null);
    setIsCompareMode(false);
    setCompareSelection([null, null]);
    setFilterState(emptyFilterState());

    // ── Dev-mode overrides (guarded so Vite can tree-shake in prod) ───────────
    if (import.meta.env.DEV) {
      if (debugConfig.forceEmpty) {
        setChainState({ data: null, isLoading: false, error: null });
        return () => {};
      }
      if (debugConfig.forceError) {
        setChainState({ data: null, isLoading: false, error: "DEBUG: 模拟 API 错误 (timeout)" });
        return () => {};
      }
      if (debugConfig.useMock) {
        // Dynamic import — Vite eliminates this entire call in production
        void import("@/debug/_devBundle").then(({ MOCK_MECHANISM_GRAPH: mockGraph }) => {
          setChainState({ data: mockGraph as unknown as MechanismChainGraph, isLoading: false, error: null });
          // Apply overlays on next tick so state has settled
          setTimeout(() => applyDebugRef.current(), 0);
        });
        return () => {};
      }
    }

    // ── Normal API path ───────────────────────────────────────────────────────
    let cancelled = false;
    fetchMechanismChain(sciNoteId)
      .then((data) => {
        if (!cancelled) {
          setChainState({ data, isLoading: false, error: null });
          if (import.meta.env.DEV) setTimeout(() => applyDebugRef.current(), 0);
        }
      })
      .catch((err) => {
        if (!cancelled)
          setChainState({
            data: null,
            isLoading: false,
            error: err instanceof Error ? err.message : "加载机制主链失败",
          });
      });

    return () => { cancelled = true; };
  }, [sciNoteId, debugConfig]);

  // ── Load on sciNoteId change ──────────────────────────────────────────────

  useEffect(() => {
    return loadGraph();
  }, [loadGraph]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const findBlock = useCallback(
    (id: string): MechanismBlock | null =>
      chainState.data?.blocks.find((b) => b.id === id) ?? null,
    [chainState.data],
  );

  // ── Compare mode handlers ──────────────────────────────────────────────────

  const enterCompareMode = useCallback(() => {
    setIsCompareMode(true);
    setCompareSelection([null, null]);
    setOverlay(null);
  }, []);

  const exitCompareMode = useCallback(() => {
    setIsCompareMode(false);
    setCompareSelection([null, null]);
    setOverlay(null);
  }, []);

  // ── Block click handler ────────────────────────────────────────────────────

  const handleBlockClick = useCallback(
    (blockId: string) => {
      if (!isCompareMode) {
        // Normal mode: open block detail dialog
        setOverlay({ type: "block-detail", blockId });
        return;
      }

      // Compare mode: fill the two-slot selection
      setCompareSelection((prev) => {
        const [a, b] = prev;

        if (a === null) {
          // First slot
          return [blockId, null];
        }

        if (b === null && blockId !== a) {
          // Second slot: both selected → open compare dialog
          setOverlay({
            type: "compare-transition-detail",
            blockIdA: a,
            blockIdB: blockId,
          });
          return [a, blockId];
        }

        // Already have both, or clicking same block: restart selection
        setOverlay(null);
        return [blockId, null];
      });
    },
    [isCompareMode],
  );

  // ── Edge click handler ─────────────────────────────────────────────────────

  const handleEdgeClick = useCallback(
    (edgeId: string, sourceId: string, targetId: string) => {
      if (edgeId.startsWith("compare:")) {
        // Re-open compare dialog from the dashed edge
        setCompareSelection((prev) => {
          const [a, b] = prev;
          if (a && b) {
            setOverlay({ type: "compare-transition-detail", blockIdA: a, blockIdB: b });
          }
          return prev;
        });
        return;
      }

      if (sourceId.startsWith("project:")) {
        setOverlay({ type: "init-transition-detail", targetBlockId: targetId });
      } else {
        setOverlay({
          type: "main-transition-detail",
          sourceBlockId: sourceId,
          targetBlockId: targetId,
        });
      }
    },
    [],
  );

  const handleCloseOverlay = useCallback(() => setOverlay(null), []);

  // ── Compare mode status label (must be above early returns) ─────────────────

  const { compareStatusLabel, compareStatusDone } = useMemo(() => {
    const [a, b] = compareSelection;
    if (a === null) {
      return { compareStatusLabel: "已进入比较模式 · 请选择第一个阶段", compareStatusDone: false };
    }
    if (b === null) {
      const blockA = findBlock(a);
      const name = blockA ? blockA.stage_label.replace(/^阶段 \d+[：:]/, "").trim() : "阶段";
      return { compareStatusLabel: `已选「${name}」· 请再选择第二个阶段`, compareStatusDone: false };
    }
    return { compareStatusLabel: "已完成对比 · 可点击虚线重新查看差异", compareStatusDone: true };
  }, [compareSelection, findBlock]);

  // ── Filter result (pure computation, no side effects) ─────────────────────

  const filterResult = useMemo(() => {
    if (!chainState.data) return null;
    return computeFilterResult(chainState.data, filterState);
  }, [chainState.data, filterState]);

  // ── Loading / error / empty state ─────────────────────────────────────────

  const { data: graph, isLoading, error } = chainState;

  if (isLoading) return <MechanismLoadingState />;
  if (error) return <MechanismErrorState message={error} onRetry={loadGraph} />;
  if (!graph || graph.blocks.length === 0) return <MechanismEmptyState />;

  // ── Derive dialog data from overlay state ──────────────────────────────────

  const blockDetailBlock =
    overlay?.type === "block-detail" ? findBlock(overlay.blockId) : null;

  const mainSrc =
    overlay?.type === "main-transition-detail"
      ? findBlock(overlay.sourceBlockId)
      : null;
  const mainTgt =
    overlay?.type === "main-transition-detail"
      ? findBlock(overlay.targetBlockId)
      : null;

  const initProject =
    overlay?.type === "init-transition-detail" ? graph.project_node : null;
  const initBlock =
    overlay?.type === "init-transition-detail"
      ? findBlock(overlay.targetBlockId)
      : null;

  const compareBlockA =
    overlay?.type === "compare-transition-detail"
      ? findBlock(overlay.blockIdA)
      : null;
  const compareBlockB =
    overlay?.type === "compare-transition-detail"
      ? findBlock(overlay.blockIdB)
      : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 min-h-0 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">

      {/* ── Toolbar / stats bar ── */}
      <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-3 shrink-0 bg-white">
        {/* Project info */}
        <span className="font-semibold text-slate-700 text-sm">
          {graph.project_node.label}
        </span>
        <span className="text-slate-200 text-xs">·</span>
        <span className="text-[12px] text-slate-500">
          {graph.project_node.total_blocks} 个研发阶段
        </span>
        <span className="text-slate-200 text-xs">·</span>
        <span className="text-[12px] text-slate-500">
          {graph.project_node.total_records} 条实验记录
        </span>

        {/* Compare mode status indicator */}
        {isCompareMode && (
          <div className={[
            "flex items-center gap-2 px-3 py-0.5 rounded-full ml-2 border transition-colors",
            compareStatusDone
              ? "bg-emerald-50 border-emerald-200"
              : "bg-violet-50 border-violet-200",
          ].join(" ")}>
            <span className={[
              "w-1.5 h-1.5 rounded-full",
              compareStatusDone
                ? "bg-emerald-500"
                : "bg-violet-500 animate-pulse",
            ].join(" ")} />
            <span className={[
              "text-[11px] font-medium",
              compareStatusDone ? "text-emerald-700" : "text-violet-700",
            ].join(" ")}>
              {compareStatusLabel}
            </span>
          </div>
        )}

        {/* Right side actions */}
        <div className="ml-auto flex items-center gap-2">
          {isCompareMode ? (
            <>
              {/* Exit compare */}
              <button
                onClick={exitCompareMode}
                className="text-[11px] font-semibold px-3 py-1 rounded-lg border bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 transition-all"
              >
                ✕ 退出比较
              </button>
            </>
          ) : (
            <>
              <span className="text-[11px] text-slate-300 hidden md:block">
                点击节点或连线查看详情
              </span>
              <button
                onClick={enterCompareMode}
                className="text-[11px] font-semibold px-3 py-1 rounded-lg border bg-slate-50 text-slate-500 border-slate-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition-all"
              >
                ⊕ 对比分析
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <FilterBar
        filterState={filterState}
        onChange={setFilterState}
        matchedCount={filterResult?.hitBlockIds.size ?? graph.blocks.length}
        totalCount={graph.blocks.length}
      />

      {/* ── React Flow canvas (relative so overlays can position inside) ── */}
      <div className="flex-1 min-h-0 relative">
        <MechanismGraphCanvas
          graph={graph}
          isCompareMode={isCompareMode}
          compareSelection={compareSelection}
          onBlockClick={handleBlockClick}
          onEdgeClick={handleEdgeClick}
          hitBlockIds={filterResult?.hasActiveFilters ? filterResult.hitBlockIds : null}
          hitEdgeIds={filterResult?.hasActiveFilters ? filterResult.hitEdgeIds : null}
        />

        {/* No-results overlay: shown when filter is active but nothing matches */}
        {filterResult?.hasActiveFilters && filterResult.hitBlockIds.size === 0 && (
          <MechanismNoResults onClear={() => setFilterState(emptyFilterState())} />
        )}

        {/* Legend (floating, bottom-right) */}
        <MechanismLegend />

        {/* Reading hints (floating, bottom-center) */}
        <MechanismHints isCompareMode={isCompareMode} />

        {/* Debug panel — lazy-loaded from _devBundle in DEV; null + eliminated in prod */}
        {import.meta.env.DEV && LazyMechanismDebugPanel && (
          <Suspense fallback={null}>
            <LazyMechanismDebugPanel
              graph={graph}
              setChainState={setChainState}
              setOverlay={setOverlay as (o: unknown) => void}
              setIsCompareMode={setIsCompareMode}
              setCompareSelection={setCompareSelection}
              setFilterState={setFilterState}
              reloadFromApi={loadGraph}
            />
          </Suspense>
        )}
      </div>

      {/* ── Dialogs (all page-level, none in node components) ── */}

      <BlockDetailDialog
        block={blockDetailBlock}
        isOpen={overlay !== null && overlay.type === "block-detail"}
        onClose={handleCloseOverlay}
        onRecordNavigate={onRecordNavigate}
      />

      <MainTransitionDialog
        sourceBlock={mainSrc}
        targetBlock={mainTgt}
        isOpen={overlay !== null && overlay.type === "main-transition-detail"}
        onClose={handleCloseOverlay}
      />

      <InitTransitionDialog
        projectNode={initProject}
        targetBlock={initBlock}
        isOpen={overlay !== null && overlay.type === "init-transition-detail"}
        onClose={handleCloseOverlay}
      />

      <CompareTransitionDialog
        blockA={compareBlockA}
        blockB={compareBlockB}
        isOpen={overlay !== null && overlay.type === "compare-transition-detail"}
        onClose={handleCloseOverlay}
      />
    </div>
  );
}
