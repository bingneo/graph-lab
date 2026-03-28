/**
 * diffSummary.ts
 *
 * Pure utilities to produce a concise "core variable change summary" from a
 * BlockDiff produced by compareBlockDiff.ts.
 *
 * No side effects. No React dependencies.
 * Used by: MainTransitionDialog, CompareTransitionDialog (via DiffChangeSummary).
 *
 * ── Layer 1: Structural module diff ──────────────────────────────────────────
 *   Compares system / preparation / operation / measurement item name sets.
 *   Unchanged from V1. Only produces output when module-level sets differ.
 *
 * ── Layer 2: Title-param key diff (NEW) ──────────────────────────────────────
 *   Parses archive_signals.title_params_fingerprint from both blocks (key-set
 *   string like "gradient|ratio|speed") and computes which experimental
 *   parameter dimensions were added or removed across the boundary.
 *   This layer surfaces when structural diff is empty but real changes exist
 *   in experiment title parameters (ratio, temperature, failure events, etc).
 *   Values are extracted from snapshot titles and shown as "A → B" pairs.
 *
 * ── Priority logic ────────────────────────────────────────────────────────────
 *   Structural layer:
 *     "core"      → changes that signal a research-direction decision
 *     "secondary" → incremental additions / minor tweaks
 *
 *     system changes       → always core (most fundamental)
 *     preparation replace  → core (material/formula substitution)
 *     preparation remove   → core (dropped approach signal)
 *     preparation add-only → secondary
 *     operation replace    → core (process path change)
 *     operation remove > 1 → core (significant pathway reduction)
 *     operation single add → secondary
 *     measurement replace  → core (measurement objective shifted)
 *     measurement add/rm   → secondary
 */

import type { DimDiff, BlockDiff, DimKey } from "./compareBlockDiff";
import type { MechanismBlock, ExperimentSnapshot } from "@/api/types";

// ─── Output types ─────────────────────────────────────────────────────────────

export type ChangePriority = "core" | "secondary";

export interface ChangePoint {
  dim: DimKey;
  dimLabel: string;
  priority: ChangePriority;
  /** Concise natural-language description of the change */
  description: string;
  /** onlyInA.length + onlyInB.length */
  changeCount: number;
}

/**
 * A single parameter dimension that changed between two blocks.
 * Derived from archive_signals.title_params_fingerprint (key-set diff).
 * valueA / valueB hold representative extracted values (may be undefined
 * when extraction cannot find a match in the snapshot titles).
 */
export interface TitleParamChange {
  /** Raw parameter key, e.g. "gradient", "failure_event" */
  key: string;
  /** Human-readable Chinese label, e.g. "温度梯度" */
  keyLabel: string;
  /** "added" = present in B but not A; "removed" = present in A but not B */
  type: "added" | "removed";
  /** Representative value(s) from block A snapshots (populated for "removed") */
  valueA?: string;
  /** Representative value(s) from block B snapshots (populated for "added") */
  valueB?: string;
}

export interface DiffSummary {
  /** No differences across any dimension (neither structural nor title-param) */
  identical: boolean;
  /** Ordered: core first, then secondary; within same priority by dim importance */
  changePoints: ChangePoint[];
  /** Single headline sentence (from structural layer, or title-param if structural is empty) */
  headline: string;
  /** Title-param key changes between the two blocks (may be empty) */
  titleParamChanges: TitleParamChange[];
  /**
   * Headline sentence derived from title-param changes alone.
   * Empty string when titleParamChanges is empty.
   */
  titleParamHeadline: string;
}

// ─── Internal helpers — structural layer ──────────────────────────────────────

/** Ordering weight for dimensions when both have the same priority. */
const DIM_SORT_ORDER: Record<DimKey, number> = {
  system: 0,
  operation: 1,
  preparation: 2,
  measurement: 3,
};

/** Infer whether a dimension's change is "core" or "secondary". */
function inferPriority(diff: DimDiff): ChangePriority {
  const a = diff.onlyInA.length;
  const b = diff.onlyInB.length;

  switch (diff.key) {
    case "system":
      return "core";

    case "preparation":
      if (a > 0 && b > 0) return "core";
      if (a > 0) return "core";
      return "secondary";

    case "operation":
      if (a > 0 && b > 0) return "core";
      if (a > 1 || b > 1) return "core";
      return "secondary";

    case "measurement":
      if (a > 0 && b > 0) return "core";
      return "secondary";
  }
}

/** Build a concise natural-language description for a single dimension diff. */
function buildDescription(diff: DimDiff): string {
  const a = diff.onlyInA.length;
  const b = diff.onlyInB.length;

  switch (diff.key) {
    case "system":
      if (a > 0 && b > 0) return `实验系统对象发生变更，减少 ${a} 项、新增 ${b} 项`;
      if (a > 0) return `实验系统中减少了 ${a} 个对象`;
      return `实验系统中新增了 ${b} 个对象`;

    case "preparation":
      if (a > 0 && b > 0) return `核心准备项发生替换，减少 ${a} 项、新增 ${b} 项`;
      if (a > 0) return `减少了 ${a} 项准备条件`;
      return `新增了 ${b} 项准备条件`;

    case "operation":
      if (a > 0 && b > 0) return `操作步骤发生替换，减少 ${a} 步、新增 ${b} 步`;
      if (a > 0) return `移除了 ${a} 项操作步骤`;
      return `新增了 ${b} 项操作步骤`;

    case "measurement":
      if (a > 0 && b > 0) return `测量目标发生调整，停用 ${a} 项、扩展 ${b} 项指标`;
      if (a > 0) return `停用了 ${a} 项测量指标`;
      return `扩展了测量范围，新增 ${b} 项指标`;
  }
}

/** Generate the headline sentence from the list of active change points. */
function buildHeadline(changePoints: ChangePoint[]): string {
  if (changePoints.length === 0) return "";

  const corePts = changePoints.filter((p) => p.priority === "core");
  const featured = corePts.length > 0 ? corePts : changePoints;

  if (featured.length === 1) {
    return `本次推进主要变化集中在${featured[0].dimLabel}`;
  }
  if (featured.length === 2) {
    return `本次推进主要变化集中在${featured[0].dimLabel}与${featured[1].dimLabel}`;
  }
  const labels = featured.slice(0, 3).map((p) => p.dimLabel);
  return `多维度同步调整（${labels.join("、")}${featured.length > 3 ? " 等" : ""}）`;
}

// ─── Internal helpers — title-param value extraction ─────────────────────────

/**
 * Per-key regex extractors.
 * Each returns a human-readable value string, or null if not found.
 */
const PARAM_VALUE_EXTRACTORS: Record<string, (title: string) => string | null> = {
  ratio: (t) => {
    // Compact: In0.51Se0.49 (with optional extra elements like Sn)
    const m = t.match(/In(\d+\.\d+)Se(\d+\.\d+)/);
    if (m) return `In${m[1]}Se${m[2]}`;
    // Verbose: In Se比例0.5：0.5
    const m2 = t.match(/In\s*Se.*?(\d+\.?\d*)[\s:：](\d+\.?\d*)/);
    if (m2) return `${m2[1]}:${m2[2]}`;
    return null;
  },
  temp: (t) => {
    const m = t.match(/合成生长温度[：:\s]*(\d+)\s*℃/);
    return m ? `${m[1]}℃` : null;
  },
  synth_temp: (t) => {
    const m = t.match(/合成温度[：:\s]*(\d+)\s*℃/);
    return m ? `${m[1]}℃` : null;
  },
  grow_temp: (t) => {
    const m = t.match(/生长温度[：:\s]*(\d+)\s*℃/);
    return m ? `${m[1]}℃` : null;
  },
  speed: (t) => {
    const m = t.match(/(\d+\.?\d*)mm\/h/);
    return m ? `${m[1]}mm/h` : null;
  },
  gradient: (t) => {
    const m = t.match(/温度梯度(\d+)℃/);
    return m ? `${m[1]}℃/cm` : null;
  },
  rocking: (t) => {
    const m = t.match(/摇摆炉(\d+)r\/min/);
    return m ? `${m[1]}r/min` : null;
  },
  failure_event: (t) => {
    const events: string[] = [];
    if (t.includes("爆裂") || t.includes("破裂")) events.push("破裂");
    if (t.includes("强制风冷") || t.includes("断电")) events.push("强制风冷");
    if (t.includes("杂质")) events.push("杂质");
    if (t.includes("异常操作")) events.push("异常操作");
    return events.length > 0 ? events.join("、") : null;
  },
  batch_variant: (t) => (t.includes("不同批次") ? "不同批次" : null),
  furnace_fluctuation: (t) => {
    const m = t.match(/炉温波动[±+\-]?(\d+)/);
    return m ? `±${m[1]}℃` : null;
  },
};

/**
 * Extract a representative value for a param key across a block's snapshots.
 *
 * Strategy: collect all unique extracted values across all snapshot titles.
 * - 1 unique value  → show it directly
 * - 2 unique values → "val1 / val2"
 * - 3+              → "val1…valN"  (first and last)
 */
function extractRepresentativeValue(
  snapshots: ExperimentSnapshot[],
  key: string,
): string | undefined {
  const extractor = PARAM_VALUE_EXTRACTORS[key];
  if (!extractor) return undefined;

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const snap of snapshots) {
    const val = extractor(snap.title ?? "");
    if (val && !seen.has(val)) {
      seen.add(val);
      ordered.push(val);
    }
  }

  if (ordered.length === 0) return undefined;
  if (ordered.length === 1) return ordered[0];
  if (ordered.length === 2) return `${ordered[0]} / ${ordered[1]}`;
  return `${ordered[0]}…${ordered[ordered.length - 1]}`;
}

// ─── Internal helpers — title-param layer ─────────────────────────────────────

/**
 * Human-readable Chinese labels for title-param keys.
 */
const TITLE_PARAM_KEY_LABELS: Readonly<Record<string, string>> = {
  ratio: "配比",
  synth_temp: "合成温度",
  grow_temp: "生长温度",
  temp: "温度",
  speed: "下降速度",
  gradient: "温度梯度",
  rocking: "摇摆炉",
  failure_event: "失败现象",
  batch_variant: "批次差异",
  furnace_fluctuation: "炉温波动",
};

/**
 * computeTitleParamKeyDiff — derive title-param key changes between two blocks,
 * enriched with representative extracted values from snapshot titles.
 *
 * Parses archive_signals.title_params_fingerprint from both blocks (pipe-
 * separated sorted parameter KEY names, e.g. "gradient|ratio|speed").
 *
 * Returns TitleParamChange entries with valueA / valueB populated where the
 * param value can be extracted from snapshot titles.
 */
export function computeTitleParamKeyDiff(
  blockA: MechanismBlock,
  blockB: MechanismBlock,
): TitleParamChange[] {
  const fpA = blockA.archive_signals.title_params_fingerprint ?? "";
  const fpB = blockB.archive_signals.title_params_fingerprint ?? "";

  const keysA = new Set(fpA.split("|").filter(Boolean));
  const keysB = new Set(fpB.split("|").filter(Boolean));

  if (keysA.size === 0 && keysB.size === 0) return [];

  const changes: TitleParamChange[] = [];

  for (const key of keysB) {
    if (!keysA.has(key)) {
      changes.push({
        key,
        keyLabel: TITLE_PARAM_KEY_LABELS[key] ?? key,
        type: "added",
        valueB: extractRepresentativeValue(blockB.experiment_snapshots, key),
      });
    }
  }

  for (const key of keysA) {
    if (!keysB.has(key)) {
      changes.push({
        key,
        keyLabel: TITLE_PARAM_KEY_LABELS[key] ?? key,
        type: "removed",
        valueA: extractRepresentativeValue(blockA.experiment_snapshots, key),
      });
    }
  }

  return changes;
}

/**
 * buildTitleParamHeadline — produce a headline sentence from title-param changes.
 */
function buildTitleParamHeadline(changes: TitleParamChange[]): string {
  if (changes.length === 0) return "";

  const added = changes.filter(c => c.type === "added").map(c => c.keyLabel);
  const removed = changes.filter(c => c.type === "removed").map(c => c.keyLabel);

  const parts: string[] = [];
  if (added.length > 0) parts.push(`引入 ${added.join("、")} 实验维度`);
  if (removed.length > 0) parts.push(`退出 ${removed.join("、")} 实验维度`);

  return parts.join("，");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Derive a concise "core variable change summary" from a BlockDiff.
 * Shared by MainTransitionDialog and CompareTransitionDialog.
 */
export function summarizeBlockDiff(diff: BlockDiff): DiffSummary {
  // ── Layer 1: structural module diff ────────────────────────────────────────
  const activeDiffs = diff.dimDiffs.filter((d) => !d.isEmpty && !d.isSame);

  const changePoints: ChangePoint[] = activeDiffs.map((d) => ({
    dim: d.key,
    dimLabel: d.label,
    priority: inferPriority(d),
    description: buildDescription(d),
    changeCount: d.onlyInA.length + d.onlyInB.length,
  }));

  changePoints.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority === "core" ? -1 : 1;
    }
    return DIM_SORT_ORDER[a.dim] - DIM_SORT_ORDER[b.dim];
  });

  // ── Layer 2: title-param key diff ──────────────────────────────────────────
  const titleParamChanges = computeTitleParamKeyDiff(diff.blockA, diff.blockB);
  const titleParamHeadline = buildTitleParamHeadline(titleParamChanges);

  // ── Identical check: both layers empty ────────────────────────────────────
  if (changePoints.length === 0 && titleParamChanges.length === 0) {
    return {
      identical: true,
      changePoints: [],
      headline: "各维度完全一致，无核心变量变化",
      titleParamChanges: [],
      titleParamHeadline: "",
    };
  }

  // ── Headline: prefer structural; fall back to title-param ─────────────────
  const headline =
    changePoints.length > 0 ? buildHeadline(changePoints) : titleParamHeadline;

  return {
    identical: false,
    changePoints,
    headline,
    titleParamChanges,
    titleParamHeadline,
  };
}
