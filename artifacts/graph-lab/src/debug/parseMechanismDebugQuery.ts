/**
 * parseMechanismDebugQuery.ts
 *
 * Pure function — parses URL query params and returns a debug config object.
 * Always safe to call; returns all-false/null values when not in dev mode
 * or when no debug params are present.
 *
 * Supported URL params (all optional, dev-mode only):
 *
 *   ?debug=1                               → show debug panel
 *   ?mock=1                                → use mock fixture graph instead of API
 *   ?overlay=block-detail&blockId=X        → pre-open block detail dialog
 *   ?overlay=main-transition&srcId=X&tgtId=Y
 *   ?overlay=init-transition&tgtId=X
 *   ?overlay=compare&aId=X&bId=Y
 *   ?compare=on                            → enter compare mode (no pre-selection)
 *   ?compare=on&aId=X                      → compare mode with A pre-selected
 *   ?compare=on&aId=X&bId=Y               → compare mode with both selected + dialog open
 *   ?empty=1                               → force empty state (no graph)
 *   ?error=1                               → force error state
 *   ?filterNoResults=1                     → set a filter that yields 0 results
 *
 * Example full URL:
 *   http://localhost:5000/graph-lab/?debug=1&mock=1&overlay=compare&aId=block:mock:1&bId=block:mock:4
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DebugOverlayType =
  | { type: "block-detail"; blockId: string }
  | { type: "main-transition"; srcId: string; tgtId: string }
  | { type: "init-transition"; tgtId: string }
  | { type: "compare"; aId: string; bId: string }
  | null;

export interface MechanismDebugConfig {
  /** Whether the debug panel should be visible */
  showPanel: boolean;
  /** Use mock fixture graph instead of API */
  useMock: boolean;
  /** Pre-open a dialog */
  initialOverlay: DebugOverlayType;
  /** Start in compare mode */
  compareMode: boolean;
  /** Pre-fill compare slot A */
  compareA: string | null;
  /** Pre-fill compare slot B */
  compareB: string | null;
  /** Force empty state */
  forceEmpty: boolean;
  /** Force error state */
  forceError: boolean;
  /** Activate a filter that matches nothing */
  filterNoResults: boolean;
}

const NULL_CONFIG: MechanismDebugConfig = {
  showPanel: false,
  useMock: false,
  initialOverlay: null,
  compareMode: false,
  compareA: null,
  compareB: null,
  forceEmpty: false,
  forceError: false,
  filterNoResults: false,
};

// ─── Parser ────────────────────────────────────────────────────────────────────

export function parseMechanismDebugQuery(): MechanismDebugConfig {
  // Never active in production
  if (!import.meta.env.DEV) return NULL_CONFIG;

  const p = new URLSearchParams(window.location.search);

  const showPanel = p.get("debug") === "1";
  const useMock   = p.get("mock") === "1";
  const forceEmpty = p.get("empty") === "1";
  const forceError = p.get("error") === "1";
  const filterNoResults = p.get("filterNoResults") === "1";

  // ── Overlay ──────────────────────────────────────────────────────────────────
  let initialOverlay: DebugOverlayType = null;
  const overlayType = p.get("overlay");

  if (overlayType === "block-detail") {
    const blockId = p.get("blockId");
    if (blockId) initialOverlay = { type: "block-detail", blockId };
  } else if (overlayType === "main-transition") {
    const srcId = p.get("srcId");
    const tgtId = p.get("tgtId");
    if (srcId && tgtId) initialOverlay = { type: "main-transition", srcId, tgtId };
  } else if (overlayType === "init-transition") {
    const tgtId = p.get("tgtId");
    if (tgtId) initialOverlay = { type: "init-transition", tgtId };
  } else if (overlayType === "compare") {
    const aId = p.get("aId");
    const bId = p.get("bId");
    if (aId && bId) initialOverlay = { type: "compare", aId, bId };
  }

  // ── Compare mode ─────────────────────────────────────────────────────────────
  const compareMode = p.get("compare") === "on";
  const compareA = p.get("aId") ?? null;
  const compareB = p.get("bId") ?? null;

  return {
    showPanel,
    useMock,
    initialOverlay,
    compareMode,
    compareA,
    compareB,
    forceEmpty,
    forceError,
    filterNoResults,
  };
}
