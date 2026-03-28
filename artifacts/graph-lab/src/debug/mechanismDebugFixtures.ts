/**
 * mechanismDebugFixtures.ts
 *
 * Rich mock MechanismChainGraph for development / demo / validation use.
 * Never imported in production paths — only referenced from debug utilities.
 *
 * Graph covers:
 *   5 blocks × all 5 distinct block types × 3 distinct statuses
 *   Tags include: 失败, 已验证, 可复现, 探索中
 *   → Enough to exercise all filter dimensions, compare mode, and all dialogs.
 */

import type {
  MechanismChainGraph,
  ExperimentSnapshot,
  SystemObject,
  PrepItem,
  OperationStep,
  MeasurementItem,
} from "@/api/types";

// ─── Tiny object builders (satisfy strict contract types) ─────────────────────

function sysObj(id: string, name: string): SystemObject {
  return { id, name };
}

function prep(id: string, name: string, category: string): PrepItem {
  return { id, name, category, attributes: [] };
}

function opStep(id: string, name: string, order: number): OperationStep {
  return { id, name, order, params: [] };
}

function meas(id: string, name: string, target: string): MeasurementItem {
  return { id, name, target, conditions: [] };
}

// ─── Shared snapshot builder ───────────────────────────────────────────────────

function snap(
  id: string,
  code: string,
  title: string,
  status: string,
  tags: string[],
  measNames: string[],
  prepNames: string[],
  opNames: string[],
): ExperimentSnapshot {
  return {
    record_id: id,
    experiment_code: code,
    title,
    confirmation_state: "draft",
    experiment_status: status,
    tags,
    data_source: "current_modules",
    modules: {
      system: {
        title: "实验系统",
        objects: [sysObj(`${id}-sys`, "InSe 晶体生长炉")],
      },
      preparation: {
        title: "实验准备",
        items: prepNames.map((name, i) =>
          prep(`${id}-prep-${i}`, name, i % 2 === 0 ? "material" : "step"),
        ),
      },
      operation: {
        title: "实验操作",
        steps: opNames.map((name, i) => opStep(`${id}-op-${i}`, name, i + 1)),
      },
      measurement: {
        title: "测量过程",
        items: measNames.map((name, i) => meas(`${id}-meas-${i}`, name, name)),
      },
      data: { title: "实验数据", items: [] },
    },
  };
}

// ─── Node IDs ─────────────────────────────────────────────────────────────────

const PROJECT_ID = "project:mock:demo";
const BLOCK_1_ID = "block:mock:1";
const BLOCK_2_ID = "block:mock:2";
const BLOCK_3_ID = "block:mock:3";
const BLOCK_4_ID = "block:mock:4";
const BLOCK_5_ID = "block:mock:5";

// ─── The fixture graph ────────────────────────────────────────────────────────

export const MOCK_MECHANISM_GRAPH: MechanismChainGraph = {
  type: "mechanism_chain",
  sci_note_id: "mock-demo",
  generated_at: "2026-03-26T00:00:00Z",

  project_node: {
    id: PROJECT_ID,
    sci_note_id: "mock-demo",
    node_type: "project",
    label: "InSe 单晶研究项目（演示数据）",
    total_records: 9,
    total_blocks: 5,
  },

  blocks: [
    // ── Block 1: initial_setup / archived ─────────────────────────────────────
    {
      id: BLOCK_1_ID,
      sci_note_id: "mock-demo",
      node_type: "block",
      stage_index: 1,
      stage_label: "阶段 1：垂直布里奇曼法初始搭建",
      objective_summary: "搭建基础实验系统，确认原料配比和升温方案",
      block_type: "initial_setup",
      block_status: "archived",
      record_ids: ["snap-1a", "snap-1b"],
      record_count: 2,
      created_range: {
        earliest: "2026-01-10T08:00:00Z",
        latest:   "2026-01-18T17:00:00Z",
      },
      archive_signals: {
        system_fingerprint: "InSe 晶体生长炉",
        preparation_fingerprint: "In|Se|配比方案|升温曲线",
        operation_fingerprint: "垂直布里奇曼法",
        measurement_fingerprint: "光学透射率|密度",
        boundary_triggers: ["first_block"],
        confirmation_state_dist: { draft: 2 },
        experiment_status_dist: { exploring: 2 },
      },
      experiment_snapshots: [
        snap("snap-1a", "EXP-001", "垂直布里奇曼法 初次尝试", "exploring",
          ["探索中", "草稿"],
          ["光学透射率", "密度"],
          ["In", "Se", "升温曲线", "保温时间"],
          ["原料混合", "真空封管", "程序升温"]),
        snap("snap-1b", "EXP-002", "垂直布里奇曼法 参数修正", "exploring",
          ["探索中"],
          ["光学透射率", "密度", "晶体形态"],
          ["In", "Se", "升温曲线", "保温时间", "降温速率"],
          ["原料混合", "真空封管", "程序升温", "受控降温"]),
      ],
    },

    // ── Block 2: condition_exploration / archived / HAS 失败 TAG ──────────────
    {
      id: BLOCK_2_ID,
      sci_note_id: "mock-demo",
      node_type: "block",
      stage_index: 2,
      stage_label: "阶段 2：温度梯度条件探索",
      objective_summary: "系统探索不同温度梯度下晶体生长行为，多次失败后定位最优窗口",
      block_type: "condition_exploration",
      block_status: "archived",
      record_ids: ["snap-2a", "snap-2b", "snap-2c"],
      record_count: 3,
      created_range: {
        earliest: "2026-01-20T09:00:00Z",
        latest:   "2026-02-08T16:00:00Z",
      },
      archive_signals: {
        system_fingerprint: "InSe 晶体生长炉",
        preparation_fingerprint: "In|Se|升温曲线|温度梯度设计",
        operation_fingerprint: "垂直布里奇曼法|梯度控制",
        measurement_fingerprint: "光学透射率|XRD|晶体形态",
        boundary_triggers: ["preparation_changed"],
        confirmation_state_dist: { draft: 3 },
        experiment_status_dist: { exploring: 3 },
      },
      experiment_snapshots: [
        snap("snap-2a", "EXP-003", "低梯度条件 尝试A", "exploring",
          ["失败", "探索中"],
          ["光学透射率", "XRD"],
          ["In", "Se", "温度梯度(低)", "升温曲线"],
          ["原料混合", "真空封管", "低梯度升温"]),
        snap("snap-2b", "EXP-004", "高梯度条件 尝试B", "exploring",
          ["失败", "探索中"],
          ["光学透射率", "XRD", "晶体形态"],
          ["In", "Se", "温度梯度(高)", "升温曲线", "降温速率"],
          ["原料混合", "真空封管", "高梯度升温", "受控降温"]),
        snap("snap-2c", "EXP-005", "中等梯度 初步成功", "exploring",
          ["探索中"],
          ["光学透射率", "XRD", "晶体形态", "密度"],
          ["In", "Se", "温度梯度(中)", "升温曲线", "保温时间", "降温速率"],
          ["原料混合", "真空封管", "中梯度升温", "保温", "受控降温"]),
      ],
    },

    // ── Block 3: parameter_optimization / consolidating ───────────────────────
    {
      id: BLOCK_3_ID,
      sci_note_id: "mock-demo",
      node_type: "block",
      stage_index: 3,
      stage_label: "阶段 3：升温速率与配比联合优化",
      objective_summary: "在确定温度梯度窗口后，精细调节升温速率和 In/Se 配比以提高晶体质量",
      block_type: "parameter_optimization",
      block_status: "consolidating",
      record_ids: ["snap-3a", "snap-3b"],
      record_count: 2,
      created_range: {
        earliest: "2026-02-12T10:00:00Z",
        latest:   "2026-02-28T15:00:00Z",
      },
      archive_signals: {
        system_fingerprint: "InSe 晶体生长炉",
        preparation_fingerprint: "In|Se|配比设计|升温速率|温度梯度(中)",
        operation_fingerprint: "垂直布里奇曼法|梯度控制|退火处理",
        measurement_fingerprint: "光学透射率|XRD|带隙|密度",
        boundary_triggers: ["measurement_changed"],
        confirmation_state_dist: { draft: 2 },
        experiment_status_dist: { exploring: 1, consolidating: 1 },
      },
      experiment_snapshots: [
        snap("snap-3a", "EXP-006", "配比 1.05:1 升温优化", "exploring",
          ["优化中", "探索中"],
          ["光学透射率", "XRD", "带隙"],
          ["In(1.05)", "Se(1.0)", "升温速率(慢)", "温度梯度(中)"],
          ["原料混合", "真空封管", "中梯度升温", "保温", "退火"]),
        snap("snap-3b", "EXP-007", "配比 1.1:1 最优参数锁定", "consolidating",
          ["优化中"],
          ["光学透射率", "XRD", "带隙", "成分分析", "密度"],
          ["In(1.1)", "Se(1.0)", "升温速率(慢)", "温度梯度(中)", "退火温度"],
          ["原料混合", "真空封管", "中梯度升温", "保温", "退火处理"]),
      ],
    },

    // ── Block 4: repeat_validation / archived / HAS 已验证 TAG ───────────────
    {
      id: BLOCK_4_ID,
      sci_note_id: "mock-demo",
      node_type: "block",
      stage_index: 4,
      stage_label: "阶段 4：最优参数重复性验证",
      objective_summary: "以相同参数重复实验 2 次，确认结果可重现，排除偶发因素干扰",
      block_type: "repeat_validation",
      block_status: "archived",
      record_ids: ["snap-4a", "snap-4b"],
      record_count: 2,
      created_range: {
        earliest: "2026-03-03T09:00:00Z",
        latest:   "2026-03-14T16:00:00Z",
      },
      archive_signals: {
        system_fingerprint: "InSe 晶体生长炉",
        preparation_fingerprint: "In(1.1)|Se(1.0)|升温速率(慢)|温度梯度(中)|退火温度",
        operation_fingerprint: "垂直布里奇曼法|梯度控制|退火处理",
        measurement_fingerprint: "光学透射率|XRD|带隙|成分分析|密度",
        boundary_triggers: ["operation_changed"],
        confirmation_state_dist: { confirmed: 2 },
        experiment_status_dist: { consolidating: 2 },
      },
      experiment_snapshots: [
        snap("snap-4a", "EXP-008", "最优参数 重复实验 #1", "consolidating",
          ["已验证", "可复现"],
          ["光学透射率", "XRD", "带隙", "成分分析", "密度"],
          ["In(1.1)", "Se(1.0)", "升温速率(慢)", "温度梯度(中)", "退火温度"],
          ["原料混合", "真空封管", "中梯度升温", "保温", "退火处理"]),
        snap("snap-4b", "EXP-009", "最优参数 重复实验 #2", "consolidating",
          ["已验证", "可复现"],
          ["光学透射率", "XRD", "带隙", "成分分析", "密度"],
          ["In(1.1)", "Se(1.0)", "升温速率(慢)", "温度梯度(中)", "退火温度"],
          ["原料混合", "真空封管", "中梯度升温", "保温", "退火处理"]),
      ],
    },

    // ── Block 5: result_confirmation / archived / HAS 已验证 可复现 TAG ────────
    {
      id: BLOCK_5_ID,
      sci_note_id: "mock-demo",
      node_type: "block",
      stage_index: 5,
      stage_label: "阶段 5：晶体性能综合确认",
      objective_summary: "全面测量并记录 InSe 单晶光学、电学、结构性能，形成最终结论",
      block_type: "result_confirmation",
      block_status: "archived",
      record_ids: ["snap-5a"],
      record_count: 1,
      created_range: {
        earliest: "2026-03-18T10:00:00Z",
        latest:   "2026-03-18T10:00:00Z",
      },
      archive_signals: {
        system_fingerprint: "InSe 晶体生长炉",
        preparation_fingerprint: "In(1.1)|Se(1.0)|升温速率(慢)|温度梯度(中)|退火温度",
        operation_fingerprint: "垂直布里奇曼法|梯度控制|退火处理",
        measurement_fingerprint: "光学透射率|XRD|带隙|成分分析|密度|拉曼光谱|霍尔效应",
        boundary_triggers: ["measurement_changed"],
        confirmation_state_dist: { confirmed: 1 },
        experiment_status_dist: { archived: 1 },
      },
      experiment_snapshots: [
        snap("snap-5a", "EXP-010", "InSe 单晶性能综合确认", "archived",
          ["已验证", "可复现", "结论稳定"],
          ["光学透射率", "XRD", "带隙", "成分分析", "密度", "拉曼光谱", "霍尔效应"],
          ["In(1.1)", "Se(1.0)", "升温速率(慢)", "温度梯度(中)", "退火温度"],
          ["原料混合", "真空封管", "中梯度升温", "保温", "退火处理"]),
      ],
    },
  ],

  edges: [
    { id: "e:proj:1", source: PROJECT_ID,  target: BLOCK_1_ID, edge_type: "main_transition" },
    { id: "e:1:2",    source: BLOCK_1_ID,  target: BLOCK_2_ID, edge_type: "main_transition" },
    { id: "e:2:3",    source: BLOCK_2_ID,  target: BLOCK_3_ID, edge_type: "main_transition" },
    { id: "e:3:4",    source: BLOCK_3_ID,  target: BLOCK_4_ID, edge_type: "main_transition" },
    { id: "e:4:5",    source: BLOCK_4_ID,  target: BLOCK_5_ID, edge_type: "main_transition" },
  ],

  archiving_log: [],
};

// ─── Convenience ID exports for the debug panel ───────────────────────────────

export const MOCK_IDS = {
  project: PROJECT_ID,
  b1: BLOCK_1_ID,
  b2: BLOCK_2_ID,
  b3: BLOCK_3_ID,
  b4: BLOCK_4_ID,
  b5: BLOCK_5_ID,
} as const;
