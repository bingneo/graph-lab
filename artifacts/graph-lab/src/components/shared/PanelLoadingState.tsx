interface PanelLoadingStateProps {
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  isEmpty?: boolean;
}

export function PanelLoadingState({
  isLoading,
  error,
  emptyMessage,
  isEmpty,
}: PanelLoadingStateProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400 gap-2">
        <span className="animate-spin text-base">⟳</span>
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <span className="text-2xl">✗</span>
        <p className="text-sm font-medium text-red-600">Error</p>
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">{error}</p>
      </div>
    );
  }

  if (isEmpty && emptyMessage) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400 px-6 text-center">
        {emptyMessage}
      </div>
    );
  }

  return null;
}
