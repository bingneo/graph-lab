import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";

/**
 * CompareTransitionEdge
 *
 * Renders the dashed purple arc between any two compared block nodes.
 * Unlike the main transition edge, this is a user-initiated "compare" edge —
 * it arcs ABOVE the chain to stay visually separate from the main flow.
 *
 * The arc height scales with horizontal distance so that adjacent-block compares
 * still look distinct from the solid main-transition edges below them.
 */
export function CompareTransitionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  selected,
}: EdgeProps) {
  // Arc above the chain: control points shifted upward proportional to distance.
  const dx = Math.abs(targetX - sourceX);
  const arcHeight = Math.min(Math.max(dx * 0.35, 70), 200);

  const midX = (sourceX + targetX) / 2;
  const midY = Math.min(sourceY, targetY) - arcHeight;

  // Cubic bezier via midpoint control
  const c1x = sourceX + (midX - sourceX) * 0.5;
  const c1y = midY;
  const c2x = targetX - (targetX - midX) * 0.5;
  const c2y = midY;

  const edgePath = `M ${sourceX} ${sourceY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${targetX} ${targetY}`;
  const labelX = midX;
  const labelY = midY - 4;

  const strokeColor = selected ? "#6D28D9" : "#8B5CF6";
  const strokeWidth = selected ? 2.5 : 2;

  return (
    <>
      {/* Wider invisible hit-area for easier clicking */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        style={{ cursor: "pointer" }}
      />

      {/* Visual dashed arc */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: "7 4",
          transition: "stroke 0.15s ease, stroke-width 0.15s ease",
        }}
      />

      {/* Floating label at arc apex */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <div
            className={[
              "text-[10px] font-semibold px-2.5 py-1 rounded-full border cursor-pointer transition-all",
              selected
                ? "bg-violet-600 text-white border-violet-700 shadow-md"
                : "bg-white text-violet-600 border-violet-300 shadow-sm hover:bg-violet-50",
            ].join(" ")}
          >
            查看差异
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
