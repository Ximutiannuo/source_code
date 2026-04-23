import React, { useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  message,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd'
import {
  CheckCircleOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  FileAddOutlined,
  PlusOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'

import {
  manufacturingOrderService,
  type ProcurementRequest,
  type ProcurementRequestUpdateBody,
  type ProcurementRequestItem,
  type ProcurementSuggestionItem,
  type ProcurementSuggestionSummary,
} from '../services/manufacturingOrderService'

const { Title, Text, Paragraph } = Typography

const URGENCY_COLORS: Record<string, string> = {
  URGENT: 'red',
  HIGH: 'orange',
  MEDIUM: 'blue',
  LOW: 'default',
}

const URGENCY_LABELS: Record<string, string> = {
  URGENT: '紧急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'default',
  SUBMITTED: 'processing',
  IN_PROGRESS: 'warning',
  ORDERED: 'cyan',
  RECEIVED: 'success',
  CANCELLED: 'error',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  IN_PROGRESS: '处理中',
  ORDERED: '已下单',
  RECEIVED: '已到货',
  CANCELLED: '已取消',
}

const READINESS_COLORS: Record<string, string> = {
  READY: 'success',
  RISK: 'warning',
  SHORT: 'error',
  MISSING: 'default',
}

const READINESS_LABELS: Record<string, string> = {
  READY: '齐套',
  RISK: '风险',
  SHORT: '缺料',
  MISSING: '主数据缺失',
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['ORDERED', 'CANCELLED'],
  ORDERED: ['RECEIVED', 'CANCELLED'],
}

const EMPTY_SUMMARY: ProcurementSuggestionSummary = {
  orders_considered: 0,
  orders_without_bom: 0,
  items_total: 0,
  urgent_items: 0,
  high_items: 0,
  to_purchase_items: 0,
  to_expedite_items: 0,
  master_data_gap_items: 0,
  replenish_items: 0,
  suggested_purchase_qty_total: 0,
  impacted_orders: 0,
  items: [],
}

const ProcurementManagement: React.FC = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'suggestions' | 'requests'>('suggestions')
  const [selectedRequest, setSelectedRequest] = useState<ProcurementRequest | null>(null)
  const [editingRequest, setEditingRequest] = useState<ProcurementRequest | null>(null)
  const [requestImportLoading, setRequestImportLoading] = useState(false)
  const [requestExportLoading, setRequestExportLoading] = useState(false)
  const [editRequestForm] = Form.useForm()

  const { data: suggestions = EMPTY_SUMMARY, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['procurement-suggestions'],
    queryFn: async () => {
      const res = await manufacturingOrderService.getProcurementSuggestions()
      return res.data
    },
  })

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['procurement-requests'],
    queryFn: async () => {
      const res = await manufacturingOrderService.listProcurementRequests()
      return res.data
    },
  })

  const generateMutation = useMutation({
    mutationFn: () =>
      manufacturingOrderService.generateProcurementRequest({ source_scope: 'GLOBAL' }),
    onSuccess: () => {
      message.success('请购草稿已生成')
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] })
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || '生成失败')
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      manufacturingOrderService.updateProcurementRequestStatus(id, { status }),
    onSuccess: () => {
      message.success('状态已更新')
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] })
      if (selectedRequest) {
        manufacturingOrderService
          .listProcurementRequests()
          .then(res => {
            const updated = res.data.find((r: ProcurementRequest) => r.id === selectedRequest.id)
            if (updated) setSelectedRequest(updated)
          })
      }
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || '更新失败')
    },
  })

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ProcurementRequestUpdateBody }) =>
      manufacturingOrderService.updateProcurementRequest(id, payload),
    onSuccess: response => {
      message.success('采购单已更新')
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] })
      setEditingRequest(null)
      editRequestForm.resetFields()
      if (selectedRequest?.id === response.data.id) {
        setSelectedRequest(response.data)
      }
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || '更新失败')
    },
  })

  const handleGenerate = () => {
    if (suggestions.items.length === 0) {
      message.info('当前没有可生成的采购建议')
      return
    }
    Modal.confirm({
      title: '生成请购草稿',
      content: `将根据当前 ${suggestions.items_total} 项采购建议生成请购草稿，确认继续？`,
      okText: '确认生成',
      cancelText: '取消',
      onOk: () => generateMutation.mutate(),
    })
  }

  const handleStatusChange = (id: number, status: string) => {
    statusMutation.mutate({ id, status })
  }

  const openEditRequestModal = (request: ProcurementRequest) => {
    setEditingRequest(request)
    editRequestForm.setFieldsValue({
      title: request.title,
      status: request.status,
      urgency_level: request.urgency_level,
      requester_name: request.requester_name || undefined,
      notes: request.notes || undefined,
    })
  }

  const handleUpdateRequest = async () => {
    if (!editingRequest) {
      return
    }
    try {
      const values = await editRequestForm.validateFields()
      updateRequestMutation.mutate({
        id: editingRequest.id,
        payload: values,
      })
    } catch {
      // Validation handled by antd form.
    }
  }

  const handleExportRequests = async () => {
    try {
      setRequestExportLoading(true)
      const response = await manufacturingOrderService.exportProcurementRequests()
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `procurement_requests_${new Date().toISOString().slice(0, 10)}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      message.success('采购单导出成功')
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '采购单导出失败')
    } finally {
      setRequestExportLoading(false)
    }
  }

  const handleImportRequests = async (file: File) => {
    try {
      setRequestImportLoading(true)
      const response = await manufacturingOrderService.importProcurementRequests(file)
      const result = response.data
      const createdCount = result.created?.length || 0
      const updatedCount = result.updated?.length || 0
      if (result.errors > 0) {
        Modal.warning({
          title: '导入完成（部分失败）',
          content: `新增 ${createdCount} 条，覆盖更新 ${updatedCount} 条，失败 ${result.errors} 条。\n${result.error_details.map((e: any) => `第 ${e.row} 行: ${e.error}`).join('\n')}`,
          width: 640,
        })
      } else {
        message.success(`采购单导入完成：新增 ${createdCount} 条，覆盖更新 ${updatedCount} 条`)
      }
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] })
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '采购单导入失败')
    } finally {
      setRequestImportLoading(false)
    }
    return false
  }

  const suggestionColumns: ColumnsType<ProcurementSuggestionItem> = [
    {
      title: '物料编码',
      dataIndex: 'material_code',
      width: 120,
      fixed: 'left',
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      width: 160,
      ellipsis: true,
    },
    {
      title: '紧急度',
      dataIndex: 'urgency_level',
      width: 80,
      render: (val: string) => (
        <Tag color={URGENCY_COLORS[val] || 'default'}>{URGENCY_LABELS[val] || val}</Tag>
      ),
      sorter: (a, b) => {
        const priority: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
        return (priority[a.urgency_level] ?? 9) - (priority[b.urgency_level] ?? 9)
      },
    },
    {
      title: '齐套状态',
      dataIndex: 'readiness_status',
      width: 100,
      render: (val: string) => (
        <Tag color={READINESS_COLORS[val] || 'default'}>{READINESS_LABELS[val] || val}</Tag>
      ),
    },
    {
      title: '建议动作',
      dataIndex: 'suggested_action',
      width: 100,
      render: (val: string) => {
        const color = val === '发起请购' ? 'red' : val === '催交在途' ? 'orange' : 'blue'
        return <Tag color={color}>{val}</Tag>
      },
    },
    {
      title: '缺口数量',
      dataIndex: 'shortage_qty',
      width: 100,
      align: 'right',
      render: (val: number) => (val > 0 ? <Text type="danger">{val}</Text> : val),
    },
    {
      title: '建议采购量',
      dataIndex: 'suggested_purchase_qty',
      width: 110,
      align: 'right',
      render: (val: number) => <Text strong>{val}</Text>,
    },
    {
      title: '现有库存',
      dataIndex: 'current_stock',
      width: 90,
      align: 'right',
    },
    {
      title: '在途库存',
      dataIndex: 'incoming_stock',
      width: 90,
      align: 'right',
    },
    {
      title: '前置期(天)',
      dataIndex: 'lead_time_days',
      width: 90,
      align: 'right',
    },
    {
      title: '采购模式',
      dataIndex: 'procurement_mode',
      width: 120,
      ellipsis: true,
    },
    {
      title: '受影响订单',
      dataIndex: 'impacted_order_count',
      width: 100,
      align: 'right',
      render: (val: number, record) => (
        <Tooltip title={record.impacted_orders?.join(', ') || '无'}>
          <Badge count={val} style={{ backgroundColor: val > 0 ? '#f5222d' : '#d9d9d9' }} />
        </Tooltip>
      ),
    },
    {
      title: '计划备注',
      dataIndex: 'planning_note',
      width: 200,
      ellipsis: true,
    },
  ]

  const requestColumns: ColumnsType<ProcurementRequest> = [
    {
      title: '请购单号',
      dataIndex: 'request_no',
      width: 160,
      fixed: 'left',
      render: (val: string, record) => (
        <Button type="link" onClick={() => setSelectedRequest(record)}>
          {val}
        </Button>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (val: string) => (
        <Tag color={STATUS_COLORS[val] || 'default'}>{STATUS_LABELS[val] || val}</Tag>
      ),
    },
    {
      title: '紧急度',
      dataIndex: 'urgency_level',
      width: 80,
      render: (val: string) => (
        <Tag color={URGENCY_COLORS[val] || 'default'}>{URGENCY_LABELS[val] || val}</Tag>
      ),
    },
    {
      title: '物料项数',
      dataIndex: 'total_items',
      width: 90,
      align: 'right',
    },
    {
      title: '建议采购总量',
      dataIndex: 'suggested_purchase_qty_total',
      width: 120,
      align: 'right',
      render: (val: number) => <Text strong>{val}</Text>,
    },
    {
      title: '来源',
      dataIndex: 'source_scope',
      width: 80,
      render: (val: string) => (val === 'ORDER' ? '按单' : '全局'),
    },
    {
      title: '关联订单',
      dataIndex: 'source_order_number',
      width: 120,
      ellipsis: true,
      render: (val: string | null) => val || '-',
    },
    {
      title: '申请人',
      dataIndex: 'requester_name',
      width: 100,
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '操作',
      width: 140,
      fixed: 'right',
      render: (_: any, record: ProcurementRequest) => {
        const transitions = STATUS_TRANSITIONS[record.status] || []
        if (transitions.length === 0) return <Text type="secondary">已终结</Text>
        return (
          <Space size={4}>
            <Button size="small" onClick={() => openEditRequestModal(record)}>
              编辑
            </Button>
            {transitions.map(nextStatus => (
              <Button
                key={nextStatus}
                size="small"
                type={nextStatus === 'CANCELLED' ? 'default' : 'primary'}
                danger={nextStatus === 'CANCELLED'}
                onClick={() => handleStatusChange(record.id, nextStatus)}
              >
                {STATUS_LABELS[nextStatus] || nextStatus}
              </Button>
            ))}
          </Space>
        )
      },
    },
  ]

  const requestItemColumns: ColumnsType<ProcurementRequestItem> = [
    { title: '物料编码', dataIndex: 'material_code', width: 120 },
    { title: '物料名称', dataIndex: 'material_name', width: 160, ellipsis: true },
    {
      title: '紧急度',
      dataIndex: 'urgency_level',
      width: 80,
      render: (val: string) => (
        <Tag color={URGENCY_COLORS[val || 'LOW']}>{URGENCY_LABELS[val || 'LOW'] || val}</Tag>
      ),
    },
    {
      title: '齐套状态',
      dataIndex: 'readiness_status',
      width: 90,
      render: (val: string) => (
        <Tag color={READINESS_COLORS[val || 'SHORT']}>{READINESS_LABELS[val || 'SHORT'] || val}</Tag>
      ),
    },
    { title: '请购数量', dataIndex: 'requested_qty', width: 90, align: 'right' as const },
    { title: '缺口数量', dataIndex: 'shortage_qty', width: 90, align: 'right' as const },
    { title: '现有库存', dataIndex: 'current_stock', width: 90, align: 'right' as const },
    { title: '在途库存', dataIndex: 'incoming_stock', width: 90, align: 'right' as const },
    { title: '前置期(天)', dataIndex: 'lead_time_days', width: 90, align: 'right' as const },
    { title: '采购模式', dataIndex: 'procurement_mode', width: 120, ellipsis: true },
  ]

  return (
    <div style={{ padding: 24, minHeight: 'calc(100vh - 64px)', background: 'linear-gradient(180deg, #f0f9ff 0%, #f8fafc 100%)' }}>
      {/* Header */}
      <Card
        bordered={false}
        style={{
          borderRadius: 20,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 42%, #0c4a6e 100%)',
          color: '#fff',
          marginBottom: 20,
          boxShadow: '0 16px 48px rgba(15, 23, 42, 0.2)',
        }}
        bodyStyle={{ padding: 28 }}
      >
        <Row align="middle" gutter={24}>
          <Col flex="auto">
            <Space direction="vertical" size={8}>
              <Tag color="cyan" style={{ borderRadius: 999, padding: '4px 12px' }}>
                SCM Supply Chain Management
              </Tag>
              <Title level={3} style={{ margin: 0, color: '#fff' }}>
                <ShoppingCartOutlined style={{ marginRight: 8 }} />
                采购管理中心
              </Title>
              <Paragraph style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>
                缺料分析 → 采购建议 → 请购草稿 → 采购跟踪 → 到货确认
              </Paragraph>
            </Space>
          </Col>
          <Col>
            <Row gutter={16}>
              <Col>
                <Card bordered={false} style={{ borderRadius: 14, background: 'rgba(255,255,255,0.1)', minWidth: 110 }}>
                  <Statistic
                    title={<span style={{ color: '#cbd5e1' }}>采购建议</span>}
                    value={suggestions.items_total}
                    suffix="项"
                    valueStyle={{ color: '#fff' }}
                  />
                </Card>
              </Col>
              <Col>
                <Card bordered={false} style={{ borderRadius: 14, background: 'rgba(255,255,255,0.1)', minWidth: 110 }}>
                  <Statistic
                    title={<span style={{ color: '#cbd5e1' }}>紧急项</span>}
                    value={suggestions.urgent_items}
                    suffix="项"
                    valueStyle={{ color: suggestions.urgent_items > 0 ? '#ef4444' : '#fff' }}
                  />
                </Card>
              </Col>
              <Col>
                <Card bordered={false} style={{ borderRadius: 14, background: 'rgba(255,255,255,0.1)', minWidth: 110 }}>
                  <Statistic
                    title={<span style={{ color: '#cbd5e1' }}>请购单</span>}
                    value={requests.length}
                    suffix="份"
                    valueStyle={{ color: '#fff' }}
                  />
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 16, height: '100%' }}>
            <Statistic
              title="待采购项"
              value={suggestions.to_purchase_items}
              prefix={<FileAddOutlined style={{ color: '#ef4444' }} />}
              valueStyle={{ color: '#ef4444' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 16, height: '100%' }}>
            <Statistic
              title="催交项"
              value={suggestions.to_expedite_items}
              prefix={<ExclamationCircleOutlined style={{ color: '#f59e0b' }} />}
              valueStyle={{ color: '#f59e0b' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 16, height: '100%' }}>
            <Statistic
              title="主数据缺失"
              value={suggestions.master_data_gap_items}
              prefix={<WarningOutlined style={{ color: '#8b5cf6' }} />}
              valueStyle={{ color: '#8b5cf6' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 16, height: '100%' }}>
            <Statistic
              title="受影响订单"
              value={suggestions.impacted_orders}
              prefix={<CheckCircleOutlined style={{ color: '#0ea5e9' }} />}
              valueStyle={{ color: '#0ea5e9' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tab Switch */}
      <Card
        bordered={false}
        style={{ borderRadius: 18 }}
        tabList={[
          { key: 'suggestions', tab: `采购建议 (${suggestions.items_total})` },
          { key: 'requests', tab: `请购单 (${requests.length})` },
        ]}
        activeTabKey={activeTab}
        onTabChange={key => setActiveTab(key as any)}
        tabBarExtraContent={
          activeTab === 'suggestions' ? (
            <Space>
              <Button icon={<DownloadOutlined />} loading={requestExportLoading} onClick={handleExportRequests}>
                导出 Excel
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => queryClient.invalidateQueries({ queryKey: ['procurement-suggestions'] })}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleGenerate}
                loading={generateMutation.isPending}
                disabled={suggestions.items.length === 0}
              >
                生成请购草稿
              </Button>
            </Space>
          ) : (
            <Button
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['procurement-requests'] })}
            >
              刷新
            </Button>
          )
        }
      >
        {activeTab === 'suggestions' && (
          <>
            {suggestions.orders_without_bom > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16, borderRadius: 12 }}
                message={`${suggestions.orders_without_bom} 个在制订单未关联 BOM，无法参与齐套分析`}
              />
            )}
            <Table
              columns={suggestionColumns}
              dataSource={suggestions.items}
              rowKey="material_code"
              loading={suggestionsLoading}
              scroll={{ x: 1600 }}
              size="small"
              pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `共 ${total} 项` }}
            />
          </>
        )}

        {activeTab === 'requests' && (
          <Space wrap style={{ marginBottom: 16 }}>
            <Button icon={<DownloadOutlined />} loading={requestExportLoading} onClick={handleExportRequests}>
              导出 Excel
            </Button>
            <Upload
              accept=".xlsx,.xls"
              showUploadList={false}
              beforeUpload={(file) => {
                handleImportRequests(file as File)
                return false
              }}
            >
              <Button icon={<UploadOutlined />} loading={requestImportLoading}>
                导入 Excel
              </Button>
            </Upload>
          </Space>
        )}

        {activeTab === 'requests' && (
          <Table
            columns={requestColumns}
            dataSource={requests}
            rowKey="id"
            loading={requestsLoading}
            scroll={{ x: 1500 }}
            size="small"
            pagination={{ pageSize: 15, showSizeChanger: true, showTotal: total => `共 ${total} 份` }}
          />
        )}
      </Card>

      {/* Request Detail Drawer */}
      <Drawer
        title={
          <Space>
            <ShoppingCartOutlined />
            <span>请购单详情</span>
            {selectedRequest && (
              <Tag color={STATUS_COLORS[selectedRequest.status]}>
                {STATUS_LABELS[selectedRequest.status] || selectedRequest.status}
              </Tag>
            )}
          </Space>
        }
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        width={900}
        extra={
          selectedRequest ? (
            <Space>
              <Button onClick={() => openEditRequestModal(selectedRequest)}>
                编辑采购单
              </Button>
              {(STATUS_TRANSITIONS[selectedRequest.status] || []).map(nextStatus => (
                <Button
                  key={nextStatus}
                  type={nextStatus === 'CANCELLED' ? 'default' : 'primary'}
                  danger={nextStatus === 'CANCELLED'}
                  onClick={() => handleStatusChange(selectedRequest.id, nextStatus)}
                  loading={statusMutation.isPending}
                >
                  {STATUS_LABELS[nextStatus] || nextStatus}
                </Button>
              ))}
            </Space>
          ) : null
        }
      >
        {selectedRequest && (
          <>
            <Descriptions
              bordered
              size="small"
              column={2}
              style={{ marginBottom: 20 }}
              labelStyle={{ background: '#f8fafc', fontWeight: 500 }}
            >
              <Descriptions.Item label="请购单号">{selectedRequest.request_no}</Descriptions.Item>
              <Descriptions.Item label="标题">{selectedRequest.title}</Descriptions.Item>
              <Descriptions.Item label="来源范围">
                {selectedRequest.source_scope === 'ORDER' ? '按单' : '全局'}
              </Descriptions.Item>
              <Descriptions.Item label="关联订单">
                {selectedRequest.source_order_number || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="紧急度">
                <Tag color={URGENCY_COLORS[selectedRequest.urgency_level]}>
                  {URGENCY_LABELS[selectedRequest.urgency_level] || selectedRequest.urgency_level}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="物料项数">{selectedRequest.total_items}</Descriptions.Item>
              <Descriptions.Item label="建议采购总量">
                {selectedRequest.suggested_purchase_qty_total}
              </Descriptions.Item>
              <Descriptions.Item label="申请人">{selectedRequest.requester_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {selectedRequest.created_at ? new Date(selectedRequest.created_at).toLocaleString('zh-CN') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {selectedRequest.submitted_at ? new Date(selectedRequest.submitted_at).toLocaleString('zh-CN') : '-'}
              </Descriptions.Item>
              {selectedRequest.notes && (
                <Descriptions.Item label="备注" span={2}>{selectedRequest.notes}</Descriptions.Item>
              )}
            </Descriptions>

            <Title level={5}>物料明细</Title>
            <Table
              columns={requestItemColumns}
              dataSource={selectedRequest.items}
              rowKey="id"
              scroll={{ x: 1200 }}
              size="small"
              pagination={false}
            />
          </>
        )}
      </Drawer>

      <Modal
        title="编辑采购单"
        open={!!editingRequest}
        zIndex={1600}
        onOk={handleUpdateRequest}
        onCancel={() => {
          setEditingRequest(null)
          editRequestForm.resetFields()
        }}
        okText="保存修改"
        cancelText="取消"
        confirmLoading={updateRequestMutation.isPending}
        width={640}
      >
        <Form form={editRequestForm} layout="vertical" style={{ marginTop: 20 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select
                  options={Object.keys(STATUS_LABELS).map(value => ({
                    value,
                    label: STATUS_LABELS[value] || value,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="urgency_level" label="紧急程度" rules={[{ required: true, message: '请选择紧急程度' }]}>
                <Select
                  options={Object.keys(URGENCY_LABELS).map(value => ({
                    value,
                    label: URGENCY_LABELS[value] || value,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="requester_name" label="申请人">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ProcurementManagement
