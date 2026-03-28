# Mechanism Graph — Integration & Migration Guide

This document covers how the graph module is structured, which parts are
production-ready for migration into SciBlock, and what the correct target
layers are when integration begins.

---

## 1. Layer Map

### What lives where today (graph-lab environment)

```
lib/graph-contract/src/index.ts          ← SHARED CONTRACT (migrate as-is)
  Canonical API types:
    ConfirmationState, ModuleKey, DataSource, EdgeType
    LineageNode, LineageEdge, LineageStats, LineageGraph
    ModuleNode, ModuleEdge, MechanismSnapshotGraph
    GraphApiResponse<T>

artifacts/api-server/src/lib/graph/
  types.ts      ← re-exports contract + internal DB row types (ExperimentRecordRow, RawModule)
  db.ts         ← DB read layer: pool, queries (migrate to SciBlock backend)
  transform.ts  ← pure transform functions (migrate to SciBlock backend)

artifacts/api-server/src/routes/graph.ts ← API route handlers (migrate to SciBlock backend)

artifacts/graph-lab/src/
  api/types.ts        ← thin re-export of @workspace/graph-contract
  api/graphApi.ts     ← HTTP client functions: fetchLineageGraph, fetchSnapshotGraph
  utils/graphLayout.ts  ← dagre + manual layout math
  components/lineage/   ← LineageFlow, LineageNodeCard
  components/snapshot/  ← SnapshotFlow, ModuleNodeCard
  components/shared/    ← GraphStats, WarningBanner, PanelLoadingState
  pages/GraphLabPage.tsx  ← container page (graph-lab specific, not for direct migration)
```

---

## 2. Migration Decision Table

| File | Migrate? | Target in SciBlock | Notes |
|---|---|---|---|
| `lib/graph-contract/src/index.ts` | Yes — as-is | `shared/graph/contract.ts` or equivalent shared layer | No changes needed |
| `api-server/lib/graph/transform.ts` | Yes — as-is | Backend graph service module | Pure functions, zero dependencies |
| `api-server/lib/graph/db.ts` | Yes — adapt | Backend graph service module | Replace `EXT_*` env vars with SciBlock's own DB config; pool settings may need tuning |
| `api-server/routes/graph.ts` | Yes — adapt | Backend API router | Adjust middleware chain to SciBlock's Express/Fastify setup |
| `api-server/lib/graph/types.ts` | Partial | Re-export contract; keep DB row types in backend only | `ExperimentRecordRow` and `RawModule` stay backend-internal |
| `graph-lab/api/graphApi.ts` | Yes — adapt | Frontend graph API client | Replace `/api` base path with SciBlock's API client setup |
| `graph-lab/utils/graphLayout.ts` | Yes — as-is | Frontend graph utilities | Zero external dependencies beyond `@dagrejs/dagre` |
| `graph-lab/components/lineage/` | Yes — as-is | Frontend component library | Requires `@xyflow/react` |
| `graph-lab/components/snapshot/` | Yes — as-is | Frontend component library | Requires `@xyflow/react` |
| `graph-lab/components/shared/` | Yes — as-is | Frontend component library | Tailwind only |
| `graph-lab/pages/GraphLabPage.tsx` | No | — | graph-lab test harness; replace with SciBlock's page component |
| `graph-lab/api/types.ts` | No | — | Local re-export shim; replace with direct import from shared contract |

---

## 3. Recommended Target Layer Structure in SciBlock

```
[Backend]
  services/graph/
    contract.ts          ← migrated from lib/graph-contract (or import shared package)
    db.ts                ← migrated from api-server/lib/graph/db.ts
    transform.ts         ← migrated from api-server/lib/graph/transform.ts
  routes/
    graph.ts             ← migrated from api-server/routes/graph.ts

[Frontend]
  shared/graph/
    contract.ts          ← same types, imported or co-located
    graphApi.ts          ← migrated from graph-lab/api/graphApi.ts
    graphLayout.ts       ← migrated from graph-lab/utils/graphLayout.ts
    components/
      lineage/           ← migrated from graph-lab/components/lineage/
      snapshot/          ← migrated from graph-lab/components/snapshot/
      shared/            ← migrated from graph-lab/components/shared/
  pages/
    ExperimentGraph.tsx  ← new SciBlock page, modelled after GraphLabPage.tsx
```

---

## 4. Keeping graph-lab Independent During Active Development

The module is designed to stay low-coupling throughout the development cycle:

- **No shared state** with other artifacts. graph-lab only reads from `sciblock_v2`
  via `EXT_*` credentials. It does not use the main workspace database.
- **No inter-artifact imports.** graph-lab imports only from
  `@workspace/graph-contract` (types only) and its own local files.
- **Zero writes.** db.ts contains only SELECT queries. There are no mutation
  paths anywhere in the module.
- **Versioned contract.** All breaking changes to graph types go through
  `lib/graph-contract/src/index.ts` first and require both api-server and
  graph-lab to be updated together.

To add or change graph behaviour: edit `transform.ts` (logic) or
`db.ts` (query fields) — never the contract directly unless the API
surface itself needs to change.

---

## 5. DB Connection Governance (Integration Checklist)

When migrating `db.ts` into SciBlock:

- [ ] Replace `EXT_DB_*` env vars with SciBlock's own DB config mechanism.
- [ ] Tune `max` pool size to match the target DB's `max_connections` ceiling
      (current value: 4, suitable for external read-only replica).
- [ ] Verify `statement_timeout` is appropriate for production query patterns.
- [ ] Confirm `idleTimeoutMillis` aligns with SciBlock's connection keep-alive
      strategy (e.g. RDS proxy or PgBouncer may already handle this).
- [ ] If the target environment uses a connection proxy (PgBouncer, RDS Proxy),
      disable `idleTimeoutMillis` (set to 0) to let the proxy manage idle state.
- [ ] Remove or adapt the `SET statement_timeout` call if SciBlock enforces this
      at the DB server level instead of per-connection.

---

## 6. What MUST NOT Change During Migration

- `ExperimentRecordRow` and `RawModule` must remain backend-internal.
  They are not part of the API contract and must never appear in API responses.
- The `data` module must always be sourced from `current_modules`, regardless
  of the record's confirmation state. This is a SciBlock domain rule, not a bug.
- Node IDs use the format `<record_id>__<module_key>`. This format must not
  change — it is stable, collision-free, and used by the layout and edge system.
