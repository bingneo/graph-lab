import { useMemo } from "react";
import type { MechanismBlock, BlockType, BlockStatus } from "@/api/types";
import { computeBlockDiff } from "@/utils/compareBlockDiff";
import { DiffSummaryBar, DiffSectionList, DiffChangeSummary } from "@/components/mechanism/shared/DiffSectionView";

// ─── Design tokens (same palette as node + detail dialog) ─────────────────────

interface TypeConfig {
  icon: string;
  typeLabel: string;
  accentBg: string;
  accentText: string;
  cardBg: string;
  cardBorder: string;
  titleColor: string;
}

const TYPE_CONFIG: Record<BlockType, TypeConfig> = {
  initial_setup: {
    icon: "⚗",
    typeLabel: "系统建立",
    accentBg: "bg-sky-500",
    accentText: "text-white",
    cardBg: "bg-sky-50",
    cardBorder: "border-sky-200",
    titleColor: "text-sky-900",
  },
  condition_exploration: {
    icon: "◈",
    typeLabel: "条件探索",
    accentBg: "bg-indigo-500",
    accentText: "text-white",
    cardBg: "bg-indigo-50",
    cardBorder: "border-indigo-200",
    titleColor: "text-indigo-900",
  },
  parameter_optimization: {
    icon: "⊛",
    typeLabel: "参数优化",
    accentBg: "bg-violet-600",
    accentText: "text-white",
    cardBg: "bg-violet-50",
    cardBorder: "border-violet-200",
    titleColor: "text-violet-900",
  },
  repeat_validation: {
    icon: "↺",
    typeLabel: "重复验证",
    accentBg: "bg-teal-500",
    accentText: "text-white",
    cardBg: "bg-teal-50",
    cardBorder: "border-teal-200",
    titleColor: "text-teal-900",
  },
  measurement_validation: {
    icon: "◎",
    typeLabel: "测量验证",
    accentBg: "bg-orange-500",
    accentText: "text-white",
    cardBg: "bg-orange-50",
    cardBorder: "border-orange-200",
    titleColor: "text-orange-900",
  },
  result_confirmation: {
    icon: "✓",
    typeLabel: "结果确认",
    accentBg: "bg-emerald-600",
    accentText: "text-white",
    cardBg: "bg-emerald-50",
    cardBorder: "border-emerald-200",
    titleColor: "text-emerald-900",
  },
  mixed_progression: {
    icon: "⊕",
    typeLabel: "综合推进",
    accentBg: "bg-slate-500",
    accentText: "text-white",
    cardBg: "bg-slate-50",
    cardBorder: "border-slate-200",
    titleColor: "text-slate-800",
  },
};

const STATUS_DOT: Record<BlockStatus, string> = {
  exploring: "bg-blue-400",
  consolidating: "bg-violet-500",
  archived: "bg-emerald-500",
  mixed: "bg-orange-400",
};

const STATUS_LABEL: Record<BlockStatus, string> = {
  exploring: "探索中",
  consolidating: "整合中",
  archived: "已归档",
  mixed: "调整中",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTitlePhrase(stageLabel: string): string {
  const idx = stageLabel.indexOf("：");
  return idx >= 0 ? stageLabel.slice(idx + 1) : stageLabel;
}

// ─── Block mini-card used in transition context bar ───────────────────────────

function BlockCard({
  block,
  side,
}: {
  block: MechanismBlock;
  side: "source" | "target";
}) {
  const typeConfig =
    block.block_type && TYPE_CONFIG[block.block_type]
      ? TYPE_CONFIG[block.block_type]
      : TYPE_CONFIG.mixed_progression;

  const dotColor = STATUS_DOT[block.block_status] ?? "bg-slate-400";
  const statusLabel = STATUS_LABEL[block.block_status] ?? "—";
  const titlePhrase = extractTitlePhrase(block.stage_label);
  const isSource = side === "source";

  return (
    <div
      className={[
        "flex-1 rounded-xl border overflow-hidden",
        typeConfig.cardBg,
        typeConfig.cardBorder,
      ].join(" ")}
    >
      {/* Mini ribbon */}
      <div
        className={[
          typeConfig.accentBg,
          typeConfig.accentText,
          "px-3 py-1.5 flex items-center gap-1.5",
        ].join(" ")}
      >
        <span className="text-[12px]">{typeConfig.icon}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-white/80">
          阶段 {block.stage_index}
        </span>
        <span className="text-white/40 text-[9px]">·</span>
        <span className="text-[9px] font-semibold text-white">
          {typeConfig.typeLabel}
        </span>
        {isSource ? null : (
          <span className="ml-auto text-[9px] text-white/60">目标阶段 →</span>
        )}
        {isSource && (
          <span className="ml-auto text-[9px] text-white/60">← 来源阶段</span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
        <div className={`text-[13px] font-bold leading-snug mb-1 ${typeConfig.titleColor}`}>
          {titlePhrase}
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          <span className="text-[10px] text-slate-500">{statusLabel}</span>
        </div>
        <div className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
          {block.objective_summary}
        </div>
        <div className="text-[10px] text-slate-400 mt-1.5">
          {block.record_count} 条实验记录
        </div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MainTransitionDialogProps {
  sourceBlock: MechanismBlock | null;
  targetBlock: MechanismBlock | null;
  isOpen: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MainTransitionDialog({
  sourceBlock,
  targetBlock,
  isOpen,
  onClose,
}: MainTransitionDialogProps) {
  const diff = useMemo(() => {
    if (!sourceBlock || !targetBlock) return null;
    return computeBlockDiff(sourceBlock, targetBlock);
  }, [sourceBlock, targetBlock]);

  if (!isOpen || !sourceBlock || !targetBlock || !diff) return null;

  const labelA =
    sourceBlock.stage_label.length > 6
      ? sourceBlock.stage_label.slice(0, 6) + "…"
      : sourceBlock.stage_label;
  const labelB =
    targetBlock.stage_label.length > 6
      ? targetBlock.stage_label.slice(0, 6) + "…"
      : targetBlock.stage_label;

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
            <h2 className="text-sm font-bold text-slate-800">阶段推进差异</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              主链跃迁 · {sourceBlock.stage_label} → {targetBlock.stage_label}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Block context bar */}
        <div className="px-6 pt-4 pb-3 flex items-stretch gap-3 shrink-0 border-b border-slate-100">
          <BlockCard block={sourceBlock} side="source" />
          <div className="flex items-center justify-center px-2">
            <div className="flex flex-col items-center gap-1">
              <div className="w-px h-5 bg-slate-200" />
              <span className="text-slate-400 text-base font-medium">→</span>
              <div className="w-px h-5 bg-slate-200" />
            </div>
          </div>
          <BlockCard block={targetBlock} side="target" />
        </div>

        {/* Core variable change summary — sits between context bar and detail list */}
        <DiffChangeSummary diff={diff} />

        {/* Diff summary */}
        <DiffSummaryBar totalDiffCount={diff.totalDiffCount} dimDiffs={diff.dimDiffs} />

        {/* Diff sections */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <DiffSectionList
            dimDiffs={diff.dimDiffs}
            labelA={labelA}
            labelB={labelB}
          />
        </div>
      </div>
    </div>
  );
}
