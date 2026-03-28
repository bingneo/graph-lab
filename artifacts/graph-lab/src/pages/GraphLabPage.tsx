/**
 * GraphLabPage
 *
 * Host for MechanismGraphPage. Owns:
 *   - sci_note_id input + submit
 *   - Record detail slide-over panel (opened via onRecordNavigate)
 *
 * onRecordNavigate implementation (方式 B — panel/drawer, not full navigation):
 *   MechanismGraphPage calls onRecordNavigate(recordId) when the user clicks
 *   an experiment record inside BlockDetailDialog.  This host intercepts that
 *   single string, fetches the record's snapshot and module detail using the
 *   existing read-only API functions, and renders them in a slide-over panel
 *   using the existing SnapshotFlow and ModuleDetailPanel components.
 *
 *   CONTRACT:
 *     • Only recordId (string) crosses the boundary — no graph-internal data
 *     • All fetches are GET-only read operations via existing graphApi functions
 *     • SnapshotFlow and ModuleDetailPanel are used completely unmodified
 *     • The record detail page's own logic is entirely undisturbed
 *     • Closing the panel resets all panel-local state; no global side effects
 */

import { useState, useCallback } from "react";
import { MechanismGraphPage } from "@/pages/MechanismGraphPage";
import { fetchSnapshotGraph, fetchModuleDetail } from "@/api/graphApi";
import { SnapshotFlow } from "@/components/snapshot/SnapshotFlow";
import { ModuleDetailPanel } from "@/components/detail/ModuleDetailPanel";
import type { MechanismSnapshotGraph, ModuleDetail, ModuleKey } from "@/api/types";

const DEFAULT_SCI_NOTE_ID = "b62f913e-9f26-4936-ae54-a5f872a80a74";

// ─── Record panel state ────────────────────────────────────────────────────────

interface RecordPanelState {
  recordId: string;
  snapshot: MechanismSnapshotGraph | null;
  isLoading: boolean;
  error: string | null;
  selectedModule: ModuleKey | null;
  moduleDetail: ModuleDetail | null;
  moduleLoading: boolean;
  moduleError: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GraphLabPage() {
  const [sciNoteId, setSciNoteId] = useState(DEFAULT_SCI_NOTE_ID);
  const [inputValue, setInputValue] = useState(DEFAULT_SCI_NOTE_ID);

  // null = panel closed; non-null = panel open with state below
  const [recordPanel, setRecordPanel] = useState<RecordPanelState | null>(null);

  // ── sci_note_id form submit ────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed && trimmed !== sciNoteId) {
      setSciNoteId(trimmed);
      setRecordPanel(null); // close panel when loading a different sci note
    }
  }

  // ── onRecordNavigate ───────────────────────────────────────────────────────
  // Called by MechanismGraphPage with only a recordId string.
  // Opens the slide-over panel and fetches the snapshot read-only.
  // Does not modify any existing record page logic.
  const handleRecordNavigate = useCallback((recordId: string) => {
    setRecordPanel({
      recordId,
      snapshot: null,
      isLoading: true,
      error: null,
      selectedModule: null,
      moduleDetail: null,
      moduleLoading: false,
      moduleError: null,
    });

    fetchSnapshotGraph(recordId)
      .then((snapshot) => {
        setRecordPanel((prev) =>
          prev?.recordId === recordId
            ? { ...prev, snapshot, isLoading: false }
            : prev
        );
      })
      .catch((err: unknown) => {
        setRecordPanel((prev) =>
          prev?.recordId === recordId
            ? {
                ...prev,
                isLoading: false,
                error: err instanceof Error ? err.message : "加载实验记录快照失败",
              }
            : prev
        );
      });
  }, []);

  // ── Module click inside SnapshotFlow ──────────────────────────────────────
  // SnapshotFlow is completely unmodified — its onModuleClick signature
  // (recordId: string, moduleKey: ModuleKey) is used exactly as-is.
  const handleModuleClick = useCallback(
    (recordId: string, moduleKey: ModuleKey) => {
      setRecordPanel((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          selectedModule: moduleKey,
          moduleDetail: null,
          moduleLoading: true,
          moduleError: null,
        };
      });

      fetchModuleDetail(recordId, moduleKey)
        .then((detail) => {
          setRecordPanel((prev) =>
            prev?.recordId === recordId && prev.selectedModule === moduleKey
              ? { ...prev, moduleDetail: detail, moduleLoading: false }
              : prev
          );
        })
        .catch((err: unknown) => {
          setRecordPanel((prev) =>
            prev?.recordId === recordId && prev.selectedModule === moduleKey
              ? {
                  ...prev,
                  moduleLoading: false,
                  moduleError: err instanceof Error ? err.message : "模块详情加载失败",
                }
              : prev
          );
        });
    },
    []
  );

  const handleClosePanel = useCallback(() => setRecordPanel(null), []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 px-4 py-0 shrink-0">
        <div className="flex items-stretch gap-0">

          {/* Brand */}
          <div className="flex items-center gap-2 pr-4 border-r border-slate-200 py-2.5">
            <span className="text-blue-600 font-bold text-lg leading-none">◈</span>
            <h1 className="font-semibold text-slate-800 text-base">Graph Lab</h1>
            <span className="text-[11px] font-medium text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
              Read-Only
            </span>
          </div>

          {/* sci_note_id input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-1 min-w-0 max-w-xl ml-4 py-2">
            <label className="text-xs text-slate-500 shrink-0 hidden sm:block">sci_note_id</label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter sci_note_id UUID…"
              className="flex-1 text-xs font-mono px-2.5 py-1.5 border border-slate-200 rounded-md bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent min-w-0"
            />
            <button
              type="submit"
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0"
            >
              Load
            </button>
          </form>

          <div className="text-[11px] text-slate-400 hidden md:flex items-center px-4">
            sciblock_v2 · read-only
          </div>
        </div>
      </header>

      {/* ── Main area ── */}
      {/* relative so the record detail panel can be absolute-positioned inside */}
      <main className="flex-1 flex overflow-hidden p-3 relative">

        {/* Mechanism chain graph — unchanged */}
        <MechanismGraphPage
          sciNoteId={sciNoteId}
          onRecordNavigate={handleRecordNavigate}
        />

        {/* ── Record detail slide-over panel ────────────────────────────────
          Appears when onRecordNavigate fires.  Floats over the graph as a
          right-side drawer.  Uses SnapshotFlow + ModuleDetailPanel with
          zero modifications to those components.
        ──────────────────────────────────────────────────────────────────── */}
        {recordPanel !== null && (
          <>
            {/* Semi-transparent backdrop — click to close */}
            <div
              className="absolute inset-0 bg-black/10 z-30"
              onClick={handleClosePanel}
              aria-label="关闭记录面板"
            />

            {/* Panel */}
            <div
              className={[
                "absolute inset-y-0 right-3 z-40",
                "w-[680px] max-w-[calc(100%-3rem)]",
                "bg-white border border-slate-200 shadow-2xl rounded-lg",
                "flex flex-col overflow-hidden",
              ].join(" ")}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Panel header */}
              <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 shrink-0 flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  实验记录详情
                </span>
                <span className="text-[10px] font-mono text-slate-400 truncate flex-1">
                  {recordPanel.recordId}
                </span>
                <button
                  onClick={handleClosePanel}
                  className="text-slate-400 hover:text-slate-700 transition-colors text-xs font-bold w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200"
                  aria-label="关闭"
                >
                  ✕
                </button>
              </div>

              {/* Panel body: snapshot (top fixed) + module detail (bottom flex) */}
              <div className="flex-1 flex flex-col min-h-0">

                {/* Mechanism snapshot — existing SnapshotFlow, unmodified */}
                <div className="h-56 shrink-0 border-b border-slate-100">
                  <SnapshotFlow
                    graph={recordPanel.snapshot}
                    isLoading={recordPanel.isLoading}
                    error={recordPanel.error}
                    selectedModuleKey={recordPanel.selectedModule}
                    onModuleClick={handleModuleClick}
                  />
                </div>

                {/* Module detail — existing ModuleDetailPanel, unmodified */}
                <div className="flex-1 min-h-0">
                  <ModuleDetailPanel
                    detail={recordPanel.moduleDetail}
                    isLoading={recordPanel.moduleLoading}
                    error={recordPanel.moduleError}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
