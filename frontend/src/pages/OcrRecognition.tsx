import React, { useState } from 'react'
import {
  Card,
  Upload,
  Button,
  Select,
  Space,
  message,
  Typography,
  Table,
  Segmented,
  Spin,
  Image,
  Row,
  Col,
  Statistic,
  Switch,
  Alert,
  Dropdown,
} from 'antd'
import type { UploadFile, UploadProps } from 'antd'
import {
  CopyOutlined,
  DownloadOutlined,
  FileImageOutlined,
  BarcodeOutlined,
  TableOutlined,
} from '@ant-design/icons'
import {
  ocrService,
  type OcrTextBlock,
  type OcrLang,
  type OcrBorderedTableResponse,
  type OcrPdfExtractResponse,
} from '../services/ocrService'
import { compressImage, MAX_FILE_SIZE_MB } from '../utils/imageCompress'

const { Text } = Typography

// 将识别块按 Y 坐标分组为行（表格模式）
function groupBlocksToRows(blocks: OcrTextBlock[], rowThreshold = 20): string[][] {
  if (blocks.length === 0) return []
  const sorted = [...blocks].sort((a, b) => {
    const ay = a.box[0]?.[1] ?? 0
    const by = b.box[0]?.[1] ?? 0
    return ay - by
  })
  const rows: OcrTextBlock[][] = []
  let currentRow: OcrTextBlock[] = [sorted[0]]
  let currentY = sorted[0].box[0]?.[1] ?? 0

  for (let i = 1; i < sorted.length; i++) {
    const b = sorted[i]
    const y = b.box[0]?.[1] ?? 0
    if (Math.abs(y - currentY) <= rowThreshold) {
      currentRow.push(b)
    } else {
      currentRow.sort((a, b) => (a.box[0]?.[0] ?? 0) - (b.box[0]?.[0] ?? 0))
      rows.push(currentRow)
      currentRow = [b]
      currentY = y
    }
  }
  if (currentRow.length) {
    currentRow.sort((a, b) => (a.box[0]?.[0] ?? 0) - (b.box[0]?.[0] ?? 0))
    rows.push(currentRow)
  }

  const maxCols = Math.max(...rows.map((r) => r.length))
  return rows.map((r) => {
    const cells = r.map((c) => c.text)
    while (cells.length < maxCols) cells.push('')
    return cells
  })
}

type OcrMode = 'text' | 'table' | 'pdf-extract'

const OcrRecognition: React.FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ocrMode, setOcrMode] = useState<OcrMode>('text')
  const [result, setResult] = useState<{
    blocks: OcrTextBlock[]
    fullText: string
  } | null>(null)
  const [borderedResult, setBorderedResult] = useState<OcrBorderedTableResponse | null>(null)
  const [pdfExtractResult, setPdfExtractResult] = useState<OcrPdfExtractResponse | null>(null)
  const [lang, setLang] = useState<OcrLang>('ch')
  const [enableNoiseCheck, setEnableNoiseCheck] = useState(true)
  const [viewMode, setViewMode] = useState<'text' | 'table' | 'blocks' | 'paragraph'>('text')

  const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
  const maxSizeMb = (f: File) => (isPdf(f) ? 20 : MAX_FILE_SIZE_MB)

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    const maxMb = maxSizeMb(file)
    if (file.size > maxMb * 1024 * 1024) {
      message.error(`文件不得超过 ${maxMb}MB`)
      return Upload.LIST_IGNORE
    }
    const isImage = /^image\/(jpeg|png|bmp|gif|webp)$/i.test(file.type)
    if (!isImage && !isPdf(file)) {
      message.error('仅支持图片 (jpg/png/bmp/gif/webp) 或 PDF')
      return Upload.LIST_IGNORE
    }
    if (ocrMode === 'pdf-extract' && !isPdf(file)) {
      message.error('PDF 提取模式仅支持 PDF 文件')
      return Upload.LIST_IGNORE
    }
    setFileList([{ uid: '-1', name: file.name, status: 'done', originFileObj: file }])
    setPreviewUrl(isImage ? URL.createObjectURL(file) : null)
    setResult(null)
    setBorderedResult(null)
    setPdfExtractResult(null)
    return false
  }

  const handleRemove = () => {
    setFileList([])
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setResult(null)
    setBorderedResult(null)
    setPdfExtractResult(null)
  }

  const handleRecognize = async () => {
    const file = fileList[0]?.originFileObj
    if (!file) {
      message.warning('请先选择图片或 PDF')
      return
    }
    setLoading(true)
    setResult(null)
    setBorderedResult(null)
    setPdfExtractResult(null)
    try {
      const isPdfFile = isPdf(file)
      let fileToSend: File
      if (isPdfFile) {
        fileToSend = file
      } else {
        const compressed = await compressImage(file)
        fileToSend = new File(
          [compressed.blob],
          file.name.replace(/\.[^.]+$/, '.jpg'),
          { type: 'image/jpeg' }
        )
      }
      if (ocrMode === 'pdf-extract') {
        const data = await ocrService.recognizePdfExtract(fileToSend)
        setPdfExtractResult(data)
        if (data.scanned_or_empty) {
          message.warning('提取内容较少，可能是扫描版 PDF，建议改用上方 OCR 模式并重新上传')
        } else {
          message.success(`PDF 提取完成，共 ${data.page_count} 页`)
        }
      } else if (ocrMode === 'table') {
        const data = await ocrService.recognizeBorderedTable(fileToSend, lang)
        setBorderedResult(data)
        message.success(
          data.grid_detected
            ? `表格识别完成，检测到 ${data.merges.length} 处合并单元格`
            : '表格识别完成（按行分组）'
        )
      } else {
        const data = await ocrService.recognize(fileToSend, lang, 'mobile', enableNoiseCheck)
        setResult({
          blocks: data.blocks,
          fullText: data.full_text,
        })
        message.success('识别完成 (高精度)')
      }
    } catch (err: any) {
      const d = err.response?.data?.detail
      const msg =
        typeof d === 'string'
          ? d
          : Array.isArray(d)
            ? d.map((e: any) => e?.msg || e?.message || JSON.stringify(e)).join('; ')
            : d?.msg || err.message || '识别失败'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    const text = borderedResult
      ? borderedResult.markdown
      : pdfExtractResult
        ? pdfExtractResult.markdown
        : result
            ? viewMode === 'table'
              ? groupBlocksToRows(result.blocks)
                  .map((row) => row.join('\t'))
                  .join('\n')
              : result.fullText
            : ''
    if (!text) return
    navigator.clipboard.writeText(text).then(
      () => message.success('已复制到剪贴板'),
      () => message.error('复制失败')
    )
  }

  const handleDownload = (format: 'txt' | 'csv' | 'md') => {
    let content: string
    let filename: string
    const tablesSource = borderedResult ?? pdfExtractResult ?? null
    if (tablesSource) {
      if (format === 'md') {
        content = tablesSource.markdown
        filename = `ocr_table_${Date.now()}.md`
      } else if (format === 'csv' && tablesSource.tables.length > 0) {
        // 导出所有表格（分页导致的多表），表格间用空行分隔
        content = tablesSource.tables
          .map((tbl) =>
            tbl
              .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
              .join('\n')
          )
          .join('\n\n')
        filename = `ocr_table_${Date.now()}.csv`
      } else {
        content = tablesSource.markdown
        filename = `ocr_table_${Date.now()}.txt`
      }
    } else if (result) {
      if (format === 'txt') {
        content = result.fullText
        filename = `ocr_${Date.now()}.txt`
      } else {
        const rows = groupBlocksToRows(result.blocks)
        content = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
        filename = `ocr_${Date.now()}.csv`
      }
    } else return
    const blob = new Blob(['\uFEFF' + content], {
      type: format === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
    message.success('下载成功')
  }

  const handleDownloadXlsx = async (flatten: boolean) => {
    const tablesSource = borderedResult ?? pdfExtractResult
    if (!tablesSource?.tables?.length) {
      message.warning('暂无表格数据可导出')
      return
    }
    try {
      const merges: number[][] = 'merges' in tablesSource && Array.isArray(tablesSource.merges) ? tablesSource.merges : []
      const blob = await ocrService.exportBorderedTableXlsx(tablesSource.tables, merges, flatten)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ocr_table_${Date.now()}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      message.success(flatten ? 'XLSX（扁平）下载成功' : 'XLSX 下载成功')
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.message || '导出 XLSX 失败')
    }
  }

  const handleDownloadDocx = async () => {
    const tablesSource = borderedResult ?? pdfExtractResult
    const markdown = tablesSource?.markdown ?? result?.fullText ?? ''
    const tables = tablesSource?.tables ?? []
    if (!markdown && !tables.length) {
      message.warning('暂无内容可导出')
      return
    }
    try {
      const blob = await ocrService.exportDocx(markdown, tables)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ocr_result_${Date.now()}.docx`
      a.click()
      URL.revokeObjectURL(url)
      message.success('Word 下载成功')
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.message || '导出 Word 失败')
    }
  }

  const tableRows = result ? groupBlocksToRows(result.blocks) : []
  const structureTables = borderedResult?.tables ?? pdfExtractResult?.tables ?? []
  const hasResult = !!result || !!borderedResult || !!pdfExtractResult
  const tableColumns =
    tableRows.length > 0
      ? Array.from({ length: Math.max(...tableRows.map((r) => r.length)) }, (_, i) => ({
          title: `列${i + 1}`,
          dataIndex: i,
          key: String(i),
          ellipsis: true,
        }))
      : []

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>


      <Row gutter={24}>
        <Col xs={24} lg={10}>
          <Card title="配置与上传" size="small">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Upload.Dragger
                fileList={fileList}
                beforeUpload={beforeUpload}
                onRemove={handleRemove}
                maxCount={1}
                accept={ocrMode === 'pdf-extract' ? '.pdf' : '.jpg,.jpeg,.png,.bmp,.gif,.webp,.pdf'}
                showUploadList={{ showPreviewIcon: false }}
              >
                <p className="ant-upload-drag-icon">
                  <FileImageOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                </p>
                <p className="ant-upload-text">点击或拖拽图片或 PDF 到此处</p>
                <p className="ant-upload-hint">
                  支持 jpg/png/bmp/gif/webp（最大 {MAX_FILE_SIZE_MB}MB）、PDF（最大 20MB）；PDF 将优先提取文本与表格。
                </p>
              </Upload.Dragger>

              {previewUrl && (
                <div style={{ textAlign: 'center' }}>
                  <Image
                    src={previewUrl}
                    alt="预览"
                    style={{ maxHeight: 200, objectFit: 'contain', borderRadius: 4 }}
                  />
                </div>
              )}

              <div style={{ padding: '0 8px' }}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>1. 选择识别模式 </Text>
                  <Select
                    value={ocrMode}
                    onChange={setOcrMode}
                    options={[
                      { label: '通用文字识别', value: 'text' },
                      { label: 'PDF 提取 (仅电子版)', value: 'pdf-extract' },
                      { label: '表格识别', value: 'table' },
                    ]}
                    style={{ width: '100%', marginTop: 8 }}
                  />
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4, fontSize: 13, color: '#666' }}>
                    {ocrMode === 'text'
                      ? '适用：纯文本、照片、截图；支持图片或 PDF（PDF 转图后 OCR）。'
                      : ocrMode === 'pdf-extract'
                        ? '仅电子版 PDF：直接抓取文本与表格，不做 OCR。扫描版请用「通用文字识别」或「表格识别」。'
                        : '适用：表格、报表、规格表；先检测网格线，若无框线则按行分组；支持图片或 PDF。'}
                  </div>
                </div>

                {(ocrMode === 'text' || ocrMode === 'table') && (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Text strong>2. 识别语言</Text>
                      <Select
                        value={lang}
                        onChange={setLang}
                        options={[
                          { label: '中英 (通用)', value: 'ch' },
                          { label: '纯英文', value: 'en' },
                          { label: '俄文 (西里尔)', value: 'ru' },
                          { label: '英俄', value: 'en_ru' },
                          { label: '中俄', value: 'ch_ru' },
                        ]}
                        style={{ width: '100%', marginTop: 8 }}
                      />
                    </Col>
                    <Col span={12}>
                      <Text strong>3. 噪点检查</Text>
                      <div style={{ marginTop: 8 }}>
                        <Switch
                          checked={enableNoiseCheck}
                          onChange={setEnableNoiseCheck}
                          checkedChildren="启用"
                          unCheckedChildren="关闭"
                        />
                        <span style={{ marginLeft: 8, fontSize: 13, color: '#666' }}>
                          移除箭头、格式符号等
                        </span>
                      </div>
                    </Col>
                  </Row>
                )}
                
                <Button
                  type="primary"
                  size="large"
                  block
                  icon={
                    ocrMode === 'table' ? <TableOutlined /> : <BarcodeOutlined />
                  }
                  onClick={handleRecognize}
                  loading={loading}
                  disabled={!fileList.length || (ocrMode === 'pdf-extract' && fileList[0] && !isPdf(fileList[0].originFileObj as File))}
                  style={{ marginTop: 24 }}
                >
                  {ocrMode === 'pdf-extract'
                    ? '提取 PDF'
                    : ocrMode === 'table'
                      ? '识别表格'
                      : '开始 OCR 识别'}
                </Button>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title="识别结果"
            size="small"
            extra={
              hasResult && (
                <Space wrap>
                  {result && (
                    <Segmented
                      value={viewMode}
                      onChange={(v) => setViewMode(v as typeof viewMode)}
                      options={[
                        { label: '纯文本', value: 'text' },
                        { label: '段落', value: 'paragraph' },
                        { label: '表格', value: 'table' },
                        { label: '块列表', value: 'blocks' },
                      ]}
                    />
                  )}
                  <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>
                    复制
                  </Button>
                  {(borderedResult || pdfExtractResult) && (
                    <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload('md')}>
                      MD
                    </Button>
                  )}
                  <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload('txt')}>
                    TXT
                  </Button>
                  <Button size="small" icon={<TableOutlined />} onClick={() => handleDownload('csv')}>
                    CSV
                  </Button>
                  {(borderedResult || pdfExtractResult) && (
                    <Dropdown
                      menu={{
                        items: [
                          { key: 'merge', label: 'XLSX（含合并）', onClick: () => handleDownloadXlsx(false) },
                          { key: 'flat', label: 'XLSX（扁平，无合并）', onClick: () => handleDownloadXlsx(true) },
                        ],
                      }}
                      trigger={['click']}
                    >
                      <Button size="small" type="primary" icon={<DownloadOutlined />}>
                        XLSX
                      </Button>
                    </Dropdown>
                  )}
                  {hasResult && (
                    <Button size="small" icon={<DownloadOutlined />} onClick={handleDownloadDocx}>
                      Word
                    </Button>
                  )}
                </Space>
              )
            }
          >
            {loading && (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <Spin size="large" tip="深度解析中，请稍候..." />
              </div>
            )}

            {!loading && (borderedResult || pdfExtractResult) && (
              <div style={{ maxHeight: 600, overflow: 'auto' }}>
                {pdfExtractResult?.scanned_or_empty && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="可能是扫描版 PDF"
                    description="未提取到足够内容。请改用「通用文字识别」或「带边框表格」并重新上传同一 PDF，系统将自动转成图像后 OCR。"
                  />
                )}
                {pdfExtractResult && !pdfExtractResult.scanned_or_empty && (
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary">PDF 提取，共 {pdfExtractResult.page_count} 页</Text>
                  </div>
                )}
                {borderedResult && (
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary">
                      {borderedResult.grid_detected
                        ? `已检测网格，合并单元格 ${borderedResult.merges.length} 处`
                        : '未检测到清晰网格，已按行分组'}
                    </Text>
                  </div>
                )}
                {structureTables.length > 0 ? (
                  structureTables.map((tbl, idx) => {
                    const cols =
                      tbl.length > 0
                        ? Array.from(
                            { length: Math.max(...tbl.map((r) => r.length)) },
                            (_, i) => ({
                              title: `列${i + 1}`,
                              dataIndex: i,
                              key: String(i),
                              ellipsis: true,
                            })
                          )
                        : []
                    const rowData = tbl.map((r, i) => {
                      const row: Record<string, unknown> = { key: i }
                      r.forEach((cell, j) => { row[j] = cell })
                      return row
                    })
                    return (
                      <div key={idx} style={{ marginBottom: structureTables.length > 1 ? 24 : 0 }}>
                        {structureTables.length > 1 && (
                          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
                            <TableOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                            <Text strong>识别到的表格 {idx + 1}</Text>
                          </div>
                        )}
                        <Table
                          dataSource={rowData}
                          columns={cols}
                          pagination={false}
                          size="small"
                          scroll={{ x: 'max-content' }}
                        />
                      </div>
                    )
                  })
                ) : (
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      margin: 0,
                      fontFamily: 'inherit',
                      fontSize: 14,
                      padding: 12,
                      background: '#fafafa',
                      borderRadius: 4
                    }}
                  >
                    {(borderedResult?.markdown ?? pdfExtractResult?.markdown) || '（未识别到内容）'}
                  </pre>
                )}
              </div>
            )}

            {!loading && result && (
              <div style={{ maxHeight: 600, overflow: 'auto' }}>
                {viewMode === 'text' && (
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      margin: 0,
                      fontFamily: 'inherit',
                      fontSize: 14,
                      padding: 12,
                      background: '#fafafa',
                      borderRadius: 4
                    }}
                  >
                    {result.fullText || '（未识别到文字）'}
                  </pre>
                )}

                {viewMode === 'paragraph' && (
                  <div style={{ padding: 12, background: '#fafafa', borderRadius: 4 }}>
                    {(result.fullText || '')
                      .split(/\n\n+/)
                      .filter((p) => p.trim())
                      .map((para, idx) => (
                        <p
                          key={idx}
                          style={{
                            margin: '0 0 1em 0',
                            fontSize: 14,
                            lineHeight: 1.6,
                            wordBreak: 'break-word'
                          }}
                        >
                          {para.trim()}
                        </p>
                      ))}
                    {(!result.fullText || !result.fullText.trim()) && (
                      <span style={{ color: '#999' }}>（未识别到文字）</span>
                    )}
                  </div>
                )}

                {viewMode === 'table' && (
                  <Table
                    dataSource={tableRows.map((r, i) => ({ key: i, ...r }))}
                    columns={tableColumns}
                    pagination={false}
                    size="small"
                    scroll={{ x: 'max-content' }}
                  />
                )}

                {viewMode === 'blocks' && (
                  <Table
                    dataSource={result.blocks.map((b, i) => ({
                      key: i,
                      text: b.text,
                      confidence: (b.confidence * 100).toFixed(1) + '%',
                    }))}
                    columns={[
                      { title: '序号', dataIndex: 'key', width: 60, render: (k: number) => k + 1 },
                      { title: '文本', dataIndex: 'text', ellipsis: true },
                      { title: '置信度', dataIndex: 'confidence', width: 90 },
                    ]}
                    pagination={false}
                    size="small"
                  />
                )}
              </div>
            )}

            {!loading && !hasResult && (
              <div
                style={{
                  textAlign: 'center',
                  padding: 80,
                  color: '#999',
                  background: '#fafafa',
                  borderRadius: 8,
                  border: '1px dashed #d9d9d9'
                }}
              >
                <div style={{ marginBottom: 16 }}><BarcodeOutlined style={{ fontSize: 32 }} /></div>
                上传图片
              </div>
            )}
          </Card>

          {hasResult && (
            <div style={{ marginTop: 16 }}>
              {result && (
                <Statistic title="识别文本块" value={result.blocks.length} suffix="个" />
              )}
              {(borderedResult || pdfExtractResult) && (
                <Statistic
                  title="解析表格"
                  value={(borderedResult?.tables ?? pdfExtractResult?.tables)?.length ?? 0}
                  suffix="个"
                />
              )}
              {borderedResult?.grid_detected && borderedResult.merges.length > 0 && (
                <Statistic
                  title="合并单元格"
                  value={borderedResult.merges.length}
                  suffix="处"
                  style={{ marginLeft: 24 }}
                />
              )}
            </div>
          )}
        </Col>
      </Row>
    </div>
  )
}

export default OcrRecognition
