import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type NodeTypes,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { MechanismSnapshotGraph, ConfirmationState, ModuleKey } from "@/api/types";
import { computeSnapshotLayout } from "@/utils/graphLayout";
import { WarningBanner } from "@/components/shared/WarningBanner";
import { PanelLoadingState } from "@/components/shared/PanelLoadingState";
import ModuleNodeCard from "./ModuleNodeCard";

const NODE_TYPES: NodeTypes = {
  moduleNode: ModuleNodeCard,
};

const CONFIRMATION_STATE_LABELS: Record<ConfirmationState, { label: string; color: string }> = {
  confirmed: { label: "Confirmed", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  draft: { label: "Draft", color: "text-slate-500 bg-slate-50 border-slate-200" },
  confirmed_dirty: { label: "Confirmed (Dirty)", color: "text-amber-600 bg-amber-50 border-amber-200" },
};

interface SnapshotFlowProps {
  graph: MechanismSnapshotGraph | null;
  isLoading: boolean;
  error: string | null;
  selectedModuleKey: ModuleKey | null;
  onModuleClick: (recordId: string, moduleKey: ModuleKey) => void;
}

export function SnapshotFlow({
  graph,
  isLoading,
  error,
  selectedModuleKey,
  onModuleClick,
}: SnapshotFlowProps) {
  const { nodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };
    return computeSnapshotLayout(graph.nodes, graph.edges);
  }, [graph]);

  // Mark the selected node so ModuleNodeCard can apply the ring style
  const nodesWithSelection = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: selectedModuleKey
          ? n.id.endsWith(`__${selectedModuleKey}`)
          : false,
      })),
    [nodes, selectedModuleKey]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Node ID format: "<record_id>__<module_key>"
      const parts = node.id.split("__");
      if (parts.length < 2) return;
      const moduleKey = parts[parts.length - 1] as ModuleKey;
      const recordId = parts.slice(0, parts.length - 1).join("__");
      onModuleClick(recordId, moduleKey);
    },
    [onModuleClick]
  );

  const hasContent = nodes.length > 0;
  const showOverlay = isLoading || !!error || !hasContent;

  const stateLabel = graph
    ? (CONFIRMATION_STATE_LABELS[graph.confirmation_state] ?? CONFIRMATION_STATE_LABELS.draft)
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700">Mechanism Snapshot</h2>
          {graph && stateLabel && (
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${stateLabel.color}`}>
                {stateLabel.label}
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                {graph.modules_source === "confirmed_modules"
                  ? "confirmed snapshot"
                  : "live modules"}
              </span>
            </div>
          )}
        </div>
        {graph && (
          <p className="text-xs text-slate-500 mt-1 font-mono truncate">
            {graph.experiment_code}
          </p>
        )}
      </div>

      {graph && graph.warnings.length > 0 && (
        <div className="px-4 py-2 border-b border-amber-100 bg-white shrink-0">
          <WarningBanner warnings={graph.warnings} />
        </div>
      )}

      <div className="flex-1 relative bg-slate-50">
        {showOverlay ? (
          <PanelLoadingState
            isLoading={isLoading}
            error={error}
            isEmpty={!hasContent && !isLoading && !error}
            emptyMessage="Click a record in the lineage graph to view its mechanism snapshot."
          />
        ) : (
          <ReactFlow
            nodes={nodesWithSelection}
            edges={edges}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.4 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            panOnDrag={true}
            zoomOnScroll={true}
            minZoom={0.3}
            maxZoom={2}
            onNodeClick={handleNodeClick}
          >
            <Background gap={20} color="#e2e8f0" />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </div>

      {graph && (
        <div className="px-4 py-1.5 border-t border-slate-200 bg-white shrink-0">
          <p className="text-[10px] text-slate-400 font-mono truncate">
            record: {graph.record_id} · {new Date(graph.generated_at).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}
