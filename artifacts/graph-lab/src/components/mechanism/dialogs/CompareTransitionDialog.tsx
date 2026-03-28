import { useMemo } from "react";
import type { MechanismBlock } from "@/api/types";
import { computeBlockDiff } from "@/utils/compareBlockDiff";
import { DiffSummaryBar, DiffSectionList, DiffChangeSummary } from "@/components/mechanism/shared/DiffSectionView";

interface CompareTransitionDialogProps {
  blockA: MechanismBlock | null;
  blockB: MechanismBlock | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CompareTransitionDialog({
  blockA,
  blockB,
  isOpen,
  onClose,
}: CompareTransitionDialogProps) {
  const diff = useMemo(() => {
    if (!blockA || !blockB) return null;
    return computeBlockDiff(blockA, blockB);
  }, [blockA, blockB]);

  if (!isOpen || !blockA || !blockB || !diff) return null;

  const labelA = "A";
  const labelB = "B";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[88vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
          <div className="flex-1">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              阶段对比分析
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">A</span>
                  <span className="text-xs font-semibold text-slate-700 truncate">{blockA.stage_label}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{blockA.objective_summary}</div>
              </div>
              <span className="text-slate-400 font-bold text-sm shrink-0">vs</span>
              <div className="flex-1 rounded-lg bg-violet-50 border border-violet-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full">B</span>
                  <span className="text-xs font-semibold text-slate-700 truncate">{blockB.stage_label}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{blockB.objective_summary}</div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Core variable change summary — sits between header cards and detail list */}
        <DiffChangeSummary diff={diff} />

        <DiffSummaryBar totalDiffCount={diff.totalDiffCount} dimDiffs={diff.dimDiffs} />

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <DiffSectionList dimDiffs={diff.dimDiffs} labelA={labelA} labelB={labelB} />
        </div>
      </div>
    </div>
  );
}
