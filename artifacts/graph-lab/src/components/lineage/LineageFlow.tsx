import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { LineageGraph, LineageNode } from "@/api/types";
import { computeLineageLayout } from "@/utils/graphLayout";
import { GraphStats } from "@/components/shared/GraphStats";
import { PanelLoadingState } from "@/components/shared/PanelLoadingState";
import LineageNodeCard from "./LineageNodeCard";

const NODE_TYPES: NodeTypes = {
  lineageNode: LineageNodeCard,
};

interface LineageFlowProps {
  graph: LineageGraph | null;
  isLoading: boolean;
  error: string | null;
  selectedRecordId: string | null;
  onNodeClick: (recordId: string) => void;
}

export function LineageFlow({
  graph,
  isLoading,
  error,
  selectedRecordId,
  onNodeClick,
}: LineageFlowProps) {
  const { nodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };
    const layout = computeLineageLayout(graph.nodes, graph.edges);
    return {
      nodes: layout.nodes.map((n) => ({
        ...n,
        selected: n.id === selectedRecordId,
      })),
      edges: layout.edges,
    };
  }, [graph, selectedRecordId]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const lineageNode = node.data as unknown as LineageNode;
      onNodeClick(lineageNode.id);
    },
    [onNodeClick]
  );

  const hasContent = nodes.length > 0;
  const showOverlay = isLoading || !!error || !hasContent;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
        <h2 className="text-sm font-semibold text-slate-700">Lineage Graph</h2>
        {graph && <GraphStats stats={graph.stats} />}
      </div>

      <div className="flex-1 relative bg-slate-50">
        {showOverlay ? (
          <PanelLoadingState
            isLoading={isLoading}
            error={error}
            isEmpty={!hasContent && !isLoading && !error}
            emptyMessage="No records found for this sci_note_id."
          />
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            panOnDrag={true}
            zoomOnScroll={true}
            minZoom={0.3}
            maxZoom={2}
          >
            <Background gap={20} color="#e2e8f0" />
            <Controls showInteractive={false} />
            <MiniMap
              nodeStrokeWidth={2}
              nodeColor={(n) => {
                const state = (n.data as unknown as LineageNode).confirmation_state;
                if (state === "confirmed") return "#34d399";
                if (state === "confirmed_dirty") return "#fbbf24";
                return "#94a3b8";
              }}
              maskColor="rgba(241,245,249,0.7)"
            />
          </ReactFlow>
        )}
      </div>

      {graph && (
        <div className="px-4 py-1.5 border-t border-slate-200 bg-white shrink-0">
          <p className="text-[10px] text-slate-400 font-mono">
            sci_note_id: {graph.sci_note_id} · generated {new Date(graph.generated_at).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}
