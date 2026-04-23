import React, { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  BarcodeOutlined,
  EditOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SkinOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { plmService, type Material } from '../services/plmService'

const { Title, Text } = Typography

const CATEGORY_OPTIONS = [
  { label: '原材料', value: '原材料' },
  { label: '标准件', value: '标准件' },
  { label: '外购件', value: '外购件' },
  { label: '自制件', value: '自制件' },
]

const UNIT_OPTIONS = [
  { label: 'PCS (件)', value: 'PCS' },
  { label: 'KG (千克)', value: 'KG' },
  { label: 'M (米)', value: 'M' },
  { label: 'SET (套)', value: 'SET' },
]

const MATERIAL_TYPE_OPTIONS = [
  { label: 'PART', value: 'PART' },
  { label: 'RAW', value: 'RAW' },
  { label: 'STD', value: 'STD' },
  { label: 'SUB', value: 'SUB' },
  { label: 'FINISHED', value: 'FINISHED' },
]

const DEFAULT_FORM_VALUES: Partial<Material> = {
  unit: 'PCS',
  category: '原材料',
  material_type: 'PART',
  revision: 'A',
  safety_stock: 0,
  current_stock: 0,
  reserved_stock: 0,
  incoming_stock: 0,
  lead_time_days: 0,
}

const MaterialManagement: React.FC = () => {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [searchText, setSearchText] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [form] = Form.useForm()

  const { data: materials = [], isLoading, refetch } = useQuery({
    queryKey: ['materials'],
    queryFn: () => plmService.getMaterials(),
  })

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingMaterial(null)
    form.resetFields()
  }

  const invalidateMaterials = async () => {
    await queryClient.invalidateQueries({ queryKey: ['materials'] })
  }

  const createMaterialMutation = useMutation({
    mutationFn: (data: Partial<Material>) => plmService.createMaterial(data),
    onSuccess: async () => {
      message.success('物料创建成功')
      closeModal()
      await invalidateMaterials()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || error?.message || '创建失败')
    },
  })

  const updateMaterialMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Material> }) => plmService.updateMaterial(id, data),
    onSuccess: async () => {
      message.success('物料更新成功')
      closeModal()
      await invalidateMaterials()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || error?.message || '更新失败')
    },
  })

  const filteredMaterials = useMemo(() => {
    if (!searchText.trim()) {
      return materials
    }

    const lowered = searchText.trim().toLowerCase()
    return materials.filter(material =>
      [
        material.name,
        material.code,
        material.specification,
        material.description,
        material.drawing_no,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(lowered))
    )
  }, [materials, searchText])

  const openCreateModal = () => {
    setEditingMaterial(null)
    setIsModalOpen(true)
    form.resetFields()
    form.setFieldsValue(DEFAULT_FORM_VALUES)
  }

  const openEditModal = (material: Material) => {
    setEditingMaterial(material)
    setIsModalOpen(true)
    form.setFieldsValue({
      ...DEFAULT_FORM_VALUES,
      ...material,
      safety_stock: material.safety_stock ?? 0,
      current_stock: material.current_stock ?? 0,
      reserved_stock: material.reserved_stock ?? 0,
      incoming_stock: material.incoming_stock ?? 0,
      lead_time_days: material.lead_time_days ?? 0,
    })
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingMaterial) {
        updateMaterialMutation.mutate({
          id: editingMaterial.id,
          data: values,
        })
        return
      }

      createMaterialMutation.mutate(values)
    } catch {
      // Validation handled by antd.
    }
  }

  const columns = [
    {
      title: '物料编码',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => (
        <Space>
          <BarcodeOutlined style={{ color: '#1677ff' }} />
          <Text strong>{text}</Text>
        </Space>
      ),
      sorter: (a: Material, b: Material) => a.code.localeCompare(b.code),
    },
    {
      title: '物料名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '规格型号',
      dataIndex: 'specification',
      key: 'specification',
      render: (text: string) => text || '-',
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      render: (text: string) => (text ? <Tag color="blue">{text}</Tag> : '-'),
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      render: (text: string) => (text ? <Tag color="cyan">{text}</Tag> : '-'),
      filters: CATEGORY_OPTIONS.map(option => ({ text: option.label, value: option.value })),
      onFilter: (value: boolean | React.Key, record: Material) => record.category === value,
    },
    {
      title: '安全库存',
      dataIndex: 'safety_stock',
      key: 'safety_stock',
      render: (value: number) => value ?? 0,
    },
    {
      title: '现有 / 预留 / 在途',
      key: 'stock',
      render: (_: unknown, record: Material) =>
        `${record.current_stock ?? 0} / ${record.reserved_stock ?? 0} / ${record.incoming_stock ?? 0}`,
    },
    {
      title: '采购前置期',
      dataIndex: 'lead_time_days',
      key: 'lead_time_days',
      render: (value: number) => `${value ?? 0} 天`,
    },
    {
      title: '图号',
      dataIndex: 'drawing_no',
      key: 'drawing_no',
      render: (text: string) => text || '-',
    },
    {
      title: '版本',
      dataIndex: 'revision',
      key: 'revision',
      render: (text: string) => text || '-',
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: { showTitle: false },
      render: (text: string) => <Tooltip title={text}>{text || '-'}</Tooltip>,
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right' as const,
      render: (_: unknown, record: Material) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
          编辑
        </Button>
      ),
    },
  ]

  return (
    <div
      style={{
        padding: 24,
        background: 'linear-gradient(180deg, #f0f2f5 0%, #ffffff 100%)',
        minHeight: 'calc(100vh - 64px)',
      }}
    >
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        }}
        title={
          <Space size="middle">
            <div
              style={{
                background: '#e6f4ff',
                padding: 8,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <SkinOutlined style={{ fontSize: 24, color: '#1677ff' }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                物料主数据管理
              </Title>
              <Text type="secondary">
                维护物料编码、图纸版本、安全库存、在途库存与采购前置期，让 BOM 可以直接驱动 MRP、齐套分析与采购协同。
              </Text>
            </div>
          </Space>
        }
        extra={
          <Space size="middle">
            <Input
              allowClear
              placeholder="搜索物料名称 / 编码 / 规格 / 图号"
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchText}
              onChange={event => setSearchText(event.target.value)}
              style={{ width: 280, borderRadius: 8 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} style={{ borderRadius: 8 }}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} style={{ borderRadius: 8 }}>
              新增物料
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredMaterials}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1500 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: total => `共 ${total} 条物料数据`,
          }}
          locale={{
            emptyText: <Empty description="暂无物料数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
        />
      </Card>

      <Modal
        title={editingMaterial ? '编辑物料主数据' : '新增物料主数据'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={createMaterialMutation.isPending || updateMaterialMutation.isPending}
        okText={editingMaterial ? '保存更新' : '确认创建'}
        cancelText="取消"
        width={760}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 20 }}
          initialValues={DEFAULT_FORM_VALUES}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="code"
              label="物料编码"
              rules={[{ required: true, message: '请定义唯一的物料编码' }]}
            >
              <Input placeholder="例如 MT-2024001" />
            </Form.Item>
            <Form.Item
              name="name"
              label="物料名称"
              rules={[{ required: true, message: '请输入物料名称' }]}
            >
              <Input placeholder="例如 不锈钢板材 304" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="category" label="物料类别">
              <Select options={CATEGORY_OPTIONS} placeholder="请选择类别" />
            </Form.Item>
            <Form.Item name="unit" label="计量单位">
              <Select options={UNIT_OPTIONS} placeholder="请选择单位" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="specification" label="规格型号">
              <Input placeholder="例如 1200x2400x2mm" />
            </Form.Item>
            <Form.Item name="drawing_no" label="图号">
              <Input placeholder="例如 DWG-ASM-001" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="material_type" label="物料类型">
              <Select options={MATERIAL_TYPE_OPTIONS} placeholder="请选择物料类型" />
            </Form.Item>
            <Form.Item name="revision" label="版本">
              <Input placeholder="例如 A / B / C" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Form.Item name="current_stock" label="现有库存">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="reserved_stock" label="已预留库存">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="incoming_stock" label="在途库存">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="safety_stock" label="安全库存">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="lead_time_days" label="采购前置期（天）">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item name="description" label="业务说明">
            <Input.TextArea rows={3} placeholder="可填写用途、替代料、采购约束、关键工艺说明等" />
          </Form.Item>

          <Card size="small" style={{ backgroundColor: '#fffbe6' }} bordered={false}>
            <Space align="start">
              <InfoCircleOutlined style={{ color: '#faad14', marginTop: 3 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                建议同步维护安全库存、预留库存和采购前置期。这样 BOM 下推后，系统才能自动做缺料穿透、齐套预警和拉动式采购建议。
              </Text>
            </Space>
          </Card>
        </Form>
      </Modal>
    </div>
  )
}

export default MaterialManagement
