import { logger } from '../../utils/logger'
import { Modal, Form, Input, DatePicker, Select, message, Row, Col } from 'antd'
import { useMutation } from '@tanstack/react-query'
import { reportService } from '../../services/reportService'
import type { MPDBEntry } from '../../types/report'
import dayjs from 'dayjs'
import { formatHighPrecisionValue } from '../../utils/formatNumber'
import { useEffect } from 'react'

interface MPDBModalProps {
  visible: boolean
  record?: MPDBEntry & { id?: number } | null
  onCancel: () => void
  onSuccess: () => void
}

const MPDBModal = ({ visible, record, onCancel, onSuccess }: MPDBModalProps) => {
  const [form] = Form.useForm()
  const isEdit = !!record?.id

  // 当 record 变化或 visible 变化时，重置表单值
  useEffect(() => {
    if (visible) {
      if (record) {
        form.setFieldsValue({
          ...record,
          activity_id: record.activity_id ?? '',
          date: record.date ? dayjs(record.date) : dayjs(),
          manpower: formatHighPrecisionValue(record.manpower),
          machinery: formatHighPrecisionValue(record.machinery),
        })
      } else {
        form.resetFields()
        form.setFieldsValue({
          date: dayjs(),
          activity_id: '',
          typeof_mp: 'Direct',
          manpower: '0',
          machinery: '0',
        })
      }
    }
  }, [visible, record, form])

  const createMutation = useMutation({
    mutationFn: reportService.createMPDB,
    onSuccess: () => {
      message.success('创建成功')
      form.resetFields()
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
    mutationFn: ({ id, data }: { id: number; data: MPDBEntry }) =>
      reportService.updateMPDB(id, data),
    onSuccess: () => {
      message.success('更新成功')
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
      const activityId = values.activity_id != null && String(values.activity_id).trim() !== ''
        ? String(values.activity_id).trim()
        : null
      const formData: MPDBEntry = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        activity_id: activityId,
      }

      if (isEdit && record?.id) {
        updateMutation.mutate({ id: record.id, data: formData })
      } else {
        createMutation.mutate(formData)
      }
    } catch (error) {
      logger.error('Validation failed:', error)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    onCancel()
  }

  return (
    <Modal
      title={isEdit ? '编辑人力日报' : '新增人力日报'}
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      width={720}
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
              label="作业ID（留空表示 MP 额外项）"
            >
              <Input 
                placeholder="留空为 MP 额外项；或输入如: GCCPRJ.CT.Q01-00001-00.PI01" 
                onBlur={async (e) => {
                  const val = e.target.value?.trim()
                  if (val) {
                    try {
                      // 自动查询作业信息并补全表单
                      const activity = await reportService.getActivity(val)
                      if (activity) {
                        form.setFieldsValue({
                          scope: activity.scope,
                          project: activity.project,
                          subproject: activity.subproject,
                          implement_phase: activity.implement_phase,
                          train: activity.train,
                          unit: activity.unit,
                          block: activity.block,
                          discipline: activity.discipline,
                          work_package: activity.work_package,
                          title: activity.title
                        })
                        message.info(`已自动补全作业 ${val} 的相关信息`)
                      }
                    } catch (err) {
                      logger.error('Failed to fetch activity details:', err)
                    }
                  }
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="typeof_mp" label="人力类型">
              <Select>
                <Select.Option value="Direct">直接</Select.Option>
                <Select.Option value="Indirect">间接</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="scope"
              label="范围 (Scope)"
              rules={[{ required: true, message: '请填写或选择范围' }]}
            >
              <Input placeholder="例如: PEL, NAG, GCC (必填)" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="manpower"
              label="人力数量"
              rules={[{ required: true, message: '请输入人力数量' }]}
            >
              <Input
                placeholder="请输入人力数量"
                onChange={(e) => {
                  const value = e.target.value.trim()
                  if (value === '' || /^-?\d*\.?\d*(?:[eE][-+]?\d*)?$/.test(value)) {
                    form.setFieldValue('manpower', value === '' ? undefined : value)
                  }
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="machinery" label="机械数量">
              <Input
                placeholder="请输入机械数量"
                onChange={(e) => {
                  const value = e.target.value.trim()
                  if (value === '' || /^-?\d*\.?\d*(?:[eE][-+]?\d*)?$/.test(value)) {
                    form.setFieldValue('machinery', value === '' ? undefined : value)
                  }
                }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="project" label="项目">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="subproject" label="子项目">
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="implement_phase" label="阶段">
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="train" label="Train">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="unit" label="Unit">
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="block" label="Block">
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="discipline" label="专业">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="work_package" label="工作包">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="title" label="作业描述">
          <Input.TextArea rows={2} />
        </Form.Item>

        <Form.Item name="remarks" label="备注">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default MPDBModal


