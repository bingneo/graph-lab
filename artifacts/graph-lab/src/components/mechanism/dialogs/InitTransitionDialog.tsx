import { useMemo } from "react";
import type { ChainProjectNode, MechanismBlock } from "@/api/types";
import { computeInitDiff } from "@/utils/compareBlockDiff";
import { DiffSummaryBar, DiffSectionList } from "@/components/mechanism/shared/DiffSectionView";

interface InitTransitionDialogProps {
  projectNode: ChainProjectNode | null;
  targetBlock: MechanismBlock | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InitTransitionDialog({
  projectNode,
  targetBlock,
  isOpen,
  onClose,
}: InitTransitionDialogProps) {
  /**
   * Data source for this diff:
   *   FALLBACK — computeInitDiff uses snapshot[0] of the first block as the
   *   "initial extraction" baseline, and all snapshots as the "retained" side.
   *
   *   When a real initial_ontology DB table is available, replace computeInitDiff
   *   with a function that reads from that source and sets dataSource = "real_initial_snapshot".
   */
  const diff = useMemo(() => {
    if (!targetBlock) return null;
    return computeInitDiff(targetBlock);
  }, [targetBlock]);

  if (!isOpen || !projectNode || !targetBlock || !diff) return null;

  const isFallback = diff.dataSource === "fallback_first_snapshot";
  const hasMultipleSnapshots = targetBlock.experiment_snapshots.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[88vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">研发起点初始化</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {projectNode.label} → 初始阶段 · {targetBlock.stage_label}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Context bar: Project → Block */}
        <div className="px-6 pt-4 pb-3 flex items-stretch gap-3 shrink-0 border-b border-slate-100">
          {/* Project card */}
          <div className="flex-1 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 px-4 py-3">
            <div className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider mb-1">
              研发项目
            </div>
            <div className="text-sm font-semibold text-white leading-snug mb-2">
              {projectNode.label}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <span className="text-white font-bold text-sm">{projectNode.total_records}</span>
                <span className="text-blue-200 text-[10px]">记录</span>
              </div>
              <div className="w-px h-5 bg-white/20" />
              <div className="flex flex-col items-center">
                <span className="text-white font-bold text-sm">{projectNode.total_blocks}</span>
                <span className="text-blue-200 text-[10px]">阶段</span>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center px-2">
            <div className="flex flex-col items-center gap-1">
              <div className="w-px h-4 bg-slate-200" />
              <span className="text-slate-400 text-base font-medium">→</span>
              <div className="w-px h-4 bg-slate-200" />
            </div>
          </div>

          {/* First block card */}
          <div className="flex-1 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
            <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">
              初始阶段
            </div>
            <div className="text-sm font-semibold text-blue-700 leading-snug mb-1.5">
              {targetBlock.stage_label}
            </div>
            <div className="text-[11px] text-blue-600 line-clamp-2 leading-relaxed mb-1">
              {targetBlock.objective_summary}
            </div>
            <div className="text-[11px] text-blue-400">
              {targetBlock.record_count} 条实验记录
            </div>
          </div>
        </div>

        {/* Diff interpretation notice */}
        <div className="px-6 pt-3 pb-0 shrink-0">
          <div
            className={[
              "rounded-lg px-3 py-2 text-[11px] flex items-start gap-2",
              isFallback
                ? "bg-amber-50 border border-amber-200 text-amber-700"
                : "bg-blue-50 border border-blue-200 text-blue-700",
            ].join(" ")}
          >
            <span className="shrink-0 mt-0.5">{isFallback ? "ℹ" : "✓"}</span>
            <span>
              {isFallback
                ? hasMultipleSnapshots
                  ? `数据来源（近似）：左侧 = 初始实验 ${targetBlock.experiment_snapshots[0]?.experiment_code}（作为初始化提取的代理），右侧 = 阶段内所有 ${targetBlock.experiment_snapshots.length} 条实验聚合。差异反映了初始实验之后的知识扩展或修正。`
                  : `该初始阶段仅有 1 条实验记录，初始化提取与最终保留的数据完全一致（单实验无修正历史）。`
                : "数据来源：真实初始化本体记录。"}
            </span>
          </div>
        </div>

        {/* Diff summary */}
        <div className="mt-3">
          <DiffSummaryBar totalDiffCount={diff.totalDiffCount} dimDiffs={diff.dimDiffs} />
        </div>

        {/* Diff sections */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <DiffSectionList
            dimDiffs={diff.dimDiffs}
            labelA={diff.labelA}
            labelB={diff.labelB}
          />
        </div>
      </div>
    </div>
  );
}
