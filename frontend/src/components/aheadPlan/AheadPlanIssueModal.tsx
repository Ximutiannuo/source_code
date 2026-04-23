import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Modal,
  Form,
  Select,
  Input,
  Mentions,
  DatePicker,
  Button,
  Space,
  List,
  Pagination,
  Popconfirm,
  Tag,
  App,
  Divider,
  Empty,
  Avatar,
  Typography,
  Rate,
} from 'antd'
import dayjs from 'dayjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ISSUE_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  LOGIC_STATUS_LABELS,
} from '../../constants/aheadPlanIssues'
import { departmentService } from '../../services/departmentService'
import {
  aheadPlanService,
  RATING_REASON_OPTIONS,
  type AheadPlanIssueItem,
  type AheadPlanIssueCreatePayload,
  type AheadPlanIssueUpdatePayload,
} from '../../services/aheadPlanService'
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  MessageOutlined,
  CheckCircleOutlined,
  UserOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  RollbackOutlined,
  LikeOutlined,
  BulbOutlined,
} from '@ant-design/icons'

const { Text } = Typography

interface AheadPlanIssueModalProps {
  open: boolean
  onClose: () => void
  activityId: string
  typeOfPlan: string
  activityTitle?: string
  initialExpandedIssueId?: number | null
  currentUser?: any
  onSaved?: () => void
}

const issueTypeLabel = (value: string) =>
  ISSUE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
const deptLabel = (value: string | null | undefined, departments: { code: string; name: string }[]) =>
  value ? (departments.find((o) => o.code === value)?.name ?? value) : '-'
const priorityLabel = (value: string) =>
  PRIORITY_OPTIONS.find((o) => o.value === value)?.label ?? value
const priorityColor = (value: string) => (value === 'high' ? '#ff4d4f' : value === 'low' ? '#8c8c8c' : '#faad14')

/** 将回复内容中的 @提及 渲染为蓝色样式，仅当 @ 后是已选用户（在 validMentionNames 中）时标蓝 */
function renderContentWithMentions(content: string, validMentionNames?: Set<string>) {
  if (!content) return null
  const parts = content.split(/(@[^\s@,，。、\]]+)/g)
  return parts.map((part, i) => {
    if (!part.startsWith('@')) return part
    const name = part.slice(1).trim()
    const isValidMention = validMentionNames && validMentionNames.size > 0 && name && validMentionNames.has(name)
    return isValidMention ? (
      <span key={i} style={{ color: '#1890ff', fontWeight: 500 }}>
        {part}
      </span>
    ) : (
      part
    )
  })
}

const logicStatusColor = (status: string) => {
  switch (status) {
    case 'on_time': return 'green'
    case 'overdue_resolved': return 'cyan'
    case 'overdue_unsolved': return 'red'
    case 'confirmed': return 'blue'
    default: return 'orange'
  }
}

function DaysUntilResolve({ days, status }: { days: number | null | undefined, status: string }) {
  if (status === 'resolved' || status === 'closed' || days == null) return null
  if (days > 0) return <span style={{ color: '#52c41a', fontSize: 12 }}><ClockCircleOutlined /> 剩 {days} 天</span>
  if (days === 0) return <span style={{ color: '#faad14', fontSize: 12 }}><ClockCircleOutlined /> 今天到期</span>
  return <span style={{ color: '#ff4d4f', fontSize: 12 }}><ClockCircleOutlined /> 已逾期 {-days} 天</span>
}

export const AheadPlanIssueModal: React.FC<AheadPlanIssueModalProps> = ({
  open,
  onClose,
  activityId,
  typeOfPlan,
  activityTitle,
  initialExpandedIssueId,
  currentUser,
  onSaved,
}) => {
  const { message: messageApi } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [replyForm] = Form.useForm()
  const [resolveForm] = Form.useForm()
  const [confirmForm] = Form.useForm()
  
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [expandedIssueId, setExpandedIssueId] = useState<number | null>(null)
  const [issueSearch, setIssueSearch] = useState('')
  const [issueSearchForApi, setIssueSearchForApi] = useState('')
  const [issuePage, setIssuePage] = useState(1)
  const [resolvingIssueId, setResolvingIssueId] = useState<number | null>(null)
  const [confirmingIssueId, setConfirmingIssueId] = useState<number | null>(null)
  const [batchConfirming, setBatchConfirming] = useState(false)

  const isSystemAdmin = currentUser?.is_superuser || currentUser?.username === 'role_system_admin'

  const selectedDeptCode = Form.useWatch('resolving_department', form)

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentService.listDepartments(),
    enabled: open,
  })
  const departmentOptions = departments.map((d) => ({ value: d.code, label: d.name }))

  const issuePageSize = 10
  useEffect(() => {
    const t = setTimeout(() => setIssueSearchForApi(issueSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [issueSearch])
  useEffect(() => {
    setIssuePage(1)
  }, [issueSearchForApi])

  const { data: issuesData, isLoading } = useQuery({
    queryKey: ['ahead-plan-issues', activityId, typeOfPlan, issuePage, issueSearchForApi],
    queryFn: () =>
      aheadPlanService.listIssues(activityId, typeOfPlan, {
        skip: (issuePage - 1) * issuePageSize,
        limit: issuePageSize,
        search: issueSearchForApi || undefined,
      }),
    enabled: open && !!activityId && !!typeOfPlan,
    refetchInterval: open ? 5000 : false, // 每 5 秒轮询，解决「责任人关闭后提出方需刷新才能结案评价」的滞后问题
  })

  const issues = issuesData?.items ?? []
  const issuesTotal = issuesData?.total ?? 0

  // 从消息中心进入时定位到对应问题并展开
  useEffect(() => {
    if (open && initialExpandedIssueId && issues.length > 0) {
      const exists = issues.some((i) => i.id === initialExpandedIssueId)
      if (exists) setExpandedIssueId(initialExpandedIssueId)
    }
  }, [open, initialExpandedIssueId, issues])

  const { data: assigneeOptions = [] } = useQuery({
    queryKey: ['ahead-plan-assignee-options', selectedDeptCode ?? ''],
    queryFn: () => aheadPlanService.listAssigneeOptions(selectedDeptCode || undefined),
    enabled: open,
  })

  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionSearchDebounced, setMentionSearchDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setMentionSearchDebounced(mentionSearch.trim()), 200)
    return () => clearTimeout(t)
  }, [mentionSearch])
  const { data: mentionOptions = [] } = useQuery({
    queryKey: ['ahead-plan-mention-options', mentionSearchDebounced],
    queryFn: () => aheadPlanService.listMentionUserOptions(mentionSearchDebounced || undefined),
    enabled: open && !!expandedIssueId,
    staleTime: 30000,
  })

  const validMentionNames = useMemo(() => {
    const names = new Set<string>()
    assigneeOptions.forEach((u) => {
      const n = u.full_name || u.username
      if (n) names.add(n)
    })
    mentionOptions.forEach((u) => {
      const n = u.full_name || u.username
      if (n) names.add(n)
    })
    return names
  }, [assigneeOptions, mentionOptions])

  const { data: replies = [], isLoading: repliesLoading } = useQuery({
    queryKey: ['ahead-plan-issue-replies', expandedIssueId],
    queryFn: () => aheadPlanService.listIssueReplies(expandedIssueId!),
    enabled: open && !!expandedIssueId,
    refetchInterval: open && !!expandedIssueId ? 5000 : false,  // 每 5 秒轮询，实现类似实时刷新
  })

  const handleCreate = useCallback(async () => {
    const v = await form.validateFields().catch(() => null)
    if (!v) return
    const payload: AheadPlanIssueCreatePayload = {
      activity_id: activityId,
      type_of_plan: typeOfPlan,
      issue_type: v.issue_type,
      description: v.description.trim(),
      status: 'pending',
      resolving_department: v.resolving_department ?? null,
      planned_resolve_at: v.planned_resolve_at ? v.planned_resolve_at.format('YYYY-MM-DD') : null,
      responsible_user_id: v.responsible_user_id ?? null,
      priority: v.priority ?? 'medium',
    }
    try {
      await aheadPlanService.createIssue(payload)
      messageApi.success('问题已提交')
      form.resetFields()
      setShowForm(false)
      queryClient.invalidateQueries({ queryKey: ['ahead-plan-issues', activityId, typeOfPlan] })
      onSaved?.()
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail ?? e?.message ?? '提交失败')
    }
  }, [activityId, typeOfPlan, form, messageApi, queryClient, onSaved])

  const handleUpdate = useCallback(
    async (item: AheadPlanIssueItem) => {
      const v = await form.validateFields().catch(() => null)
      if (!v) return
      const payload: AheadPlanIssueUpdatePayload = {
        issue_type: v.issue_type,
        description: v.description.trim(),
        resolving_department: v.resolving_department ?? null,
        planned_resolve_at: v.planned_resolve_at ? v.planned_resolve_at.format('YYYY-MM-DD') : null,
        responsible_user_id: v.responsible_user_id ?? null,
        priority: v.priority ?? 'medium',
      }
      try {
        await aheadPlanService.updateIssue(item.id, payload)
        messageApi.success('已保存修改')
        setEditingId(null)
        queryClient.invalidateQueries({ queryKey: ['ahead-plan-issues', activityId, typeOfPlan] })
        onSaved?.()
      } catch (e: any) {
        messageApi.error(e?.response?.data?.detail ?? e?.message ?? '保存失败')
      }
    },
    [activityId, typeOfPlan, form, messageApi, queryClient, onSaved]
  )

  const handleResolveSubmit = useCallback(async () => {
    if (!resolvingIssueId) return
    const v = await resolveForm.validateFields().catch(() => null)
    if (!v) return
    
    try {
      await aheadPlanService.createIssueReply(resolvingIssueId, { 
        content: `【解决方案】${v.solution}`, 
        reply_type: 'solution' 
      })
      await aheadPlanService.updateIssue(resolvingIssueId, { status: 'resolved' })
      messageApi.success('问题已标记为解决并保存了方案')
      setResolvingIssueId(null)
      resolveForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['ahead-plan-issues', activityId, typeOfPlan] })
      onSaved?.()
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail ?? e?.message ?? '解决失败')
    }
  }, [resolvingIssueId, activityId, typeOfPlan, resolveForm, messageApi, queryClient, onSaved])

  const handleConfirmSubmit = useCallback(async () => {
    if (!confirmingIssueId) return
    const rating = confirmForm.getFieldValue('rating') || 5
    const rating_reason = confirmForm.getFieldValue('rating_reason')?.trim()
    const rating_reason_tags = confirmForm.getFieldValue('rating_reason_tags') || []
    try {
      await aheadPlanService.confirmIssue(confirmingIssueId, {
        rating,
        rating_reason: rating_reason || undefined,
        rating_reason_tags: rating_reason_tags.length ? rating_reason_tags : undefined,
      })
      messageApi.success('已确认解决并留下反馈')
      setConfirmingIssueId(null)
      confirmForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['ahead-plan-issues', activityId, typeOfPlan] })
      onSaved?.()
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail ?? e?.message ?? '确认失败')
    }
  }, [confirmingIssueId, activityId, typeOfPlan, confirmForm, messageApi, queryClient, onSaved])

  const resolvableForBatch = issues.filter(
    (i) =>
      i.status === 'resolved' &&
      (isSystemAdmin || currentUser?.id === i.raised_by)
  )
  const handleBatchConfirm = useCallback(async () => {
    if (resolvableForBatch.length === 0) return
    setBatchConfirming(true)
    try {
      const res = await aheadPlanService.batchConfirmIssues(
        resolvableForBatch.map((i) => ({ issue_id: i.id, rating: 5 }))
      )
      if (res.updated > 0) {
        messageApi.success(`已批量好评结案 ${res.updated} 个问题`)
        queryClient.invalidateQueries({ queryKey: ['ahead-plan-issues', activityId, typeOfPlan] })
        onSaved?.()
      }
      if (res.errors.length > 0) {
        messageApi.warning(`部分失败：${res.errors.map((e) => e.message).join('；')}`)
      }
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail ?? e?.message ?? '批量确认失败')
    } finally {
      setBatchConfirming(false)
    }
  }, [resolvableForBatch, activityId, typeOfPlan, messageApi, queryClient, onSaved])

  const handleReopen = useCallback(async (id: number) => {
    try {
      await aheadPlanService.updateIssue(id, { status: 'in_progress' })
      messageApi.success('问题已重新打开')
      queryClient.invalidateQueries({ queryKey: ['ahead-plan-issues', activityId, typeOfPlan] })
      onSaved?.()
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail ?? e?.message ?? '操作失败')
    }
  }, [activityId, typeOfPlan, messageApi, queryClient, onSaved])

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await aheadPlanService.deleteIssue(id)
        messageApi.success('问题已删除')
        if (expandedIssueId === id) setExpandedIssueId(null)
        queryClient.invalidateQueries({ queryKey: ['ahead-plan-issues', activityId, typeOfPlan] })
        onSaved?.()
      } catch (e: any) {
        messageApi.error(e?.response?.data?.detail ?? e?.message ?? '删除失败')
      }
    },
    [activityId, typeOfPlan, expandedIssueId, messageApi, queryClient, onSaved]
  )

  const handleAddReply = useCallback(async () => {
    if (!expandedIssueId) return
    const v = replyForm.getFieldValue('content')?.trim()
    if (!v) return
    try {
      await aheadPlanService.createIssueReply(expandedIssueId, { content: v, reply_type: 'progress' })
      messageApi.success('进展已发布')
      replyForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['ahead-plan-issue-replies', expandedIssueId] })
      queryClient.invalidateQueries({ queryKey: ['ahead-plan-issues', activityId, typeOfPlan] })
      onSaved?.()
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail ?? e?.message ?? '发布失败')
    }
  }, [expandedIssueId, activityId, typeOfPlan, replyForm, messageApi, queryClient, onSaved])

  const startEdit = (item: AheadPlanIssueItem) => {
    setEditingId(item.id)
    form.setFieldsValue({
      issue_type: item.issue_type,
      description: item.description,
      resolving_department: item.resolving_department || undefined,
      planned_resolve_at: item.planned_resolve_at ? dayjs(item.planned_resolve_at) : undefined,
      responsible_user_id: item.responsible_user_id ?? undefined,
      priority: item.priority || 'medium',
    })
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
          <InfoCircleOutlined style={{ color: '#1890ff', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, flexShrink: 0 }}>问题管理</span>
          <Text 
            type="secondary" 
            ellipsis 
            style={{ 
              fontSize: 12, 
              fontWeight: 'normal',
              maxWidth: 'calc(100% - 180px)'
            }}
          >
            {activityId} {activityTitle ? `| ${activityTitle}` : ''}
          </Text>
        </div>
      }
      open={open}
      onCancel={() => {
        setEditingId(null)
        setShowForm(false)
        setExpandedIssueId(null)
        setResolvingIssueId(null)
        setConfirmingIssueId(null)
        onClose()
      }}
      footer={null}
      width={880}
      destroyOnClose
      bodyStyle={{ padding: '0 24px 24px 24px' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>所有记录 ({issuesTotal})</div>
          {!showForm && editingId === null && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowForm(true)} style={{ color: '#fff' }}>
              新增问题
            </Button>
          )}
        </div>

        {(showForm || editingId !== null) && (
          <div style={{ padding: 20, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Form
              form={form}
              layout="vertical"
              initialValues={{ priority: 'medium' }}
              onFinish={editingId !== null ? () => handleUpdate(issues.find((i) => i.id === editingId)!) : handleCreate}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item name="resolving_department" label="解决部门">
                  <Select options={departmentOptions} placeholder="请选择解决部门" allowClear showSearch optionFilterProp="label" />
                </Form.Item>
                <Form.Item name="planned_resolve_at" label="计划解决时间">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <Form.Item name="issue_type" label="问题类型" rules={[{ required: true }]}>
                  <Select options={[...ISSUE_TYPE_OPTIONS]} placeholder="请选择" />
                </Form.Item>
                <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
                  <Select options={[...PRIORITY_OPTIONS]} placeholder="请选择" />
                </Form.Item>
                <Form.Item name="responsible_user_id" label="责任人">
                  <Select
                    options={assigneeOptions.map((u) => {
                      const label = u.full_name || u.username
                      const sub = u.responsible_for ? ` (${u.responsible_for})` : ''
                      return { value: u.id, label: `${label}${sub}` }
                    })}
                    placeholder={selectedDeptCode ? '已按部门筛选，显示职责' : '先选解决部门可筛选该部门人员'}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
              </div>
              <Form.Item name="description" label="问题描述" rules={[{ required: true }]}>
                <Input.TextArea rows={3} placeholder="请清晰描述问题的具体情况..." />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button type="primary" htmlType="submit" style={{ color: '#fff' }}>
                    {editingId !== null ? '保存修改' : '提交问题'}
                  </Button>
                  <Button onClick={() => { setEditingId(null); setShowForm(false); form.resetFields(); }}>取消</Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}

        {issuesTotal > 0 && (
          <Space style={{ marginBottom: 12 }} wrap>
            <Input
              placeholder="搜索问题描述、责任人、提出人..."
              allowClear
              size="small"
              value={issueSearch}
              onChange={(e) => setIssueSearch(e.target.value)}
              style={{ maxWidth: 320 }}
            />
            {resolvableForBatch.length > 0 && (
              <Popconfirm
                title={`将为当前页 ${resolvableForBatch.length} 个待评价问题全部给予 5 星好评并结案，确定？`}
                onConfirm={handleBatchConfirm}
              >
                <Button
                  type="primary"
                  size="small"
                  icon={<LikeOutlined />}
                  loading={batchConfirming}
                  style={{ color: '#fff' }}
                >
                  批量好评结案 ({resolvableForBatch.length})
                </Button>
              </Popconfirm>
            )}
          </Space>
        )}
        <List
          loading={isLoading}
          dataSource={issues}
          locale={{ emptyText: <Empty description={issueSearchForApi ? '无匹配问题' : '暂无记录的问题'} style={{ padding: '40px 0' }} /> }}
          renderItem={(item) => {
            const isExpanded = expandedIssueId === item.id
            const isResolving = resolvingIssueId === item.id
            const isConfirming = confirmingIssueId === item.id
            
            // 权限控制
            const canDelete = isSystemAdmin || currentUser?.id === item.raised_by
            const canResolve = isSystemAdmin || currentUser?.id === item.responsible_user_id || currentUser?.id === item.raised_by
            const canConfirm = isSystemAdmin || currentUser?.id === item.raised_by
            // 重新打开逻辑：
            // 1. 如果是 resolved (待评价)，责任人和提出人/管理员都能重新打开
            // 2. 如果是 closed (已评价)，只有提出人或管理员可以重新打开，防止责任人为了刷分自行重新打开
            const canReopen = item.status === 'resolved' 
              ? (canResolve || canConfirm) 
              : (item.status === 'closed' ? canConfirm : false)

            return (
              <div style={{ 
                border: '1px solid #f0f0f0', 
                borderRadius: 8, 
                marginBottom: 16, 
                overflow: 'hidden',
                background: item.status === 'closed' ? '#fcfcfc' : '#fff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Space wrap size={[4, 8]} style={{ flex: 1 }}>
                      <Tag color="blue" bordered={false}>{issueTypeLabel(item.issue_type)}</Tag>
                      <Tag color={priorityColor(item.priority)} style={{ color: '#fff' }}>{priorityLabel(item.priority)}</Tag>
                      <Tag color={logicStatusColor(item.logic_status)} bordered={false}>
                        {LOGIC_STATUS_LABELS[item.logic_status as keyof typeof LOGIC_STATUS_LABELS] || item.status}
                      </Tag>
                      {item.resolving_department && (
                        <Tag color="default" bordered={false}>{deptLabel(item.resolving_department, departments)}</Tag>
                      )}
                      <DaysUntilResolve days={item.days_until_resolve} status={item.status} />
                      {item.status === 'closed' && (
                        <Tag color="success" style={{ marginLeft: 8 }}>已反馈</Tag>
                      )}
                    </Space>
                    
                    <Space>
                      {item.status !== 'resolved' && item.status !== 'closed' && canResolve && (
                        <Button 
                          type="primary" 
                          size="small" 
                          icon={<CheckCircleOutlined />} 
                          style={{ color: '#fff' }}
                          onClick={() => setResolvingIssueId(item.id)}
                        >
                          确认解决
                        </Button>
                      )}
                      {item.status === 'resolved' && canConfirm && (
                        <Button 
                          type="primary" 
                          size="small" 
                          icon={<LikeOutlined />} 
                          style={{ color: '#fff' }}
                          onClick={() => setConfirmingIssueId(item.id)}
                        >
                          评价并结案
                        </Button>
                      )}
                      {canReopen && (
                        <Popconfirm title="确定重新打开此问题？" onConfirm={() => handleReopen(item.id)}>
                          <Button size="small" icon={<RollbackOutlined />}>重新打开</Button>
                        </Popconfirm>
                      )}
                      <Button 
                        type="text" 
                        size="small" 
                        icon={<EditOutlined />} 
                        onClick={() => startEdit(item)} 
                        disabled={item.status === 'closed'} 
                      />
                      {canDelete && (
                        <Popconfirm title="确定彻底删除此问题？" onConfirm={() => handleDelete(item.id)}>
                          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                        </Popconfirm>
                      )}
                    </Space>
                  </div>

                  <div style={{ margin: '12px 0', fontSize: 14, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {item.description}
                  </div>

                  {/* 解决方案展示区 */}
                  {item.solution && (
                    <div style={{ 
                      background: '#f6ffed', 
                      border: '1px solid #b7eb8f', 
                      borderRadius: 6, 
                      padding: '8px 12px', 
                      marginBottom: 12,
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start'
                    }}>
                      <BulbOutlined style={{ color: '#52c41a', marginTop: 4 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12, color: '#389e0d', marginBottom: 2 }}>解决方案</div>
                        <div style={{ fontSize: 13, color: '#135200' }}>{item.solution}</div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#94a3b8' }}>
                    <Space split={<Divider type="vertical" />}>
                      <span>提出：{item.raised_by_name} ({dayjs(item.raised_at).format('MM-DD HH:mm')})</span>
                      {item.responsible_user_name && <span>责任：{item.responsible_user_name}</span>}
                      {item.status !== 'pending' && item.resolved_by_name && (
                        <span style={{ color: '#52c41a' }}>解决：{item.resolved_by_name} ({dayjs(item.resolved_at).format('MM-DD')})</span>
                      )}
                      {item.status === 'closed' && (
                        <span style={{ color: '#1890ff' }}>结案：{item.confirmed_by_name}</span>
                      )}
                    </Space>
                    <Button 
                      type="link" 
                      size="small" 
                      icon={<MessageOutlined />} 
                      onClick={() => setExpandedIssueId(isExpanded ? null : item.id)}
                    >
                      进展回复 {isExpanded ? '收起' : ''}
                    </Button>
                  </div>
                </div>

                {/* 提交解决方案表单 */}
                {isResolving && (
                  <div style={{ background: '#f0f9ff', padding: 16, borderTop: '1px solid #bae7ff' }}>
                    <Form form={resolveForm} layout="vertical">
                      <Form.Item 
                        name="solution" 
                        label={<span style={{ fontWeight: 600, color: '#0050b3' }}>请填写解决方案（必填）</span>} 
                        rules={[{ required: true, message: '必须填写方案才能解决问题' }]}
                      >
                        <Input.TextArea placeholder="详细描述是如何解决的..." autoSize={{ minRows: 2, maxRows: 6 }} />
                      </Form.Item>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button size="small" onClick={() => setResolvingIssueId(null)}>取消</Button>
                        <Button type="primary" size="small" style={{ color: '#fff' }} onClick={handleResolveSubmit}>提交方案并标记解决</Button>
                      </div>
                    </Form>
                  </div>
                )}

                {/* 协作反馈并结案表单 */}
                {isConfirming && (
                  <div style={{ background: '#fff7e6', padding: 16, borderTop: '1px solid #ffd591' }}>
                    <Form form={confirmForm} layout="vertical" initialValues={{ rating: 5 }}>
                      <Form.Item name="rating" label={<span style={{ fontWeight: 600, color: '#d46b08' }}>本次协作感受如何？</span>}>
                        <Rate
                          tooltips={[
                            '过程很不顺，遗留了问题',
                            '解决了，但沟通成本很高',
                            '正常解决，中规中矩',
                            '响应快，解决得不错',
                            '超出预期，非常专业',
                          ]}
                        />
                      </Form.Item>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prev, curr) => prev.rating !== curr.rating}
                      >
                        {({ getFieldValue }) => {
                          const r = getFieldValue('rating') ?? 5
                          if (r > 3) return null
                          return (
                            <>
                              <Form.Item
                                name="rating_reason_tags"
                                label={<span style={{ fontSize: 12, color: '#8c8c8c' }}>选择标签（可选）</span>}
                              >
                                <Select
                                  mode="tags"
                                  placeholder="如：响应慢、推诿、沟通不畅、未解决"
                                  options={RATING_REASON_OPTIONS.map((t) => ({ value: t, label: t }))}
                                  maxTagCount={3}
                                  style={{ width: '100%' }}
                                />
                              </Form.Item>
                              <Form.Item
                                name="rating_reason"
                                label={<span style={{ fontWeight: 600, color: '#d46b08' }}>补充说明（必填其一）</span>}
                                dependencies={['rating_reason_tags']}
                                rules={[
                                  {
                                    validator: (_, value) => {
                                      const tags = confirmForm.getFieldValue('rating_reason_tags') || []
                                      if ((value && String(value).trim()) || tags.length > 0) {
                                        return Promise.resolve()
                                      }
                                      return Promise.reject(new Error('3 星及以下需填写原因或选择标签'))
                                    },
                                  },
                                ]}
                              >
                                <Input.TextArea
                                  placeholder="简要说明本次协作体验不佳的原因，便于改进"
                                  maxLength={200}
                                  showCount
                                  rows={2}
                                />
                              </Form.Item>
                            </>
                          )
                        }}
                      </Form.Item>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button size="small" onClick={() => setConfirmingIssueId(null)}>取消</Button>
                        <Button type="primary" size="small" style={{ color: '#fff' }} onClick={handleConfirmSubmit}>留下反馈</Button>
                      </div>
                    </Form>
                  </div>
                )}

                {isExpanded && !isResolving && !isConfirming && (
                  <div style={{ background: '#f8fafc', padding: 16, borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ maxHeight: 300, overflow: 'auto', marginBottom: 12 }}>
                      {repliesLoading ? (
                        <div style={{ textAlign: 'center', padding: 12 }}>加载中...</div>
                      ) : replies.length === 0 ? (
                        <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 12 }}>暂无进展，参与讨论...</div>
                      ) : (
                        replies.map((r) => {
                          const isSolution = r.reply_type === 'solution'
                          const isMe = r.user_id === currentUser?.id
                          return (
                            <div
                              key={r.id}
                              style={{
                                display: 'flex',
                                flexDirection: isMe ? 'row-reverse' : 'row',
                                gap: 12,
                                marginBottom: 12,
                                justifyContent: isMe ? 'flex-end' : 'flex-start',
                              }}
                            >
                              <Avatar size="small" icon={<UserOutlined />} />
                              <div style={{ flex: 1, maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                                  <span style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>{r.user_name}</span>
                                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{dayjs(r.created_at).format('MM-DD HH:mm')}</span>
                                </div>
                                <div
                                  style={{
                                    background: isSolution ? '#f6ffed' : isMe ? '#e6f7ff' : '#fff',
                                    padding: '8px 12px',
                                    borderRadius: isMe ? '8px 8px 0 8px' : '0 8px 8px 8px',
                                    border: isSolution ? '1px solid #b7eb8f' : isMe ? '1px solid #91d5ff' : '1px solid #e2e8f0',
                                    fontSize: 13,
                                    whiteSpace: 'pre-wrap',
                                  }}
                                >
                                  {renderContentWithMentions(r.content, validMentionNames)}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                    <Form form={replyForm} layout="vertical">
                      <Form.Item name="content" style={{ marginBottom: 8 }}>
                        <Mentions
                          placeholder="发表进展或回复，输入 @ 可提及用户（支持按姓名/用户名搜索，如 @蒋）..."
                          autoSize={{ minRows: 1, maxRows: 4 }}
                          options={mentionOptions.map((u) => {
                            const name = u.full_name || u.username
                            const sub = u.responsible_for ? ` (${u.responsible_for})` : ''
                            return { value: name, label: `${name}${sub}` }
                          })}
                          onSearch={(text) => setMentionSearch(text)}
                          filterOption={!mentionSearchDebounced ? (input, option) => {
                            const opt = option as { value?: string; label?: string }
                            const label = (opt?.label ?? '').toString()
                            const val = (opt?.value ?? '').toString()
                            const q = (input || '').toLowerCase()
                            return label.toLowerCase().includes(q) || val.toLowerCase().includes(q)
                          } : false}
                        />
                      </Form.Item>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button type="primary" size="small" onClick={handleAddReply} style={{ color: '#fff' }}>发表回复</Button>
                      </div>
                    </Form>
                  </div>
                )}
              </div>
            )
          }}
        />
        {issuesTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
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
      </div>
    </Modal>
  )
}
