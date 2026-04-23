import React from 'react'
import { Modal, Form, Input, Select, App, Spin, Alert } from 'antd'
import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { p6Service } from '../../services/p6Service'

interface P6SyncModalProps {
  visible: boolean
  onCancel: () => void
  onSuccess: () => void
  initialProjectIds?: string[]  // 预设的项目ID列表
  initialEpsObjectId?: number    // 预设的EPS ObjectId
  initialSyncMode?: 'single' | 'multiple' | 'eps'  // 预设的同步模式
}

const P6SyncModal: React.FC<P6SyncModalProps> = ({ 
  visible, 
  onCancel, 
  onSuccess,
  initialProjectIds,
  initialEpsObjectId,
  initialSyncMode = 'single'
}) => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [syncing, setSyncing] = useState(false)

  // 当 visible 或初始值改变时，更新表单
  useEffect(() => {
    if (visible) {
      if (initialEpsObjectId) {
        form.setFieldsValue({
          sync_mode: 'eps',
          eps_object_id: initialEpsObjectId,
        })
      } else if (initialProjectIds && initialProjectIds.length > 0) {
        form.setFieldsValue({
          sync_mode: initialProjectIds.length === 1 ? 'single' : 'multiple',
          project_id: initialProjectIds.length === 1 ? initialProjectIds[0] : undefined,
          project_ids: initialProjectIds.length > 1 ? initialProjectIds : undefined,
        })
      } else {
        form.setFieldsValue({
          sync_mode: initialSyncMode,
        })
      }
    }
  }, [visible, initialProjectIds, initialEpsObjectId, initialSyncMode, form])

  // 检查P6连接状态
  const { data: p6Status, isLoading: statusLoading } = useQuery({
    queryKey: ['p6-status'],
    queryFn: () => p6Service.getP6Status(),
    enabled: visible,
  })

  // 获取项目列表
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['p6-projects'],
    queryFn: () => p6Service.getProjects(),
    enabled: visible && p6Status?.connected,
    retry: false,
  })

  const syncMutation = useMutation({
    mutationFn: (requestData: { sync_type: string; project_id?: string; project_ids?: string[]; eps_object_id?: number }) => {
      const { sync_type, ...rest } = requestData
      if (sync_type === 'activities') {
        return p6Service.syncActivities(rest)
      } else if (sync_type === 'wbs') {
        return p6Service.syncWBS(rest)
      } else if (sync_type === 'resources') {
        return p6Service.syncResources(rest)
      }
      throw new Error('不支持的同步类型')
    },
    onSuccess: (data) => {
      const recordCount = data.synced_count || data.count || 0
      const projectCount = data.projects_processed || 1
      let successMsg = `同步完成！处理了 ${projectCount} 个项目，同步了 ${recordCount} 条记录`
      
      if (data.errors && data.errors.length > 0) {
        successMsg += `，${data.errors.length} 个项目同步失败`
        message.warning(successMsg)
      } else {
        message.success(successMsg)
      }
      
      form.resetFields()
      onSuccess()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || '同步失败')
    },
    onSettled: () => {
      setSyncing(false)
    },
  })

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSyncing(true)
      
      // 根据同步模式构建请求
      let requestData: any = {
        sync_type: values.sync_type,
      }
      
      if (values.sync_mode === 'eps') {
        requestData.eps_object_id = parseInt(values.eps_object_id)
      } else if (values.sync_mode === 'multiple') {
        if (Array.isArray(values.project_ids)) {
          requestData.project_ids = values.project_ids
        } else {
          // 如果是字符串，按逗号分割
          requestData.project_ids = values.project_ids.split(',').map((id: string) => id.trim()).filter((id: string) => id)
        }
      } else {
        requestData.project_id = values.project_id
      }
      
      syncMutation.mutate(requestData)
    } catch (error) {
      // 表单验证失败
    }
  }

  const handleCancel = () => {
    form.resetFields()
    onCancel()
  }

  return (
    <Modal
      title="P6数据同步"
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={syncing}
      width={600}
    >
      <Spin spinning={syncing || statusLoading}>
        {!p6Status?.configured && (
          <Alert
            message="P6未配置"
            description="请在backend/.env文件中配置P6服务器连接信息（P6_SERVER_URL, P6_DATABASE, P6_USERNAME, P6_PASSWORD）"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {p6Status?.configured && !p6Status?.connected && (
          <Alert
            message="P6连接失败"
            description="无法连接到P6服务器，请检查配置和网络连接"
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {p6Status?.connected && (
          <Alert
            message="P6连接成功"
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form form={form} layout="vertical" initialValues={{ sync_type: 'activities' }}>
          <Form.Item
            name="sync_type"
            label="同步类型"
            rules={[{ required: true, message: '请选择同步类型' }]}
          >
            <Select>
              <Select.Option value="activities">作业数据</Select.Option>
              <Select.Option value="wbs">WBS数据</Select.Option>
              <Select.Option value="resources">资源数据</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="sync_mode"
            label="同步模式"
            initialValue="single"
          >
            <Select>
              <Select.Option value="single">单个项目</Select.Option>
              <Select.Option value="multiple">多个项目</Select.Option>
              <Select.Option value="eps">整个EPS</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.sync_mode !== currentValues.sync_mode}
          >
            {({ getFieldValue }) => {
              const syncMode = getFieldValue('sync_mode') || 'single'
              
              if (syncMode === 'eps') {
                return (
                  <Form.Item
                    name="eps_object_id"
                    label="EPS ObjectId"
                    rules={[{ required: true, message: '请输入EPS ObjectId' }]}
                  >
                    <Input 
                      placeholder="例如: 12082" 
                      type="number"
                      disabled={!p6Status?.connected}
                    />
                  </Form.Item>
                )
              } else if (syncMode === 'multiple') {
                return (
                  <Form.Item
                    name="project_ids"
                    label="项目ID列表"
                    rules={[{ required: true, message: '请选择项目' }]}
                  >
                    {projects && projects.length > 0 ? (
                      <Select
                        mode="multiple"
                        placeholder="选择多个项目"
                        showSearch
                        optionFilterProp="children"
                        loading={projectsLoading}
                      >
                        {projects.map((proj: any) => (
                          <Select.Option key={proj.id} value={proj.id}>
                            {proj.name} ({proj.id})
                          </Select.Option>
                        ))}
                      </Select>
                    ) : (
                      <Input 
                        placeholder="多个项目ID，用逗号分隔，例如: UIOPRJ,ECUPRJ,PELPRJ" 
                        disabled={!p6Status?.connected}
                      />
                    )}
                  </Form.Item>
                )
              } else {
                return (
                  <Form.Item
                    name="project_id"
                    label="项目ID"
                    rules={[{ required: true, message: '请输入或选择项目ID' }]}
                  >
                    {projects && projects.length > 0 ? (
                      <Select
                        placeholder="选择项目"
                        showSearch
                        optionFilterProp="children"
                        loading={projectsLoading}
                      >
                        {projects.map((proj: any) => (
                          <Select.Option key={proj.id} value={proj.id}>
                            {proj.name} ({proj.id})
                          </Select.Option>
                        ))}
                      </Select>
                    ) : (
                      <Input 
                        placeholder="例如: UIOPRJ" 
                        disabled={!p6Status?.connected}
                      />
                    )}
                  </Form.Item>
                )
              }
            }}
          </Form.Item>

          <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <p style={{ margin: 0, color: '#666' }}>
              <strong>提示：</strong>
            </p>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, color: '#666' }}>
              <li>同步作业数据：从P6同步所有作业信息到系统</li>
              <li>同步WBS数据：从P6同步WBS结构数据</li>
              <li>同步资源数据：从P6同步资源分配数据</li>
            </ul>
          </div>
        </Form>
      </Spin>
    </Modal>
  )
}

export default P6SyncModal

