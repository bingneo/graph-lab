import { BaseEdge, getBezierPath, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";

/**
 * MainTransitionEdge
 *
 * Renders the solid arrow between chain nodes (project → block, block → block).
 * Click events are handled at the canvas level via ReactFlow's onEdgeClick prop.
 * A wider invisible stroke is added as a hit-area to make edges easier to click.
 */
export function MainTransitionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* Wider invisible hit-area for easier clicking */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: "pointer" }}
      />

      {/* Visual edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? "#7C3AED" : "#94A3B8",
          strokeWidth: selected ? 2.5 : 2,
          transition: "stroke 0.15s ease, stroke-width 0.15s ease",
        }}
      />

      {/* Label shown when selected */}
      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
            }}
          >
            <div className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-600 text-white shadow border border-violet-700">
              查看差异
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
