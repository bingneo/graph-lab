/**
 * mechanismChainLayout.ts
 *
 * Converts a MechanismChainGraph (API response) into React Flow nodes and edges.
 * This is a pure function — no side effects, no React state.
 *
 * Node types registered in MechanismGraphCanvas:
 *   "projectChainNode"    → ProjectChainNode
 *   "mechanismBlockNode"  → MechanismBlockNode
 *
 * Edge types registered in MechanismGraphCanvas:
 *   "mainTransitionEdge"    → MainTransitionEdge (solid)
 *   "compareTransitionEdge" → reserved V2+ (dashed)
 */

import { MarkerType, type Node, type Edge } from "@xyflow/react";
import type { MechanismChainGraph } from "@/api/types";

// ─── Layout constants ──────────────────────────────────────────────────────────

export const CHAIN_LAYOUT = {
  PROJECT_WIDTH: 200,
  PROJECT_HEIGHT: 112,
  BLOCK_WIDTH: 252,
  BLOCK_HEIGHT: 210,
  HORIZONTAL_GAP: 100,
  /** Vertical pixel position of the center line for all nodes. */
  CHAIN_Y_CENTER: 150,
} as const;

// ─── Result type ───────────────────────────────────────────────────────────────

export interface ChainLayoutResult {
  nodes: Node[];
  edges: Edge[];
}

// ─── Main adapter ─────────────────────────────────────────────────────────────

export function buildChainLayout(graph: MechanismChainGraph): ChainLayoutResult {
  const {
    PROJECT_WIDTH,
    PROJECT_HEIGHT,
    BLOCK_WIDTH,
    BLOCK_HEIGHT,
    HORIZONTAL_GAP,
    CHAIN_Y_CENTER,
  } = CHAIN_LAYOUT;

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // ── Project node ────────────────────────────────────────────────────────────

  nodes.push({
    id: graph.project_node.id,
    type: "projectChainNode",
    position: {
      x: 0,
      y: CHAIN_Y_CENTER - PROJECT_HEIGHT / 2,
    },
    data: graph.project_node as unknown as Record<string, unknown>,
    width: PROJECT_WIDTH,
    height: PROJECT_HEIGHT,
    draggable: false,
    connectable: false,
    selectable: false,
  });

  // ── Block nodes ─────────────────────────────────────────────────────────────

  let x = PROJECT_WIDTH + HORIZONTAL_GAP;

  for (const block of graph.blocks) {
    nodes.push({
      id: block.id,
      type: "mechanismBlockNode",
      position: {
        x,
        y: CHAIN_Y_CENTER - BLOCK_HEIGHT / 2,
      },
      data: block as unknown as Record<string, unknown>,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      draggable: false,
      connectable: false,
    });
    x += BLOCK_WIDTH + HORIZONTAL_GAP;
  }

  // ── Edges ───────────────────────────────────────────────────────────────────

  for (const chainEdge of graph.edges) {
    const isMain = chainEdge.edge_type === "main_transition";
    const edgeColor = isMain ? "#94A3B8" : "#C4B5FD";

    edges.push({
      id: chainEdge.id,
      source: chainEdge.source,
      target: chainEdge.target,
      type: isMain ? "mainTransitionEdge" : "compareTransitionEdge",
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: edgeColor,
      },
      data: {
        edgeType: chainEdge.edge_type,
        compareContext: chainEdge.compare_context ?? null,
      },
    });
  }

  return { nodes, edges };
}
