import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { LineageNode, ConfirmationState } from "@/api/types";

const STATE_STYLES: Record<ConfirmationState, { border: string; badge: string; label: string }> = {
  confirmed: {
    border: "border-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    label: "Confirmed",
  },
  draft: {
    border: "border-slate-300",
    badge: "bg-slate-50 text-slate-600 border border-slate-200",
    label: "Draft",
  },
  confirmed_dirty: {
    border: "border-amber-400",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    label: "Dirty",
  },
};

function getStateStyle(state: ConfirmationState) {
  return STATE_STYLES[state] ?? STATE_STYLES.draft;
}

function LineageNodeCard({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as LineageNode;
  const style = getStateStyle(data.confirmation_state);

  return (
    <div
      className={[
        "bg-white rounded-lg border-2 shadow-sm px-3 py-2.5 cursor-pointer select-none",
        "transition-all duration-150",
        style.border,
        selected ? "ring-2 ring-blue-400 ring-offset-1 shadow-md" : "",
      ].join(" ")}
      style={{ width: 220, minHeight: 90 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2" />

      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="font-mono text-sm font-semibold text-slate-800 leading-tight truncate">
          {data.experiment_code}
        </span>
        {data.is_root && (
          <span className="shrink-0 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
            Root
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${style.badge}`}>
          {style.label}
        </span>
        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
          {data.experiment_status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-1.5 text-[10px] text-slate-400 font-mono">
        #{data.sequence_number} · {new Date(data.updated_at).toLocaleDateString()}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  );
}

export default memo(LineageNodeCard);
