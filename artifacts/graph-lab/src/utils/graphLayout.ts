import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type {
  LineageNode,
  LineageEdge,
  ModuleNode,
  ModuleEdge,
} from "@/api/types";

const LINEAGE_NODE_WIDTH = 220;
const LINEAGE_NODE_HEIGHT = 100;

const MODULE_NODE_WIDTH = 180;
const MODULE_NODE_HEIGHT = 110;
const MODULE_CHAIN_GAP_X = 60;
const MODULE_CHAIN_GAP_Y = 70;

export function computeLineageLayout(
  lineageNodes: LineageNode[],
  lineageEdges: LineageEdge[]
): { nodes: Node[]; edges: Edge[] } {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    nodesep: 60,
    ranksep: 70,
    marginx: 20,
    marginy: 20,
  });

  lineageNodes.forEach((n) => {
    graph.setNode(n.id, { width: LINEAGE_NODE_WIDTH, height: LINEAGE_NODE_HEIGHT });
  });

  lineageEdges.forEach((e) => {
    graph.setEdge(e.source, e.target);
  });

  dagre.layout(graph);

  const nodes: Node[] = lineageNodes.map((n) => {
    const pos = graph.node(n.id);
    return {
      id: n.id,
      type: "lineageNode",
      position: {
        x: pos.x - LINEAGE_NODE_WIDTH / 2,
        y: pos.y - LINEAGE_NODE_HEIGHT / 2,
      },
      data: n as unknown as Record<string, unknown>,
    };
  });

  const edges: Edge[] = lineageEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    animated: false,
    markerEnd: { type: "arrowclosed" as const },
    data: e as unknown as Record<string, unknown>,
  }));

  return { nodes, edges };
}

export function computeSnapshotLayout(
  moduleNodes: ModuleNode[],
  moduleEdges: ModuleEdge[]
): { nodes: Node[]; edges: Edge[] } {
  const MODULE_ORDER: string[] = [
    "system",
    "preparation",
    "operation",
    "measurement",
    "data",
  ];

  const sorted = [...moduleNodes].sort(
    (a, b) =>
      MODULE_ORDER.indexOf(a.module_key) - MODULE_ORDER.indexOf(b.module_key)
  );

  const chainNodes = sorted.filter((n) => !n.is_outcome_node);
  const outcomeNodes = sorted.filter((n) => n.is_outcome_node);

  const chainStartX = 60;
  const chainY = 60;
  const outcomeOffsetY = MODULE_NODE_HEIGHT + MODULE_CHAIN_GAP_Y;

  const nodePositions = new Map<string, { x: number; y: number }>();

  chainNodes.forEach((n, i) => {
    nodePositions.set(n.id, {
      x: chainStartX + i * (MODULE_NODE_WIDTH + MODULE_CHAIN_GAP_X),
      y: chainY,
    });
  });

  outcomeNodes.forEach((n) => {
    const lastChainNode = chainNodes[chainNodes.length - 1];
    const lastPos = lastChainNode
      ? nodePositions.get(lastChainNode.id)!
      : { x: chainStartX, y: chainY };
    nodePositions.set(n.id, {
      x: lastPos.x,
      y: chainY + outcomeOffsetY,
    });
  });

  const nodes: Node[] = sorted.map((n) => {
    const pos = nodePositions.get(n.id) ?? { x: 0, y: 0 };
    return {
      id: n.id,
      type: "moduleNode",
      position: pos,
      data: n as unknown as Record<string, unknown>,
    };
  });

  const edges: Edge[] = moduleEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    animated: e.edge_type === "outcome",
    style:
      e.edge_type === "outcome"
        ? { stroke: "#6b7280", strokeDasharray: "5,4" }
        : { stroke: "#3b82f6" },
    markerEnd: { type: "arrowclosed" as const },
    data: e as unknown as Record<string, unknown>,
  }));

  return { nodes, edges };
}
