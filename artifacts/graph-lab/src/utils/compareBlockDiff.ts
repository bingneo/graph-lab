/**
 * compareBlockDiff.ts
 *
 * Pure diff computation between MechanismBlocks (or snapshot subsets)
 * across 4 experimental dimensions.
 *
 * Used by three dialog types:
 *   • CompareTransitionDialog  — arbitrary block-vs-block (compare mode)
 *   • MainTransitionDialog     — source → target in the main chain
 *   • InitTransitionDialog     — initial extraction vs all retained snapshots
 *
 * No side effects. No external dependencies beyond domain types.
 */

import type { MechanismBlock, ExperimentSnapshot } from "@/api/types";

// ─── Output types ──────────────────────────────────────────────────────────────

export type DimKey = "system" | "preparation" | "operation" | "measurement";

export interface DimDiff {
  key: DimKey;
  label: string;
  /** Items that exist in side-A snapshots but NOT in side-B. */
  onlyInA: string[];
  /** Items that exist in side-B snapshots but NOT in side-A. */
  onlyInB: string[];
  /** Items that exist in both sides. */
  inBoth: string[];
  /** True when there are NO differences (inBoth > 0, onlyIn* = 0). */
  isSame: boolean;
  /** True when both sides have zero items in this dimension. */
  isEmpty: boolean;
}

export interface BlockDiff {
  blockA: MechanismBlock;
  blockB: MechanismBlock;
  dimDiffs: DimDiff[];
  /** Total number of items that appear only on one side (across all dimensions). */
  totalDiffCount: number;
}

export interface InitDiff {
  dimDiffs: DimDiff[];
  totalDiffCount: number;
  /**
   * Provenance declaration:
   *   "fallback_first_snapshot"  — snapshot[0] used as proxy for initial extraction.
   *     This is a FALLBACK. When a real `initial_ontology` DB record is available,
   *     replace the `computeInitDiff` implementation with that source.
   *   "real_initial_snapshot"    — reserved for future real DB-backed initial ontology.
   */
  dataSource: "real_initial_snapshot" | "fallback_first_snapshot";
  /** Human-readable label for the left (initial) side. */
  labelA: string;
  /** Human-readable label for the right (retained) side. */
  labelB: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const DIM_META: Record<DimKey, string> = {
  system: "实验系统",
  preparation: "实验准备",
  operation: "实验操作",
  measurement: "测量过程",
};

/**
 * Collect unique display-ready names for one dimension from a list of snapshots.
 * Measurement items include target/instrument in parens for disambiguation.
 * Internal — not exported; all public APIs use collectNames internally.
 */
function collectNames(snapshots: ExperimentSnapshot[], dim: DimKey): Set<string> {
  const names = new Set<string>();

  for (const snap of snapshots) {
    switch (dim) {
      case "system":
        for (const obj of snap.modules.system.objects) {
          if (obj.name.trim()) names.add(obj.name.trim());
        }
        break;

      case "preparation":
        for (const item of snap.modules.preparation.items) {
          if (item.name.trim()) names.add(item.name.trim());
        }
        break;

      case "operation":
        for (const step of snap.modules.operation.steps) {
          if (step.name.trim()) names.add(step.name.trim());
        }
        break;

      case "measurement":
        for (const item of snap.modules.measurement.items) {
          const display = item.target
            ? `${item.name.trim()} (${item.target.trim()})`
            : item.name.trim();
          if (display) names.add(display);
        }
        break;
    }
  }

  return names;
}

function diffSets(
  setA: Set<string>,
  setB: Set<string>,
): { onlyInA: string[]; onlyInB: string[]; inBoth: string[] } {
  const inBoth = [...setA].filter((x) => setB.has(x)).sort();
  const onlyInA = [...setA].filter((x) => !setB.has(x)).sort();
  const onlyInB = [...setB].filter((x) => !setA.has(x)).sort();
  return { inBoth, onlyInA, onlyInB };
}

/** Build DimDiff for a single dimension from two snapshot lists. */
function buildDimDiff(
  key: DimKey,
  snapshotsA: ExperimentSnapshot[],
  snapshotsB: ExperimentSnapshot[],
): DimDiff {
  const setA = collectNames(snapshotsA, key);
  const setB = collectNames(snapshotsB, key);
  const { onlyInA, onlyInB, inBoth } = diffSets(setA, setB);
  const isEmpty = setA.size === 0 && setB.size === 0;
  const isSame = !isEmpty && onlyInA.length === 0 && onlyInB.length === 0;
  return { key, label: DIM_META[key], onlyInA, onlyInB, inBoth, isSame, isEmpty };
}

const ALL_DIMS: DimKey[] = ["system", "preparation", "operation", "measurement"];

// ─── Public APIs ───────────────────────────────────────────────────────────────

/**
 * Compute a block-to-block diff across 4 dimensions.
 * Used by: CompareTransitionDialog, MainTransitionDialog.
 */
export function computeBlockDiff(
  blockA: MechanismBlock,
  blockB: MechanismBlock,
): BlockDiff {
  const dimDiffs = ALL_DIMS.map((key) =>
    buildDimDiff(key, blockA.experiment_snapshots, blockB.experiment_snapshots),
  );

  const totalDiffCount = dimDiffs.reduce(
    (sum, d) => sum + d.onlyInA.length + d.onlyInB.length,
    0,
  );

  return { blockA, blockB, dimDiffs, totalDiffCount };
}

/**
 * Compute the init diff for the first block.
 *
 * ── Data source ──────────────────────────────────────────────────────────────
 * FALLBACK (dataSource = "fallback_first_snapshot"):
 *   We do not yet have a separate "initial_ontology" DB record.
 *   Strategy: treat snapshot[0] as the initial extraction baseline
 *   (the first experiment run in this stage, which is the closest
 *   proxy to the initial ontology setup), and compare it against
 *   ALL snapshots aggregated (= everything retained or expanded
 *   throughout this stage).
 *
 *   onlyInA = items present in the first experiment but NOT in any later one
 *             (i.e. things tried initially but later dropped)
 *   onlyInB = items added in experiments AFTER the first one
 *             (i.e. expansions / corrections beyond the initial setup)
 *   inBoth  = items present from the very first experiment and kept throughout
 *
 * ── Future replacement ───────────────────────────────────────────────────────
 *   When a real `initial_ontology` API/table exists, pass its data as
 *   `snapshotsA` and replace the `dataSource` value with "real_initial_snapshot".
 */
export function computeInitDiff(firstBlock: MechanismBlock): InitDiff {
  const snaps = firstBlock.experiment_snapshots;

  if (snaps.length === 0) {
    return {
      dimDiffs: ALL_DIMS.map((key) => ({
        key,
        label: DIM_META[key],
        onlyInA: [],
        onlyInB: [],
        inBoth: [],
        isSame: false,
        isEmpty: true,
      })),
      totalDiffCount: 0,
      dataSource: "fallback_first_snapshot",
      labelA: "初始实验",
      labelB: "全阶段",
    };
  }

  // FALLBACK: snapshot[0] as initial baseline
  const initialSnaps: ExperimentSnapshot[] = [snaps[0]];
  const allSnaps: ExperimentSnapshot[] = snaps;

  const dimDiffs = ALL_DIMS.map((key) =>
    buildDimDiff(key, initialSnaps, allSnaps),
  );

  const totalDiffCount = dimDiffs.reduce(
    (sum, d) => sum + d.onlyInA.length + d.onlyInB.length,
    0,
  );

  const initialCode = snaps[0].experiment_code;
  const labelA = `初始实验 (${initialCode})`;
  const labelB = snaps.length > 1 ? `全阶段聚合 (${snaps.length}条)` : "全部实验（单条）";

  return {
    dimDiffs,
    totalDiffCount,
    dataSource: "fallback_first_snapshot",
    labelA,
    labelB,
  };
}
