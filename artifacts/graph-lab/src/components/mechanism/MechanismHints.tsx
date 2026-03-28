/**
 * MechanismHints
 *
 * A single-line floating hint bar at the bottom of the canvas area.
 * Ultra-compact — just enough to help first-time users understand how to read the graph.
 * Hidden in compare mode (compare mode has its own status prompt).
 */

interface MechanismHintsProps {
  isCompareMode: boolean;
}

const HINTS = [
  "先看主链推进方向",
  "点击节点查看阶段详情",
  "点击实线查看相邻阶段差异",
  "开启「对比分析」可横向比较任意两个阶段",
] as const;

export function MechanismHints({ isCompareMode }: MechanismHintsProps) {
  if (isCompareMode) return null;

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div className="flex items-center gap-0 bg-white/80 backdrop-blur-sm border border-slate-100 rounded-full shadow-sm px-4 py-1.5">
        {HINTS.map((hint, i) => (
          <span key={hint} className="flex items-center gap-2">
            {i > 0 && <span className="text-slate-200 text-xs mx-1.5">·</span>}
            <span className="text-[11px] text-slate-400 whitespace-nowrap">{hint}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
