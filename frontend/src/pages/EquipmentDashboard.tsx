import React, { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  StopOutlined,
  ToolOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

import {
  equipmentService,
  type EquipmentCreate,
  type EquipmentDashboard as EquipmentDashboardData,
  type EquipmentItem,
  type MaintenanceCreate,
  type MaintenanceRecord,
} from '../services/qualityEquipmentService'

const { Title, Text, Paragraph } = Typography

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  ACTIVE: { color: 'success', label: '运行中', icon: <CheckCircleOutlined /> },
  MAINTENANCE: { color: 'warning', label: '保养中', icon: <ToolOutlined /> },
  OFFLINE: { color: 'error', label: '停机', icon: <StopOutlined /> },
}

const MAINT_TYPE_LABELS: Record<string, string> = {
  PLANNED: '计划保养',
  BREAKDOWN: '故障维修',
  INSPECTION: '点检',
}

const EMPTY_DASHBOARD: EquipmentDashboardData = {
  total: 0,
  active: 0,
  maintenance: 0,
  offline: 0,
  overdue_maintenance: 0,
  upcoming_maintenance_7d: 0,
  total_maintenance_records: 0,
  total_downtime_minutes: 0,
}

const EquipmentManagementPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [maintModalOpen, setMaintModalOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [maintForm] = Form.useForm()

  const { data: dashboard = EMPTY_DASHBOARD } = useQuery({
    queryKey: ['equipment-dashboard'],
    queryFn: async () => {
      const res = await equipmentService.getDashboard()
      return res.data
    },
  })

  const { data: equipments = [], isLoading } = useQuery({
    queryKey: ['equipment-list'],
    queryFn: async () => {
      const res = await equipmentService.list()
      return res.data
    },
  })

  const { data: maintenances = [] } = useQuery({
    queryKey: ['equipment-maintenances', selectedEquipment?.id],
    queryFn: async () => {
      if (!selectedEquipment) return []
      const res = await equipmentService.listMaintenances(selectedEquipment.id)
      return res.data
    },
    enabled: !!selectedEquipment,
  })

  const createMutation = useMutation({
    mutationFn: (body: EquipmentCreate) => equipmentService.create(body),
    onSuccess: () => {
      message.success('设备已创建')
      setCreateModalOpen(false)
      createForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['equipment-list'] })
      queryClient.invalidateQueries({ queryKey: ['equipment-dashboard'] })
    },
    onError: (err: any) => message.error(err?.response?.data?.detail || '创建失败'),
  })

  const maintMutation = useMutation({
    mutationFn: (body: MaintenanceCreate) => equipmentService.createMaintenance(body),
    onSuccess: () => {
      message.success('维保记录已创建')
      setMaintModalOpen(false)
      maintForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['equipment-maintenances'] })
      queryClient.invalidateQueries({ queryKey: ['equipment-list'] })
      queryClient.invalidateQueries({ queryKey: ['equipment-dashboard'] })
    },
    onError: (err: any) => message.error(err?.response?.data?.detail || '创建失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => equipmentService.delete(id),
    onSuccess: () => {
      message.success('设备已删除')
      setSelectedEquipment(null)
      queryClient.invalidateQueries({ queryKey: ['equipment-list'] })
      queryClient.invalidateQueries({ queryKey: ['equipment-dashboard'] })
    },
    onError: (err: any) => message.error(err?.response?.data?.detail || '删除失败'),
  })

  const handleCreate = () => {
    createForm.validateFields().then(values => {
      const body: EquipmentCreate = {
        ...values,
        purchase_date: values.purchase_date ? values.purchase_date.toISOString() : undefined,
      }
      createMutation.mutate(body)
    })
  }

  const handleCreateMaint = () => {
    if (!selectedEquipment) return
    maintForm.validateFields().then(values => {
      const body: MaintenanceCreate = {
        ...values,
        equipment_id: selectedEquipment.id,
        start_time: values.start_time ? values.start_time.toISOString() : undefined,
        end_time: values.end_time ? values.end_time.toISOString() : undefined,
      }
      maintMutation.mutate(body)
    })
  }

  const columns: ColumnsType<EquipmentItem> = [
    {
      title: '设备编码',
      dataIndex: 'code',
      width: 120,
      fixed: 'left',
      render: (val: string, record) => (
        <Button type="link" onClick={() => setSelectedEquipment(record)}>{val}</Button>
      ),
    },
    { title: '设备名称', dataIndex: 'name', width: 160, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (val: string) => {
        const cfg = STATUS_CONFIG[val] || { color: 'default', label: val, icon: null }
        return <Tag icon={cfg.icon} color={cfg.color}>{cfg.label}</Tag>
      },
    },
    { title: '型号', dataIndex: 'model_number', width: 120, ellipsis: true },
    { title: '工位', dataIndex: 'workstation', width: 100, ellipsis: true },
    { title: '部门', dataIndex: 'department', width: 100, ellipsis: true, render: (v: string | null) => v || '-' },
    { title: '位置', dataIndex: 'location', width: 120, ellipsis: true, render: (v: string | null) => v || '-' },
    {
      title: '保养周期',
      dataIndex: 'maintenance_cycle_days',
      width: 90,
      align: 'right',
      render: (val: number) => val > 0 ? `${val} 天` : '-',
    },
    {
      title: '上次保养',
      dataIndex: 'last_maintenance_date',
      width: 110,
      render: (val: string | null) => val ? dayjs(val).format('YYYY-MM-DD') : '-',
    },
    {
      title: '下次保养',
      dataIndex: 'next_maintenance_date',
      width: 110,
      render: (val: string | null) => {
        if (!val) return '-'
        const d = dayjs(val)
        const overdue = d.isBefore(dayjs())
        return (
          <Text type={overdue ? 'danger' : undefined}>
            {overdue && <WarningOutlined style={{ marginRight: 4 }} />}
            {d.format('YYYY-MM-DD')}
          </Text>
        )
      },
    },
  ]

  return (
    <div style={{ padding: 24, minHeight: 'calc(100vh - 64px)', background: 'linear-gradient(180deg, #faf5ff 0%, #f8fafc 100%)' }}>
      {/* Header */}
      <Card
        bordered={false}
        style={{
          borderRadius: 20,
          background: 'linear-gradient(135deg, #0f172a 0%, #3b0764 42%, #6b21a8 100%)',
          color: '#fff',
          marginBottom: 20,
          boxShadow: '0 16px 48px rgba(15, 23, 42, 0.2)',
        }}
        bodyStyle={{ padding: 28 }}
      >
        <Row align="middle" gutter={24}>
          <Col flex="auto">
            <Space direction="vertical" size={8}>
              <Tag color="purple" style={{ borderRadius: 999, padding: '4px 12px' }}>
                EAM Enterprise Asset Management
              </Tag>
              <Title level={3} style={{ margin: 0, color: '#fff' }}>
                <SettingOutlined style={{ marginRight: 8 }} />
                设备管理中心
              </Title>
              <Paragraph style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>
                设备台账 → 保养计划 → 故障维修 → OEE 跟踪 → 保养到期预警
              </Paragraph>
            </Space>
          </Col>
          <Col>
            <Row gutter={16}>
              <Col>
                <Card bordered={false} style={{ borderRadius: 14, background: 'rgba(255,255,255,0.1)', minWidth: 100 }}>
                  <Statistic title={<span style={{ color: '#cbd5e1' }}>设备总数</span>} value={dashboard.total} valueStyle={{ color: '#fff' }} />
                </Card>
              </Col>
              <Col>
                <Card bordered={false} style={{ borderRadius: 14, background: 'rgba(255,255,255,0.1)', minWidth: 100 }}>
                  <Statistic title={<span style={{ color: '#cbd5e1' }}>运行中</span>} value={dashboard.active} valueStyle={{ color: '#22c55e' }} />
                </Card>
              </Col>
              <Col>
                <Card bordered={false} style={{ borderRadius: 14, background: 'rgba(255,255,255,0.1)', minWidth: 100 }}>
                  <Statistic title={<span style={{ color: '#cbd5e1' }}>逾期保养</span>} value={dashboard.overdue_maintenance} valueStyle={{ color: dashboard.overdue_maintenance > 0 ? '#ef4444' : '#fff' }} />
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 16, height: '100%' }}>
            <Statistic title="保养中" value={dashboard.maintenance} prefix={<ToolOutlined style={{ color: '#f59e0b' }} />} suffix="台" />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 16, height: '100%' }}>
            <Statistic title="停机" value={dashboard.offline} prefix={<StopOutlined style={{ color: '#ef4444' }} />} suffix="台" />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 16, height: '100%' }}>
            <Statistic title="7天内到期保养" value={dashboard.upcoming_maintenance_7d} prefix={<ExclamationCircleOutlined style={{ color: '#f59e0b' }} />} suffix="台" />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 16, height: '100%' }}>
            <Statistic title="累计停机" value={dashboard.total_downtime_minutes} suffix="分钟" />
          </Card>
        </Col>
      </Row>

      {/* Equipment Table */}
      <Card
        bordered={false}
        style={{ borderRadius: 18 }}
        title="设备台账"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['equipment-list'] })}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>新增设备</Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={equipments}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1400 }}
          size="small"
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: total => `共 ${total} 台` }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="新增设备"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields() }}
        onOk={handleCreate}
        confirmLoading={createMutation.isPending}
        width={600}
      >
        <Form form={createForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="code" label="设备编码" rules={[{ required: true, message: '请输入编码' }]}>
                <Input placeholder="如 CNC-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="设备名称" rules={[{ required: true, message: '请输入名称' }]}>
                <Input placeholder="如 数控车床" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="model_number" label="型号">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="workstation" label="工位">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label="所属部门">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="location" label="安装位置">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" initialValue="ACTIVE">
                <Select options={[
                  { value: 'ACTIVE', label: '运行中' },
                  { value: 'MAINTENANCE', label: '保养中' },
                  { value: 'OFFLINE', label: '停机' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maintenance_cycle_days" label="保养周期(天)" initialValue={0}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="purchase_date" label="采购日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={1} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Equipment Detail Drawer */}
      <Drawer
        title={
          <Space>
            <SettingOutlined />
            <span>设备详情</span>
            {selectedEquipment && (
              <Tag color={STATUS_CONFIG[selectedEquipment.status]?.color || 'default'}>
                {STATUS_CONFIG[selectedEquipment.status]?.label || selectedEquipment.status}
              </Tag>
            )}
          </Space>
        }
        open={!!selectedEquipment}
        onClose={() => setSelectedEquipment(null)}
        width={800}
        extra={
          selectedEquipment && (
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { maintForm.resetFields(); setMaintModalOpen(true) }}>
                新增维保
              </Button>
              <Button
                danger
                onClick={() => Modal.confirm({
                  title: '删除设备',
                  content: `确认删除 ${selectedEquipment.code}？`,
                  onOk: () => deleteMutation.mutate(selectedEquipment.id),
                })}
              >
                删除
              </Button>
            </Space>
          )
        }
      >
        {selectedEquipment && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }} labelStyle={{ background: '#f8fafc', fontWeight: 500 }}>
              <Descriptions.Item label="设备编码">{selectedEquipment.code}</Descriptions.Item>
              <Descriptions.Item label="设备名称">{selectedEquipment.name}</Descriptions.Item>
              <Descriptions.Item label="型号">{selectedEquipment.model_number || '-'}</Descriptions.Item>
              <Descriptions.Item label="工位">{selectedEquipment.workstation || '-'}</Descriptions.Item>
              <Descriptions.Item label="部门">{selectedEquipment.department || '-'}</Descriptions.Item>
              <Descriptions.Item label="位置">{selectedEquipment.location || '-'}</Descriptions.Item>
              <Descriptions.Item label="保养周期">{selectedEquipment.maintenance_cycle_days > 0 ? `${selectedEquipment.maintenance_cycle_days} 天` : '-'}</Descriptions.Item>
              <Descriptions.Item label="上次保养">{selectedEquipment.last_maintenance_date ? dayjs(selectedEquipment.last_maintenance_date).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
              <Descriptions.Item label="下次保养">{selectedEquipment.next_maintenance_date ? dayjs(selectedEquipment.next_maintenance_date).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
              <Descriptions.Item label="采购日期">{selectedEquipment.purchase_date ? dayjs(selectedEquipment.purchase_date).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
              {selectedEquipment.description && (
                <Descriptions.Item label="描述" span={2}>{selectedEquipment.description}</Descriptions.Item>
              )}
            </Descriptions>

            <Title level={5}>维保记录</Title>
            {maintenances.length > 0 ? (
              <Timeline
                items={maintenances.map((m: MaintenanceRecord) => ({
                  color: m.maintenance_type === 'BREAKDOWN' ? 'red' : m.maintenance_type === 'PLANNED' ? 'blue' : 'green',
                  children: (
                    <Card size="small" style={{ borderRadius: 12, background: '#f8fafc' }} bodyStyle={{ padding: 12 }}>
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Space>
                          <Tag color={m.maintenance_type === 'BREAKDOWN' ? 'red' : 'blue'}>
                            {MAINT_TYPE_LABELS[m.maintenance_type] || m.maintenance_type}
                          </Tag>
                          <Text type="secondary">
                            {m.created_at ? dayjs(m.created_at).format('YYYY-MM-DD HH:mm') : '-'}
                          </Text>
                          {m.downtime_minutes > 0 && <Badge count={`停机 ${m.downtime_minutes} min`} style={{ backgroundColor: '#f59e0b' }} />}
                        </Space>
                        {m.description && <Text>{m.description}</Text>}
                        {m.operator_name && <Text type="secondary">执行人: {m.operator_name}</Text>}
                      </Space>
                    </Card>
                  ),
                }))}
              />
            ) : (
              <div style={{ padding: 20, textAlign: 'center' }}>
                <Text type="secondary">暂无维保记录</Text>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* Maintenance Create Modal */}
      <Modal
        title="新增维保记录"
        open={maintModalOpen}
        onCancel={() => { setMaintModalOpen(false); maintForm.resetFields() }}
        onOk={handleCreateMaint}
        confirmLoading={maintMutation.isPending}
        width={500}
      >
        <Form form={maintForm} layout="vertical">
          <Form.Item name="maintenance_type" label="维保类型" initialValue="PLANNED">
            <Select options={[
              { value: 'PLANNED', label: '计划保养' },
              { value: 'BREAKDOWN', label: '故障维修' },
              { value: 'INSPECTION', label: '点检' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="operator_name" label="执行人">
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="start_time" label="开始时间">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_time" label="结束时间">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="downtime_minutes" label="停机时长(分钟)" initialValue={0}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" initialValue="COMPLETED">
                <Select options={[
                  { value: 'PLANNED', label: '待执行' },
                  { value: 'IN_PROGRESS', label: '执行中' },
                  { value: 'COMPLETED', label: '已完成' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={1} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default EquipmentManagementPage
