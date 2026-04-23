import React, { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile, UploadProps } from 'antd'
import {
  DownloadOutlined,
  EyeOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ScanOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { ocrService } from '../services/ocrService'
import {
  drawingDocumentService,
  type DrawingBatchImportResult,
  type DrawingDocument,
} from '../services/drawingDocumentService'
import { plmService } from '../services/plmService'

const { Title, Text, Paragraph } = Typography

const DOCUMENT_TYPE_OPTIONS = [
  { label: 'CAD', value: 'CAD' },
  { label: 'SOLIDWORKS', value: 'SOLIDWORKS' },
  { label: 'PDF', value: 'PDF' },
  { label: 'DXF', value: 'DXF' },
  { label: 'STEP', value: 'STEP' },
]

const SOURCE_TYPE_OPTIONS = [
  { label: 'DESIGN_DOC', value: 'DESIGN_DOC' },
  { label: 'OCR_IMPORTED', value: 'OCR_IMPORTED' },
  { label: 'MANUAL', value: 'MANUAL' },
  { label: 'CAD_DIRECTORY', value: 'CAD_DIRECTORY' },
]

const STATUS_OPTIONS = [
  { label: 'RELEASED', value: 'RELEASED' },
  { label: 'DRAFT', value: 'DRAFT' },
  { label: 'ARCHIVED', value: 'ARCHIVED' },
]

const OCR_SUPPORTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.bmp', '.webp', '.gif']

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const isOcrSupported = (file: File) => {
  const lowerName = file.name.toLowerCase()
  return file.type.startsWith('image/') || OCR_SUPPORTED_EXTENSIONS.some(extension => lowerName.endsWith(extension))
}

const buildUploadFile = (file: File): UploadFile => ({
  uid: `${file.name}-${file.size}-${file.lastModified}`,
  name: file.name,
  status: 'done',
  size: file.size,
  type: file.type,
  originFileObj: file as UploadFile['originFileObj'],
})

const DrawingLibrary: React.FC = () => {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  const [filters, setFilters] = useState<{
    search: string
    document_type?: string
    source_type?: string
    bom_header_id?: number
  }>({ search: '' })
  const [uploadVisible, setUploadVisible] = useState(false)
  const [batchImportVisible, setBatchImportVisible] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<DrawingDocument | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([])
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchFileList, setBatchFileList] = useState<UploadFile[]>([])
  const [batchResult, setBatchResult] = useState<DrawingBatchImportResult | null>(null)

  const [filterForm] = Form.useForm()
  const [uploadForm] = Form.useForm()
  const [batchForm] = Form.useForm()

  useEffect(() => {
    const bomId = Number(searchParams.get('bom_id') || 0)
    if (bomId > 0) {
      setFilters(current => ({ ...current, bom_header_id: bomId }))
      filterForm.setFieldValue('bom_header_id', bomId)
      uploadForm.setFieldValue('bom_header_id', bomId)
      batchForm.setFieldValue('bom_header_id', bomId)
    }
  }, [batchForm, filterForm, searchParams, uploadForm])

  const { data: boms = [] } = useQuery({
    queryKey: ['drawingLibraryBoms'],
    queryFn: () => plmService.getBOMs(),
  })

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['drawingDocuments', filters],
    queryFn: () =>
      drawingDocumentService.listDocuments({
        search: filters.search || undefined,
        document_type: filters.document_type,
        source_type: filters.source_type,
        bom_header_id: filters.bom_header_id,
        limit: 500,
      }),
  })

  const refreshDocuments = async () => {
    await queryClient.invalidateQueries({ queryKey: ['drawingDocuments'] })
    await queryClient.invalidateQueries({ queryKey: ['bomDrawings'] })
    await queryClient.invalidateQueries({ queryKey: ['bomDetail'] })
  }

  const uploadMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!uploadFile) {
        throw new Error('请先选择文件')
      }

      let ocrText = ''
      let ocrStatus = 'NONE'
      if (values.extract_ocr) {
        if (!isOcrSupported(uploadFile)) {
          ocrStatus = 'FAILED'
          message.warning('当前文件类型不支持 OCR，已按普通资料入库')
        } else {
          try {
            const result = await ocrService.recognizeText(uploadFile)
            ocrText = result.text || ''
            ocrStatus = ocrText ? 'PROCESSED' : 'NONE'
          } catch (error: any) {
            ocrStatus = 'FAILED'
            message.warning(error?.response?.data?.detail || error?.message || 'OCR 提取失败，已继续上传文件')
          }
        }
      }

      return drawingDocumentService.uploadDocument(
        {
          document_number: values.document_number,
          document_name: values.document_name,
          document_type: values.document_type,
          source_type: values.source_type,
          status: values.status,
          version: values.version,
          revision: values.revision,
          discipline: values.discipline,
          cad_software: values.cad_software,
          tags: values.tags,
          description: values.description,
          product_code: values.product_code,
          material_code: values.material_code,
          bom_header_id: values.bom_header_id,
          ocr_status: ocrStatus,
          ocr_text: ocrText || undefined,
        },
        uploadFile
      )
    },
    onSuccess: async document => {
      message.success(`资料已入库：${document.document_number}`)
      setUploadVisible(false)
      setUploadFile(null)
      setUploadFileList([])
      uploadForm.resetFields()
      await refreshDocuments()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || error?.message || '上传失败')
    },
  })

  const batchImportMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!batchFiles.length) {
        throw new Error('请先选择 CAD 文档目录')
      }
      return drawingDocumentService.batchImportDocuments(
        {
          source_type: values.source_type,
          status: values.status,
          version: values.version || undefined,
          revision: values.revision || undefined,
          discipline: values.discipline || undefined,
          cad_software: values.cad_software || undefined,
          tags: values.tags || undefined,
          description: values.description || undefined,
          product_code: values.product_code || undefined,
          material_code: values.material_code || undefined,
          bom_header_id: values.bom_header_id || undefined,
          replace_existing: values.replace_existing === true,
        },
        batchFiles
      )
    },
    onSuccess: async result => {
      setBatchResult(result)
      message.success(`目录导入完成：新增 ${result.imported}，替换 ${result.replaced}，跳过 ${result.skipped}`)
      await refreshDocuments()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || error?.message || '目录导入失败')
    },
  })

  const handleFilterChange = () => {
    const values = filterForm.getFieldsValue()
    setFilters({
      search: values.search || '',
      document_type: values.document_type || undefined,
      source_type: values.source_type || undefined,
      bom_header_id: values.bom_header_id || undefined,
    })
  }

  const beforeUpload: UploadProps['beforeUpload'] = file => {
    setUploadFile(file)
    setUploadFileList([buildUploadFile(file)])
    return false
  }

  const beforeBatchUpload: UploadProps['beforeUpload'] = file => {
    const nextUid = `${file.name}-${file.size}-${file.lastModified}`
    setBatchFiles(current => {
      if (current.some(item => `${item.name}-${item.size}-${item.lastModified}` === nextUid)) {
        return current
      }
      return [...current, file]
    })
    setBatchFileList(current => {
      if (current.some(item => item.uid === nextUid)) {
        return current
      }
      return [...current, buildUploadFile(file)]
    })
    return false
  }

  const handleUpload = async () => {
    try {
      const values = await uploadForm.validateFields()
      uploadMutation.mutate(values)
    } catch {
      // handled by form validation
    }
  }

  const handleBatchImport = async () => {
    try {
      const values = await batchForm.validateFields()
      batchImportMutation.mutate(values)
    } catch {
      // handled by form validation
    }
  }

  const bomOptions = boms.map(item => ({
    label: `${item.product_code} / ${item.version} / ${item.bom_type || 'EBOM'}`,
    value: item.id,
  }))

  const columns: ColumnsType<DrawingDocument> = useMemo(
    () => [
      {
        title: '图号/文档号',
        dataIndex: 'document_number',
        width: 180,
        render: (_, row) => <Text strong>{row.document_number}</Text>,
      },
      {
        title: '名称',
        dataIndex: 'document_name',
        ellipsis: true,
      },
      {
        title: '类型',
        dataIndex: 'document_type',
        width: 120,
        render: value => <Tag color="blue">{value}</Tag>,
      },
      {
        title: '版本/版次',
        width: 150,
        render: (_, row) => `${row.version || '-'} / ${row.revision || '-'}`,
      },
      {
        title: '关联物料',
        dataIndex: 'material_code',
        width: 140,
        render: (_, row) => row.material_code || row.material?.code || '-',
      },
      {
        title: '相对路径',
        dataIndex: 'source_relative_path',
        ellipsis: true,
        render: value => value || '-',
      },
      {
        title: '来源',
        dataIndex: 'source_type',
        width: 140,
        render: value => <Tag color={value === 'CAD_DIRECTORY' ? 'gold' : 'default'}>{value}</Tag>,
      },
      {
        title: '更新时间',
        dataIndex: 'updated_at',
        width: 180,
        render: value => formatDateTime(value),
      },
      {
        title: '操作',
        key: 'actions',
        width: 160,
        fixed: 'right',
        render: (_, row) => (
          <Space>
            <Button size="small" icon={<EyeOutlined />} onClick={() => setSelectedDocument(row)}>
              查看
            </Button>
            <Button size="small" icon={<DownloadOutlined />} onClick={() => drawingDocumentService.downloadDocument(row)}>
              下载
            </Button>
          </Space>
        ),
      },
    ],
    []
  )

  return (
    <div style={{ padding: 24, minHeight: 'calc(100vh - 64px)', background: '#f5f7fa' }}>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  图纸资料库
                </Title>
                <Text type="secondary">
                  统一管理 CAD、SolidWorks、PDF 与 OCR 资料，并建立与 BOM 的查询、下载和映射关系。
                </Text>
              </div>
              <Space wrap>
                <Button icon={<UploadOutlined />} onClick={() => setBatchImportVisible(true)}>
                  批量导入 CAD 目录
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setUploadVisible(true)}>
                  新增图纸资料
                </Button>
              </Space>
            </div>

            <Form form={filterForm} layout="inline" onValuesChange={handleFilterChange}>
              <Form.Item name="search">
                <Input allowClear placeholder="搜索图号、名称、物料编码、目录路径" style={{ width: 320 }} />
              </Form.Item>
              <Form.Item name="document_type">
                <Select allowClear placeholder="文档类型" options={DOCUMENT_TYPE_OPTIONS} style={{ width: 140 }} />
              </Form.Item>
              <Form.Item name="source_type">
                <Select allowClear placeholder="来源方式" options={SOURCE_TYPE_OPTIONS} style={{ width: 180 }} />
              </Form.Item>
              <Form.Item name="bom_header_id">
                <Select allowClear showSearch placeholder="按 BOM 筛选" options={bomOptions} style={{ width: 280 }} />
              </Form.Item>
            </Form>

            <Space wrap>
              <Statistic title="资料总数" value={documents.length} />
              <Statistic title="已做 OCR" value={documents.filter(item => item.ocr_status === 'PROCESSED').length} />
              <Statistic title="已关联 BOM" value={documents.filter(item => !!item.bom_header_id).length} />
              <Statistic title="目录导入" value={documents.filter(item => item.source_type === 'CAD_DIRECTORY').length} />
            </Space>
          </Space>
        </Card>

        <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <Table
            rowKey="id"
            loading={isLoading}
            dataSource={documents}
            columns={columns}
            scroll={{ x: 1400 }}
            locale={{ emptyText: <Empty description="暂无图纸资料" /> }}
          />
        </Card>
      </Space>

      <Modal
        title="新增图纸资料"
        open={uploadVisible}
        onCancel={() => {
          setUploadVisible(false)
          setUploadFile(null)
          setUploadFileList([])
          uploadForm.resetFields()
        }}
        onOk={handleUpload}
        okText="入库"
        confirmLoading={uploadMutation.isPending}
        width={860}
      >
        <Form
          form={uploadForm}
          layout="vertical"
          initialValues={{
            document_type: 'SOLIDWORKS',
            source_type: 'DESIGN_DOC',
            status: 'RELEASED',
            extract_ocr: true,
            bom_header_id: filters.bom_header_id,
          }}
        >
          <Space wrap style={{ width: '100%' }} size={12}>
            <Form.Item name="document_number" label="图号/文档号" rules={[{ required: true, message: '请输入图号或文档号' }]}>
              <Input style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="document_name" label="资料名称" rules={[{ required: true, message: '请输入资料名称' }]}>
              <Input style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="document_type" label="文档类型">
              <Select style={{ width: 140 }} options={DOCUMENT_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item name="source_type" label="来源方式">
              <Select style={{ width: 160 }} options={SOURCE_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select style={{ width: 140 }} options={STATUS_OPTIONS} />
            </Form.Item>
          </Space>

          <Space wrap style={{ width: '100%' }} size={12}>
            <Form.Item name="version" label="版本">
              <Input style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="revision" label="版次">
              <Input style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="discipline" label="专业">
              <Input style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="cad_software" label="软件">
              <Input style={{ width: 160 }} placeholder="SolidWorks / AutoCAD" />
            </Form.Item>
            <Form.Item name="tags" label="标签">
              <Input style={{ width: 220 }} placeholder="逗号分隔" />
            </Form.Item>
          </Space>

          <Space wrap style={{ width: '100%' }} size={12}>
            <Form.Item name="material_code" label="关联物料编码">
              <Input style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="product_code" label="关联产品编码">
              <Input style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="bom_header_id" label="关联 BOM 版本">
              <Select allowClear showSearch options={bomOptions} style={{ width: 280 }} />
            </Form.Item>
            <Form.Item name="extract_ocr" label="上传时提取 OCR">
              <Select
                style={{ width: 140 }}
                options={[
                  { label: '是', value: true },
                  { label: '否', value: false },
                ]}
              />
            </Form.Item>
          </Space>

          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item label="资料文件" required>
            <Upload
              beforeUpload={beforeUpload}
              onRemove={() => {
                setUploadFile(null)
                setUploadFileList([])
              }}
              fileList={uploadFileList}
              maxCount={1}
              accept=".pdf,.dwg,.dxf,.sldasm,.sldprt,.slddrw,.step,.stp,.igs,.iges,.png,.jpg,.jpeg,.bmp,.webp,.gif"
            >
              <Button icon={<FileSearchOutlined />}>选择文件</Button>
            </Upload>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                支持 CAD、SolidWorks、PDF、DXF、STEP 及图片文件。图片/PDF 可在上传时同步提取 OCR 文本。
              </Text>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量导入 CAD 文档目录"
        open={batchImportVisible}
        onCancel={() => {
          setBatchImportVisible(false)
          setBatchFiles([])
          setBatchFileList([])
          setBatchResult(null)
          batchForm.resetFields()
        }}
        onOk={handleBatchImport}
        okText="开始导入"
        confirmLoading={batchImportMutation.isPending}
        width={980}
      >
        <Form
          form={batchForm}
          layout="vertical"
          initialValues={{
            source_type: 'CAD_DIRECTORY',
            status: 'RELEASED',
            replace_existing: false,
            bom_header_id: filters.bom_header_id,
          }}
        >
          <Space wrap style={{ width: '100%' }} size={12}>
            <Form.Item name="source_type" label="来源方式">
              <Select style={{ width: 180 }} options={SOURCE_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select style={{ width: 140 }} options={STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item name="replace_existing" label="同版本替换">
              <Select
                style={{ width: 160 }}
                options={[
                  { label: '否', value: false },
                  { label: '是', value: true },
                ]}
              />
            </Form.Item>
            <Form.Item name="bom_header_id" label="关联 BOM 版本">
              <Select allowClear showSearch options={bomOptions} style={{ width: 280 }} />
            </Form.Item>
          </Space>

          <Space wrap style={{ width: '100%' }} size={12}>
            <Form.Item name="version" label="统一版本">
              <Input style={{ width: 140 }} placeholder="留空则按文件名推断" />
            </Form.Item>
            <Form.Item name="revision" label="统一版次">
              <Input style={{ width: 140 }} placeholder="留空则按文件名推断" />
            </Form.Item>
            <Form.Item name="discipline" label="专业">
              <Input style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="cad_software" label="软件">
              <Input style={{ width: 180 }} placeholder="留空则按扩展名推断" />
            </Form.Item>
            <Form.Item name="tags" label="标签">
              <Input style={{ width: 200 }} />
            </Form.Item>
          </Space>

          <Space wrap style={{ width: '100%' }} size={12}>
            <Form.Item name="material_code" label="默认关联物料">
              <Input style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="product_code" label="默认关联产品">
              <Input style={{ width: 180 }} />
            </Form.Item>
          </Space>

          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item label="CAD 文档目录" required>
            <Upload
              directory
              multiple
              beforeUpload={beforeBatchUpload}
              onRemove={file => {
                setBatchFileList(current => current.filter(item => item.uid !== file.uid))
                setBatchFiles(current =>
                  current.filter(item => `${item.name}-${item.size}-${item.lastModified}` !== String(file.uid))
                )
              }}
              fileList={batchFileList}
              accept=".pdf,.dwg,.dxf,.sldasm,.sldprt,.slddrw,.step,.stp,.igs,.iges"
            >
              <Button icon={<FileSearchOutlined />}>选择目录</Button>
            </Upload>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                系统会保留目录相对路径，并按图号 + 文档类型 + 版本/版次执行重复与替换校验。
              </Text>
            </div>
          </Form.Item>
        </Form>

        {batchResult ? (
          <Card size="small" title="导入结果" style={{ marginTop: 12 }}>
            <Space wrap style={{ marginBottom: 12 }}>
              <Statistic title="总文件数" value={batchResult.total} />
              <Statistic title="新增" value={batchResult.imported} />
              <Statistic title="替换" value={batchResult.replaced} />
              <Statistic title="跳过" value={batchResult.skipped} />
            </Space>
            <Table
              rowKey={record => `${record.file_name}-${record.relative_path || ''}`}
              size="small"
              pagination={{ pageSize: 6 }}
              dataSource={batchResult.results}
              columns={[
                { title: '文件', dataIndex: 'file_name', width: 180 },
                {
                  title: '相对路径',
                  dataIndex: 'relative_path',
                  ellipsis: true,
                  render: value => value || '-',
                },
                {
                  title: '图号',
                  dataIndex: 'document_number',
                  width: 160,
                  render: value => value || '-',
                },
                {
                  title: '动作',
                  dataIndex: 'action',
                  width: 100,
                  render: value => (
                    <Tag color={value === 'imported' ? 'green' : value === 'replaced' ? 'gold' : 'default'}>{value}</Tag>
                  ),
                },
                {
                  title: '校验',
                  dataIndex: 'validation_status',
                  width: 110,
                  render: value => (
                    <Tag color={value === 'VALID' ? 'green' : value === 'WARNING' ? 'orange' : value === 'ERROR' ? 'red' : 'default'}>
                      {value}
                    </Tag>
                  ),
                },
                { title: '说明', dataIndex: 'message', ellipsis: true },
              ]}
            />
          </Card>
        ) : null}
      </Modal>

      <Drawer
        title={selectedDocument ? `${selectedDocument.document_number} - ${selectedDocument.document_name}` : '资料详情'}
        open={!!selectedDocument}
        width={720}
        onClose={() => setSelectedDocument(null)}
        extra={
          selectedDocument ? (
            <Button icon={<DownloadOutlined />} onClick={() => drawingDocumentService.downloadDocument(selectedDocument)}>
              下载文件
            </Button>
          ) : null
        }
      >
        {selectedDocument ? (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="文档类型">{selectedDocument.document_type}</Descriptions.Item>
              <Descriptions.Item label="来源方式">{selectedDocument.source_type}</Descriptions.Item>
              <Descriptions.Item label="版本/版次">{`${selectedDocument.version || '-'} / ${selectedDocument.revision || '-'}`}</Descriptions.Item>
              <Descriptions.Item label="软件">{selectedDocument.cad_software || '-'}</Descriptions.Item>
              <Descriptions.Item label="关联物料">{selectedDocument.material_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="关联产品">{selectedDocument.product_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="关联 BOM">
                {selectedDocument.bom_header
                  ? `${selectedDocument.bom_header.product_code} / ${selectedDocument.bom_header.version} / ${selectedDocument.bom_header.bom_type || 'EBOM'}`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="OCR 状态">{selectedDocument.ocr_status || 'NONE'}</Descriptions.Item>
              <Descriptions.Item label="上传人">{selectedDocument.uploader_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatDateTime(selectedDocument.updated_at)}</Descriptions.Item>
              <Descriptions.Item label="目录相对路径" span={2}>
                {selectedDocument.source_relative_path || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="文件名" span={2}>
                {selectedDocument.file_name} ({formatFileSize(selectedDocument.file_size)})
              </Descriptions.Item>
              <Descriptions.Item label="说明" span={2}>
                {selectedDocument.description || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title={<Space><ScanOutlined /> OCR 文本</Space>}>
              {selectedDocument.ocr_text ? (
                <Paragraph copyable style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                  {selectedDocument.ocr_text}
                </Paragraph>
              ) : (
                <Empty description="暂无 OCR 文本" />
              )}
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </div>
  )
}

export default DrawingLibrary
