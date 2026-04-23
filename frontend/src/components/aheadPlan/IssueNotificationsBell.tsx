import React, { useState } from 'react'
import { Badge, Dropdown, Button, List, ConfigProvider, Space } from 'antd'
import { BellOutlined, InfoCircleOutlined, MessageOutlined, UserAddOutlined, CheckCircleOutlined, BulbOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { aheadPlanService, type AheadPlanIssueNotificationItem } from '../../services/aheadPlanService'

const typeConfig: Record<string, { label: string, color: string, icon: React.ReactNode }> = {
  assigned: { label: '分配问题', color: '#1890ff', icon: <UserAddOutlined /> },
  resolved: { label: '问题已解', color: '#faad14', icon: <BulbOutlined /> },
  confirmed: { label: '评价结案', color: '#52c41a', icon: <CheckCircleOutlined /> },
  reply: { label: '问题回复', color: '#722ed1', icon: <MessageOutlined /> },
  mention: { label: '@我的', color: '#eb2f96', icon: <MessageOutlined /> },
}

export const IssueNotificationsBell: React.FC<{ 
  onViewAll?: () => void,
  onOpenIssue?: (activityId: string, typeOfPlan: string, title?: string, issueId?: number) => void
}> = ({ onViewAll, onOpenIssue }) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filterType, setFilterType] = useState<'all' | 'mention'>('all')
  const { data: notifications = [] } = useQuery({
    queryKey: ['ahead-plan-notifications', { unread_only: true }],
    queryFn: () => aheadPlanService.listIssueNotifications({ unread_only: true, limit: 50 }),
    refetchInterval: 10000, // 每 10 秒轮询，减少滞后
    refetchOnWindowFocus: true, // 窗口聚焦时刷新
  })
  const filtered = filterType === 'mention' ? notifications.filter((n) => n.type === 'mention') : notifications
  const unreadCount = notifications.length

  const markReadAndGo = async (n: AheadPlanIssueNotificationItem) => {
    if (!n.read_at) {
      try {
        await aheadPlanService.markIssueNotificationRead(n.id)
        queryClient.invalidateQueries({ queryKey: ['ahead-plan-notifications'] })
      } catch (_) {}
    }
    
    const activityId = n.payload?.activity_id || ''
    const typeOfPlan = n.payload?.type_of_plan || ''
    if (activityId && typeOfPlan && onOpenIssue) {
      onOpenIssue(activityId, typeOfPlan, n.payload?.title, n.issue_id)
      
      // 导航到专项计划页面，并带上定位参数
      const params = new URLSearchParams()
      params.set('activityId', activityId)
      params.set('typeOfPlan', typeOfPlan)
      navigate(`/ahead-plan?${params.toString()}`)
    } else {
      // 默认行为：跳转到专项计划页面
      navigate('/ahead-plan')
    }
  }

  const overlay = (
    <div style={{ 
      width: 380, 
      maxHeight: 480, 
      overflow: 'hidden',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 6px 16px -8px rgba(0,0,0,0.08), 0 9px 28px 0 rgba(0,0,0,0.05), 0 12px 48px 16px rgba(0,0,0,0.03)',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid #f0f0f0'
    }}>
      <div style={{ 
        padding: '16px 20px', 
        borderBottom: '1px solid #f0f0f0', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8
      }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>通知中心</span>
        <Space size="small">
          <Button type={filterType === 'all' ? 'primary' : 'text'} size="small" onClick={() => setFilterType('all')}>全部</Button>
          <Button type={filterType === 'mention' ? 'primary' : 'text'} size="small" onClick={() => setFilterType('mention')}>@我的</Button>
          {unreadCount > 0 && <Badge count={unreadCount} style={{ backgroundColor: '#ff4d4f' }} />}
        </Space>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <InfoCircleOutlined style={{ fontSize: 32, color: '#e2e8f0', marginBottom: 8 }} />
            <div style={{ color: '#94a3b8' }}>{filterType === 'mention' ? '暂无@我的消息' : '暂无未读消息'}</div>
          </div>
        ) : (
          <List
            size="small"
            dataSource={filtered}
            renderItem={(n) => {
              const cfg = typeConfig[n.type] || { label: n.type, color: '#64748b', icon: <BellOutlined /> }
              return (
                <List.Item
                  key={n.id}
                  style={{ 
                    cursor: 'pointer', 
                    padding: '14px 20px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => markReadAndGo(n)}
                >
                  <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                    <div style={{ 
                      width: 32, height: 32, borderRadius: 8, background: `${cfg.color}15`, 
                      color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontSize: 16
                    }}>
                      {cfg.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{cfg.label}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{n.created_at ? dayjs(n.created_at).format('MM-DD HH:mm') : ''}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#475569', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.payload?.title || '查看详情'}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        作业: {n.payload?.activity_id}
                        {n.payload?.reply_preview && ` · 回复: ${n.payload.reply_preview}`}
                      </div>
                    </div>
                  </div>
                </List.Item>
              )
            }}
          />
        )}
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
        <Button type="link" size="small" block onClick={() => onViewAll?.()}>
          查看我的问题看板
        </Button>
      </div>
    </div>
  )

  return (
    <ConfigProvider theme={{ token: { borderRadius: 12 } }}>
      <Dropdown dropdownRender={() => overlay} trigger={['click']} placement="bottomRight">
        <Badge count={unreadCount} size="small" offset={[-2, 6]} overflowCount={99}>
          <Button
            type="text"
            icon={<BellOutlined style={{ fontSize: 20 }} />}
            style={{ 
              color: '#fff', 
              width: 40, 
              height: 40, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.1)',
              marginRight: 8,
              borderRadius: '50%'
            }}
          />
        </Badge>
      </Dropdown>
    </ConfigProvider>
  )
}
