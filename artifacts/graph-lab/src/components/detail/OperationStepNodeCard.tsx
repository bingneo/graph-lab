import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { OperationStepNode } from "@/api/types";

function OperationStepNodeCard({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as OperationStepNode;

  return (
    <div
      className={[
        "rounded-lg border-2 bg-indigo-50 border-indigo-300 shadow-sm px-3 py-2.5",
        "select-none transition-all duration-150",
        selected ? "ring-2 ring-indigo-400 ring-offset-1 shadow-md" : "",
      ].join(" ")}
      style={{ width: 200 }}
    >
      <Handle type="target" position={Position.Left} className="!bg-indigo-400 !w-2 !h-2" />

      {/* Step header: order badge + name */}
      <div className="flex items-start gap-2 mb-2">
        <span className="flex-none w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
          {data.order}
        </span>
        <span className="text-sm font-semibold text-indigo-800 leading-tight break-words">
          {data.name}
        </span>
      </div>

      {/* Params as compact KV rows */}
      {data.params.length > 0 && (
        <div className="space-y-1 border-t border-indigo-200 pt-2 mt-1">
          {data.params.map((p, i) => (
            <div key={i} className="flex items-baseline justify-between gap-1 text-[11px]">
              <span className="text-indigo-500 shrink-0 leading-tight">{p.key}</span>
              <span className="font-medium text-indigo-800 text-right leading-tight">{p.value}</span>
            </div>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-indigo-400 !w-2 !h-2" />
    </div>
  );
}

export default memo(OperationStepNodeCard);
