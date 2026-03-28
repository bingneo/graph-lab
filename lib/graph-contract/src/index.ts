/**
 * @workspace/graph-contract
 *
 * Canonical API contract types for the SciBlock Mechanism Graph feature.
 *
 * This file is the single source of truth for all types that cross the
 * API boundary — i.e. everything the backend serialises into JSON and
 * the frontend deserialises from JSON.
 *
 * SCOPE RULES
 * ───────────
 * ✔  Belongs here: graph-level domain types that appear in API responses.
 * ✗  Does NOT belong here: DB row types (ExperimentRecordRow, RawModule),
 *    internal transform helpers, UI-only view-model types, React component
 *    props, or anything that is not part of the over-the-wire contract.
 *
 * MIGRATION
 * ─────────
 * When this module is moved into the SciBlock main project it should land
 * in a shared/contract layer accessible to both the backend service and the
 * frontend consumer.  No changes to the types themselves should be required.
 * See INTEGRATION.md in the same directory for the full migration guide.
 */

// ─── Primitive Domains ────────────────────────────────────────────────────────

/**
 * The confirmation lifecycle of an experiment record.
 *
 * NOTE: the value "failed" exists in the SciBlock UI layer but is not stored
 * in the `experiment_records` table and will never appear in API responses
 * from this service.  Consumers that need to represent a client-side error
 * state should extend this type locally rather than adding it here.
 */
export type ConfirmationState = "draft" | "confirmed" | "confirmed_dirty";

/**
 * The five structural modules of an experiment mechanism.
 * Order reflects the canonical mechanism chain:
 *   system → preparation → operation → measurement  (chain)
 *   measurement → data                              (outcome edge)
 */
export type ModuleKey =
  | "system"
  | "preparation"
  | "operation"
  | "measurement"
  | "data";

/**
 * Which snapshot the module data was sourced from.
 * - confirmed_modules: frozen at confirmation time (chain modules only)
 * - current_modules:   live working copy (always used for the data module;
 *                      also used as fallback for draft records)
 */
export type DataSource = "confirmed_modules" | "current_modules";

/**
 * Semantic type of an edge in any graph produced by this service.
 * - mechanism_chain: sequential dependency between chain modules (snapshot)
 * - outcome:         measurement → data (snapshot)
 * - step_sequence:   ordered step-to-step edge (operation steps sub-graph)
 */
export type EdgeType = "mechanism_chain" | "outcome" | "step_sequence";

// ─── Lineage Graph ─────────────────────────────────────────────────────────────

/**
 * One experiment record in the derivation DAG for a SciNote.
 */
export interface LineageNode {
  id: string;
  experiment_code: string;
  sequence_number: number;
  experiment_status: string;
  confirmation_state: ConfirmationState;
  created_at: string;
  updated_at: string;
  /** True when derived_from_record_id is null (no parent experiment). */
  is_root: boolean;
}

/**
 * A directed derivation edge: parent → child experiment record.
 */
export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  derived_from_source_type: string;
  derived_from_context_ver: number;
}

/**
 * Aggregate counts computed over the full lineage set.
 */
export interface LineageStats {
  total_records: number;
  root_count: number;
  derived_count: number;
}

/**
 * The complete lineage graph for one SciNote: all experiment records
 * and the derivation edges between them.
 */
export interface LineageGraph {
  type: "lineage";
  sci_note_id: string;
  nodes: LineageNode[];
  edges: LineageEdge[];
  stats: LineageStats;
  generated_at: string;
}

// ─── Mechanism Snapshot Graph ──────────────────────────────────────────────────

/**
 * One module in the mechanism chain or outcome position.
 */
export interface ModuleNode {
  id: string;
  record_id: string;
  module_key: ModuleKey;
  title: string;
  module_status: string;
  updated_at: string;
  is_highlighted: boolean;
  item_count: number;
  /** True only for the data module (outcome leaf node). */
  is_outcome_node: boolean;
  data_source: DataSource;
}

/**
 * A directed edge in the mechanism snapshot graph.
 */
export interface ModuleEdge {
  id: string;
  source: string;
  target: string;
  edge_type: EdgeType;
}

/**
 * The complete mechanism snapshot for one experiment record:
 * five module nodes laid out as a chain with an outcome leaf.
 *
 * warnings: non-empty when data sourced from fallback path
 *   (e.g. data module from current_modules while chain uses confirmed_modules,
 *   or full fallback to current_modules for a confirmed record with empty snapshot).
 */
export interface MechanismSnapshotGraph {
  type: "mechanism_snapshot";
  record_id: string;
  experiment_code: string;
  confirmation_state: ConfirmationState;
  /**
   * Source used for the chain modules (system/preparation/operation/measurement).
   * The data module always comes from current_modules regardless of this value.
   */
  modules_source: DataSource;
  nodes: ModuleNode[];
  edges: ModuleEdge[];
  warnings: string[];
  generated_at: string;
}

// ─── Parameter-Centric Graph ───────────────────────────────────────────────────

/**
 * A lightweight record summary used as a leaf node in the parameter-centric
 * view.  One record can appear under multiple ParameterValueGroups because a
 * single experiment explores multiple parameter dimensions simultaneously.
 *
 * tags is the raw text[] from the DB; may be empty in v1.
 */
export interface RecordSummary {
  record_id: string;
  experiment_code: string;
  title: string;
  experiment_status: string;
  confirmation_state: ConfirmationState;
  tags: string[];
}

/**
 * All experiment records that share the same (key, source, source_context,
 * raw_value) combination — i.e. they set the same parameter to the same value.
 *
 * Value normalization:
 *   numeric_value — parsed number when raw_value starts with a numeric literal
 *   unit          — trailing unit string, e.g. "℃", "mm/h", "min"
 *   Both are null when the value cannot be parsed into number + unit.
 *
 * Value group sort (applied by the client):
 *   All numeric_value non-null → sort by numeric_value ASC
 *   Otherwise                  → sort by raw_value ASC (lexicographic)
 */
export interface ParameterValueGroup {
  raw_value: string;
  numeric_value: number | null;
  unit: string | null;
  records: RecordSummary[];
}

/**
 * One parameter dimension: a (source, key, source_context) triple.
 *
 * dimension_id is a stable opaque key of the form
 *   "<source>::<key>::<source_context>"
 * suitable for use as a React key or URL segment.
 *
 * Dimension sort (applied by the client):
 *   1. source order: "operation" before "preparation"
 *   2. record_count DESC (most-used parameters first)
 *   3. key ASC (alphabetical within same count)
 */
export interface ParameterDimension {
  dimension_id: string;
  key: string;
  source: "operation" | "preparation";
  /** step_name (operation) or item_name (preparation) — used for disambiguation */
  source_context: string;
  value_groups: ParameterValueGroup[];
  record_count: number;
}

/**
 * The complete parameter-centric aggregation for one SciNote.
 * Built server-side from all experiment records under sci_note_id;
 * no new DB tables required — derived from existing JSONB module data.
 *
 * Extraction sources (in priority order):
 *   1. operation   — operationSteps[].params
 *   2. preparation — prepItems[].attributes
 *   (measurement conditions and data items are excluded in v1)
 */
export interface ParameterGraph {
  type: "parameter_graph";
  sci_note_id: string;
  total_records: number;
  dimensions: ParameterDimension[];
  generated_at: string;
}

// ─── Operation Steps Sub-Graph ─────────────────────────────────────────────────

/**
 * A single step node in the operation steps sub-graph.
 * Derived client-side from OperationModuleDetail — no new API endpoint needed.
 *
 * id format: "<record_id>__operation__<step.id>"
 * params are rendered as node attributes, not as separate graph nodes.
 */
export interface OperationStepNode {
  id: string;
  step_id: string;
  name: string;
  order: number;
  params: ItemAttribute[];
}

/**
 * A directed sequential edge between two step nodes.
 */
export interface OperationStepEdge {
  id: string;
  source: string;
  target: string;
  edge_type: "step_sequence";
}

/**
 * The complete operation steps sub-graph for one experiment record.
 * Built entirely from OperationModuleDetail data — no DB query, no API call.
 *
 * nodes are sorted by order (defensive: missing/NaN order → appended by index).
 * 0 nodes → empty state; 1 node → single node, no edges; 2+ → sequential chain.
 */
export interface OperationStepsGraph {
  type: "operation_steps";
  record_id: string;
  experiment_code: string;
  title: string;
  nodes: OperationStepNode[];
  edges: OperationStepEdge[];
}

// ─── Module Detail ─────────────────────────────────────────────────────────────

/**
 * A key-value pair used as an attribute on a prep item, or a condition on a
 * measurement item.  Reused across modules rather than duplicated.
 */
export interface ItemAttribute {
  key: string;
  value: string;
}

// ── system ──

export interface SystemObject {
  id: string;
  name: string;
}

export interface SystemModuleDetail {
  module_key: "system";
  title: string;
  objects: SystemObject[];
}

// ── preparation ──

export interface PrepItem {
  id: string;
  name: string;
  category: string;
  attributes: ItemAttribute[];
}

export interface PreparationModuleDetail {
  module_key: "preparation";
  title: string;
  items: PrepItem[];
}

// ── operation ──

export interface OperationStep {
  id: string;
  name: string;
  order: number;
  params: ItemAttribute[];
}

export interface OperationModuleDetail {
  module_key: "operation";
  title: string;
  steps: OperationStep[];
}

// ── measurement ──

export interface MeasurementItem {
  id: string;
  name: string;
  /** The measurement target or instrument (e.g. "SEM", "XRD"). */
  target: string;
  conditions: ItemAttribute[];
}

export interface MeasurementModuleDetail {
  module_key: "measurement";
  title: string;
  items: MeasurementItem[];
}

// ── data ──

export interface DataItem {
  id: string;
  name: string;
}

export interface DataModuleDetail {
  module_key: "data";
  title: string;
  items: DataItem[];
}

/**
 * Discriminated union of all module detail payloads.
 * Discriminant: `module_key`.
 */
export type ModuleDetailData =
  | SystemModuleDetail
  | PreparationModuleDetail
  | OperationModuleDetail
  | MeasurementModuleDetail
  | DataModuleDetail;

/**
 * Full response from GET /api/graph/module-detail.
 * Contains the typed detail payload for a single module of one experiment record.
 */
export interface ModuleDetail {
  record_id: string;
  experiment_code: string;
  module_data: ModuleDetailData;
  data_source: DataSource;
  generated_at: string;
}

// ─── Mechanism Chain Graph ────────────────────────────────────────────────────

/**
 * Virtual project node that anchors the start of every mechanism chain.
 *
 * This node has no corresponding DB row.  It is synthesised from the
 * sci_note_id that scopes the chain.  In V1 the label falls back to
 * "研发项目"; a future query against the sci_note table will supply the
 * actual project title.
 *
 * id format: "project:{sci_note_id}"
 */
export interface ChainProjectNode {
  id: string;
  sci_note_id: string;
  node_type: "project";
  /** Project display name.  V1: always "研发项目".  V2+: resolved from sci_note. */
  label: string;
  total_records: number;
  total_blocks: number;
}

/**
 * Lifecycle status of a mechanism block, derived from its constituent records.
 *
 * exploring      — all records are draft; the stage is active and open.
 * consolidating  — mix of confirmed and draft; stage is being locked down.
 * archived       — all records are confirmed; stage is complete.
 * mixed          — contains confirmed_dirty records; requires re-confirmation.
 */
export type BlockStatus = "exploring" | "consolidating" | "archived" | "mixed";

/**
 * Semantic research-stage type inferred for a mechanism block.
 *
 * initial_setup          — first block; establishes core experimental system.
 * condition_exploration  — early-stage draft experiments; conditions not settled.
 * parameter_optimization — operation steps changed; same system, tuning parameters.
 * repeat_validation      — same fingerprint, multiple records; repetition / re-check.
 * measurement_validation — only measurement dimension changed; validating readouts.
 * result_confirmation    — final block with confirmed records; stage locked down.
 * mixed_progression      — catch-all; multiple structural dimensions changed.
 */
export type BlockType =
  | "initial_setup"
  | "condition_exploration"
  | "parameter_optimization"
  | "repeat_validation"
  | "measurement_validation"
  | "result_confirmation"
  | "mixed_progression";

/**
 * Rule triggers that caused a new block boundary to be opened.
 *
 * first_block              — always set on block[0]; no comparison is possible.
 * system_changed           — system object set changed significantly (Jaccard < 0.5).
 * preparation_changed      — preparation item set changed significantly (Jaccard < 0.4).
 * operation_changed        — operation step set changed significantly (Jaccard < 0.5).
 * measurement_changed      — measurement item set changed significantly (Jaccard < 0.4).
 * phase_transition         — a confirmed record is followed by a new draft in the
 *                            lineage, indicating a new exploration wave.
 * title_param_changed      — title-extracted parameter key set diverged completely
 *                            (zero overlap between consecutive records), or a
 *                            first failure event appeared in an otherwise
 *                            non-failing block, or a qualitative new parameter
 *                            dimension (gradient, rocking furnace, etc.) appeared
 *                            for the first time in the current block.
 * new_element_introduced   — a preparation item name not seen in any earlier
 *                            experiment record of this sci_note appeared,
 *                            indicating a new material was added to the system.
 * failure_cluster_recovery — after ≥ 3 consecutive failing records the chain
 *                            returns to a non-failing state, signalling a new
 *                            exploration wave following a failure cluster.
 */
export type BoundaryTrigger =
  | "first_block"
  | "system_changed"
  | "preparation_changed"
  | "operation_changed"
  | "measurement_changed"
  | "phase_transition"
  | "title_param_changed"
  | "new_element_introduced"
  | "failure_cluster_recovery";

/**
 * Similarity fingerprints and rule-trigger distribution for one block.
 *
 * Stored on the block so consumers can inspect archiving decisions without
 * re-running the algorithm.  Also used by the comparison view to highlight
 * structural differences between blocks.
 */
export interface BlockArchiveSignals {
  /** Pipe-separated sorted set of system object names (used for Jaccard). */
  system_fingerprint: string;
  /** Pipe-separated sorted set of preparation item names. */
  preparation_fingerprint: string;
  /** Pipe-separated sorted set of operation step names. */
  operation_fingerprint: string;
  /** Pipe-separated sorted set of measurement item names. */
  measurement_fingerprint: string;
  /**
   * Pipe-separated sorted set of title-extracted parameter KEY names seen
   * across all records in this block.
   *
   * Values are the parameter DIMENSION names (not the raw values), e.g.:
   *   "gradient|ratio|speed|temp"
   *
   * Keys map to: ratio · synth_temp · grow_temp · temp · speed · gradient ·
   *   rocking · failure_event · batch_variant · furnace_fluctuation.
   *
   * Empty string when no structured parameters were extracted from titles.
   * Optional for backward compatibility with pre-calibration snapshots.
   */
  title_params_fingerprint?: string;
  /** Triggers that caused this block's boundary with the preceding block. */
  boundary_triggers: BoundaryTrigger[];
  /** Record count per confirmation_state value within this block. */
  confirmation_state_dist: Record<string, number>;
  /** Record count per experiment_status value within this block. */
  experiment_status_dist: Record<string, number>;
}

/**
 * Full experiment info snapshot for one record, attached to its parent block.
 *
 * Used by: block detail panel, adjacent-block diff view, cross-block comparison.
 *
 * Module data is resolved with the same priority rule as the snapshot API:
 *   confirmed_modules → current_modules (fallback).
 * The data module always reads from current_modules per SciBlock convention.
 */
export interface ExperimentSnapshot {
  record_id: string;
  experiment_code: string;
  title: string;
  confirmation_state: ConfirmationState;
  experiment_status: string;
  tags: string[];
  data_source: DataSource;
  modules: {
    system: {
      title: string;
      objects: SystemObject[];
    };
    preparation: {
      title: string;
      items: PrepItem[];
    };
    operation: {
      title: string;
      steps: OperationStep[];
    };
    measurement: {
      title: string;
      items: MeasurementItem[];
    };
    data: {
      title: string;
      items: DataItem[];
    };
  };
}

/**
 * One mechanism block — a research-stage cluster of related experiment records.
 *
 * A block groups records that share the same research stage, experimental
 * objective, and core system.  Minor parametric variation (retesting, small
 * adjustments) keeps records in the same block.  A new block is started when
 * one or more BoundaryTrigger conditions fire (see archive_signals).
 *
 * V1: blocks are generated automatically via rule-based archiving.
 * V2+: users may manually re-assign records across blocks via the annotation
 *       layer without modifying experiment_records.
 */
export interface MechanismBlock {
  /** "block:{sci_note_id}:{stage_index}" */
  id: string;
  sci_note_id: string;
  node_type: "block";

  /** 1-based position on the main chain. */
  stage_index: number;
  /**
   * Auto-generated stage label.
   * Pattern: "阶段 N：{block_type_title}".
   * Example: "阶段 1：实验系统搭建".
   */
  stage_label: string;
  /**
   * Brief auto-derived objective summary.
   * Derived from: purpose_input → block-type-aware phrase → operation/system names.
   */
  objective_summary: string;
  /**
   * Inferred semantic type for this research stage.
   * Rule-based inference from boundary triggers, record distribution, and position.
   */
  block_type: BlockType;

  record_ids: string[];
  record_count: number;
  block_status: BlockStatus;

  /** Earliest and latest record creation timestamps within this block. */
  created_range: {
    earliest: string;   // ISO 8601
    latest: string;     // ISO 8601
  };

  archive_signals: BlockArchiveSignals;

  /**
   * Full experiment snapshots for every record in the block.
   * Required by the detail panel, comparison view, and parameter drill-down.
   */
  experiment_snapshots: ExperimentSnapshot[];
}

/**
 * Distinguishes the two semantic kinds of chain edges.
 *
 * main_transition    — solid line; canonical R&D progression (auto-generated).
 * compare_transition — dashed line; cross-block comparison (user-initiated, V2+).
 */
export type ChainEdgeType = "main_transition" | "compare_transition";

/**
 * Semantic context carried by a compare_transition edge.
 * Describes what structural dimension is being compared.
 */
export interface ChainCompareContext {
  /**
   * Comparison dimension.
   * One of: "system" | "operation" | "measurement" | "parameters"
   */
  dimension: string;
  /** Human-readable label shown on the dashed edge (e.g. "操作对比"). */
  label: string;
}

/**
 * A directed edge in the mechanism chain graph.
 *
 * main_transition:    source is the project node or a block; target is a block.
 * compare_transition: source and target are both blocks; compare_context is set.
 */
export interface ChainEdge {
  id: string;
  source: string;    // "project:{sci_note_id}" or "block:{sci_note_id}:{n}"
  target: string;    // "block:{sci_note_id}:{n}"
  edge_type: ChainEdgeType;
  /** Only present on compare_transition edges. */
  compare_context?: ChainCompareContext;
}

/**
 * One entry in the block-archiving audit trail.
 *
 * Records why each experiment record was assigned to a specific block.
 * Surfaced in a future "explain this grouping" UI; also useful for debugging
 * the archiving algorithm during development.
 */
export interface ArchivingLogEntry {
  record_id: string;
  experiment_code: string;
  /** 1-based block index this record was assigned to. */
  assigned_block_index: number;
  /** true if this record triggered a block boundary (i.e. it is the first record of a new block). */
  boundary_triggered: boolean;
  triggers: BoundaryTrigger[];
  /** Human-readable explanation, e.g. "实验系统变化（Jaccard=0.33）". */
  reason: string;
}

/**
 * Full mechanism chain graph returned by GET /api/graph/mechanism-chain.
 *
 * Graph structure (V1):
 *   project_node → block[0] → block[1] → … → block[n-1]
 *   All edges are main_transition (solid lines).
 *
 * V2+: compare_transition edges (dashed) will be added for user-selected
 *       cross-block comparisons and stored in the annotation layer.
 *
 * V1 data sources: derived entirely from experiment_records JSONB.
 * No annotation-layer tables are required for V1.
 */
export interface MechanismChainGraph {
  type: "mechanism_chain";
  sci_note_id: string;
  project_node: ChainProjectNode;
  blocks: MechanismBlock[];
  edges: ChainEdge[];
  archiving_log: ArchivingLogEntry[];
  generated_at: string;
}

// ─── HTTP Response Envelope ───────────────────────────────────────────────────

/**
 * Standard API response envelope for all graph endpoints.
 *
 * Success: { ok: true,  data: T }
 * Error:   { ok: false, error: string }
 *
 * Consumers should check ok before accessing data.
 */
export interface GraphApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
