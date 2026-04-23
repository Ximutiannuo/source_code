import { logger } from '../utils/logger'
import { useState, useEffect } from 'react'
import { Card, Tabs, Table, Button, Space, Modal, Form, Input, Popconfirm, App, Row, Col, Tag, Statistic, Radio, DatePicker, Progress } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, DatabaseOutlined, FileTextOutlined, LinkOutlined, SyncOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { reportService } from '../services/reportService'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { TabPane } = Tabs

interface MarkaCode {
  id: number
  marka: string
  description?: string
}

interface NonStandardDrawing {
  id: number
  drawing_number: string
  joint_type_fs?: string
  activity_id?: string
  description?: string
}

interface ConstContractorMapping {
  id: number
  constcontractor: string
  scope: string
  description?: string
}

const WeldingDataManagement = () => {
  const { message: messageApi } = App.useApp()
  const [activeTab, setActiveTab] = useState('marka')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const [pagination, setPagination] = useState({ current: 1, pageSize: 1000 })
  const [syncModalVisible, setSyncModalVisible] = useState(false)
  const [syncMode, setSyncMode] = useState<'all' | 'single' | 'range'>('all')
  const [syncForm] = Form.useForm()
  const [unprocessedModalVisible, setUnprocessedModalVisible] = useState(false)
  const [unprocessedDrawings, setUnprocessedDrawings] = useState<any[]>([])
  
  // 获取统计数据（不自动刷新，只在需要时手动刷新）
  const { data: statistics, isLoading: statisticsLoading, refetch: refetchStatistics } = useQuery({
    queryKey: ['welding-statistics'],
    queryFn: async () => {
      try {
        const response = await api.get('/external-data/welding/statistics', {
          timeout: 10000 // 10秒超时
        })
        return response.data
      } catch (error: any) {
        logger.error('获取统计数据失败:', error)
        // 返回默认值，避免一直显示加载中
        return {
          welding_list_total: 0.0,
          welding_list_completed: 0.0,
          vfactdb_matched: 0.0,
          latest_sync: null
        }
      }
    },
    // 移除自动刷新，只在同步完成后手动刷新
    refetchInterval: false,
    retry: 1, // 只重试1次
    retryDelay: 2000, // 重试延迟2秒
  })
  
  // 获取最近的同步结果（不自动刷新，只在需要时手动刷新）
  const { data: latestSyncResult, refetch: refetchSyncResult } = useQuery({
    queryKey: ['welding-sync-latest'],
    queryFn: async () => {
      return await reportService.getLatestWeldingSyncResult()
    },
    // 移除自动刷新，只在同步进行中时通过checkSyncResult轮询
    refetchInterval: false,
  })
  
  // 检查同步结果的函数
  const checkSyncResult = async () => {
    try {
      // 刷新同步结果
      await refetchSyncResult()
      const result = await reportService.getLatestWeldingSyncResult()
      
      if (result.has_result && result.status === 'success') {
        // 同步完成后自动刷新统计数据
        refetchStatistics()
        
        if (result.unprocessed_count > 0) {
          setUnprocessedDrawings(result.unprocessed_drawings || [])
          setUnprocessedModalVisible(true)
          messageApi.warning({
            content: `同步完成，但有 ${result.unprocessed_count} 条图纸无法处理，请查看详情。`,
            duration: 10
          })
        } else {
          messageApi.success({
            content: `同步完成：删除 ${result.deleted_count} 条，插入 ${result.inserted_count} 条`,
            duration: 5
          })
        }
      } else if (result.has_result && result.status === 'running') {
        // 如果还在运行，继续轮询（3秒后再次检查）
        setTimeout(() => checkSyncResult(), 3000)
      } else if (result.has_result && result.status === 'failed') {
        messageApi.error({
          content: `同步失败：${result.message}`,
          duration: 10
        })
      }
    } catch (error: any) {
      logger.error('检查同步结果失败:', error)
    }
  }


  // Marka代码查询
  const { data: markaResponse, isLoading: markaLoading, refetch: refetchMarka } = useQuery({
    queryKey: ['welding-marka-codes', pagination.current, pagination.pageSize],
    queryFn: async () => {
      const response = await api.get(`/external-data/welding/marka-codes?skip=${(pagination.current - 1) * pagination.pageSize}&limit=${pagination.pageSize}`)
      return response.data
    },
    enabled: activeTab === 'marka', // 只在marka tab激活时查询
    refetchOnMount: 'always', // 每次Tab切换时都重新获取数据
  })
  const markaData = markaResponse?.items || []
  const markaTotal = markaResponse?.total || 0

  // 非标准图纸查询
  const { data: nonStandardResponse, isLoading: nonStandardLoading, refetch: refetchNonStandard } = useQuery({
    queryKey: ['welding-non-standard-drawings', pagination.current, pagination.pageSize],
    queryFn: async () => {
      const response = await api.get(`/external-data/welding/non-standard-drawings?skip=${(pagination.current - 1) * pagination.pageSize}&limit=${pagination.pageSize}`)
      return response.data
    },
    enabled: activeTab === 'drawing', // 只在drawing tab激活时查询
    refetchOnMount: 'always', // 每次Tab切换时都重新获取数据
  })
  const nonStandardData = nonStandardResponse?.items || []
  const nonStandardTotal = nonStandardResponse?.total || 0

  // ConstContractor映射查询
  const { data: mappingResponse, isLoading: mappingLoading, refetch: refetchMapping } = useQuery({
    queryKey: ['welding-constcontractor-mappings', pagination.current, pagination.pageSize],
    queryFn: async () => {
      const response = await api.get(`/external-data/welding/constcontractor-mappings?skip=${(pagination.current - 1) * pagination.pageSize}&limit=${pagination.pageSize}`)
      return response.data
    },
    enabled: activeTab === 'mapping', // 只在mapping tab激活时查询
    refetchOnMount: 'always', // 每次Tab切换时都重新获取数据
  })
  const mappingData = mappingResponse?.items || []
  const mappingTotal = mappingResponse?.total || 0

  // 当切换Tab时，自动刷新对应Tab的数据
  useEffect(() => {
    if (activeTab === 'marka') {
      refetchMarka()
    } else if (activeTab === 'drawing') {
      refetchNonStandard()
    } else if (activeTab === 'mapping') {
      refetchMapping()
    }
  }, [activeTab, refetchMarka, refetchNonStandard, refetchMapping])

  // 创建/更新Mutation
  const createOrUpdateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingItem) {
        return api.put(`/external-data/welding/${activeTab === 'marka' ? 'marka-codes' : activeTab === 'drawing' ? 'non-standard-drawings' : 'constcontractor-mappings'}/${editingItem.id}`, data)
      } else {
        return api.post(`/external-data/welding/${activeTab === 'marka' ? 'marka-codes' : activeTab === 'drawing' ? 'non-standard-drawings' : 'constcontractor-mappings'}`, data)
      }
    },
    onSuccess: () => {
      messageApi.success(editingItem ? '更新成功' : '创建成功')
      setModalVisible(false)
      setEditingItem(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: [`welding-${activeTab === 'marka' ? 'marka-codes' : activeTab === 'drawing' ? 'non-standard-drawings' : 'constcontractor-mappings'}`] })
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '操作失败')
    },
  })

  // 删除Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/external-data/welding/${activeTab === 'marka' ? 'marka-codes' : activeTab === 'drawing' ? 'non-standard-drawings' : 'constcontractor-mappings'}/${id}`)
    },
    onSuccess: () => {
      messageApi.success('删除成功')
      queryClient.invalidateQueries({ queryKey: [`welding-${activeTab === 'marka' ? 'marka-codes' : activeTab === 'drawing' ? 'non-standard-drawings' : 'constcontractor-mappings'}`] })
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '删除失败')
    },
  })

  const handleAdd = () => {
    setEditingItem(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record: any) => {
    setEditingItem(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id)
  }

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      createOrUpdateMutation.mutate(values)
    })
  }

  const getMarkaColumns = (): ColumnsType<MarkaCode> => [
    {
      title: <span style={{ fontSize: 12 }}>Marka代码</span>,
      dataIndex: 'marka',
      key: 'marka',
      width: 150,
      render: (text: string) => <span style={{ fontSize: 12 }}>{text}</span>,
    },
    {
      title: <span style={{ fontSize: 12 }}>描述</span>,
      dataIndex: 'description',
      key: 'description',
      width: 150,
      render: (text: string) => <span style={{ fontSize: 12 }}>{text || '-'}</span>,
    },
    {
      title: <span style={{ fontSize: 12 }}>操作</span>,
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: MarkaCode) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
            style={{ fontSize: 12, padding: '0 4px' }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
              style={{ fontSize: 12, padding: '0 4px' }}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const getDrawingColumns = (): ColumnsType<NonStandardDrawing> => [
    {
      title: <span style={{ fontSize: 12 }}>图纸编号</span>,
      dataIndex: 'drawing_number',
      key: 'drawing_number',
      width: 200,
      render: (text: string) => <span style={{ fontSize: 12 }}>{text}</span>,
    },
    {
      title: <span style={{ fontSize: 12 }}>JointTypeFS</span>,
      dataIndex: 'joint_type_fs',
      key: 'joint_type_fs',
      width: 100,
      render: (text: string) => (
        <Tag color={text === 'S' ? 'blue' : text === 'F' ? 'green' : 'default'} style={{ fontSize: 11 }}>
          {text || '-'}
        </Tag>
      ),
    },
    {
      title: <span style={{ fontSize: 12 }}>Activity ID</span>,
      dataIndex: 'activity_id',
      key: 'activity_id',
      width: 150,
      render: (text: string) => <span style={{ fontSize: 12 }}>{text || '-'}</span>,
    },
    {
      title: <span style={{ fontSize: 12 }}>描述</span>,
      dataIndex: 'description',
      key: 'description',
      width: 150,
      render: (text: string) => <span style={{ fontSize: 12 }}>{text || '-'}</span>,
    },
    {
      title: <span style={{ fontSize: 12 }}>操作</span>,
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: NonStandardDrawing) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
            style={{ fontSize: 12, padding: '0 4px' }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
              style={{ fontSize: 12, padding: '0 4px' }}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const getMappingColumns = (): ColumnsType<ConstContractorMapping> => [
    {
      title: <span style={{ fontSize: 12 }}>ConstContractor</span>,
      dataIndex: 'constcontractor',
      key: 'constcontractor',
      width: 150,
      render: (text: string) => <span style={{ fontSize: 12 }}>{text}</span>,
    },
    {
      title: <span style={{ fontSize: 12 }}>Scope</span>,
      dataIndex: 'scope',
      key: 'scope',
      width: 150,
      render: (text: string) => <Tag color="blue" style={{ fontSize: 11 }}>{text}</Tag>,
    },
    {
      title: <span style={{ fontSize: 12 }}>描述</span>,
      dataIndex: 'description',
      key: 'description',
      width: 150,
      render: (text: string) => <span style={{ fontSize: 12 }}>{text || '-'}</span>,
    },
    {
      title: <span style={{ fontSize: 12 }}>操作</span>,
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: ConstContractorMapping) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
            style={{ fontSize: 12, padding: '0 4px' }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
              style={{ fontSize: 12, padding: '0 4px' }}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // 统计数据（使用总数）
  const markaCount = markaTotal
  const drawingCount = nonStandardTotal
  const mappingCount = mappingTotal

  return (
    <div style={{ 
      padding: '16px', 
      background: '#f5f7fa',
      height: '100%',
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
          焊接数据管理
        </h1>
        <p style={{ 
          margin: 0, 
          fontSize: 11, 
          color: '#6b7280'
        }}>
          管理焊接数据同步、统计和配置信息
        </p>
      </div>

      {/* 可滚动内容区域 */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingRight: 4
      }}>
        {/* 第一行：同步结果和数据展报 */}
        <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
          {/* 同步结果卡片 */}
          <Col xs={24} md={12}>
            <Card
              title={
                <Space>
                  <SyncOutlined style={{ fontSize: 14 }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>同步结果</span>
                </Space>
              }
              size="small"
              extra={
                <Button
                  type="primary"
                  icon={<SyncOutlined />}
                  size="small"
                  onClick={() => setSyncModalVisible(true)}
                  style={{ fontSize: 12 }}
                >
                  启动同步
                </Button>
              }
              style={{ 
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
              headStyle={{ padding: '6px 10px', minHeight: 'auto' }}
              bodyStyle={{ flex: 1, padding: '8px', overflowY: 'auto' }}
            >
              {latestSyncResult && latestSyncResult.has_result ? (
                <div>
                  <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
                    <Col span={8}>
                      <div style={{ fontSize: 11, marginBottom: 4 }}>状态</div>
                      <Tag color={latestSyncResult.status === 'success' ? 'green' : latestSyncResult.status === 'failed' ? 'red' : 'blue'} style={{ fontSize: 11 }}>
                        {latestSyncResult.status === 'success' ? '成功' : latestSyncResult.status === 'failed' ? '失败' : '运行中'}
                      </Tag>
                    </Col>
                    <Col span={8}>
                      <div style={{ fontSize: 11, marginBottom: 4 }}>删除</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#ff4d4f' }}>{latestSyncResult.deleted_count} 条</div>
                    </Col>
                    <Col span={8}>
                      <div style={{ fontSize: 11, marginBottom: 4 }}>插入</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#52c41a' }}>{latestSyncResult.inserted_count} 条</div>
                    </Col>
                  </Row>
                  
                  {latestSyncResult.status === 'running' && latestSyncResult.progress !== undefined && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, marginBottom: 4 }}>进度: {latestSyncResult.progress}%</div>
                      <Progress percent={latestSyncResult.progress} size="small" status="active" strokeColor="#1890ff" />
                    </div>
                  )}
                  
                  {latestSyncResult.message && (
                    <div style={{ 
                      fontSize: 11, 
                      color: '#666', 
                      wordBreak: 'break-word',
                      marginBottom: 12,
                      padding: '8px',
                      background: '#f9fafb',
                      borderRadius: 4
                    }}>
                      {latestSyncResult.message}
                    </div>
                  )}
                  
                  {latestSyncResult.unprocessed_count > 0 && (
                    <div style={{ 
                      marginBottom: 12,
                      padding: '8px',
                      background: '#fff1f0',
                      borderRadius: 4,
                      border: '1px solid #ffccc7'
                    }}>
                      <div style={{ fontSize: 11, color: '#ff4d4f', marginBottom: 4, fontWeight: 600 }}>
                        无法处理: {latestSyncResult.unprocessed_count} 条
                      </div>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          setUnprocessedDrawings(latestSyncResult.unprocessed_drawings || [])
                          setUnprocessedModalVisible(true)
                        }}
                        style={{ fontSize: 11, padding: 0, height: 'auto' }}
                      >
                        查看详情
                      </Button>
                    </div>
                  )}
                  
                  {latestSyncResult.completed_at && (
                    <div style={{ fontSize: 10, color: '#999' }}>
                      完成时间: {dayjs(latestSyncResult.completed_at).format('YYYY-MM-DD HH:mm:ss')}
                    </div>
                  )}

                  {/* 无法匹配的图纸表格 */}
                  {latestSyncResult.unprocessed_count > 0 && latestSyncResult.unprocessed_drawings && latestSyncResult.unprocessed_drawings.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, marginBottom: 8, fontWeight: 600, color: '#ff4d4f' }}>
                        无法匹配的图纸 ({latestSyncResult.unprocessed_count} 条)
                      </div>
                      <Table
                        dataSource={latestSyncResult.unprocessed_drawings}
                        rowKey={(record: any, index) => `unprocessed-${record?.drawing_number || index}`}
                        columns={[
                          {
                            title: '图纸编号',
                            dataIndex: 'drawing_number',
                            key: 'drawing_number',
                            width: 300,
                            ellipsis: true,
                            render: (text: string) => (
                              <span style={{ fontSize: 11, fontFamily: 'monospace' }}>
                                {text || <span style={{ color: '#999' }}>未提供</span>}
                              </span>
                            )
                          },
                          {
                            title: '施工分包商',
                            dataIndex: 'constcontractor',
                            key: 'constcontractor',
                            width: 120,
                            render: (text: string) => (
                              text ? (
                                <Tag color="blue" style={{ fontSize: 10 }}>{text}</Tag>
                              ) : (
                                <span style={{ color: '#999', fontSize: 10 }}>未提供</span>
                              )
                            )
                          },
                          {
                            title: '原因',
                            dataIndex: 'reason',
                            key: 'reason',
                            ellipsis: true,
                            render: (text: string) => <span style={{ fontSize: 10, color: '#ff4d4f' }}>{text}</span>
                          }
                        ]}
                        pagination={{ 
                          total: latestSyncResult.unprocessed_drawings.length,
                          defaultPageSize: 10,
                          size: 'small',
                          showSizeChanger: true,
                          showTotal: (total) => `共 ${total} 条`,
                          pageSizeOptions: [10, 20, 50]
                        }}
                        size="small"
                        scroll={{ y: 200 }}
                        style={{ fontSize: 11 }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 20, fontSize: 12, color: '#999' }}>
                  暂无同步记录
                </div>
              )}
            </Card>
          </Col>

          {/* 数据展报卡片 */}
          <Col xs={24} md={12}>
            <Card
              title={
                <Space>
                  <DatabaseOutlined style={{ fontSize: 14 }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>数据展报</span>
                </Space>
              }
              size="small"
              style={{ 
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
              headStyle={{ padding: '6px 10px', minHeight: 'auto' }}
              bodyStyle={{ flex: 1, padding: '8px', overflowY: 'auto' }}
            >
              {statisticsLoading ? (
                <div style={{ textAlign: 'center', padding: 20 }}>加载中...</div>
              ) : statistics ? (
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Card size="small" style={{ background: '#f9f9f9' }}>
                    <Statistic
                      title={<span style={{ fontSize: 11 }}>诺德录入总量 (Size)</span>}
                      value={typeof statistics.welding_list_total === 'number' 
                        ? statistics.welding_list_total.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
                        : statistics.welding_list_total}
                      prefix={<DatabaseOutlined style={{ fontSize: 14 }} />}
                      valueStyle={{ fontSize: 18, fontWeight: 600 }}
                      suffix={<span style={{ fontSize: 12, color: '#999' }}>DIN</span>}
                    />
                    <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                      包含没有WeldDate的记录
                    </div>
                  </Card>
                  <Card size="small" style={{ background: '#f0f9ff' }}>
                    <Statistic
                      title={<span style={{ fontSize: 11 }}>完成量 (有日期的Size)</span>}
                      value={typeof statistics.welding_list_completed === 'number'
                        ? statistics.welding_list_completed.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
                        : statistics.welding_list_completed}
                      prefix={<FileTextOutlined style={{ fontSize: 14 }} />}
                      valueStyle={{ fontSize: 18, fontWeight: 600, color: '#1890ff' }}
                      suffix={<span style={{ fontSize: 12, color: '#999' }}>DIN</span>}
                    />
                    <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                      有WeldDate的Size总和
                    </div>
                  </Card>
                  <Card size="small" style={{ background: '#f6ffed' }}>
                    <Statistic
                      title={<span style={{ fontSize: 11 }}>VFACTDB匹配 (Achieved)</span>}
                      value={typeof statistics.vfactdb_matched === 'number'
                        ? statistics.vfactdb_matched.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
                        : statistics.vfactdb_matched}
                      prefix={<LinkOutlined style={{ fontSize: 14 }} />}
                      valueStyle={{ fontSize: 18, fontWeight: 600, color: '#52c41a' }}
                      suffix={<span style={{ fontSize: 12, color: '#999' }}>DIN</span>}
                    />
                    <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                      PI04/PI05在VFACTDB中的Achieved总和
                    </div>
                  </Card>
                  {statistics.latest_sync && (
                    <div style={{ 
                      fontSize: 11, 
                      color: '#666', 
                      marginTop: 8,
                      padding: '8px',
                      background: '#f9fafb',
                      borderRadius: 4
                    }}>
                      <div>最近同步: {statistics.latest_sync.inserted_count} 条插入</div>
                      {statistics.latest_sync.unprocessed_count > 0 && (
                        <div style={{ color: '#ff4d4f', marginTop: 4 }}>
                          {statistics.latest_sync.unprocessed_count} 条无法处理
                        </div>
                      )}
                    </div>
                  )}
                </Space>
              ) : (
                <div style={{ textAlign: 'center', padding: 20, fontSize: 12, color: '#999' }}>暂无数据</div>
              )}
            </Card>
          </Col>
        </Row>

        {/* 第二行：配置管理 */}
        <Row gutter={[8, 8]}>
          <Col xs={24}>
            <Card
              title={
                <Space>
                  <DatabaseOutlined style={{ fontSize: 14 }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>配置管理</span>
                </Space>
              }
              size="small"
              extra={
                <Space size="small">
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                    style={{ fontSize: 12 }}
                  >
                    新增
                  </Button>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      if (activeTab === 'marka') refetchMarka()
                      else if (activeTab === 'drawing') refetchNonStandard()
                      else refetchMapping()
                    }}
                    style={{ fontSize: 12 }}
                  >
                    刷新
                  </Button>
                </Space>
              }
              style={{ 
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column'
              }}
              headStyle={{ padding: '6px 10px', minHeight: 'auto' }}
              bodyStyle={{ padding: '8px' }}
            >
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                size="small"
                style={{ fontSize: 12 }}
              >
                <TabPane
                  tab={
                    <span style={{ fontSize: 12 }}>
                      <DatabaseOutlined /> Marka代码
                      {markaCount > 0 && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>{markaCount}</Tag>}
                    </span>
                  }
                  key="marka"
                >
                  <Table
                    columns={getMarkaColumns()}
                    dataSource={markaData}
                    loading={markaLoading}
                    rowKey="id"
                    size="small"
                    pagination={{
                      current: pagination.current,
                      pageSize: pagination.pageSize,
                      total: markaTotal,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 条`,
                      pageSizeOptions: ['20', '50', '100', '200', '500', '1000'],
                      onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
                    }}
                    scroll={{ y: 400 }}
                    style={{ fontSize: 12 }}
                  />
                </TabPane>
                <TabPane
                  tab={
                    <span style={{ fontSize: 12 }}>
                      <FileTextOutlined /> 非标准图纸
                      {drawingCount > 0 && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>{drawingCount}</Tag>}
                    </span>
                  }
                  key="drawing"
                >
                  <Table
                    columns={getDrawingColumns()}
                    dataSource={nonStandardData}
                    loading={nonStandardLoading}
                    rowKey="id"
                    size="small"
                    pagination={{
                      current: pagination.current,
                      pageSize: pagination.pageSize,
                      total: nonStandardTotal,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 条`,
                      pageSizeOptions: ['20', '50', '100', '200', '500', '1000'],
                      onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
                    }}
                    scroll={{ y: 400 }}
                    style={{ fontSize: 12 }}
                  />
                </TabPane>
                <TabPane
                  tab={
                    <span style={{ fontSize: 12 }}>
                      <LinkOutlined /> ConstContractor映射
                      {mappingCount > 0 && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>{mappingCount}</Tag>}
                    </span>
                  }
                  key="mapping"
                >
                  <Table
                    columns={getMappingColumns()}
                    dataSource={mappingData}
                    loading={mappingLoading}
                    rowKey="id"
                    size="small"
                    pagination={{
                      current: pagination.current,
                      pageSize: pagination.pageSize,
                      total: mappingTotal,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 条`,
                      pageSizeOptions: ['20', '50', '100', '200', '500', '1000'],
                      onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
                    }}
                    scroll={{ y: 400 }}
                    style={{ fontSize: 12 }}
                  />
                </TabPane>
              </Tabs>
            </Card>
          </Col>
        </Row>
      </div>

      <Modal
        title={<span style={{ fontSize: 14 }}>{editingItem ? '编辑' : '新增'}</span>}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false)
          setEditingItem(null)
          form.resetFields()
        }}
        confirmLoading={createOrUpdateMutation.isPending}
        width={500}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ fontSize: 12 }}>
          {activeTab === 'marka' && (
            <>
              <Form.Item
                name="marka"
                label={<span style={{ fontSize: 12 }}>Marka代码</span>}
                rules={[{ required: true, message: '请输入Marka代码' }]}
              >
                <Input size="small" style={{ fontSize: 12 }} />
              </Form.Item>
              <Form.Item name="description" label={<span style={{ fontSize: 12 }}>描述</span>}>
                <Input.TextArea rows={3} size="small" style={{ fontSize: 12 }} />
              </Form.Item>
            </>
          )}
          {activeTab === 'drawing' && (
            <>
              <Form.Item
                name="drawing_number"
                label={<span style={{ fontSize: 12 }}>图纸编号</span>}
                rules={[{ required: true, message: '请输入图纸编号' }]}
              >
                <Input size="small" style={{ fontSize: 12 }} />
              </Form.Item>
              <Form.Item
                name="joint_type_fs"
                label={<span style={{ fontSize: 12 }}>JointTypeFS (S=PI04, F=PI05)</span>}
              >
                <Input size="small" style={{ fontSize: 12 }} placeholder="S 或 F" />
              </Form.Item>
              <Form.Item
                name="activity_id"
                label={<span style={{ fontSize: 12 }}>Activity ID</span>}
              >
                <Input size="small" style={{ fontSize: 12 }} placeholder="对应的Activity ID" />
              </Form.Item>
              <Form.Item name="description" label={<span style={{ fontSize: 12 }}>描述</span>}>
                <Input.TextArea rows={3} size="small" style={{ fontSize: 12 }} />
              </Form.Item>
            </>
          )}
          {activeTab === 'mapping' && (
            <>
              <Form.Item
                name="constcontractor"
                label={<span style={{ fontSize: 12 }}>ConstContractor</span>}
                rules={[{ required: true, message: '请输入ConstContractor' }]}
              >
                <Input size="small" style={{ fontSize: 12 }} />
              </Form.Item>
              <Form.Item
                name="scope"
                label={<span style={{ fontSize: 12 }}>Scope</span>}
                rules={[{ required: true, message: '请输入Scope' }]}
              >
                <Input size="small" style={{ fontSize: 12 }} />
              </Form.Item>
              <Form.Item name="description" label={<span style={{ fontSize: 12 }}>描述</span>}>
                <Input.TextArea rows={3} size="small" style={{ fontSize: 12 }} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* 同步PI04/PI05数据Modal */}
      <Modal
        title={<span style={{ fontSize: 14 }}>同步PI04/PI05数据</span>}
        open={syncModalVisible}
        onOk={async () => {
          try {
            const values = await syncForm.validateFields()
            let options: any = {}
            
            if (syncMode === 'single') {
              options.targetDate = values.targetDate.format('YYYY-MM-DD')
            } else if (syncMode === 'range') {
              options.startDate = values.dateRange[0].format('YYYY-MM-DD')
              options.endDate = values.dateRange[1].format('YYYY-MM-DD')
            }
            // 全部时间段模式不需要传参数
            
            // 显示"正在同步数据"提示，2秒后自动关闭
            messageApi.info({
              content: '正在同步数据...',
              duration: 2
            })
            
            // 启动同步任务（后台异步执行）
            await reportService.syncWeldingPi04Pi05(options)
            
            // 关闭Modal
            setSyncModalVisible(false)
            syncForm.resetFields()
            setSyncMode('all')
            
            // 延迟2秒后显示完成弹窗，并开始轮询同步结果
            setTimeout(() => {
              Modal.success({
                title: '同步任务已启动',
                content: '诺德系统数据库同步任务已在后台启动，正在检查同步结果...',
                okText: '确定',
                onOk: () => {
                  // 开始轮询同步结果
                  checkSyncResult()
                }
              })
              // 自动开始轮询
              checkSyncResult()
            }, 2000)
            
          } catch (error: any) {
            if (error.errorFields) {
              // 表单验证错误
              return
            }
            messageApi.error({
              content: error.message || '启动同步任务失败',
              duration: 5
            })
          }
        }}
        onCancel={() => {
          setSyncModalVisible(false)
          syncForm.resetFields()
          setSyncMode('all')
        }}
        okText="确定"
        cancelText="取消"
        width={500}
      >
        <Form form={syncForm} layout="vertical" style={{ fontSize: 12 }}>
          <Form.Item label={<span style={{ fontSize: 12 }}>同步模式</span>}>
            <Radio.Group
              value={syncMode}
              onChange={(e) => {
                setSyncMode(e.target.value)
                syncForm.resetFields(['targetDate', 'dateRange'])
              }}
            >
              <Radio value="all">全部时间段（默认）</Radio>
              <Radio value="single">单天模式</Radio>
              <Radio value="range">日期范围模式</Radio>
            </Radio.Group>
          </Form.Item>
          
          {syncMode === 'single' && (
            <Form.Item
              name="targetDate"
              label={<span style={{ fontSize: 12 }}>目标日期</span>}
              rules={[{ required: true, message: '请选择日期' }]}
            >
              <DatePicker style={{ width: '100%' }} size="small" />
            </Form.Item>
          )}
          
          {syncMode === 'range' && (
            <Form.Item
              name="dateRange"
              label={<span style={{ fontSize: 12 }}>日期范围</span>}
              rules={[{ required: true, message: '请选择日期范围' }]}
            >
              <DatePicker.RangePicker style={{ width: '100%' }} size="small" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 无法处理的图纸Modal */}
      <Modal
        title={<span style={{ fontSize: 14 }}>无法处理的图纸列表</span>}
        open={unprocessedModalVisible}
        onCancel={() => setUnprocessedModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setUnprocessedModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <Table
            dataSource={unprocessedDrawings}
            rowKey={(record, index) => `modal-unprocessed-${record.drawing_number || index}`}
            columns={[
              {
                title: '图纸编号',
                dataIndex: 'drawing_number',
                key: 'drawing_number',
                width: 300,
                render: (text: string) => <span style={{ fontSize: 12 }}>{text}</span>
              },
              {
                title: 'ConstContractor',
                dataIndex: 'constcontractor',
                key: 'constcontractor',
                width: 150,
                render: (text: string) => <Tag color="blue" style={{ fontSize: 11 }}>{text}</Tag>
              },
              {
                title: '原因',
                dataIndex: 'reason',
                key: 'reason',
                ellipsis: true,
                render: (text: string) => <span style={{ fontSize: 12, color: '#ff4d4f' }}>{text}</span>
              }
            ]}
            pagination={{
              total: unprocessedDrawings.length,
              defaultPageSize: 50,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              pageSizeOptions: [10, 20, 50, 100]
            }}
            size="small"
            style={{ fontSize: 12 }}
          />
        </div>
      </Modal>
    </div>
  )
}

export default WeldingDataManagement

