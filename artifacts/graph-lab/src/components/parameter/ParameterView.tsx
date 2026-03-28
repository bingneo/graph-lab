import { useState } from "react";
import type { ParameterGraph, ParameterDimension } from "@/api/types";
import { ParameterDimensionList } from "./ParameterDimensionList";
import { ParameterValuePanel } from "./ParameterValuePanel";

interface ParameterViewProps {
  graph: ParameterGraph | null;
  isLoading: boolean;
  error: string | null;
  selectedRecordId: string | null;
  onRecordSelect: (recordId: string) => void;
}

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-slate-400">正在提取参数维度…</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <p className="text-sm text-red-500 text-center">{message}</p>
    </div>
  );
}

export function ParameterView({
  graph,
  isLoading,
  error,
  selectedRecordId,
  onRecordSelect,
}: ParameterViewProps) {
  const [selectedDimensionId, setSelectedDimensionId] = useState<string | null>(null);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!graph) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-slate-400">暂无数据</p>
      </div>
    );
  }

  const selectedDimension: ParameterDimension | null =
    graph.dimensions.find((d) => d.dimension_id === selectedDimensionId) ?? null;

  return (
    <>
      {/* Left: Parameter dimension list */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col shrink-0" style={{ width: 220 }}>
        <ParameterDimensionList
          dimensions={graph.dimensions}
          selectedDimensionId={selectedDimensionId}
          onDimensionSelect={setSelectedDimensionId}
        />
      </section>

      {/* Middle: Parameter value panel */}
      <section className="flex-1 min-w-0 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <ParameterValuePanel
          dimension={selectedDimension}
          selectedRecordId={selectedRecordId}
          onRecordSelect={onRecordSelect}
        />
      </section>
    </>
  );
}
