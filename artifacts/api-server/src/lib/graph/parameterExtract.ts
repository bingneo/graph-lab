/**
 * Parameter Extract — lib/graph/parameterExtract.ts
 *
 * Pure server-side aggregation: takes all ExperimentRecordRow values for a
 * SciNote and produces a ParameterGraph.
 *
 * EXTRACTION SOURCES (v1):
 *   1. operation   — operationSteps[].params[]  (key, value)
 *   2. preparation — prepItems[].attributes[]   (key, value)
 *   Measurement conditions and data items are excluded in v1.
 *
 * KEY NORMALIZATION (v1, conservative):
 *   trim(key) only — no synonym merging.
 *   Same key in different contexts (step_name / item_name) → distinct dimensions.
 *   dimension_id = "<source>::<key>::<source_context>"
 *
 * VALUE NORMALIZATION:
 *   Regex-split into (numeric_value, unit).
 *   e.g. "700℃" → { numeric: 700, unit: "℃" }
 *        "0.5mm/h" → { numeric: 0.5, unit: "mm/h" }
 *        "In0.52Se0.48" → { numeric: null, unit: null }
 *
 * DATA SOURCE SELECTION (same rule as buildModuleDetail):
 *   Chain modules → confirmed_modules if non-empty, else current_modules.
 *   (data module is excluded so the rule simplifies to: prefer confirmed.)
 *
 * SECURITY: Read-only pure transform. No DB access here.
 */

import type {
  ExperimentRecordRow,
  ParameterGraph,
  ParameterDimension,
  ParameterValueGroup,
  RecordSummary,
} from "./types.js";
import type { RawModule } from "./types.js";

// ─── Value parsing ──────────────────────────────────────────────────────────────

/**
 * Parses a raw value string into (numericValue, unit).
 * Pattern: optional sign, digits (with optional decimal), optional space, unit tail.
 * Both fields are null when the string does not match.
 */
const VALUE_RE = /^([+-]?\d+(?:\.\d+)?)\s*([^\d\s][\s\S]*)$/;

function parseValue(raw: string): { numeric: number | null; unit: string | null } {
  const m = raw.trim().match(VALUE_RE);
  if (!m) return { numeric: null, unit: null };
  return { numeric: parseFloat(m[1]), unit: m[2].trim() || null };
}

// ─── Module resolution (same source-selection rule as buildModuleDetail) ────────

function resolveModules(row: ExperimentRecordRow): RawModule[] {
  if (row.confirmed_modules && row.confirmed_modules.length > 0) {
    return row.confirmed_modules;
  }
  return row.current_modules ?? [];
}

// ─── Internal intermediate types ────────────────────────────────────────────────

interface RawEntry {
  dimensionId: string;
  key: string;
  source: "operation" | "preparation";
  sourceContext: string;
  rawValue: string;
  numericValue: number | null;
  unit: string | null;
}

// ─── Extraction helpers ─────────────────────────────────────────────────────────

function extractFromRecord(row: ExperimentRecordRow): RawEntry[] {
  const modules = resolveModules(row);
  const entries: RawEntry[] = [];

  for (const mod of modules) {
    const sd = (mod.structuredData ?? {}) as Record<string, unknown>;

    if (mod.key === "operation") {
      const steps = (sd["operationSteps"] as unknown[] | undefined) ?? [];
      for (const rawStep of steps) {
        const step = rawStep as Record<string, unknown>;
        const stepName = String(step["name"] ?? "").trim() || "步骤";
        const params = (step["params"] as unknown[] | undefined) ?? [];
        for (const rawParam of params) {
          const p = rawParam as Record<string, unknown>;
          const key = String(p["key"] ?? "").trim();
          const rawValue = String(p["value"] ?? "").trim();
          if (!key || !rawValue) continue;
          const { numeric, unit } = parseValue(rawValue);
          entries.push({
            dimensionId: `operation::${key}::${stepName}`,
            key,
            source: "operation",
            sourceContext: stepName,
            rawValue,
            numericValue: numeric,
            unit,
          });
        }
      }
    }

    if (mod.key === "preparation") {
      const prepItems = (sd["prepItems"] as unknown[] | undefined) ?? [];
      for (const rawItem of prepItems) {
        const item = rawItem as Record<string, unknown>;
        const itemName = String(item["name"] ?? "").trim() || "准备项";
        const attrs = (item["attributes"] as unknown[] | undefined) ?? [];
        for (const rawAttr of attrs) {
          const a = rawAttr as Record<string, unknown>;
          const key = String(a["key"] ?? "").trim();
          const rawValue = String(a["value"] ?? "").trim();
          if (!key || !rawValue) continue;
          const { numeric, unit } = parseValue(rawValue);
          entries.push({
            dimensionId: `preparation::${key}::${itemName}`,
            key,
            source: "preparation",
            sourceContext: itemName,
            rawValue,
            numericValue: numeric,
            unit,
          });
        }
      }
    }
  }

  return entries;
}

// ─── Aggregation ─────────────────────────────────────────────────────────────────

/** Sort value groups: numeric ASC if all numeric, else raw_value ASC */
function sortValueGroups(groups: ParameterValueGroup[]): ParameterValueGroup[] {
  const allNumeric = groups.every((g) => g.numeric_value !== null);
  if (allNumeric) {
    return [...groups].sort((a, b) => (a.numeric_value! - b.numeric_value!));
  }
  return [...groups].sort((a, b) => a.raw_value.localeCompare(b.raw_value, "zh-CN"));
}

/** Sort dimensions: operation first → record_count DESC → key ASC */
function sortDimensions(dims: ParameterDimension[]): ParameterDimension[] {
  return [...dims].sort((a, b) => {
    const srcOrder = (s: string) => (s === "operation" ? 0 : 1);
    if (srcOrder(a.source) !== srcOrder(b.source)) {
      return srcOrder(a.source) - srcOrder(b.source);
    }
    if (b.record_count !== a.record_count) {
      return b.record_count - a.record_count;
    }
    return a.key.localeCompare(b.key, "zh-CN");
  });
}

// ─── Public entry point ──────────────────────────────────────────────────────────

export function buildParameterGraph(
  sciNoteId: string,
  rows: ExperimentRecordRow[]
): ParameterGraph {
  // dim_id → value_key → RecordSummary[]
  const dimIndex = new Map<string, Map<string, RecordSummary[]>>();

  // dim_id → { key, source, sourceContext }  (static metadata)
  const dimMeta = new Map<
    string,
    { key: string; source: "operation" | "preparation"; sourceContext: string }
  >();

  // dim_id → value_key → { numeric, unit }
  const valueNorm = new Map<string, Map<string, { numeric: number | null; unit: string | null }>>();

  // Track unique records per dimension
  const dimRecordIds = new Map<string, Set<string>>();

  for (const row of rows) {
    const summary: RecordSummary = {
      record_id: row.id,
      experiment_code: row.experiment_code,
      title: row.title ?? "",
      experiment_status: row.experiment_status,
      confirmation_state: row.confirmation_state,
      tags: Array.isArray(row.tags) ? row.tags : [],
    };

    const entries = extractFromRecord(row);

    for (const entry of entries) {
      const { dimensionId, key, source, sourceContext, rawValue, numericValue, unit } = entry;

      if (!dimIndex.has(dimensionId)) {
        dimIndex.set(dimensionId, new Map());
        dimMeta.set(dimensionId, { key, source, sourceContext });
        valueNorm.set(dimensionId, new Map());
        dimRecordIds.set(dimensionId, new Set());
      }

      const valueMap = dimIndex.get(dimensionId)!;
      const normMap = valueNorm.get(dimensionId)!;

      if (!valueMap.has(rawValue)) {
        valueMap.set(rawValue, []);
        normMap.set(rawValue, { numeric: numericValue, unit });
      }

      // Avoid duplicate record in same value group (idempotent)
      const records = valueMap.get(rawValue)!;
      if (!records.some((r) => r.record_id === row.id)) {
        records.push(summary);
      }

      dimRecordIds.get(dimensionId)!.add(row.id);
    }
  }

  const dimensions: ParameterDimension[] = [];

  for (const [dimensionId, valueMap] of dimIndex.entries()) {
    const meta = dimMeta.get(dimensionId)!;
    const normMap = valueNorm.get(dimensionId)!;

    const rawGroups: ParameterValueGroup[] = [...valueMap.entries()].map(
      ([rawValue, records]) => {
        const norm = normMap.get(rawValue) ?? { numeric: null, unit: null };
        return {
          raw_value: rawValue,
          numeric_value: norm.numeric,
          unit: norm.unit,
          records,
        };
      }
    );

    dimensions.push({
      dimension_id: dimensionId,
      key: meta.key,
      source: meta.source,
      source_context: meta.sourceContext,
      value_groups: sortValueGroups(rawGroups),
      record_count: dimRecordIds.get(dimensionId)!.size,
    });
  }

  return {
    type: "parameter_graph",
    sci_note_id: sciNoteId,
    total_records: rows.length,
    dimensions: sortDimensions(dimensions),
    generated_at: new Date().toISOString(),
  };
}
