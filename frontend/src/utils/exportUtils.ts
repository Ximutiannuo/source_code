import { reportService } from '../services/reportService'
import dayjs from 'dayjs'

/**
 * 通用导出处理函数（支持轮询进度反馈）
 * @param type 导出类型 'vfactdb' | 'mpdb'
 * @param params 导出参数
 * @param messageApi Antd message 实例
 * @param setExporting 设置导出状态的 state setter
 * @param fileNamePrefix 文件名前缀
 */
export const handleUnifiedExport = async (
  type: 'vfactdb' | 'mpdb',
  params: { columns?: any[], filters?: any, template_type?: string },
  messageApi: any,
  setExporting: (exporting: boolean) => void,
  fileNamePrefix: string = 'Export'
) => {
  setExporting(true)
  try {
    const service = type === 'vfactdb' ? reportService.exportVFACTDB : reportService.exportMPDB
    const { task_id } = await service(params)
    
    messageApi.info('导出任务已提交，后台处理中...')

    const pollStatus = async () => {
      try {
        const statusData = await reportService.getExportStatus(task_id)
        if (statusData.status === 'completed') {
          const blob = await reportService.downloadExportFile(task_id)
          const url = window.URL.createObjectURL(new Blob([blob]))
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', `${fileNamePrefix}_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`)
          document.body.appendChild(link)
          link.click()
          link.remove()
          window.URL.revokeObjectURL(url)
          messageApi.success('导出成功')
          setExporting(false)
        } else if (statusData.status === 'failed') {
          messageApi.error(`导出失败: ${statusData.error || '未知错误'}`)
          setExporting(false)
        } else {
          // 继续轮询
          setTimeout(pollStatus, 3000)
        }
      } catch (pollError) {
        console.error('Poll export status failed:', pollError)
        messageApi.error('查询导出进度失败')
        setExporting(false)
      }
    }
    
    pollStatus()
  } catch (error: any) {
    console.error('Unified export failed:', error)
    messageApi.error('启动导出任务失败')
    setExporting(false)
  }
}
