import { useEffect, useMemo, useState } from 'react'
import { App, Button, DatePicker, Form, InputNumber, Modal, Select, Space, Table, Upload } from 'antd'
import type { UploadProps } from 'antd'
import { DownloadOutlined, UploadOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { dailyReportFillService, type DailyReportFillRow } from '../../services/dailyReportFillService'

const { Option } = Select

export interface DailyReportFillModalProps {
  open: boolean
  onClose: () => void
}

type ReportType = 'MP' | 'VFACT'

export const DailyReportFillModal = ({ open, onClose }: DailyReportFillModalProps) => {
  const { message } = App.useApp()
  const [form] = Form.useForm()

  const [scopes, setScopes] = useState<string[]>([])
  const [loadingScopes, setLoadingScopes] = useState(false)

  const [loadingRows, setLoadingRows] = useState(false)
  const [rows, setRows] = useState<DailyReportFillRow[]>([])

  const reportType: ReportType = Form.useWatch('reportType', form) || 'MP'
  const reportDate = Form.useWatch('reportDate', form)
  const scope: string | undefined = Form.useWatch('scope', form)

  const dateStr = useMemo(() => {
    if (!reportDate) return undefined
    return dayjs(reportDate).format('YYYY-MM-DD')
  }, [reportDate])

  useEffect(() => {
    if (!open) return
    setLoadingScopes(true)
    dailyReportFillService
      .getAvailableScopes()
      .then((data) => setScopes(data || []))
      .catch((e) => message.error(`获取Scope失败: ${e?.message || e}`))
      .finally(() => setLoadingScopes(false))
  }, [open, message])

  useEffect(() => {
    if (!open) return
    // 默认值
    if (!form.getFieldValue('reportType')) form.setFieldValue('reportType', 'MP')
    if (!form.getFieldValue('reportDate')) form.setFieldValue('reportDate', dayjs())
  }, [open, form])

  const loadContext = async () => {
    if (!dateStr || !scope) {
      message.warning('请选择日期和Scope')
      return
    }
    setLoadingRows(true)
    try {
      const ctx = await dailyReportFillService.getFillContext({
        report_type: reportType,
        date: dateStr,
        scope,
      })
      setRows(ctx.rows || [])
    } catch (e: any) {
      message.error(`加载填报清单失败: ${e?.message || e}`)
    } finally {
      setLoadingRows(false)
    }
  }

  const buildEntries = () => {
    if (reportType === 'MP') {
      return rows.map((r) => ({
        activity_id: r.activity_id,
        title: r.title,
        project: r.project,
        subproject: r.subproject,
        implement_phase: r.implement_phase,
        train: r.train,
        unit: r.unit,
        block: r.block,
        discipline: r.discipline,
        work_package: r.work_package,
        typeof_mp: 'Direct' as const,
        manpower: Number(r.manpower ?? 0),
        machinery: Number(r.machinery ?? 0),
      }))
    }
    return rows.map((r) => ({
      activity_id: r.activity_id,
      title: r.title,
      project: r.project,
      subproject: r.subproject,
      implement_phase: r.implement_phase,
      train: r.train,
      unit: r.unit,
      block: r.block,
      discipline: r.discipline,
      work_package: r.work_package,
      work_step_description: r.work_step_description,
      achieved: Number(r.achieved ?? 0),
    }))
  }

  const save = async (status: 'draft' | 'submitted') => {
    if (!dateStr || !scope) {
      message.warning('请选择日期和Scope')
      return
    }
    
    // 检查是否有PI04/PI05的数据
    if (reportType === 'VFACT') {
      const pi04pi05Rows = rows.filter(r => (r.work_package === 'PI04' || r.work_package === 'PI05') && (r.achieved ?? 0) > 0)
      if (pi04pi05Rows.length > 0) {
        message.error(`不允许提交工作包 PI04/PI05 的完成量，这些数据由系统自动同步。请将完成量设置为0或删除这些行。`)
        return
      }
    }
    
    try {
      message.loading({ content: status === 'submitted' ? '正在提交...' : '正在暂存...', key: 'daily-fill' })
      await dailyReportFillService.submitDailyReport({
        date: dateStr,
        report_type: reportType,
        scope,
        status,
        replace_all: true,
        entries: buildEntries(),
      })
      message.success({ content: status === 'submitted' ? '提交成功' : '暂存成功', key: 'daily-fill' })
    } catch (e: any) {
      message.error({ content: `保存失败: ${e?.message || e}`, key: 'daily-fill' })
    }
  }

  const exportTemplate = async () => {
    if (!dateStr || !scope) {
      message.warning('请选择日期和Scope')
      return
    }
    try {
      message.loading({ content: '正在导出模板...', key: 'daily-export' })
      const blob = await dailyReportFillService.exportTemplate({
        report_date: dateStr,
        report_type: reportType,
        scope,
      })
      const filename = `${reportType}-${dayjs(dateStr).format('YYYYMMDD')}-${scope}.xlsx`
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      message.success({ content: '已开始下载', key: 'daily-export' })
    } catch (e: any) {
      message.error({ content: `导出失败: ${e?.message || e}`, key: 'daily-export' })
    }
  }

  const uploadProps: UploadProps = {
    maxCount: 1,
    beforeUpload: async (file) => {
      if (!dateStr || !scope) {
        message.warning('请先选择日期和Scope')
        return Upload.LIST_IGNORE
      }
      try {
        message.loading({ content: '正在导入...', key: 'daily-import' })
        const res = await dailyReportFillService.importFilledReport({
          report_type: reportType,
          report_date: dateStr,
          scope,
          file,
        })
        if (res.success) {
          message.success({ content: res.message || '导入成功', key: 'daily-import' })
          await loadContext()
        } else {
          message.error({ content: res.message || '导入失败', key: 'daily-import' })
        }
      } catch (e: any) {
        message.error({ content: `导入失败: ${e?.message || e}`, key: 'daily-import' })
      }
      return Upload.LIST_IGNORE
    },
    showUploadList: false,
  }

  const columns = useMemo(() => {
    const base = [
      { title: '作业ID', dataIndex: 'activity_id', width: 160, fixed: 'left' as const },
      { title: '描述', dataIndex: 'title', width: 320 },
      { title: 'Block', dataIndex: 'block', width: 120 },
      { title: '专业', dataIndex: 'discipline', width: 100 },
      { title: '工作包', dataIndex: 'work_package', width: 140 },
    ]
    if (reportType === 'MP') {
      return [
        ...base,
        {
          title: '人力',
          dataIndex: 'manpower',
          width: 120,
          render: (_: any, record: DailyReportFillRow) => (
            <InputNumber
              min={0}
              value={record.manpower ?? 0}
              onChange={(v) =>
                setRows((prev) =>
                  prev.map((r) => (r.activity_id === record.activity_id ? { ...r, manpower: Number(v ?? 0) } : r)),
                )
              }
            />
          ),
        },
        {
          title: '机械',
          dataIndex: 'machinery',
          width: 120,
          render: (_: any, record: DailyReportFillRow) => (
            <InputNumber
              min={0}
              value={record.machinery ?? 0}
              onChange={(v) =>
                setRows((prev) =>
                  prev.map((r) => (r.activity_id === record.activity_id ? { ...r, machinery: Number(v ?? 0) } : r)),
                )
              }
            />
          ),
        },
      ]
    }
    return [
      ...base,
      {
        title: '完成量',
        dataIndex: 'achieved',
        width: 160,
        render: (_: any, record: DailyReportFillRow) => {
          const isPI04PI05 = record.work_package === 'PI04' || record.work_package === 'PI05'
          return (
            <InputNumber
              min={0}
              value={record.achieved ?? 0}
              disabled={isPI04PI05}
              placeholder={isPI04PI05 ? '系统自动同步' : undefined}
              onChange={(v) => {
                if (isPI04PI05) {
                  message.warning(`工作包 ${record.work_package} 的完成量由系统自动同步，不允许用户填写`)
                  return
                }
                setRows((prev) =>
                  prev.map((r) => (r.activity_id === record.activity_id ? { ...r, achieved: Number(v ?? 0) } : r)),
                )
              }}
            />
          )
        },
      },
    ]
  }, [reportType])

  return (
    <Modal
      title="日报填报（网页/导入导出）"
      open={open}
      onCancel={onClose}
      width={1100}
      footer={null}
      destroyOnClose
    >
      <Form form={form} layout="inline" style={{ marginBottom: 12 }}>
        <Form.Item name="reportType" label="类型">
          <Select style={{ width: 140 }}>
            <Option value="MP">MP（人力）</Option>
            <Option value="VFACT">VFACT（工程量）</Option>
          </Select>
        </Form.Item>
        <Form.Item name="reportDate" label="日期">
          <DatePicker allowClear={false} />
        </Form.Item>
        <Form.Item name="scope" label="Scope">
          <Select
            style={{ width: 220 }}
            loading={loadingScopes}
            showSearch
            filterOption={(input, option) => {
              const value = option?.value as string | undefined
              const label = option?.label as string | undefined
              const searchText = input.toLowerCase()
              if (value && typeof value === 'string') {
                return value.toLowerCase().includes(searchText)
              }
              if (label && typeof label === 'string') {
                return label.toLowerCase().includes(searchText)
              }
              return false
            }}
          >
            {scopes.map((s) => (
              <Option key={s} value={s}>
                {s}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadContext} loading={loadingRows}>
              加载
            </Button>
            <Button icon={<DownloadOutlined />} onClick={exportTemplate} disabled={!dateStr || !scope}>
              导出模板
            </Button>
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} disabled={!dateStr || !scope}>
                导入回写
              </Button>
            </Upload>
            <Button type="default" onClick={() => save('draft')} disabled={!dateStr || !scope}>
              暂存
            </Button>
            <Button type="primary" onClick={() => save('submitted')} disabled={!dateStr || !scope}>
              提交
            </Button>
          </Space>
        </Form.Item>
      </Form>

      <Table
        rowKey="activity_id"
        size="small"
        loading={loadingRows}
        columns={columns as any}
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1100 }}
      />
    </Modal>
  )
}


