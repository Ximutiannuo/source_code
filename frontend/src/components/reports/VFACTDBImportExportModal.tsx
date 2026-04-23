import { Modal, Upload, Button, App, Alert, Space } from 'antd'
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { handleUnifiedExport } from '../../utils/exportUtils'
import { reportService } from '../../services/reportService'
import type { UploadFile } from 'antd'
import ExcelJS from 'exceljs'
import dayjs from 'dayjs'

interface VFACTDBImportExportModalProps {
  visible: boolean
  filters: Record<string, any> // 当前筛选条件
  onCancel: () => void
  onSuccess: () => void
}

const VFACTDBImportExportModal = ({ visible, filters, onCancel, onSuccess }: VFACTDBImportExportModalProps) => {
  const { message } = App.useApp()
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<any>(null)

  // 导出功能：导出当前筛选条件下的数据
  const handleExport = async () => {
    handleUnifiedExport(
      'vfactdb',
      { filters: filters, template_type: 'delete_template' },
      message,
      setExporting,
      'VFACTDB_Delete_Template'
    )
  }

  // 导入功能：读取Excel，删除标记为D/d的记录
  const handleImport = async () => {
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
      // 读取Excel文件
      const arrayBuffer = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(arrayBuffer)

      // 获取第一个工作表
      const worksheet = workbook.getWorksheet(1)
      if (!worksheet) {
        message.warning('文件中没有工作表')
        setUploading(false)
        return
      }

      // 读取数据（跳过表头）
      const data: any[] = []
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return // 跳过表头
        const rowData: any = {}
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const headerCell = worksheet.getRow(1).getCell(colNumber)
          const header = headerCell.value?.toString() || ''
          if (header) {
            let value = cell.value
            // ExcelJS 会自动处理日期为 Date 对象
            if (value instanceof Date) {
              value = dayjs(value).format('YYYY-MM-DD')
            } else if (value !== null && value !== undefined) {
              value = value.toString()
            } else {
              value = ''
            }
            rowData[header] = value
          }
        })
        if (Object.keys(rowData).length > 0) {
          data.push(rowData)
        }
      })

      if (data.length === 0) {
        message.warning('文件中没有数据')
        setUploading(false)
        return
      }

      // 查找需要删除的记录（Delete列标记为D或d）
      const toDelete: Array<{ date: string; activity_id: string; scope: string }> = []
      const errors: string[] = []

      for (const row of data) {
        const deleteFlag = String(row.Delete || '').trim().toUpperCase()
        if (deleteFlag === 'D') {
          // 处理日期
          let date: string | null = null
          if (row.Date) {
            const parsed = dayjs(row.Date)
            date = parsed.isValid() ? parsed.format('YYYY-MM-DD') : null
          }
          
          const activityId = row.Activity_ID || row['Activity_ID'] || ''
          const scope = row.Scope || row['Scope'] || ''

          if (!date || !activityId) {
            errors.push(`行数据不完整：Date=${row.Date}, Activity_ID=${activityId}`)
            continue
          }

          toDelete.push({ date, activity_id: activityId, scope })
        }
      }

      if (toDelete.length === 0) {
        message.info('文件中没有标记为删除的记录（Delete列需要标记为D或d）')
        setUploading(false)
        return
      }

      // 批量删除记录
      let deletedCount = 0
      let failedCount = 0
      const failedItems: string[] = []

      // 先获取所有符合筛选条件的数据，找到对应的ID
      const allData = await reportService.getVFACTDB({
        ...filters,
        skip: 0,
        limit: 100000,
      })

      const items = allData.items || []

      // 为每个要删除的记录查找ID并删除
      for (const deleteItem of toDelete) {
        try {
          // 查找匹配的记录
          const matched = items.find((item: any) => {
            const itemDate = item.date ? dayjs(item.date).format('YYYY-MM-DD') : ''
            return (
              itemDate === deleteItem.date &&
              item.activity_id === deleteItem.activity_id &&
              item.scope === deleteItem.scope
            )
          })

          if (matched && matched.id) {
            await reportService.deleteVFACTDB(matched.id)
            deletedCount++
          } else {
            failedCount++
            failedItems.push(`${deleteItem.date} - ${deleteItem.activity_id} - ${deleteItem.scope}`)
          }
        } catch (error: any) {
          failedCount++
          failedItems.push(`${deleteItem.date} - ${deleteItem.activity_id} - ${deleteItem.scope}: ${error?.message || '删除失败'}`)
        }
      }

      const result = {
        total: toDelete.length,
        deleted: deletedCount,
        failed: failedCount,
        failedItems,
        errors,
      }

      setResult(result)

      if (failedCount === 0) {
        message.success(`删除成功！共删除 ${deletedCount} 条记录`)
        setTimeout(() => {
          onSuccess()
          handleCancel()
        }, 2000)
      } else {
        message.warning(`删除完成：成功 ${deletedCount} 条，失败 ${failedCount} 条`)
      }
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error?.message || '导入失败')
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
      title="VFACTDB 导入导出"
      open={visible}
      onCancel={handleCancel}
      width={700}
      footer={[
        <Button key="export" icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
          导出数据
        </Button>,
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button key="import" type="primary" loading={uploading} onClick={handleImport}>
          导入并删除
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          message="使用说明"
          description={
            <div>
              <p>1. 点击"导出数据"按钮，导出当前筛选条件下的所有数据</p>
              <p>2. 在Excel中，在"Delete"列标记"D"或"d"来标记要删除的记录</p>
              <p>3. 点击"导入并删除"按钮，上传修改后的Excel文件，系统将删除标记的记录</p>
              <p style={{ color: '#ff4d4f', marginTop: 8 }}>
                <strong>注意：删除操作不可恢复，请谨慎操作！</strong>
              </p>
            </div>
          }
          type="info"
          showIcon
        />

        <div>
          <h4>导出数据</h4>
          <p>导出字段：Date, Activity_ID, Scope, Work_Step_Description, Achieved, Delete</p>
          <p>导出的数据将应用当前的筛选条件</p>
        </div>

        <div>
          <h4>导入并删除</h4>
          <Upload
            fileList={fileList}
            beforeUpload={() => false} // 阻止自动上传
            onChange={({ fileList }) => setFileList(fileList)}
            accept=".xlsx,.xls"
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>选择Excel文件</Button>
          </Upload>
          <p style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
            支持 .xlsx 和 .xls 格式
          </p>
        </div>

        {result && (
          <Alert
            message={`处理结果：成功 ${result.deleted} 条，失败 ${result.failed} 条`}
            description={
              result.failed > 0 && result.failedItems.length > 0 ? (
                <div>
                  <p>失败的记录：</p>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {result.failedItems.slice(0, 10).map((item: string, index: number) => (
                      <li key={index}>{item}</li>
                    ))}
                    {result.failedItems.length > 10 && (
                      <li>...还有 {result.failedItems.length - 10} 条失败记录</li>
                    )}
                  </ul>
                </div>
              ) : null
            }
            type={result.failed === 0 ? 'success' : 'warning'}
            showIcon
          />
        )}
      </Space>
    </Modal>
  )
}

export default VFACTDBImportExportModal

