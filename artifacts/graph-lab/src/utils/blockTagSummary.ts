/**
 * blockTagSummary.ts
 *
 * Pure utilities to derive tag statistics and dominant result signals from a
 * MechanismBlock's experiment_snapshots. Called in the Canvas data-injection
 * layer so node / dialog components receive pre-computed summaries and never
 * do their own aggregation.
 *
 * Tag set mirrors FilterBar's AVAILABLE_TAGS so filter semantics stay in sync.
 *
 * Color values use Tailwind class strings (bg-*, text-*, border-*) matching the
 * FilterBar chip active styles exactly, ensuring visual consistency everywhere.
 */

import type { MechanismBlock } from "@/api/types";

// ─── Tracked tags (order determines display priority) ─────────────────────────

export interface TrackedTag {
  tag: string;
  /** Tailwind bg class for the dot / chip fill */
  bg: string;
  /** Tailwind text class */
  text: string;
  /** Tailwind border class */
  border: string;
  /** Tailwind bg class for the chip background (lighter) */
  chipBg: string;
}

export const TRACKED_TAGS: TrackedTag[] = [
  { tag: "失败",  bg: "bg-rose-500",    text: "text-rose-700",    border: "border-rose-200",    chipBg: "bg-rose-50"    },
  { tag: "已验证", bg: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200", chipBg: "bg-emerald-50" },
  { tag: "可复现", bg: "bg-teal-500",    text: "text-teal-700",    border: "border-teal-200",    chipBg: "bg-teal-50"    },
  { tag: "探索中", bg: "bg-blue-500",    text: "text-blue-700",    border: "border-blue-200",    chipBg: "bg-blue-50"    },
] as const;

// ─── Tag count entry ──────────────────────────────────────────────────────────

export interface TagCount extends TrackedTag {
  /** Number of experiment_snapshots in this block that carry the tag */
  count: number;
}

// ─── Dominant signal ──────────────────────────────────────────────────────────

export type DominantSignalKey = "failed" | "validated" | "reproducible" | "exploring" | "mixed" | null;

export interface DominantSignal {
  key: DominantSignalKey;
  label: string;
  /** Tailwind dot color */
  dot: string;
  /** Tailwind text color */
  text: string;
}

// ─── buildBlockTagSummary ─────────────────────────────────────────────────────

/**
 * Count how many snapshots in the block have each tracked tag.
 * Returns all 4 tracked tags (count may be 0).
 */
export function buildBlockTagSummary(block: MechanismBlock): TagCount[] {
  const snapshots = block.experiment_snapshots;

  return TRACKED_TAGS.map((tracked) => ({
    ...tracked,
    count: snapshots.filter((s) => s.tags.includes(tracked.tag)).length,
  }));
}

// ─── inferDominantResultSignal ────────────────────────────────────────────────

/**
 * Derive the dominant result signal from the block's tag counts.
 *
 * Priority (highest wins):
 *  1. 可复现 ≥ 1                        → reproducible (最正向信号)
 *  2. 已验证 ≥ 1  AND  失败 == 0       → validated
 *  3. 失败 >= ceil(total / 2)           → failed (失败占多数)
 *  4. 已验证 ≥ 1  AND  失败 ≥ 1        → mixed (正负信号并存)
 *  5. 只有 探索中 (失败/验证/可复现 == 0)→ exploring
 *  6. 无任何跟踪标签                    → null
 */
export function inferDominantResultSignal(
  tagCounts: TagCount[],
  totalSnapshots: number,
): DominantSignal | null {
  const get = (tag: string) => tagCounts.find((t) => t.tag === tag)?.count ?? 0;

  const failed       = get("失败");
  const validated    = get("已验证");
  const reproducible = get("可复现");
  const exploring    = get("探索中");

  const anyTracked = failed + validated + reproducible + exploring;
  if (anyTracked === 0) return null;

  if (reproducible >= 1) {
    return { key: "reproducible", label: "可复现", dot: "bg-teal-500", text: "text-teal-700" };
  }
  if (validated >= 1 && failed === 0) {
    return { key: "validated", label: "验证主导", dot: "bg-emerald-500", text: "text-emerald-700" };
  }
  const majority = Math.ceil(totalSnapshots / 2);
  if (failed >= majority && failed >= 1) {
    return { key: "failed", label: "失败主导", dot: "bg-rose-500", text: "text-rose-700" };
  }
  if (validated >= 1 && failed >= 1) {
    return { key: "mixed", label: "混合信号", dot: "bg-amber-400", text: "text-amber-700" };
  }
  if (exploring >= 1) {
    return { key: "exploring", label: "探索中", dot: "bg-blue-400", text: "text-blue-700" };
  }
  return null;
}

// ─── hasAnyTrackedTags helper ─────────────────────────────────────────────────

export function hasAnyTrackedTags(tagCounts: TagCount[]): boolean {
  return tagCounts.some((t) => t.count > 0);
}
