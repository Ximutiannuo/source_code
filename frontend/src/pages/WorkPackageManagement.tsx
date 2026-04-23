import { useEffect, useRef, useState } from 'react'
import {
  Table,
  Input,
  Button,
  Space,
  App,
  Tag,
  Pagination,
  Modal,
  Form,
  InputNumber,
} from 'antd'
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  rscService,
  type RSCDefine,
  type RSCDefineCreate,
} from '../services/rscService'
import { useAuth } from '../contexts/AuthContext'
import { permissionService } from '../services/permissionService'
import type { ColumnsType } from 'antd/es/table'

const { TextArea } = Input

const WorkPackageManagement = () => {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: userPermissions } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: () => permissionService.getUserPermissions(user!.id),
    enabled: !!user?.id,
    retry: false,
  })
  const canEdit = !!user?.is_superuser || (userPermissions?.permissions?.some(
    p => p.resource_type === 'system' && p.action === 'admin'
  ))
  const [filters, setFilters] = useState({
    work_package: '',
    resource_id: '',
  })
  const [pagination, setPagination] = useState({ current: 1, pageSize: 100 })
  const tableAreaRef = useRef<HTMLDivElement | null>(null)
  const paginationBarRef = useRef<HTMLDivElement | null>(null)
  const [bodyHeight, setBodyHeight] = useState<number>(360)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState<RSCDefine | null>(null)
  const [form] = Form.useForm<RSCDefineCreate>()

  // 获取工作包资源定义列表
  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ['rsc-defines', filters, pagination.current, pagination.pageSize],
    queryFn: async () => {
      const result = await rscService.getRSCDefinesWithPagination({
        work_package: filters.work_package || undefined,
        resource_id: filters.resource_id || undefined,
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize,
      })
      return result
    },
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: (data: RSCDefineCreate) => rscService.createRSCDefine(data),
    onSuccess: () => {
      message.success('新增成功')
      setModalVisible(false)
      form.resetFields()
      setEditingRecord(null)
      queryClient.invalidateQueries({ queryKey: ['rsc-defines'] })
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || '新增失败')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: RSCDefineCreate }) =>
      rscService.updateRSCDefine(id, data),
    onSuccess: () => {
      message.success('修改成功')
      setModalVisible(false)
      form.resetFields()
      setEditingRecord(null)
      queryClient.invalidateQueries({ queryKey: ['rsc-defines'] })
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || '修改失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => rscService.deleteRSCDefine(id),
    onSuccess: () => {
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['rsc-defines'] })
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || '删除失败')
    },
  })

  // 当筛选条件变化时，重置到第一页
  useEffect(() => {
    if (filters.work_package || filters.resource_id) {
      setPagination(prev => ({ ...prev, current: 1 }))
    }
  }, [filters.work_package, filters.resource_id])

  useEffect(() => {
    if (error) {
      message.error('加载数据失败，请稍后重试')
    }
  }, [error, message])

  const openCreate = () => {
    setEditingRecord(null)
    form.resetFields()
    setModalVisible(true)
  }

  const openEdit = (record: RSCDefine) => {
    setEditingRecord(record)
    form.setFieldsValue({
      work_package: record.work_package,
      wpkg_description: record.wpkg_description ?? undefined,
      resource_id: record.resource_id ?? undefined,
      resource_id_name: record.resource_id_name ?? undefined,
      uom: record.uom ?? undefined,
      norms: record.norms ?? undefined,
      norms_mp: record.norms_mp ?? undefined,
      norms_mp_20251103: record.norms_mp_20251103 ?? undefined,
      bcc_kq_code: record.bcc_kq_code ?? undefined,
      kq: record.kq ?? undefined,
      cn_wk_report: record.cn_wk_report ?? undefined,
      rfi_a: record.rfi_a ?? undefined,
      rfi_b: record.rfi_b ?? undefined,
      rfi_c: record.rfi_c ?? undefined,
      remarks: record.remarks ?? undefined,
    })
    setModalVisible(true)
  }

  const handleSubmit = () => {
    form.validateFields().then(values => {
      const submit = () => {
        if (editingRecord) {
          updateMutation.mutate({ id: editingRecord.id, data: values })
        } else {
          createMutation.mutate(values)
        }
      }
      if (editingRecord) {
        modal.confirm({
          title: '确认修改',
          content: '确定要保存对当前工作包定义的修改吗？',
          okText: '确定',
          cancelText: '取消',
          onOk: submit,
        })
      } else {
        modal.confirm({
          title: '确认新增',
          content: '确定要新增该工作包定义吗？',
          okText: '确定',
          cancelText: '取消',
          onOk: submit,
        })
      }
    }).catch(() => {})
  }

  const handleDelete = (record: RSCDefine) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除工作包「${record.work_package}」的该条定义吗？删除后不可恢复。`,
      okText: '确定删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => deleteMutation.mutate(record.id),
    })
  }

  const columns: ColumnsType<RSCDefine> = [
    ...(canEdit
      ? [{
          title: '操作',
          key: 'actions',
          width: 120,
          fixed: 'left' as const,
          render: (_: unknown, record: RSCDefine) => (
            <Space size="small">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              >
                编辑
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
              >
                删除
              </Button>
            </Space>
          ),
        }]
      : []),
    {
      title: '工作包',
      dataIndex: 'work_package',
      key: 'work_package',
      width: 150,
      fixed: 'left',
    },
    {
      title: '工作包描述',
      dataIndex: 'wpkg_description',
      key: 'wpkg_description',
      width: 200,
      ellipsis: true,
    },
    {
      title: '资源ID',
      dataIndex: 'resource_id',
      key: 'resource_id',
      width: 150,
    },
    {
      title: '资源ID名称',
      dataIndex: 'resource_id_name',
      key: 'resource_id_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '单位',
      dataIndex: 'uom',
      key: 'uom',
      width: 100,
    },
    {
      title: 'BCC.KQ.CODE',
      dataIndex: 'bcc_kq_code',
      key: 'bcc_kq_code',
      width: 150,
    },
    {
      title: 'KQ',
      dataIndex: 'kq',
      key: 'kq',
      width: 80,
      render: (value: string | null) => (
        <Tag color={value === 'Y' ? 'green' : 'default'}>{value || '-'}</Tag>
      ),
    },
    {
      title: 'CN_WK Report',
      dataIndex: 'cn_wk_report',
      key: 'cn_wk_report',
      width: 150,
    },
    {
      title: 'RFI (A)',
      dataIndex: 'rfi_a',
      key: 'rfi_a',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'RFI (B)',
      dataIndex: 'rfi_b',
      key: 'rfi_b',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'RFI (C)',
      dataIndex: 'rfi_c',
      key: 'rfi_c',
      width: 200,
      ellipsis: true,
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 200,
      ellipsis: true,
    },
  ]

  useEffect(() => {
    const el = tableAreaRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      const footerH = paginationBarRef.current?.getBoundingClientRect().height ?? 56
      const headerH =
        (el.querySelector('.work-package-table .ant-table-header') as HTMLElement | null)?.getBoundingClientRect().height ??
        0
      const next = Math.max(160, Math.floor(h - footerH - headerH - 16))
      setBodyHeight(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const formItemLayout = { labelCol: { span: 8 }, wrapperCol: { span: 16 } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        .work-package-table .ant-table-body { overflow-x: auto !important; overflow-y: auto !important; }
        .work-package-table .ant-table-content { overflow-x: auto !important; }
        .work-package-table .ant-table-container { overflow: hidden; }
      `}</style>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>工作包管理</h2>
          {data && (
            <Tag color="blue" style={{ margin: 0 }}>总计: {data.total} 条记录</Tag>
          )}
        </div>
        <Space size="small">
          {canEdit && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate}>
              新增
            </Button>
          )}
          <Input.Search
            placeholder="工作包"
            allowClear
            size="small"
            style={{ width: 180 }}
            value={filters.work_package}
            onChange={(e) => setFilters({ ...filters, work_package: e.target.value })}
            onSearch={() => {
              setPagination({ ...pagination, current: 1 })
              refetch()
            }}
            enterButton
          />
          <Input.Search
            placeholder="资源ID"
            allowClear
            size="small"
            style={{ width: 180 }}
            value={filters.resource_id}
            onChange={(e) => setFilters({ ...filters, resource_id: e.target.value })}
            onSearch={() => {
              setPagination({ ...pagination, current: 1 })
              refetch()
            }}
            enterButton
          />
          <Button
            size="small"
            onClick={() => {
              setFilters({ work_package: '', resource_id: '' })
              setPagination({ ...pagination, current: 1 })
            }}
          >
            清除筛选
          </Button>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
          >
            刷新
          </Button>
        </Space>
      </div>

      <div
        ref={tableAreaRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#ffffff',
          borderRadius: '4px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <Table
            className="work-package-table"
            columns={columns}
            dataSource={data?.items || []}
            loading={isLoading}
            rowKey="id"
            size="small"
            scroll={{
              x: 'max-content',
              y: bodyHeight,
            }}
            pagination={false}
            locale={{
              emptyText: isLoading ? '加载中...' : '暂无数据',
            }}
          />
        </div>

        <div
          ref={paginationBarRef}
          style={{
            flexShrink: 0,
            padding: '8px 12px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Pagination
            size="small"
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={data?.total || 0}
            showSizeChanger
            showTotal={(total) => `共 ${total} 条记录`}
            onChange={(page, pageSize) => setPagination({ current: page, pageSize: pageSize || pagination.pageSize })}
          />
        </div>
      </div>

      <Modal
        title={editingRecord ? '编辑工作包定义' : '新增工作包定义'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingRecord(null)
          form.resetFields()
        }}
        onOk={handleSubmit}
        okText={editingRecord ? '保存' : '新增'}
        cancelText="取消"
        width={640}
        destroyOnClose
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} {...formItemLayout} style={{ marginTop: 16 }}>
          <Form.Item
            name="work_package"
            label="工作包"
            rules={[{ required: true, message: '请输入工作包' }]}
          >
            <Input placeholder="如 CI01" disabled={!!editingRecord} />
          </Form.Item>
          <Form.Item name="wpkg_description" label="工作包描述">
            <Input placeholder="工作包描述" />
          </Form.Item>
          <Form.Item name="resource_id" label="资源ID">
            <Input placeholder="资源ID" />
          </Form.Item>
          <Form.Item name="resource_id_name" label="资源ID名称">
            <Input placeholder="资源ID名称" />
          </Form.Item>
          <Form.Item name="uom" label="单位">
            <Input placeholder="如 m、t" />
          </Form.Item>
          <Form.Item name="norms" label="norms">
            <InputNumber style={{ width: '100%' }} placeholder="标准" />
          </Form.Item>
          <Form.Item name="norms_mp" label="norms_mp">
            <InputNumber style={{ width: '100%' }} placeholder="标准人力" />
          </Form.Item>
          <Form.Item name="norms_mp_20251103" label="norms_mp_20251103">
            <InputNumber style={{ width: '100%' }} placeholder="标准人力(20251103)" />
          </Form.Item>
          <Form.Item name="bcc_kq_code" label="BCC.KQ.CODE">
            <Input placeholder="BCC.KQ.CODE" />
          </Form.Item>
          <Form.Item name="kq" label="KQ">
            <Input placeholder="Y/N" />
          </Form.Item>
          <Form.Item name="cn_wk_report" label="CN_WK Report">
            <Input placeholder="CN_WK Report" />
          </Form.Item>
          <Form.Item name="rfi_a" label="RFI (A)">
            <TextArea rows={2} placeholder="RFI A" />
          </Form.Item>
          <Form.Item name="rfi_b" label="RFI (B)">
            <TextArea rows={2} placeholder="RFI B" />
          </Form.Item>
          <Form.Item name="rfi_c" label="RFI (C)">
            <TextArea rows={2} placeholder="RFI C" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default WorkPackageManagement
