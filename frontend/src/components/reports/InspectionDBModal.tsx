import { useEffect, useCallback, useState } from 'react'
import { Modal, Form, Input, Select, DatePicker, Row, Col, message, Upload, Button, Table, Typography } from 'antd'
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { reportService } from '../../services/reportService'
import { rscService } from '../../services/rscService'
import type { InspectionDBEntry, InspectionDBResponse } from '../../types/report'
import type { Activity } from '../../services/activityService'
import dayjs from 'dayjs'

interface InspectionDBModalProps {
  visible: boolean
  record?: InspectionDBResponse | null
  initialActivity?: Activity | null
  onCancel: () => void
  onSuccess: () => void
}

const sectionTitleStyle = (accent: string): React.CSSProperties => ({
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.08em',
  color: accent,
  marginBottom: 6,
  paddingLeft: 8,
  paddingBottom: 4,
  borderLeft: `3px solid ${accent}`,
  borderBottom: '1px solid #f0f0f0',
  lineHeight: 1.3,
})

const sectionBlockStyle: React.CSSProperties = {
  marginBottom: 8,
  padding: '8px 12px',
  background: '#fff',
  borderRadius: 2,
  border: '1px solid #e8eef6',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
}

const formItemCompact = { marginBottom: 6 }

/** 从 RFI 编号取最后一段短编码，如 GCC-CC7-UIO-ADD3-WS-RFI-99237 -> 99237 */
function rfiShortIdFromRfiId(rfiId: string | undefined): string {
  if (!rfiId || typeof rfiId !== 'string') return ''
  const trimmed = rfiId.trim()
  if (!trimmed) return ''
  const last = trimmed.split('-').pop()
  return last ?? ''
}

const InspectionDBModal = ({ visible, record, initialActivity, onCancel, onSuccess }: InspectionDBModalProps) => {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const isEdit = !!record?.id
  const fromActivity = !isEdit && !!initialActivity

  const documentNumber = Form.useWatch('document_number', form) ?? null
  const rfiId = Form.useWatch('rfi_id', form)
  const activityId = Form.useWatch('activity_id', form)
  const isFromActivity = !!activityId
  const workPackage = Form.useWatch('work_package', form)
  const groundOfWorksValue = Form.useWatch('ground_of_works', form)
  const scopeForRfi = Form.useWatch('scope', form)
  const scopeStr = typeof scopeForRfi === 'string' ? scopeForRfi.trim() : ''
  const rfiIdStr = typeof rfiId === 'string' ? rfiId.trim() : ''

  // 获取当前工作包的 RSC 定义
  const { data: rscDefines = [] } = useQuery({
    queryKey: ['rsc-defines', workPackage],
    queryFn: () => rscService.getRSCDefines({ work_package: workPackage }),
    enabled: visible && !!workPackage,
  })

  // 匹配逻辑：检查当前验收依据是否为关键聚合项
  const matchedRsc = rscDefines.find(r => r.work_package === workPackage)
  const isKeyAggregation = (() => {
    if (!matchedRsc || !groundOfWorksValue) return false
    // 增强的提取逻辑：取第一部分并移除尾部的点、冒号等，使其与数据库 itp_id 格式一致
    const normalize = (val: string | null | undefined) => 
      val?.trim().split(/[\s\u0400-\u04ff]+/)[0]?.replace(/[\.\s：:]+$/, '')
    
    const ids = [normalize(matchedRsc.rfi_a), normalize(matchedRsc.rfi_b), normalize(matchedRsc.rfi_c)].filter(Boolean)
    const targetId = normalize(groundOfWorksValue)
    return !!targetId && ids.includes(targetId)
  })()

  useEffect(() => {
    if (!visible) return
    const short = rfiShortIdFromRfiId(rfiId)
    form.setFieldValue('rfi_short_id', short || undefined)
  }, [visible, rfiId, form])

  useEffect(() => {
    if (visible && !documentNumber) {
      form.setFieldValue('ground_of_works', undefined)
    }
  }, [visible, documentNumber, form])

  const { data: itpDefinitions = [] } = useQuery({
    queryKey: ['itp-definitions'],
    queryFn: () => reportService.getItpDefinitions(),
    enabled: visible,
  })

  const { data: groundOfWorks = [] } = useQuery({
    queryKey: ['inspectiondb-ground-of-works', documentNumber],
    queryFn: () => reportService.getInspectionDBGroundOfWorks(documentNumber ?? undefined),
    enabled: visible && !!documentNumber,
  })

  const [rfiAttachKey, setRfiAttachKey] = useState(0)
  const { data: rfiFilesData, isLoading: rfiFilesLoading } = useQuery({
    queryKey: ['rfi-files-by-rfi', scopeStr, rfiIdStr, rfiAttachKey],
    queryFn: () => reportService.getRfiFilesByRfi(scopeStr, rfiIdStr),
    enabled: visible && !!scopeStr && !!rfiIdStr,
  })
  const { data: nextInputVersionData } = useQuery({
    queryKey: ['rfi-next-input-version', scopeStr, rfiIdStr, rfiAttachKey],
    queryFn: () => reportService.getNextInputVersion(scopeStr, rfiIdStr),
    enabled: visible && !!scopeStr && !!rfiIdStr,
  })
  const nextInputVersion = nextInputVersionData?.next_input_version ?? 0

  const handleRfiDownload = useCallback(async (path: string, name: string) => {
    try {
      const blob = await reportService.downloadRfiFile(path)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      message.success('已开始下载')
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '下载失败')
    }
  }, [])

  const handleRfiUpload = useCallback(async (folder: 'INPUT' | 'OUTPUT', file: File) => {
    if (!scopeStr || !rfiIdStr) {
      message.warning('请先填写分包商(Scope)和 RFI 编号')
      return false
    }
    try {
      await reportService.uploadRfiFileStandard({ scope: scopeStr, folder, rfi_id: rfiIdStr, file })
      message.success(`已上传为 ${folder} 新版本`)
      setRfiAttachKey((k) => k + 1)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '上传失败')
    }
    return false
  }, [scopeStr, rfiIdStr])

  const setFormValues = () => {
    if (!visible) return
    if (record) {
      form.setFieldsValue({
        ...record,
        rfi_issue_date: record.rfi_issue_date ? dayjs(record.rfi_issue_date) : undefined,
        rfi_inspection_date: record.rfi_inspection_date ? dayjs(record.rfi_inspection_date) : undefined,
        verification_date: record.verification_date ? dayjs(record.verification_date) : undefined,
        rfi_quantity: record.rfi_quantity ?? undefined,
      })
    } else if (initialActivity) {
      form.resetFields()
      form.setFieldsValue({
        activity_id: initialActivity.activity_id ?? '',
        scope: initialActivity.scope ?? '',
        project: initialActivity.project ?? '',
        subproject: initialActivity.subproject ?? '',
        implement_phase: initialActivity.implement_phase ?? '',
        train: initialActivity.train ?? '',
        unit: initialActivity.unit ?? '',
        block: initialActivity.block ?? '',
        quarter: initialActivity.quarter ?? '',
        main_block: initialActivity.main_block ?? '',
        title: initialActivity.title ?? initialActivity.description ?? '',
        discipline: initialActivity.discipline ?? '',
        work_package: initialActivity.work_package ?? '',
        rfi_inspection_date: dayjs(),
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        rfi_inspection_date: dayjs(),
      })
    }
  }

  useEffect(() => {
    setFormValues()
  }, [visible, record, initialActivity])

  const createMutation = useMutation({
    mutationFn: reportService.createInspectionDB,
    onSuccess: () => {
      message.success('创建成功')
      queryClient.invalidateQueries({ queryKey: ['inspectiondb'] })
      queryClient.invalidateQueries({ queryKey: ['inspectiondb-by-activities'] })
      onSuccess()
    },
    onError: (err: any) => message.error(err?.response?.data?.detail || '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: InspectionDBEntry }) =>
      reportService.updateInspectionDB(id, data),
    onSuccess: (_data, variables) => {
      message.success('更新成功')
      queryClient.invalidateQueries({ queryKey: ['inspectiondb'] })
      queryClient.invalidateQueries({ queryKey: ['inspectiondb-by-activities'] })
      if (variables.data.scope && variables.data.rfi_id) {
        queryClient.invalidateQueries({ queryKey: ['rfi-next-input-version', variables.data.scope.trim(), variables.data.rfi_id.trim()] })
        queryClient.invalidateQueries({ queryKey: ['rfi-files-by-rfi'] })
      }
      onSuccess()
    },
    onError: (err: any) => message.error(err?.response?.data?.detail || '更新失败'),
  })

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const rfi_issue_date = values.rfi_issue_date ? values.rfi_issue_date.format('YYYY-MM-DD') : undefined
      const rfi_inspection_date = values.rfi_inspection_date
        ? values.rfi_inspection_date.format('YYYY-MM-DDTHH:mm:ss')
        : undefined
      const verification_date = values.verification_date ? values.verification_date.format('YYYY-MM-DD') : undefined
      const formData: InspectionDBEntry = {
        ...values,
        rfi_id: values.rfi_id?.trim() || '',
        rfi_issue_date,
        rfi_inspection_date,
        verification_date,
        rfi_quantity:
          values.rfi_quantity !== undefined && values.rfi_quantity !== null && values.rfi_quantity !== ''
            ? String(values.rfi_quantity)
            : undefined,
        matched_drawing_number: Array.isArray(values.matched_drawing_number) ? values.matched_drawing_number : undefined,
      }
      if (fromActivity && initialActivity) {
        formData.activity_id = initialActivity.activity_id ?? undefined
        formData.scope = initialActivity.scope ?? undefined
        formData.project = initialActivity.project ?? undefined
        formData.subproject = initialActivity.subproject ?? undefined
        formData.implement_phase = initialActivity.implement_phase ?? undefined
        formData.train = initialActivity.train ?? undefined
        formData.unit = initialActivity.unit ?? undefined
        formData.block = initialActivity.block ?? undefined
        formData.quarter = initialActivity.quarter ?? undefined
        formData.main_block = initialActivity.main_block ?? undefined
        formData.title = initialActivity.title ?? initialActivity.description ?? undefined
        formData.discipline = initialActivity.discipline ?? undefined
        formData.work_package = initialActivity.work_package ?? undefined
      }
      if (isEdit && record?.id) {
        updateMutation.mutate({ id: record.id, data: formData })
      } else {
        createMutation.mutate(formData)
      }
    } catch (_) {}
  }

  return (
    <Modal
      title={isEdit ? '编辑验收日报' : '新增验收日报'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      width={1440}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      destroyOnClose
      okText="确定"
      cancelText="取消"
      styles={{
        header: {
          borderBottom: '1px solid #d6e4ff',
          padding: '10px 20px',
          background: 'linear-gradient(135deg, #e6f4ff 0%, #bae0ff 50%, #91caff 100%)',
          color: '#003a8c',
        },
        body: {
          maxHeight: 'calc(100vh - 160px)',
          overflowY: 'auto',
          padding: '10px 16px',
          background: 'linear-gradient(180deg, #f0f5ff 0%, #fafbff 100%)',
        },
        footer: {
          borderTop: '1px solid #d6e4ff',
          padding: '8px 20px',
          background: '#fafbff',
        },
      }}
      className="inspection-db-modal"
    >
      <style>{`
        .inspection-db-modal.ant-modal .ant-modal-content { border-radius: 2px; }
        .inspection-db-modal .ant-input,
        .inspection-db-modal .ant-input-affix-wrapper,
        .inspection-db-modal .ant-select .ant-select-selector,
        .inspection-db-modal .ant-picker { border-radius: 2px !important; height: 28px !important; min-height: 28px !important; }
        .inspection-db-modal .ant-input-affix-wrapper > input.ant-input { height: 28px !important; min-height: 28px !important; }
        .inspection-db-modal .ant-select .ant-select-selector { height: 28px !important; padding: 0 11px !important; align-items: center !important; }
        .inspection-db-modal .ant-picker { height: 28px !important; padding: 0 11px !important; }
        .inspection-db-modal textarea.ant-input { min-height: 28px !important; height: 28px !important; resize: vertical; line-height: 1.5; padding: 4px 11px; box-sizing: border-box; }
        .inspection-db-modal .ant-form-item { margin-bottom: 6px !important; }
        .inspection-db-modal .ant-form-item-explain { font-size: 11px; }
        .inspection-db-modal .ant-modal-footer .ant-btn-primary { background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%); border-color: #0958d9; }
      `}</style>
      <Form form={form} layout="vertical" size="small" style={{ marginTop: 2 }}>
        {/* 基本信息：RFI + 日期，来自基础信息的只读字段，标题图号单独一行，图号用户填 */}
        <div style={sectionBlockStyle}>
          <div style={sectionTitleStyle('#1677ff')}>基本信息</div>
          <Row gutter={10}>
            <Col span={6}>
              <Form.Item name="rfi_id" label="RFI 编号" rules={[{ required: true, message: '请输入 RFI 编号' }]} style={formItemCompact}>
                <Input placeholder="如 GCC-CC7-UIO-ADD3-WS-RFI-99237" style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </Col>
            <Col span={3}>
              <Form.Item name="rfi_short_id" label="短编码" style={formItemCompact} tooltip="自动取自 RFI 编号最后一段">
                <Input placeholder="自动" style={{ fontFamily: 'monospace' }} readOnly />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="rfi_issue_date" label="申请检查日期" style={formItemCompact}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="rfi_inspection_date" label="计划验收日期" style={formItemCompact}>
                <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="activity_id" label="作业 ID" style={formItemCompact}>
                <Input placeholder="可选" disabled={fromActivity || (isEdit && !!record?.activity_id)} style={{ fontFamily: 'Consolas, Monaco, "Liberation Mono", "Courier New", monospace' }} />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ ...sectionTitleStyle('#1677ff'), opacity: 0.85, fontSize: 10, marginTop: 4 }}>来自基础信息</div>
          <Row gutter={[10, 0]}>
            <Col span={2}>
              <Form.Item name="scope" label="分包商" style={formItemCompact}>
                <Input disabled={isFromActivity} placeholder="-" />
              </Form.Item>
            </Col>
            <Col span={2}>
              <Form.Item name="implement_phase" label="执行阶段" style={formItemCompact}>
                <Input disabled={isFromActivity} placeholder="-" />
              </Form.Item>
            </Col>
            <Col span={2}>
              <Form.Item name="subproject" label="子项目" style={formItemCompact}>
                <Input disabled={isFromActivity} placeholder="-" />
              </Form.Item>
            </Col>
            <Col span={2}>
              <Form.Item name="train" label="开车阶段" style={formItemCompact}>
                <Input disabled={isFromActivity} placeholder="-" />
              </Form.Item>
            </Col>
            <Col span={2}>
              <Form.Item name="unit" label="装置" style={formItemCompact}>
                <Input disabled={isFromActivity} placeholder="-" />
              </Form.Item>
            </Col>
            <Col span={2}>
              <Form.Item name="main_block" label="主项" style={formItemCompact}>
                <Input disabled={isFromActivity} placeholder="-" />
              </Form.Item>
            </Col>
            <Col span={2}>
              <Form.Item name="quarter" label="区块" style={formItemCompact}>
                <Input disabled={isFromActivity} placeholder="-" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="block" label="子项" style={formItemCompact}>
                <Input disabled={isFromActivity} placeholder="-" />
              </Form.Item>
            </Col>
            <Col span={3}>
              <Form.Item name="discipline" label="专业" style={formItemCompact}>
                <Input disabled={isFromActivity} placeholder="-" />
              </Form.Item>
            </Col>
            <Col span={3}>
              <Form.Item name="work_package" label="工作包" style={formItemCompact}>
                <Input disabled={isFromActivity} placeholder="-" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="title" label="作业描述" style={formItemCompact}>
            <Input disabled={isFromActivity} placeholder="来自作业或手动填写" />
          </Form.Item>
          <Form.Item name="matched_drawing_number" label="图纸编号（用户填写）" style={formItemCompact} tooltip="可输入多个图号，回车或逗号分隔">
            <Select
              mode="tags"
              placeholder="输入图号后回车添加"
              tokenSeparators={[',', '，']}
              options={[]}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="rfi_description" label="RFI/验收描述" style={formItemCompact}>
            <Input.TextArea rows={1} placeholder="简要描述" autoSize={{ minRows: 1, maxRows: 2 }} />
          </Form.Item>
          <Form.Item name="rfi_inspection_location" label="验收地点" style={formItemCompact}>
            <Input placeholder="验收地点" />
          </Form.Item>
        </div>

        {/* 验收信息：ITP 文档、工作依据排最前 */}
        <div style={sectionBlockStyle}>
          <div style={sectionTitleStyle('#08979c')}>验收信息</div>
          <Row gutter={10}>
            <Col span={8}>
              <Form.Item name="document_number" label="ITP 文档" style={formItemCompact} tooltip="选择 ITP 文档（编号 · 版本 · 名称），工作依据按编号匹配">
                <Select
                  placeholder="请选择 ITP（可选）"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={itpDefinitions.map((t: { document_number: string; version?: string; itp_name?: string }) => {
                    const parts = [t.document_number, t.version ?? '', t.itp_name ?? ''].filter(Boolean)
                    return {
                      value: t.document_number,
                      label: parts.join(' · '),
                    }
                  })}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ground_of_works" label="ITP文档对应编号（验收依据）" style={formItemCompact} tooltip="先选 ITP 文档后，按数据库排序显示该 ITP 下检查项（如 1.1）">
                <Select
                  placeholder={documentNumber ? '请选择' : '请先选择 ITP 文档'}
                  allowClear
                  showSearch
                  filterOption={(input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                  options={documentNumber ? groundOfWorks.map((g: { id: number; itp_id?: string; description?: string }) => ({
                    value: g.itp_id ?? '',
                    label: g.description ? `${g.itp_id ?? ''} - ${g.description}` : (g.itp_id ?? ''),
                  })) : []}
                />
              </Form.Item>
            </Col>
            <Col span={2}>
              <Form.Item name="inspection_type" label="验收类型" style={formItemCompact}>
                <Input placeholder="如 ACC" />
              </Form.Item>
            </Col>
            <Col span={2}>
              <Form.Item name="qc_inspector" label="质检员" style={formItemCompact}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={2}>
              <Form.Item name="request_no" label="申请编号" style={formItemCompact}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={2}>
              <Form.Item
                name="rfi_quantity"
                label="数量"
                style={formItemCompact}
                tooltip="填入该RFI对应的量，用于后续聚合计算"
                help={isKeyAggregation ? (
                  <span style={{ color: '#fa8c16', fontSize: '10px', fontWeight: 'bold' }}>
                    ⚠️ 请确保单位与工作包一致 {matchedRsc?.uom ? `(${matchedRsc.uom})` : ''}
                  </span>
                ) : null}
              >
                <Input placeholder="-" />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* RFI 附件：按 RFI 列出 INPUT/OUTPUT，上传即下一版本 _0,_1,_2… */}
        <div style={sectionBlockStyle}>
          <div style={sectionTitleStyle('#722ed1')}>RFI 附件</div>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
            分包商(Scope)与 RFI 编号填写后，可上传申请文件(INPUT)或审批后文件(OUTPUT)。质检员给出「拒绝」后系统自动升版，下次上传 INPUT 为版本 {nextInputVersion}；无需用户编号。
          </Typography.Text>
          {scopeStr && rfiIdStr && (
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              当前等待上传版本（INPUT）：{nextInputVersion}
            </Typography.Text>
          )}
          {(!scopeStr || !rfiIdStr) ? (
            <Typography.Text type="secondary">请先填写上方「来自基础信息」中的分包商和「RFI 编号」。</Typography.Text>
          ) : (
            <>
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ marginBottom: 4 }}>
                    <Typography.Text strong>INPUT（申请文件）</Typography.Text>
                    <Upload
                      maxCount={1}
                      showUploadList={false}
                      beforeUpload={(file) => handleRfiUpload('INPUT', file)}
                      style={{ marginLeft: 8 }}
                    >
                      <Button type="link" size="small" icon={<UploadOutlined />}>上传新版本</Button>
                    </Upload>
                  </div>
                  <Table
                    size="small"
                    loading={rfiFilesLoading}
                    dataSource={rfiFilesData?.input ?? []}
                    rowKey="path"
                    pagination={false}
                    columns={[
                      { title: '文件名', dataIndex: 'name', ellipsis: true },
                      { title: '版本', dataIndex: 'version', width: 56 },
                      { title: '大小', dataIndex: 'size', width: 72, render: (s: number) => (s == null ? '-' : s < 1024 ? `${s} B` : s < 1024 * 1024 ? `${(s / 1024).toFixed(1)} KB` : `${(s / (1024 * 1024)).toFixed(2)} MB`) },
                      { title: '', key: 'd', width: 56, render: (_: unknown, r: { path: string; name: string }) => <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleRfiDownload(r.path, r.name)}>下载</Button> },
                    ]}
                    locale={{ emptyText: '暂无' }}
                  />
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: 4 }}>
                    <Typography.Text strong>OUTPUT（审批后文件）</Typography.Text>
                    <Upload
                      maxCount={1}
                      showUploadList={false}
                      beforeUpload={(file) => handleRfiUpload('OUTPUT', file)}
                      style={{ marginLeft: 8 }}
                    >
                      <Button type="link" size="small" icon={<UploadOutlined />}>上传新版本</Button>
                    </Upload>
                  </div>
                  <Table
                    size="small"
                    loading={rfiFilesLoading}
                    dataSource={rfiFilesData?.output ?? []}
                    rowKey="path"
                    pagination={false}
                    columns={[
                      { title: '文件名', dataIndex: 'name', ellipsis: true },
                      { title: '版本', dataIndex: 'version', width: 56 },
                      { title: '大小', dataIndex: 'size', width: 72, render: (s: number) => (s == null ? '-' : s < 1024 ? `${s} B` : s < 1024 * 1024 ? `${(s / 1024).toFixed(1)} KB` : `${(s / (1024 * 1024)).toFixed(2)} MB`) },
                      { title: '', key: 'd', width: 56, render: (_: unknown, r: { path: string; name: string }) => <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleRfiDownload(r.path, r.name)}>下载</Button> },
                    ]}
                    locale={{ emptyText: '暂无' }}
                  />
                </Col>
              </Row>
            </>
          )}
        </div>

        {/* 结论与备注 */}
        <div style={{ ...sectionBlockStyle, marginBottom: 0 }}>
          <div style={sectionTitleStyle('#d46b08')}>结论与备注</div>
          <Row gutter={10}>
            <Col span={5}>
              <Form.Item name="inspection_conclusion" label="验收结论" style={formItemCompact}>
                <Input.TextArea rows={1} placeholder="验收结论" autoSize={{ minRows: 1, maxRows: 2 }} />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="comments" label="评论" style={formItemCompact}>
                <Input.TextArea rows={1} placeholder="评论" autoSize={{ minRows: 1, maxRows: 2 }} />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="fixing_problems_details" label="问题整改说明" style={formItemCompact}>
                <Input.TextArea rows={1} placeholder="问题整改说明" autoSize={{ minRows: 1, maxRows: 2 }} />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="note" label="备注" style={formItemCompact}>
                <Input.TextArea rows={1} placeholder="备注" autoSize={{ minRows: 1, maxRows: 2 }} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="verification_date" label="验收通过日期" style={formItemCompact}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </div>
      </Form>
    </Modal>
  )
}

export default InspectionDBModal
