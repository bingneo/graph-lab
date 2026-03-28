import type { RecordSummary, ConfirmationState } from "@/api/types";

// ─── Status badges ─────────────────────────────────────────────────────────────

const CONFIRMATION_BADGE: Record<ConfirmationState, { label: string; cls: string }> = {
  draft:            { label: "draft",            cls: "bg-slate-100 text-slate-500 border-slate-200" },
  confirmed:        { label: "confirmed",        cls: "bg-blue-50  text-blue-600  border-blue-200"  },
  confirmed_dirty:  { label: "confirmed_dirty",  cls: "bg-amber-50 text-amber-600 border-amber-200" },
};

function StatusBadge({ state }: { state: ConfirmationState }) {
  const b = CONFIRMATION_BADGE[state];
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border leading-none ${b.cls}`}>
      {b.label}
    </span>
  );
}

function ExperimentStatusChip({ status }: { status: string }) {
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-sky-50 text-sky-600 border-sky-200 leading-none">
      {status}
    </span>
  );
}

// ─── Public component ──────────────────────────────────────────────────────────

interface RecordCardProps {
  record: RecordSummary;
  isSelected: boolean;
  onClick: (recordId: string) => void;
}

export function RecordCard({ record, isSelected, onClick }: RecordCardProps) {
  const hasTitle = record.title && record.title !== "未命名实验";

  return (
    <button
      type="button"
      onClick={() => onClick(record.record_id)}
      className={[
        "w-full text-left px-3 py-2 rounded-md border transition-all duration-100",
        isSelected
          ? "border-violet-400 bg-violet-50 ring-1 ring-violet-300"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-[12px] font-semibold text-slate-700 shrink-0">
            {record.experiment_code}
          </span>
          {hasTitle && (
            <span className="text-[11px] text-slate-400 truncate">{record.title}</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap shrink-0">
          <ExperimentStatusChip status={record.experiment_status} />
          <StatusBadge state={record.confirmation_state} />
          {record.tags.map((tag, i) => (
            <span
              key={i}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-violet-50 text-violet-600 border-violet-200 leading-none"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
