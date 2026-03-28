/**
 * Graph Types — api-server/lib/graph/types.ts
 *
 * This file owns ONLY the types that are INTERNAL to the api-server:
 * raw DB row shapes and the module representation as returned from the DB.
 *
 * All API-surface types (what the endpoints serialise to JSON) are imported
 * from @workspace/graph-contract and re-exported here so that internal
 * modules only need one import path.
 *
 * MIGRATION NOTE
 * ──────────────
 * ExperimentRecordRow and RawModule are DB-internal types.
 * They must NOT be exposed in API responses and must NOT be moved into
 * @workspace/graph-contract.  Only types that appear in API JSON belong there.
 */

import type { ConfirmationState, ModuleKey } from "@workspace/graph-contract";

export type {
  ConfirmationState,
  ModuleKey,
  DataSource,
  EdgeType,
  LineageNode,
  LineageEdge,
  LineageStats,
  LineageGraph,
  ModuleNode,
  ModuleEdge,
  MechanismSnapshotGraph,
  RecordSummary,
  ParameterValueGroup,
  ParameterDimension,
  ParameterGraph,
  GraphApiResponse,
  ItemAttribute,
  SystemObject,
  SystemModuleDetail,
  PrepItem,
  PreparationModuleDetail,
  OperationStep,
  OperationModuleDetail,
  MeasurementItem,
  MeasurementModuleDetail,
  DataItem,
  DataModuleDetail,
  ModuleDetailData,
  ModuleDetail,
  // Mechanism Chain Graph (Step 1 of Mechanism Graph refactor)
  ChainProjectNode,
  BlockStatus,
  BlockType,
  BoundaryTrigger,
  BlockArchiveSignals,
  ExperimentSnapshot,
  MechanismBlock,
  ChainEdgeType,
  ChainCompareContext,
  ChainEdge,
  ArchivingLogEntry,
  MechanismChainGraph,
} from "@workspace/graph-contract";

// ─── Internal DB Types (NOT part of the API contract) ─────────────────────────

export interface ExperimentRecordRow {
  id: string;
  sci_note_id: string;
  experiment_code: string;
  title: string;
  sequence_number: number;
  experiment_status: string;
  confirmation_state: ConfirmationState;
  tags: string[];
  derived_from_record_id: string | null;
  derived_from_source_type: string;
  derived_from_context_ver: number;
  current_modules: RawModule[] | null;
  confirmed_modules: RawModule[] | null;
  created_at: string;
  updated_at: string;
}

export interface RawModule {
  key: ModuleKey;
  title: string;
  status: string;
  updatedAt: string;
  isHighlighted: boolean;
  structuredData: Record<string, unknown>;
}
