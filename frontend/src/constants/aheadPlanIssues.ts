/**
 * 专项计划「需要解决的问题」相关枚举与常量
 * 与后端 ahead_plan_issue 功能共用同一套分类，避免乱填
 */

/** 问题状态（枚举）：待处理/处理中/已解决/已关闭 */
export const ISSUE_STATUS_OPTIONS = [
  { value: 'pending', label: '待处理' },
  { value: 'in_progress', label: '处理中' },
  { value: 'resolved', label: '已解决' },
  { value: 'closed', label: '已确认' },
] as const

/** 逻辑状态（由系统对比时间生成）：未解决/超期未解决/按时解决/超期解决/已确认 */
export const LOGIC_STATUS_LABELS = {
  unsolved: '未解决',
  overdue_unsolved: '超期未解决',
  on_time: '按时解决',
  overdue_resolved: '超期解决',
  confirmed: '已评价',
}

/** 问题类型（合并精简） */
export const ISSUE_TYPE_OPTIONS = [
  { value: 'design_tech', label: '设计与技术问题' },
  { value: 'procurement_material', label: '采购与材料问题' },
  { value: 'warehouse_equipment', label: '仓储与设备问题' },
  { value: 'construction_management', label: '施工管理问题' },
  { value: 'hse_safety', label: '安全环保问题' },
  { value: 'quality_management', label: '质量管理问题' },
  { value: 'coordination_interface', label: '协调与接口问题' },
  { value: 'approval_process', label: '审批与流程问题' },
  { value: 'human_resource', label: '人力与资源问题' },
  { value: 'planning_management', label: '计划管理问题' },
  { value: 'quantity_confirmation', label: '工程量确认问题' },
  { value: 'other', label: '其他' },
] as const

/** 优先级 */
export const PRIORITY_OPTIONS = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
] as const

/** 解决部门（枚举） */
export const RESOLVING_DEPARTMENT_OPTIONS = [
  { value: 'design', label: '设计管理部' },
  { value: 'procurement', label: '采购管理部' },
  { value: 'warehouse', label: '仓储管理部' },
  { value: 'construction', label: '施工管理部' },
  { value: 'quality', label: '质量管理部' },
  { value: 'safety', label: '安全管理部' },
  { value: 'planning', label: '计划管理部' },
  { value: 'admin', label: '行政后勤管理部' },
  { value: 'it', label: 'IT管理部' },
  { value: 'contract', label: '合同管理部' },
  { value: 'cost_control', label: '费用控制管理部' },
  { value: 'hr', label: '人力资源部' },
  { value: 'handover_docs', label: '竣工资料管理部' },
] as const

export type IssueTypeValue = typeof ISSUE_TYPE_OPTIONS[number]['value']
export type IssueStatusValue = typeof ISSUE_STATUS_OPTIONS[number]['value']
export type PriorityValue = typeof PRIORITY_OPTIONS[number]['value']
export type ResolvingDepartmentValue = typeof RESOLVING_DEPARTMENT_OPTIONS[number]['value']
