import { 
  Card, 
  Button, 
  Space, 
  Alert, 
  Spin,
  Row,
  Col,
  Tooltip,
  Badge,
  Typography,
  Tag
} from 'antd'
import { 
  ReloadOutlined, 
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { p6Service } from '../services/p6Service'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

// 配置 dayjs 时区插件
dayjs.extend(utc)
dayjs.extend(timezone)

// 设置默认时区为 GMT+3
dayjs.tz.setDefault('Europe/Moscow') // GMT+3

const { Text, Paragraph } = Typography

// 调度器状态类型定义
interface SchedulerStatus {
  running?: boolean
  run_scheduler_running?: boolean
  scheduler_active_in_this_process?: boolean
  jobs?: Array<{
    id: string
    name: string
    next_run_time: string | null
  }>
  task_status?: {
    delete_detection_running?: boolean
    incremental_sync_running?: boolean
    reset_sync_running?: boolean
    status?: {
      incremental_sync?: {
        started_at?: string
        finished_at?: string
      }
      delete_detection?: {
        started_at?: string
        finished_at?: string
      }
      reset_sync?: {
        started_at?: string
        finished_at?: string
      }
    }
  }
  error?: string
}

// 实体类型定义（仅用于展示）
const GLOBAL_ENTITIES = [
  { value: 'eps', label: 'EPS（企业项目结构）' },
  { value: 'project', label: 'Project（项目）' },
  { value: 'activity_code', label: 'ActivityCode（作业代码）' },
  { value: 'resource', label: 'Resource（资源）' },
]

const PROJECT_ENTITIES = [
  { value: 'wbs', label: 'WBS（工作分解结构）' },
  { value: 'activity', label: 'Activity（作业）' },
  { value: 'activity_code_assignment', label: 'ActivityCodeAssignment（作业代码分配）' },
  { value: 'resource_assignment', label: 'ResourceAssignment（资源分配）' },
]

const P6SyncConfig = () => {
  // 获取P6连接状态
  const { data: p6Status, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['p6-status'],
    queryFn: () => p6Service.getP6Status(),
    refetchInterval: 10000, // 每10秒刷新一次
    retry: (failureCount, error: any) => {
      // 如果是连接错误（服务器关闭），减少重试次数
      if (error?.code === 'ECONNREFUSED' || error?.code === 'ECONNRESET' || error?.message?.includes('ECONNREFUSED') || error?.message?.includes('ECONNRESET')) {
        return failureCount < 1 // 只重试1次
      }
      return failureCount < 2 // 其他错误重试2次
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // 指数退避，最多30秒
    refetchOnWindowFocus: false, // 窗口获得焦点时不自动刷新
  })

  // 获取调度器状态
  const { data: schedulerStatus, isLoading: schedulerLoading, refetch: refetchScheduler, error: schedulerError } = useQuery<SchedulerStatus>({
    queryKey: ['p6-scheduler-status'],
    queryFn: () => p6Service.getSchedulerStatus(),
    enabled: true, // 明确启用查询
    staleTime: 0, // 立即认为数据过期，强制重新获取
    gcTime: 0, // 不缓存数据（React Query v5 使用 gcTime 替代 cacheTime）
    refetchInterval: 5000, // 每5秒刷新一次
    retry: (failureCount, error: any) => {
      // 如果是连接错误（服务器关闭），减少重试次数
      if (error?.code === 'ECONNREFUSED' || error?.code === 'ECONNRESET' || error?.message?.includes('ECONNREFUSED') || error?.message?.includes('ECONNRESET')) {
        return failureCount < 1 // 只重试1次
      }
      return failureCount < 2 // 其他错误重试2次
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // 指数退避，最多30秒
    refetchOnWindowFocus: false, // 窗口获得焦点时不自动刷新
  })

  // 获取同步日志（最近100条，用于显示各实体的最后同步记录和任务状态）
  const { data: syncLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['p6-sync-logs'],
    queryFn: () => p6Service.getSyncLogs({ skip: 0, limit: 100 }),
    refetchInterval: 30000, // 每30秒刷新一次
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  })

  // 获取连接状态图标和颜色
  const getConnectionStatus = () => {
    if (!p6Status?.configured) {
      return { icon: <WarningOutlined />, color: '#faad14', text: '未配置' }
    }
    if (!p6Status?.connected) {
      return { icon: <CloseCircleOutlined />, color: '#ff4d4f', text: '连接失败' }
    }
    return { icon: <CheckCircleOutlined />, color: '#52c41a', text: '连接成功' }
  }

  const connectionStatus = getConnectionStatus()

  // 格式化下次执行时间
  const formatNextRunTime = (timeStr: string | null) => {
    if (!timeStr) return '-'
    try {
      // 将 UTC 时间转换为 GMT+3
      const time = dayjs.utc(timeStr).tz('Europe/Moscow')
      const now = dayjs().tz('Europe/Moscow')
      const diffMinutes = time.diff(now, 'minute')
      
      // 如果时间差小于60分钟，显示相对时间
      if (diffMinutes > 0 && diffMinutes < 60) {
        return `${diffMinutes}分钟后 (${time.format('HH:mm:ss')})`
      }
      // 如果时间差小于24小时，只显示时间
      if (diffMinutes > 0 && diffMinutes < 1440) {
        return time.format('HH:mm:ss')
      }
      // 否则显示完整时间
      return time.format('YYYY-MM-DD HH:mm:ss')
    } catch {
      return timeStr
    }
  }
  
  // 格式化时间显示（用于显示上次执行时间）
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-'
    try {
      // 将 UTC 时间转换为 GMT+3
      return dayjs.utc(timeStr).tz('Europe/Moscow').format('HH:mm:ss')
    } catch {
      return timeStr
    }
  }

  // 获取任务状态
  const getTaskStatus = (taskType: 'incremental_sync' | 'delete_detection' | 'reset_sync') => {
    if (!schedulerStatus) {
      return {
        running: false,
        lastRun: null,
        nextRun: null,
      }
    }
    
    const taskStatus = (schedulerStatus as SchedulerStatus)?.task_status || {}
    const statusDetail = taskStatus.status || {}
    const jobs = (schedulerStatus as SchedulerStatus)?.jobs || []
    
    // 从同步日志中获取上次执行时间（更可靠）
    let lastRunFromLogs: string | null = null
    if (syncLogs && syncLogs.length > 0) {
      if (taskType === 'incremental_sync') {
        // 增量同步：找最近的已完成日志
        // 优先找全局实体（eps, project, activity_code, resource）的日志，因为它们总是被增量同步
        const globalEntityTypes = ['eps', 'project', 'activity_code', 'resource']
        const globalLogs = syncLogs.filter((log: any) => 
          log.status === 'completed' && 
          globalEntityTypes.includes(log.sync_type?.toLowerCase())
        )
        
        // 如果找到全局实体日志，使用最新的
        if (globalLogs.length > 0) {
          const recentLog = globalLogs.sort((a: any, b: any) => {
            const timeA = a.completed_at ? new Date(a.completed_at).getTime() : 0
            const timeB = b.completed_at ? new Date(b.completed_at).getTime() : 0
            return timeB - timeA
          })[0]
          lastRunFromLogs = recentLog?.completed_at || null
        } else {
          // 如果没有全局实体日志，使用所有已完成日志中最新的
          const allLogs = syncLogs.filter((log: any) => log.status === 'completed')
          const recentLog = allLogs.sort((a: any, b: any) => {
            const timeA = a.completed_at ? new Date(a.completed_at).getTime() : 0
            const timeB = b.completed_at ? new Date(b.completed_at).getTime() : 0
            return timeB - timeA
          })[0]
          lastRunFromLogs = recentLog?.completed_at || null
        }
      } else if (taskType === 'delete_detection') {
        // 删除检测不创建同步日志，只能从状态文件获取
        // 这里不需要从日志中获取，因为删除检测不会产生同步日志
        lastRunFromLogs = null
      }
    }
    
    // 优先使用状态文件中的时间，如果没有则使用日志中的时间
    let lastRun: string | null = null
    if (taskType === 'incremental_sync') {
      lastRun = statusDetail.incremental_sync?.started_at || lastRunFromLogs
    } else if (taskType === 'delete_detection') {
      lastRun = statusDetail.delete_detection?.started_at || lastRunFromLogs
    } else {
      lastRun = statusDetail.reset_sync?.started_at || null
    }
    
    // 查找对应的job，获取下次执行时间
    let nextRunTime: string | null = null
    if (taskType === 'incremental_sync') {
      const job = jobs.find((j: any) => {
        const idMatch = j.id === 'incremental_sync'
        const nameMatch = j.name === '增量同步' || j.name?.includes('增量')
        return idMatch || nameMatch
      })
      nextRunTime = job?.next_run_time || null
    } else if (taskType === 'delete_detection') {
      const job = jobs.find((j: any) => {
        const idMatch = j.id === 'delete_detection'
        const nameMatch = j.name === '删除检测' || j.name?.includes('删除')
        return idMatch || nameMatch
      })
      nextRunTime = job?.next_run_time || null
    } else {
      // reset_sync 没有对应的 job，因为它不是定时任务
      nextRunTime = null
    }
    
    if (taskType === 'incremental_sync') {
      return {
        running: taskStatus.incremental_sync_running || false,
        lastRun: lastRun,
        nextRun: nextRunTime,
      }
    } else if (taskType === 'delete_detection') {
      return {
        running: taskStatus.delete_detection_running || false,
        lastRun: lastRun,
        nextRun: nextRunTime,
      }
    } else {
      return {
        running: taskStatus.reset_sync_running || false,
        lastRun: lastRun,
        nextRun: nextRunTime,
      }
    }
  }

  const incrementalSyncStatus = getTaskStatus('incremental_sync')
  const deleteDetectionStatus = getTaskStatus('delete_detection')
  const resetSyncStatus = getTaskStatus('reset_sync')

  // 获取当前运行的任务
  const getCurrentRunningTask = () => {
    if (resetSyncStatus.running) {
      return { name: '重置同步', color: 'red', type: 'reset_sync' }
    }
    if (deleteDetectionStatus.running) {
      return { name: '删除检测', color: 'orange', type: 'delete_detection' }
    }
    if (incrementalSyncStatus.running) {
      return { name: '增量同步', color: 'blue', type: 'incremental_sync' }
    }
    return null
  }

  // 获取下一个计划执行的任务
  const getNextScheduledTask = (): { name: string; nextRun: string; job: any } | null => {
    if (!schedulerStatus) return null
    
    const jobs = (schedulerStatus as SchedulerStatus)?.jobs || []
    if (jobs.length === 0) return null
    
    const now = new Date()
    let nextTask: { name: string; nextRun: string; job: any } | null = null
    
    // 找到所有有 next_run_time 的任务，选择最近的一个
    jobs.forEach((job: any) => {
      if (job.next_run_time) {
        try {
          const nextRunTime = new Date(job.next_run_time)
          // 只选择未来的时间
          if (nextRunTime > now) {
            if (!nextTask || nextRunTime < new Date(nextTask.nextRun)) {
              nextTask = {
                name: job.name || job.id || '未知任务',
                nextRun: job.next_run_time,
                job: job
              }
            }
          }
        } catch (e) {
          // 忽略无效的时间格式
        }
      }
    })
    
    return nextTask
  }

  const currentTask = getCurrentRunningTask()
  const nextScheduledTask = getNextScheduledTask()

  return (
    <div style={{ 
      padding: '16px', 
      background: '#f5f7fa',
      height: 'calc(100vh - 64px)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 页面标题 */}
      <div style={{ 
        marginBottom: 12,
        flexShrink: 0
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: 18, 
          fontWeight: 600,
          color: '#1f2937',
          marginBottom: 2
        }}>
          P6同步看板
        </h1>
        <p style={{ 
          margin: 0, 
          fontSize: 11, 
          color: '#6b7280'
        }}>
          实时监控P6数据同步状态和任务执行情况
        </p>
      </div>

      {/* 可滚动内容区域 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingRight: 4
      }}>

        {/* 第一行：状态信息 */}
        <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
        {/* P6连接状态卡片 */}
        <Col xs={24} sm={24} md={8} lg={8} style={{ display: 'flex' }}>
          <Card
            title={
              <Space>
                <span style={{ fontSize: 13, fontWeight: 600 }}>P6连接状态</span>
                <span style={{ 
                  color: connectionStatus.color, 
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  {connectionStatus.icon}
                  {connectionStatus.text}
                </span>
              </Space>
            }
            size="small"
            extra={
              <Tooltip title="刷新P6服务器连接状态">
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={() => refetchStatus()}
                  loading={statusLoading}
                  size="small"
                  type="text"
                  style={{ color: '#1890ff' }}
                />
              </Tooltip>
            }
            style={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              width: '100%'
            }}
            headStyle={{ padding: '6px 10px', minHeight: 'auto' }}
            bodyStyle={{ flex: 1, padding: '8px' }}
          >
            <Spin spinning={statusLoading}>
              {!p6Status?.configured && (
                <Alert
                  message="P6未配置"
                  description="请在backend/.env文件中配置P6服务器连接信息"
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                />
              )}

              {p6Status?.configured && !p6Status?.connected && (
                <Alert
                  message="P6连接失败"
                  description="无法连接到P6服务器，请检查配置和网络连接"
                  type="error"
                  showIcon
                  style={{ marginBottom: 12 }}
                />
              )}

              {p6Status?.connected && (
                <div>
                  <Row gutter={[8, 8]}>
                    <Col span={12}>
                      <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        padding: '10px',
                        borderRadius: 6,
                        color: 'white',
                        minHeight: 60
                      }}>
                        <div style={{ fontSize: 10, opacity: 0.9, marginBottom: 4 }}>项目总数</div>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>
                          {p6Status?.total_projects_count || 0}
                        </div>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{
                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        padding: '10px',
                        borderRadius: 6,
                        color: 'white',
                        minHeight: 60
                      }}>
                        <div style={{ fontSize: 10, opacity: 0.9, marginBottom: 4 }}>已同步项目</div>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>
                          {p6Status?.synced_projects_count || 0}
                        </div>
                      </div>
                    </Col>
                  </Row>
                  {p6Status?.synced_projects && p6Status.synced_projects.length > 0 && (
                    <div style={{ 
                      marginTop: 6,
                      padding: '4px 8px',
                      background: '#f8f9fa',
                      borderRadius: 4,
                      fontSize: 10, 
                      color: '#495057'
                    }}>
                      <strong>已同步项目：</strong>
                      {p6Status.synced_projects.slice(0, 5).join(', ')}
                      {p6Status.synced_projects.length > 5 && ` 等${p6Status.synced_projects.length}个`}
                    </div>
                  )}
                </div>
              )}
            </Spin>
          </Card>
        </Col>

        {/* 调度器状态卡片 */}
        <Col xs={24} sm={12} md={8} lg={8} style={{ display: 'flex' }}>
          <Card 
            title={<span style={{ fontSize: 13, fontWeight: 600 }}>调度器状态</span>}
            size="small"
            extra={
              <Tooltip title="刷新调度器状态">
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={() => refetchScheduler()}
                  loading={schedulerLoading}
                  size="small"
                  type="text"
                  style={{ color: '#1890ff' }}
                />
              </Tooltip>
            }
            style={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              width: '100%'
            }}
            headStyle={{ padding: '6px 10px', minHeight: 'auto' }}
            bodyStyle={{ flex: 1, padding: '8px' }}
          >
            <Spin spinning={schedulerLoading}>
              {/* 只有在真正的错误（网络错误或API返回error字段）时才显示错误提示 */}
              {schedulerError && (
                <Alert
                  message="无法获取调度器状态"
                  description={
                    schedulerError?.message?.includes('ECONNREFUSED') || schedulerError?.message?.includes('ECONNRESET')
                      ? "后端服务可能已关闭，请检查后端服务是否正在运行"
                      : schedulerError?.message || "无法连接到后端服务"
                  }
                  type="error"
                  showIcon
                  style={{ marginBottom: 8, fontSize: 11 }}
                />
              )}
              
              {/* 如果API返回了error字段，也显示错误 */}
              {!schedulerError && (schedulerStatus as SchedulerStatus)?.error && (
                <Alert
                  message="无法获取调度器状态"
                  description={(schedulerStatus as SchedulerStatus).error}
                  type="warning"
                  showIcon
                  style={{ marginBottom: 8, fontSize: 11 }}
                />
              )}
              
              {/* 正常显示状态（没有错误时） */}
              {!schedulerError && !(schedulerStatus as SchedulerStatus)?.error && (
                <>
                  <div style={{ marginBottom: 6 }}>
                    <Space size="small">
                      <Badge 
                        status={((schedulerStatus as SchedulerStatus)?.running || (schedulerStatus as SchedulerStatus)?.run_scheduler_running) ? "success" : "default"} 
                        text={((schedulerStatus as SchedulerStatus)?.running || (schedulerStatus as SchedulerStatus)?.run_scheduler_running) ? "运行中" : "已停止"}
                        style={{ fontSize: 10 }}
                      />
                      {(schedulerStatus as SchedulerStatus)?.running && (
                        <Tag color="green" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>自动调度已启用</Tag>
                      )}
                      {(schedulerStatus as SchedulerStatus)?.run_scheduler_running && (
                        <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>后台服务运行中</Tag>
                      )}
                    </Space>
                  </div>
                  
                  {(schedulerStatus as SchedulerStatus)?.jobs && (schedulerStatus as SchedulerStatus).jobs!.length > 0 && (
                    <div style={{ fontSize: 10, color: '#666', marginBottom: 6 }}>
                      {(schedulerStatus as SchedulerStatus).jobs!.map((job) => (
                        <div key={job.id} style={{ marginBottom: 3 }}>
                          <div style={{ fontWeight: 500, fontSize: 10, marginBottom: 1 }}>{job.name}</div>
                          <div style={{ color: '#999', fontSize: 9 }}>
                            下次: {formatNextRunTime(job.next_run_time)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(schedulerStatus as SchedulerStatus)?.run_scheduler_running && (
                    <div style={{ 
                      marginTop: 6,
                      padding: '4px 8px',
                      background: '#f6ffed',
                      borderRadius: 4,
                      border: '1px solid #b7eb8f',
                      fontSize: 10, 
                      color: '#389e0d'
                    }}>
                      <InfoCircleOutlined style={{ marginRight: 4, fontSize: 10 }} />
                      调度器由后台服务自动管理，系统运行正常
                    </div>
                  )}

                  {!(schedulerStatus as SchedulerStatus)?.running && !(schedulerStatus as SchedulerStatus)?.run_scheduler_running && !(schedulerStatus as SchedulerStatus)?.error && (
                    <div style={{ 
                      marginTop: 8,
                      padding: '6px 10px',
                      background: '#fff7e6',
                      borderRadius: 4,
                      border: '1px solid #ffe58f',
                      fontSize: 11, 
                      color: '#ad6800'
                    }}>
                      <InfoCircleOutlined style={{ marginRight: 4, fontSize: 11 }} />
                      调度器未运行，请启动 run_scheduler.py 后台服务
                    </div>
                  )}
                </>
              )}
            </Spin>
          </Card>
        </Col>

        {/* 任务状态卡片 */}
        <Col xs={24} sm={24} md={8} lg={8} style={{ display: 'flex' }}>
          <Card 
            title={<span style={{ fontSize: 13, fontWeight: 600 }}>任务状态</span>}
            size="small"
            style={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              width: '100%'
            }}
            headStyle={{ padding: '6px 10px', minHeight: 'auto' }}
            bodyStyle={{ flex: 1, padding: '8px' }}
          >
            {currentTask && (
              <div style={{ 
                marginBottom: 6,
                padding: '6px',
                background: `linear-gradient(135deg, ${currentTask.color === 'red' ? '#ff4d4f' : currentTask.color === 'orange' ? '#ff9800' : '#1890ff'}15 0%, ${currentTask.color === 'red' ? '#ff4d4f' : currentTask.color === 'orange' ? '#ff9800' : '#1890ff'}05 100%)`,
                borderRadius: 4,
                border: `1px solid ${currentTask.color === 'red' ? '#ff4d4f' : currentTask.color === 'orange' ? '#ff9800' : '#1890ff'}40`
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: currentTask.color === 'red' ? '#ff4d4f' : currentTask.color === 'orange' ? '#ff9800' : '#1890ff', marginBottom: 2 }}>
                  当前运行: {currentTask.name}
                </div>
                <Badge status="processing" text="执行中" style={{ fontSize: 9 }} />
              </div>
            )}

            {/* 显示下一步计划（无论是否有正在运行的任务） */}
            {nextScheduledTask && (
              <div style={{ 
                marginBottom: 6,
                padding: '6px',
                background: '#f0f9ff',
                borderRadius: 4,
                border: '1px solid #bae7ff',
                fontSize: 10
              }}>
                <div style={{ color: '#1890ff', fontWeight: 600, marginBottom: 2 }}>
                  下一步计划: {nextScheduledTask.name}
                </div>
                <div style={{ color: '#666', fontSize: 9 }}>
                  执行时间: {formatNextRunTime(nextScheduledTask.nextRun)}
                </div>
              </div>
            )}

            {!currentTask && !nextScheduledTask && (
              <div style={{ 
                marginBottom: 6,
                padding: '6px',
                background: '#f5f5f5',
                borderRadius: 4,
                textAlign: 'center',
                color: '#999',
                fontSize: 10
              }}>
                当前无运行中的任务
              </div>
            )}

            {/* 三个任务横向排列 */}
            <Row gutter={[6, 6]}>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <Badge 
                    status={resetSyncStatus.running ? "processing" : "default"} 
                    text={<span style={{ fontSize: 10 }}>重置同步</span>}
                  />
                  {resetSyncStatus.running ? (
                    <div style={{ color: '#1890ff', fontSize: 9, marginTop: 2, fontWeight: 500 }}>
                      正在执行
                    </div>
                  ) : resetSyncStatus.lastRun ? (
                    <div style={{ color: '#666', fontSize: 9, marginTop: 2 }}>
                      上次: {formatTime(resetSyncStatus.lastRun)}
                    </div>
                  ) : (
                    <div style={{ color: '#999', fontSize: 9, marginTop: 2 }}>
                      尚未执行
                    </div>
                  )}
                </div>
              </Col>
              
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <Badge 
                    status={incrementalSyncStatus.running ? "processing" : "default"} 
                    text={<span style={{ fontSize: 10 }}>增量同步</span>}
                  />
                  {incrementalSyncStatus.running ? (
                    <div style={{ color: '#1890ff', fontSize: 9, marginTop: 2, fontWeight: 500 }}>
                      正在执行
                    </div>
                  ) : incrementalSyncStatus.lastRun ? (
                    <div style={{ color: '#666', fontSize: 9, marginTop: 2 }}>
                      上次: {formatTime(incrementalSyncStatus.lastRun)}
                    </div>
                  ) : (
                    <div style={{ color: '#999', fontSize: 9, marginTop: 2 }}>
                      尚未执行
                    </div>
                  )}
                  {incrementalSyncStatus.nextRun && !incrementalSyncStatus.running && (
                    <div style={{ color: '#52c41a', fontSize: 9, marginTop: 2 }}>
                      计划: {formatNextRunTime(incrementalSyncStatus.nextRun)}
                    </div>
                  )}
                </div>
              </Col>
              
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <Badge 
                    status={deleteDetectionStatus.running ? "processing" : "default"} 
                    text={<span style={{ fontSize: 10 }}>删除检测</span>}
                  />
                  {deleteDetectionStatus.running ? (
                    <div style={{ color: '#1890ff', fontSize: 9, marginTop: 2, fontWeight: 500 }}>
                      正在执行
                    </div>
                  ) : deleteDetectionStatus.lastRun ? (
                    <div style={{ color: '#666', fontSize: 9, marginTop: 2 }}>
                      上次: {formatTime(deleteDetectionStatus.lastRun)}
                    </div>
                  ) : (
                    <div style={{ color: '#999', fontSize: 9, marginTop: 2 }}>
                      尚未执行
                    </div>
                  )}
                  {deleteDetectionStatus.nextRun && !deleteDetectionStatus.running && (
                    <div style={{ color: '#52c41a', fontSize: 9, marginTop: 2 }}>
                      计划: {formatNextRunTime(deleteDetectionStatus.nextRun)}
                    </div>
                  )}
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>


        {/* 第二行：同步实体信息 */}
        <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
        <Col xs={24} md={12}>
          <Card
            title={<span style={{ fontSize: 13, fontWeight: 600 }}>同步的全局实体</span>}
            size="small"
            style={{ 
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              height: '100%'
            }}
            headStyle={{ padding: '6px 10px', minHeight: 'auto' }}
            bodyStyle={{ padding: '8px' }}
          >
            <div style={{
              padding: '8px',
              background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
              borderRadius: 4,
              border: '1px solid #93c5fd',
            }}>
              <div style={{ 
                marginBottom: 6, 
                fontWeight: 600, 
                fontSize: 11,
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <InfoCircleOutlined style={{ fontSize: 11 }} />
                全局实体（所有项目共享）
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {GLOBAL_ENTITIES.map(entity => (
                  <div key={entity.value} style={{ 
                    padding: '4px 8px',
                    background: 'rgba(255, 255, 255, 0.6)',
                    borderRadius: 3,
                    fontSize: 11
                  }}>
                    {entity.label}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Col>
        
        <Col xs={24} md={12}>
          <Card
            title={<span style={{ fontSize: 13, fontWeight: 600 }}>同步的项目实体</span>}
            size="small"
            style={{ 
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              height: '100%'
            }}
            headStyle={{ padding: '6px 10px', minHeight: 'auto' }}
            bodyStyle={{ padding: '8px' }}
          >
            <div style={{
              padding: '8px',
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              borderRadius: 4,
              border: '1px solid #fcd34d',
            }}>
              <div style={{ 
                marginBottom: 6, 
                fontWeight: 600, 
                fontSize: 11,
                color: '#92400e',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <InfoCircleOutlined style={{ fontSize: 11 }} />
                项目实体（按项目同步）
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {PROJECT_ENTITIES.map(entity => (
                  <div key={entity.value} style={{ 
                    padding: '4px 8px',
                    background: 'rgba(255, 255, 255, 0.6)',
                    borderRadius: 3,
                    fontSize: 11
                  }}>
                    {entity.label}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

        {/* 同步记录 */}
        <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
          <Col xs={24}>
            <Card
              title={
                <Space>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>今日同步记录</span>
                  <Tooltip title="刷新同步记录">
                    <Button 
                      icon={<ReloadOutlined />} 
                      onClick={() => refetchLogs()}
                      loading={logsLoading}
                      size="small"
                      type="text"
                      style={{ color: '#1890ff' }}
                    />
                  </Tooltip>
                </Space>
              }
              size="small"
              style={{ 
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
              headStyle={{ padding: '6px 10px', minHeight: 'auto' }}
              bodyStyle={{ padding: '8px', maxHeight: '200px', overflowY: 'auto' }}
            >
              <Spin spinning={logsLoading}>
                {syncLogs && syncLogs.length > 0 ? (() => {
                  // 获取今天的开始时间（0点，使用 GMT+3 时区）
                  const todayStart = dayjs().tz('Europe/Moscow').startOf('day')
                  
                  // 过滤出今天的同步记录
                  const todayLogs = syncLogs.filter((log: any) => {
                    if (!log.completed_at) return false
                    // 将 UTC 时间转换为 GMT+3 后进行比较
                    const logTime = dayjs.utc(log.completed_at).tz('Europe/Moscow')
                    return logTime.isAfter(todayStart) || logTime.isSame(todayStart, 'day')
                  })
                  
                  return todayLogs.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 5 }}>
                      {/* 按实体类型分组，显示每个实体的今日最新同步记录 */}
                      {[...GLOBAL_ENTITIES, ...PROJECT_ENTITIES].map(entity => {
                        // 找到该实体类型今天的同步记录，按时间倒序排列
                        const entityLogs = todayLogs
                          .filter((log: any) => 
                            log.sync_type?.toLowerCase() === entity.value.toLowerCase()
                          )
                          .sort((a: any, b: any) => {
                            const timeA = a.completed_at ? new Date(a.completed_at).getTime() : 0
                            const timeB = b.completed_at ? new Date(b.completed_at).getTime() : 0
                            return timeB - timeA
                          })
                        const latestLog = entityLogs.length > 0 ? entityLogs[0] : null
                      
                      if (!latestLog) {
                        return null
                      }
                      
                      const statusColor = latestLog.status === 'completed' ? '#52c41a' : 
                                        latestLog.status === 'failed' ? '#ff4d4f' : '#faad14'
                      const statusText = latestLog.status === 'completed' ? '成功' : 
                                        latestLog.status === 'failed' ? '失败' : '进行中'
                      
                      return (
                        <div 
                          key={entity.value}
                          style={{
                            padding: '6px 10px',
                            background: '#f9fafb',
                            borderRadius: 4,
                            border: '1px solid #e5e7eb',
                            fontSize: 11
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                            <span style={{ fontWeight: 500, fontSize: 10 }}>{entity.label}</span>
                            <Tag color={statusColor} style={{ fontSize: 9, margin: 0, padding: '0 3px' }}>
                              {statusText}
                            </Tag>
                          </div>
                          <div style={{ fontSize: 9, color: '#666', lineHeight: 1.4 }}>
                            {latestLog.completed_at && (
                              <div>完成: {dayjs.utc(latestLog.completed_at).tz('Europe/Moscow').format('MM-DD HH:mm')}</div>
                            )}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {(latestLog.read_count !== null && latestLog.read_count !== undefined) && (
                                <span>读取: {latestLog.read_count}</span>
                              )}
                              {(latestLog.write_count !== null && latestLog.write_count !== undefined) && (
                                <span>写入: {latestLog.write_count}</span>
                              )}
                              <span style={{ color: '#52c41a' }}>新增: {latestLog.created_count || 0}</span>
                              <span style={{ color: '#1890ff' }}>更新: {latestLog.updated_count || 0}</span>
                              <span style={{ color: '#ff4d4f' }}>删除: {latestLog.deleted_count || 0}</span>
                            </div>
                            {latestLog.error_message && (
                              <div style={{ color: '#ff4d4f', marginTop: 2, fontSize: 9 }}>
                                {latestLog.error_message.length > 30 ? latestLog.error_message.substring(0, 30) + '...' : latestLog.error_message}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {[...GLOBAL_ENTITIES, ...PROJECT_ENTITIES].every(entity => {
                      const entityLogs = todayLogs.filter((log: any) => 
                        log.sync_type?.toLowerCase() === entity.value.toLowerCase()
                      )
                      return entityLogs.length === 0
                    }) && (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: 12, gridColumn: '1 / -1' }}>
                        今日暂无同步记录
                      </div>
                    )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: 12 }}>
                      今日暂无同步记录
                    </div>
                  )
                })() : (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: 12 }}>
                    {logsLoading ? '加载中...' : '暂无同步记录'}
                  </div>
                )}
              </Spin>
            </Card>
          </Col>
        </Row>

        {/* 调度说明 */}
        <Row gutter={[8, 8]}>
          <Col xs={24}>
            <Card
              title={<span style={{ fontSize: 13, fontWeight: 600 }}>调度说明</span>}
              size="small"
              style={{ 
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
              headStyle={{ padding: '6px 10px', minHeight: 'auto' }}
              bodyStyle={{ padding: '8px' }}
            >
              <Paragraph style={{ marginBottom: 4, fontSize: 11, margin: 0, lineHeight: 1.6 }}>
                <strong>增量同步：</strong>每5分钟执行一次（:05, :10, ..., :55）
              </Paragraph>
              <Paragraph style={{ marginBottom: 4, fontSize: 11, margin: 0, lineHeight: 1.6 }}>
                <strong>删除检测：</strong>每小时整点执行（:00），自动检测P6中已删除的实体并标记为is_active=0
              </Paragraph>
              <Paragraph style={{ marginBottom: 0, fontSize: 11, color: '#666', margin: 0, lineHeight: 1.6 }}>
                <strong>注意：</strong>删除检测运行时会自动跳过增量同步，避免数据冲突。调度器需要独立运行 <Text code style={{ fontSize: 11 }}>run_scheduler.py</Text> 服务。
              </Paragraph>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  )
}

export default P6SyncConfig
