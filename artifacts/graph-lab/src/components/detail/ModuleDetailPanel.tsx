import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OperationStepsFlow } from "./OperationStepsFlow";
import { buildOperationStepsGraph } from "@/utils/operationTransform";
import type {
  ModuleDetail,
  ModuleDetailData,
  ModuleKey,
  PrepItem,
  OperationStep,
  MeasurementItem,
  SystemObject,
  DataItem,
  ItemAttribute,
  OperationModuleDetail,
} from "@/api/types";

// ─── Module meta ───────────────────────────────────────────────────────────────

const MODULE_META: Record<
  ModuleKey,
  { icon: string; accent: string; bg: string; border: string; badgeCls: string }
> = {
  system: {
    icon: "⚙️",
    accent: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-200",
    badgeCls: "bg-violet-100 text-violet-700 border-violet-200",
  },
  preparation: {
    icon: "🧪",
    accent: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-200",
    badgeCls: "bg-sky-100 text-sky-700 border-sky-200",
  },
  operation: {
    icon: "🔬",
    accent: "text-indigo-700",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    badgeCls: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  measurement: {
    icon: "📏",
    accent: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
    badgeCls: "bg-teal-100 text-teal-700 border-teal-200",
  },
  data: {
    icon: "📊",
    accent: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    badgeCls: "bg-orange-100 text-orange-700 border-orange-200",
  },
};

// ─── Shared atoms ──────────────────────────────────────────────────────────────

function AttrChip({ attr }: { attr: ItemAttribute }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] border rounded px-1.5 py-0.5 bg-white border-slate-200 text-slate-600">
      <span className="text-slate-400">{attr.key}</span>
      <span className="text-slate-300">·</span>
      <span className="font-medium text-slate-700">{attr.value}</span>
    </span>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <p className="text-[12px] text-slate-400 italic py-3 text-center">{message}</p>
  );
}

// ─── Module-specific renderers (list mode) ────────────────────────────────────

function SystemContent({ objects }: { objects: SystemObject[] }) {
  if (objects.length === 0) return <EmptyHint message="暂无实验系统对象" />;
  return (
    <ul className="space-y-1.5">
      {objects.map((obj) => (
        <li key={obj.id} className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-700">
          <span className="text-base">⚙️</span>
          <span>{obj.name}</span>
        </li>
      ))}
    </ul>
  );
}

function PrepContent({ items }: { items: PrepItem[] }) {
  if (items.length === 0) return <EmptyHint message="暂无准备项" />;
  const groups = new Map<string, PrepItem[]>();
  for (const item of items) {
    const cat = item.category || "未分类";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(item);
  }
  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([cat, catItems]) => (
        <div key={cat}>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">{cat}</p>
          <ul className="space-y-2">
            {catItems.map((item) => (
              <li key={item.id} className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
                <p className="text-sm font-medium text-slate-700 mb-1.5">{item.name}</p>
                {item.attributes.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {item.attributes.map((attr, i) => <AttrChip key={i} attr={attr} />)}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">—</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function OperationContent({ steps }: { steps: OperationStep[] }) {
  if (steps.length === 0) return <EmptyHint message="暂无操作步骤" />;
  return (
    <ol className="space-y-3">
      {steps.map((step, idx) => (
        <li key={step.id} className="flex gap-3">
          <div className="flex-none w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center mt-0.5 shrink-0">
            {idx + 1}
          </div>
          <div className="flex-1 min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-sm font-medium text-slate-700 mb-1.5">{step.name}</p>
            {step.params.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {step.params.map((p, i) => <AttrChip key={i} attr={p} />)}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">—</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function MeasurementContent({ items }: { items: MeasurementItem[] }) {
  if (items.length === 0) return <EmptyHint message="暂无测量项目" />;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-slate-700">{item.name}</span>
              {item.target && (
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded border bg-teal-50 border-teal-200 text-teal-700">
                  {item.target}
                </span>
              )}
            </div>
            {item.conditions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.conditions.map((c, i) => <AttrChip key={i} attr={c} />)}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function DataContent({ items }: { items: DataItem[] }) {
  if (items.length === 0) return <EmptyHint message="暂无实验数据记录" />;
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-700">
          <span className="text-base">📊</span>
          <span>{item.name}</span>
        </li>
      ))}
    </ul>
  );
}

function ModuleListContent({ data }: { data: ModuleDetailData }) {
  switch (data.module_key) {
    case "system":      return <SystemContent objects={data.objects} />;
    case "preparation": return <PrepContent items={data.items} />;
    case "operation":   return <OperationContent steps={data.steps} />;
    case "measurement": return <MeasurementContent items={data.items} />;
    case "data":        return <DataContent items={data.items} />;
  }
}

// ─── Item count ────────────────────────────────────────────────────────────────

function itemCount(data: ModuleDetailData): number {
  switch (data.module_key) {
    case "system":      return data.objects.length;
    case "preparation": return data.items.length;
    case "operation":   return data.steps.length;
    case "measurement": return data.items.length;
    case "data":        return data.items.length;
  }
}

// ─── View mode toggle (operation module only) ─────────────────────────────────

type ViewMode = "list" | "graph";

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}

function ViewToggle({ mode, onChange }: ViewToggleProps) {
  const btn = (label: string, value: ViewMode) => (
    <button
      onClick={() => onChange(value)}
      className={[
        "text-[11px] font-medium px-2 py-0.5 rounded border transition-colors",
        mode === value
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600",
      ].join(" ")}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-1">
      {btn("列表", "list")}
      {btn("图", "graph")}
    </div>
  );
}

// ─── Panel states ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
        <h2 className="text-sm font-semibold text-slate-700">模块详情</h2>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-slate-400 text-center px-6">
          点击 Mechanism Snapshot 中的模块节点查看详情
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
        <h2 className="text-sm font-semibold text-slate-700">模块详情</h2>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-slate-400">加载中…</p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
        <h2 className="text-sm font-semibold text-slate-700">模块详情</h2>
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-sm text-red-500 text-center">{message}</p>
      </div>
    </div>
  );
}

// ─── Public component ──────────────────────────────────────────────────────────

interface ModuleDetailPanelProps {
  detail: ModuleDetail | null;
  isLoading: boolean;
  error: string | null;
}

export function ModuleDetailPanel({ detail, isLoading, error }: ModuleDetailPanelProps) {
  // View mode: "list" by default, "graph" only for operation module.
  // Resets to "list" whenever the selected module changes (detail prop changes).
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    setViewMode("list");
  }, [detail?.record_id, detail?.module_data.module_key]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!detail) return <EmptyState />;

  const data = detail.module_data;
  const meta = MODULE_META[data.module_key];
  const count = itemCount(data);

  const isOperation = data.module_key === "operation";
  const hasSteps = isOperation && (data as OperationModuleDetail).steps.length > 0;
  const showToggle = isOperation && hasSteps;

  // Build the operation steps graph only when needed
  const stepsGraph =
    isOperation && viewMode === "graph"
      ? buildOperationStepsGraph(
          detail.record_id,
          detail.experiment_code,
          data as OperationModuleDetail
        )
      : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`px-4 py-2.5 border-b border-slate-200 shrink-0 ${meta.bg}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base leading-none">{meta.icon}</span>
            <h2 className={`text-sm font-semibold truncate ${meta.accent}`}>
              {data.title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {showToggle && (
              <ViewToggle mode={viewMode} onChange={setViewMode} />
            )}
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${meta.badgeCls}`}>
              {count} 项
            </span>
            <span className="text-[10px] text-slate-400 border border-slate-200 bg-white px-1.5 py-0.5 rounded">
              {detail.data_source === "confirmed_modules" ? "confirmed" : "live"}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
          {detail.experiment_code} · {data.module_key}
        </p>
      </div>

      {/* Content area */}
      {viewMode === "graph" && stepsGraph ? (
        // Graph mode: fill height with React Flow canvas
        <div className="flex-1 relative bg-indigo-50/30">
          <OperationStepsFlow graph={stepsGraph} />
        </div>
      ) : (
        // List mode: scrollable content
        <ScrollArea className="flex-1">
          <div className="p-4">
            <ModuleListContent data={data} />
          </div>
        </ScrollArea>
      )}

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-slate-200 bg-white shrink-0">
        <p className="text-[10px] text-slate-400 font-mono truncate">
          {detail.record_id} · {new Date(detail.generated_at).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
