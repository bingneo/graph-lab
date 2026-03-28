/**
 * DiffSectionView — shared diff rendering components.
 *
 * Used by CompareTransitionDialog, MainTransitionDialog, and InitTransitionDialog.
 * Receives typed DimDiff data from compareBlockDiff.ts and renders the
 * 3-column (only-A / shared / only-B) view for each dimension.
 *
 * Also exports DiffChangeSummary — the "core variable change summary" panel
 * that sits between the block context bar and the 4-dimension detail sections.
 */

import type { DimDiff, BlockDiff, DimKey } from "@/utils/compareBlockDiff";
import { summarizeBlockDiff } from "@/utils/diffSummary";

// ─── ItemPill ─────────────────────────────────────────────────────────────────

export function ItemPill({
  label,
  variant,
}: {
  label: string;
  variant: "a" | "b" | "both";
}) {
  const cls =
    variant === "a"
      ? "bg-orange-50 text-orange-700 border border-orange-200"
      : variant === "b"
        ? "bg-violet-50 text-violet-700 border border-violet-200"
        : "bg-emerald-50 text-emerald-700 border border-emerald-200";
  return (
    <span
      className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${cls}`}
    >
      {label}
    </span>
  );
}

// ─── DimSection ───────────────────────────────────────────────────────────────

export function DimSection({
  diff,
  labelA,
  labelB,
}: {
  diff: DimDiff;
  labelA: string;
  labelB: string;
}) {
  const total = diff.onlyInA.length + diff.onlyInB.length + diff.inBoth.length;
  const hasDiff = diff.onlyInA.length > 0 || diff.onlyInB.length > 0;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Section header */}
      <div
        className={[
          "px-4 py-2.5 flex items-center justify-between",
          diff.isEmpty
            ? "bg-slate-50"
            : diff.isSame
              ? "bg-emerald-50"
              : "bg-amber-50",
        ].join(" ")}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{diff.label}</span>
          {!diff.isEmpty && (
            <span className="text-[10px] text-slate-400">共 {total} 项</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {diff.isEmpty ? (
            <span className="text-[10px] text-slate-400 font-medium">— 双方均无数据</span>
          ) : diff.isSame ? (
            // ── Problem 2 fix: was "✓ 完全一致" → now "共有内容" ─────────
            <span className="text-[10px] font-medium text-emerald-600">共有内容</span>
          ) : (
            <>
              {diff.onlyInA.length > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                  仅{labelA} {diff.onlyInA.length}项
                </span>
              )}
              {diff.onlyInB.length > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                  仅{labelB} {diff.onlyInB.length}项
                </span>
              )}
              {diff.inBoth.length > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                  共同 {diff.inBoth.length}项
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* 3-column grid when differences exist */}
      {!diff.isEmpty && hasDiff && (
        <div className="p-4 grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] font-semibold text-orange-500 uppercase tracking-wider mb-2">
              仅{labelA}
            </div>
            {diff.onlyInA.length === 0 ? (
              <span className="text-[11px] text-slate-300">—</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {diff.onlyInA.map((n) => (
                  <ItemPill key={n} label={n} variant="a" />
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-2">
              两者共有
            </div>
            {diff.inBoth.length === 0 ? (
              <span className="text-[11px] text-slate-300">—</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {diff.inBoth.map((n) => (
                  <ItemPill key={n} label={n} variant="both" />
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider mb-2">
              仅{labelB}
            </div>
            {diff.onlyInB.length === 0 ? (
              <span className="text-[11px] text-slate-300">—</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {diff.onlyInB.map((n) => (
                  <ItemPill key={n} label={n} variant="b" />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* When identical: single-row shared items */}
      {!diff.isEmpty && diff.isSame && (
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-1.5">
            {diff.inBoth.map((n) => (
              <ItemPill key={n} label={n} variant="both" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DiffSummaryBar ───────────────────────────────────────────────────────────

export function DiffSummaryBar({
  totalDiffCount,
  dimDiffs,
}: {
  totalDiffCount: number;
  dimDiffs: DimDiff[];
}) {
  const sameDims = dimDiffs.filter((d) => d.isSame && !d.isEmpty).length;
  const diffDims = dimDiffs.filter((d) => !d.isSame && !d.isEmpty).length;

  return (
    <div className="px-6 py-2.5 border-b border-slate-100 flex items-center gap-3 text-[12px] shrink-0 bg-slate-50 flex-wrap">
      {totalDiffCount === 0 ? (
        // ── Problem 1 fix: was "✓ 所有维度完全一致" → now "共有结构化内容" ──
        <span className="text-slate-500 font-medium">共有实验信息</span>
      ) : (
        <>
          <span className="text-amber-600 font-semibold">⚠ {totalDiffCount} 项差异</span>
          {sameDims > 0 && (
            <>
              <span className="text-slate-300">·</span>
              {/* ── Problem 1 fix: was "N个维度完全一致" ─────────────────── */}
              <span className="text-slate-500">{sameDims} 个维度共有内容</span>
            </>
          )}
          {diffDims > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">{diffDims} 个维度存在差异</span>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── DiffSectionList ──────────────────────────────────────────────────────────

export function DiffSectionList({
  dimDiffs,
  labelA,
  labelB,
}: {
  dimDiffs: DimDiff[];
  labelA: string;
  labelB: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {dimDiffs.map((d) => (
        <DimSection key={d.key} diff={d} labelA={labelA} labelB={labelB} />
      ))}
    </div>
  );
}

// ─── DiffChangeSummary ─────────────────────────────────────────────────────────

/** Dimension accent colours for change-point labels */
const DIM_ACCENT: Record<DimKey, string> = {
  system:      "text-sky-700 bg-sky-50 border-sky-200",
  preparation: "text-violet-700 bg-violet-50 border-violet-200",
  operation:   "text-indigo-700 bg-indigo-50 border-indigo-200",
  measurement: "text-teal-700 bg-teal-50 border-teal-200",
};

/**
 * "核心变量变化" summary panel.
 * Sits between the block context / header cards and the 4-dimension detail list.
 * Shared by MainTransitionDialog and CompareTransitionDialog.
 */
export function DiffChangeSummary({ diff }: { diff: BlockDiff }) {
  const summary = summarizeBlockDiff(diff);

  // When everything is identical the existing DiffSummaryBar already says so —
  // no need to duplicate that message here.
  if (summary.identical) return null;

  const coreCount = summary.changePoints.filter((p) => p.priority === "core").length;
  const secCount  = summary.changePoints.filter((p) => p.priority === "secondary").length;

  return (
    <div className="px-6 py-3.5 border-b border-slate-100 bg-amber-50/60 shrink-0">

      {/* Label row */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">
          核心变量变化
        </span>
        <span className="text-[9px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
          SciBlock 推断
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {coreCount > 0 && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
              核心 {coreCount}
            </span>
          )}
          {secCount > 0 && (
            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              次级 {secCount}
            </span>
          )}
        </div>
      </div>

      {/* Headline */}
      <div className="text-[13px] font-semibold text-slate-800 leading-snug mb-2.5">
        {summary.headline}
      </div>

      {/* Change point list (structural layer) */}
      {summary.changePoints.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {summary.changePoints.map((point) => (
            <div key={point.dim} className="flex items-start gap-2">
              {/* Priority badge */}
              <span
                className={[
                  "shrink-0 mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border",
                  point.priority === "core"
                    ? "bg-amber-100 text-amber-700 border-amber-200"
                    : "bg-slate-100 text-slate-400 border-slate-200",
                ].join(" ")}
              >
                {point.priority === "core" ? "核心" : "次级"}
              </span>

              {/* Dim label pill */}
              <span
                className={[
                  "shrink-0 mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                  DIM_ACCENT[point.dim],
                ].join(" ")}
              >
                {point.dimLabel}
              </span>

              {/* Description */}
              <span className="text-[12px] text-slate-600 leading-relaxed">
                {point.description}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Problem 3 fix: Title-param dimension — value-level A→B display ── */}
      {summary.titleParamChanges.length > 0 && (
        <div className={summary.changePoints.length > 0 ? "mt-2.5 pt-2 border-t border-amber-200/60" : ""}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[9px] font-semibold text-amber-600 uppercase tracking-wider">
              实验参数维度
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {summary.titleParamChanges.map((c) => {
              const isAdded = c.type === "added";
              return (
                <div
                  key={`${c.type}-${c.key}`}
                  className="flex items-center gap-2 text-[11px]"
                >
                  {/* Direction badge */}
                  <span
                    className={[
                      "shrink-0 text-[10px] font-bold w-4 text-center",
                      isAdded ? "text-emerald-600" : "text-orange-600",
                    ].join(" ")}
                  >
                    {isAdded ? "＋" : "－"}
                  </span>

                  {/* Param name */}
                  <span className="font-semibold text-slate-700 shrink-0">
                    {c.keyLabel}
                  </span>

                  {/* A → B values */}
                  <span className="text-slate-400 shrink-0">：</span>

                  {isAdded ? (
                    <>
                      <span className="text-slate-400">A 无</span>
                      <span className="text-slate-300 shrink-0">→</span>
                      <span className="font-medium text-emerald-700">
                        B {c.valueB ?? "有"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-orange-700">
                        A {c.valueA ?? "有"}
                      </span>
                      <span className="text-slate-300 shrink-0">→</span>
                      <span className="text-slate-400">B 无</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
