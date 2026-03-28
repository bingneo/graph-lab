/**
 * FilterBar
 *
 * Compact horizontal filter toolbar for the Mechanism Graph.
 * Three filter dimensions (tags, block types, statuses) + three focus shortcuts.
 * All selections use chip / pill toggles — no dropdowns, no sidebars.
 *
 * State lives entirely in MechanismGraphPage; this component is pure UI.
 */

import type { BlockType, BlockStatus } from "@/api/types";
import type { FilterState, FocusMode } from "@/utils/filterBlocks";
import {
  AVAILABLE_TAGS,
  AVAILABLE_BLOCK_TYPES,
  AVAILABLE_STATUSES,
  FOCUS_MODES,
  isFilterActive,
} from "@/utils/filterBlocks";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface FilterBarProps {
  filterState: FilterState;
  onChange: (next: FilterState) => void;
  matchedCount: number;
  totalCount: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  activeClass?: string;
}

function Chip({ label, active, onClick, activeClass = "bg-violet-600 text-white border-violet-600" }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={[
        "text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-all select-none whitespace-nowrap",
        active
          ? activeClass
          : "bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toggleInArray<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

// ─── Section label ────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap shrink-0">
      {children}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FilterBar({ filterState, onChange, matchedCount, totalCount }: FilterBarProps) {
  const active = isFilterActive(filterState);

  function setTags(tags: string[]) {
    onChange({ ...filterState, selectedTags: tags, focusMode: null });
  }
  function setTypes(types: BlockType[]) {
    onChange({ ...filterState, selectedBlockTypes: types, focusMode: null });
  }
  function setStatuses(statuses: BlockStatus[]) {
    onChange({ ...filterState, selectedStatuses: statuses, focusMode: null });
  }
  function setFocus(mode: FocusMode) {
    // Toggle off if already active
    onChange({
      ...filterState,
      focusMode: filterState.focusMode === mode ? null : mode,
      // Clear individual filters when focus mode is set
      selectedTags: [],
      selectedBlockTypes: [],
      selectedStatuses: [],
    });
  }
  function clearAll() {
    onChange({
      selectedTags: [],
      selectedBlockTypes: [],
      selectedStatuses: [],
      focusMode: null,
    });
  }

  return (
    <div className="shrink-0 bg-slate-50 border-b border-slate-100 px-4 py-2">
      <div className="flex items-center gap-4 flex-wrap min-h-0">

        {/* ── 聚焦快捷键 ── */}
        <div className="flex items-center gap-1.5">
          <Label>聚焦</Label>
          {FOCUS_MODES.map((fm) => (
            <Chip
              key={fm.value}
              label={`${fm.icon} ${fm.label}`}
              active={filterState.focusMode === fm.value}
              onClick={() => setFocus(fm.value)}
              activeClass={
                fm.value === "failed"
                  ? "bg-rose-500 text-white border-rose-500"
                  : fm.value === "validated"
                    ? "bg-teal-500 text-white border-teal-500"
                    : "bg-emerald-600 text-white border-emerald-600"
              }
            />
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-slate-200 shrink-0" />

        {/* ── 按标签筛选 ── */}
        <div className="flex items-center gap-1.5">
          <Label>标签</Label>
          {AVAILABLE_TAGS.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              active={filterState.selectedTags.includes(tag)}
              onClick={() => setTags(toggleInArray(filterState.selectedTags, tag))}
              activeClass={
                tag === "失败"
                  ? "bg-rose-500 text-white border-rose-500"
                  : tag === "已验证"
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-blue-500 text-white border-blue-500"
              }
            />
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-slate-200 shrink-0" />

        {/* ── 按类型筛选 ── */}
        <div className="flex items-center gap-1.5">
          <Label>类型</Label>
          {AVAILABLE_BLOCK_TYPES.map((bt) => (
            <Chip
              key={bt.value}
              label={bt.label}
              active={filterState.selectedBlockTypes.includes(bt.value)}
              onClick={() => setTypes(toggleInArray(filterState.selectedBlockTypes, bt.value))}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-slate-200 shrink-0" />

        {/* ── 按状态筛选 ── */}
        <div className="flex items-center gap-1.5">
          <Label>状态</Label>
          {AVAILABLE_STATUSES.map((st) => (
            <Chip
              key={st.value}
              label={st.label}
              active={filterState.selectedStatuses.includes(st.value)}
              onClick={() => setStatuses(toggleInArray(filterState.selectedStatuses, st.value))}
              activeClass={
                st.value === "exploring"
                  ? "bg-blue-500 text-white border-blue-500"
                  : st.value === "consolidating"
                    ? "bg-violet-500 text-white border-violet-500"
                    : st.value === "archived"
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-orange-500 text-white border-orange-500"
              }
            />
          ))}
        </div>

        {/* ── Right: match count + clear ── */}
        <div className="ml-auto flex items-center gap-3 shrink-0">
          {active && (
            <span className="text-[11px] text-slate-400">
              {matchedCount} / {totalCount} 个阶段命中
            </span>
          )}
          {active && (
            <button
              onClick={clearAll}
              className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200 transition-colors"
            >
              ✕ 清空筛选
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
