/**
 * operationTransform.ts
 *
 * Pure client-side transform: OperationModuleDetail → OperationStepsGraph.
 * No API calls, no side effects. Safe to call multiple times with the same input.
 *
 * Defensive sort contract:
 *   - Missing order (undefined/null) → treated as Infinity, appended after valid steps
 *   - NaN order → treated as Infinity
 *   - Duplicate order values → stable secondary sort by original array index
 *   - Empty name → fallback to "Step <n>"
 */

import type {
  OperationModuleDetail,
  OperationStepsGraph,
  OperationStepNode,
  OperationStepEdge,
} from "@/api/types";

function safeOrder(order: unknown, fallback: number): number {
  if (typeof order !== "number" || !isFinite(order)) return fallback;
  return order;
}

export function buildOperationStepsGraph(
  recordId: string,
  experimentCode: string,
  detail: OperationModuleDetail
): OperationStepsGraph {
  // Defensive sort: stable, handles missing/NaN/duplicate order values.
  // Append-by-index for any step that lacks a valid order.
  const LARGE = 1e9;
  const indexed = detail.steps.map((step, idx) => ({
    step,
    sortKey: safeOrder(step.order, LARGE + idx),
    idx,
  }));
  indexed.sort((a, b) =>
    a.sortKey !== b.sortKey ? a.sortKey - b.sortKey : a.idx - b.idx
  );

  const nodes: OperationStepNode[] = indexed.map(({ step, idx }) => ({
    id: `${recordId}__operation__${step.id}`,
    step_id: step.id,
    name: step.name?.trim() || `Step ${idx + 1}`,
    order: safeOrder(step.order, idx + 1),
    params: step.params,
  }));

  // Edges only exist between 2+ nodes
  const edges: OperationStepEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `${nodes[i].id}__seq__${nodes[i + 1].id}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      edge_type: "step_sequence",
    });
  }

  return {
    type: "operation_steps",
    record_id: recordId,
    experiment_code: experimentCode,
    title: detail.title,
    nodes,
    edges,
  };
}
