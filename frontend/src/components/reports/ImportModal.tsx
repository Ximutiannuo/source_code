import { Modal, Upload, Button, App, Alert } from 'antd'
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { handleUnifiedExport } from '../../utils/exportUtils'
import { importService } from '../../services/importService'
import ImportResultModal from './ImportResultModal'
import type { UploadFile } from 'antd'

interface ImportModalProps {
  visible: boolean
  type: 'mpdb' | 'vfactdb'
  onCancel: () => void
  onSuccess: () => void
}

const ImportModal = ({ visible, type, onCancel, onSuccess }: ImportModalProps) => {
  const { message } = App.useApp()
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [showResultModal, setShowResultModal] = useState(false)

  const [exporting, setExporting] = useState(false)

  const handleDownloadTemplate = async () => {
    handleUnifiedExport(
      type,
      { template_type: 'add_template' },
      message,
      setExporting,
      `${type.toUpperCase()}_Import_Template`
    )
  }

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择要上传的文件')
      return
    }

    const file = fileList[0].originFileObj
    if (!file) {
      message.warning('文件无效')
      return
    }

    setUploading(true)
    setResult(null)

    try {
      let response
      if (type === 'mpdb') {
        response = await importService.importMPDB(file)
      } else {
        response = await importService.importVFACTDB(file)
      }

      setResult(response)
      setShowResultModal(true)

      if (response.success && response.imported_count > 0) {
        if (response.error_count === 0) {
          message.success(`导入成功！共 ${response.imported_count} 条记录`)
        } else {
          message.warning(`导入完成：成功 ${response.imported_count} 条，失败 ${response.error_count} 条`)
        }
        // 这里不要立即 onSuccess()，因为 onSuccess 会导致父窗口关闭
        // 我们让 ImportResultModal 的 onClose 来处理后续逻辑
      }
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '导入失败')
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = () => {
    setFileList([])
    setResult(null)
    onCancel()
  }

  return (
    <Modal
      title={`批量导入${type === 'mpdb' ? '人力日报' : '工程量日报'}`}
      open={visible}
      onCancel={handleCancel}
      width={600}
      footer={[
        <Button key="template" icon={<DownloadOutlined />} loading={exporting} onClick={handleDownloadTemplate}>
          下载模板
        </Button>,
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button key="upload" type="primary" loading={uploading} onClick={handleUpload}>
          开始导入
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Alert
          message="导入说明"
          description={
            <div>
              <p>1. 请先下载模板文件，按照模板格式填写数据</p>
              <p>2. 支持 .xlsx 格式的 Excel 文件</p>
              <p>3. 第一行必须是表头，数据从第二行开始</p>
              <p>4. 日期格式：YYYY-MM-DD（例如：2024-01-15）</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      </div>

      <Upload
        fileList={fileList}
        beforeUpload={() => false}
        onChange={({ fileList }) => setFileList(fileList)}
        accept=".xlsx,.xls"
        maxCount={1}
      >
        <Button icon={<UploadOutlined />}>选择Excel文件</Button>
      </Upload>

      <ImportResultModal
        visible={showResultModal}
        onClose={() => {
          setShowResultModal(false)
          if (result?.success && result?.imported_count > 0) {
            // 延时一点关闭，防止 Modal 嵌套关闭冲突
            setTimeout(() => {
              onSuccess()
              if (result?.error_count === 0) {
                handleCancel()
              }
            }, 100)
          }
        }}
        result={result}
        title={`批量导入${type === 'mpdb' ? '人力日报' : '工程量日报'}结果`}
      />
    </Modal>
  )
}

export default ImportModal

