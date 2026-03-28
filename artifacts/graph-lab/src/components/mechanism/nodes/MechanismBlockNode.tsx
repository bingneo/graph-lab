import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { MechanismBlock, BlockStatus, BlockType } from "@/api/types";
import type { TagCount, DominantSignal } from "@/utils/blockTagSummary";
import { hasAnyTrackedTags } from "@/utils/blockTagSummary";

// ─── Design System ────────────────────────────────────────────────────────────

interface TypeConfig {
  icon: string;
  typeLabel: string;
  ribbonBg: string;
  ribbonText: string;
  ribbonIconBg: string;
  leftBar: string;
  summaryAccent: string;
}

const TYPE_CONFIG: Record<BlockType, TypeConfig> = {
  initial_setup: {
    icon: "⚗",
    typeLabel: "系统建立",
    ribbonBg: "bg-sky-500",
    ribbonText: "text-white",
    ribbonIconBg: "bg-sky-400",
    leftBar: "border-l-sky-500",
    summaryAccent: "text-sky-800",
  },
  condition_exploration: {
    icon: "◈",
    typeLabel: "条件探索",
    ribbonBg: "bg-indigo-500",
    ribbonText: "text-white",
    ribbonIconBg: "bg-indigo-400",
    leftBar: "border-l-indigo-500",
    summaryAccent: "text-indigo-800",
  },
  parameter_optimization: {
    icon: "⊛",
    typeLabel: "参数优化",
    ribbonBg: "bg-violet-600",
    ribbonText: "text-white",
    ribbonIconBg: "bg-violet-500",
    leftBar: "border-l-violet-600",
    summaryAccent: "text-violet-800",
  },
  repeat_validation: {
    icon: "↺",
    typeLabel: "重复验证",
    ribbonBg: "bg-teal-500",
    ribbonText: "text-white",
    ribbonIconBg: "bg-teal-400",
    leftBar: "border-l-teal-500",
    summaryAccent: "text-teal-800",
  },
  measurement_validation: {
    icon: "◎",
    typeLabel: "测量验证",
    ribbonBg: "bg-orange-500",
    ribbonText: "text-white",
    ribbonIconBg: "bg-orange-400",
    leftBar: "border-l-orange-500",
    summaryAccent: "text-orange-900",
  },
  result_confirmation: {
    icon: "✓",
    typeLabel: "结果确认",
    ribbonBg: "bg-emerald-600",
    ribbonText: "text-white",
    ribbonIconBg: "bg-emerald-500",
    leftBar: "border-l-emerald-600",
    summaryAccent: "text-emerald-900",
  },
  mixed_progression: {
    icon: "⊕",
    typeLabel: "综合推进",
    ribbonBg: "bg-slate-500",
    ribbonText: "text-white",
    ribbonIconBg: "bg-slate-400",
    leftBar: "border-l-slate-500",
    summaryAccent: "text-slate-700",
  },
};

interface StatusConfig {
  dot: string;
  pill: string;
  label: string;
}

const STATUS_CONFIG: Record<BlockStatus, StatusConfig> = {
  exploring: {
    dot: "bg-blue-400",
    pill: "bg-blue-50 text-blue-700 border border-blue-200",
    label: "探索中",
  },
  consolidating: {
    dot: "bg-violet-500",
    pill: "bg-violet-50 text-violet-700 border border-violet-200",
    label: "整合中",
  },
  archived: {
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    label: "已归档",
  },
  mixed: {
    dot: "bg-orange-400",
    pill: "bg-orange-50 text-orange-700 border border-orange-200",
    label: "调整中",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTitlePhrase(stageLabel: string): string {
  const idx = stageLabel.indexOf("：");
  return idx >= 0 ? stageLabel.slice(idx + 1) : stageLabel;
}

// ─── Compare state type ───────────────────────────────────────────────────────

type CompareState = "first" | "second" | null;

// ─── Tag Strip sub-component ──────────────────────────────────────────────────

/**
 * Compact result-signal strip rendered at the bottom of the block node.
 * Shows non-zero tracked tags + the dominant signal indicator.
 */
function TagStrip({
  tagSummary,
  dominantSignal,
}: {
  tagSummary: TagCount[];
  dominantSignal: DominantSignal | null;
}) {
  const activeTags = tagSummary.filter((t) => t.count > 0);

  // Nothing to show
  if (activeTags.length === 0) return null;

  return (
    <div className="px-3.5 pb-2.5 pt-0 flex flex-col gap-1.5">
      {/* Thin separator */}
      <div className="border-t border-slate-100" />

      {/* Row: tag counts on left, dominant signal on right */}
      <div className="flex items-center justify-between min-w-0">

        {/* Tag count chips */}
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          {activeTags.map((t) => (
            <span
              key={t.tag}
              className={[
                "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                t.chipBg,
                t.text,
                t.border,
              ].join(" ")}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.bg}`} />
              {t.tag}
              <span className="font-bold">{t.count}</span>
            </span>
          ))}
        </div>

        {/* Dominant signal — subtle right-aligned pill */}
        {dominantSignal && (
          <span
            className={[
              "shrink-0 ml-1.5 text-[9px] font-semibold flex items-center gap-1",
              dominantSignal.text,
            ].join(" ")}
            title={`主导信号：${dominantSignal.label}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dominantSignal.dot}`} />
            {dominantSignal.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

function MechanismBlockNode({ data: rawData, selected }: NodeProps) {
  const raw = rawData as unknown as Record<string, unknown>;
  const data = raw as unknown as MechanismBlock;

  const compareState = (raw._compareState ?? null) as CompareState;
  const inCompareMode = Boolean(raw._isCompareMode);
  const isFilterHit = raw._hasActiveFilter ? Boolean(raw._isFilterHit) : true;

  const tagSummary = (raw._tagSummary ?? null) as TagCount[] | null;
  const dominantSignal = (raw._dominantSignal ?? null) as DominantSignal | null;

  const typeConfig =
    data.block_type && TYPE_CONFIG[data.block_type]
      ? TYPE_CONFIG[data.block_type]
      : TYPE_CONFIG.mixed_progression;

  const statusConfig = STATUS_CONFIG[data.block_status] ?? STATUS_CONFIG.exploring;

  const titlePhrase = extractTitlePhrase(data.stage_label);

  const earliest = new Date(data.created_range.earliest).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
  const latest = new Date(data.created_range.latest).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
  const dateRange = earliest === latest ? earliest : `${earliest} → ${latest}`;

  // ── Visual state ───────────────────────────────────────────────────────────

  const compareRing =
    compareState === "first"
      ? "ring-2 ring-blue-500 ring-offset-1"
      : compareState === "second"
        ? "ring-2 ring-violet-500 ring-offset-1"
        : "";

  const selectionRing =
    !inCompareMode && selected ? "ring-2 ring-violet-400 ring-offset-1 shadow-xl" : "";

  const compareDim = inCompareMode && compareState === null;
  const filterDim = !isFilterHit;
  const dimming = compareDim || filterDim ? "opacity-25" : "";

  const cursor = inCompareMode
    ? compareState !== null
      ? "cursor-default"
      : "cursor-crosshair"
    : "cursor-pointer";

  const hoverEffect =
    !inCompareMode && !selected ? "hover:shadow-lg hover:translate-y-[-2px]" : "";

  const showTagStrip = tagSummary !== null && hasAnyTrackedTags(tagSummary);

  return (
    <div
      className={[
        "rounded-xl border border-slate-200 border-l-4 shadow-md overflow-hidden",
        "select-none transition-all duration-150 bg-white",
        typeConfig.leftBar,
        cursor,
        compareRing,
        selectionRing,
        dimming,
        hoverEffect,
      ].join(" ")}
      style={{ width: 268 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-slate-300 !border-white !border-2 !w-2.5 !h-2.5"
      />

      {/* ── Ribbon: block type identity ──────────────────────────────────── */}
      <div
        className={[
          typeConfig.ribbonBg,
          typeConfig.ribbonText,
          "px-3 py-2 flex items-center justify-between",
        ].join(" ")}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={[
              typeConfig.ribbonIconBg,
              "w-6 h-6 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0",
            ].join(" ")}
          >
            {typeConfig.icon}
          </span>

          <span className="text-white/70 text-[10px] font-semibold shrink-0">
            阶段 {data.stage_index}
          </span>

          <span className="text-white/40 text-[9px]">·</span>

          <span className="text-white text-[10px] font-semibold tracking-wide truncate">
            {typeConfig.typeLabel}
          </span>
        </div>

        {/* Compare A/B badge */}
        {compareState !== null && (
          <span
            className={[
              "text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-1",
              compareState === "first"
                ? "bg-white text-blue-600"
                : "bg-white text-violet-600",
            ].join(" ")}
          >
            {compareState === "first" ? "A" : "B"}
          </span>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="px-3.5 pt-3 pb-2.5 flex flex-col gap-2">

        {/* Layer 1: Title phrase */}
        <div className="text-[15px] font-bold text-slate-900 leading-snug line-clamp-2">
          {titlePhrase}
        </div>

        {/* Layer 2: Status indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className={[
              "inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full",
              statusConfig.pill,
            ].join(" ")}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
            {statusConfig.label}
          </span>
          <span className="text-[10px] text-slate-400">
            {data.record_count} 条记录
          </span>
        </div>

        {/* Separator */}
        <div className="border-t border-slate-100" />

        {/* Layer 3: Objective summary */}
        <div className="text-[12px] text-slate-600 leading-relaxed line-clamp-2">
          {data.objective_summary}
        </div>

        {/* Layer 4: Meta info */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
          <span>{dateRange}</span>
          {inCompareMode ? (
            compareState !== null ? (
              <span
                className={
                  compareState === "first" ? "text-blue-500 font-semibold" : "text-violet-500 font-semibold"
                }
              >
                已选为 {compareState === "first" ? "A" : "B"}
              </span>
            ) : (
              <span className="text-violet-400">点击选中</span>
            )
          ) : (
            <span className="text-slate-300">查看详情 ›</span>
          )}
        </div>
      </div>

      {/* ── Layer 5: Result signal strip ─────────────────────────────────── */}
      {showTagStrip && (
        <TagStrip tagSummary={tagSummary!} dominantSignal={dominantSignal} />
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-slate-300 !border-white !border-2 !w-2.5 !h-2.5"
      />
    </div>
  );
}

export default memo(MechanismBlockNode);
