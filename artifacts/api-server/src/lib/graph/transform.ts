/**
 * Graph Transform Layer — graph/transform.ts
 *
 * Pure functions. No DB access. No side effects.
 * Takes raw DB rows and produces typed graph JSON structures.
 */

import type {
  ExperimentRecordRow,
  LineageGraph,
  LineageNode,
  LineageEdge,
  MechanismSnapshotGraph,
  ModuleNode,
  ModuleEdge,
  ModuleKey,
  RawModule,
  DataSource,
  ModuleDetail,
  ModuleDetailData,
  ItemAttribute,
} from "./types.js";

// ─── Mechanism chain order (excluding data, which is the outcome node) ─────────
const MECHANISM_CHAIN: ModuleKey[] = ["system", "preparation", "operation", "measurement"];
const OUTCOME_MODULE: ModuleKey = "data";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function countModuleItems(mod: RawModule): number {
  const sd = mod.structuredData;
  if (!sd || typeof sd !== "object") return 0;
  const itemArrayKey = Object.keys(sd).find((k) => Array.isArray((sd as Record<string, unknown>)[k]));
  if (!itemArrayKey) return 0;
  return ((sd as Record<string, unknown>)[itemArrayKey] as unknown[]).length;
}

function makeModuleNodeId(recordId: string, moduleKey: ModuleKey): string {
  return `${recordId}__${moduleKey}`;
}

function toAttr(raw: unknown): ItemAttribute {
  const r = raw as Record<string, unknown>;
  return { key: String(r?.key ?? ""), value: String(r?.value ?? "") };
}

// ─── Lineage Graph ─────────────────────────────────────────────────────────────

export function buildLineageGraph(
  sciNoteId: string,
  rows: ExperimentRecordRow[]
): LineageGraph {
  const nodes: LineageNode[] = rows.map((row) => ({
    id: row.id,
    experiment_code: row.experiment_code,
    sequence_number: row.sequence_number,
    experiment_status: row.experiment_status,
    confirmation_state: row.confirmation_state,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date(row.created_at).toISOString(),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date(row.updated_at).toISOString(),
    is_root: row.derived_from_record_id === null,
  }));

  const edges: LineageEdge[] = rows
    .filter((row) => row.derived_from_record_id !== null)
    .map((row) => ({
      id: `${row.derived_from_record_id}__${row.id}`,
      source: row.derived_from_record_id as string,
      target: row.id,
      derived_from_source_type: row.derived_from_source_type,
      derived_from_context_ver: row.derived_from_context_ver,
    }));

  const rootCount = nodes.filter((n) => n.is_root).length;

  return {
    type: "lineage",
    sci_note_id: sciNoteId,
    nodes,
    edges,
    stats: {
      total_records: nodes.length,
      root_count: rootCount,
      derived_count: nodes.length - rootCount,
    },
    generated_at: new Date().toISOString(),
  };
}

// ─── Mechanism Snapshot Graph ──────────────────────────────────────────────────

export function buildMechanismSnapshotGraph(
  row: ExperimentRecordRow
): MechanismSnapshotGraph {
  const warnings: string[] = [];

  // Decide primary source: confirmed_modules preferred, fall back to current_modules
  let primaryModules: RawModule[] | null = null;
  let modulesSource: DataSource;

  if (row.confirmed_modules && row.confirmed_modules.length > 0) {
    primaryModules = row.confirmed_modules;
    modulesSource = "confirmed_modules";
  } else {
    primaryModules = row.current_modules;
    modulesSource = "current_modules";
    if (row.confirmation_state === "confirmed" || row.confirmation_state === "confirmed_dirty") {
      warnings.push(
        `Record is in state "${row.confirmation_state}" but confirmed_modules is empty. Falling back to current_modules.`
      );
    }
  }

  if (!primaryModules || primaryModules.length === 0) {
    return {
      type: "mechanism_snapshot",
      record_id: row.id,
      experiment_code: row.experiment_code,
      confirmation_state: row.confirmation_state,
      modules_source: modulesSource ?? "current_modules",
      nodes: [],
      edges: [],
      warnings: ["No module data available in either confirmed_modules or current_modules."],
      generated_at: new Date().toISOString(),
    };
  }

  const moduleMap = new Map<ModuleKey, RawModule>(
    primaryModules.map((m) => [m.key, m])
  );

  const nodes: ModuleNode[] = [];
  const edges: ModuleEdge[] = [];

  // Build mechanism chain nodes (system → preparation → operation → measurement)
  for (const key of MECHANISM_CHAIN) {
    const mod = moduleMap.get(key);
    if (!mod) {
      warnings.push(`Module "${key}" not found in ${modulesSource}.`);
      continue;
    }
    nodes.push({
      id: makeModuleNodeId(row.id, key),
      record_id: row.id,
      module_key: key,
      title: mod.title,
      module_status: mod.status,
      updated_at: mod.updatedAt,
      is_highlighted: mod.isHighlighted,
      item_count: countModuleItems(mod),
      is_outcome_node: false,
      data_source: modulesSource,
    });
  }

  // Build mechanism chain edges (sequential: system→prep→op→meas)
  const chainKeys = MECHANISM_CHAIN.filter((k) => moduleMap.has(k));
  for (let i = 0; i < chainKeys.length - 1; i++) {
    const srcKey = chainKeys[i];
    const tgtKey = chainKeys[i + 1];
    edges.push({
      id: `${makeModuleNodeId(row.id, srcKey)}__${makeModuleNodeId(row.id, tgtKey)}`,
      source: makeModuleNodeId(row.id, srcKey),
      target: makeModuleNodeId(row.id, tgtKey),
      edge_type: "mechanism_chain",
    });
  }

  // Build data (outcome) node — always from current_modules if not in confirmed_modules
  let dataModule: RawModule | undefined;
  let dataSource: DataSource = modulesSource;

  if (modulesSource === "confirmed_modules") {
    // confirmed_modules never contains the data module (by design)
    const currentDataMod = row.current_modules?.find((m) => m.key === OUTCOME_MODULE);
    if (currentDataMod) {
      dataModule = currentDataMod;
      dataSource = "current_modules";
      warnings.push(
        'data module is not included in confirmed_modules by design. Sourced from current_modules instead.'
      );
    } else {
      warnings.push('data module unavailable in confirmed snapshot and not found in current_modules.');
    }
  } else {
    dataModule = moduleMap.get(OUTCOME_MODULE);
  }

  if (dataModule) {
    nodes.push({
      id: makeModuleNodeId(row.id, OUTCOME_MODULE),
      record_id: row.id,
      module_key: OUTCOME_MODULE,
      title: dataModule.title,
      module_status: dataModule.status,
      updated_at: dataModule.updatedAt,
      is_highlighted: dataModule.isHighlighted,
      item_count: countModuleItems(dataModule),
      is_outcome_node: true,
      data_source: dataSource,
    });

    // Connect measurement → data as an outcome edge (if measurement node exists)
    if (moduleMap.has("measurement")) {
      edges.push({
        id: `${makeModuleNodeId(row.id, "measurement")}__${makeModuleNodeId(row.id, OUTCOME_MODULE)}`,
        source: makeModuleNodeId(row.id, "measurement"),
        target: makeModuleNodeId(row.id, OUTCOME_MODULE),
        edge_type: "outcome",
      });
    }
  }

  return {
    type: "mechanism_snapshot",
    record_id: row.id,
    experiment_code: row.experiment_code,
    confirmation_state: row.confirmation_state,
    modules_source: modulesSource,
    nodes,
    edges,
    warnings,
    generated_at: new Date().toISOString(),
  };
}

// ─── Module Detail ─────────────────────────────────────────────────────────────

/**
 * Build a fully-typed, business-clean detail payload for one module.
 *
 * Source selection follows the same logic as the snapshot graph:
 *   - data module always comes from current_modules
 *   - chain modules prefer confirmed_modules, fall back to current_modules
 *
 * All structuredData is parsed defensively with explicit field mapping —
 * no raw JSON is passed through to the API response.
 */
export function buildModuleDetail(
  row: ExperimentRecordRow,
  moduleKey: ModuleKey
): ModuleDetail {
  // ── resolve source ──
  let modules: RawModule[] | null;
  let dataSource: DataSource;

  if (moduleKey === "data") {
    modules = row.current_modules;
    dataSource = "current_modules";
  } else if (row.confirmed_modules && row.confirmed_modules.length > 0) {
    modules = row.confirmed_modules;
    dataSource = "confirmed_modules";
  } else {
    modules = row.current_modules;
    dataSource = "current_modules";
  }

  const mod = modules?.find((m) => m.key === moduleKey) ?? null;
  const title = mod?.title ?? moduleKey;
  const sd = (mod?.structuredData ?? {}) as Record<string, unknown>;

  // ── build discriminated detail ──
  let moduleData: ModuleDetailData;

  switch (moduleKey) {
    case "system": {
      const raw = (sd["systemObjects"] as unknown[] | undefined) ?? [];
      moduleData = {
        module_key: "system",
        title,
        objects: raw.map((o) => {
          const obj = o as Record<string, unknown>;
          return { id: String(obj["id"] ?? ""), name: String(obj["name"] ?? "") };
        }),
      };
      break;
    }

    case "preparation": {
      const raw = (sd["prepItems"] as unknown[] | undefined) ?? [];
      moduleData = {
        module_key: "preparation",
        title,
        items: raw.map((o) => {
          const item = o as Record<string, unknown>;
          const attrs = (item["attributes"] as unknown[] | undefined) ?? [];
          return {
            id: String(item["id"] ?? ""),
            name: String(item["name"] ?? ""),
            category: String(item["category"] ?? ""),
            attributes: attrs.map(toAttr),
          };
        }),
      };
      break;
    }

    case "operation": {
      const raw = (sd["operationSteps"] as unknown[] | undefined) ?? [];
      moduleData = {
        module_key: "operation",
        title,
        steps: raw.map((o) => {
          const step = o as Record<string, unknown>;
          const params = (step["params"] as unknown[] | undefined) ?? [];
          return {
            id: String(step["id"] ?? ""),
            name: String(step["name"] ?? ""),
            order: typeof step["order"] === "number" ? step["order"] : 0,
            params: params.map(toAttr),
          };
        }),
      };
      break;
    }

    case "measurement": {
      const raw = (sd["measurementItems"] as unknown[] | undefined) ?? [];
      moduleData = {
        module_key: "measurement",
        title,
        items: raw.map((o) => {
          const item = o as Record<string, unknown>;
          const conds = (item["conditions"] as unknown[] | undefined) ?? [];
          return {
            id: String(item["id"] ?? ""),
            name: String(item["name"] ?? ""),
            target: String(item["target"] ?? ""),
            conditions: conds.map(toAttr),
          };
        }),
      };
      break;
    }

    case "data": {
      const raw = (sd["dataItems"] as unknown[] | undefined) ?? [];
      moduleData = {
        module_key: "data",
        title,
        items: raw.map((o) => {
          const item = o as Record<string, unknown>;
          return {
            id: String(item["id"] ?? ""),
            name: String(item["name"] ?? ""),
          };
        }),
      };
      break;
    }
  }

  return {
    record_id: row.id,
    experiment_code: row.experiment_code,
    module_data: moduleData,
    data_source: dataSource,
    generated_at: new Date().toISOString(),
  };
}
