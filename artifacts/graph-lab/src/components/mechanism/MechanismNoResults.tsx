/**
 * MechanismNoResults
 *
 * Overlay banner shown inside the canvas when the current filter state
 * produces zero matching blocks. Floats above the graph without disrupting layout.
 */

interface MechanismNoResultsProps {
  onClear: () => void;
}

export function MechanismNoResults({ onClear }: MechanismNoResultsProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      <div
        className="pointer-events-auto flex flex-col items-center gap-3 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-xl px-8 py-6 max-w-xs text-center"
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl text-slate-300 border border-slate-100">
          ⊘
        </div>

        {/* Copy */}
        <div>
          <p className="text-sm font-semibold text-slate-700">当前筛选条件下没有命中阶段</p>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            尝试放宽筛选条件，或清空全部筛选后查看完整主链。
          </p>
        </div>

        {/* Clear action */}
        <button
          onClick={onClear}
          className="text-xs font-semibold px-4 py-1.5 rounded-full border bg-white text-slate-600 border-slate-300 hover:bg-slate-50 transition-colors shadow-sm"
        >
          ✕ 清空筛选
        </button>
      </div>
    </div>
  );
}
