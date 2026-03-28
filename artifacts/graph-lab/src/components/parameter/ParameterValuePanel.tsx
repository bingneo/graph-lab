import { useState } from "react";
import type {
  ParameterDimension,
  ParameterValueGroup,
  ConfirmationState,
} from "@/api/types";
import { RecordCard } from "./RecordCard";

// ─── Filter bar ────────────────────────────────────────────────────────────────

type FilterState = Set<ConfirmationState>;
type FilterStatus = Set<string>;

const ALL_STATES: ConfirmationState[] = ["draft", "confirmed", "confirmed_dirty"];
const STATE_LABELS: Record<ConfirmationState, string> = {
  draft: "draft",
  confirmed: "confirmed",
  confirmed_dirty: "dirty",
};

interface FilterBarProps {
  allStatuses: string[];
  activeStates: FilterState;
  activeStatuses: FilterStatus;
  onToggleState: (s: ConfirmationState) => void;
  onToggleStatus: (s: string) => void;
}

function FilterBar({
  allStatuses,
  activeStates,
  activeStatuses,
  onToggleState,
  onToggleStatus,
}: FilterBarProps) {
  const noStateFilter = activeStates.size === 0;
  const noStatusFilter = activeStatuses.size === 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider text-slate-400 shrink-0">过滤</span>

      {/* Confirmation state filter */}
      {ALL_STATES.map((s) => {
        const active = !noStateFilter && activeStates.has(s);
        return (
          <button
            key={s}
            onClick={() => onToggleState(s)}
            className={[
              "text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors",
              active
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-slate-500 border-slate-200 hover:border-violet-300",
            ].join(" ")}
          >
            {STATE_LABELS[s]}
          </button>
        );
      })}

      {/* Experiment status filter */}
      {allStatuses.map((s) => {
        const active = !noStatusFilter && activeStatuses.has(s);
        return (
          <button
            key={s}
            onClick={() => onToggleStatus(s)}
            className={[
              "text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors",
              active
                ? "bg-sky-600 text-white border-sky-600"
                : "bg-white text-slate-500 border-slate-200 hover:border-sky-300",
            ].join(" ")}
          >
            {s}
          </button>
        );
      })}

      {/* Clear — only shown when any filter active */}
      {(!noStateFilter || !noStatusFilter) && (
        <button
          onClick={() => {
            activeStates.forEach((s) => onToggleState(s));
            activeStatuses.forEach((s) => onToggleStatus(s));
          }}
          className="text-[10px] text-red-400 hover:text-red-600 ml-1"
        >
          清除
        </button>
      )}
    </div>
  );
}

// ─── Value group card ──────────────────────────────────────────────────────────

interface ValueGroupCardProps {
  group: ParameterValueGroup;
  selectedRecordId: string | null;
  onRecordSelect: (recordId: string) => void;
  filterStates: FilterState;
  filterStatuses: FilterStatus;
}

function ValueGroupCard({
  group,
  selectedRecordId,
  onRecordSelect,
  filterStates,
  filterStatuses,
}: ValueGroupCardProps) {
  const [expanded, setExpanded] = useState(true);

  const visibleRecords = group.records.filter((r) => {
    if (filterStates.size > 0 && !filterStates.has(r.confirmation_state)) return false;
    if (filterStatuses.size > 0 && !filterStatuses.has(r.experiment_status)) return false;
    return true;
  });

  if (visibleRecords.length === 0) return null;

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      {/* Group header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-baseline gap-2">
          {group.numeric_value !== null ? (
            <span className="text-base font-bold text-slate-800 leading-tight">
              {group.numeric_value}
              <span className="text-sm font-normal text-slate-500 ml-0.5">{group.unit}</span>
            </span>
          ) : (
            <span className="text-base font-bold text-slate-800 leading-tight">{group.raw_value}</span>
          )}
          <span className="text-[11px] text-slate-400">{visibleRecords.length} 条实验</span>
        </div>
        <span className="text-slate-400 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Record list */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-slate-100">
          <div className="pt-2 space-y-1.5">
            {visibleRecords.map((rec) => (
              <RecordCard
                key={rec.record_id}
                record={rec}
                isSelected={rec.record_id === selectedRecordId}
                onClick={onRecordSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Public component ──────────────────────────────────────────────────────────

interface ParameterValuePanelProps {
  dimension: ParameterDimension | null;
  selectedRecordId: string | null;
  onRecordSelect: (recordId: string) => void;
}

export function ParameterValuePanel({
  dimension,
  selectedRecordId,
  onRecordSelect,
}: ParameterValuePanelProps) {
  const [filterStates, setFilterStates] = useState<FilterState>(new Set());
  const [filterStatuses, setFilterStatuses] = useState<FilterStatus>(new Set());

  function toggleState(s: ConfirmationState) {
    setFilterStates((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  function toggleStatus(s: string) {
    setFilterStatuses((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  if (!dimension) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
          <h2 className="text-sm font-semibold text-slate-700">参数值分组</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400 text-center px-6">
            从左侧选择一个参数维度查看取值分布
          </p>
        </div>
      </div>
    );
  }

  // Collect unique statuses across all records for this dimension
  const allStatuses = [...new Set(
    dimension.value_groups.flatMap((g) => g.records.map((r) => r.experiment_status))
  )].sort();

  const sourceLabel = dimension.source === "operation" ? "Operation" : "Preparation";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">
              {dimension.key}
              <span className="text-slate-400 font-normal ml-1.5">({dimension.source_context})</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {sourceLabel} · {dimension.value_groups.length} 个取值 · {dimension.record_count} 条记录
            </p>
          </div>
        </div>
        {/* Filter bar */}
        <div className="mt-2">
          <FilterBar
            allStatuses={allStatuses}
            activeStates={filterStates}
            activeStatuses={filterStatuses}
            onToggleState={toggleState}
            onToggleStatus={toggleStatus}
          />
        </div>
      </div>

      {/* Value groups */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {dimension.value_groups.map((group) => (
          <ValueGroupCard
            key={group.raw_value}
            group={group}
            selectedRecordId={selectedRecordId}
            onRecordSelect={onRecordSelect}
            filterStates={filterStates}
            filterStatuses={filterStatuses}
          />
        ))}
      </div>
    </div>
  );
}
