import type { LineageStats } from "@/api/types";

interface GraphStatsProps {
  stats: LineageStats;
}

export function GraphStats({ stats }: GraphStatsProps) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <StatItem label="Total" value={stats.total_records} />
      <Divider />
      <StatItem label="Root" value={stats.root_count} />
      <Divider />
      <StatItem label="Derived" value={stats.derived_count} />
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-semibold text-slate-800">{value}</span>
      <span className="text-slate-400 text-xs">{label}</span>
    </span>
  );
}

function Divider() {
  return <span className="text-slate-200 select-none">|</span>;
}
