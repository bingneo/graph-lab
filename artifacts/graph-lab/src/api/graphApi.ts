import type {
  GraphApiResponse,
  LineageGraph,
  MechanismSnapshotGraph,
  ModuleDetail,
  ModuleKey,
  ParameterGraph,
  MechanismChainGraph,
} from "./types";

const API_BASE = "/api";

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const body: GraphApiResponse<T> = await res.json();
  if (!body.ok || !body.data) {
    throw new Error(body.error ?? "Unknown API error");
  }
  return body.data;
}

export async function fetchLineageGraph(sciNoteId: string): Promise<LineageGraph> {
  const url = `${API_BASE}/graph/lineage?sci_note_id=${encodeURIComponent(sciNoteId)}`;
  return apiFetch<LineageGraph>(url);
}

export async function fetchSnapshotGraph(recordId: string): Promise<MechanismSnapshotGraph> {
  const url = `${API_BASE}/graph/snapshot?record_id=${encodeURIComponent(recordId)}`;
  return apiFetch<MechanismSnapshotGraph>(url);
}

export async function fetchModuleDetail(
  recordId: string,
  moduleKey: ModuleKey
): Promise<ModuleDetail> {
  const url = `${API_BASE}/graph/module-detail?record_id=${encodeURIComponent(recordId)}&module_key=${encodeURIComponent(moduleKey)}`;
  return apiFetch<ModuleDetail>(url);
}

export async function fetchParameterGraph(sciNoteId: string): Promise<ParameterGraph> {
  const url = `${API_BASE}/graph/parameters?sci_note_id=${encodeURIComponent(sciNoteId)}`;
  return apiFetch<ParameterGraph>(url);
}

export async function fetchMechanismChain(sciNoteId: string): Promise<MechanismChainGraph> {
  const url = `${API_BASE}/graph/mechanism-chain?sci_note_id=${encodeURIComponent(sciNoteId)}`;
  return apiFetch<MechanismChainGraph>(url);
}
