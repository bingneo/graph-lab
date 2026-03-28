/**
 * _devBundle.ts — DEV-only re-export hub
 *
 * This file is ONLY ever reached through a conditional dynamic import()
 * inside an `import.meta.env.DEV` block in MechanismGraphPage.tsx.
 *
 * In production:
 *   Vite replaces `import.meta.env.DEV` with the literal `false`.
 *   Every `if (false) { ... }` / `false && ...` block becomes dead code.
 *   Rollup eliminates those blocks, which removes the dynamic import() call.
 *   Because no code path in the production bundle ever calls import("_devBundle"),
 *   this file and all its re-exports (including MOCK_MECHANISM_GRAPH fixture
 *   data and MechanismDebugPanel) are excluded from the production bundle entirely.
 *
 * In development:
 *   The import() resolves to this module on first use (fast local-file load).
 *   All three debug capabilities are available as normal.
 */

export { MOCK_MECHANISM_GRAPH, MOCK_IDS } from "./mechanismDebugFixtures";
export { MechanismDebugPanel } from "./MechanismDebugPanel";
