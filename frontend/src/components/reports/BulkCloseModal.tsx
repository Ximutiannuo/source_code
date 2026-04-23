import { useState, useRef, useEffect } from 'react'
import { Modal, Button, Steps, Upload, Table, Typography, Space, App, Tabs, Tag, Progress } from 'antd'
import { DownloadOutlined, UploadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { activityService } from '../../services/activityService'
import dayjs from 'dayjs'

const { Step } = Steps
const { Text } = Typography

interface BulkCloseModalProps {
  visible: boolean
  onCancel: () => void
  onSuccess: () => void
  filters: any
}

const BulkCloseModal = ({ visible, onCancel, onSuccess, filters }: BulkCloseModalProps) => {
  const { message: messageApi } = App.useApp()
  const [currentStep, setCurrentStep] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<any>(null)
  
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current)
    }
  }, [])

  const handleExport = async () => {
    setExporting(true)
    setExportProgress(0)
    try {
      const { task_id } = await activityService.exportBulkCloseActivities({ filters })
      
      messageApi.info('导出任务已提交，后台处理中...')

      pollingTimerRef.current = setInterval(async () => {
        try {
          const statusData = await activityService.getBulkCloseExportStatus(task_id)
          
          if (statusData.status === 'completed') {
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current)
            
            const blob = await activityService.downloadBulkCloseExportFile(task_id)
            const url = window.URL.createObjectURL(new Blob([blob]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `BulkClose_Template_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
            
            messageApi.success('导出成功，请在 Excel 中检查可关闭状态')
            setExporting(false)
            setCurrentStep(1)
          } else if (statusData.status === 'failed') {
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current)
            messageApi.error(`导出失败: ${statusData.error || '未知错误'}`)
            setExporting(false)
          } else {
            // 更新进度（如果有的话）
            if (statusData.progress) {
              setExportProgress(statusData.progress)
            }
          }
        } catch (pollError) {
          console.error('Polling error:', pollError)
        }
      }, 3000)

    } catch (error) {
      console.error('Export failed:', error)
      messageApi.error('导出失败')
      setExporting(false)
    }
  }

  const handleImport = async (file: File) => {
    setImporting(true)
    try {
      const data = await activityService.importBulkCloseActivities(file)
      setResults(data)
      setCurrentStep(2)
      if (data.success_count > 0) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Import failed:', error)
      messageApi.error(error?.response?.data?.detail || '导入失败')
    } finally {
      setImporting(false)
    }
    return false // Prevent auto upload
  }

  const reset = () => {
    setCurrentStep(0)
    setResults(null)
  }

  const handleClose = () => {
    reset()
    onCancel()
  }

  return (
    <Modal
      title="批量关闭作业"
      open={visible}
      onCancel={handleClose}
      footer={[
        currentStep === 2 && (
          <Button key="reset" onClick={reset}>再次导入</Button>
        ),
        <Button key="close" type="primary" onClick={handleClose}>关闭</Button>
      ]}
      width={700}
    >
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        <Step title="导出待关闭作业" description="根据筛选导出 Excel" />
        <Step title="上传 Excel" description="上传确认关闭的 ID" />
        <Step title="完成" description="查看结果" />
      </Steps>

      {currentStep === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p>系统将根据您当前在页面上的筛选条件，导出所有符合条件的作业及其完工状态。</p>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Button 
              type="primary" 
              icon={<DownloadOutlined />} 
              onClick={handleExport} 
              loading={exporting}
              size="large"
            >
              {exporting ? '正在生成 Excel...' : '导出作业清单'}
            </Button>
            {exporting && (
              <div style={{ width: '80%', margin: '0 auto' }}>
                <Progress 
                  percent={100} 
                  status="active" 
                  showInfo={false}
                  strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                />
                <Text type="secondary">已处理 {exportProgress} 条记录...</Text>
              </div>
            )}
          </Space>
        </div>
      )}

      {currentStep === 1 && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p>请上传您已标记的 Excel 文件。系统将仅处理 <b>“确认关闭 (填写CLOSE)”</b> 列中填写了 <b>CLOSE</b> 的作业。</p>
          <Upload.Dragger
            accept=".xlsx, .xls"
            beforeUpload={handleImport}
            showUploadList={false}
            disabled={importing}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
            <p className="ant-upload-hint">支持 .xlsx, .xls 格式</p>
          </Upload.Dragger>
        </div>
      )}

      {currentStep === 2 && results && (
        <div>
          <div style={{ marginBottom: 24, display: 'flex', gap: 48, justifyContent: 'center', background: '#fafafa', padding: '16px', borderRadius: '8px' }}>
            <Space direction="vertical" align="center">
              <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a' }} />
              <Text strong style={{ fontSize: 20 }}>{results.success_count}</Text>
              <Text type="secondary">成功关闭</Text>
            </Space>
            <Space direction="vertical" align="center">
              <CloseCircleOutlined style={{ fontSize: 32, color: '#ff4d4f' }} />
              <Text strong style={{ fontSize: 20 }}>{results.error_count}</Text>
              <Text type="secondary">处理失败</Text>
            </Space>
          </div>

          <Tabs defaultActiveKey={results.error_count > 0 ? "failed" : "success"}>
            <Tabs.TabPane tab={`失败详情 (${results.error_count})`} key="failed">
              <Table
                size="small"
                dataSource={results.failed_ids.map((id: string, index: number) => ({ 
                  key: index, 
                  id: id, 
                  reason: results.errors[index] || '未知原因' 
                }))}
                columns={[
                  { title: '作业 ID', dataIndex: 'id', key: 'id', width: 220, render: (text) => <Text code>{text}</Text> },
                  { title: '失败原因', dataIndex: 'reason', key: 'reason', render: (text) => <Text type="danger">{text}</Text> }
                ]}
                pagination={{ pageSize: 5, size: 'small' }}
                scroll={{ y: 240 }}
                locale={{ emptyText: '无失败记录' }}
              />
            </Tabs.TabPane>
            <Tabs.TabPane tab={`成功列表 (${results.success_count})`} key="success">
              <div style={{ maxHeight: 280, overflowY: 'auto', padding: '8px', border: '1px solid #f0f0f0', borderRadius: '4px' }}>
                {results.success_ids.length > 0 ? (
                  <Space size={[8, 8]} wrap>
                    {results.success_ids.map((id: string) => (
                      <Tag color="success" key={id}>{id}</Tag>
                    ))}
                  </Space>
                ) : (
                  <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>无成功记录</div>
                )}
              </div>
            </Tabs.TabPane>
          </Tabs>
        </div>
      )}
    </Modal>
  )
}

export default BulkCloseModal
