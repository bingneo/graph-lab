import type { MechanismBlock, BlockStatus, BlockType } from "@/api/types";
import { TRACKED_TAGS } from "@/utils/blockTagSummary";

// ─── Design System (mirrors MechanismBlockNode) ───────────────────────────────

interface TypeConfig {
  icon: string;
  typeLabel: string;
  headerBg: string;
  headerText: string;
  headerIconBg: string;
  accentDot: string;
}

const TYPE_CONFIG: Record<BlockType, TypeConfig> = {
  initial_setup: {
    icon: "⚗",
    typeLabel: "系统建立",
    headerBg: "bg-sky-500",
    headerText: "text-white",
    headerIconBg: "bg-sky-400",
    accentDot: "bg-sky-500",
  },
  condition_exploration: {
    icon: "◈",
    typeLabel: "条件探索",
    headerBg: "bg-indigo-500",
    headerText: "text-white",
    headerIconBg: "bg-indigo-400",
    accentDot: "bg-indigo-500",
  },
  parameter_optimization: {
    icon: "⊛",
    typeLabel: "参数优化",
    headerBg: "bg-violet-600",
    headerText: "text-white",
    headerIconBg: "bg-violet-500",
    accentDot: "bg-violet-600",
  },
  repeat_validation: {
    icon: "↺",
    typeLabel: "重复验证",
    headerBg: "bg-teal-500",
    headerText: "text-white",
    headerIconBg: "bg-teal-400",
    accentDot: "bg-teal-500",
  },
  measurement_validation: {
    icon: "◎",
    typeLabel: "测量验证",
    headerBg: "bg-orange-500",
    headerText: "text-white",
    headerIconBg: "bg-orange-400",
    accentDot: "bg-orange-500",
  },
  result_confirmation: {
    icon: "✓",
    typeLabel: "结果确认",
    headerBg: "bg-emerald-600",
    headerText: "text-white",
    headerIconBg: "bg-emerald-500",
    accentDot: "bg-emerald-600",
  },
  mixed_progression: {
    icon: "⊕",
    typeLabel: "综合推进",
    headerBg: "bg-slate-500",
    headerText: "text-white",
    headerIconBg: "bg-slate-400",
    accentDot: "bg-slate-500",
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const CONFIRMATION_LABELS: Record<string, { label: string; cls: string }> = {
  confirmed: {
    label: "已确认",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  confirmed_dirty: {
    label: "需更新",
    cls: "bg-amber-50 text-amber-700 border-amber-100",
  },
  draft: {
    label: "草稿",
    cls: "bg-slate-50 text-slate-500 border-slate-200",
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface BlockDetailDialogProps {
  block: MechanismBlock | null;
  isOpen: boolean;
  onClose: () => void;
  onRecordNavigate: (recordId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BlockDetailDialog({
  block,
  isOpen,
  onClose,
  onRecordNavigate,
}: BlockDetailDialogProps) {
  if (!isOpen || !block) return null;

  const typeConfig =
    block.block_type && TYPE_CONFIG[block.block_type]
      ? TYPE_CONFIG[block.block_type]
      : TYPE_CONFIG.mixed_progression;

  const statusConfig = STATUS_CONFIG[block.block_status] ?? STATUS_CONFIG.exploring;
  const titlePhrase = extractTitlePhrase(block.stage_label);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Dialog panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[84vh] flex flex-col overflow-hidden">

        {/* ── Colored header band (block type identity) ────────────────────── */}
        <div className={`${typeConfig.headerBg} ${typeConfig.headerText} px-6 pt-5 pb-4 shrink-0`}>

          {/* Top row: icon + stage designation + close */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span
                className={[
                  typeConfig.headerIconBg,
                  "w-9 h-9 rounded-xl flex items-center justify-center text-white text-xl font-bold shrink-0",
                ].join(" ")}
              >
                {typeConfig.icon}
              </span>
              <div>
                <div className="text-white/70 text-[10px] font-semibold uppercase tracking-widest">
                  阶段 {block.stage_index}
                </div>
                <div className="text-white text-[12px] font-semibold">
                  {typeConfig.typeLabel}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors shrink-0"
            >
              ✕
            </button>
          </div>

          {/* Title phrase */}
          <h2 className="text-[20px] font-bold text-white leading-tight mb-2">
            {titlePhrase}
          </h2>

          {/* Status pill + record count */}
          <div className="flex items-center gap-2">
            <span
              className={[
                "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full",
                statusConfig.pill,
              ].join(" ")}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
              {statusConfig.label}
            </span>
            <span className="text-white/50 text-[11px]">
              {block.record_count} 条实验记录
            </span>
          </div>
        </div>

        {/* ── Objective summary ─────────────────────────────────────────────── */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            阶段目标
          </div>
          <p className="text-[13px] text-slate-700 leading-relaxed">
            {block.objective_summary}
          </p>
        </div>

        {/* ── Meta strip ───────────────────────────────────────────────────── */}
        <div className="px-6 py-2 border-b border-slate-100 flex items-center gap-3 text-[11px] text-slate-500 shrink-0 bg-white">
          <span>
            {formatDate(block.created_range.earliest)}
            {block.created_range.earliest !== block.created_range.latest && (
              <> → {formatDate(block.created_range.latest)}</>
            )}
          </span>
        </div>

        {/* ── Record list ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
          <div className="text-[11px] font-medium text-slate-400 tracking-wide mb-1 px-1">
            实验记录
          </div>

          {block.experiment_snapshots.map((snap) => {
            const confStyle =
              CONFIRMATION_LABELS[snap.confirmation_state] ?? CONFIRMATION_LABELS.draft;

            return (
              <button
                key={snap.record_id}
                onClick={() => {
                  onRecordNavigate(snap.record_id);
                  onClose();
                }}
                className="w-full text-left border border-slate-200 rounded-xl p-3.5 hover:bg-slate-50 hover:border-violet-300 hover:shadow-sm transition-all duration-150 group"
              >
                <div className="flex items-start gap-3">
                  {/* Code badge */}
                  <span className="font-mono text-sm font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
                    {snap.experiment_code}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-700 font-medium truncate mb-1.5">
                      {snap.title || "未命名实验"}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${confStyle.cls}`}
                      >
                        {confStyle.label}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                        {snap.experiment_status}
                      </span>
                      {snap.tags.map((tag) => {
                        const tracked = TRACKED_TAGS.find((t) => t.tag === tag);
                        const chipCls = tracked
                          ? `${tracked.chipBg} ${tracked.text} ${tracked.border}`
                          : "bg-violet-50 text-violet-600 border-violet-100";
                        return (
                          <span
                            key={tag}
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${chipCls}`}
                          >
                            {tag}
                          </span>
                        );
                      })}
                    </div>

                    <div className="mt-1.5 text-[10px] text-slate-400 flex items-center gap-2">
                      <span>{snap.modules.operation.steps.length} 操作步骤</span>
                      <span className="text-slate-200">·</span>
                      <span>{snap.modules.measurement.items.length} 测量项</span>
                      <span className="text-slate-200">·</span>
                      <span>{snap.modules.preparation.items.length} 准备项</span>
                    </div>
                  </div>

                  <span className="text-slate-300 group-hover:text-violet-400 transition-colors text-base shrink-0 self-center font-medium">
                    →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
