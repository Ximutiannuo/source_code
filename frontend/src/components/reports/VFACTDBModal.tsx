import { Modal, Form, Input, Select, DatePicker, message, Alert, Row, Col } from 'antd'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { reportService } from '../../services/reportService'
import { activityService } from '../../services/activityService'
import { workstepService, type WorkStepDefine } from '../../services/workstepService'
import type { VFACTDBEntry } from '../../types/report'
import dayjs from 'dayjs'
import { useState, useEffect } from 'react'
import { formatHighPrecisionValue } from '../../utils/formatNumber'

interface VFACTDBModalProps {
  visible: boolean
  record?: VFACTDBEntry & { id?: number } | null
  onCancel: () => void
  onSuccess: () => void
}

const VFACTDBModal = ({ visible, record, onCancel, onSuccess }: VFACTDBModalProps) => {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const isEdit = !!record?.id
  const [isPI04PI05, setIsPI04PI05] = useState(false)
  const [workPackage, setWorkPackage] = useState<string | undefined>(undefined)

  // 当 record 变化或 visible 变化时，重置表单值
  useEffect(() => {
    if (visible) {
      if (record) {
        form.setFieldsValue({
          ...record,
          date: record.date ? dayjs(record.date) : dayjs(),
          achieved: (() => {
            const value = typeof record.achieved === 'string' ? record.achieved : (record.achieved?.toString() || '0')
            return formatHighPrecisionValue(value)
          })(),
        })
        setWorkPackage(record.work_package)
        setIsPI04PI05(record.work_package === 'PI04' || record.work_package === 'PI05')
      } else {
        form.resetFields()
        form.setFieldsValue({
          date: dayjs(),
          achieved: '0',
        })
        setWorkPackage(undefined)
        setIsPI04PI05(false)
      }
    }
  }, [visible, record, form])

  const createMutation = useMutation({
    mutationFn: reportService.createVFACTDB,
    onSuccess: () => {
      message.success('创建成功')
      form.resetFields()
      // 刷新查询，但不等待，直接关闭
      queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
      queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
      onSuccess()
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (error.response?.status === 403 && detail) {
        Modal.error({
          title: '创建失败 - 作业已锁定',
          content: (
            <div style={{ marginTop: '10px' }}>
              <p>{detail}</p>
              <p style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '15px' }}>
                提示：已确认完成的作业处于锁定状态，禁止再填报数据。如需操作，请先前往“计划管理”重新打开该作业。
              </p>
            </div>
          ),
          okText: '知道了',
          width: 450,
        })
      } else {
        message.error(detail || '创建失败')
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: VFACTDBEntry }) =>
      reportService.updateVFACTDB(id, data),
    onSuccess: (updatedData) => {
      message.success('更新成功')
      
      // 1. 立即更新本地缓存，实现极致性能体验
      queryClient.setQueriesData({ queryKey: ['vfactdb'] }, (old: any) => {
        if (!old) return old
        const updateItem = (item: any) => (item.id === updatedData.id ? { ...item, ...updatedData } : item)
        if (Array.isArray(old)) return old.map(updateItem)
        if (old.items && Array.isArray(old.items)) {
          return { ...old, items: old.items.map(updateItem) }
        }
        return old
      })

      // 2. 静默刷新后台，确保汇总数据最终准确
      queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
      queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
      
      // 3. 立即关闭弹窗
      onSuccess()
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (error.response?.status === 403 && detail) {
        Modal.error({
          title: '更新失败 - 作业已锁定',
          content: (
            <div style={{ marginTop: '10px' }}>
              <p>{detail}</p>
              <p style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '15px' }}>
                提示：已确认完成的作业处于锁定状态，禁止删除或修改数据。如需操作，请先前往“计划管理”重新打开该作业。
              </p>
            </div>
          ),
          okText: '知道了',
          width: 450,
        })
      } else {
        message.error(detail || '更新失败')
      }
    },
  })

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      
      // 检查是否为PI04/PI05，如果是则不允许提交
      if (isPI04PI05 && values.achieved && parseFloat(values.achieved) > 0) {
        message.error(`不允许提交工作包 ${workPackage} 的完成量，该数据由系统自动同步`)
        return
      }
      
      const formData: VFACTDBEntry = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        // 保持字符串格式以保持高精度，不转换为number
        achieved: typeof values.achieved === 'string' ? values.achieved : (values.achieved?.toString() || '0'),
      }

      if (isEdit && record?.id) {
        updateMutation.mutate({ id: record.id, data: formData })
      } else {
        createMutation.mutate(formData)
      }
    } catch (error) {
      // 表单验证失败
    }
  }

  const handleCancel = () => {
    form.resetFields()
    setIsPI04PI05(false)
    setWorkPackage(undefined)
    onCancel()
  }

  // 监听activity_id变化
  const activityId = Form.useWatch('activity_id', form)
  useEffect(() => {
    if (activityId) {
      activityService.getActivityById(activityId)
        .then((activity) => {
          const wp = activity.work_package
          setWorkPackage(wp)
          if (wp === 'PI04' || wp === 'PI05') {
            setIsPI04PI05(true)
            if (!isEdit) {
              form.setFieldValue('achieved', '0')
              message.warning(`工作包 ${wp} 的完成量由系统自动同步，不允许用户手动填写`)
            }
          } else {
            setIsPI04PI05(false)
          }
        })
        .catch(() => {
          setIsPI04PI05(false)
          setWorkPackage(undefined)
        })
    } else if (record?.work_package && !activityId) {
      const wp = record.work_package
      setWorkPackage(wp)
      setIsPI04PI05(wp === 'PI04' || wp === 'PI05')
    } else if (!activityId && !record?.work_package && !record?.activity_id) {
      setIsPI04PI05(false)
      setWorkPackage(undefined)
    }
  }, [activityId, isEdit, record?.work_package, record?.activity_id, form])

  const { data: workSteps, isLoading: workStepsLoading } = useQuery({
    queryKey: ['worksteps-for-vfactdb-modal', workPackage],
    queryFn: () => workstepService.getWorkStepDefines({
      work_package: workPackage!,
      is_key_quantity: true,
      is_active: true,
    }),
    enabled: !!workPackage && visible,
  })

  return (
    <Modal
      title={isEdit ? '编辑工程量日报' : '新增工程量日报'}
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      width={640}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      destroyOnClose
      styles={{
        body: {
          maxHeight: 'calc(100vh - 250px)',
          overflowY: 'auto',
          padding: '12px 24px'
        }
      }}
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="date"
              label="日期"
              rules={[{ required: true, message: '请选择日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="activity_id"
              label="作业ID"
              rules={[{ required: true, message: '请输入作业ID' }]}
            >
              <Input placeholder="例如: GCCPRJ.CT.Q01-00001-00.PI01" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="work_step_description"
              label="工作步骤描述"
              rules={[{ required: true, message: '请选择工作类型' }]}
            >
              <Select
                placeholder={
                  !workPackage 
                    ? "请先输入作业ID" 
                    : workStepsLoading 
                      ? "加载中..." 
                      : "请选择工作类型"
                }
                showSearch
                allowClear
                loading={workStepsLoading}
                disabled={!workPackage || workStepsLoading}
                filterOption={(input, option) => {
                  const label = option?.label
                  if (!label) return false
                  return String(label).toLowerCase().includes(input.toLowerCase())
                }}
                options={workSteps?.map((ws: WorkStepDefine) => ({
                  value: ws.work_step_description,
                  label: ws.work_step_description,
                })) || []}
                notFoundContent={
                  workStepsLoading 
                    ? "加载中..." 
                    : !workPackage 
                      ? "请先输入作业ID" 
                      : "暂无工作类型"
                }
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="achieved"
              label="完成工程量"
              rules={[
                { required: !isPI04PI05, message: '请输入完成工程量' },
                {
                  validator: (_, value) => {
                    if (isPI04PI05) {
                      return Promise.resolve()
                    }
                    if (!value) {
                      return Promise.reject(new Error('请输入完成工程量'))
                    }
                    const numValue = typeof value === 'string' ? parseFloat(value) : value
                    if (isNaN(numValue) || numValue < 0) {
                      return Promise.reject(new Error('完成工程量必须是非负数'))
                    }
                    return Promise.resolve()
                  }
                }
              ]}
            >
              <Input
                placeholder={isPI04PI05 ? "该工作包由系统自动同步" : "请输入完成工程量"}
                disabled={isPI04PI05}
                onChange={(e) => {
                  if (isPI04PI05) {
                    return
                  }
                  const value = e.target.value.trim()
                  // 允许输入数字、小数点和科学计数法相关字符 (e, E, +, -)
                  if (value === '' || /^-?\d*\.?\d*(?:[eE][-+]?\d*)?$/.test(value)) {
                    form.setFieldValue('achieved', value === '' ? undefined : value)
                  }
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        {isPI04PI05 && (
          <Alert
            message={`工作包 ${workPackage} 的完成量由系统自动同步，不允许用户手动填写`}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
      </Form>
    </Modal>
  )
}

export default VFACTDBModal
