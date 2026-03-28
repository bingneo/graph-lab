/**
 * API Layer — routes/graph.ts
 *
 * GET /api/graph/lineage?sci_note_id=<id>
 *   Returns a Lineage Graph for all experiment_records under a given sci_note_id.
 *
 * GET /api/graph/snapshot?record_id=<id>
 *   Returns a Mechanism Snapshot Graph for a single experiment_record.
 *
 * GET /api/graph/module-detail?record_id=<id>&module_key=<key>
 *   Returns structured detail for one module of one experiment_record.
 *   module_key must be one of: system | preparation | operation | measurement | data
 *
 * GET /api/graph/parameters?sci_note_id=<id>
 *   Returns a ParameterGraph — parameter-centric aggregation of all records.
 *   Extracts operation step params and preparation item attributes.
 *   All rules are read-only; no new tables required.
 *
 * All routes are strictly read-only. No writes, no migrations, no other tables.
 */

import { Router, type IRouter } from "express";
import { fetchRecordsBySciNoteId, fetchRecordById, fetchSciNoteTitle } from "../lib/graph/db.js";
import {
  buildLineageGraph,
  buildMechanismSnapshotGraph,
  buildModuleDetail,
} from "../lib/graph/transform.js";
import { buildParameterGraph } from "../lib/graph/parameterExtract.js";
import { buildMechanismChainGraph } from "../lib/graph/mechanismChain.js";
import type { ModuleKey } from "../lib/graph/types.js";

const router: IRouter = Router();

const VALID_MODULE_KEYS: ReadonlySet<string> = new Set([
  "system",
  "preparation",
  "operation",
  "measurement",
  "data",
]);

// ─── GET /api/graph/lineage ────────────────────────────────────────────────────

router.get("/graph/lineage", async (req, res) => {
  const sciNoteId = req.query.sci_note_id;

  if (typeof sciNoteId !== "string" || sciNoteId.trim() === "") {
    res.status(400).json({
      ok: false,
      error: "Missing required query parameter: ?sci_note_id=<uuid>",
    });
    return;
  }

  try {
    const rows = await fetchRecordsBySciNoteId(sciNoteId.trim());

    if (rows.length === 0) {
      res.status(404).json({
        ok: false,
        error: `No non-deleted experiment_records found for sci_note_id="${sciNoteId}".`,
      });
      return;
    }

    const graph = buildLineageGraph(sciNoteId.trim(), rows);
    res.status(200).json({ ok: true, data: graph });
  } catch (err) {
    res.status(500).json({ ok: false, error: `DB error: ${(err as Error).message}` });
  }
});

// ─── GET /api/graph/snapshot ───────────────────────────────────────────────────

router.get("/graph/snapshot", async (req, res) => {
  const recordId = req.query.record_id;

  if (typeof recordId !== "string" || recordId.trim() === "") {
    res.status(400).json({
      ok: false,
      error: "Missing required query parameter: ?record_id=<uuid>",
    });
    return;
  }

  try {
    const row = await fetchRecordById(recordId.trim());

    if (!row) {
      res.status(404).json({
        ok: false,
        error: `experiment_record not found or is deleted: id="${recordId}".`,
      });
      return;
    }

    const graph = buildMechanismSnapshotGraph(row);
    res.status(200).json({ ok: true, data: graph });
  } catch (err) {
    res.status(500).json({ ok: false, error: `DB error: ${(err as Error).message}` });
  }
});

// ─── GET /api/graph/module-detail ─────────────────────────────────────────────

router.get("/graph/module-detail", async (req, res) => {
  const recordId = req.query.record_id;
  const moduleKey = req.query.module_key;

  if (typeof recordId !== "string" || recordId.trim() === "") {
    res.status(400).json({
      ok: false,
      error: "Missing required query parameter: ?record_id=<uuid>",
    });
    return;
  }

  if (typeof moduleKey !== "string" || !VALID_MODULE_KEYS.has(moduleKey)) {
    res.status(400).json({
      ok: false,
      error: `Missing or invalid ?module_key. Must be one of: ${[...VALID_MODULE_KEYS].join(", ")}`,
    });
    return;
  }

  try {
    const row = await fetchRecordById(recordId.trim());

    if (!row) {
      res.status(404).json({
        ok: false,
        error: `experiment_record not found or is deleted: id="${recordId}".`,
      });
      return;
    }

    const detail = buildModuleDetail(row, moduleKey as ModuleKey);
    res.status(200).json({ ok: true, data: detail });
  } catch (err) {
    res.status(500).json({ ok: false, error: `DB error: ${(err as Error).message}` });
  }
});

// ─── GET /api/graph/parameters ────────────────────────────────────────────────

router.get("/graph/parameters", async (req, res) => {
  const sciNoteId = req.query.sci_note_id;

  if (typeof sciNoteId !== "string" || sciNoteId.trim() === "") {
    res.status(400).json({
      ok: false,
      error: "Missing required query parameter: ?sci_note_id=<uuid>",
    });
    return;
  }

  try {
    const rows = await fetchRecordsBySciNoteId(sciNoteId.trim());

    if (rows.length === 0) {
      res.status(404).json({
        ok: false,
        error: `No non-deleted experiment_records found for sci_note_id="${sciNoteId}".`,
      });
      return;
    }

    const graph = buildParameterGraph(sciNoteId.trim(), rows);
    res.status(200).json({ ok: true, data: graph });
  } catch (err) {
    res.status(500).json({ ok: false, error: `DB error: ${(err as Error).message}` });
  }
});

// ─── GET /api/graph/mechanism-chain ──────────────────────────────────────────
//
// Returns a MechanismChainGraph for a given SciNote.
// Blocks are auto-generated via rule-based archiving (Jaccard similarity on
// system/operation/measurement fingerprints + phase-transition detection).
// The project node is virtual — bound to sci_note_id, no DB row required.
//
// NOTE: This endpoint uses the same DB fetch as /lineage and /parameters.
// It reuses fetchRecordsBySciNoteId which already filters is_deleted records.

router.get("/graph/mechanism-chain", async (req, res) => {
  const sciNoteId = req.query.sci_note_id;

  if (typeof sciNoteId !== "string" || sciNoteId.trim() === "") {
    res.status(400).json({
      ok: false,
      error: "Missing required query parameter: ?sci_note_id=<uuid>",
    });
    return;
  }

  try {
    const id = sciNoteId.trim();

    // Fetch records and sci_note title in parallel; title failure never blocks the response.
    const [rows, projectLabel] = await Promise.all([
      fetchRecordsBySciNoteId(id),
      fetchSciNoteTitle(id),
    ]);

    if (rows.length === 0) {
      res.status(404).json({
        ok: false,
        error: `No non-deleted experiment_records found for sci_note_id="${sciNoteId}".`,
      });
      return;
    }

    const graph = buildMechanismChainGraph(id, rows, projectLabel);
    res.status(200).json({ ok: true, data: graph });
  } catch (err) {
    res.status(500).json({ ok: false, error: `DB error: ${(err as Error).message}` });
  }
});

export default router;

