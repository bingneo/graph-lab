/**
 * filterBlocks.ts
 *
 * Pure filter computation for the Mechanism Graph.
 * No React, no side effects — takes graph data + filter state, returns hit sets.
 *
 * Filter dimensions (AND logic across dimensions, OR logic within each dimension):
 *   selectedTags        — block hits if ANY snapshot has ANY of the selected tags
 *   selectedBlockTypes  — block hits if its block_type is in the selected set
 *   selectedStatuses    — block hits if its block_status is in the selected set
 *
 * Focus modes (exclusive — override all individual dimension filters):
 *   failed     — blocks where any snapshot carries a "失败" tag
 *   validated  — repeat_validation / measurement_validation types, or "已验证" tag
 *   confirmed  — result_confirmation type, or "可复现" / "已验证" tag
 *
 * Edge hit logic:
 *   A main-transition edge hits if BOTH its source and target nodes are hit blocks
 *   (or the source is the project node, in which case only the target must hit).
 *   Compare edges always pass through so compare mode is never disrupted.
 */

import type { MechanismChainGraph, MechanismBlock, BlockType, BlockStatus } from "@/api/types";

// ─── Public types ──────────────────────────────────────────────────────────────

export type FocusMode = "failed" | "validated" | "confirmed" | null;

export interface FilterState {
  selectedTags: string[];
  selectedBlockTypes: BlockType[];
  selectedStatuses: BlockStatus[];
  focusMode: FocusMode;
}

export interface FilterResult {
  hitBlockIds: Set<string>;
  hitEdgeIds: Set<string>;
  hasActiveFilters: boolean;
}

// ─── Available filter options ─────────────────────────────────────────────────

export const AVAILABLE_TAGS = ["失败", "已验证", "探索中", "可复现"] as const;

export const AVAILABLE_BLOCK_TYPES: { value: BlockType; label: string }[] = [
  { value: "initial_setup",          label: "系统建立" },
  { value: "condition_exploration",  label: "条件探索" },
  { value: "parameter_optimization", label: "参数优化" },
  { value: "repeat_validation",      label: "重复验证" },
  { value: "measurement_validation", label: "测量验证" },
  { value: "result_confirmation",    label: "结果确认" },
  { value: "mixed_progression",      label: "综合推进" },
];

export const AVAILABLE_STATUSES: { value: BlockStatus; label: string }[] = [
  { value: "exploring",    label: "探索中" },
  { value: "consolidating", label: "整合中" },
  { value: "archived",     label: "已归档" },
  { value: "mixed",        label: "调整中" },
];

export const FOCUS_MODES: { value: FocusMode; label: string; icon: string }[] = [
  { value: "failed",    label: "失败链路", icon: "✗" },
  { value: "validated", label: "验证链路", icon: "↺" },
  { value: "confirmed", label: "确认链路", icon: "✓" },
];

// ─── Empty state ──────────────────────────────────────────────────────────────

export function emptyFilterState(): FilterState {
  return {
    selectedTags: [],
    selectedBlockTypes: [],
    selectedStatuses: [],
    focusMode: null,
  };
}

export function isFilterActive(f: FilterState): boolean {
  return (
    f.selectedTags.length > 0 ||
    f.selectedBlockTypes.length > 0 ||
    f.selectedStatuses.length > 0 ||
    f.focusMode !== null
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function blockHasAnyTag(block: MechanismBlock, tags: readonly string[]): boolean {
  for (const snap of block.experiment_snapshots) {
    for (const t of tags) {
      if (snap.tags.includes(t)) return true;
    }
  }
  return false;
}

// ─── Focus mode rules ─────────────────────────────────────────────────────────

function matchesFocusFailed(block: MechanismBlock): boolean {
  return blockHasAnyTag(block, ["失败"]);
}

function matchesFocusValidated(block: MechanismBlock): boolean {
  const validationTypes: BlockType[] = ["repeat_validation", "measurement_validation"];
  if (validationTypes.includes(block.block_type)) return true;
  return blockHasAnyTag(block, ["已验证"]);
}

function matchesFocusConfirmed(block: MechanismBlock): boolean {
  if (block.block_type === "result_confirmation") return true;
  return blockHasAnyTag(block, ["已验证", "可复现"]);
}

// ─── Core computation ─────────────────────────────────────────────────────────

export function computeFilterResult(
  graph: MechanismChainGraph,
  filterState: FilterState,
): FilterResult {
  const hasActiveFilters = isFilterActive(filterState);

  // No active filters → everything hits
  if (!hasActiveFilters) {
    const hitBlockIds = new Set(graph.blocks.map((b) => b.id));
    const hitEdgeIds = new Set(graph.edges.map((e) => e.id));
    return { hitBlockIds, hitEdgeIds, hasActiveFilters: false };
  }

  // ── Compute block hits ──────────────────────────────────────────────────────

  const hitBlockIds = new Set<string>();

  for (const block of graph.blocks) {
    const hit = blockHitsFilter(block, filterState);
    if (hit) hitBlockIds.add(block.id);
  }

  // ── Compute edge hits ───────────────────────────────────────────────────────

  const projectId = graph.project_node.id;
  const hitEdgeIds = new Set<string>();

  for (const edge of graph.edges) {
    if (edge.edge_type === "compare_transition") {
      // Compare edges always pass through
      hitEdgeIds.add(edge.id);
      continue;
    }

    // main_transition: source can be project node (always "hit") or a block
    const sourceHit = edge.source === projectId || hitBlockIds.has(edge.source);
    const targetHit = hitBlockIds.has(edge.target);

    if (sourceHit && targetHit) {
      hitEdgeIds.add(edge.id);
    }
  }

  return { hitBlockIds, hitEdgeIds, hasActiveFilters: true };
}

// ─── Per-block matching ───────────────────────────────────────────────────────

function blockHitsFilter(block: MechanismBlock, f: FilterState): boolean {
  // Focus mode overrides all individual dimension filters
  if (f.focusMode !== null) {
    switch (f.focusMode) {
      case "failed":    return matchesFocusFailed(block);
      case "validated": return matchesFocusValidated(block);
      case "confirmed": return matchesFocusConfirmed(block);
    }
  }

  // AND logic across dimensions
  if (f.selectedTags.length > 0 && !blockHasAnyTag(block, f.selectedTags)) {
    return false;
  }
  if (f.selectedBlockTypes.length > 0 && !f.selectedBlockTypes.includes(block.block_type)) {
    return false;
  }
  if (f.selectedStatuses.length > 0 && !f.selectedStatuses.includes(block.block_status)) {
    return false;
  }

  return true;
}
