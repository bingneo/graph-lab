import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ChainProjectNode } from "@/api/types";

function ProjectChainNode({ data: rawData }: NodeProps) {
  const data = rawData as unknown as ChainProjectNode;

  return (
    <div
      className="rounded-xl shadow-lg overflow-hidden select-none"
      style={{ width: 200, height: 112 }}
    >
      <div className="h-full flex flex-col justify-between p-3.5 bg-gradient-to-br from-blue-600 to-violet-600">
        <div>
          <div className="text-[10px] font-semibold text-blue-200 uppercase tracking-widest mb-1">
            研发项目
          </div>
          <div className="text-white font-semibold text-sm leading-snug line-clamp-2">
            {data.label}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <div className="flex flex-col items-center">
            <span className="text-white font-bold text-base leading-none">{data.total_records}</span>
            <span className="text-blue-200 text-[10px] mt-0.5">记录</span>
          </div>
          <div className="w-px h-6 bg-white/20" />
          <div className="flex flex-col items-center">
            <span className="text-white font-bold text-base leading-none">{data.total_blocks}</span>
            <span className="text-blue-200 text-[10px] mt-0.5">阶段</span>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-white !border-2 !border-blue-400 !w-3 !h-3"
      />
    </div>
  );
}

export default memo(ProjectChainNode);
