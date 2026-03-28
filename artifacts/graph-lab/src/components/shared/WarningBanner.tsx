interface WarningBannerProps {
  warnings: string[];
}

export function WarningBanner({ warnings }: WarningBannerProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
      <div className="flex items-start gap-2">
        <span className="text-amber-500 text-sm leading-none mt-0.5">⚠</span>
        <ul className="space-y-0.5 flex-1">
          {warnings.map((w, i) => (
            <li key={i} className="text-xs text-amber-700 leading-relaxed">
              {w}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
