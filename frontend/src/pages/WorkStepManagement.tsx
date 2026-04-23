import { useState, useMemo } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  InputNumber,
  Switch,
  Tag,
  message,
  Row,
  Col,
  Divider,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workstepService, type WorkStepDefine } from '../services/workstepService'
import { rscService } from '../services/rscService'

const { Option } = Select

const WorkStepManagement = () => {
  const [searchText, setSearchText] = useState('')
  const [workPackageFilter, setWorkPackageFilter] = useState<string | undefined>()
  const [isKeyQuantityFilter, setIsKeyQuantityFilter] = useState<boolean | undefined>()
  const [batchModalVisible, setBatchModalVisible] = useState(false)
  const [currentWorkPackage, setCurrentWorkPackage] = useState<string | null>(null)
  const [batchForm] = Form.useForm()
  const queryClient = useQueryClient()

  // 获取工作步骤列表
  const { data: worksteps, isLoading, refetch } = useQuery({
    queryKey: ['worksteps', workPackageFilter, isKeyQuantityFilter],
    queryFn: () => workstepService.getWorkStepDefines({
      work_package: workPackageFilter,
      is_key_quantity: isKeyQuantityFilter,
      is_active: true,
    }),
  })

  // 获取工作包列表（用于筛选）
  const { data: workPackages } = useQuery({
    queryKey: ['workPackages'],
    queryFn: () => rscService.getRSCDefines({ limit: 1000 }),
  })

  const uniqueWorkPackages = Array.from(
    new Set((workPackages || []).map((item: any) => item.work_package).filter(Boolean))
  ).sort() as string[]

  // 批量更新工作步骤
  const batchMutation = useMutation({
    mutationFn: ({ workPackage, items }: { workPackage: string, items: any[] }) => {
      return workstepService.batchUpdateWorkSteps(workPackage, items)
    },
    onSuccess: () => {
      message.success('保存成功')
      setBatchModalVisible(false)
      setCurrentWorkPackage(null)
      queryClient.invalidateQueries({ queryKey: ['worksteps'] })
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || '保存失败')
    },
  })

  // 过滤数据
  const filteredData = (worksteps || []).filter((item: WorkStepDefine) => {
    const matchesSearch = !searchText ||
      (item.work_package || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (item.work_step_description || '').toLowerCase().includes(searchText.toLowerCase())
    return matchesSearch
  })

  // 按工作包分组
  const groupedData = filteredData.reduce((acc: Record<string, WorkStepDefine[]>, item: WorkStepDefine) => {
    const wp = item.work_package || '未分类'
    if (!acc[wp]) {
      acc[wp] = []
    }
    acc[wp].push(item)
    return acc
  }, {})

  // 构建表格数据（展开所有工作包）
  type TableDataItem = Partial<WorkStepDefine> & { key: string; isGroup?: boolean; groupName?: string }
  const tableData = useMemo<TableDataItem[]>(() => {
    return Object.entries(groupedData).sort().flatMap(([workPackage, items]) => {
      // 添加工作包分组行
      const itemsArray = items as WorkStepDefine[]
      const totalWeight = itemsArray.reduce((sum: number, item: WorkStepDefine) => {
        return sum + (item.work_step_weight || 0)
      }, 0)
      
      const groupRow: TableDataItem = {
        key: `group-${workPackage}`,
        isGroup: true,
        groupName: workPackage,
        work_package: workPackage,
        work_step_description: '',
        is_key_quantity: false,
        sort_order: 0,
        is_active: true,
        work_step_weight: totalWeight,
      }
      
      // 添加该工作包下的工作步骤
      const workStepRows: TableDataItem[] = (items as WorkStepDefine[])
        .sort((a: WorkStepDefine, b: WorkStepDefine) => a.sort_order - b.sort_order)
        .map((item: WorkStepDefine) => ({
          ...item,
          key: `workstep-${item.id}`,
        }))
      
      return [groupRow, ...workStepRows]
    })
  }, [groupedData])

  const handleManagePackageSteps = (workPackage: string) => {
    setCurrentWorkPackage(workPackage)
    const steps = (groupedData[workPackage] || []).sort((a: WorkStepDefine, b: WorkStepDefine) => a.sort_order - b.sort_order)
    batchForm.setFieldsValue({
      items: steps.map((s: WorkStepDefine) => ({
        id: s.id,
        work_step_description: s.work_step_description,
        work_step_weight: s.work_step_weight,
        is_key_quantity: s.is_key_quantity,
        sort_order: s.sort_order,
        is_active: s.is_active,
      }))
    })
    setBatchModalVisible(true)
  }

  const handleBatchSubmit = () => {
    batchForm.validateFields().then(values => {
      if (!currentWorkPackage) return
      
      const items = values.items || []
      const totalWeight = items.reduce((sum: number, item: any) => sum + (item.work_step_weight || 0), 0)
      
      if (Math.abs(totalWeight - 100) > 0.01) {
        Modal.confirm({
          title: '权重未达到 100%',
          content: `当前所有步骤权重总和为 ${totalWeight.toFixed(2)}%，确定要保存吗？建议分配至 100%。`,
          okText: '确定保存',
          cancelText: '返回修改',
          onOk: () => {
            batchMutation.mutate({ workPackage: currentWorkPackage, items })
          }
        })
      } else {
        batchMutation.mutate({ workPackage: currentWorkPackage, items })
      }
    })
  }

  const columns = [
    {
      title: '工作包 / 工作步骤',
      key: 'work_package_step',
      width: 450,
      fixed: 'left' as const,
      render: (_: any, record: any) => {
        if (record.isGroup) {
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Space>
                <strong style={{ fontSize: 14 }}>
                  {record.groupName}
                </strong>
                <Tag color={Math.abs((record.work_step_weight || 0) - 100) < 0.01 ? "green" : "orange"}>
                  总权重: {record.work_step_weight ? `${record.work_step_weight.toFixed(2)}%` : '0.00%'}
                </Tag>
              </Space>
              <Button 
                type="primary" 
                size="small" 
                icon={<EditOutlined />} 
                onClick={() => handleManagePackageSteps(record.groupName)}
              >
                配置工作步骤
              </Button>
            </div>
          )
        }
        return (
          <Space>
            <span style={{ marginLeft: 24 }}>
              {record.work_step_description || '未命名'}
            </span>
            {record.is_key_quantity && (
              <Tag color="green">关键</Tag>
            )}
          </Space>
        )
      },
    },
    {
      title: '权重 (%)',
      dataIndex: 'work_step_weight',
      width: 120,
      align: 'right' as const,
      render: (value: number) => {
        if (value === undefined || value === null) return '-'
        return <strong>{value.toFixed(2)}%</strong>
      },
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 100,
      align: 'center' as const,
      render: (value: number) => value || 0,
    },
  ]

  return (
    <div>
      <Card
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          marginBottom: 24,
        }}
        styles={{ body: { padding: '24px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#333' }}>工作步骤管理</h2>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              刷新
            </Button>
            {/* 移除顶部的单条新增按钮，强制通过工作包进行配置 */}
          </Space>
        </div>

        {/* 筛选器 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Input
              placeholder="搜索工作包或工作步骤"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="筛选工作包"
              style={{ width: '100%' }}
              allowClear
              value={workPackageFilter}
              onChange={setWorkPackageFilter}
            >
              {(uniqueWorkPackages as string[]).map((wp: string) => (
                <Option key={wp} value={wp}>{wp}</Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Select
              placeholder="筛选关键数量"
              style={{ width: '100%' }}
              allowClear
              value={isKeyQuantityFilter}
              onChange={setIsKeyQuantityFilter}
            >
              <Option value={true}>仅关键步骤</Option>
              <Option value={false}>仅非关键步骤</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Button
              onClick={() => {
                setWorkPackageFilter(undefined)
                setIsKeyQuantityFilter(undefined)
                setSearchText('')
              }}
            >
              清除筛选
            </Button>
          </Col>
        </Row>

        {/* 数据表格 */}
        <Table
          columns={columns}
          dataSource={tableData}
          loading={isLoading}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          scroll={{ x: 1000, y: 600 }}
          rowClassName={(record: any) =>
            record.isGroup ? 'workstep-group-row' : 'workstep-detail-row'
          }
          size="small"
        />
      </Card>

      {/* 批量管理工作步骤模态框 */}
      <Modal
        title={`管理工作步骤: ${currentWorkPackage}`}
        open={batchModalVisible}
        onOk={handleBatchSubmit}
        onCancel={() => setBatchModalVisible(false)}
        width={900}
        confirmLoading={batchMutation.isPending}
        okText="全部保存"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Tag color="blue">工作包: {currentWorkPackage}</Tag>
          <span style={{ marginLeft: 8, color: '#666' }}>
            在此工作包下管理所有步骤，总权重建议为 100%。
          </span>
        </div>
        
        <Form form={batchForm} layout="vertical">
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: 8 }}>
                  {fields.map(({ key, name, ...restField }) => (
                    <div key={key} style={{ 
                      background: '#f8fafc', 
                      padding: '16px 16px 0', 
                      marginBottom: 16, 
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      position: 'relative'
                    }}>
                      <Button 
                        type="text" 
                        danger 
                        icon={<DeleteOutlined />} 
                        onClick={() => remove(name)}
                        style={{ position: 'absolute', right: 8, top: 8 }}
                      />
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            {...restField}
                            name={[name, 'work_step_description']}
                            label="工作步骤描述"
                            rules={[{ required: true, message: '请输入描述' }]}
                          >
                            <Input placeholder="例如: Lean Concrete" />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item
                            {...restField}
                            name={[name, 'work_step_weight']}
                            label="权重 (%)"
                            rules={[{ required: true, message: '必填' }]}
                          >
                            <InputNumber
                              min={0}
                              max={100}
                              precision={2}
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={3}>
                          <Form.Item
                            {...restField}
                            name={[name, 'is_key_quantity']}
                            label="关键"
                            valuePropName="checked"
                          >
                            <Switch size="small" />
                          </Form.Item>
                        </Col>
                        <Col span={5}>
                          <Form.Item
                            {...restField}
                            name={[name, 'sort_order']}
                            label="排序"
                          >
                            <InputNumber min={0} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item name={[name, 'id']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name={[name, 'is_active']} hidden initialValue={true}>
                        <Switch />
                      </Form.Item>
                    </div>
                  ))}
                </div>
                <Button
                  type="dashed"
                  onClick={() => add({ is_active: true, sort_order: fields.length * 10, is_key_quantity: false })}
                  block
                  icon={<PlusOutlined />}
                  style={{ marginTop: 8 }}
                >
                  添加新步骤
                </Button>
              </>
            )}
          </Form.List>

          <Divider />
          <div style={{ textAlign: 'right', fontWeight: 600 }}>
            <Form.Item shouldUpdate={(prev, curr) => prev.items !== curr.items}>
              {({ getFieldValue }) => {
                const items = getFieldValue('items') || []
                const total = items.reduce((sum: number, item: any) => sum + (item?.work_step_weight || 0), 0)
                return (
                  <span style={{ color: Math.abs(total - 100) < 0.01 ? '#52c41a' : '#fa8c16', fontSize: 16 }}>
                    当前总权重: {total.toFixed(2)}%
                    {Math.abs(total - 100) > 0.01 && ' (建议调整至 100%)'}
                  </span>
                )
              }}
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <style>{`
        .workstep-group-row {
          background-color: #f5f5f5 !important;
          font-weight: 600;
        }
        .workstep-detail-row {
          background-color: #ffffff;
        }
        .workstep-detail-row:hover {
          background-color: #fafafa;
        }
      `}</style>
    </div>
  )
}

export default WorkStepManagement

