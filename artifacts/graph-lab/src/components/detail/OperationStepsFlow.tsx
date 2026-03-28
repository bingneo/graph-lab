import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  type NodeTypes,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { OperationStepsGraph } from "@/api/types";
import OperationStepNodeCard from "./OperationStepNodeCard";

const NODE_TYPES: NodeTypes = {
  stepNode: OperationStepNodeCard,
};

const NODE_W = 200;
const NODE_GAP_X = 70;
const ORIGIN_X = 40;
const ORIGIN_Y = 40;

interface OperationStepsFlowProps {
  graph: OperationStepsGraph;
}

export function OperationStepsFlow({ graph }: OperationStepsFlowProps) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = graph.nodes.map((n, i) => ({
      id: n.id,
      type: "stepNode",
      position: {
        x: ORIGIN_X + i * (NODE_W + NODE_GAP_X),
        y: ORIGIN_Y,
      },
      data: n as unknown as Record<string, unknown>,
    }));

    const edges: Edge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      animated: false,
      style: { stroke: "#6366f1", strokeWidth: 1.5 },
      markerEnd: { type: "arrowclosed" as const, color: "#6366f1" },
    }));

    return { nodes, edges };
  }, [graph]);

  if (graph.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-slate-400 italic">暂无操作步骤</p>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.35 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={true}
      zoomOnScroll={false}
      preventScrolling={false}
      minZoom={0.4}
      maxZoom={1.5}
    >
      <Background gap={20} color="#e0e7ff" />
    </ReactFlow>
  );
}
