import React, { useState, useEffect } from 'react'
import { Modal, Tabs, List, Tag, Space, Empty, Button, Badge, Input, Pagination, Checkbox } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { aheadPlanService, type AheadPlanIssueItem } from '../../services/aheadPlanService'
import {
  ISSUE_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
} from '../../constants/aheadPlanIssues'
import { ClockCircleOutlined, InfoCircleOutlined, ArrowRightOutlined, CheckCircleOutlined, MessageOutlined } from '@ant-design/icons'

interface MyIssuesBoardModalProps {
  open: boolean
  onClose: () => void
  onOpenIssue: (activityId: string, typeOfPlan: string, title?: string, issueId?: number) => void
}

const PAGE_SIZE = 20

const priorityColor = (value: string) => (value === 'high' ? '#ff4d4f' : value === 'low' ? '#8c8c8c' : '#faad14')
const issueTypeLabel = (value: string) => ISSUE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value

export const MyIssuesBoardModal: React.FC<MyIssuesBoardModalProps> = ({ open, onClose, onOpenIssue }) => {
  const navigate = useNavigate()
  const [activeKey, setActiveKey] = useState('mention')
  const [searchText, setSearchText] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [mentionPage, setMentionPage] = useState(1)
  const [myPage, setMyPage] = useState(1)
  const [showClosedInMention, setShowClosedInMention] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchText.trim()), 300)
    return () => clearTimeout(t)
  }, [searchText])

  useEffect(() => {
    setMentionPage(1)
  }, [activeKey, searchDebounced])

  useEffect(() => {
    setMyPage(1)
  }, [activeKey, searchDebounced])

  const { data: counts } = useQuery({
    queryKey: ['ahead-plan-my-issues-counts'],
    queryFn: () => aheadPlanService.listMyIssuesCounts(),
    enabled: open,
  })

  const { data: mentionedData, isLoading: mentionedLoading, isError: mentionedError, refetch: refetchMentioned } = useQuery({
    queryKey: ['ahead-plan-my-mentioned-issues', mentionPage, searchDebounced, showClosedInMention],
    queryFn: () =>
      aheadPlanService.listMyMentionedIssues({
        search: searchDebounced || undefined,
        include_closed: showClosedInMention,
        skip: (mentionPage - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
    enabled: open,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const { data: myIssuesData, isLoading: myIssuesLoading, isError: myIssuesError, refetch: refetchMyIssues } = useQuery({
    queryKey: ['ahead-plan-my-issues', activeKey, myPage, searchDebounced],
    queryFn: () =>
      aheadPlanService.listMyIssues({
        tab: activeKey === 'urgent' ? 'urgent' : activeKey === 'unsolved' ? 'unsolved' : activeKey === 'toConfirm' ? 'to_confirm' : activeKey === 'closed' ? 'closed' : undefined,
        search: searchDebounced || undefined,
        skip: (myPage - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
    enabled: open && ['urgent', 'unsolved', 'toConfirm', 'closed'].includes(activeKey),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const isMentionTab = activeKey === 'mention'
  const items = isMentionTab ? (mentionedData?.items ?? []) : (myIssuesData?.items ?? [])
  const total = isMentionTab ? (mentionedData?.total ?? 0) : (myIssuesData?.total ?? 0)
  const loading = isMentionTab ? mentionedLoading : myIssuesLoading
  const currentPage = isMentionTab ? mentionPage : myPage
  const setPage = isMentionTab ? setMentionPage : setMyPage

  const renderIssueList = (listItems: AheadPlanIssueItem[]) => (
    <>
      {(isMentionTab && mentionedError) && (
        <div style={{ padding: '16px 0', textAlign: 'center', color: '#ff4d4f' }}>
          列表加载失败，请
          <Button type="link" size="small" style={{ padding: '0 4px' }} onClick={() => refetchMentioned()}>
            重试
          </Button>
        </div>
      )}
      {(!isMentionTab && myIssuesError) && (
        <div style={{ padding: '16px 0', textAlign: 'center', color: '#ff4d4f' }}>
          列表加载失败，请
          <Button type="link" size="small" style={{ padding: '0 4px' }} onClick={() => refetchMyIssues()}>
            重试
          </Button>
        </div>
      )}
      <List
        loading={loading}
        dataSource={listItems}
        locale={{
          emptyText: (isMentionTab && mentionedError) || (!isMentionTab && myIssuesError)
            ? null
            : <Empty description="暂无此分类的问题" style={{ padding: '24px 0' }} />,
        }}
        renderItem={(item) => {
          const isClosed = item.status === 'closed'
          const isResolved = item.status === 'resolved'
          const actionLabel = isClosed ? '已关闭' : isResolved ? '去确认' : '去处理'
          return (
          <List.Item
            key={item.id}
            actions={[
              isClosed ? (
                <Button
                  type="text"
                  size="small"
                  style={{ color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}
                  onClick={() => {
                    onOpenIssue(item.activity_id, item.type_of_plan, item.description, item.id)
                    const params = new URLSearchParams()
                    params.set('activityId', item.activity_id)
                    if (item.type_of_plan) params.set('typeOfPlan', item.type_of_plan)
                    navigate(`/ahead-plan?${params.toString()}`)
                    onClose()
                  }}
                >
                  已关闭
                </Button>
              ) : (
                <Button
                  type="link"
                  icon={isResolved ? <CheckCircleOutlined /> : <ArrowRightOutlined />}
                  onClick={() => {
                    onOpenIssue(item.activity_id, item.type_of_plan, item.description, item.id)
                    const params = new URLSearchParams()
                    params.set('activityId', item.activity_id)
                    if (item.type_of_plan) params.set('typeOfPlan', item.type_of_plan)
                    navigate(`/ahead-plan?${params.toString()}`)
                    onClose()
                  }}
                >
                  {actionLabel}
                </Button>
              ),
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  <Tag color={priorityColor(item.priority)} style={{ color: '#fff', fontSize: 10 }}>
                    {PRIORITY_OPTIONS.find(o => o.value === item.priority)?.label}
                  </Tag>
                  <span style={{ fontWeight: 600 }}>{issueTypeLabel(item.issue_type)}</span>
                  <Tag bordered={false} style={{ fontSize: 10 }}>{item.activity_id}</Tag>
                </Space>
              }
              description={
                <div style={{ marginTop: 4 }}>
                  <div style={{ color: '#334155', marginBottom: 4, fontSize: 13 }}>{item.description}</div>
                  <Space size="large" style={{ fontSize: 12, color: '#94a3b8' }}>
                    <span>提出：{item.raised_by_name}</span>
                    {item.planned_resolve_at && (
                      <span style={{ color: item.days_until_resolve && item.days_until_resolve < 0 && item.status !== 'closed' ? '#ff4d4f' : 'inherit' }}>
                        <ClockCircleOutlined /> 计划解决：{item.planned_resolve_at}
                      </span>
                    )}
                    {item.status === 'closed' && (
                      <Tag color="success" style={{ fontSize: 10 }}>已反馈</Tag>
                    )}
                  </Space>
                </div>
              }
            />
          </List.Item>
          )
        }}
      />
      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <Pagination
            size="small"
            current={currentPage}
            pageSize={PAGE_SIZE}
            total={total}
            onChange={setPage}
            showSizeChanger={false}
            showTotal={(t) => `共 ${t} 条`}
          />
        </div>
      )}
    </>
  )

  return (
    <Modal
      title={
        <Space>
          <InfoCircleOutlined style={{ color: '#1890ff' }} />
          <span>我的问题看板</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      bodyStyle={{ padding: '0 24px 24px 24px' }}
    >
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Input
          placeholder="搜索 activity_id、描述、提出人等"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ maxWidth: 360 }}
        />
        {activeKey === 'mention' && (
          <Checkbox
            checked={showClosedInMention}
            onChange={(e) => {
              setShowClosedInMention(e.target.checked)
              setMentionPage(1)
            }}
          >
            显示已关闭
          </Checkbox>
        )}
      </div>
      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        items={[
          {
            key: 'mention',
            label: (
              <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Badge count={counts?.mention ?? 0} offset={[10, 0]} color="#eb2f96">
                  <span><MessageOutlined style={{ marginRight: 4, fontSize: 12 }} />@我的</span>
                </Badge>
                {(typeof counts?.mention_unclosed === 'number' || typeof counts?.mention_closed === 'number') && (counts?.mention_unclosed !== 0 || counts?.mention_closed !== 0) && (
                  <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {[counts?.mention_unclosed ? `${counts.mention_unclosed} 待处理` : null, counts?.mention_closed ? `${counts.mention_closed} 已关闭` : null].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
            ),
            children: renderIssueList(items),
          },
          {
            key: 'urgent',
            label: <Badge count={counts?.urgent ?? 0} offset={[10, 0]} color="#ff4d4f">紧急待办</Badge>,
            children: renderIssueList(items),
          },
          {
            key: 'unsolved',
            label: <Badge count={counts?.unsolved ?? 0} offset={[10, 0]} color="#faad14">普通待办</Badge>,
            children: renderIssueList(items),
          },
          {
            key: 'toConfirm',
            label: <Badge count={counts?.to_confirm ?? 0} offset={[10, 0]} color="#1890ff">待我确认</Badge>,
            children: renderIssueList(items),
          },
          {
            key: 'closed',
            label: `已结案 (${counts?.closed ?? 0})`,
            children: renderIssueList(items),
          },
        ]}
      />
    </Modal>
  )
}
