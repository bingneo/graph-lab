import type { ParameterDimension } from "@/api/types";

// ─── Source section header ─────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span className="text-[10px] text-slate-400">{count}</span>
    </div>
  );
}

// ─── Single dimension row ──────────────────────────────────────────────────────

interface DimensionRowProps {
  dim: ParameterDimension;
  isSelected: boolean;
  onClick: (id: string) => void;
}

function DimensionRow({ dim, isSelected, onClick }: DimensionRowProps) {
  const valueCount = dim.value_groups.length;
  return (
    <button
      type="button"
      onClick={() => onClick(dim.dimension_id)}
      className={[
        "w-full text-left px-3 py-2 rounded-md transition-all duration-100",
        isSelected
          ? "bg-violet-100 text-violet-800"
          : "hover:bg-slate-100 text-slate-700",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-[12px] font-medium truncate ${isSelected ? "text-violet-800" : "text-slate-700"}`}>
            {dim.key}
          </p>
          <p className={`text-[10px] truncate ${isSelected ? "text-violet-500" : "text-slate-400"}`}>
            {dim.source_context}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-0.5">
          <span className={[
            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
            isSelected ? "bg-violet-200 text-violet-700" : "bg-slate-200 text-slate-500",
          ].join(" ")}>
            {dim.record_count} 条
          </span>
          <span className="text-[10px] text-slate-300">{valueCount} 值</span>
        </div>
      </div>
    </button>
  );
}

// ─── Public component ──────────────────────────────────────────────────────────

interface ParameterDimensionListProps {
  dimensions: ParameterDimension[];
  selectedDimensionId: string | null;
  onDimensionSelect: (id: string) => void;
}

export function ParameterDimensionList({
  dimensions,
  selectedDimensionId,
  onDimensionSelect,
}: ParameterDimensionListProps) {
  const opDims = dimensions.filter((d) => d.source === "operation");
  const prepDims = dimensions.filter((d) => d.source === "preparation");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-200 bg-white shrink-0">
        <h2 className="text-sm font-semibold text-slate-700">参数维度</h2>
        <p className="text-[11px] text-slate-400 mt-0.5">{dimensions.length} 个维度</p>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto py-1 space-y-0.5">

        {/* Operation group */}
        {opDims.length > 0 && (
          <div>
            <SectionHeader label="Operation Parameters" count={opDims.length} />
            <div className="px-1 space-y-0.5">
              {opDims.map((dim) => (
                <DimensionRow
                  key={dim.dimension_id}
                  dim={dim}
                  isSelected={dim.dimension_id === selectedDimensionId}
                  onClick={onDimensionSelect}
                />
              ))}
            </div>
          </div>
        )}

        {/* Separator */}
        {opDims.length > 0 && prepDims.length > 0 && (
          <div className="border-t border-slate-100 mx-3 my-1" />
        )}

        {/* Preparation group */}
        {prepDims.length > 0 && (
          <div>
            <SectionHeader label="Preparation Parameters" count={prepDims.length} />
            <div className="px-1 space-y-0.5">
              {prepDims.map((dim) => (
                <DimensionRow
                  key={dim.dimension_id}
                  dim={dim}
                  isSelected={dim.dimension_id === selectedDimensionId}
                  onClick={onDimensionSelect}
                />
              ))}
            </div>
          </div>
        )}

        {dimensions.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-slate-400 italic">暂无参数维度</p>
          </div>
        )}
      </div>
    </div>
  );
}
