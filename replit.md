# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

---

## Graph Lab Module (Pre-integration Development)

**Purpose:** Standalone read-only verification environment for SciBlock's mechanism graph feature. Uses a copy of the production DB (`sciblock_v1`) to validate graph data models and UI before integration into the SciBlock main project.

### Architecture

#### Backend: `artifacts/api-server/src/`

Four-layer graph service (zero writes, zero migrations, no auto-enumeration):

```
lib/graph/
├── types.ts              # Internal DB types: ExperimentRecordRow, RawModule (+ re-exports contract)
├── db.ts                 # DB read layer (only reads experiment_records; EXT_* env vars only)
├── transform.ts          # Pure graph transforms: lineage, snapshot, module detail
├── parameterExtract.ts   # Pure parameter extraction + aggregation: ParameterGraph
└── mechanismChain.ts     # Pure mechanism chain builder: block archiving + main chain generation
routes/
└── graph.ts              # API layer: all four endpoints
```

**Endpoints:**

- `GET /api/graph/lineage?sci_note_id=<uuid>` — experiment derivation DAG for a SciNote
- `GET /api/graph/snapshot?record_id=<uuid>` — module-level mechanism chain for one record
- `GET /api/graph/module-detail?record_id=<uuid>&module_key=<key>` — structured detail for one module
- `GET /api/graph/parameters?sci_note_id=<uuid>` — parameter-centric aggregation across all records
- `GET /api/graph/mechanism-chain?sci_note_id=<uuid>` — mechanism chain graph (blocks + project node + edges)

**Security rules (non-negotiable):**

- Only reads `experiment_records` table from `sciblock_v1`
- All credentials via `EXT_DB_*` env vars only (never `DATABASE_URL`)
- Zero writes, zero DDL, zero migrations
- No auto-enumeration of tables

#### Frontend: `artifacts/graph-lab/src/`

```
api/
├── types.ts        # Re-exports all types from @workspace/graph-contract
└── graphApi.ts     # API access: fetchLineageGraph/fetchSnapshotGraph/fetchModuleDetail/fetchParameterGraph
utils/
├── graphLayout.ts          # Layout: dagre for lineage, manual chain for snapshot
└── operationTransform.ts   # Client-side: OperationModuleDetail → OperationStepsGraph
components/
├── lineage/
│   ├── LineageFlow.tsx             # React Flow wrapper for lineage
│   └── LineageNodeCard.tsx         # Custom node: experiment_code, state badges, is_root
├── snapshot/
│   ├── SnapshotFlow.tsx            # React Flow wrapper for mechanism snapshot (clickable)
│   └── ModuleNodeCard.tsx          # Custom node: module title, item_count, outcome badge
├── detail/
│   ├── ModuleDetailPanel.tsx       # Detail panel: per-module renderers + list/graph toggle (operation)
│   ├── OperationStepsFlow.tsx      # React Flow sub-graph for operation steps
│   └── OperationStepNodeCard.tsx   # Custom step node: order badge, name, KV params
└── parameter/
    ├── ParameterView.tsx           # Main parameter view container (2-panel fragment)
    ├── ParameterDimensionList.tsx  # Left panel: Operation/Preparation section groups
    ├── ParameterValuePanel.tsx     # Middle panel: value groups + filter bar + RecordCard list
    └── RecordCard.tsx              # Clickable record tile: code, status badges, tags
pages/
└── GraphLabPage.tsx    # Main container: Tab switching (线索图 | 参数视图), shared right column
```

### Views

**线索图 (Lineage Tab):**
`LineageFlow` (left) | `SnapshotFlow` + `ModuleDetailPanel` (right column, always visible)

**参数视图 (Parameter Tab):**
`ParameterDimensionList` (left 220px) | `ParameterValuePanel` (middle) | `SnapshotFlow` + `ModuleDetailPanel` (right column, shared)

Clicking a record in the parameter view triggers `loadSnapshot()` — same handler used by the lineage view, so the right column state is shared between tabs.

### Contract Layer: `lib/graph-contract/src/index.ts`

Single source of truth for all API-surface types. Includes:

- Lineage types: `LineageGraph`, `LineageNode`, `LineageEdge`
- Snapshot types: `MechanismSnapshotGraph`, `ModuleNode`, `ModuleEdge`
- Module detail types: discriminated union `ModuleDetailData` + per-module interfaces
- Operation steps sub-graph: `OperationStepsGraph`, `OperationStepNode`, `OperationStepEdge`
- Parameter graph: `ParameterGraph`, `ParameterDimension`, `ParameterValueGroup`, `RecordSummary`
- Mechanism Chain (Step 1 refactor): `MechanismChainGraph`, `ChainProjectNode`, `MechanismBlock`, `BlockStatus`, `BoundaryTrigger`, `BlockArchiveSignals`, `ExperimentSnapshot`, `ChainEdge`, `ChainEdgeType`, `ChainCompareContext`, `ArchivingLogEntry`

### Parameter Extraction Rules (v1)

Sources: `operationSteps[].params` (operation) and `prepItems[].attributes` (preparation).
Key: `trim(key)` only — no synonym merging.
Disambiguation: same key in different contexts → separate dimensions (`key@context`).
`dimension_id` format: `"<source>::<key>::<source_context>"`.
Value normalization: regex `/^([+-]?\d+(?:\.\d+)?)\s*([^\d\s][\s\S]*)$/` → (numeric, unit).
Sorting: dimensions by source (op first) → record_count DESC → key ASC; value groups by numeric ASC or raw_value ASC.

### Key Design Decisions

- `confirmed_modules` path: uses confirmed snapshot for mechanism chain; `data` module always sourced from `current_modules` (by SciBlock design), flagged with warning
- `current_modules` fallback: draft records use live modules, all nodes labeled "current modules"
- Node ID format: `<record_id>__<module_key>` — stable, no collision risk
- Module order: system → preparation → operation → measurement (chain) → data (outcome leaf)
- Dagre layout for lineage DAG; fixed horizontal chain for snapshot; horizontal chain for operation steps sub-graph
- One record can appear under multiple parameter dimensions (correct — experiments set multiple params simultaneously)

### DB Connection Note

The external PostgreSQL server at `114.132.84.75:5432` has a low connection limit. If 500 errors appear, restart the api-server workflow to clear stale connections. Each request creates a new client, connects, queries, and immediately disconnects.
