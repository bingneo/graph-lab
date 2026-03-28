import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type NodeTypes,
  type EdgeTypes,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type Edge,
  type EdgeMarker,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { MechanismChainGraph, MechanismBlock } from "@/api/types";
import { buildChainLayout } from "@/utils/mechanismChainLayout";
import {
  buildBlockTagSummary,
  inferDominantResultSignal,
} from "@/utils/blockTagSummary";
import ProjectChainNode from "./nodes/ProjectChainNode";
import MechanismBlockNode from "./nodes/MechanismBlockNode";
import { MainTransitionEdge } from "./edges/MainTransitionEdge";
import { CompareTransitionEdge } from "./edges/CompareTransitionEdge";

// ─── Node / Edge type registrations ────────────────────────────────────────────

const NODE_TYPES: NodeTypes = {
  projectChainNode: ProjectChainNode,
  mechanismBlockNode: MechanismBlockNode,
};

const EDGE_TYPES: EdgeTypes = {
  mainTransitionEdge: MainTransitionEdge,
  compareTransitionEdge: CompareTransitionEdge,
};

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MechanismGraphCanvasProps {
  graph: MechanismChainGraph;
  /** Whether compare mode is currently active (changes cursor and node dimming). */
  isCompareMode: boolean;
  /** The two block IDs selected for comparison (null if not yet chosen). */
  compareSelection: [string | null, string | null];
  /** Called when a MechanismBlockNode is clicked. */
  onBlockClick: (blockId: string) => void;
  /** Called when any edge is clicked. Provides edge id, source and target node IDs. */
  onEdgeClick: (edgeId: string, sourceId: string, targetId: string) => void;
  /**
   * Set of block IDs that match the current filters.
   * null = no active filters (all nodes are "hit").
   */
  hitBlockIds: Set<string> | null;
  /**
   * Set of edge IDs that match the current filters.
   * null = no active filters (all edges are "hit").
   */
  hitEdgeIds: Set<string> | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MechanismGraphCanvas({
  graph,
  isCompareMode,
  compareSelection,
  onBlockClick,
  onEdgeClick,
  hitBlockIds,
  hitEdgeIds,
}: MechanismGraphCanvasProps) {
  // Build the base layout from the API graph (memoised on graph reference only)
  const { nodes: baseNodes, edges: baseEdges } = useMemo(
    () => buildChainLayout(graph),
    [graph],
  );

  // Pre-compute tag summaries once per graph (keyed by block id).
  // These are stable as long as the graph reference doesn't change.
  const tagSummaryMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildBlockTagSummary>>();
    for (const block of graph.blocks) {
      map.set(block.id, buildBlockTagSummary(block));
    }
    return map;
  }, [graph]);

  // Inject compare-mode, filter-hit, and tag summary metadata into block node data
  const nodes = useMemo(() => {
    const [selA, selB] = compareSelection;
    return baseNodes.map((n) => {
      const compareState =
        n.id === selA ? "first" : n.id === selB ? "second" : null;
      const isFilterHit = hitBlockIds === null || hitBlockIds.has(n.id);

      // Tag enrichment (only for block nodes — project node has no experiment_snapshots)
      const tagSummary = tagSummaryMap.get(n.id) ?? null;
      const block = tagSummary
        ? graph.blocks.find((b) => b.id === n.id)
        : null;
      const dominantSignal =
        tagSummary && block
          ? inferDominantResultSignal(tagSummary, (block as MechanismBlock).record_count)
          : null;

      return {
        ...n,
        data: {
          ...(n.data as Record<string, unknown>),
          _isCompareMode: isCompareMode,
          _compareState: compareState,
          _isFilterHit: isFilterHit,
          _hasActiveFilter: hitBlockIds !== null,
          _tagSummary: tagSummary,
          _dominantSignal: dominantSignal,
        },
      };
    });
  }, [baseNodes, isCompareMode, compareSelection, hitBlockIds, tagSummaryMap, graph.blocks]);

  // Apply filter dimming to edges
  const dimmableEdges = useMemo((): Edge[] => {
    return baseEdges.map((e) => {
      const isHit = hitEdgeIds === null || hitEdgeIds.has(e.id);
      const originalMarker = e.markerEnd as EdgeMarker | string | undefined;
      const dimmedMarker: EdgeMarker | string | undefined =
        typeof originalMarker === "object"
          ? { ...originalMarker, color: "#CBD5E1" }
          : originalMarker;

      return {
        ...e,
        data: {
          ...(e.data as Record<string, unknown>),
          _isFilterHit: isHit,
          _hasActiveFilter: hitEdgeIds !== null,
        },
        style: {
          ...e.style,
          opacity: !isHit ? 0.12 : 1,
          transition: "opacity 0.2s ease",
        },
        markerEnd: isHit ? e.markerEnd : dimmedMarker,
      };
    });
  }, [baseEdges, hitEdgeIds]);

  // Generate a temporary compare edge when two blocks are selected
  const compareEdge = useMemo<Edge | null>(() => {
    const [a, b] = compareSelection;
    if (!a || !b) return null;
    return {
      id: `compare:${a}:${b}`,
      source: a,
      target: b,
      type: "compareTransitionEdge",
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 12,
        height: 12,
        color: "#8B5CF6",
      },
      data: { edgeType: "compare_transition" },
    };
  }, [compareSelection]);

  // Final edge list: dimmable main edges + optional compare edge
  // Compare edge is never dimmed — it always stays crisp
  const edges = useMemo(
    () => (compareEdge ? [...dimmableEdges, compareEdge] : dimmableEdges),
    [dimmableEdges, compareEdge],
  );

  // ── Event handlers ──────────────────────────────────────────────────────────

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === "mechanismBlockNode") {
        onBlockClick(node.id);
      }
    },
    [onBlockClick],
  );

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      onEdgeClick(edge.id, edge.source, edge.target);
    },
    [onEdgeClick],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
      fitView
      fitViewOptions={{ padding: 0.35, maxZoom: 1.1 }}
      minZoom={0.2}
      maxZoom={2.5}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      panOnDrag
      zoomOnScroll
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={28} size={1} color="#E2E8F0" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
