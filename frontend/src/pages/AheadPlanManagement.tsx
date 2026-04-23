import { useState, useCallback, useEffect, useContext, useMemo, useRef } from 'react'
import {
  Select,
  Button,
  Space,
  Input,
  Tag,
  Modal,
  Progress,
  Checkbox,
  Row,
  Col,
  App,
  Alert,
  Divider,
  List,
  Pagination,
  Popconfirm,
  Spin,
  Tooltip,
  Popover,
  Badge,
  Table,
  DatePicker,
  Radio,
  Dropdown,
  Switch,
} from 'antd'
import {
  GroupOutlined,
  SettingOutlined,
  EyeOutlined,
  SaveOutlined,
  PlusOutlined,
  ExpandOutlined,
  CompressOutlined,
  ReloadOutlined,
  DeleteOutlined,
  MessageOutlined,
  CheckCircleOutlined,
  StopOutlined,
  RollbackOutlined,
  ExportOutlined,
  ImportOutlined,
  BarChartOutlined,
  MoreOutlined,
  NotificationOutlined,
} from '@ant-design/icons'
import './AheadPlanManagement.css'
import { useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { aheadPlanService, type AheadPlanViewRow, type AheadPlanSummaryItem, type IssueDimensionStatsItem, type AheadPlanIssueItem } from '../services/aheadPlanService'
import { activityService, type Activity } from '../services/activityService'
import { GlobalFilterContext } from '../components/layout/MainLayout'
import { useAuth } from '../contexts/AuthContext'
import { CONSTRUCTION_SUPERVISOR_ROLE_IDS } from '../services/authService'
import { parseRemarksJson } from '../utils/remarksJson'
import { RemarksCommentsThread } from '../components/aheadPlan/RemarksCommentsThread'
import { AheadPlanIssueModal } from '../components/aheadPlan/AheadPlanIssueModal'
import { formatQuantity, formatHighPrecisionValue } from '../utils/formatNumber'
import GanttChart, { type GanttTask, type GanttColumn } from '../components/gantt/GanttChart'
import { InputWithIME } from '../components/common/InputWithIME'
import ExcelJS from 'exceljs'
import LegacyModuleBanner from '../components/common/LegacyModuleBanner'

// 汇总行展开内容：问题分类统计 + 问题清单
function SummaryRowExpandContent({
  record,
  typeOfPlan,
  periodStart,
  periodEnd,
  summaryGroupBy,
  summaryFilters,
  initialStatus,
  onOpenIssue,
}: {
  record: AheadPlanSummaryItem
  typeOfPlan: string
  periodStart: string
  periodEnd: string
  summaryGroupBy: string
  summaryFilters?: Record<string, any>
  initialStatus?: string | null
  onOpenIssue: (activityId: string) => void
}) {
  const { message: messageApi } = App.useApp()
  const [dimension, setDimension] = useState<'issue_type' | 'raised_by' | 'responsible_user_id' | 'resolving_department' | 'priority' | 'raising_department'>('issue_type')
  const [selectedDimValue, setSelectedDimValue] = useState<string | number | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [issueSearch, setIssueSearch] = useState('')
  const [issueSearchForApi, setIssueSearchForApi] = useState('')
  const [issuePage, setIssuePage] = useState(1)
  const [selectedIssueIds, setSelectedIssueIds] = useState<number[]>([])
  const [isUrging, setIsUrging] = useState(false)

  const issuePageSize = 10

  // 搜索防抖：输入停止 350ms 后刷新 API 清单（避免搜不到本来有的）
  useEffect(() => {
    const t = setTimeout(() => setIssueSearchForApi(issueSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [issueSearch])

  // 维度/状态切换时重置页码
  useEffect(() => {
    setIssuePage(1)
  }, [selectedDimValue, selectedStatus, issueSearchForApi])

  // 同步来自父表格点击的状态过滤
  useEffect(() => {
    if (initialStatus !== undefined) {
      setSelectedStatus(initialStatus)
    }
  }, [initialStatus])

  // 每次切换维度时清空选中的过滤值
  useEffect(() => {
    setSelectedDimValue(null)
  }, [dimension])

  const { data: dimStatsData, isLoading: dimLoading } = useQuery({
    queryKey: ['issue-dimension-stats', record.group_name, typeOfPlan, periodStart, periodEnd, summaryGroupBy, dimension, summaryFilters],
    queryFn: () => aheadPlanService.getIssueDimensionStats({
      type_of_plan: typeOfPlan,
      period_start: periodStart,
      period_end: periodEnd,
      group_by: summaryGroupBy,
      group_name: record.group_name,
      dimension,
      filters: summaryFilters,
    }),
  })
  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ['issue-list-by-group', record.group_name, typeOfPlan, periodStart, periodEnd, summaryGroupBy, summaryFilters, issueSearchForApi, dimension, selectedDimValue, selectedStatus, issuePage],
    queryFn: () => aheadPlanService.getIssueListByGroup({
      type_of_plan: typeOfPlan,
      period_start: periodStart,
      period_end: periodEnd,
      group_by: summaryGroupBy,
      group_name: record.group_name,
      filters: summaryFilters,
      limit: issuePageSize,
      skip: (issuePage - 1) * issuePageSize,
      search: issueSearchForApi || undefined,
      dimension: selectedDimValue !== null ? dimension : undefined,
      dimension_value: selectedDimValue !== null ? selectedDimValue : undefined,
      status: selectedStatus || undefined,
    }),
  })

  const issues = issuesData?.items ?? []
  const issuesTotal = issuesData?.total ?? 0
  const dimStats = dimStatsData?.items ?? []
  const filteredIssues = issues

  // 可催办的清单（排除已解决/已确认）
  const urgeableIssues = useMemo(() => 
    filteredIssues.filter(i => i.status !== 'resolved' && i.status !== 'closed'),
  [filteredIssues])

  const handleUrgeIssues = async () => {
    if (selectedIssueIds.length === 0) return
    setIsUrging(true)
    try {
      for (const id of selectedIssueIds) {
        const issue = issues.find(i => i.id === id)
        if (issue?.responsible_user_id) {
          await aheadPlanService.createIssueReply(id, {
            content: `【系统催办】请尽快处理该问题。`,
            reply_type: 'normal'
          })
        }
      }
      messageApi.success(`已向 ${selectedIssueIds.length} 个问题的责任人发送催办提醒`)
      setSelectedIssueIds([])
    } catch (e: any) {
      messageApi.error('催办失败: ' + (e.message || '未知错误'))
    } finally {
      setIsUrging(false)
    }
  }

  const dimLabels: Record<string, string> = {
    issue_type: '问题类型',
    raising_department: '提出部门',
    raised_by: '提出人',
    resolving_department: '责任部门',
    responsible_user_id: '责任人',
    priority: '优先级',
  }
  const statusLabels: Record<string, string> = {
    pending: '待处理',
    in_progress: '处理中',
    resolved: '已解决',
    closed: '已确认',
  }
  const issueTypeLabels: Record<string, string> = {
    design_tech: '设计与技术', procurement_material: '采购与材料', warehouse_equipment: '仓储与设备',
    construction_management: '施工管理', hse_safety: '安全环保', quality_management: '质量管理',
    coordination_interface: '协调与接口', approval_process: '审批与流程', human_resource: '人力与资源',
    planning_management: '计划管理', quantity_confirmation: '工程量确认', other: '其他',
  }
  const deptLabels: Record<string, string> = {
    design: '设计管理部', procurement: '采购管理部', warehouse: '仓储管理部', construction: '施工管理部',
    quality: '质量管理部', safety: '安全管理部', planning: '计划管理部', admin: '行政后勤管理部',
    it: 'IT管理部', contract: '合同管理部', cost_control: '费用控制', hr: '人力资源部', handover_docs: '竣工资料',
  }

  const squareStyle = { borderRadius: 0 }

  return (
    <div style={{ padding: '16px 24px', background: '#fcfcfc', borderBottom: '1px solid #e2e8f0' }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChartOutlined style={{ color: '#1890ff', fontSize: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>分类钻取分析</span>
        </div>
        <Radio.Group
          size="small"
          value={dimension}
          onChange={(e) => setDimension(e.target.value)}
          buttonStyle="solid"
          className="square-radio-group"
        >
          {(['issue_type', 'raising_department', 'raised_by', 'resolving_department', 'responsible_user_id', 'priority'] as const).map((d) => (
            <Radio.Button key={d} value={d} style={{ ...squareStyle, fontSize: '11px' }}>{dimLabels[d]}</Radio.Button>
          ))}
        </Radio.Group>
        
        {/* 状态快捷过滤 */}
        <Divider type="vertical" />
        <Space size={4}>
          <span style={{ fontSize: 11, color: '#64748b' }}>状态过滤:</span>
          {(['pending', 'in_progress', 'resolved', 'overdue'] as const).map(st => (
            <Tag.CheckableTag
              key={st}
              checked={selectedStatus === st}
              onChange={checked => setSelectedStatus(checked ? st : null)}
              style={{ fontSize: 11, margin: 0, padding: '0 8px', lineHeight: '20px', border: '1px solid #d9d9d9', background: selectedStatus === st ? '#1890ff' : '#fff' }}
            >
              {st === 'pending' ? '待处理' : st === 'in_progress' ? '处理中' : st === 'resolved' ? '已解决' : '超期'}
            </Tag.CheckableTag>
          ))}
          {selectedStatus && <Button type="link" size="small" style={{ fontSize: 11, padding: 0 }} onClick={() => setSelectedStatus(null)}>清除</Button>}
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'nowrap', alignItems: 'stretch' }}>
        {/* 左侧：分类汇总面板 - 固定700px，表格式布局对齐 */}
        <div style={{ width: 700, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #e2e8f0', ...squareStyle }}>
          <div style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#475569', display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px 60px 60px', gap: '0 24px', alignItems: 'center' }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{dimLabels[dimension]}</span>
            <span style={{ width: 60, textAlign: 'center' }}>待处理</span>
            <span style={{ width: 60, textAlign: 'center' }}>处理中</span>
            <span style={{ width: 60, textAlign: 'center' }}>已解决</span>
            <span style={{ width: 60, textAlign: 'center' }}>超期</span>
            <span style={{ width: 60, textAlign: 'center' }}>合计</span>
          </div>
          <div style={{ flex: 1, maxHeight: '400px', overflowY: 'auto' }}>
            <Spin spinning={dimLoading}>
              {dimStats.map((item: IssueDimensionStatsItem) => (
                <div 
                  key={String(item.dimension_value ?? '') + item.dimension_label}
                  onClick={() => setSelectedDimValue(prev => prev === item.dimension_value ? null : item.dimension_value)}
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 60px 60px 60px 60px 60px',
                    gap: '0 24px',
                    alignItems: 'center', 
                    padding: '8px 12px', 
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    backgroundColor: selectedDimValue === item.dimension_value ? '#f0f9ff' : 'transparent',
                    transition: 'all 0.2s'
                  }}
                  className="dim-stat-row-hover"
                >
                  <span style={{ fontSize: 12, color: '#334155', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.dimension_label}</span>
                  <span style={{ width: 60, textAlign: 'center', fontSize: 11, color: item.pending > 0 ? '#f59e0b' : '#cbd5e1', fontWeight: item.pending > 0 ? 700 : 400 }}>{item.pending || '-'}</span>
                  <span style={{ width: 60, textAlign: 'center', fontSize: 11, color: item.in_progress > 0 ? '#3b82f6' : '#cbd5e1', fontWeight: item.in_progress > 0 ? 700 : 400 }}>{item.in_progress || '-'}</span>
                  <span style={{ width: 60, textAlign: 'center', fontSize: 11, color: item.resolved > 0 ? '#10b981' : '#cbd5e1', fontWeight: item.resolved > 0 ? 700 : 400 }}>{item.resolved || '-'}</span>
                  <span style={{ width: 60, textAlign: 'center', fontSize: 11, color: item.overdue > 0 ? '#ef4444' : '#cbd5e1', fontWeight: item.overdue > 0 ? 700 : 400 }}>{item.overdue || '-'}</span>
                  <span style={{ width: 60, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#1e293b' }}>{item.total || '-'}</span>
                </div>
              ))}
            </Spin>
          </div>
          {selectedDimValue !== null && (
            <div style={{ padding: '6px 12px', borderTop: '1px solid #f1f5f9', textAlign: 'right', background: '#fff' }}>
              <Button type="link" size="small" style={{ fontSize: 11, padding: 0 }} onClick={() => setSelectedDimValue(null)}>清除维度筛选</Button>
            </div>
          )}
        </div>

        {/* 右侧：详情清单面板 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #e2e8f0', ...squareStyle, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ 
            padding: '8px 16px',
            borderBottom: '1px solid #e2e8f0',
            background: '#fff',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            height: '40px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageOutlined style={{ color: '#64748b', fontSize: 14 }} />
                <span style={{ fontWeight: 700, fontSize: 12, color: '#1e293b' }}>
                  问题详情 <Tag color="blue" style={{ ...squareStyle, marginLeft: 8, fontSize: 10, border: 'none', margin: 0 }}>
                    共 {issuesTotal} 条
                  </Tag>
                </span>
              </div>
              <Input
                placeholder="搜索 ID、描述、人员..."
                size="small"
                prefix={<SettingOutlined style={{ color: '#94a3b8' }} />}
                style={{ width: 180, ...squareStyle, fontSize: 11 }}
                value={issueSearch}
                onChange={e => setIssueSearch(e.target.value)}
                allowClear
              />
            </div>
            <Space size="middle">
              {selectedIssueIds.length > 0 && (
                <Button 
                  size="small" 
                  type="primary"
                  danger 
                  icon={<NotificationOutlined />}
                  loading={isUrging}
                  onClick={handleUrgeIssues}
                  style={{ ...squareStyle, fontSize: 11, height: '24px' }}
                >
                  批量催办 ({selectedIssueIds.length})
                </Button>
              )}
              <Checkbox 
                checked={selectedIssueIds.length > 0 && selectedIssueIds.length === urgeableIssues.length}
                indeterminate={selectedIssueIds.length > 0 && selectedIssueIds.length < urgeableIssues.length}
                disabled={urgeableIssues.length === 0}
                style={{ fontSize: 11 }}
                onChange={e => {
                  if (e.target.checked) setSelectedIssueIds(urgeableIssues.map(i => i.id))
                  else setSelectedIssueIds([])
                }}
              >
                全选待办
              </Checkbox>
            </Space>
          </div>

          <Spin spinning={issuesLoading}>
            <div style={{ maxHeight: 360, overflowY: 'auto', padding: '0 16px' }}>
              {filteredIssues.length === 0 ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                  <StopOutlined style={{ fontSize: 24, color: '#e2e8f0', marginBottom: 8, display: 'block' }} />
                  未找到匹配的问题详情
                </div>
              ) : (
                <List
                  size="small"
                  dataSource={filteredIssues}
                  renderItem={(item: AheadPlanIssueItem) => {
                    const isResolved = item.status === 'resolved' || item.status === 'closed'
                    return (
                      <List.Item
                        key={item.id}
                        style={{ 
                          borderBottom: '1px solid #f1f5f9', 
                          padding: '12px 0',
                          backgroundColor: selectedIssueIds.includes(item.id) ? '#f0f9ff' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 12, width: '100%', alignItems: 'flex-start' }}>
                          <Checkbox 
                            checked={selectedIssueIds.includes(item.id)}
                            disabled={isResolved}
                            onChange={e => {
                              if (e.target.checked) setSelectedIssueIds((prev: number[]) => [...prev, item.id])
                              else setSelectedIssueIds((prev: number[]) => prev.filter(id => id !== item.id))
                            }}
                            style={{ marginTop: 4 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <Space size={6}>
                                <Tag color="blue" style={{ ...squareStyle, margin: 0, fontSize: 10, border: 'none', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>{issueTypeLabels[item.issue_type] || item.issue_type}</Tag>
                                <span style={{ fontWeight: 700, fontSize: 11, color: '#0f172a' }}>{item.activity_id}</span>
                                <Tag 
                                  style={{ ...squareStyle, margin: 0, fontSize: 10, border: 'none', fontWeight: 600 }}
                                  color={isResolved ? 'success' : item.status === 'in_progress' ? 'processing' : 'warning'}
                                >
                                  {statusLabels[item.status] || item.status}
                                </Tag>
                              </Space>
                              <Button 
                                type="link" 
                                size="small" 
                                icon={<EyeOutlined />} 
                                onClick={() => onOpenIssue(item.activity_id)}
                                style={{ padding: 0, height: 'auto', fontSize: 10 }}
                              >
                                查看沟通
                              </Button>
                            </div>
                            
                            <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5, marginBottom: 8, background: '#f8fafc', padding: '8px 12px', borderLeft: '3px solid #cbd5e1' }}>
                              {item.description}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                              <div style={{ fontSize: 10, color: '#94a3b8' }}>
                                <Space split={<span style={{ color: '#e2e8f0' }}>|</span>} size={6}>
                                  <span>提出人: <span style={{ color: '#64748b' }}>{item.raised_by_name}</span></span>
                                  <span>部门: <span style={{ color: '#64748b' }}>{deptLabels[item.raising_department || ''] || item.raising_department || '-'}</span></span>
                                  <span>责任人: <span style={{ color: '#475569', fontWeight: 600 }}>{item.responsible_user_name || '未分配'}</span></span>
                                </Space>
                              </div>
                              <div style={{ textAlign: 'right', fontSize: 10 }}>
                                <Space direction="vertical" size={0} align="end">
                                  {item.planned_resolve_at && (
                                    <div>
                                      <span style={{ color: '#94a3b8' }}>要求: </span>
                                      <span style={{ color: item.logic_status === 'overdue_unsolved' ? '#ef4444' : '#475569', fontWeight: 600 }}>{item.planned_resolve_at}</span>
                                    </div>
                                  )}
                                  {item.resolved_at && (
                                    <div>
                                      <span style={{ color: '#94a3b8' }}>实际: </span>
                                      <span style={{ color: '#10b981', fontWeight: 600 }}>{dayjs(item.resolved_at).format('MM-DD')}</span>
                                    </div>
                                  )}
                                </Space>
                              </div>
                            </div>
                          </div>
                        </div>
                      </List.Item>
                    )
                  }}
                />
              )}
            </div>
            {issuesTotal > 0 && (
              <div style={{ padding: '8px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center' }}>
                <Pagination
                  size="small"
                  current={issuePage}
                  pageSize={issuePageSize}
                  total={issuesTotal}
                  onChange={setIssuePage}
                  showSizeChanger={false}
                  showTotal={(t) => `共 ${t} 条`}
                />
              </div>
            )}
          </Spin>
        </div>
      </div>
    </div>
  )
}

// 与人力/工程量日报一致的分组选项
const GROUP_BY_OPTIONS = [
  { value: 'discipline', label: '专业' },
  { value: 'work_package', label: '工作包' },
  { value: 'block', label: '子项' },
  { value: 'scope', label: '分包商' },
  { value: 'implement_phase', label: '执行阶段' },
  { value: 'project', label: '项目' },
  { value: 'subproject', label: '子项目' },
  { value: 'train', label: '开车阶段' },
  { value: 'unit', label: '装置' },
  { value: 'main_block', label: '主项' },
  { value: 'quarter', label: '区块' },
]

// 栏位定义
const AVAILABLE_COLUMNS = [
  { key: 'status', title: '状态', width: 60, align: 'center' as const },
  { key: 'activity_id', title: '作业代码', width: 150 },
  { key: 'title', title: '作业描述', width: 300 },
  { key: 'wbs_code', title: 'WBS代码', width: 150 },
  { key: 'block', title: '子项', width: 120 },
  { key: 'discipline', title: '专业', width: 100 },
  { key: 'work_package', title: '工作包', width: 120 },
  { key: 'scope', title: '分包商', width: 120 },
  { key: 'implement_phase', title: '执行阶段', width: 100 },
  { key: 'project', title: '项目', width: 120 },
  { key: 'subproject', title: '子项目', width: 120 },
  { key: 'train', title: '开车阶段', width: 100 },
  { key: 'unit', title: '装置', width: 100 },
  { key: 'main_block', title: '主项', width: 120 },
  { key: 'quarter', title: '区块', width: 120 },
  { key: 'key_qty', title: '总量', width: 120, align: 'right' as const },
  { key: 'uom', title: '计量单位', width: 100 },
  { key: 'calculated_mhrs', title: '预算人工时', width: 120, align: 'right' as const },
  { key: 'weight_factor', title: '权重', width: 120, align: 'right' as const },
  { key: 'actual_weight_factor', title: '赢得权重', width: 120, align: 'right' as const },
  { key: 'start_date', title: '开始日期', width: 120 },
  { key: 'finish_date', title: '结束日期', width: 120 },
  { key: 'baseline1_start_date', title: 'BL1开始日期', width: 120 },
  { key: 'baseline1_finish_date', title: 'BL1结束日期', width: 120 },
  { key: 'planned_duration', title: '计划工期', width: 100, align: 'right' as const },
  { key: 'actual_start_date', title: '实际开始日期', width: 120 },
  { key: 'actual_finish_date', title: '实际结束日期', width: 120 },
  { key: 'actual_duration', title: '实际工期', width: 120, align: 'right' as const },
  { key: 'completed', title: '完成量', width: 100, align: 'right' as const },
  { key: 'actual_manhour', title: '实际人工时', width: 120, align: 'right' as const },
  { key: 'bcc_kq_code', title: '项目编码', width: 120 },
  { key: 'user_defined_activity_name', title: '作业描述(工程师填写)', width: 200 },
  { key: 'remaining_qty', title: '剩余量', width: 100, align: 'right' as const },
  { key: 'total_planned_units', title: '周期计划量', width: 120, align: 'right' as const },
]

const DEFAULT_VISIBLE_COLUMNS = [
  'status',
  'activity_id',
  'title',
  'scope',
  'block',
  'discipline',
  'work_package',
  'bcc_kq_code',
  'user_defined_activity_name',
  'uom',
  'key_qty',
  'completed',
  'remaining_qty',
  'total_planned_units',
]

function buildFiltersFromGlobal(globalFilter: Record<string, any>) {
  const filterObj: Record<string, any> = {}
  if (globalFilter.subproject?.length) filterObj.subproject = globalFilter.subproject
  if (globalFilter.train?.length) filterObj.train = globalFilter.train
  if (globalFilter.unit?.length) filterObj.unit = globalFilter.unit
  if (globalFilter.main_block?.length) filterObj.main_block = globalFilter.main_block
  if (globalFilter.block?.length) filterObj.block = globalFilter.block
  if (globalFilter.quarter?.length) filterObj.quarter = globalFilter.quarter
  if (globalFilter.scope?.length) filterObj.scope = globalFilter.scope
  if (globalFilter.discipline?.length) filterObj.discipline = globalFilter.discipline
  if (globalFilter.implement_phase?.length) filterObj.implement_phase = globalFilter.implement_phase
  if (globalFilter.contract_phase?.length) filterObj.contract_phase = globalFilter.contract_phase
  if (globalFilter.type?.length) filterObj.type = globalFilter.type
  if (globalFilter.work_package?.length) filterObj.work_package = globalFilter.work_package
  if (globalFilter.resource_id_name?.length) filterObj.resource_id_name = globalFilter.resource_id_name
  if (globalFilter.bcc_kq_code?.length) filterObj.bcc_kq_code = globalFilter.bcc_kq_code
  if (globalFilter.kq?.length) filterObj.kq = globalFilter.kq
  if (globalFilter.cn_wk_report?.length) filterObj.cn_wk_report = globalFilter.cn_wk_report
  return filterObj
}

export default function AheadPlanManagement() {
  const { message: messageApi } = App.useApp()
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const globalFilter = useContext(GlobalFilterContext) || {}
  const poolFilters = useMemo(() => buildFiltersFromGlobal(globalFilter), [globalFilter])

  // 当月 26 日及以后仅系统管理员可变更计划（与后端一致）
  const isAfter25th = new Date().getDate() >= 26
  const canModifyPlan = !isAfter25th || !!(currentUser?.is_superuser || currentUser?.username === 'role_system_admin')

  // 施工主管（role_id 75/76/77）：可审核/批准/撤回，范围受 subproject 约束
  const isConstructionSupervisor = !!currentUser?.role_ids?.some((id) =>
    (CONSTRUCTION_SUPERVISOR_ROLE_IDS as readonly number[]).includes(id)
  )

  // 计划筛选状态：计划日期 + 计划类型（如月计划、三月滚动等）
  // 选中的日期，用于推导周（周五至周四）
  // 计划筛选状态：计划日期 + 计划类型（如月计划、三月滚动等）
  // 选中的日期，用于推导周（周五至周四）
  // 默认选中当前周及其后3周（共4周）
  const initialDateRange = useMemo(() => {
    const now = dayjs()
    // 上个月的最后一个周四 + 1天 = 上个月的最后一个周五（起点）
    let d = now.subtract(1, 'month').endOf('month')
    while (d.day() !== 4) d = d.subtract(1, 'day')
    const start = d.add(1, 'day')
    // 这个月的最后一个周四（终点）
    d = now.endOf('month')
    while (d.day() !== 4) d = d.subtract(1, 'day')
    const end = d
    return [start, end] as [dayjs.Dayjs, dayjs.Dayjs]
  }, [])

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(initialDateRange)

  // 计划类型基础值：monthly, three_month, 或自定义名称（如"春季攻势专项计划"）
  const [baseTypeOfPlan, setBaseTypeOfPlan] = useState<string>('monthly')

  // 自定义计划模板名称（持久化到 localStorage，用于下次选择）
  const CUSTOM_TEMPLATES_KEY = 'ahead-plan-custom-templates'
  const [customPlanTemplates, setCustomPlanTemplates] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((x: any) => typeof x === 'string' && x.trim()) : []
    } catch (_) {
      return []
    }
  })

  const saveCustomTemplate = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setCustomPlanTemplates((prev) => {
      if (prev.includes(trimmed)) return prev
      const next = [trimmed, ...prev]
      try {
        localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(next))
      } catch (_) {}
      return next
    })
    setBaseTypeOfPlan(trimmed)
  }, [])

  const periodStart = useMemo(() => dateRange[0].format('YYYY-MM-DD'), [dateRange])
  const periodEnd = useMemo(() => dateRange[1].format('YYYY-MM-DD'), [dateRange])

  // Select 选项：内置 + 自定义模板（与内置 label 同名的自定义项不重复展示）
  const builtInLabels = useMemo(() => new Set(['月滚动计划', '三月滚动计划', '春季攻势专项计划']), [])
  const planSelectOptions = useMemo(() => {
    const builtIn = [
      { value: 'monthly', label: '月滚动计划' },
      { value: 'three_month', label: '三月滚动计划' },
      { value: 'spring-strike', label: '春季攻势专项计划' }
    ]
    const custom = customPlanTemplates
      .filter((name) => !builtInLabels.has(name))
      .map((name) => ({ value: name, label: name }))
    return [...builtIn, ...custom]
  }, [customPlanTemplates, builtInLabels])

  // 内置类型的 value -> 数据库存储的 type 前缀（兼容历史数据：数据库存的是中文标签）
  const BUILTIN_VALUE_TO_DB_PREFIX: Record<string, string> = {
    monthly: '月滚动计划',
    three_month: '三月滚动计划',
    'spring-strike': '春季攻势专项计划'
  }
  const DB_PREFIX_TO_BUILTIN_VALUE: Record<string, string> = {
    '月滚动计划': 'monthly',
    '三月滚动计划': 'three_month',
    '春季攻势专项计划': 'spring-strike'
  }

  // 已有计划版本列表（选择后自动更新日期和计划类型）
  const { data: planTypesData } = useQuery({
    queryKey: ['ahead-plan-plan-types'],
    queryFn: () => aheadPlanService.listPlanTypes(),
  })
  const existingPlanTypes: string[] = planTypesData?.plan_types ?? []
  const [selectedPlanVersion, setSelectedPlanVersion] = useState<string>('')
  const handleSelectPlanVersion = useCallback((fullTypeOfPlan: string) => {
    const match = fullTypeOfPlan.match(/_(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})$/)
    if (!match) return
    const [, periodStart, periodEnd] = match
    const prefix = fullTypeOfPlan.slice(0, match.index)
    const baseValue = DB_PREFIX_TO_BUILTIN_VALUE[prefix] ?? prefix
    setDateRange([dayjs(periodStart), dayjs(periodEnd)])
    if (DB_PREFIX_TO_BUILTIN_VALUE[prefix] != null) {
      setBaseTypeOfPlan(baseValue)
    } else {
      saveCustomTemplate(prefix)
    }
    setSelectedPlanVersion(fullTypeOfPlan)
  }, [saveCustomTemplate])

  // 最终传递给后端的 type_of_plan，格式：类型名称_开始日期~结束日期
  // 内置类型用中文前缀以兼容历史数据，自定义计划用用户输入的名称
  const typeOfPlan = useMemo(() => {
    const prefix = BUILTIN_VALUE_TO_DB_PREFIX[baseTypeOfPlan] ?? baseTypeOfPlan
    return `${prefix}_${periodStart}~${periodEnd}`
  }, [baseTypeOfPlan, periodStart, periodEnd])

  // 当前 typeOfPlan 变化时，若与 selectedPlanVersion 不一致则清空（用户手动改了日期/类型）
  useEffect(() => {
    if (selectedPlanVersion && typeOfPlan !== selectedPlanVersion) {
      setSelectedPlanVersion('')
    }
  }, [typeOfPlan, selectedPlanVersion])

  const [activityIdFilter, setActivityIdFilter] = useState('')
  const [titleFilter, setTitleFilter] = useState('')
  const [groupingPanelVisible, setGroupingPanelVisible] = useState(true)
  const [groupBy, setGroupBy] = useState<string[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Map<string, boolean>>(new Map())
  const [columnSettingsVisible, setColumnSettingsVisible] = useState(false)
  const [viewModalVisible, setViewModalVisible] = useState(false)
  
  // 视图与列宽管理
  const [savedViews, setSavedViews] = useState<Array<{
    id: string
    name: string
    groupBy: string[]
    visibleColumns: string[]
    columnWidths: Record<string, number>
    expandedGroups?: Record<string, boolean>
  }>>(() => {
    try {
      const raw = localStorage.getItem('ahead-plan-views')
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch (_) {
      return []
    }
  })
  
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => [...DEFAULT_VISIBLE_COLUMNS])
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('ahead-plan-column-widths')
      if (saved) return JSON.parse(saved)
    } catch (_) {}
    return {}
  })

  const [poolModalVisible, setPoolModalVisible] = useState(false)
  const [loadRecommendedRequested, setLoadRecommendedRequested] = useState(false)
  const [importSkippedResult, setImportSkippedResult] = useState<Array<{ activity_id: string; reason: string }> | null>(null)
  const [poolSearch, setPoolSearch] = useState('')
  const [selectedPoolIds, setSelectedPoolIds] = useState<string[]>([])
  const [poolAdding, setPoolAdding] = useState(false)
  const [approving, setApproving] = useState(false)
  const [poolPage, setPoolPage] = useState(1)
  const [poolPageSize, setPoolPageSize] = useState(50)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [issueModalContext, setIssueModalContext] = useState<{ activityId: string; typeOfPlan: string; title?: string } | null>(null)

  // 处理 URL 中的活动定位参数
  const location = useLocation()
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const aid = params.get('activityId')
    const top = params.get('typeOfPlan')
    
    if (aid) {
      setActivityIdFilter(aid)
    }
    
    if (top && top !== typeOfPlan) {
      handleSelectPlanVersion(top)
    }
  }, [location.search, handleSelectPlanVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // 分页：参考 activities-advanced，首页 limit=2000 提升加载，loadMore 时追加
  const [viewPagination, setViewPagination] = useState({ current: 1, pageSize: 2000 })
  const [loadedItems, setLoadedItems] = useState<AheadPlanViewRow[]>([])
  const [hasMore, setHasMore] = useState(false)
  // 搜索条件合并进请求 filters，走服务端模糊匹配，使不在首屏 2000 条内的作业也能通过搜索命中
  const viewFilters = useMemo(() => {
    const f: Record<string, string | string[]> = { ...poolFilters }
    const aid = (activityIdFilter || '').trim()
    const tit = (titleFilter || '').trim()
    if (aid) f.activity_id = aid
    if (tit) f.title = tit
    return f
  }, [poolFilters, activityIdFilter, titleFilter])
  const viewFiltersKey = useMemo(() => JSON.stringify(viewFilters), [viewFilters])
  const viewContextKey = `${periodStart}_${periodEnd}_${typeOfPlan}_${viewFiltersKey}`
  const prevViewContextKeyRef = useRef(viewContextKey)
  // 计划/周期、globalFilter 或搜索变化时，必须从第 1 页请求。useEffect 在渲染后执行，useQuery 先跑，故在渲染阶段判定：context 变了则 skip=0
  const contextJustChanged = prevViewContextKeyRef.current !== viewContextKey
  if (contextJustChanged) {
    prevViewContextKeyRef.current = viewContextKey
  }
  const effectivePage = contextJustChanged ? 1 : viewPagination.current
  useEffect(() => {
    setViewPagination((p) => ({ ...p, current: 1 }))
    setLoadedItems([])
  }, [viewContextKey])

  const { data: viewData, isLoading, refetch } = useQuery({
    queryKey: [
      'ahead-plan-view',
      periodStart,
      periodEnd,
      typeOfPlan,
      effectivePage,
      viewPagination.pageSize,
      viewFiltersKey,
    ],
    queryFn: () =>
      aheadPlanService.view({
        type_of_plan: typeOfPlan,
        period_start: periodStart,
        period_end: periodEnd,
        skip: (effectivePage - 1) * viewPagination.pageSize,
        limit: viewPagination.pageSize,
        filters: Object.keys(viewFilters).length > 0 ? JSON.stringify(viewFilters) : undefined,
      }),
  })

  useEffect(() => {
    if (!viewData?.items) return
    if (effectivePage === 1) {
      setLoadedItems(viewData.items)
    } else {
      setLoadedItems((prev) => {
        const freshMap = new Map(viewData.items.map((r) => [r.activity_id, r]))
        const updated = prev.map((r) => freshMap.get(r.activity_id) ?? r)
        const existingIds = new Set(prev.map((r) => r.activity_id))
        const append = viewData.items.filter((r) => !existingIds.has(r.activity_id))
        return [...updated, ...append]
      })
    }
    const total = viewData.total ?? 0
    const received = viewData.items?.length ?? 0
    setHasMore(received === viewPagination.pageSize && received < total)
  }, [viewData, effectivePage, viewPagination.current, viewPagination.pageSize])

  const viewItems: AheadPlanViewRow[] = loadedItems
  const viewTotal = viewData?.total ?? 0
  const thursdays: string[] = viewData?.thursdays ?? []

  const handleLoadMore = useCallback(() => {
    setViewPagination((p) => ({ ...p, current: p.current + 1 }))
  }, [])

  // 汇总统计
  const [showSummary, setShowSummary] = useState(false)
  const [summaryGroupBy, setSummaryGroupBy] = useState<'work_package' | 'resource_id_name' | 'key_qty' | 'bcc_kq_code'>('work_package')
  // 时间粒度：按周（默认）或按月（长周期专项计划钻取）
  const [summaryTimeGranularity, setSummaryTimeGranularity] = useState<'week' | 'month'>('week')
  // 是否对比实际完成：周期列显示计划（上）+ 实际（下），实际按 globalFilter 汇总 VFACTDB
  const [showCompareActual, setShowCompareActual] = useState(false)
  const summaryTableWrapperRef = useRef<HTMLDivElement>(null)
  const [summaryTableBodyHeight, setSummaryTableBodyHeight] = useState(400)
  useEffect(() => {
    if (!showSummary) return
    const el = summaryTableWrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      const thead = el.querySelector('.ant-table-thead') as HTMLElement | null
      const headerH = thead?.offsetHeight ?? 95
      const next = Math.max(200, Math.floor(rect.height - headerH - 8))
      setSummaryTableBodyHeight(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [showSummary])
  const summaryFilters = useMemo(() => {
    const f: Record<string, any> = { ...poolFilters }
    if (activityIdFilter?.trim()) f.activity_id = activityIdFilter.trim()
    if (titleFilter?.trim()) f.title = titleFilter.trim()
    return Object.keys(f).length ? f : undefined
  }, [poolFilters, activityIdFilter, titleFilter])
  const [expandedSummaryRowKeys, setExpandedSummaryRowKeys] = useState<string[]>([])
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['ahead-plan-summary', typeOfPlan, periodStart, periodEnd, summaryGroupBy, summaryFilters, showCompareActual],
    queryFn: () =>
      aheadPlanService.getSummary({
        type_of_plan: typeOfPlan,
        period_start: periodStart,
        period_end: periodEnd,
        group_by: summaryGroupBy,
        filters: summaryFilters,
        compare_actual: showCompareActual,
      }),
    enabled: showSummary,
  })

  const [summaryRowStatusFilters, setSummaryRowStatusFilters] = useState<Record<string, string | null>>({})

  const summaryColumns = useMemo(() => {
    const thursdays = summaryData?.thursdays ?? []
    const groupTitle = (label: string, color: string) => (
      <div style={{
        background: color,
        color: 'white',
        padding: '4px 8px',
        fontSize: '11px',
        fontWeight: 600,
        textAlign: 'center',
      }}>
        {label}
      </div>
    )
    const groupLabel = summaryGroupBy === 'work_package' ? '工作包' :
      summaryGroupBy === 'resource_id_name' ? '资源' :
      summaryGroupBy === 'key_qty' ? '主要工作项' : '项目编码'

    // 按月钻取：将 thursdays 按 YYYY-MM 分组得到月份列表
    const months: string[] = summaryTimeGranularity === 'month'
      ? [...new Set(thursdays.map((d) => d.slice(0, 7)))].sort()
      : []
    const todayIso = dayjs().format('YYYY-MM-DD')
    const periodCols = summaryTimeGranularity === 'week'
      ? thursdays.map((d) => ({
          title: d.length >= 10 ? d.slice(5) : d,
          key: `weekly_${d}`,
          width: 100,
          align: 'center' as const,
          periodEndIso: d,
          getVal: (record: any) => record?.weekly?.[d] ?? 0,
          getActualVal: (record: any) => (record?.weekly_actual && record.weekly_actual[d]) ?? 0,
        }))
      : months.map((m) => {
          const [y, mon] = m.split('-')
          const periodEndIso = dayjs(`${m}-01`).endOf('month').format('YYYY-MM-DD')
          return {
            title: `${y}年${parseInt(mon, 10)}月`,
            key: `monthly_${m}`,
            width: 110,
            align: 'center' as const,
            periodEndIso,
            getVal: (record: any) => {
              const w = record?.weekly ?? {}
              return Object.entries(w).reduce((sum, [dateStr, v]) => {
                if (dateStr.startsWith(m + '-')) {
                  const n = typeof v === 'number' ? v : parseFloat(String(v || 0))
                  return sum + (Number.isFinite(n) ? n : 0)
                }
                return sum
              }, 0)
            },
            getActualVal: (record: any) => {
              const wa = record?.weekly_actual ?? {}
              return Object.entries(wa).reduce((sum, [dateStr, v]) => {
                if (dateStr.startsWith(m + '-')) {
                  const n = typeof v === 'number' ? v : parseFloat(String(v || 0))
                  return sum + (Number.isFinite(n) ? n : 0)
                }
                return sum
              }, 0)
            },
          }
        })

    const handleStatusCellClick = (groupName: string, status: string | null) => {
      setSummaryRowStatusFilters(prev => ({ ...prev, [groupName]: status }))
      if (!expandedSummaryRowKeys.includes(groupName)) {
        setExpandedSummaryRowKeys(prev => [...prev, groupName])
      }
    }

    const cols: any[] = [
      {
        title: groupLabel,
        dataIndex: 'group_name',
        key: 'group_name',
        width: 150,
        fixed: 'left' as const,
        ellipsis: true,
        align: 'center' as const,
        render: (v: string, record: any) => (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '45px', lineHeight: '1.2' }}>
            <div style={{ fontWeight: 600 }}>{v}</div>
            {summaryGroupBy === 'work_package' && record.description && (
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: 2 }}>{record.description}</div>
            )}
          </div>
        ),
      },
      {
        title: groupTitle('总量及完成量', 'rgba(34, 139, 34, 0.9)'),
        children: [
          {
            title: '总量',
            dataIndex: 'key_qty',
            key: 'key_qty',
            width: 110,
            align: 'center' as const,
            render: (v: number) => (
              <div style={{ minHeight: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontWeight: 600 }}>{formatQuantity(v ?? 0, 3, '-', true)}</span>
              </div>
            ),
          },
          {
            title: '完成量',
            dataIndex: 'completed',
            key: 'completed',
            width: 110,
            align: 'center' as const,
            render: (v: number) => (
              <div style={{ minHeight: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontWeight: 600 }}>{formatQuantity(v ?? 0, 3, '-', true)}</span>
              </div>
            ),
          },
          {
            title: '剩余量',
            dataIndex: 'remaining_qty',
            key: 'remaining_qty',
            width: 110,
            align: 'center' as const,
            render: (v: number) => (
              <div style={{ minHeight: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontWeight: 600 }}>{formatQuantity(v ?? 0, 3, '-', true)}</span>
              </div>
            ),
          },
        ],
      },
      {
        title: groupTitle('周期计划量', 'rgba(250, 140, 22, 0.9)'),
        children: [
          ...periodCols.map((c) => ({
            title: c.title,
            key: c.key,
            width: c.width,
            align: c.align,
            render: (_: unknown, record: any) => {
              const val = c.getVal(record)
              const total = record?.total_planned_units ?? 0
              const percent = total > 0 ? (val / total) * 100 : 0
              const actualVal = showCompareActual && c.getActualVal ? c.getActualVal(record) : undefined
              const showActual = showCompareActual && actualVal !== undefined
              const periodEndIso = (c as any).periodEndIso as string | undefined
              const isPastOrToday = periodEndIso && periodEndIso <= todayIso
              let bgColor: string | undefined
              if (showActual && isPastOrToday && typeof val === 'number' && typeof actualVal === 'number' && val > 0) {
                const ratio = actualVal / val
                if (ratio < 0.7) bgColor = 'rgba(255, 77, 79, 0.12)'
                else if (ratio < 0.9) bgColor = 'rgba(250, 173, 20, 0.18)'
                else bgColor = 'rgba(82, 196, 26, 0.12)'
              }
              return (
                <div style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: showActual ? '52px' : '45px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '-4px -8px',
                  padding: '4px 8px',
                  backgroundColor: bgColor,
                }}>
                  {!showActual && total > 0 && (
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(percent, 100)}%`, backgroundColor: '#fa8c16', opacity: 0.1, zIndex: 0 }} />
                  )}
                  <div style={{ zIndex: 1, textAlign: 'center', width: '100%' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px' }}>{formatQuantity(val, 3, '-', true)}</div>
                    {!showActual && total > 0 && <div style={{ fontSize: '10px', color: '#595959' }}>{percent.toFixed(1)}%</div>}
                    {showActual && (
                      <div style={{ fontSize: '10px', color: '#1890ff', marginTop: 2, borderTop: '1px solid #e8e8e8', paddingTop: 2 }}>
                        实际: {formatQuantity(actualVal, 3, '-', true)}
                        {typeof val === 'number' && val > 0 && typeof actualVal === 'number' && (
                          <span style={{ marginLeft: 4, color: '#595959' }}>
                            ({((actualVal / val) * 100).toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            },
          })),
          {
            title: '周期汇总',
            dataIndex: 'total_planned_units',
            key: 'total_planned_units',
            width: 120,
            align: 'center' as const,
            render: (v: number, record: any) => {
              const totalActual = showCompareActual && record?.weekly_actual
                ? Object.values(record.weekly_actual).reduce((s: number, val: any) => s + (Number(val) || 0), 0)
                : undefined
              const showActual = showCompareActual && totalActual !== undefined
              const totalPlan = Number(v) || 0
              const totalActualNum = typeof totalActual === 'number' ? totalActual : 0
              const pctStr = totalPlan > 0 ? ((totalActualNum / totalPlan) * 100).toFixed(1) : null
              return (
                <div style={{ minHeight: showActual ? '52px' : '45px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 8px' }}>
                  <span style={{ fontWeight: 700, color: '#262626' }}>{formatQuantity(v, 3, '-', true)}</span>
                  {showActual && (
                    <div style={{ fontSize: '10px', color: '#1890ff', marginTop: 2, borderTop: '1px solid #e8e8e8', paddingTop: 2 }}>
                      实际: {formatQuantity(totalActual, 3, '-', true)}
                      {pctStr != null && (
                        <span style={{ marginLeft: 4, color: '#595959' }}>({pctStr}%)</span>
                      )}
                    </div>
                  )}
                </div>
              )
            },
          },
        ],
      },
      {
        title: groupTitle('问题解决状态', 'rgba(24, 144, 255, 0.9)'),
        fixed: 'right' as const,
        children: [
          {
            title: '待处理',
            dataIndex: 'issue_count_pending',
            key: 'issue_count_pending',
            width: 50,
            align: 'center' as const,
            render: (v: number, record: any) => (
              <div 
                style={{ minHeight: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                onClick={() => handleStatusCellClick(record.group_name, 'pending')}
              >
                <Tag color="orange" style={{ margin: 0 }}>{formatQuantity(v ?? 0, 0, '-')}</Tag>
              </div>
            ),
          },
          {
            title: '处理中',
            dataIndex: 'issue_count_in_progress',
            key: 'issue_count_in_progress',
            width: 50,
            align: 'center' as const,
            render: (v: number, record: any) => (
              <div 
                style={{ minHeight: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                onClick={() => handleStatusCellClick(record.group_name, 'in_progress')}
              >
                <Tag color="blue" style={{ margin: 0 }}>{formatQuantity(v ?? 0, 0, '-')}</Tag>
              </div>
            ),
          },
          {
            title: '已解决',
            dataIndex: 'issue_count_resolved',
            key: 'issue_count_resolved',
            width: 50,
            align: 'center' as const,
            render: (v: number, record: any) => (
              <div 
                style={{ minHeight: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                onClick={() => handleStatusCellClick(record.group_name, 'resolved')}
              >
                <Tag color="success" style={{ margin: 0 }}>{formatQuantity(v ?? 0, 0, '-')}</Tag>
              </div>
            ),
          },
          {
            title: '超期',
            dataIndex: 'issue_count_overdue',
            key: 'issue_count_overdue',
            width: 50,
            align: 'center' as const,
            render: (v: number, record: any) => (
              <div 
                style={{ minHeight: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                onClick={() => handleStatusCellClick(record.group_name, 'overdue')}
              >
                <Tag color="error" style={{ margin: 0 }}>{formatQuantity(v ?? 0, 0, '-')}</Tag>
              </div>
            ),
          },
          {
            title: '合计',
            key: 'issue_count_total',
            width: 50,
            align: 'center' as const,
            render: (_: unknown, record: any) => {
              const p = record?.issue_count_pending ?? 0
              const ip = record?.issue_count_in_progress ?? 0
              const r = record?.issue_count_resolved ?? 0
              const total = p + ip + r
              return (
                <div 
                  style={{ minHeight: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  onClick={() => handleStatusCellClick(record.group_name, null)}
                >
                  <span style={{ fontWeight: 600 }}>{formatQuantity(total, 0, '-')}</span>
                </div>
              )
            },
          },
        ],
      },
      {
        title: groupTitle('审批状态', 'rgba(235, 47, 150, 0.9)'),
        fixed: 'right' as const,
        children: [
          {
            title: '作业数',
            dataIndex: 'activity_count',
            key: 'activity_count',
            width: 50,
            align: 'center' as const,
            render: (v: number) => (
              <div style={{ minHeight: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontWeight: 600 }}>{formatQuantity(v, 0, '-')}</span>
              </div>
            ),
          },
          {
            title: '已审核',
            dataIndex: 'count_reviewed',
            key: 'count_reviewed',
            width: 50,
            align: 'center' as const,
            render: (v: number, record: any) => {
              const total = record?.activity_count ?? 0
              const percent = total > 0 ? (v / total) * 100 : 0
              return (
                <div style={{ position: 'relative', width: '100%', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-4px -8px', padding: '0 8px' }}>
                  {total > 0 && (
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(percent, 100)}%`, backgroundColor: '#eb2f96', opacity: 0.1, zIndex: 0 }} />
                  )}
                  <div style={{ zIndex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '12px' }}>{formatQuantity(v, 0, '-')}</div>
                    {total > 0 && <div style={{ fontSize: '10px', color: '#595959' }}>{percent.toFixed(1)}%</div>}
                  </div>
                </div>
              )
            },
          },
          {
            title: '已批准',
            dataIndex: 'count_approved',
            key: 'count_approved',
            width: 50,
            align: 'center' as const,
            render: (v: number, record: any) => {
              const total = record?.activity_count ?? 0
              const percent = total > 0 ? (v / total) * 100 : 0
              return (
                <div style={{ position: 'relative', width: '100%', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-4px -8px', padding: '0 8px' }}>
                  {total > 0 && (
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(percent, 100)}%`, backgroundColor: '#eb2f96', opacity: 0.1, zIndex: 0 }} />
                  )}
                  <div style={{ zIndex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '12px' }}>{formatQuantity(v, 0, '-')}</div>
                    {total > 0 && <div style={{ fontSize: '10px', color: '#595959' }}>{percent.toFixed(1)}%</div>}
                  </div>
                </div>
              )
            },
          },
        ],
      },
    ]
    return cols
  }, [summaryData?.thursdays, summaryGroupBy, summaryTimeGranularity, showCompareActual])

  // 作业池相关
  const { data: poolData, isLoading: poolLoading } = useQuery({
    queryKey: ['activities-advanced-pool', poolFilters, poolModalVisible],
    queryFn: () =>
      activityService.getActivitiesAdvanced({
        filters: poolFilters,
        skip: 0,
        limit: 0, // 0 表示不限制，作业池返回全部
        order_by: [{ field: 'work_package', order: 'asc' }],
      }),
    enabled: poolModalVisible,
  })
  const { data: recommendedData, isFetching: isFetchingRecommended } = useQuery({
    queryKey: ['ahead-plan-recommended-ids', poolModalVisible, loadRecommendedRequested],
    queryFn: () => aheadPlanService.getRecommendedActivityIds(),
    enabled: poolModalVisible && loadRecommendedRequested,
  })
  const recommendedIds = recommendedData?.activity_ids ?? []
  const poolActivities: Activity[] = poolData?.items ?? []
  
  // 不再默认为用户勾选推荐作业；用户可点击「勾选推荐」按钮手动选择

  const poolFiltered = useMemo(() => {
    const set = new Set(recommendedIds)
    let list = poolActivities
    if (poolSearch.trim()) {
      const t = poolSearch.trim().toLowerCase()
      list = list.filter(
        (a) =>
          (a.activity_id || '').toLowerCase().includes(t) ||
          (a.title || '').toLowerCase().includes(t)
      )
    }
    return [...list].sort((a, b) => {
      const aRec = set.has(a.activity_id)
      const bRec = set.has(b.activity_id)
      if (aRec && !bRec) return -1
      if (!aRec && bRec) return 1
      const wpA = (a.work_package ?? '').toString()
      const wpB = (b.work_package ?? '').toString()
      return wpA.localeCompare(wpB, 'zh-CN') || (a.activity_id || '').localeCompare(b.activity_id || '')
    })
  }, [poolActivities, poolSearch, recommendedIds])

  // 作业池批量加入时每批数量（后端已优化为批量查询+批量插入，可适当加大以减少请求次数）
  const POOL_BATCH_SIZE = 400
  const handlePoolOk = useCallback(async () => {
    if (selectedPoolIds.length === 0) {
      messageApi.warning('请至少选择一条作业')
      return
    }
    const poolMap = new Map(poolFiltered.map((a) => [a.activity_id, a]))
    const idsToAdd = selectedPoolIds.filter((id) => {
      const row = poolMap.get(id)
      return row && row.status !== 'Completed'
    })
    if (idsToAdd.length === 0) {
      messageApi.warning('所选作业均为已关闭状态，不可加入计划')
      return
    }
    if (idsToAdd.length < selectedPoolIds.length) {
      messageApi.info(`已排除 ${selectedPoolIds.length - idsToAdd.length} 条已关闭作业，将加入 ${idsToAdd.length} 条`)
    }
    setPoolAdding(true)
    const chunks: string[][] = []
    for (let i = 0; i < idsToAdd.length; i += POOL_BATCH_SIZE) {
      chunks.push(idsToAdd.slice(i, i + POOL_BATCH_SIZE))
    }
    let totalCreated = 0
    let totalSkipped = 0
    const allErrors: string[] = []
    const hideLoading = messageApi.loading(
      `正在分批加入（共 ${chunks.length} 批，每批最多 ${POOL_BATCH_SIZE} 条）...`,
      0
    )
    try {
      for (let i = 0; i < chunks.length; i++) {
        const res = await aheadPlanService.batchAdd({
          period_start: periodStart,
          period_end: periodEnd,
          type_of_plan: typeOfPlan,
          activity_ids: chunks[i],
        })
        totalCreated += res.created ?? 0
        totalSkipped += res.skipped ?? 0
        if (res.errors?.length) allErrors.push(...res.errors)
      }
      hideLoading()
      messageApi.success(
        `已加入：新增 ${totalCreated} 条，已存在跳过 ${totalSkipped} 条${allErrors.length ? `；${allErrors.length} 条失败` : ''}`
      )
      setPoolModalVisible(false)
      setSelectedPoolIds([])
      queryClient.invalidateQueries({ queryKey: ['ahead-plan'] })
      queryClient.invalidateQueries({ queryKey: ['ahead-plan-view'] })
    } catch (e: any) {
      hideLoading()
      messageApi.error(e?.response?.data?.detail || e?.message || '加入失败')
    } finally {
      setPoolAdding(false)
    }
  }, [periodStart, periodEnd, typeOfPlan, selectedPoolIds, poolFiltered, messageApi, queryClient])

  // 本地修改状态管理
  const [localWeekly, setLocalWeekly] = useState<Record<string, Record<string, string>>>({})
  const [localRemarks, setLocalRemarks] = useState<Record<string, string>>({})
  const [localUserDefinedNames, setLocalUserDefinedNames] = useState<Record<string, string>>({})
  
  const updateLocalWeekly = useCallback((activityId: string, date: string, value: string) => {
    setLocalWeekly((prev) => ({
      ...prev,
      [activityId]: { ...(prev[activityId] ?? {}), [date]: value },
    }))
  }, [])

  // 防抖自动保存：计划量、作业描述等，停止输入 1.5 秒后自动保存，无需点击暂存
  const pendingSaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const flushPendingSave = useCallback((key: string, save: () => Promise<void>, clearLocal?: () => void) => {
    if (pendingSaveTimersRef.current.has(key)) {
      clearTimeout(pendingSaveTimersRef.current.get(key)!)
      pendingSaveTimersRef.current.delete(key)
    }
    const timer = setTimeout(async () => {
      pendingSaveTimersRef.current.delete(key)
      try {
        await save()
        clearLocal?.()
      } catch (_) {}
    }, 1500)
    pendingSaveTimersRef.current.set(key, timer)
  }, [])

  useEffect(() => () => {
    pendingSaveTimersRef.current.forEach(t => clearTimeout(t))
    pendingSaveTimersRef.current.clear()
  }, [])

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  // 筛选数据
  const filteredItems = useMemo(() => {
    let list = viewItems
    if (poolFilters && typeof poolFilters === 'object') {
      const filters = poolFilters as any;
      if (Array.isArray(filters.scope) && filters.scope.length > 0) list = list.filter((r) => r.scope != null && filters.scope!.includes(r.scope))
      if (Array.isArray(filters.block) && filters.block.length > 0) list = list.filter((r) => r.block != null && filters.block!.includes(r.block))
      if (Array.isArray(filters.discipline) && filters.discipline.length > 0) list = list.filter((r) => r.discipline != null && filters.discipline!.includes(r.discipline))
      if (Array.isArray(filters.work_package) && filters.work_package.length > 0) list = list.filter((r) => r.work_package != null && filters.work_package!.includes(r.work_package))
      if (Array.isArray(filters.subproject) && filters.subproject.length > 0) list = list.filter((r) => r.subproject != null && filters.subproject!.includes(r.subproject))
      if (Array.isArray(filters.train) && filters.train.length > 0) list = list.filter((r) => r.train != null && filters.train!.includes(r.train))
      if (Array.isArray(filters.unit) && filters.unit.length > 0) list = list.filter((r) => r.unit != null && filters.unit!.includes(r.unit))
      if (Array.isArray(filters.main_block) && filters.main_block.length > 0) list = list.filter((r) => r.main_block != null && filters.main_block!.includes(r.main_block))
      if (Array.isArray(filters.quarter) && filters.quarter.length > 0) list = list.filter((r) => r.quarter != null && filters.quarter!.includes(r.quarter))
      if (Array.isArray(filters.implement_phase) && filters.implement_phase.length > 0) list = list.filter((r) => r.implement_phase != null && filters.implement_phase!.includes(r.implement_phase))
      if (Array.isArray(filters.contract_phase) && filters.contract_phase.length > 0) list = list.filter((r) => r.contract_phase != null && filters.contract_phase!.includes(r.contract_phase))
      if (Array.isArray(filters.bcc_kq_code) && filters.bcc_kq_code.length > 0) list = list.filter((r) => r.bcc_kq_code != null && filters.bcc_kq_code!.includes(r.bcc_kq_code))
    }
    if (activityIdFilter.trim()) {
      const t = activityIdFilter.trim().toLowerCase()
      list = list.filter((r) => (r.activity_id || '').toLowerCase().includes(t))
    }
    if (titleFilter.trim()) {
      const t = titleFilter.toLowerCase()
      list = list.filter((r) => (r.title || '').toLowerCase().includes(t) || (r.remarks || '').toLowerCase().includes(t) || (r.user_defined_activity_name || '').toLowerCase().includes(t))
    }
    return list
  }, [viewItems, poolFilters, activityIdFilter, titleFilter])

  // 分组逻辑
  const { ganttTasks, groupItemCounts } = useMemo(() => {
    const tasks: GanttTask[] = []
    const itemCounts = new Map<string, number>()
    
    if (!filteredItems.length || groupBy.length === 0) {
      return { 
        ganttTasks: filteredItems.map(r => ({
          id: r.activity_id,
          text: r.title || r.activity_id,
          start_date: r.start_date ?? null,
          end_date: r.finish_date ?? null,
          type: 'task' as const,
          activity: r as any
        })),
        groupItemCounts: itemCounts
      }
    }

    interface TreeNode {
      id: string
      key: string
      value: string
      level: number
      children: Map<string, TreeNode>
      activities: AheadPlanViewRow[]
    }
    
    const root: TreeNode = { id: 'root', key: 'root', value: 'root', level: -1, children: new Map(), activities: [] }
    
    filteredItems.forEach((row) => {
      let node = root
      for (let i = 0; i < groupBy.length; i++) {
        const val = (row as any)[groupBy[i]] ?? '(空)'
        const nodeKey = `${i}_${val}`
        if (!node.children.has(nodeKey)) {
          const path = i === 0 ? val : `${node.id.replace('__group__', '')}|${val}`
          node.children.set(nodeKey, { 
            id: `__group__${path}`,
            key: nodeKey, 
            value: val, 
            level: i, 
            children: new Map(), 
            activities: [] 
          })
        }
        node = node.children.get(nodeKey)!
      }
      node.activities.push(row)
    })

    const countItems = (n: TreeNode): number => {
      const count = n.activities.length + Array.from(n.children.values()).reduce((s, c) => s + countItems(c), 0)
      if (n.level >= 0) itemCounts.set(n.id, count)
      return count
    }
    countItems(root)

    const traverse = (node: TreeNode, parentId?: string) => {
      if (node.level >= 0) {
        const isExpanded = expandedGroups.get(node.id) ?? true
        tasks.push({
          id: node.id,
          text: node.value,
          start_date: null,
          end_date: null,
          type: 'project',
          parent: parentId,
          open: isExpanded
        })
        
        if (!isExpanded) return
      }
      
      Array.from(node.children.entries())
        .sort((a, b) => String(a[1].value).localeCompare(String(b[1].value)))
        .forEach(([, child]) => traverse(child, node.level >= 0 ? node.id : undefined))
        
      if (node.level >= 0 && (expandedGroups.get(node.id) ?? true)) {
        node.activities.forEach(r => {
          tasks.push({
            id: r.activity_id,
            text: r.title || r.activity_id,
            start_date: r.start_date ?? null,
            end_date: r.finish_date ?? null,
            type: 'task',
            parent: node.id,
            activity: r as any
          })
        })
      }
    }
    
    traverse(root)
    return { ganttTasks: tasks, groupItemCounts: itemCounts }
  }, [filteredItems, groupBy, expandedGroups])

  const handleGroupToggle = useCallback((groupId: string, isExpanded: boolean) => {
    setExpandedGroups((prev) => {
      const next = new Map(prev)
      next.set(groupId, !isExpanded)
      return next
    })
  }, [])

  const handleGroupSelectAll = useCallback((groupId: string) => {
    const idsInGroup = ganttTasks
      .filter(t => t.type !== 'project' && (t as GanttTask).parent === groupId)
      .map(t => String(t.id))
    setSelectedActivityIds(idsInGroup)
  }, [ganttTasks])

  const handleTaskClick = useCallback((task: GanttTask, e?: React.MouseEvent) => {
    if (task.type === 'project') return
    const taskId = String(task.id)
    const taskIds = ganttTasks.filter(t => t.type !== 'project').map(t => String(t.id))
    const currentIndex = taskIds.indexOf(taskId)

    if (e?.ctrlKey || e?.metaKey) {
      // Ctrl/Cmd+点击：切换选中状态（加入或移除）
      setSelectedActivityIds(prev =>
        prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
      )
      lastClickedTaskIdRef.current = taskId
    } else if (e?.shiftKey) {
      // Shift+点击：区间选择（从上次点击到当前）
      const anchorId = lastClickedTaskIdRef.current
      const anchorIndex = anchorId ? taskIds.indexOf(anchorId) : currentIndex
      const start = Math.min(anchorIndex, currentIndex)
      const end = Math.max(anchorIndex, currentIndex)
      const rangeIds = taskIds.slice(start, end + 1)
      setSelectedActivityIds(prev => {
        const set = new Set(prev)
        rangeIds.forEach(id => set.add(id))
        return [...set]
      })
    } else {
      // 普通点击：仅选中当前
      setSelectedActivityIds([taskId])
      lastClickedTaskIdRef.current = taskId
    }
  }, [ganttTasks])

  const getWeeklyValue = useCallback(
    (row: AheadPlanViewRow, date: string) =>
      localWeekly[row.activity_id]?.[date] ?? row.weekly?.[date] ?? '',
    [localWeekly]
  )

  const getFirstPlanId = useCallback(
    (row: AheadPlanViewRow) => {
      if (!row.weekly_ids || !thursdays.length) return Object.values(row.weekly_ids || {})[0]
      return row.weekly_ids[thursdays[0]]
    },
    [thursdays]
  )

  const numericKeys = ['key_qty', 'completed', 'remaining_qty', 'total_planned_units', 'calculated_mhrs', 'weight_factor', 'actual_weight_factor', 'actual_manhour']

  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<{ visible: boolean; percent: number; text: string }>({
    visible: false,
    percent: 0,
    text: '',
  })
  const [importProgress, setImportProgress] = useState<{ visible: boolean; percent: number; text: string }>({
    visible: false,
    percent: 0,
    text: '',
  })
  const [importConfirmVisible, setImportConfirmVisible] = useState(false)
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastClickedTaskIdRef = useRef<string | null>(null) // Shift+点击区间选择时的锚点

  const handleExport = useCallback(async () => {
    setExporting(true)
    setExportProgress({ visible: true, percent: 0, text: '正在获取数据...' })
    try {
      const exportCols = visibleColumns.map(key => {
        const def = AVAILABLE_COLUMNS.find(c => c.key === key)
        return {
          key,
          title: def?.title || key,
          width: columnWidths[key] || def?.width || 120
        }
      })
      // 加上备注和意见
      exportCols.push({ key: 'remarks', title: '备注', width: columnWidths.remarks || 200 })

      setExportProgress({ visible: true, percent: 30, text: '正在生成Excel文件...' })
      const blob = await aheadPlanService.exportXlsx({
        type_of_plan: typeOfPlan,
        period_start: periodStart,
        period_end: periodEnd,
        columns: exportCols,
        filters: {
          ...poolFilters,
          activity_id: activityIdFilter,
          title: titleFilter,
        }
      })

      setExportProgress({ visible: true, percent: 90, text: '正在下载...' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `AheadPlan_${baseTypeOfPlan}_${periodStart}_${periodEnd}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      setExportProgress({ visible: false, percent: 0, text: '' })
      messageApi.success('导出成功')
    } catch (e: any) {
      setExportProgress({ visible: false, percent: 0, text: '' })
      messageApi.error(e?.message || '导出失败')
    } finally {
      setExporting(false)
    }
  }, [typeOfPlan, periodStart, periodEnd, visibleColumns, columnWidths, poolFilters, activityIdFilter, titleFilter, baseTypeOfPlan, messageApi])

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setPendingImportFile(file)
    setImportConfirmVisible(true)
  }, [])

  const handleImportCancel = useCallback(() => {
    setImportConfirmVisible(false)
    setPendingImportFile(null)
  }, [])

  const doImportFromFile = useCallback(
    async (file: File) => {
      setImportConfirmVisible(false)
      setPendingImportFile(null)
      setImporting(true)
      setImportProgress({ visible: true, percent: 0, text: '正在解析Excel文件...' })
      try {
        const arrayBuffer = await file.arrayBuffer()
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(arrayBuffer)
        const ws = workbook.getWorksheet(1)
        if (!ws) throw new Error('Excel 文件中没有工作表')

        const keyRow = 4
        const dataStartRow = 6

        let actIdCol: number | null = null
        let remarksCol: number | null = null
        let udNameCol: number | null = null
        const dateCols: Record<number, string> = {}

        const keyRowObj = ws.getRow(keyRow)
        for (let c = 1; c <= (ws.columnCount || 100); c++) {
          const val = keyRowObj.getCell(c).value
          if (val == null) continue
          const s = String(val).trim()
          if (s === 'activity_id') actIdCol = c
          else if (s === 'remarks') remarksCol = c
          else if (s === 'user_defined_activity_name') udNameCol = c
          else if (s.includes('-') && s.length >= 8) dateCols[c] = s
        }

        if (!actIdCol) throw new Error('Excel 格式错误：未找到 activity_id 列')

        setImportProgress({ visible: true, percent: 5, text: '正在读取数据行...' })
        const importRecords: Array<{ activity_id: string; remarks?: string | null; user_defined_activity_name?: string | null; weekly: Record<string, string> }> = []

        for (let r = dataStartRow; r <= ws.rowCount; r++) {
          const actVal = ws.getRow(r).getCell(actIdCol).value
          if (actVal == null || String(actVal).trim() === '' || String(actVal).includes('签字') || String(actVal).includes('Sign')) break
          const activityId = String(actVal).trim()
          const weekly: Record<string, string> = {}
          for (const [col, dateStr] of Object.entries(dateCols)) {
            const cellVal = ws.getRow(r).getCell(Number(col)).value
            const v = cellVal != null && String(cellVal).trim() !== '' ? String(cellVal) : '0'
            weekly[dateStr] = v
          }
          const remarks = remarksCol ? (ws.getRow(r).getCell(remarksCol).value as string | null) : null
          const udName = udNameCol ? (ws.getRow(r).getCell(udNameCol).value as string | null) : null
          importRecords.push({
            activity_id: activityId,
            remarks: remarks != null ? String(remarks) : null,
            user_defined_activity_name: udName != null ? String(udName) : null,
            weekly,
          })
        }

        if (importRecords.length === 0) {
          setImportProgress({ visible: false, percent: 0, text: '' })
          messageApi.warning('Excel 中没有有效数据')
          return
        }

        const CHUNK_SIZE = 200
        const chunks: typeof importRecords[] = []
        for (let i = 0; i < importRecords.length; i += CHUNK_SIZE) {
          chunks.push(importRecords.slice(i, i + CHUNK_SIZE))
        }

        let totalCreated = 0
        let totalUpdated = 0
        const allErrors: string[] = []
        const allSkipped: Array<{ activity_id: string; reason: string }> = []

        for (let i = 0; i < chunks.length; i++) {
          const progress = Math.round(((i + 1) / chunks.length) * 90) + 5
          setImportProgress({
            visible: true,
            percent: progress,
            text: `正在导入... ${progress}% (${Math.min((i + 1) * CHUNK_SIZE, importRecords.length)}/${importRecords.length})`,
          })
          const res = await aheadPlanService.batchImportRecords(typeOfPlan, chunks[i])
          totalCreated += res.created
          totalUpdated += res.updated
          if (res.errors?.length) allErrors.push(...res.errors)
          if (res.skipped?.length) allSkipped.push(...res.skipped)
        }

        setImportProgress({ visible: false, percent: 100, text: '导入完成' })
        const skippedPart = allSkipped.length ? `；${allSkipped.length} 条已审核/批准跳过` : ''
        messageApi.success(`导入成功：新增 ${totalCreated} 条，更新 ${totalUpdated} 条${allErrors.length ? `；${allErrors.length} 条失败` : ''}${skippedPart}`)
        if (allErrors.length) console.error('Import errors:', allErrors)
        if (allSkipped.length) {
          setImportSkippedResult(allSkipped)
        } else {
          setImportSkippedResult(null)
        }
        queryClient.invalidateQueries({ queryKey: ['ahead-plan-view'] })
      } catch (e: any) {
        setImportProgress({ visible: false, percent: 0, text: '' })
        const detail = e?.response?.data?.detail
        const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.join('; ') : (e?.message || '导入失败')
        messageApi.error({ content: msg, duration: 8 })
      } finally {
        setImporting(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [typeOfPlan, messageApi, queryClient]
  )

  const handleImportConfirm = useCallback(() => {
    if (!pendingImportFile) return
    doImportFromFile(pendingImportFile)
  }, [pendingImportFile, doImportFromFile])

  const handleBatchApprove = useCallback(
    async (activityIds: string[], action: 'review' | 'approve' | 'revoke_review' | 'revoke_approve') => {
      if (activityIds.length === 0) return
      setApproving(true)
      try {
        const res = await aheadPlanService.batchApprove({
          type_of_plan: typeOfPlan,
          period_start: periodStart,
          period_end: periodEnd,
          activity_ids: activityIds,
          action,
        })
        const actionLabels: Record<string, string> = {
          review: '审核',
          approve: '批准',
          revoke_review: '撤销审核',
          revoke_approve: '撤销批准',
        }
        messageApi.success(`${actionLabels[action] || action} 已更新 ${res.updated} 条`)
        queryClient.invalidateQueries({ queryKey: ['ahead-plan-view'] })
      } catch (e: any) {
        messageApi.error(e?.response?.data?.detail || e?.message || '操作失败')
      } finally {
        setApproving(false)
      }
    },
    [typeOfPlan, periodStart, periodEnd, messageApi, queryClient]
  )

  // 栏位配置适配 GanttColumn
  const columns = useMemo((): GanttColumn[] => {
    const selectionCol: GanttColumn = {
      key: 'selection',
      title: '',
      width: 40,
      align: 'center',
      fixed: 'left', // 固定第一列：勾选框
      render: (_, task) => {
        if (task.type === 'project') return null
        const isSelected = selectedActivityIds.includes(String(task.id))
        return (
          <div className={`gantt-selection-circle ${isSelected ? 'selected' : ''}`}>
            {isSelected && <div className="inner-dot" />}
          </div>
        )
      }
    }

    const baseCols: GanttColumn[] = visibleColumns.map((key, index) => {
      const def = AVAILABLE_COLUMNS.find(c => c.key === key)
      const w = columnWidths[key] || def?.width || 120
      
      // 固定第二、三、四列：通常是 状态、作业代码、作业描述
      // 注意：selectionCol 是第 0 列，所以 visibleColumns 的前三列是总计的前四列
      const isFixed = index < 3; 

      return {
        key,
        title: def?.title || key,
        width: w,
        fixed: isFixed ? 'left' : undefined,
        align: def?.align || (numericKeys.includes(key) ? 'right' : 'left'),
        render: (val, task) => {
          if (task.type === 'project') return null
          const r = task.activity as unknown as AheadPlanViewRow
          if (!r) return null
          
          if (key === 'status') {
            const roundedRectStyle: React.CSSProperties = {
              width: '14px', height: '10px', borderRadius: '2px', display: 'inline-block',
              border: '1px solid rgba(0,0,0,0.3)', verticalAlign: 'middle'
            }
            const status = (r as any).system_status || 'Not Started'
            if (status === 'Completed') return <span style={{ ...roundedRectStyle, backgroundColor: '#0000FF' }} title="Completed" />
            if (status === 'In Progress') return <span style={{ ...roundedRectStyle, background: 'linear-gradient(to right, #0000FF 50%, #00FF00 50%)' }} title="In Progress" />
            return <span style={{ ...roundedRectStyle, backgroundColor: '#00FF00' }} title="Not Started" />
          }

          if (key === 'user_defined_activity_name') {
            const v = localUserDefinedNames[r.activity_id] !== undefined ? localUserDefinedNames[r.activity_id] : (r.user_defined_activity_name ?? '')
            if (!canModifyPlan) {
              return (
                <Tooltip title="当月 25 日后仅管理员可修改作业描述">
                  <span style={{ display: 'block', fontSize: 11, width: '100%', padding: '4px 8px', color: '#000' }}>{v || '-'}</span>
                </Tooltip>
              )
            }
            return (
              <InputWithIME
                size="small"
                value={v}
                onChange={(e) => {
                  const newVal = e.target.value
                  setLocalUserDefinedNames(p => ({ ...p, [r.activity_id]: newVal }))
                  const allPlanIds = Object.values(r.weekly_ids || {})
                  if (allPlanIds.length > 0) {
                    const payload = { user_defined_activity_name: newVal.trim() || null }
                    flushPendingSave(`ud_${r.activity_id}`,
                      () => aheadPlanService.batchUpdate(allPlanIds.map(id => ({ plan_id: id, ...payload }))).then(() => {}),
                      () => queryClient.invalidateQueries({ queryKey: ['ahead-plan-view'] })
                    )
                  }
                }}
                onBlur={async (e) => {
                  const key = `ud_${r.activity_id}`
                  if (pendingSaveTimersRef.current.has(key)) { clearTimeout(pendingSaveTimersRef.current.get(key)!); pendingSaveTimersRef.current.delete(key) }
                  const newVal = e.target.value.trim()
                  const allPlanIds = Object.values(r.weekly_ids || {})
                  if (allPlanIds.length === 0) return
                  try {
                    await aheadPlanService.batchUpdate(allPlanIds.map(id => ({ plan_id: id, user_defined_activity_name: newVal || null })))
                    queryClient.invalidateQueries({ queryKey: ['ahead-plan-view'] }).then(() => {
                        setLocalUserDefinedNames(p => { 
                            const n = { ...p }; 
                            if (n[r.activity_id] === newVal || n[r.activity_id] === (newVal || '')) {
                                delete n[r.activity_id]; 
                            }
                            return n 
                        })
                    })
                  } catch (_) {}
                }}
                style={{ fontSize: 11, width: '100%' }}
              />
            )
          }
          
          if (numericKeys.includes(key)) return formatQuantity(val)
          if (key.includes('date') && val) return dayjs(val).format('YYYY-MM-DD')
          return val ?? '-'
        }
      }
    })

    const weeklyCols: GanttColumn[] = thursdays.map(d => ({
      key: `w_${d}`,
      title: d,
      width: columnWidths[`w_${d}`] || 88,
      align: 'center',
      render: (_, task) => {
        if (task.type === 'project') return null
        const r = task.activity as unknown as AheadPlanViewRow
        const planId = r.weekly_ids?.[d]
        const rawVal = getWeeklyValue(r, d)
        const isLocal = localWeekly[r.activity_id]?.[d] !== undefined
        // 0 默认不填写
        const isZero = !isLocal && (String(rawVal) === '0' || (typeof rawVal === 'number' && Math.abs(rawVal) < 0.000001))
        const displayVal = (rawVal === '' || rawVal == null || isZero) ? '' : (isLocal ? rawVal : formatHighPrecisionValue(rawVal))
        const wkey = `w_${r.activity_id}_${d}`
        const isLockedByReview = !!(r.reviewed_at || r.approved_at)
        const isLockedBy25 = !canModifyPlan
        const isLocked = isLockedByReview || isLockedBy25
        if (isLocked) {
          const lockTip = isLockedBy25 ? '当月 25 日后仅管理员可修改计划量' : '已审核/已批准状态下不可修改计划量，可在意见栏交流'
          return (
            <Tooltip title={lockTip}>
              <span style={{ display: 'block', width: '100%', textAlign: 'center', fontSize: 11, color: '#000', padding: '4px 8px' }}>{displayVal}</span>
            </Tooltip>
          )
        }
        return (
          <InputWithIME
            size="small"
            value={displayVal}
            onChange={(e) => {
              const v = e.target.value
              updateLocalWeekly(r.activity_id, d, v)
              if (planId != null) {
                flushPendingSave(wkey,
                  () => aheadPlanService.update(planId, { planned_units: v === '' ? 0 : Number(v) }).then(() => {}),
                  () => queryClient.invalidateQueries({ queryKey: ['ahead-plan-view'] }) // 仅刷新缓存，不清空本地输入
                )
              }
            }}
            onBlur={async (e) => {
              if (pendingSaveTimersRef.current.has(wkey)) { clearTimeout(pendingSaveTimersRef.current.get(wkey)!); pendingSaveTimersRef.current.delete(wkey) }
              const v = (e.target as HTMLInputElement).value
              if (planId == null) return
              const savedNum = v === '' ? 0 : Number(v)
              try {
                await aheadPlanService.update(planId, { planned_units: savedNum })
                // 先等列表 refetch 完成再清本地状态，避免清空后仍用旧缓存渲染导致“改完又变回原值”
                await queryClient.refetchQueries({ queryKey: ['ahead-plan-view', periodStart, periodEnd, typeOfPlan] })
                const fresh = queryClient.getQueryData<{ items: AheadPlanViewRow[] }>(['ahead-plan-view', periodStart, periodEnd, typeOfPlan])
                const serverRow = fresh?.items?.find((i) => i.activity_id === r.activity_id)
                const serverVal = serverRow?.weekly?.[d]
                const serverNum = serverVal === '' || serverVal == null ? 0 : Number(serverVal)
                const matches = serverNum === savedNum
                if (matches) {
                  setLocalWeekly(p => {
                    const next = { ...p }
                    if (next[r.activity_id] && (next[r.activity_id][d] === v || next[r.activity_id][d] === (v || ''))) {
                      const row = { ...next[r.activity_id] }
                      delete row[d]
                      if (Object.keys(row).length === 0) delete next[r.activity_id]
                      else next[r.activity_id] = row
                    }
                    return next
                  })
                }
              } catch (_) {}
            }}
            style={{ width: '100%', textAlign: 'center', fontSize: 11 }}
          />
        )
      }
    }))

    const extraCols: GanttColumn[] = [
      {
        key: 'remarks',
        title: '备注',
        width: columnWidths.remarks || 200,
        render: (_, task) => {
          if (task.type === 'project') return null
          const r = task.activity as unknown as AheadPlanViewRow
          const v = localRemarks[r.activity_id] !== undefined ? localRemarks[r.activity_id] : (r.remarks ?? '')
          const isLockedByReview = !!(r.reviewed_at || r.approved_at)
          const isLockedBy25 = !canModifyPlan
          const isLocked = isLockedByReview || isLockedBy25
          if (isLocked) {
            const lockTip = isLockedBy25 ? '当月 25 日后仅管理员可修改备注' : '已审核/已批准状态下不可修改备注，可在意见栏交流'
            return (
              <Tooltip title={lockTip}>
                <span style={{ display: 'block', fontSize: 11, width: '100%', padding: '4px 8px', color: '#000' }}>{v || '-'}</span>
              </Tooltip>
            )
          }
          return (
            <InputWithIME
              size="small"
              value={v}
              onChange={(e) => {
                const newVal = e.target.value
                setLocalRemarks(p => ({ ...p, [r.activity_id]: newVal }))
                const allPlanIds = Object.values(r.weekly_ids || {})
                if (allPlanIds.length > 0) {
                  flushPendingSave(`rem_${r.activity_id}`,
                    () => aheadPlanService.batchUpdate(allPlanIds.map(id => ({ plan_id: id, remarks: newVal.trim() || null }))).then(() => {}),
                    undefined
                  )
                }
              }}
              onBlur={async (e) => {
                const key = `rem_${r.activity_id}`
                if (pendingSaveTimersRef.current.has(key)) { clearTimeout(pendingSaveTimersRef.current.get(key)!); pendingSaveTimersRef.current.delete(key) }
                const newVal = e.target.value.trim()
                const allPlanIds = Object.values(r.weekly_ids || {})
                if (allPlanIds.length === 0) return
                try {
                  await aheadPlanService.batchUpdate(allPlanIds.map(id => ({ plan_id: id, remarks: newVal || null })))
                  queryClient.invalidateQueries({ queryKey: ['ahead-plan-view'] }).then(() => {
                    setLocalRemarks(p => {
                      const n = { ...p };
                      if (n[r.activity_id] === newVal || n[r.activity_id] === (newVal || '')) {
                        delete n[r.activity_id];
                      }
                      return n
                    })
                  })
                } catch (_) {}
              }}
              style={{ fontSize: 11, width: '100%' }}
            />
          )
        }
      },
      {
        key: 'issues',
        title: '问题',
        width: columnWidths.issues ?? 100,
        align: 'center',
        render: (_, task) => {
          if (task.type === 'project') return null
          const r = task.activity as unknown as AheadPlanViewRow
          const stats = r.issue_summary || { total_count: 0, pending_count: 0, overdue_count: 0, all_resolved: true }
          
          if (stats.total_count === 0) {
            return (
              <Button type="link" size="small" style={{ fontSize: 11, color: '#94a3b8' }} onClick={() => {
                setIssueModalContext({ activityId: r.activity_id, typeOfPlan: typeOfPlan, title: (r.title || r.user_defined_activity_name || r.activity_id) as string })
                setIssueModalOpen(true)
              }}>+</Button>
            )
          }

          return (
            <Tooltip title={`${stats.total_count} 个问题 (${stats.pending_count} 个未解决, ${stats.overdue_count} 个已逾期)`}>
              <div 
                style={{ 
                  cursor: 'pointer', 
                  display: 'inline-flex', 
                  alignItems: 'center',
                  background: stats.overdue_count > 0 ? '#fff1f0' : (stats.pending_count > 0 ? '#fffbe6' : '#f6ffed'),
                  border: `1px solid ${stats.overdue_count > 0 ? '#ffa39e' : (stats.pending_count > 0 ? '#ffe58f' : '#b7eb8f')}`,
                  borderRadius: '12px',
                  padding: '0 6px',
                  height: '20px',
                  fontSize: '11px',
                  color: stats.overdue_count > 0 ? '#cf1322' : (stats.pending_count > 0 ? '#d46b08' : '#389e0d'),
                  gap: '4px'
                }}
                onClick={() => {
                  setIssueModalContext({ activityId: r.activity_id, typeOfPlan: typeOfPlan, title: (r.title || r.user_defined_activity_name || r.activity_id) as string })
                  setIssueModalOpen(true)
                }}
              >
                <span style={{ fontWeight: 'bold' }}>{stats.pending_count}</span>
                <span style={{ color: '#bfbfbf' }}>/</span>
                <span>{stats.total_count}</span>
              </div>
            </Tooltip>
          )
        }
      },
      {
        key: 'comments',
        title: '意见',
        width: columnWidths.comments || 80,
        align: 'center',
        render: (_, task) => {
          if (task.type === 'project') return null
          const r = task.activity as unknown as AheadPlanViewRow
          const planId = getFirstPlanId(r)
          const thread = parseRemarksJson(r.comments)
          const count = thread.thread.length
          return (
            <Popover
              content={
                <RemarksCommentsThread
                  rawValue={r.comments}
                  onSave={async (str: string) => {
                    if (planId == null) return
                    await aheadPlanService.update(planId, { comments: str || null })
                    queryClient.invalidateQueries({ queryKey: ['ahead-plan-view'] })
                  }}
                  placeholder="意见/回复…"
                  currentUser={currentUser}
                />
              }
              trigger="click"
              placement="right"
            >
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                <Badge count={count} size="small" offset={[2, 0]} color="#52c41a">
                  <MessageOutlined style={{ fontSize: 16, color: count > 0 ? '#52c41a' : '#d9d9d9' }} />
                </Badge>
              </div>
            </Popover>
          )
        }
      },
      {
        key: 'review',
        title: '审核',
        width: 120,
        align: 'center',
        render: (_, task) => {
          if (task.type === 'project') return null
          const r = task.activity as unknown as AheadPlanViewRow
          const isSupervisor = currentUser?.is_superuser || currentUser?.role_ids?.some(id => [3, 5].includes(id)) || isConstructionSupervisor
          const isManager = currentUser?.is_superuser || currentUser?.role_ids?.includes(2) || isConstructionSupervisor
          const canRevokeReview = r.reviewed_by && !r.approved_by && (r.reviewed_by === currentUser?.username || isManager)
          
          if (r.reviewed_by) {
            return (
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Tooltip title={`审核人: ${r.reviewed_by} (${dayjs(r.reviewed_at).format('MM-DD HH:mm')})`}>
                  <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>已审核</Tag>
                </Tooltip>
                {canRevokeReview && (
                  <Button type="link" size="small" icon={<RollbackOutlined />} style={{ fontSize: 10, height: 20, padding: 0, color: '#ff4d4f' }} onClick={() => handleBatchApprove([r.activity_id], 'revoke_review')}>撤回</Button>
                )}
              </div>
            )
          }
          return isSupervisor ? (
            <Button type="primary" ghost size="small" className="ahead-plan-toolbar-btn-white" style={{ fontSize: 10, height: 22 }} onClick={() => handleBatchApprove([r.activity_id], 'review')}>审核</Button>
          ) : <Tag style={{ fontSize: 10, margin: 0 }}>未审核</Tag>
        }
      },
      {
        key: 'approval',
        title: '批准',
        width: 120,
        align: 'center',
        render: (_, task) => {
          if (task.type === 'project') return null
          const r = task.activity as unknown as AheadPlanViewRow
          const isManager = currentUser?.is_superuser || currentUser?.role_ids?.includes(2) || isConstructionSupervisor
          const isSystemAdmin = currentUser?.is_superuser || currentUser?.username === 'role_system_admin'
          const canRevokeApprove = r.approved_by && (r.approved_by === currentUser?.username || isSystemAdmin || isConstructionSupervisor)
          
          if (r.approved_by) {
            return (
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Tooltip title={`批准人: ${r.approved_by} (${dayjs(r.approved_at).format('MM-DD HH:mm')})`}>
                  <Tag color="green" style={{ fontSize: 10, margin: 0 }}>已批准</Tag>
                </Tooltip>
                {canRevokeApprove && (
                  <Button type="link" size="small" icon={<RollbackOutlined />} style={{ fontSize: 10, height: 20, padding: 0, color: '#ff4d4f' }} onClick={() => handleBatchApprove([r.activity_id], 'revoke_approve')}>撤回</Button>
                )}
              </div>
            )
          }
          return r.reviewed_by ? (
            isManager ? (
              <Button type="primary" size="small" className="ahead-plan-toolbar-btn-white" style={{ fontSize: 10, height: 22 }} onClick={() => handleBatchApprove([r.activity_id], 'approve')}>批准</Button>
            ) : <Tag style={{ fontSize: 10, margin: 0 }}>待批准</Tag>
          ) : <Tag style={{ fontSize: 10, margin: 0, color: '#d9d9d9' }}>待审核</Tag>
        }
      }
    ]

    return [selectionCol, ...baseCols, ...weeklyCols, ...extraCols]
  }, [visibleColumns, columnWidths, thursdays, typeOfPlan, getWeeklyValue, localWeekly, localRemarks, localUserDefinedNames, queryClient, selectedActivityIds, flushPendingSave, currentUser, handleBatchApprove, canModifyPlan, isConstructionSupervisor])

  const handleBatchDelete = useCallback(async () => {
    if (selectedActivityIds.length === 0) {
      messageApi.warning('请先选择要删除的作业')
      return
    }
    const selectedRows = loadedItems.filter((r) => selectedActivityIds.includes(r.activity_id))
    const hasReviewedOrApproved = selectedRows.some((r) => r.reviewed_at || r.approved_at)
    if (hasReviewedOrApproved) {
      messageApi.warning('所选作业中包含已审核或已批准的作业，不允许删除。请取消勾选后再试。')
      return
    }
    setDeleting(true)
    try {
      const res = await aheadPlanService.batchDelete({
        period_start: periodStart,
        period_end: periodEnd,
        type_of_plan: typeOfPlan,
        activity_ids: selectedActivityIds,
      })
      messageApi.success(`已成功删除 ${res.deleted} 条记录`)
      setSelectedActivityIds([])
      queryClient.invalidateQueries({ queryKey: ['ahead-plan-view'] })
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail || e?.message || '删除失败')
    } finally {
      setDeleting(false)
    }
  }, [periodStart, periodEnd, typeOfPlan, selectedActivityIds, loadedItems, messageApi, queryClient])

  // 视图保存
  const saveView = useCallback((viewName: string) => {
    const expandedGroupsObj: Record<string, boolean> = {}
    expandedGroups.forEach((v, k) => { expandedGroupsObj[k] = v })
    const view = {
      id: `view_${Date.now()}`,
      name: viewName,
      groupBy,
      visibleColumns,
      columnWidths,
      expandedGroups: expandedGroupsObj,
    }
    const next = [...savedViews, view]
    localStorage.setItem('ahead-plan-views', JSON.stringify(next))
    setSavedViews(next)
    messageApi.success('视图已保存')
  }, [groupBy, visibleColumns, columnWidths, expandedGroups, savedViews, messageApi])

  const loadView = useCallback((view: typeof savedViews[0]) => {
    setGroupBy(view.groupBy || [])
    setVisibleColumns(view.visibleColumns || [])
    setColumnWidths(view.columnWidths || {})
    const next = new Map<string, boolean>()
    if (view.expandedGroups) Object.entries(view.expandedGroups).forEach(([k, v]) => next.set(k, v))
    setExpandedGroups(next)
    try {
      localStorage.setItem('ahead-plan-last-view-id', view.id)
    } catch (_) {}
    messageApi.success(`已加载视图: ${view.name}`)
  }, [messageApi])

  const deleteView = useCallback((viewId: string) => {
    const next = savedViews.filter(v => v.id !== viewId)
    localStorage.setItem('ahead-plan-views', JSON.stringify(next))
    setSavedViews(next)
    messageApi.success('已删除')
  }, [savedViews, messageApi])

  // 加载保存的视图列表，并自动加载最后一次使用的视图（与 ActivityListAdvanced 逻辑一致）
  useEffect(() => {
    const VIEWS_KEY = 'ahead-plan-views'
    const LAST_VIEW_ID_KEY = 'ahead-plan-last-view-id'

    const parseViews = (): Array<{ id: string; name: string; groupBy: string[]; visibleColumns: string[]; columnWidths: Record<string, number>; expandedGroups?: Record<string, boolean> }> => {
      try {
        const raw = localStorage.getItem(VIEWS_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((v: any) => v && typeof v === 'object' && Array.isArray(v.visibleColumns)) : []
      } catch (_) {
        return []
      }
    }

    const views = parseViews()
    setSavedViews(views)

    const lastViewId = localStorage.getItem(LAST_VIEW_ID_KEY)
    if (lastViewId && views.length > 0) {
      const lastView = views.find((v: any) => v.id === lastViewId)
      if (lastView) {
        setTimeout(() => {
          setGroupBy(lastView.groupBy || [])
          setVisibleColumns(lastView.visibleColumns || [])
          setColumnWidths(lastView.columnWidths || {})
          const next = new Map<string, boolean>()
          if (lastView.expandedGroups) Object.entries(lastView.expandedGroups).forEach(([k, v]) => next.set(k, v))
          setExpandedGroups(next)
        }, 100)
      }
    }
  }, [])

  const moreMenuItems = [
    { key: 'column', icon: <SettingOutlined />, label: '栏位设置', disabled: showSummary, onClick: () => setColumnSettingsVisible(true) },
    { key: 'view', icon: <EyeOutlined />, label: '视图管理', disabled: showSummary, onClick: () => setViewModalVisible(true) },
    { key: 'expand', icon: <ExpandOutlined />, label: '全部展开', disabled: showSummary, onClick: () => setExpandedGroups(new Map()) },
    { key: 'collapse', icon: <CompressOutlined />, label: '全部折叠', disabled: showSummary, onClick: () => {
      const next = new Map();
      ganttTasks.filter(t => t.type === 'project').forEach(t => next.set(String(t.id), false));
      setExpandedGroups(next);
    } },
    { key: 'import', icon: <ImportOutlined />, label: '导入', disabled: showSummary || !canModifyPlan, loading: importing, onClick: () => fileInputRef.current?.click() },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f5f5f5' }}>
      <LegacyModuleBanner
        compact
        title="遗留前置计划 / 专项计划"
        description="该页面服务于工程建设场景的前置条件、问题催办、专项计划版本与责任闭环，不是机械制造项目的默认计划主线。"
        note="机械制造大型设备建议把设计、采购、加工、装配、调试里程碑挂到订单与工单主线，再用制造驾驶舱跟踪交期与异常。"
        actions={[
          { label: '进入制造订单', path: '/manufacturing/orders', type: 'primary' },
          { label: '进入制造驾驶舱', path: '/manufacturing' },
        ]}
      />

      <div style={{ background: '#ffffff', borderBottom: '1px solid #d9d9d9', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, flexWrap: 'nowrap', gap: 4 }}>
        <Space size={4} align="center" wrap={false} style={{ flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>专项计划管理</h2>
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(values) => values && values[0] && values[1] && setDateRange([values[0], values[1]])}
            size="small"
            style={{ width: 168 }}
            allowClear={false}
          />
          <Select
            value={baseTypeOfPlan}
            onChange={setBaseTypeOfPlan}
            size="small"
            style={{ width: 120 }}
            options={planSelectOptions}
            showSearch
            filterOption={(input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
            placeholder="计划类型"
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <Space style={{ padding: '0 8px 8px', width: '100%' }} direction="vertical">
                  <Input
                    placeholder="输入新计划名称，按回车保存并选择"
                    style={{ width: '100%' }}
                    size="small"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim()
                        if (val) {
                          saveCustomTemplate(val)
                          ;(e.target as HTMLInputElement).value = ''
                          messageApi.success(`已保存「${val}」为可用计划模板`)
                        }
                      }
                    }}
                  />
                </Space>
              </>
            )}
          />
          <Select
            value={selectedPlanVersion || undefined}
            onChange={(v) => v ? handleSelectPlanVersion(v) : setSelectedPlanVersion('')}
            size="small"
            style={{ width: 320 }}
            placeholder="计划版本"
            allowClear
            options={existingPlanTypes.map((t) => ({ value: t, label: t }))}
            showSearch
            filterOption={(input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
          />
        </Space>
        <Space size={4} wrap style={{ flexShrink: 0 }}>
          <Tooltip title={showSummary ? '返回列表' : '查看汇总统计'}>
            <Button
              icon={showSummary ? <ReloadOutlined /> : <BarChartOutlined />}
              size="small"
              onClick={() => setShowSummary(!showSummary)}
              type={showSummary ? 'primary' : 'default'}
            >
              {showSummary ? '返回' : '汇总'}
            </Button>
          </Tooltip>
          <InputWithIME placeholder="作业代码" allowClear size="small" style={{ width: 88 }} value={activityIdFilter} onChange={(e) => setActivityIdFilter(e.target.value)} />
          <InputWithIME placeholder="作业描述" allowClear size="small" style={{ width: 88 }} value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)} />
          <Tooltip title="从服务器拉取最新列表数据">
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} size="small">刷新</Button>
          </Tooltip>
          {!showSummary && hasMore && (
            <Button size="small" onClick={handleLoadMore} loading={isLoading}>
              加载更多（已加载 {loadedItems.length}/{viewTotal}）
            </Button>
          )}
          <Button icon={<GroupOutlined />} onClick={() => setGroupingPanelVisible(!groupingPanelVisible)} type={groupingPanelVisible ? 'primary' : 'default'} size="small" disabled={showSummary}>分组</Button>
          <Dropdown menu={{ items: moreMenuItems.map(({ key, icon, label, disabled, onClick }) => ({ key, icon, label, disabled, onClick })) }} trigger={['click']}>
            <Button icon={<MoreOutlined />} size="small">更多</Button>
          </Dropdown>
          <Tooltip title={!canModifyPlan ? '当月 25 日后仅管理员可删除计划' : undefined}>
            <span>
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
                disabled={selectedActivityIds.length === 0 || showSummary || !canModifyPlan}
                loading={deleting}
                onClick={() => setDeleteConfirmVisible(true)}
              >
                删除选中
              </Button>
            </span>
          </Tooltip>
          <Modal
            title="确认删除"
            open={deleteConfirmVisible}
            onCancel={() => setDeleteConfirmVisible(false)}
            onOk={() => {
              handleBatchDelete().finally(() => setDeleteConfirmVisible(false))
            }}
            okText="确定删除"
            cancelText="取消"
            okButtonProps={{ danger: true, loading: deleting }}
            destroyOnClose
          >
            <p>确定要从计划中删除选中的 <strong>{selectedActivityIds.length}</strong> 条作业吗？这些作业将回到作业池。</p>
          </Modal>
          <Tooltip title={!canModifyPlan ? '当月 25 日后仅管理员可从作业池加入' : '从作业池选取作业加入当前计划'}>
            <span>
              <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => { setPoolModalVisible(true); setPoolSearch(''); setSelectedPoolIds([]); setPoolPage(1); setPoolPageSize(50); setLoadRecommendedRequested(false); }} disabled={showSummary || !canModifyPlan}>作业池</Button>
            </span>
          </Tooltip>
          <Button icon={<ExportOutlined />} size="small" onClick={handleExport} loading={exporting} disabled={showSummary}>导出</Button>
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx" onChange={handleImport} />
          {(currentUser?.is_superuser || currentUser?.role_ids?.some(id => [3, 5].includes(id)) || isConstructionSupervisor) && (
            <Button 
              size="small" 
              ghost 
              type="primary" 
              loading={approving} 
              disabled={selectedActivityIds.length === 0 || showSummary}
              onClick={() => handleBatchApprove(selectedActivityIds, 'review')}
              className="ahead-plan-toolbar-btn-white"
              style={{ color: '#ffffff' }}
            >
              审核选中
            </Button>
          )}
          {(currentUser?.is_superuser || currentUser?.role_ids?.includes(2) || isConstructionSupervisor) && (
            <Button 
              size="small" 
              type="primary" 
              loading={approving} 
              disabled={selectedActivityIds.length === 0 || showSummary}
              onClick={() => handleBatchApprove(selectedActivityIds, 'approve')}
              className="ahead-plan-toolbar-btn-white"
              style={{ color: '#ffffff' }}
            >
              批准选中
            </Button>
          )}
          {(currentUser?.is_superuser || currentUser?.role_ids?.some(id => [3, 5].includes(id)) || isConstructionSupervisor) && (
            <Popconfirm title="确定撤回所选作业的审核？仅审核人本人或更高层级用户可成功撤回。" onConfirm={() => handleBatchApprove(selectedActivityIds, 'revoke_review')}>
              <Button 
                size="small" 
                ghost 
                loading={approving} 
                disabled={selectedActivityIds.length === 0 || showSummary}
                icon={<RollbackOutlined />}
                style={{ color: '#1677ff', borderColor: '#1677ff' }}
              >
                撤回审核选中
              </Button>
            </Popconfirm>
          )}
          {(currentUser?.is_superuser || currentUser?.role_ids?.includes(2) || isConstructionSupervisor) && (
            <Popconfirm title="确定撤回所选作业的批准？仅批准人本人或更高层级用户可成功撤回。" onConfirm={() => handleBatchApprove(selectedActivityIds, 'revoke_approve')}>
              <Button 
                size="small" 
                ghost 
                danger
                loading={approving} 
                disabled={selectedActivityIds.length === 0 || showSummary}
                icon={<RollbackOutlined />}
                style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }}
              >
                撤回批准选中
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {!canModifyPlan && !showSummary && (
        <Alert
          type="warning"
          showIcon
          message="当月 25 日后仅管理员可变更计划。您当前无法修改计划量、备注、作业描述，也无法删除、从作业池加入或导入；意见与问题仍可正常使用。如需变更计划请联系系统管理员。"
          style={{ margin: '6px 12px 0', padding: '4px 12px', fontSize: 12, lineHeight: 1.4, flexShrink: 0 }}
        />
      )}

      {groupingPanelVisible && !showSummary && (
        <div style={{ background: '#fafafa', borderBottom: '1px solid #d9d9d9', padding: '8px 16px', flexShrink: 0 }}>
          <Select mode="multiple" placeholder="选择分组字段" style={{ width: '100%' }} value={groupBy} onChange={setGroupBy} options={GROUP_BY_OPTIONS} size="small" />
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, position: 'relative' }}>
        {showSummary ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff', height: '100%', borderRadius: 0 }}>
            <div style={{
              padding: '8px 12px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              borderRadius: 0,
            }}>
              <Space wrap>
                <span style={{ fontWeight: 600, fontSize: 13 }}>汇总统计视图</span>
                <Divider type="vertical" />
                <span style={{ fontSize: 12, color: '#64748b' }}>分组方式:</span>
                <Radio.Group
                  size="small"
                  value={summaryGroupBy}
                  onChange={(e) => setSummaryGroupBy(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="work_package">工作包</Radio.Button>
                  <Radio.Button value="resource_id_name">资源</Radio.Button>
                  <Radio.Button value="key_qty">只看主要工作项</Radio.Button>
                  <Radio.Button value="bcc_kq_code">项目编码</Radio.Button>
                </Radio.Group>
                <Divider type="vertical" />
                <span style={{ fontSize: 12, color: '#64748b' }}>时间粒度:</span>
                <Radio.Group
                  size="small"
                  value={summaryTimeGranularity}
                  onChange={(e) => setSummaryTimeGranularity(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="week">按周</Radio.Button>
                  <Radio.Button value="month">按月</Radio.Button>
                </Radio.Group>
                <Divider type="vertical" />
                <Space size={6}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>是否对比实际完成</span>
                  <Switch
                    size="small"
                    checked={showCompareActual}
                    onChange={setShowCompareActual}
                  />
                </Space>
              </Space>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                注：基于当前日期范围与筛选条件实时汇总
              </span>
            </div>
            <div ref={summaryTableWrapperRef} style={{ flex: 1, overflow: 'hidden', padding: '0', minHeight: 0 }}>
              <Table
                dataSource={summaryData?.items ?? []}
                columns={summaryColumns}
                size="small"
                pagination={false}
                loading={isSummaryLoading}
                rowKey="group_name"
                scroll={{ x: 'max-content', y: summaryTableBodyHeight }}
                style={{ fontSize: '11px' }}
                bordered
                className="summary-table-square"
                expandable={{
                  expandedRowKeys: expandedSummaryRowKeys,
                  onExpandedRowsChange: (keys) => setExpandedSummaryRowKeys(keys as string[]),
                  rowExpandable: (record: AheadPlanSummaryItem) => {
                    const total = (record.issue_count_pending ?? 0) + (record.issue_count_in_progress ?? 0) + (record.issue_count_resolved ?? 0)
                    return total > 0
                  },
                  expandedRowRender: (record: AheadPlanSummaryItem) => (
                    <SummaryRowExpandContent
                      record={record}
                      typeOfPlan={typeOfPlan}
                      periodStart={periodStart}
                      periodEnd={periodEnd}
                      summaryGroupBy={summaryGroupBy}
                      summaryFilters={summaryFilters}
                      initialStatus={summaryRowStatusFilters[record.group_name]}
                      onOpenIssue={(activityId) => {
                        setIssueModalContext({ activityId, typeOfPlan, title: activityId })
                        setIssueModalOpen(true)
                      }}
                    />
                  ),
                }}
              />
            </div>
          </div>
        ) : isLoading && viewItems.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin tip="加载中..." /></div>
        ) : (
          <GanttChart
            tasks={ganttTasks}
            columns={columns}
            selectedTaskIds={selectedActivityIds}
            onTaskClick={handleTaskClick}
            gridWidth={window.innerWidth} // hideTimeline模式下会被设为100%
            timescaleConfig={{
              format: 'two',
              primaryType: 'calendar',
              primaryInterval: 'day',
              showOrdinal: false,
              ordinalInterval: 'day'
            }}
            hideTimeline={true}
            density="compact"
            rowHeight={28}
            onGroupToggle={handleGroupToggle}
            onGroupSelectAll={handleGroupSelectAll}
            groupItemCounts={groupItemCounts}
            onColumnsChange={(cols) => {
              const newWidths = { ...columnWidths }
              cols.forEach(c => { newWidths[c.key] = c.width })
              setColumnWidths(newWidths)
              localStorage.setItem('ahead-plan-column-widths', JSON.stringify(newWidths))
            }}
          />
        )}
      </div>

      <Modal title="栏位设置" open={columnSettingsVisible} onOk={() => setColumnSettingsVisible(false)} onCancel={() => setColumnSettingsVisible(false)} width={600}>
        <Checkbox.Group value={visibleColumns} onChange={(values) => setVisibleColumns(values as string[])} style={{ width: '100%' }}>
          <Row>{AVAILABLE_COLUMNS.map((col) => (<Col span={8} key={col.key} style={{ marginBottom: 8 }}><Checkbox value={col.key}>{col.title}</Checkbox></Col>))}</Row>
        </Checkbox.Group>
      </Modal>

      {issueModalContext && (
        <AheadPlanIssueModal
          open={issueModalOpen}
          onClose={() => { setIssueModalOpen(false); setIssueModalContext(null) }}
          activityId={issueModalContext.activityId}
          typeOfPlan={issueModalContext.typeOfPlan}
          activityTitle={issueModalContext.title}
          currentUser={currentUser}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['ahead-plan-view'] })}
        />
      )}

      <Modal title="视图管理" open={viewModalVisible} onCancel={() => setViewModalVisible(false)} footer={null} width={600}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.Group compact>
            <Input placeholder="输入视图名称" id="ahead-plan-view-name-input" style={{ width: 'calc(100% - 120px)' }} />
            <Button type="primary" icon={<SaveOutlined />} onClick={() => {
              const input = document.getElementById('ahead-plan-view-name-input') as HTMLInputElement
              if (input?.value?.trim()) { saveView(input.value.trim()); input.value = '' }
            }}>保存当前视图</Button>
          </Input.Group>
          <Divider>已保存的视图</Divider>
          <List dataSource={savedViews} renderItem={(view) => (
            <List.Item actions={[
              <Button key="load" type="link" size="small" onClick={() => { loadView(view); setViewModalVisible(false) }}>加载</Button>,
              <Popconfirm key="delete" title="确定删除？" onConfirm={() => deleteView(view.id)}><Button type="link" danger size="small">删除</Button></Popconfirm>
            ]}>
              <List.Item.Meta title={view.name} description={`分组: ${(view.groupBy || []).join(', ') || '无'} | 栏位: ${(view.visibleColumns || []).length}个`} />
            </List.Item>
          )} locale={{ emptyText: '暂无保存的视图' }} />
        </Space>
      </Modal>

      <Modal
        title="从作业池选取"
        open={poolModalVisible}
        onCancel={() => setPoolModalVisible(false)}
        onOk={handlePoolOk}
        okText="加入本月计划"
        confirmLoading={poolAdding}
        width={1200}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <InputWithIME
                placeholder="按作业代码或描述筛选..."
                allowClear
                value={poolSearch}
                onChange={(e) => setPoolSearch(e.target.value)}
                style={{ width: 320 }}
              />
            </Col>
            <Col>
              <Space>
                <Button
                  size="small"
                  type={loadRecommendedRequested ? 'default' : 'primary'}
                  icon={loadRecommendedRequested && recommendedIds.length > 0 ? <CheckCircleOutlined /> : undefined}
                  onClick={() => {
                    if (!loadRecommendedRequested) {
                      setLoadRecommendedRequested(true)
                      return
                    }
                    const inPool = poolActivities.filter((a) => recommendedIds.includes(a.activity_id) && a.status !== 'Completed').map((a) => a.activity_id)
                    setSelectedPoolIds(inPool)
                    messageApi.success(`已勾选 ${inPool.length} 条推荐作业（已关闭的作业不会加入）`)
                  }}
                  loading={loadRecommendedRequested && isFetchingRecommended}
                  style={loadRecommendedRequested && recommendedIds.length > 0 ? undefined : { color: '#fff' } as React.CSSProperties}
                >
                  {loadRecommendedRequested ? (isFetchingRecommended ? '加载中...' : '勾选推荐') : '加载推荐'}
                </Button>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<CheckCircleOutlined />}
                  onClick={() => {
                    const selectable = poolFiltered.filter((a) => a.status !== 'Completed')
                    const allIds = selectable.map((a) => a.activity_id)
                    setSelectedPoolIds(allIds)
                    messageApi.success(`已勾选全部可加入的作业 ${allIds.length} 条（已关闭的作业不可加入计划）`)
                  }}
                >
                  勾选全部
                </Button>
                <Button
                  size="small"
                  icon={<StopOutlined />}
                  onClick={() => setSelectedPoolIds([])}
                >
                  取消全部
                </Button>
              </Space>
            </Col>
          </Row>

          <div style={{ background: '#f0f7ff', padding: '8px 12px', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: '#0050b3' }}>
              {!loadRecommendedRequested ? (
                <span>点击「加载推荐」获取基于报送记录的推荐作业，再点击「勾选推荐」一键选择。</span>
              ) : isFetchingRecommended ? (
                <span><Spin size="small" style={{ marginRight: 8 }} />正在为您智能分析推荐作业...</span>
              ) : (
                <span>分析完成：共 {recommendedIds.length} 条基于报送记录的推荐作业，可点击「勾选推荐」一键选择。</span>
              )}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              已选中 <span style={{ color: '#1890ff', fontSize: 14 }}>{selectedPoolIds.length}</span> 条作业
            </div>
          </div>

          <Table
            size="small"
            dataSource={poolFiltered}
            rowKey="activity_id"
            loading={poolLoading}
            pagination={{
              current: poolPage,
              pageSize: poolPageSize,
              showSizeChanger: true,
              pageSizeOptions: ['20', '50', '100', '200'],
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page, pageSize) => {
                setPoolPage(page)
                setPoolPageSize(pageSize || 50)
              },
            }}
            scroll={{ y: 400 }}
            rowSelection={{
              selectedRowKeys: selectedPoolIds,
              onChange: (keys) => setSelectedPoolIds(keys as string[]),
              getCheckboxProps: (record) => ({
                disabled: record.status === 'Completed',
                title: record.status === 'Completed' ? '已关闭的作业不可加入计划' : undefined,
              }),
            }}
            columns={[
              {
                title: '作业代码',
                dataIndex: 'activity_id',
                key: 'activity_id',
                width: 160,
                sorter: (a, b) => (a.activity_id || '').localeCompare(b.activity_id || ''),
              },
              {
                title: '作业描述',
                dataIndex: 'title',
                key: 'title',
                render: (val, record) => (
                  <Space size={4}>
                    <span>{val}</span>
                    {record.status === 'Completed' && <Tag color="default" style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}>已关闭</Tag>}
                    {recommendedIds.includes(record.activity_id) && <Tag color="processing" style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}>推荐</Tag>}
                  </Space>
                )
              },
              {
                title: '工作包',
                dataIndex: 'work_package',
                key: 'work_package',
                width: 180,
                sorter: (a, b) => String(a.work_package || '').localeCompare(String(b.work_package || '')),
              },
              {
                title: '分包商',
                dataIndex: 'scope',
                key: 'scope',
                width: 120,
              },
              {
                title: '总量',
                dataIndex: 'key_qty',
                key: 'key_qty',
                width: 100,
                align: 'right' as const,
                render: (v: number | null | undefined) => formatQuantity(v, 3, '-', true),
                sorter: (a, b) => (Number(a.key_qty ?? 0) - Number(b.key_qty ?? 0)),
              },
              {
                title: '完成量',
                dataIndex: 'completed',
                key: 'completed',
                width: 100,
                align: 'right' as const,
                render: (v: number | null | undefined) => formatQuantity(v, 3, '-', true),
                sorter: (a, b) => (Number(a.completed ?? 0) - Number(b.completed ?? 0)),
              },
              {
                title: '剩余量',
                key: 'remaining_qty',
                width: 100,
                align: 'right' as const,
                render: (_: unknown, record: Activity) => {
                  const keyQty = Number(record.key_qty ?? 0)
                  const completed = Number(record.completed ?? 0)
                  const remaining = keyQty - completed
                  return formatQuantity(remaining, 3, '-', true)
                },
                sorter: (a, b) => {
                  const ra = Number(a.key_qty ?? 0) - Number(a.completed ?? 0)
                  const rb = Number(b.key_qty ?? 0) - Number(b.completed ?? 0)
                  return ra - rb
                },
              }
            ]}
          />
        </Space>
      </Modal>

      <Modal
        title="导入跳过详情"
        open={!!importSkippedResult?.length}
        onCancel={() => setImportSkippedResult(null)}
        footer={null}
        width={500}
      >
        <p style={{ marginBottom: 12, color: '#64748b' }}>以下作业因已审核/已批准状态，无法通过导入修改计划量或备注：</p>
        <List
          size="small"
          dataSource={importSkippedResult ?? []}
          renderItem={(item) => (
            <List.Item>
              <Tag color="blue">{item.activity_id}</Tag>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{item.reason}</span>
            </List.Item>
          )}
          style={{ maxHeight: 320, overflow: 'auto' }}
        />
      </Modal>

      {/* 导出进度 Modal */}
      <Modal
        open={exportProgress.visible}
        title="正在导出Excel"
        footer={null}
        closable={false}
        maskClosable={false}
        width={400}
      >
        <div style={{ padding: '20px 0' }}>
          <Progress
            percent={exportProgress.percent}
            status="active"
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          <div style={{ marginTop: 16, textAlign: 'center', color: '#666' }}>
            {exportProgress.text}
          </div>
        </div>
      </Modal>

      {/* 导入前确认计划类型，避免导入计划与当前页展示不一致 */}
      <Modal
        open={importConfirmVisible}
        title="确认导入计划类型"
        onCancel={handleImportCancel}
        footer={[
          <Button key="cancel" onClick={handleImportCancel}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={importing} onClick={handleImportConfirm}>
            确认导入
          </Button>,
        ]}
        width={480}
        destroyOnClose
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ marginBottom: 12 }}>即将导入到以下计划类型，请确认与当前页面展示一致：</p>
          <p style={{ marginBottom: 16, padding: '12px 16px', background: '#f5f5f5', borderRadius: 8, fontWeight: 500 }}>
            {typeOfPlan}
          </p>
          <p style={{ color: '#64748b', fontSize: 13 }}>
            若计划类型不一致，请先在上方切换为对应计划后再导入，或取消本次操作。
          </p>
        </div>
      </Modal>

      {/* 导入进度 Modal */}
      <Modal
        open={importProgress.visible}
        title="正在导入Excel"
        footer={null}
        closable={false}
        maskClosable={false}
        width={400}
      >
        <div style={{ padding: '20px 0' }}>
          <Progress
            percent={importProgress.percent}
            status="active"
            strokeColor={{
              '0%': '#1890ff',
              '100%': '#52c41a',
            }}
          />
          <div style={{ marginTop: 16, textAlign: 'center', color: '#666' }}>
            {importProgress.text}
          </div>
        </div>
      </Modal>
    </div>
  )
}
