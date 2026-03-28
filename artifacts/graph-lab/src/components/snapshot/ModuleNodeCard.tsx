import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ModuleNode, ModuleKey } from "@/api/types";

const MODULE_STYLES: Record<ModuleKey, { bg: string; icon: string; accent: string }> = {
  system: {
    bg: "bg-violet-50 border-violet-300",
    icon: "⚙️",
    accent: "text-violet-700",
  },
  preparation: {
    bg: "bg-sky-50 border-sky-300",
    icon: "🧪",
    accent: "text-sky-700",
  },
  operation: {
    bg: "bg-indigo-50 border-indigo-300",
    icon: "🔬",
    accent: "text-indigo-700",
  },
  measurement: {
    bg: "bg-teal-50 border-teal-300",
    icon: "📏",
    accent: "text-teal-700",
  },
  data: {
    bg: "bg-orange-50 border-orange-300",
    icon: "📊",
    accent: "text-orange-700",
  },
};

function getModuleStyle(key: ModuleKey) {
  return MODULE_STYLES[key] ?? MODULE_STYLES.system;
}

function ModuleNodeCard({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as ModuleNode;
  const style = getModuleStyle(data.module_key);
  const isOutcome = data.is_outcome_node;
  const isFromFallback = data.data_source === "current_modules" && !isOutcome;

  return (
    <div
      className={[
        "rounded-lg border-2 shadow-sm px-3 py-2.5 select-none cursor-pointer",
        "transition-all duration-150",
        style.bg,
        isOutcome ? "border-dashed" : "",
        selected ? "ring-2 ring-blue-400 ring-offset-1 shadow-md" : "",
      ].join(" ")}
      style={{ width: 180, minHeight: 100 }}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-2 !h-2" />

      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-base leading-none">{style.icon}</span>
        <span className={`text-sm font-semibold leading-tight ${style.accent}`}>
          {data.title}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <span className="text-[11px] text-slate-500 bg-white/70 border border-slate-200 px-1.5 py-0.5 rounded">
          {data.item_count} items
        </span>
        {isOutcome && (
          <span className="text-[10px] font-medium text-orange-600 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
            Outcome
          </span>
        )}
        {isFromFallback && (
          <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
            Live
          </span>
        )}
      </div>

      <div className="mt-1.5 text-[10px] text-slate-400 leading-tight">
        {data.data_source === "confirmed_modules" ? "confirmed snapshot" : "current modules"}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  );
}

export default memo(ModuleNodeCard);
