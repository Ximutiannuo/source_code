import { useState, useMemo, useEffect } from 'react'
import { 
  Card, DatePicker, Table, Tag, Space, App, Select, Button,
  Tabs, Statistic, Row, Col, Modal
} from 'antd'
import { 
  CheckCircleOutlined, ClockCircleOutlined, 
  ReloadOutlined, CalendarOutlined, SettingOutlined,
  UserOutlined, SolutionOutlined, InfoCircleOutlined
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { 
  dailyReportFillService,
  type DailyReportSubmission
} from '../services/dailyReportFillService'

// 定义必填Scope配置的类型
interface RequiredScopesConfig {
  report_type: string
  required_scopes: string[]
  total_available_scopes: number
  available_scopes: string[]
}
import type { ColumnsType } from 'antd/es/table'

const { Option } = Select

const DailyReportStatusManagement = () => {
  const { message: messageApi } = App.useApp()
  const queryClient = useQueryClient()

  // 状态管理
  const [reportType, setReportType] = useState<'MP' | 'VFACT'>('MP')
  const [activeTab, setActiveTab] = useState('status')
  
  // 根据报告类型设置默认日期
  const [selectedDate, setSelectedDate] = useState<Dayjs>(
    reportType === 'MP' ? dayjs() : dayjs().subtract(1, 'day')
  )
  
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>([
    dayjs().subtract(7, 'day'),
    dayjs()
  ])

  // 当报告类型改变时，自动调整单日期选择器的默认值
  useEffect(() => {
    if (reportType === 'MP') {
      setSelectedDate(dayjs())
    } else {
      setSelectedDate(dayjs().subtract(1, 'day'))
    }
  }, [reportType])
  const [configModalVisible, setConfigModalVisible] = useState(false)
  const [selectedRequiredScopes, setSelectedRequiredScopes] = useState<string[]>([])
  const [availableScopes, setAvailableScopes] = useState<string[]>([])

  // 获取填报状态
  const { data: submissionStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['dailyReportStatus', selectedDate.format('YYYY-MM-DD'), reportType],
    queryFn: () => dailyReportFillService.getSubmissionStatus(
      selectedDate.format('YYYY-MM-DD'),
      reportType
    )
  })

  // 获取填报记录列表
  const { data: submissions = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ['dailyReportSubmissions', dateRange, reportType],
    queryFn: () => {
      if (!dateRange) return Promise.resolve([])
      return dailyReportFillService.getSubmissions({
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
        report_type: reportType
      })
    },
    enabled: !!dateRange
  })

  // 获取必填scope配置
  const { data: requiredScopesConfig, refetch: refetchRequiredScopes } = useQuery<RequiredScopesConfig>({
    queryKey: ['requiredScopes', reportType],
    queryFn: () => dailyReportFillService.getRequiredScopes(reportType),
  })

  // 当配置数据加载后，更新状态
  useEffect(() => {
    if (requiredScopesConfig) {
      setSelectedRequiredScopes(requiredScopesConfig.required_scopes || [])
      // 使用API返回的所有可用scope
      if (requiredScopesConfig.available_scopes && Array.isArray(requiredScopesConfig.available_scopes)) {
        setAvailableScopes(requiredScopesConfig.available_scopes)
      }
    }
  }, [requiredScopesConfig])

  // 打开配置Modal时加载数据
  const handleOpenConfigModal = () => {
    setConfigModalVisible(true)
    // 加载当前配置
    if (requiredScopesConfig) {
      setSelectedRequiredScopes(requiredScopesConfig.required_scopes || [])
      if (requiredScopesConfig.available_scopes && Array.isArray(requiredScopesConfig.available_scopes)) {
        setAvailableScopes(requiredScopesConfig.available_scopes)
      }
    }
  }

  // 填报状态表格列
  const statusColumns: ColumnsType<{ scope: string; status: string; first_submitted_at?: string; updated_at?: string }> = [
    {
      title: 'Scope',
      dataIndex: 'scope',
      key: 'scope',
      width: 150
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        if (status === 'submitted') {
          return <Tag color="success" bordered={false} style={{ borderRadius: '12px', padding: '0 10px' }}>已提交</Tag>
        }
        return <Tag color="warning" bordered={false} style={{ borderRadius: '12px', padding: '0 10px' }}>待提交</Tag>
      }
    },
    {
      title: '首次提交',
      dataIndex: 'first_submitted_at',
      key: 'first_submitted_at',
      width: 140,
      render: (time: string) => time ? dayjs(time).format('MM-DD HH:mm') : '-'
    },
    {
      title: '最近更新',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 140,
      render: (time: string) => time ? dayjs(time).format('MM-DD HH:mm') : '-'
    }
  ]

  // 填报记录表格列
  const submissionColumns: ColumnsType<DailyReportSubmission> = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 100,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: 'Scope',
      dataIndex: 'scope',
      key: 'scope',
      width: 120
    },
    {
      title: '首次提交',
      dataIndex: 'first_submitted_at',
      key: 'first_submitted_at',
      width: 140,
      render: (time: string) => time ? dayjs(time).format('MM-DD HH:mm') : '-'
    },
    {
      title: '最近更新',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 140,
      render: (time: string) => time ? dayjs(time).format('MM-DD HH:mm') : '-'
    },
    {
      title: '填报进度',
      key: 'progress',
      width: 120,
      render: (_, record) => (
        <span>{record.filled_activities} / {record.total_activities}</span>
      )
    },
    {
      title: reportType === 'MP' ? '总人力' : '总工程量',
      key: 'total',
      width: 120,
      align: 'right',
      render: (_: any, record: DailyReportSubmission) => {
        if (reportType === 'MP') {
          return <strong>{record.total_manpower || 0}</strong>
        } else {
          return <strong>{record.total_volume ? Number(record.total_volume).toFixed(2) : 0}</strong>
        }
      }
    }
  ]

  // 构建状态数据
  const statusData = useMemo(() => {
    if (!submissionStatus) return []
    const submitted = submissionStatus.submitted_scopes.map((scope: string) => {
      const sub = submissions.find((s: DailyReportSubmission) => s.scope === scope && s.date === selectedDate.format('YYYY-MM-DD'))
      return {
        scope,
        status: 'submitted',
        first_submitted_at: sub?.first_submitted_at,
        updated_at: sub?.updated_at
      }
    })
    const pending = submissionStatus.pending_scopes.map((scope: string) => ({
      scope,
      status: 'pending',
      first_submitted_at: null,
      updated_at: null
    }))
    return [...submitted, ...pending]
  }, [submissionStatus, submissions, selectedDate])

  return (
    <div style={{ 
      height: 'calc(100vh - 64px - 48px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: '#f8fafc', // 更淡雅的背景色
      margin: '-24px',
      padding: '20px'
    }}>
      {/* 顶部工具栏 - 更加简约 */}
      <div style={{ 
        marginBottom: 20, 
        padding: '0 4px',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <Space size="large">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#64748b', fontWeight: 500 }}>报告类型</span>
            <Select
              value={reportType}
              onChange={setReportType}
              style={{ width: 140 }}
              variant="filled"
            >
              <Option value="MP">人力日报 (MP)</Option>
              <Option value="VFACT">工程量日报 (VFACT)</Option>
            </Select>
          </div>

          {activeTab === 'status' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>查询日期</span>
              <DatePicker
                value={selectedDate}
                onChange={(date) => date && setSelectedDate(date)}
                format="YYYY-MM-DD"
                variant="filled"
                allowClear={false}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>日期范围</span>
              <DatePicker.RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
                format="YYYY-MM-DD"
                variant="filled"
              />
            </div>
          )}
        </Space>

        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['dailyReportStatus'] })
              queryClient.invalidateQueries({ queryKey: ['dailyReportSubmissions'] })
            }}
            type="text"
            style={{ color: '#64748b' }}
          >
            刷新
          </Button>

          <Button
            icon={<SettingOutlined />}
            onClick={handleOpenConfigModal}
            variant="outlined"
            color="primary"
          >
            设置必填Scope
          </Button>
        </Space>
      </div>

      {/* 统计卡片 - 现代化设计 */}
      {submissionStatus && activeTab === 'status' && (
        <Row gutter={20} style={{ marginBottom: 20 }}>
          <Col span={6}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Statistic
                title={<span style={{ color: '#64748b' }}>总Scope数</span>}
                value={submissionStatus.total_scopes}
                prefix={<CalendarOutlined style={{ color: '#94a3b8', marginRight: 8 }} />}
              />
            </div>
          </Col>
          <Col span={6}>
            <div style={{ background: '#ecfdf5', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Statistic
                title={<span style={{ color: '#059669' }}>已提交</span>}
                value={submissionStatus.submitted_count}
                valueStyle={{ color: '#059669' }}
                prefix={<CheckCircleOutlined style={{ marginRight: 8 }} />}
              />
            </div>
          </Col>
          <Col span={6}>
            <div style={{ background: '#fff1f2', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Statistic
                title={<span style={{ color: '#e11d48' }}>待提交</span>}
                value={submissionStatus.pending_count}
                valueStyle={{ color: '#e11d48' }}
                prefix={<ClockCircleOutlined style={{ marginRight: 8 }} />}
              />
            </div>
          </Col>
          <Col span={6}>
            <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Statistic
                title={<span style={{ color: '#2563eb' }}>提交率</span>}
                value={submissionStatus.total_scopes > 0 
                  ? ((submissionStatus.submitted_count / submissionStatus.total_scopes) * 100).toFixed(1)
                  : 0}
                suffix="%"
                valueStyle={{ 
                  color: '#2563eb'
                }}
              />
            </div>
          </Col>
        </Row>
      )}

      {/* 内容区域 - Tab样式优化 */}
      <div 
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          padding: '4px 16px 16px 16px'
        }}
      >
        <Tabs 
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          items={[
            {
              key: 'status',
              label: '填报状态',
              children: (
                <Table
                  columns={statusColumns}
                  dataSource={statusData}
                  loading={statusLoading}
                  rowKey="scope"
                  pagination={false}
                  size="small"
                  scroll={{ y: 'calc(100vh - 500px)' }}
                />
              )
            },
            {
              key: 'submissions',
              label: '填报记录',
              children: (
                <Table
                  columns={submissionColumns}
                  dataSource={submissions}
                  loading={submissionsLoading}
                  rowKey={(record) => `${record.date}-${record.scope}-${record.report_type}`}
                  expandable={{
                    expandedRowRender: (record) => {
                      if (record.report_type === 'MP') {
                        return (
                          <div style={{ padding: '8px 24px', background: '#fafafa' }}>
                            <Row gutter={24}>
                              <Col span={8}>
                                <Card size="small" title={<span><UserOutlined /> 人员构成</span>} bordered={false} styles={{ body: { background: '#f8fafc' } }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: '#64748b' }}>直接人力 (非CO):</span>
                                      <strong style={{ color: '#0f172a' }}>{record.details?.direct || 0}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: '#64748b' }}>辅助人力 (CO):</span>
                                      <strong style={{ color: '#0f172a' }}>{record.details?.support || 0}</strong>
                                    </div>
                                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ fontWeight: 600 }}>合计:</span>
                                      <strong style={{ color: '#2563eb' }}>{(record.details?.direct || 0) + (record.details?.support || 0)}</strong>
                                    </div>
                                  </div>
                                </Card>
                              </Col>
                              <Col span={16}>
                                <Card size="small" title={<span><SolutionOutlined /> MP额外项</span>} bordered={false} styles={{ body: { background: '#f8fafc' } }}>
                                  <Space wrap size={[16, 16]}>
                                    <Statistic 
                                      title="间接人力 (工作)" 
                                      value={record.details?.indirect_work || 0} 
                                      valueStyle={{ fontSize: 16, color: '#1e293b' }}
                                    />
                                    <Statistic 
                                      title="间接人力 (请假)" 
                                      value={record.details?.indirect_leave || 0} 
                                      valueStyle={{ fontSize: 16, color: '#f59e0b' }}
                                    />
                                    <Statistic 
                                      title="直接人力 (请假)" 
                                      value={record.details?.direct_leave || 0} 
                                      valueStyle={{ fontSize: 16, color: '#ef4444' }}
                                    />
                                  </Space>
                                </Card>
                              </Col>
                            </Row>
                          </div>
                        )
                      } else {
                        const workContent = record.details?.work_content || {}
                        const entries = Object.entries(workContent)
                        return (
                          <div style={{ padding: '8px 24px', background: '#f8fafc' }}>
                            <Card size="small" title={<span><InfoCircleOutlined /> 工程量完成明细 (kq=Y)</span>} bordered={false} styles={{ body: { background: '#f8fafc' } }}>
                              {entries.length > 0 ? (
                                <Row gutter={[16, 16]}>
                                  {entries.map(([name, val]) => (
                                    <Col key={name} span={6}>
                                      <Card size="small" style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <Statistic 
                                          title={<span style={{ fontSize: 12, color: '#64748b' }}>{name}</span>}
                                          value={Number(val)} 
                                          precision={2}
                                          valueStyle={{ fontSize: 16, color: '#0f172a' }}
                                        />
                                      </Card>
                                    </Col>
                                  ))}
                                </Row>
                              ) : (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>无明细数据</div>
                              )}
                            </Card>
                          </div>
                        )
                      }
                    },
                    defaultExpandAllRows: false
                  }}
                  pagination={{
                    pageSize: 50,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条记录`
                  }}
                  size="small"
                  scroll={{ y: 'calc(100vh - 500px)' }}
                />
              )
            }
          ]}
        />
      </div>

      {/* 必填Scope配置Modal */}
      <Modal
        title={`设置必填Scope - ${reportType === 'MP' ? '人力日报' : '工程量日报'}`}
        open={configModalVisible}
        onOk={async () => {
          try {
            await dailyReportFillService.setRequiredScopes(reportType, selectedRequiredScopes)
            messageApi.success('必填Scope配置已保存')
            setConfigModalVisible(false)
            // 刷新相关数据
            refetchRequiredScopes()
            queryClient.invalidateQueries({ queryKey: ['dailyReportStatus'] })
          } catch (error: any) {
            messageApi.error(error?.response?.data?.detail || '保存失败')
          }
        }}
        onCancel={() => {
          setConfigModalVisible(false)
        }}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8, color: '#666' }}>
            选择每天必须提交日报的分包单位（可多选）。未选中的分包单位将不会出现在待提交列表中。
          </p>
          {requiredScopesConfig && (
            <p style={{ marginBottom: 8, fontSize: 12, color: '#999' }}>
              当前已配置 {requiredScopesConfig.required_scopes.length} 个必填Scope，
              系统中共有 {requiredScopesConfig.total_available_scopes} 个Scope
            </p>
          )}
        </div>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="请选择必填的分包单位"
          value={selectedRequiredScopes}
          onChange={setSelectedRequiredScopes}
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={availableScopes.map(scope => ({
            label: scope,
            value: scope
          }))}
        />
        <div style={{ marginTop: 16, padding: '8px 12px', background: '#f0f2f5', borderRadius: 4 }}>
          <div style={{ fontSize: 12, color: '#666' }}>
            <strong>提示：</strong>
            <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
              <li>如果不选择任何Scope，系统将统计所有Scope（向后兼容）</li>
              <li>只有选中的Scope会出现在待提交列表中</li>
              <li>配置会立即生效，影响当天的填报状态统计</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default DailyReportStatusManagement

