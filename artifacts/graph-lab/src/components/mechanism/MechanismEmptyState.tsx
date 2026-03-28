/**
 * MechanismEmptyState / MechanismErrorState / MechanismLoadingState
 *
 * Product-grade full-area state screens that replace the generic PanelLoadingState
 * for the mechanism graph context.
 */

// ─── Loading ──────────────────────────────────────────────────────────────────

export function MechanismLoadingState() {
  return (
    <div className="flex-1 min-h-0 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-violet-500 animate-spin" />
      <div className="text-center">
        <p className="text-sm font-medium text-slate-600">正在加载机制主链…</p>
        <p className="text-xs text-slate-400 mt-1">从数据库读取实验记录并构建研发图谱</p>
      </div>
    </div>
  );
}

// ─── Error ────────────────────────────────────────────────────────────────────

interface MechanismErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function MechanismErrorState({ message, onRetry }: MechanismErrorStateProps) {
  return (
    <div className="flex-1 min-h-0 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col items-center justify-center gap-5 px-8">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center">
        <span className="text-2xl text-rose-400">⚠</span>
      </div>

      {/* Copy */}
      <div className="text-center max-w-xs">
        <p className="text-base font-semibold text-slate-800">机制主链加载失败</p>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
          数据请求遇到问题，请检查网络后重试。
        </p>
        {/* Technical hint — muted, collapsed visually */}
        <p className="text-[11px] text-slate-300 mt-2 font-mono bg-slate-50 rounded px-2 py-1 truncate max-w-full">
          {message}
        </p>
      </div>

      {/* Retry */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm font-semibold px-5 py-2 rounded-lg border bg-white text-slate-600 border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
        >
          ↺ 重新加载
        </button>
      )}
    </div>
  );
}

// ─── Empty ────────────────────────────────────────────────────────────────────

export function MechanismEmptyState() {
  return (
    <div className="flex-1 min-h-0 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col items-center justify-center gap-5 px-8">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
        <span className="text-2xl text-slate-300">⬡</span>
      </div>

      {/* Copy */}
      <div className="text-center max-w-xs">
        <p className="text-base font-semibold text-slate-700">尚未形成机制主链</p>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">
          机制主链需要至少 1 条已归档或已确认的实验记录才能构建。
        </p>
        <p className="text-sm text-slate-400 mt-1 leading-relaxed">
          请前往实验记录页面完成记录后再查看。
        </p>
      </div>

      {/* Soft guidance pill */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 border border-slate-100 text-xs text-slate-400">
        <span>💡</span>
        <span>完成实验记录归档后，图谱将自动生成</span>
      </div>
    </div>
  );
}
