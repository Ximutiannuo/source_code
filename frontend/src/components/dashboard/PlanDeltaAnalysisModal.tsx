import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Modal,
  Select,
  Space,
  Table,
  Spin,
  List,
  Button,
  Input,
  Tag,
  Pagination,
  Radio,
  Divider,
} from 'antd'
import {
  MessageOutlined,
  EyeOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { aheadPlanService, type AheadPlanSummaryItem, type AheadPlanIssueItem } from '../../services/aheadPlanService'
import { AheadPlanIssueModal } from '../aheadPlan/AheadPlanIssueModal'
import { formatQuantity } from '../../utils/formatNumber'
import { useAuth } from '../../contexts/AuthContext'
import './PlanDeltaAnalysisModal.css'

interface PlanDeltaAnalysisModalProps {
  open: boolean
  onClose: () => void
}

/** 从 plan_type 解析 period，格式如 月滚动计划_2026-01-30~2026-02-26 */
function parsePeriodFromPlanType(planType: string): { periodStart: string; periodEnd: string } | null {
  const match = planType.match(/_(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})$/)
  if (!match) return null
  return { periodStart: match[1], periodEnd: match[2] }
}

const squareStyle = { borderRadius: 0 }

export default function PlanDeltaAnalysisModal({ open, onClose }: PlanDeltaAnalysisModalProps) {
  const { user: currentUser } = useAuth()
  const [selectedPlanType, setSelectedPlanType] = useState<string | null>(null)
  const [summaryGroupBy, setSummaryGroupBy] = useState<'work_package' | 'resource_id_name' | 'key_qty' | 'bcc_kq_code'>('work_package')
  const [summaryTimeGranularity, setSummaryTimeGranularity] = useState<'week' | 'month'>('week')
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([])
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [issueModalContext, setIssueModalContext] = useState<{ activityId: string; typeOfPlan: string; title?: string; initialExpandedIssueId?: number } | null>(null)

  const parsed = useMemo(() => selectedPlanType ? parsePeriodFromPlanType(selectedPlanType) : null, [selectedPlanType])
  const periodStart = parsed?.periodStart ?? ''
  const periodEnd = parsed?.periodEnd ?? ''
  const canLoadSummary = !!(selectedPlanType && periodStart && periodEnd)

  const { data: planTypesData } = useQuery({
    queryKey: ['ahead-plan-plan-types'],
    queryFn: () => aheadPlanService.listPlanTypes(),
    enabled: open,
  })

  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['plan-delta-summary', selectedPlanType, periodStart, periodEnd, summaryGroupBy, summaryTimeGranularity],
    queryFn: () =>
      aheadPlanService.getSummary({
        type_of_plan: selectedPlanType!,
        period_start: periodStart,
        period_end: periodEnd,
        group_by: summaryGroupBy,
        filters: {},
        compare_actual: true,
      }),
    enabled: canLoadSummary && open,
  })

  const planTypes = planTypesData?.plan_types ?? []
  const thursdays = summaryData?.thursdays ?? []
  const summaryItems = summaryData?.items ?? []

  const groupLabel = summaryGroupBy === 'work_package' ? '工作包' :
    summaryGroupBy === 'resource_id_name' ? '资源' :
    summaryGroupBy === 'key_qty' ? '主要工作项' : '项目编码'

  const groupTitle = (label: string, color: string) => (
    <div style={{ background: color, color: 'white', padding: '4px 8px', fontSize: '11px', fontWeight: 600, textAlign: 'center' }}>
      {label}
    </div>
  )

  const todayIso = dayjs().format('YYYY-MM-DD')
  const months: string[] = summaryTimeGranularity === 'month'
    ? [...new Set(thursdays.map((d) => d.slice(0, 7)))].sort()
    : []
  const periodCols = summaryTimeGranularity === 'week'
    ? thursdays.map((d) => ({
        title: d.length >= 10 ? d.slice(5) : d,
        key: `weekly_${d}`,
        width: 100,
        align: 'center' as const,
        periodEndIso: d,
        getVal: (r: any) => r?.weekly?.[d] ?? 0,
        getActualVal: (r: any) => (r?.weekly_actual && r.weekly_actual[d]) ?? 0,
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
          getVal: (r: any) => {
            const w = r?.weekly ?? {}
            return Object.entries(w).reduce((sum, [dateStr, v]) => {
              if (dateStr.startsWith(m + '-')) return sum + (Number(v) || 0)
              return sum
            }, 0)
          },
          getActualVal: (r: any) => {
            const wa = r?.weekly_actual ?? {}
            return Object.entries(wa).reduce((sum, [dateStr, v]) => {
              if (dateStr.startsWith(m + '-')) return sum + (Number(v) || 0)
              return sum
            }, 0)
          },
        }
      })

  const summaryColumns = useMemo(() => {
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
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '45px', lineHeight: 1.2 }}>
            <div style={{ fontWeight: 600 }}>{v}</div>
            {summaryGroupBy === 'work_package' && record.description && (
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{record.description}</div>
            )}
          </div>
        ),
      },
      {
        title: groupTitle('总量及完成量', 'rgba(34, 139, 34, 0.9)'),
        children: [
          { title: '总量', dataIndex: 'key_qty', key: 'key_qty', width: 110, align: 'center' as const, render: (v: number) => <span style={{ fontWeight: 600 }}>{formatQuantity(v ?? 0, 3, '-', true)}</span> },
          { title: '完成量', dataIndex: 'completed', key: 'completed', width: 110, align: 'center' as const, render: (v: number) => <span style={{ fontWeight: 600 }}>{formatQuantity(v ?? 0, 3, '-', true)}</span> },
          { title: '剩余量', dataIndex: 'remaining_qty', key: 'remaining_qty', width: 110, align: 'center' as const, render: (v: number) => <span style={{ fontWeight: 600 }}>{formatQuantity(v ?? 0, 3, '-', true)}</span> },
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
              const actualVal = c.getActualVal(record)
              const periodEndIso = (c as any).periodEndIso
              const isPastOrToday = periodEndIso && periodEndIso <= todayIso
              let bgColor: string | undefined
              if (isPastOrToday && typeof val === 'number' && val > 0 && typeof actualVal === 'number') {
                const ratio = actualVal / val
                if (ratio < 0.7) bgColor = 'rgba(255, 77, 79, 0.12)'
                else if (ratio < 0.9) bgColor = 'rgba(250, 173, 20, 0.18)'
                else bgColor = 'rgba(82, 196, 26, 0.12)'
              }
              return (
                <div style={{ position: 'relative', minHeight: '52px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '-4px -8px', padding: '4px 8px', backgroundColor: bgColor }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{formatQuantity(val, 3, '-', true)}</div>
                  <div style={{ fontSize: 10, color: '#1890ff', marginTop: 2, borderTop: '1px solid #e8e8e8', paddingTop: 2 }}>
                    实际: {formatQuantity(actualVal, 3, '-', true)}
                    {typeof val === 'number' && val > 0 && typeof actualVal === 'number' && (
                      <span style={{ marginLeft: 4, color: '#595959' }}>({((actualVal / val) * 100).toFixed(1)}%)</span>
                    )}
                  </div>
                </div>
              )
            },
          })),
          {
            title: '周期汇总',
            key: 'total_planned_units',
            width: 120,
            align: 'center' as const,
            render: (_: unknown, record: any) => {
              const totalPlan = Number(record.total_planned_units) || 0
              const wa = record?.weekly_actual ?? {}
              const totalActual = Object.values(wa).reduce((s: number, v: any) => s + (Number(v) || 0), 0)
              const pctStr = totalPlan > 0 ? ((totalActual / totalPlan) * 100).toFixed(1) : null
              return (
                <div style={{ minHeight: '52px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{formatQuantity(totalPlan, 3, '-', true)}</span>
                  <div style={{ fontSize: 10, color: '#1890ff', marginTop: 2, borderTop: '1px solid #e8e8e8', paddingTop: 2 }}>
                    实际: {formatQuantity(totalActual, 3, '-', true)}
                    {pctStr != null && <span style={{ marginLeft: 4, color: '#595959' }}>({pctStr}%)</span>}
                  </div>
                </div>
              )
            },
          },
        ],
      },
      {
        title: groupTitle('HMD 问题', 'rgba(59, 130, 246, 0.9)'),
        children: [
          { title: '待处理', dataIndex: 'issue_count_pending', key: 'issue_count_pending', width: 70, align: 'center' as const, render: (v: number) => <span style={{ color: (v ?? 0) > 0 ? '#f59e0b' : '#cbd5e1', fontWeight: (v ?? 0) > 0 ? 700 : 400 }}>{v ?? '-'}</span> },
          { title: '处理中', dataIndex: 'issue_count_in_progress', key: 'issue_count_in_progress', width: 70, align: 'center' as const, render: (v: number) => <span style={{ color: (v ?? 0) > 0 ? '#3b82f6' : '#cbd5e1', fontWeight: (v ?? 0) > 0 ? 700 : 400 }}>{v ?? '-'}</span> },
          { title: '已解决', dataIndex: 'issue_count_resolved', key: 'issue_count_resolved', width: 70, align: 'center' as const, render: (v: number) => <span style={{ color: (v ?? 0) > 0 ? '#10b981' : '#cbd5e1', fontWeight: (v ?? 0) > 0 ? 700 : 400 }}>{v ?? '-'}</span> },
          { title: '超期', dataIndex: 'issue_count_overdue', key: 'issue_count_overdue', width: 70, align: 'center' as const, render: (v: number) => <span style={{ color: (v ?? 0) > 0 ? '#ef4444' : '#cbd5e1', fontWeight: (v ?? 0) > 0 ? 700 : 400 }}>{v ?? '-'}</span> },
        ],
      },
    ]
    return cols
  }, [summaryGroupBy, periodCols, groupLabel])

  const handleOpenIssue = useCallback((activityId: string, issueId?: number) => {
    setIssueModalContext({ activityId, typeOfPlan: selectedPlanType!, title: activityId, initialExpandedIssueId: issueId })
    setIssueModalOpen(true)
  }, [selectedPlanType])

  return (
    <Modal
      title="Plan Delta Analysis - 专项计划执行偏差"
      open={open}
      onCancel={onClose}
      footer={null}
      width={1400}
      centered
      destroyOnClose
      styles={{ body: { maxHeight: '85vh', overflowY: 'auto' } }}
      className="plan-delta-analysis-modal"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Step 1: 选择专项计划 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: '#334155' }}>选择专项计划：</span>
          <Select
            placeholder="选择计划类型"
            style={{ minWidth: 320 }}
            value={selectedPlanType}
            onChange={setSelectedPlanType}
            options={planTypes.map((t) => ({ label: t, value: t }))}
            allowClear
          />
          {canLoadSummary && (
            <>
              <Divider type="vertical" />
              <Radio.Group
                size="small"
                value={summaryGroupBy}
                onChange={(e) => setSummaryGroupBy(e.target.value)}
                optionType="button"
              >
                <Radio.Button value="work_package">工作包</Radio.Button>
                <Radio.Button value="resource_id_name">资源</Radio.Button>
                <Radio.Button value="key_qty">主要工作项</Radio.Button>
                <Radio.Button value="bcc_kq_code">项目编码</Radio.Button>
              </Radio.Group>
              <Radio.Group size="small" value={summaryTimeGranularity} onChange={(e) => setSummaryTimeGranularity(e.target.value)} optionType="button">
                <Radio.Button value="week">按周</Radio.Button>
                <Radio.Button value="month">按月</Radio.Button>
              </Radio.Group>
            </>
          )}
        </div>

        {/* Step 2: 汇总表 */}
        {canLoadSummary && (
          <div style={{ flex: 1, minHeight: 400 }}>
            {isSummaryLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" tip="加载中..." /></div>
            ) : summaryItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8' }}>暂无汇总数据</div>
            ) : (
              <Table
                dataSource={summaryItems}
                columns={summaryColumns}
                size="small"
                pagination={false}
                rowKey="group_name"
                scroll={{ x: 'max-content', y: 480 }}
                style={{ fontSize: 11 }}
                bordered
                className="plan-delta-summary-table"
                expandable={{
                  expandedRowKeys,
                  onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
                  rowExpandable: (record: AheadPlanSummaryItem) => {
                    const total = (record.issue_count_pending ?? 0) + (record.issue_count_in_progress ?? 0) + (record.issue_count_resolved ?? 0)
                    return total > 0
                  },
                  expandedRowRender: (record: AheadPlanSummaryItem) => (
                    <SummaryRowExpandContent
                      record={record}
                      typeOfPlan={selectedPlanType!}
                      periodStart={periodStart}
                      periodEnd={periodEnd}
                      summaryGroupBy={summaryGroupBy}
                      filters={{}}
                      onOpenIssue={handleOpenIssue}
                    />
                  ),
                }}
              />
            )}
          </div>
        )}

        {open && !selectedPlanType && planTypes.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>加载计划类型中...</div>
        )}
      </div>

      {issueModalContext && (
        <AheadPlanIssueModal
          open={issueModalOpen}
          onClose={() => { setIssueModalOpen(false); setIssueModalContext(null) }}
          activityId={issueModalContext.activityId}
          typeOfPlan={issueModalContext.typeOfPlan}
          activityTitle={issueModalContext.title}
          initialExpandedIssueId={issueModalContext.initialExpandedIssueId ?? undefined}
          currentUser={currentUser}
          onSaved={() => {}}
        />
      )}
    </Modal>
  )
}

/** 汇总行展开内容：问题清单（简化版，无 dimension 钻取） */
function SummaryRowExpandContent({
  record,
  typeOfPlan,
  periodStart,
  periodEnd,
  summaryGroupBy,
  filters,
  onOpenIssue,
}: {
  record: AheadPlanSummaryItem
  typeOfPlan: string
  periodStart: string
  periodEnd: string
  summaryGroupBy: string
  filters?: Record<string, any>
  onOpenIssue: (activityId: string, issueId?: number) => void
}) {
  const [issueSearch, setIssueSearch] = useState('')
  const [issueSearchForApi, setIssueSearchForApi] = useState('')
  const [issuePage, setIssuePage] = useState(1)
  const issuePageSize = 10
  useEffect(() => { const t = setTimeout(() => setIssueSearchForApi(issueSearch.trim()), 350); return () => clearTimeout(t) }, [issueSearch])

  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ['issue-list-by-group-pda', record.group_name, typeOfPlan, periodStart, periodEnd, summaryGroupBy, issueSearchForApi, issuePage],
    queryFn: () =>
      aheadPlanService.getIssueListByGroup({
        type_of_plan: typeOfPlan,
        period_start: periodStart,
        period_end: periodEnd,
        group_by: summaryGroupBy,
        group_name: record.group_name,
        filters: filters ?? {},
        limit: issuePageSize,
        skip: (issuePage - 1) * issuePageSize,
        search: issueSearchForApi || undefined,
      }),
  })
  const issues = issuesData?.items ?? []
  const issuesTotal = issuesData?.total ?? 0

  const issueTypeLabels: Record<string, string> = {
    design_tech: '设计与技术', procurement_material: '采购与材料', warehouse_equipment: '仓储与设备',
    construction_management: '施工管理', hse_safety: '安全环保', quality_management: '质量管理',
    coordination_interface: '协调与接口', approval_process: '审批与流程', human_resource: '人力与资源',
    planning_management: '计划管理', quantity_confirmation: '工程量确认', other: '其他',
  }
  const statusLabels: Record<string, string> = { pending: '待处理', in_progress: '处理中', resolved: '已解决', closed: '已确认' }
  const deptLabels: Record<string, string> = {
    design: '设计管理部', procurement: '采购管理部', warehouse: '仓储管理部', construction: '施工管理部',
    quality: '质量管理部', safety: '安全管理部', planning: '计划管理部', admin: '行政后勤管理部',
    it: 'IT管理部', contract: '合同管理部', cost_control: '费用控制', hr: '人力资源部', handover_docs: '竣工资料',
  }

  return (
    <div style={{ padding: '12px 24px', background: '#fcfcfc' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <MessageOutlined style={{ color: '#64748b', fontSize: 14 }} />
          <span style={{ fontWeight: 700, fontSize: 12 }}>
            问题详情 <Tag color="blue" style={{ ...squareStyle, marginLeft: 8, fontSize: 10 }}>共 {issuesTotal} 条</Tag>
          </span>
          <Input
            placeholder="搜索 ID、描述、人员..."
            size="small"
            style={{ width: 180, ...squareStyle, fontSize: 11 }}
            value={issueSearch}
            onChange={(e) => setIssueSearch(e.target.value)}
            allowClear
          />
        </div>
      </div>
      <Spin spinning={issuesLoading}>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {issues.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
              <StopOutlined style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
              未找到匹配的问题详情
            </div>
          ) : (
            <List
              size="small"
              dataSource={issues}
              renderItem={(item: AheadPlanIssueItem) => {
                const isResolved = item.status === 'resolved' || item.status === 'closed'
                return (
                  <List.Item key={item.id} style={{ borderBottom: '1px solid #f1f5f9', padding: '12px 0' }}>
                    <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <Tag color="blue" style={{ ...squareStyle, fontSize: 10 }}>{issueTypeLabels[item.issue_type] || item.issue_type}</Tag>
                          <span style={{ fontWeight: 700, fontSize: 11 }}>{item.activity_id}</span>
                          <Tag style={{ ...squareStyle, fontSize: 10 }} color={isResolved ? 'success' : item.status === 'in_progress' ? 'processing' : 'warning'}>
                            {statusLabels[item.status] || item.status}
                          </Tag>
                          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onOpenIssue(item.activity_id, item.id)} style={{ padding: 0, fontSize: 10 }}>
                            查看沟通
                          </Button>
                        </div>
                        <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5, background: '#f8fafc', padding: '8px 12px', borderLeft: '3px solid #cbd5e1' }}>
                          {item.description}
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>
                          <Space split={<span style={{ color: '#e2e8f0' }}>|</span>}>
                            <span>提出人: {item.raised_by_name}</span>
                            <span>部门: {deptLabels[item.raising_department || ''] || item.raising_department || '-'}</span>
                            <span>责任人: <strong>{item.responsible_user_name || '未分配'}</strong></span>
                            {item.planned_resolve_at && (
                              <span style={{ color: item.logic_status === 'overdue_unsolved' ? '#ef4444' : undefined }}>要求: {item.planned_resolve_at}</span>
                            )}
                          </Space>
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
          <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'center' }}>
            <Pagination size="small" current={issuePage} pageSize={issuePageSize} total={issuesTotal} onChange={setIssuePage} showSizeChanger={false} showTotal={(t) => `共 ${t} 条`} />
          </div>
        )}
      </Spin>
    </div>
  )
}
