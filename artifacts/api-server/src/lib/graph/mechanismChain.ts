/**
 * Mechanism Chain Builder — lib/graph/mechanismChain.ts
 *
 * Pure functions: no DB access, no side effects, no imports from routes/.
 *
 * Entry point: buildMechanismChainGraph(sciNoteId, records) → MechanismChainGraph
 *
 * ALGORITHM OVERVIEW
 * ──────────────────
 * 1. Sort records by lineage-aware order:
 *      topological sort (derived_from_record_id) →
 *      tie-break by sequence_number →
 *      tie-break by created_at
 *
 * 2. Extract structural fingerprints for each record:
 *      system fingerprint      = sorted set of system object names
 *      preparation fingerprint = sorted set of preparation item names
 *      operation fingerprint   = sorted set of operation step names
 *      measurement fingerprint = sorted set of measurement item names
 *      title_param key set     = sorted set of parameter dimension keys extracted
 *                                from the record title (see extractTitleParams)
 *
 * 3. Walk the sorted list, comparing each consecutive pair:
 *      compute Jaccard similarity on structural fingerprint dimensions
 *      check for phase-transition signal (confirmed → draft)
 *      check for new element introduced in prep items
 *      check for failure cluster recovery (≥3 failures → non-failure)
 *      check for title-param key-set boundary (zero overlap or qualitative new dim)
 *      if any BoundaryTrigger fires → open a new block
 *      otherwise → add record to current block
 *
 * 4. For each block:
 *      infer BlockType from position, triggers, and record distribution
 *      generate stage_label from block type + core domain terms + trigger context
 *      generate objective_summary from block type + core domain terms
 *      derive block_status from confirmation_state distribution
 *      build ExperimentSnapshot for each member record
 *
 * 5. Build project node (virtual, bound to sci_note_id).
 * 6. Build edges: project→block[0], block[0]→block[1], …
 * 7. Build archiving log (one entry per record explaining assignment).
 *
 * BLOCK BOUNDARY THRESHOLDS
 * ─────────────────────────
 * SYSTEM_THRESHOLD          = 0.50  — Jaccard of system object names
 * PREPARATION_THRESHOLD     = 0.40  — Jaccard of preparation item names
 * OPERATION_THRESHOLD       = 0.50  — Jaccard of operation step names
 * MEASUREMENT_THRESHOLD     = 0.40  — Jaccard of measurement item names
 * FAILURE_CLUSTER_MIN_SIZE  = 3     — min failures before recovery triggers new block
 *
 * TITLE PARAM KEY BOUNDARY RULES (conservative, structure-first)
 * ───────────────────────────────────────────────────────────────
 * Rule 1 (key-set divergence): both consecutive records have ≥1 extracted
 *   param, and the intersection of their param-key sets is empty (Jaccard=0).
 *   Catches a complete shift in what kind of parameter is being varied.
 *
 * Rule 2 (first failure in block): current record is experiment_status=失败,
 *   its title contains failure keywords, and the current block has had zero
 *   failures so far. Catches the onset of a failure investigation cluster.
 *
 * Rule 3 (qualitative new dimension): current record introduces a param key
 *   from the QUALITATIVE_KEYS set (gradient, rocking, furnace_fluctuation)
 *   for the first time in the current block. Catches qualitatively new
 *   experimental capabilities appearing mid-block.
 *
 * These are tunable constants; they do not affect the type contract.
 */

import type {
  MechanismChainGraph,
  ChainProjectNode,
  MechanismBlock,
  BlockStatus,
  BlockType,
  BoundaryTrigger,
  BlockArchiveSignals,
  ExperimentSnapshot,
  ChainEdge,
  ArchivingLogEntry,
  SystemObject,
  PrepItem,
  OperationStep,
  MeasurementItem,
  DataItem,
  DataSource,
} from "./types.js";
import type { ExperimentRecordRow, RawModule } from "./types.js";

// ─── Tunable Constants ────────────────────────────────────────────────────────

const SIMILARITY_THRESHOLDS = {
  system: 0.5,
  preparation: 0.4,
  operation: 0.5,
  measurement: 0.4,
} as const;

const FAILURE_CLUSTER_MIN_SIZE = 3;

/**
 * Parameter keys that represent qualitative new experimental dimensions.
 * When one of these keys appears in a record for the first time within the
 * current block, it signals a new research capability — even if structural
 * fingerprints haven't changed.
 */
const QUALITATIVE_KEYS: ReadonlySet<string> = new Set([
  "gradient",
  "rocking",
  "furnace_fluctuation",
]);

// ─── Types (internal only) ────────────────────────────────────────────────────

interface RecordFingerprint {
  /** Pipe-separated sorted unique system object names. */
  system: string;
  /** Pipe-separated sorted unique preparation item names. */
  preparation: string;
  /** Pipe-separated sorted unique operation step names. */
  operation: string;
  /** Pipe-separated sorted unique measurement item names. */
  measurement: string;
}

interface RawGroup {
  records: ExperimentRecordRow[];
  fingerprint: RecordFingerprint;
  /** Boundary triggers that opened this block (the reason the last group ended). */
  triggers: BoundaryTrigger[];
  /** Pipe-separated sorted set of title-param KEY names seen across all records. */
  titleParamsFingerprint: string;
}

// ─── 1. Lineage-Aware Sort ────────────────────────────────────────────────────

function sortRecordsByLineage(records: ExperimentRecordRow[]): ExperimentRecordRow[] {
  if (records.length <= 1) return [...records];

  const recordMap = new Map<string, ExperimentRecordRow>(records.map(r => [r.id, r]));
  const inDegree = new Map<string, number>(records.map(r => [r.id, 0]));
  const children = new Map<string, string[]>(records.map(r => [r.id, []]));

  for (const record of records) {
    const parentId = record.derived_from_record_id;
    if (parentId && recordMap.has(parentId)) {
      inDegree.set(record.id, (inDegree.get(record.id) ?? 0) + 1);
      children.get(parentId)!.push(record.id);
    }
  }

  const bySeqTime = (a: ExperimentRecordRow, b: ExperimentRecordRow): number => {
    const seqDiff = (a.sequence_number ?? 0) - (b.sequence_number ?? 0);
    if (seqDiff !== 0) return seqDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  };

  const queue: ExperimentRecordRow[] = records
    .filter(r => (inDegree.get(r.id) ?? 0) === 0)
    .sort(bySeqTime);

  const sorted: ExperimentRecordRow[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const childIds = children.get(current.id) ?? [];
    const readyChildren: ExperimentRecordRow[] = [];

    for (const childId of childIds) {
      const newDeg = (inDegree.get(childId) ?? 1) - 1;
      inDegree.set(childId, newDeg);
      if (newDeg === 0) {
        readyChildren.push(recordMap.get(childId)!);
      }
    }

    for (const child of readyChildren.sort(bySeqTime)) {
      const insertAt = queue.findIndex(q => bySeqTime(child, q) < 0);
      if (insertAt === -1) {
        queue.push(child);
      } else {
        queue.splice(insertAt, 0, child);
      }
    }
  }

  if (sorted.length < records.length) {
    const sortedIds = new Set(sorted.map(r => r.id));
    const remaining = records.filter(r => !sortedIds.has(r.id)).sort(bySeqTime);
    sorted.push(...remaining);
  }

  return sorted;
}

// ─── 2. Module Resolution ─────────────────────────────────────────────────────

function resolveModules(
  record: ExperimentRecordRow,
): { modules: RawModule[]; source: DataSource } {
  if (record.confirmation_state !== "draft" && (record.confirmed_modules?.length ?? 0) > 0) {
    return { modules: record.confirmed_modules!, source: "confirmed_modules" };
  }
  return { modules: record.current_modules ?? [], source: "current_modules" };
}

function findModule(modules: RawModule[], key: string): RawModule | undefined {
  return modules.find(m => m.key === key);
}

// ─── 3. Structural Fingerprint Extraction ─────────────────────────────────────

function toNameList(items: unknown[]): string[] {
  return items
    .map(item => String((item as Record<string, unknown>)?.name ?? "").trim())
    .filter(Boolean);
}

function makeFingerprint(names: string[]): string {
  return [...new Set(names)].sort().join("|");
}

function extractFingerprint(record: ExperimentRecordRow): RecordFingerprint {
  const { modules } = resolveModules(record);
  const sysMod = findModule(modules, "system");
  const prepMod = findModule(modules, "preparation");
  const opMod = findModule(modules, "operation");
  const measMod = findModule(modules, "measurement");

  const systemNames = toNameList(
    (sysMod?.structuredData?.systemObjects as unknown[]) ?? [],
  );
  const prepNames = toNameList(
    (prepMod?.structuredData?.prepItems as unknown[]) ?? [],
  );
  const stepNames = toNameList(
    (opMod?.structuredData?.operationSteps as unknown[]) ?? [],
  );
  const measNames = toNameList(
    (measMod?.structuredData?.measurementItems as unknown[]) ?? [],
  );

  return {
    system: makeFingerprint(systemNames),
    preparation: makeFingerprint(prepNames),
    operation: makeFingerprint(stepNames),
    measurement: makeFingerprint(measNames),
  };
}

// ─── 4. Title Parameter Extraction (Pure Functions) ───────────────────────────

/**
 * inferFailureSignals — extract failure event keyword codes from a title.
 *
 * Pure function; no side effects.
 * Used internally by extractTitleParams.
 */
export function inferFailureSignals(title: string): string[] {
  const FAILURE_KEYWORD_MAP: Array<[string, string]> = [
    ["爆裂", "crack"],
    ["破裂", "crack"],
    ["强制风冷", "forced_cooling"],
    ["断电", "forced_cooling"],
    ["杂质", "impurity"],
    ["污染", "impurity"],
    ["异常操作", "abnormal_op"],
    ["异常", "abnormal_op"],
  ];
  const found = new Set<string>();
  for (const [kw, code] of FAILURE_KEYWORD_MAP) {
    if (title.includes(kw)) found.add(code);
  }
  return [...found].sort();
}

/**
 * normalizeTitleTokens — convert an extracted-param Map to a pipe-separated
 * "key:value" fingerprint string (sorted, deterministic).
 *
 * Pure function; no side effects.
 * Used for debug/archiving; the key-set-only variant is preferred for
 * boundary logic (see extractTitleParams).
 */
export function normalizeTitleTokens(params: Map<string, string>): string {
  if (params.size === 0) return "";
  return [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("|");
}

/**
 * extractTitleParams — extract key-value parameter pairs from a record title.
 *
 * Extraction is PURELY rule-based (regex + keyword matching).
 * Structured module data is always consulted first by the caller; this function
 * only supplements when structured fields are empty (e.g. operation step params
 * all empty, preparation attributes all "未提及").
 *
 * Extracted dimensions:
 *   ratio           — In/Se molar ratio (In0.51Se0.49, or 比例0.5：0.5)
 *   synth_temp      — synthesis temperature (合成温度：700℃)
 *   grow_temp       — growth temperature (生长温度：700℃)
 *   temp            — combined synth+growth temperature (合成生长温度：740℃)
 *   speed           — descent speed in mm/h (下降速度：0.4mm/h)
 *   gradient        — temperature gradient in ℃/cm (温度梯度25℃/cm)
 *   rocking         — rocking furnace speed in r/min (摇摆炉25r/min)
 *   failure_event   — failure phenomenon codes (see inferFailureSignals)
 *   batch_variant   — different raw material batch (不同批次)
 *   furnace_fluctuation — furnace temperature fluctuation (炉温波动±5℃)
 *
 * Pure function; no side effects.
 */
export function extractTitleParams(title: string): Map<string, string> {
  const params = new Map<string, string>();
  if (!title || !title.trim()) return params;

  // ── Ratio ──────────────────────────────────────────────────────────────────
  // Format A: compact — In0.51Se0.49 (with optional Sn/Te etc.)
  const compactRatioMatch = title.match(/In(\d+\.\d+)Se(\d+\.\d+)/);
  if (compactRatioMatch) {
    params.set("ratio", `${compactRatioMatch[1]}:${compactRatioMatch[2]}`);
  } else {
    // Format B: verbose — "In Se元素比例0.5：0.5" or "In Se比例为0.51：0.49"
    const verboseRatioMatch = title.match(/In\s*Se.*?(\d+\.?\d*)[\s:：](\d+\.?\d*)/);
    if (verboseRatioMatch) {
      params.set("ratio", `${verboseRatioMatch[1]}:${verboseRatioMatch[2]}`);
    }
  }

  // ── Temperature ────────────────────────────────────────────────────────────
  // "合成生长温度" (combined) takes priority over separate synth/grow
  const combinedTempMatch = title.match(/合成生长温度[：:\s]*(\d+)\s*℃/);
  if (combinedTempMatch) {
    params.set("temp", combinedTempMatch[1]);
  } else {
    const synthTempMatch = title.match(/合成温度[：:\s]*(\d+)\s*℃/);
    if (synthTempMatch) params.set("synth_temp", synthTempMatch[1]);

    const growTempMatch = title.match(/生长温度[：:\s]*(\d+)\s*℃/);
    if (growTempMatch) params.set("grow_temp", growTempMatch[1]);
  }

  // ── Descent Speed ──────────────────────────────────────────────────────────
  const speedMatch = title.match(/(\d+\.?\d*)mm\/h/);
  if (speedMatch) params.set("speed", speedMatch[1]);

  // ── Temperature Gradient ───────────────────────────────────────────────────
  const gradientMatch = title.match(/温度梯度(\d+)℃/);
  if (gradientMatch) params.set("gradient", gradientMatch[1]);

  // ── Rocking Furnace ────────────────────────────────────────────────────────
  const rockingMatch = title.match(/摇摆炉(\d+)r\/min/);
  if (rockingMatch) params.set("rocking", rockingMatch[1]);

  // ── Failure Events ─────────────────────────────────────────────────────────
  const failureCodes = inferFailureSignals(title);
  if (failureCodes.length > 0) {
    params.set("failure_event", failureCodes.join("|"));
  }

  // ── Batch Variant ──────────────────────────────────────────────────────────
  if (title.includes("不同批次")) {
    params.set("batch_variant", "true");
  }

  // ── Furnace Temperature Fluctuation ───────────────────────────────────────
  const fluctuationMatch = title.match(/炉温波动[±+\-]?(\d+)/);
  if (fluctuationMatch) params.set("furnace_fluctuation", fluctuationMatch[1]);

  return params;
}

/**
 * detectNewElements — compare prep item names against globally seen names.
 *
 * Returns names of any preparation items in this record that have NOT been
 * seen in any previously-processed record within this sci_note.
 *
 * seenElementNames is read-only here; callers update it via gatherPrepElementNames.
 *
 * Pure function (does not mutate seenElementNames).
 */
export function detectNewElements(
  record: ExperimentRecordRow,
  seenElementNames: ReadonlySet<string>,
): string[] {
  const { modules } = resolveModules(record);
  const prepMod = findModule(modules, "preparation");
  if (!prepMod) return [];

  const items = (prepMod.structuredData?.prepItems as unknown[]) ?? [];
  const newElements: string[] = [];

  for (const item of items) {
    const it = item as Record<string, unknown>;
    const name = String(it.name ?? "").trim();
    if (name && !seenElementNames.has(name)) {
      newElements.push(name);
    }
  }
  return newElements;
}

/**
 * gatherPrepElementNames — add all prep item names from a record to the set.
 * Mutates seenElementNames (used by the grouping loop).
 */
function gatherPrepElementNames(
  record: ExperimentRecordRow,
  seenElementNames: Set<string>,
): void {
  const { modules } = resolveModules(record);
  const prepMod = findModule(modules, "preparation");
  if (!prepMod) return;
  const items = (prepMod.structuredData?.prepItems as unknown[]) ?? [];
  for (const item of items) {
    const it = item as Record<string, unknown>;
    const name = String(it.name ?? "").trim();
    if (name) seenElementNames.add(name);
  }
}

/**
 * titleParamsBoundaryFired — decide whether title-parameter evidence alone
 * warrants a new block boundary.
 *
 * Three conservative rules (structure-first: only fires when structural
 * fingerprints did not already fire):
 *
 *   Rule 1 (key-set divergence): both sides have ≥1 extracted key, and the
 *     two key sets share zero keys.  Detects a complete shift in what is
 *     being varied — e.g. "ratio-only" records followed by "temperature-only".
 *
 *   Rule 2 (first failure onset): current record is 失败, its title contains
 *     a failure event keyword, and the current block has had 0 failures so
 *     far.  Detects the start of a failure investigation sub-phase.
 *
 *   Rule 3 (qualitative new dimension): current record introduces a key from
 *     QUALITATIVE_KEYS (gradient, rocking, furnace_fluctuation) that has not
 *     been seen at all in the current block so far.  Detects adoption of a
 *     qualitatively new experimental technique within an otherwise stable block.
 *
 * Pure function (all inputs are read-only).
 */
function titleParamsBoundaryFired(
  curr: ExperimentRecordRow,
  prevParams: Map<string, string>,
  currParams: Map<string, string>,
  blockFailureCount: number,
  blockAccumParamKeys: ReadonlySet<string>,
): boolean {
  // Rule 1: zero key-set overlap between two non-empty consecutive param sets
  if (prevParams.size > 0 && currParams.size > 0) {
    const prevKeys = new Set(prevParams.keys());
    const currKeys = [...currParams.keys()];
    const sharedCount = currKeys.filter(k => prevKeys.has(k)).length;
    if (sharedCount === 0) return true;
  }

  // Rule 2: first failure onset in block
  if (
    curr.experiment_status === "失败" &&
    blockFailureCount === 0 &&
    currParams.has("failure_event")
  ) {
    return true;
  }

  // Rule 3: qualitative new parameter dimension appears for first time in block
  for (const key of currParams.keys()) {
    if (QUALITATIVE_KEYS.has(key) && !blockAccumParamKeys.has(key)) {
      return true;
    }
  }

  return false;
}

// ─── 5. Jaccard Similarity ────────────────────────────────────────────────────

function jaccardSimilarity(fpA: string, fpB: string): number {
  if (fpA === fpB) return 1.0;

  const setA = new Set(fpA.split("|").filter(Boolean));
  const setB = new Set(fpB.split("|").filter(Boolean));

  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionSize++;
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 1.0 : intersectionSize / unionSize;
}

// ─── 6. Boundary Detection ────────────────────────────────────────────────────

function detectBoundaryTriggers(
  prev: ExperimentRecordRow,
  curr: ExperimentRecordRow,
  prevFp: RecordFingerprint,
  currFp: RecordFingerprint,
  blockFailureCount: number,
  seenElementNames: ReadonlySet<string>,
  blockAccumParamKeys: ReadonlySet<string>,
): BoundaryTrigger[] {
  const triggers: BoundaryTrigger[] = [];

  // ── Structural fingerprint triggers (original) ─────────────────────────────
  if (jaccardSimilarity(prevFp.system, currFp.system) < SIMILARITY_THRESHOLDS.system) {
    triggers.push("system_changed");
  }
  if (jaccardSimilarity(prevFp.preparation, currFp.preparation) < SIMILARITY_THRESHOLDS.preparation) {
    triggers.push("preparation_changed");
  }
  if (jaccardSimilarity(prevFp.operation, currFp.operation) < SIMILARITY_THRESHOLDS.operation) {
    triggers.push("operation_changed");
  }
  if (
    jaccardSimilarity(prevFp.measurement, currFp.measurement) <
    SIMILARITY_THRESHOLDS.measurement
  ) {
    triggers.push("measurement_changed");
  }
  if (prev.confirmation_state === "confirmed" && curr.confirmation_state === "draft") {
    triggers.push("phase_transition");
  }

  // ── New element introduced (prep layer) ───────────────────────────────────
  const newElems = detectNewElements(curr, seenElementNames);
  if (newElems.length > 0) {
    triggers.push("new_element_introduced");
  }

  // ── Failure cluster recovery ───────────────────────────────────────────────
  if (blockFailureCount >= FAILURE_CLUSTER_MIN_SIZE && curr.experiment_status !== "失败") {
    triggers.push("failure_cluster_recovery");
  }

  // ── Title-param boundary (supplement — runs even when structural fired) ────
  const prevParams = extractTitleParams(prev.title ?? "");
  const currParams = extractTitleParams(curr.title ?? "");
  if (titleParamsBoundaryFired(curr, prevParams, currParams, blockFailureCount, blockAccumParamKeys)) {
    triggers.push("title_param_changed");
  }

  return triggers;
}

function buildBoundaryReason(
  triggers: BoundaryTrigger[],
  prevFp: RecordFingerprint,
  currFp: RecordFingerprint,
): string {
  if (triggers.includes("first_block")) return "链头节点（主链起点）";

  const parts: string[] = [];
  if (triggers.includes("system_changed")) {
    const sim = jaccardSimilarity(prevFp.system, currFp.system);
    parts.push(`实验系统变化（Jaccard=${sim.toFixed(2)}）`);
  }
  if (triggers.includes("preparation_changed")) {
    const sim = jaccardSimilarity(prevFp.preparation, currFp.preparation);
    parts.push(`实验准备变化（Jaccard=${sim.toFixed(2)}）`);
  }
  if (triggers.includes("operation_changed")) {
    const sim = jaccardSimilarity(prevFp.operation, currFp.operation);
    parts.push(`操作方法变化（Jaccard=${sim.toFixed(2)}）`);
  }
  if (triggers.includes("measurement_changed")) {
    const sim = jaccardSimilarity(prevFp.measurement, currFp.measurement);
    parts.push(`测量路径变化（Jaccard=${sim.toFixed(2)}）`);
  }
  if (triggers.includes("phase_transition")) {
    parts.push("研发阶段跃迁（confirmed→draft）");
  }
  if (triggers.includes("new_element_introduced")) {
    parts.push("新元素引入（准备材料中出现新物质）");
  }
  if (triggers.includes("failure_cluster_recovery")) {
    parts.push(`失败群落后回复（连续≥${FAILURE_CLUSTER_MIN_SIZE}次失败后转为非失败）`);
  }
  if (triggers.includes("title_param_changed")) {
    parts.push("标题参数结构发生质变（参数维度完全转换或新实验手段出现）");
  }
  return parts.join("；");
}

// ─── 7. Grouping Walk ─────────────────────────────────────────────────────────

function groupRecordsIntoBlocks(sorted: ExperimentRecordRow[]): RawGroup[] {
  const groups: RawGroup[] = [];
  let currentRecords: ExperimentRecordRow[] = [sorted[0]];
  let prevFp = extractFingerprint(sorted[0]);
  let currentTriggers: BoundaryTrigger[] = ["first_block"];

  // ── Global state: tracks all prep element names seen across ALL blocks ─────
  // Initialised with first record; triggers fire BEFORE curr is added.
  const seenElementNames = new Set<string>();
  gatherPrepElementNames(sorted[0], seenElementNames);

  // ── Per-block state (reset when a new block opens) ────────────────────────
  let blockFailureCount = sorted[0].experiment_status === "失败" ? 1 : 0;
  const firstParams = extractTitleParams(sorted[0].title ?? "");
  let blockAccumParamKeys = new Set<string>(firstParams.keys());

  // Accumulate title-param keys for first block
  let currentBlockParamKeys = new Set<string>(firstParams.keys());

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const prev = sorted[i - 1];
    const currFp = extractFingerprint(curr);
    const currParams = extractTitleParams(curr.title ?? "");

    const triggers = detectBoundaryTriggers(
      prev,
      curr,
      prevFp,
      currFp,
      blockFailureCount,
      seenElementNames,
      blockAccumParamKeys,
    );

    if (triggers.length > 0) {
      // Close current block, recording its title-param key fingerprint
      groups.push({
        records: currentRecords,
        fingerprint: prevFp,
        triggers: currentTriggers,
        titleParamsFingerprint: [...currentBlockParamKeys].sort().join("|"),
      });

      // Open new block
      currentRecords = [curr];
      currentTriggers = triggers;

      // Reset per-block state
      blockFailureCount = curr.experiment_status === "失败" ? 1 : 0;
      blockAccumParamKeys = new Set<string>(currParams.keys());
      currentBlockParamKeys = new Set<string>(currParams.keys());
    } else {
      currentRecords.push(curr);
      blockFailureCount += curr.experiment_status === "失败" ? 1 : 0;
      for (const key of currParams.keys()) blockAccumParamKeys.add(key);
      for (const key of currParams.keys()) currentBlockParamKeys.add(key);
    }

    // Update global element tracking AFTER trigger detection (so curr's new
    // elements are considered "new" when detecting the boundary above).
    gatherPrepElementNames(curr, seenElementNames);
    prevFp = currFp;
  }

  groups.push({
    records: currentRecords,
    fingerprint: prevFp,
    triggers: currentTriggers,
    titleParamsFingerprint: [...currentBlockParamKeys].sort().join("|"),
  });
  return groups;
}

// ─── 8. Block Status Derivation ───────────────────────────────────────────────

function deriveBlockStatus(records: ExperimentRecordRow[]): BlockStatus {
  const states = new Set(records.map(r => r.confirmation_state));
  if (states.has("confirmed_dirty")) return "mixed";
  const hasConfirmed = states.has("confirmed");
  const hasDraft = states.has("draft");
  if (hasConfirmed && !hasDraft) return "archived";
  if (hasConfirmed && hasDraft) return "consolidating";
  return "exploring";
}

// ─── 9. Block Type Inference ──────────────────────────────────────────────────

/**
 * Infer the semantic research-stage type for a block.
 *
 * Priority order:
 *   1. First block in chain                → initial_setup
 *   2. Last block + all confirmed          → result_confirmation
 *   3. New element or failure recovery     → condition_exploration (new direction)
 *   4. Title-param changed with high failure rate → condition_exploration
 *   5. Title-param changed + no struct chg → parameter_optimization
 *   6. Only measurement changed            → measurement_validation
 *   7. Only operation changed (±prep)      → parameter_optimization
 *   8. Phase transition + all draft + many records → repeat_validation
 *   9. High intra-block similarity + 3+   → repeat_validation
 *  10. All draft                           → condition_exploration
 *  11. Default                             → mixed_progression
 */
function inferBlockType(
  stageIndex: number,
  totalBlocks: number,
  triggers: BoundaryTrigger[],
  records: ExperimentRecordRow[],
  fingerprint: RecordFingerprint,
): BlockType {
  // Rule 1: first block is always the initial setup
  if (stageIndex === 1) return "initial_setup";

  // Rule 2: last block with all confirmed = result confirmation
  if (stageIndex === totalBlocks && records.every(r => r.confirmation_state === "confirmed")) {
    return "result_confirmation";
  }

  const hasMeas = triggers.includes("measurement_changed");
  const hasSys = triggers.includes("system_changed");
  const hasOp = triggers.includes("operation_changed");
  const hasPhase = triggers.includes("phase_transition");
  const hasNewElem = triggers.includes("new_element_introduced");
  const hasRecovery = triggers.includes("failure_cluster_recovery");
  const hasTitleParam = triggers.includes("title_param_changed");

  // Rule 3: new element or failure recovery → new exploration direction
  if (hasNewElem || hasRecovery) return "condition_exploration";

  // Rule 4: title-param changed + no structural module change
  if (hasTitleParam && !hasSys && !hasOp) {
    // phase_transition (confirmed→draft) means a new exploration wave
    if (hasPhase) return "condition_exploration";
    const failureCount = records.filter(r => r.experiment_status === "失败").length;
    if (failureCount / records.length >= 0.5) return "condition_exploration";
    return "parameter_optimization";
  }

  // Rule 5: measurement dimension changed only (not system / operation)
  if (hasMeas && !hasSys && !hasOp) return "measurement_validation";

  // Rule 6: operation changed but NOT system (core apparatus unchanged)
  if (hasOp && !hasSys) return "parameter_optimization";

  // Rule 7: phase transition + all draft + multiple records → fresh exploration wave
  if (hasPhase && records.every(r => r.confirmation_state === "draft") && records.length >= 2) {
    return "repeat_validation";
  }

  // Rule 8: 3+ records with high intra-block fingerprint similarity → repeat pattern
  if (records.length >= 3) {
    const highSimilarityCount = records.filter(r => {
      const fp = extractFingerprint(r);
      return (
        jaccardSimilarity(fp.operation, fingerprint.operation) >= 0.75 &&
        jaccardSimilarity(fp.system, fingerprint.system) >= 0.75
      );
    }).length;
    if (highSimilarityCount >= records.length * 0.8) return "repeat_validation";
  }

  // Rule 9: all draft with no confirmed → condition exploration
  if (records.every(r => r.confirmation_state === "draft")) return "condition_exploration";

  // Default catch-all
  return "mixed_progression";
}

// ─── 10. Block Title Generation ───────────────────────────────────────────────

/**
 * Generate a semantically meaningful stage title.
 *
 * Priority:
 *   1. Trigger-aware phrases (new element, failure recovery, gradient, rocking)
 *   2. Block-type-aware phrase from fingerprint domain terms
 *   3. Generic fallback
 *
 * Output is used as the human-readable part of stage_label:
 *   stage_label = "阶段 N：{generateBlockTitle(...)}"
 *
 * CONSTRAINT: do NOT concatenate raw parameter values into the title.
 * The label must read like a stage name, not a parameter dump.
 */
function generateBlockTitle(
  blockType: BlockType,
  fingerprint: RecordFingerprint,
  triggers: BoundaryTrigger[],
  titleParamKeys: ReadonlySet<string>,
): string {
  const opNames = fingerprint.operation.split("|").filter(Boolean);
  const sysNames = fingerprint.system.split("|").filter(Boolean);
  const measNames = fingerprint.measurement.split("|").filter(Boolean);

  const firstOp = opNames[0] ?? "";
  const firstSys = sysNames[0] ?? "";
  const firstMeas = measNames[0] ?? "";

  // ── Trigger-specific titles (highest priority) ─────────────────────────────
  if (triggers.includes("new_element_introduced") || triggers.includes("failure_cluster_recovery")) {
    return "新体系条件探索";
  }

  // Gradient introduced → qualitative new technique
  if (titleParamKeys.has("gradient") && triggers.includes("title_param_changed")) {
    return "温度梯度工艺探索";
  }

  // ── Block-type-aware titles ────────────────────────────────────────────────
  switch (blockType) {
    case "initial_setup":
      if (firstOp) return `${firstOp}对照实验建立`;
      if (firstSys) return `${firstSys}体系建立`;
      return "对照实验建立";

    case "condition_exploration":
      if (titleParamKeys.has("failure_event")) return "工艺失效原因探究";
      if (firstOp) return `${firstOp}条件探索`;
      if (firstSys) return `${firstSys}条件探索`;
      return "初始条件探索";

    case "parameter_optimization":
      if (titleParamKeys.has("gradient")) return "温度梯度工艺优化";
      if (firstOp) return `${firstOp}参数优化`;
      if (firstSys) return `${firstSys}参数优化`;
      return "实验参数优化";

    case "repeat_validation":
      if (firstOp) return `${firstOp}重复验证`;
      if (firstSys) return `${firstSys}重复验证`;
      return "重复验证实验";

    case "measurement_validation":
      if (firstMeas) return `${firstMeas}测量验证`;
      if (firstOp) return `${firstOp}测量验证`;
      return "测量结果验证";

    case "result_confirmation":
      if (firstOp) return `${firstOp}结果确认`;
      if (firstSys) return `${firstSys}结果确认`;
      return "最终结果确认";

    case "mixed_progression":
      if (firstOp && firstSys) return `${firstSys}·${firstOp}综合推进`;
      if (firstOp) return `${firstOp}综合推进`;
      return "综合推进阶段";
  }
}

// ─── 11. Objective Summary Generation ─────────────────────────────────────────

/**
 * Generate a research-semantics-aware objective summary.
 *
 * Priority:
 *   1. purpose_input from any record in the block (free text, highest fidelity)
 *   2. Trigger-aware phrase (new element, failure recovery, gradient)
 *   3. Block-type-specific phrase + key domain terms
 *   4. Experiment codes (fallback)
 */
function buildObjectiveSummary(
  records: ExperimentRecordRow[],
  blockType: BlockType,
  fingerprint: RecordFingerprint,
  triggers: BoundaryTrigger[],
  titleParamKeys: ReadonlySet<string>,
): string {
  // Priority 1: purpose_input
  for (const record of records) {
    const p = (record as unknown as Record<string, unknown>).purpose_input;
    if (typeof p === "string" && p.trim()) return p.trim();
  }

  const opNames = fingerprint.operation.split("|").filter(Boolean).slice(0, 2);
  const sysNames = fingerprint.system.split("|").filter(Boolean).slice(0, 2);
  const measNames = fingerprint.measurement.split("|").filter(Boolean).slice(0, 2);

  // Priority 2: trigger-aware phrase
  if (triggers.includes("new_element_introduced")) {
    return opNames.length > 0
      ? `引入新材料后在 ${opNames.join("、")} 体系中探索新条件`
      : "引入新材料，开始新方向条件探索";
  }
  if (triggers.includes("failure_cluster_recovery")) {
    return opNames.length > 0
      ? `从失败中调整策略，重新探索 ${opNames.join("、")} 实验条件`
      : "从失败中调整策略，重新探索实验条件";
  }
  if (titleParamKeys.has("gradient") && triggers.includes("title_param_changed")) {
    return opNames.length > 0
      ? `在 ${opNames.join("、")} 中引入温度梯度控制，优化生长条件`
      : "引入温度梯度控制，探索精细化生长条件";
  }

  // Priority 3: type-aware phrase
  switch (blockType) {
    case "initial_setup":
      if (sysNames.length > 0) return `搭建 ${sysNames.join("、")} 对照实验体系`;
      if (opNames.length > 0) return `${opNames.join("、")} 对照实验建立`;
      break;

    case "condition_exploration":
      if (titleParamKeys.has("failure_event")) {
        return opNames.length > 0
          ? `探究 ${opNames.join("、")} 失效原因，寻找改进方向`
          : "探究工艺失效原因，寻找改进方向";
      }
      if (opNames.length > 0) return `探索 ${opNames.join("、")} 的实验条件`;
      if (sysNames.length > 0) return `探索 ${sysNames.join("、")} 的工作条件`;
      break;

    case "parameter_optimization":
      if (titleParamKeys.has("gradient")) {
        return opNames.length > 0
          ? `系统优化 ${opNames.join("、")} 温度梯度及工艺参数`
          : "系统优化温度梯度及工艺参数";
      }
      if (opNames.length > 0) return `优化 ${opNames.join("、")} 的实验参数`;
      if (sysNames.length > 0) return `${sysNames.join("、")} 参数优化研究`;
      break;

    case "repeat_validation":
      if (opNames.length > 0) return `重复验证 ${opNames.join("、")}`;
      if (sysNames.length > 0) return `${sysNames.join("、")} 实验重复验证`;
      break;

    case "measurement_validation":
      if (measNames.length > 0) return `验证 ${measNames.join("、")} 测量结果`;
      if (opNames.length > 0) return `${opNames.join("、")} 测量过程验证`;
      break;

    case "result_confirmation":
      if (opNames.length > 0) return `${opNames.join("、")} 结果确认与总结`;
      if (sysNames.length > 0) return `${sysNames.join("、")} 最终结果确认`;
      break;

    case "mixed_progression":
      if (opNames.length > 0 && sysNames.length > 0) {
        return `${sysNames[0]} 体系下 ${opNames.join("、")} 综合推进`;
      }
      if (opNames.length > 0) return opNames.join("、");
      if (sysNames.length > 0) return `${sysNames.join("、")} 综合研究`;
      break;
  }

  // Priority 4: fallback
  return records.map(r => r.experiment_code).join("、");
}

// ─── 12. Experiment Snapshot Builder ──────────────────────────────────────────

function asString(val: unknown, fallback = ""): string {
  return typeof val === "string" ? val.trim() : fallback;
}

function asNumber(val: unknown, fallback = 0): number {
  return typeof val === "number" ? val : fallback;
}

function extractSystemObjects(mod: RawModule | undefined): SystemObject[] {
  if (!mod) return [];
  const raw = (mod.structuredData?.systemObjects as unknown[]) ?? [];
  return raw.map((o, i) => {
    const obj = o as Record<string, unknown>;
    return { id: asString(obj.id, `sys_${i}`), name: asString(obj.name) };
  });
}

function extractPrepItems(mod: RawModule | undefined): PrepItem[] {
  if (!mod) return [];
  const raw = (mod.structuredData?.prepItems as unknown[]) ?? [];
  return raw.map((item, i) => {
    const it = item as Record<string, unknown>;
    const attrs = (it.attributes as unknown[]) ?? [];
    return {
      id: asString(it.id, `prep_${i}`),
      name: asString(it.name),
      category: asString(it.category),
      attributes: attrs.map(a => {
        const attr = a as Record<string, unknown>;
        return { key: asString(attr.key), value: asString(attr.value) };
      }),
    };
  });
}

function extractOperationSteps(mod: RawModule | undefined): OperationStep[] {
  if (!mod) return [];
  const raw = (mod.structuredData?.operationSteps as unknown[]) ?? [];
  return raw.map((step, i) => {
    const st = step as Record<string, unknown>;
    const params = (st.params as unknown[]) ?? [];
    return {
      id: asString(st.id, `step_${i}`),
      name: asString(st.name),
      order: asNumber(st.order, i),
      params: params.map(p => {
        const pa = p as Record<string, unknown>;
        return { key: asString(pa.key), value: asString(pa.value) };
      }),
    };
  });
}

function extractMeasurementItems(mod: RawModule | undefined): MeasurementItem[] {
  if (!mod) return [];
  const raw = (mod.structuredData?.measurementItems as unknown[]) ?? [];
  return raw.map((item, i) => {
    const it = item as Record<string, unknown>;
    const conds = (it.conditions as unknown[]) ?? [];
    return {
      id: asString(it.id, `meas_${i}`),
      name: asString(it.name),
      target: asString(it.target),
      conditions: conds.map(c => {
        const co = c as Record<string, unknown>;
        return { key: asString(co.key), value: asString(co.value) };
      }),
    };
  });
}

function extractDataItems(mod: RawModule | undefined): DataItem[] {
  if (!mod) return [];
  const raw = (mod.structuredData?.dataItems as unknown[]) ?? [];
  return raw.map((item, i) => {
    const it = item as Record<string, unknown>;
    return { id: asString(it.id, `data_${i}`), name: asString(it.name) };
  });
}

function buildExperimentSnapshot(record: ExperimentRecordRow): ExperimentSnapshot {
  const { modules, source } = resolveModules(record);

  const sysMod = findModule(modules, "system");
  const prepMod = findModule(modules, "preparation");
  const opMod = findModule(modules, "operation");
  const measMod = findModule(modules, "measurement");
  const dataMod = findModule(record.current_modules ?? [], "data");

  return {
    record_id: record.id,
    experiment_code: record.experiment_code,
    title: record.title ?? "",
    confirmation_state: record.confirmation_state,
    experiment_status: record.experiment_status,
    tags: record.tags ?? [],
    data_source: source,
    modules: {
      system: {
        title: sysMod?.title ?? "实验系统",
        objects: extractSystemObjects(sysMod),
      },
      preparation: {
        title: prepMod?.title ?? "实验准备",
        items: extractPrepItems(prepMod),
      },
      operation: {
        title: opMod?.title ?? "实验操作",
        steps: extractOperationSteps(opMod),
      },
      measurement: {
        title: measMod?.title ?? "测量过程",
        items: extractMeasurementItems(measMod),
      },
      data: {
        title: dataMod?.title ?? "实验数据",
        items: extractDataItems(dataMod),
      },
    },
  };
}

// ─── 13. Block Builder ────────────────────────────────────────────────────────

function buildBlock(
  sciNoteId: string,
  stageIndex: number,
  totalBlocks: number,
  records: ExperimentRecordRow[],
  fingerprint: RecordFingerprint,
  triggers: BoundaryTrigger[],
  titleParamsFingerprint: string,
): MechanismBlock {
  const status = deriveBlockStatus(records);
  const titleParamKeys = new Set(titleParamsFingerprint.split("|").filter(Boolean));
  const blockType = inferBlockType(stageIndex, totalBlocks, triggers, records, fingerprint);
  const titlePhrase = generateBlockTitle(blockType, fingerprint, triggers, titleParamKeys);

  const timestamps = records
    .map(r => new Date(r.created_at).getTime())
    .filter(t => !Number.isNaN(t))
    .sort((a, b) => a - b);

  const earliest =
    timestamps.length > 0
      ? new Date(timestamps[0]).toISOString()
      : records[0].created_at;
  const latest =
    timestamps.length > 0
      ? new Date(timestamps[timestamps.length - 1]).toISOString()
      : records[records.length - 1].created_at;

  const confirmationDist: Record<string, number> = {};
  const statusDist: Record<string, number> = {};
  for (const r of records) {
    confirmationDist[r.confirmation_state] =
      (confirmationDist[r.confirmation_state] ?? 0) + 1;
    statusDist[r.experiment_status] = (statusDist[r.experiment_status] ?? 0) + 1;
  }

  const archiveSignals: BlockArchiveSignals = {
    system_fingerprint: fingerprint.system,
    preparation_fingerprint: fingerprint.preparation,
    operation_fingerprint: fingerprint.operation,
    measurement_fingerprint: fingerprint.measurement,
    title_params_fingerprint: titleParamsFingerprint,
    boundary_triggers: triggers,
    confirmation_state_dist: confirmationDist,
    experiment_status_dist: statusDist,
  };

  return {
    id: `block:${sciNoteId}:${stageIndex}`,
    sci_note_id: sciNoteId,
    node_type: "block",
    stage_index: stageIndex,
    stage_label: `阶段 ${stageIndex}：${titlePhrase}`,
    objective_summary: buildObjectiveSummary(records, blockType, fingerprint, triggers, titleParamKeys),
    block_type: blockType,
    record_ids: records.map(r => r.id),
    record_count: records.length,
    block_status: status,
    created_range: { earliest, latest },
    archive_signals: archiveSignals,
    experiment_snapshots: records.map(buildExperimentSnapshot),
  };
}

// ─── 14. Project Node ─────────────────────────────────────────────────────────

function buildProjectNode(
  sciNoteId: string,
  totalRecords: number,
  totalBlocks: number,
  projectLabel?: string | null,
): ChainProjectNode {
  return {
    id: `project:${sciNoteId}`,
    sci_note_id: sciNoteId,
    node_type: "project",
    label: projectLabel?.trim() || "研发项目",
    total_records: totalRecords,
    total_blocks: totalBlocks,
  };
}

// ─── 15. Main Entry Point ─────────────────────────────────────────────────────

export function buildMechanismChainGraph(
  sciNoteId: string,
  records: ExperimentRecordRow[],
  projectLabel?: string | null,
): MechanismChainGraph {
  if (records.length === 0) {
    return {
      type: "mechanism_chain",
      sci_note_id: sciNoteId,
      project_node: buildProjectNode(sciNoteId, 0, 0, projectLabel),
      blocks: [],
      edges: [],
      archiving_log: [],
      generated_at: new Date().toISOString(),
    };
  }

  const sorted = sortRecordsByLineage(records);
  const groups = groupRecordsIntoBlocks(sorted);
  const totalBlocks = groups.length;

  const blocks: MechanismBlock[] = groups.map((g, i) =>
    buildBlock(
      sciNoteId,
      i + 1,
      totalBlocks,
      g.records,
      g.fingerprint,
      g.triggers,
      g.titleParamsFingerprint,
    ),
  );

  const projectNode = buildProjectNode(sciNoteId, records.length, blocks.length, projectLabel);

  const edges: ChainEdge[] = [];

  if (blocks.length > 0) {
    edges.push({
      id: `edge:${projectNode.id}->${blocks[0].id}`,
      source: projectNode.id,
      target: blocks[0].id,
      edge_type: "main_transition",
    });

    for (let i = 0; i < blocks.length - 1; i++) {
      edges.push({
        id: `edge:${blocks[i].id}->${blocks[i + 1].id}`,
        source: blocks[i].id,
        target: blocks[i + 1].id,
        edge_type: "main_transition",
      });
    }
  }

  const archivingLog: ArchivingLogEntry[] = [];

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const prevFp = gi > 0 ? groups[gi - 1].fingerprint : group.fingerprint;

    for (let ri = 0; ri < group.records.length; ri++) {
      const r = group.records[ri];
      const isBlockStart = ri === 0;

      archivingLog.push({
        record_id: r.id,
        experiment_code: r.experiment_code,
        assigned_block_index: gi + 1,
        boundary_triggered: isBlockStart,
        triggers: isBlockStart ? group.triggers : [],
        reason: isBlockStart
          ? buildBoundaryReason(group.triggers, prevFp, group.fingerprint)
          : "归入同阶段实验簇（无边界触发）",
      });
    }
  }

  return {
    type: "mechanism_chain",
    sci_note_id: sciNoteId,
    project_node: projectNode,
    blocks,
    edges,
    archiving_log: archivingLog,
    generated_at: new Date().toISOString(),
  };
}
