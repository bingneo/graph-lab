/**
 * Graph API Types — graph-lab/api/types.ts
 *
 * This file is a thin re-export of @workspace/graph-contract — the single
 * source of truth for all graph API surface types.
 *
 * Do NOT define graph domain types here.  If a type needs to be added or
 * corrected, edit lib/graph-contract/src/index.ts.  This file exists only
 * so that in-app imports can use the short path "@/api/types" without
 * coupling directly to the package name.
 *
 * MIGRATION NOTE
 * ──────────────
 * When graph-lab components are integrated into the SciBlock main project,
 * replace "@/api/types" imports with the equivalent path to the shared
 * contract layer in that project.  No type definitions need to move.
 */

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
  OperationStepNode,
  OperationStepEdge,
  OperationStepsGraph,
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
