import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Table, Input, Button, Space, App, Dropdown, Pagination, Upload, Modal, Progress, Radio, Divider, Tooltip, Segmented } from 'antd'
import { ExportOutlined, ImportOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, BarChartOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import type { MenuProps, UploadProps } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { volumeControlServiceV2, type VolumeControlListItem } from '../services/volumeControlServiceV2'
import { GlobalFilterContext } from '../components/layout/MainLayout'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import ExcelJS from 'exceljs'
import { useResizableColumns, ResizableHeaderCell } from '../hooks/useResizableColumns'
import { logger } from '../utils/logger'
import { formatQuantity } from '../utils/formatNumber'
import KeyQuantitiesChart, { buildRfiNamesConcat } from '../components/dashboard/KeyQuantitiesChart'
import LegacyModuleBanner from '../components/common/LegacyModuleBanner'

const VolumeControlList = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const globalFilter = useContext(GlobalFilterContext)
  const [filters, setFilters] = useState({
    block: '',
    search: '',
  })
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 })
  const tableAreaRef = useRef<HTMLDivElement | null>(null)
  const paginationBarRef = useRef<HTMLDivElement | null>(null)
  const [bodyHeight, setBodyHeight] = useState<number>(360)
  const [showSummary, setShowSummary] = useState(false)
  const [summaryGroupBy, setSummaryGroupBy] = useState<'work_package' | 'resource_id_name' | 'key_qty'>('work_package')
  const [summaryViewMode, setSummaryViewMode] = useState<'table' | 'chart'>('table')
  const [exportProgress, setExportProgress] = useState<{ visible: boolean; percent: number; text: string }>({
    visible: false,
    percent: 0,
    text: ''
  })
  const [importProgress, setImportProgress] = useState<{ visible: boolean; percent: number; text: string }>({
    visible: false,
    percent: 0,
    text: ''
  })

  const [importResults, setImportResults] = useState<{
    totalProcessed: number;
    successCount: number;
    updatedFieldsCount: number;
    errorCount: number;
    errors: string[];
  } | null>(null)

  // 当全局筛选器或本地筛选器变化时，重置分页到第一页
  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }))
  }, [globalFilter, filters])

  // 合并全局筛选器和本地筛选器，转换为后端API需要的格式
  const mergedFilters = useMemo(() => {
    const filterObj: Record<string, any> = {}
    
    // 本地筛选器
    if (filters.block) {
      filterObj.block = filters.block
    }
    if (filters.search) {
      filterObj.search = filters.search
    }

    // 全局筛选器（优先级高于本地筛选器）
    if (globalFilter.subproject && globalFilter.subproject.length > 0) {
      filterObj.subproject = globalFilter.subproject
    }
    if (globalFilter.train && globalFilter.train.length > 0) {
      filterObj.train = globalFilter.train
    }
    if (globalFilter.unit && globalFilter.unit.length > 0) {
      filterObj.unit = globalFilter.unit
    }
    if (globalFilter.main_block && globalFilter.main_block.length > 0) {
      filterObj.main_block = globalFilter.main_block
    }
    if (globalFilter.block && globalFilter.block.length > 0) {
      filterObj.block = globalFilter.block
    }
    if (globalFilter.quarter && globalFilter.quarter.length > 0) {
      filterObj.quarter = globalFilter.quarter
    }
    if (globalFilter.scope && globalFilter.scope.length > 0) {
      filterObj.scope = globalFilter.scope
    }
    // activity_summary 相关字段
    if (globalFilter.discipline && globalFilter.discipline.length > 0) {
      filterObj.discipline = globalFilter.discipline
    }
    if (globalFilter.implement_phase && globalFilter.implement_phase.length > 0) {
      filterObj.implement_phase = globalFilter.implement_phase
    }
    if (globalFilter.contract_phase && globalFilter.contract_phase.length > 0) {
      filterObj.contract_phase = globalFilter.contract_phase
    }
    if (globalFilter.type && globalFilter.type.length > 0) {
      filterObj.type = globalFilter.type
    }
    if (globalFilter.work_package && globalFilter.work_package.length > 0) {
      filterObj.work_package = globalFilter.work_package
    }
    // rsc_defines 相关字段
    if (globalFilter.resource_id_name && globalFilter.resource_id_name.length > 0) {
      filterObj.resource_id_name = globalFilter.resource_id_name
    }
    if (globalFilter.bcc_kq_code && globalFilter.bcc_kq_code.length > 0) {
      filterObj.bcc_kq_code = globalFilter.bcc_kq_code
    }
    if (globalFilter.kq && globalFilter.kq.length > 0) {
      filterObj.kq = globalFilter.kq
    }
    if (globalFilter.cn_wk_report && globalFilter.cn_wk_report.length > 0) {
      filterObj.cn_wk_report = globalFilter.cn_wk_report
    }
    
    // 日期筛选
    if (globalFilter.date_range && globalFilter.date_range[0] && globalFilter.date_range[1]) {
      filterObj.baseline1_start_date = {
        gte: globalFilter.date_range[0].format('YYYY-MM-DD'),
        lte: globalFilter.date_range[1].format('YYYY-MM-DD'),
      }
    }
    
    return filterObj
  }, [filters, globalFilter])

  const { data, isLoading, error } = useQuery({
    queryKey: ['volume-control-list', mergedFilters, pagination.current, pagination.pageSize],
    queryFn: async () => {
      // 使用 advanced API 以支持所有筛选字段
      const result = await volumeControlServiceV2.getVolumeControlListAdvanced({
        filters: mergedFilters,
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize,
      })
      return {
        items: Array.isArray(result.items) ? result.items : (Array.isArray(result) ? result : []),
        total: result.total || 0,
      }
    },
    retry: false, // 403错误不重试
  })

  // 获取汇总数据
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['volume-control-summary', mergedFilters, summaryGroupBy],
    queryFn: () => volumeControlServiceV2.getVolumeControlSummary({
      filters: mergedFilters,
      group_by: summaryGroupBy,
    }),
    enabled: showSummary,
  })

  // 检查是否是权限错误（403）
  const isPermissionError = (error: any): boolean => {
    return error?.response?.status === 403 || error?.response?.statusCode === 403
  }

  const handleExportExcel = async () => {
    try {
      // 显示进度Modal
      setExportProgress({ visible: true, percent: 0, text: '正在获取数据...' })
      
      // 先获取总数，检查数据量
      const countResult = await volumeControlServiceV2.getVolumeControlListAdvanced({
        filters: mergedFilters,
        skip: 0,
        limit: 1,
        is_export: true,
      })
      const totalCount = countResult.total || 0
      
      if (totalCount === 0) {
        setExportProgress({ visible: false, percent: 0, text: '' })
        message.warning({ content: '没有可导出的数据', key: 'export' })
        return
      }
      
      setExportProgress({ visible: true, percent: 10, text: `正在获取数据 (共 ${totalCount} 条)...` })
      
      const result = await volumeControlServiceV2.getVolumeControlListAdvanced({
        filters: mergedFilters,
        skip: 0,
        limit: 100000,
        is_export: true,
      })
      
      const items = result.items || []
      
      if (items.length === 0) {
        setExportProgress({ visible: false, percent: 0, text: '' })
        message.warning({ content: '没有可导出的数据', key: 'export' })
        return
      }
      
      setExportProgress({ visible: true, percent: 20, text: `正在生成Excel文件 (${items.length} 条记录)...` })
      const headers = [
        'Activity ID', 'Title', 'WBS Code', 'Discipline', 'Work Package', 'Block', 'Scope',
        '设计量', '图算量', '材料到货量', '工作面', '工作面受限（材料）', '工作面受限（现场）', '施工量',
        '施工完成比例', '未施工',
        'RFI验收完成量（A）', 'RFI验收完成量（B）', 'RFI验收完成量（C）',
        '竣工资料签署量（R0）', '竣工资料签署量（R1）',
        'OBP签署量',
        '最早开始（VFACTDB）', '最晚更新（VFACTDB）',
      ]
      
      // 创建Excel工作簿
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('工程量控制')
      
      // 设置工作表的默认行高（单位：点）
      // Excel 默认行高通常是 15 点，我们设置为 20 点作为基础
      worksheet.properties.defaultRowHeight = 40
      
      // 定义边框样式（0.25浅灰色）
      const borderStyle: Partial<ExcelJS.Border> = {
        style: 'thin',
        color: { argb: 'FFD3D3D3' } // 浅灰色
      }
      
      // 定义表头样式（蓝色底纹，Arial字体，11号，自动换行）
      const headerStyle: Partial<ExcelJS.Style> = {
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4472C4' } // 蓝色
        },
        font: {
          name: 'Arial',
          size: 11,
          color: { argb: 'FFFFFFFF' }, // 白色字体
          bold: true
        },
        border: {
          top: borderStyle,
          left: borderStyle,
          bottom: borderStyle,
          right: borderStyle
        },
        alignment: {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true // 自动换行
        } as ExcelJS.Alignment
      }
      
      // 定义数据行样式（Arial字体，11号，边框）
      const dataStyle: Partial<ExcelJS.Style> = {
        font: {
          name: 'Arial',
          size: 11
        },
        border: {
          top: borderStyle,
          left: borderStyle,
          bottom: borderStyle,
          right: borderStyle
        },
        alignment: {
          vertical: 'middle'
        } as ExcelJS.Alignment
      }
      
      const lastDataRow = 2 + items.length
      const col = (c: number) => String.fromCharCode(64 + c)
      const range = (c: number) => `${col(c)}3:${col(c)}${lastDataRow}`

      // 在表头上方插入 Subtotal 行
      const subtotalRowValues: (string | { formula: string })[] = [
        '', '', '', '', '', '', '', // A-G 非数值列留空
        { formula: `SUBTOTAL(9,${range(8)})` },  // H 设计量
        { formula: `SUBTOTAL(9,${range(9)})` },  // I 图算量
        { formula: `SUBTOTAL(9,${range(10)})` }, // J 材料到货量
        { formula: `SUBTOTAL(9,${range(11)})` }, // K 工作面
        { formula: `SUBTOTAL(9,${range(12)})` }, // L 工作面受限（材料）
        { formula: `SUBTOTAL(9,${range(13)})` }, // M 工作面受限（现场）
        { formula: `SUBTOTAL(9,${range(14)})` }, // N 施工量
        { formula: `IFERROR(SUBTOTAL(9,${range(14)})/SUBTOTAL(9,${range(8)}),0)` }, // O 施工完成比例
        { formula: `SUBTOTAL(9,${range(8)})-SUBTOTAL(9,${range(14)})` }, // P 未施工
        { formula: `SUBTOTAL(9,${range(17)})` }, // Q RFI A
        { formula: `SUBTOTAL(9,${range(18)})` }, // R RFI B
        { formula: `SUBTOTAL(9,${range(19)})` }, // S RFI C
        { formula: `SUBTOTAL(9,${range(20)})` }, // T 竣工 R0
        { formula: `SUBTOTAL(9,${range(21)})` }, // U 竣工 R1
        { formula: `SUBTOTAL(9,${range(22)})` }, // V OBP
      ]
      const subtotalRow = worksheet.addRow(subtotalRowValues)
      subtotalRow.eachCell((cell) => {
        cell.style = {
          ...headerStyle,
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } },
          font: { name: 'Arial', size: 11, color: { argb: 'FF1A1A1A' }, bold: true }
        }
      })
      subtotalRow.height = 35

      // 添加表头
      const headerRow = worksheet.addRow(headers)
      headerRow.eachCell((cell) => {
        cell.style = headerStyle
      })
      // 设置表头行高（自动换行需要更高的行高，单位：点）
      headerRow.height = 35
      
      // 准备数据行（保留原始数值精度，含公式列）
      const dataRows: any[][] = []
      items.forEach((item: VolumeControlListItem, idx: number) => {
        const rowNum = 3 + idx
        const hCol = 'H', nCol = 'N'
        dataRows.push([
          item.activity_id || '',
          item.activity_title || '',
          item.wbs_code || '',
          item.discipline || '',
          item.work_package || '',
          item.block || '',
          item.scope || '',
          item.estimated_total ?? null,
          item.drawing_approved_afc ?? null,
          item.material_arrived ?? null,
          item.available_workface ?? null,
          item.workface_restricted_material ?? null,
          item.workface_restricted_site ?? null,
          item.construction_completed ?? null,
          { formula: `IFERROR(${nCol}${rowNum}/${hCol}${rowNum},0)` }, // 施工完成比例
          { formula: `${hCol}${rowNum}-${nCol}${rowNum}` }, // 未施工
          item.rfi_completed_a ?? null,
          item.rfi_completed_b ?? null,
          item.rfi_completed_c ?? null,
          item.asbuilt_signed_r0 ?? null,
          item.asbuilt_signed_r1 ?? null,
          item.obp_signed ?? null,
          item.vfactdb_earliest_date ?? null,
          item.vfactdb_latest_date ?? null,
        ])
      })
      
      // 分批添加数据行，避免阻塞主线程
      const batchSize = 500 // 每批处理500行
      const totalRows = dataRows.length
      let processedRows = 0
      
      // 更新进度提示的辅助函数
      const updateProgress = (current: number, total: number) => {
        const progress = Math.floor(20 + (current / total) * 60) // 20-80% 用于数据行处理
        setExportProgress({ 
          visible: true, 
          percent: progress, 
          text: `正在生成Excel文件... ${Math.floor((current / total) * 100)}% (${current}/${total})` 
        })
      }
      
      // 使用 requestIdleCallback 或 setTimeout 来分批处理
      const processBatch = (startIndex: number): Promise<void> => {
        return new Promise((resolve) => {
          const processChunk = () => {
            const endIndex = Math.min(startIndex + batchSize, totalRows)
            
            // 批量添加行
            for (let i = startIndex; i < endIndex; i++) {
              const rowData = dataRows[i]
              const row = worksheet.addRow(rowData)
              
      // 优化：批量设置样式，减少对象创建
              // 只对数值列（8-22列）进行特殊处理
              row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                const numColNumber = Number(colNumber)
                if (numColNumber >= 8 && numColNumber <= 22) {
                  const cellValue = cell.value
                  const isFormula = cellValue && typeof cellValue === 'object' && 'formula' in cellValue
                  if (isFormula) {
                    cell.style = dataStyle
                    cell.alignment = { ...dataStyle.alignment, horizontal: 'right' } as ExcelJS.Alignment
                  } else if (cellValue !== null && cellValue !== undefined) {
                    const numValue = typeof cellValue === 'number' ? cellValue : Number(cellValue)
                    if (!isNaN(numValue)) {
                      cell.value = numValue
                      cell.style = dataStyle
                      cell.alignment = { ...dataStyle.alignment, horizontal: 'right' } as ExcelJS.Alignment
                    } else {
                      cell.style = dataStyle
                    }
                  } else {
                    cell.style = { font: dataStyle.font, border: dataStyle.border, alignment: { vertical: 'middle' } as ExcelJS.Alignment }
                  }
                } else {
                  cell.style = dataStyle
                }
              })
              row.height = 40
            }
            
            processedRows = endIndex
            updateProgress(processedRows, totalRows)
            
            resolve()
          }
          
          // 使用 requestIdleCallback（如果可用）或 setTimeout，增加延迟确保UI更新
          if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as any).requestIdleCallback(processChunk, { timeout: 50 })
          } else {
            // 使用稍长的延迟，确保UI有机会更新（至少50ms让React有机会渲染）
            setTimeout(processChunk, 50)
          }
        })
      }
      
      // 分批处理所有数据
      for (let i = 0; i < totalRows; i += batchSize) {
        await processBatch(i)
      }
      
      // 列宽：H-V 列统一 13.8，A-G 列采样计算
      setExportProgress({ visible: true, percent: 85, text: '正在设置列宽...' })
      const NUM_COL_WIDTH = 13.8
      headers.forEach((header, index) => {
        const colIndex = index + 1
        const column = worksheet.getColumn(colIndex)
        if (colIndex >= 8 && colIndex <= 22) {
          column.width = NUM_COL_WIDTH
        } else {
          const sampleSize = Math.min(1000, totalRows)
          let maxLength = header.length
          for (let i = 0; i < sampleSize; i++) {
            const value = dataRows[i][index]
            if (value !== null && value !== undefined) {
              const length = String(value).length
              if (length > maxLength) maxLength = length
            }
          }
          column.width = Math.min(Math.max(maxLength + 2, 10), 50)
        }
      })

      // 表头行（第2行）设置筛选
      worksheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: lastDataRow, column: 22 } }

      // 以 H3 为基准冻结窗格（冻结前2行、前7列）
      worksheet.views = [{ state: 'frozen', xSplit: 7, ySplit: 2, topLeftCell: 'H3' }]
      
      // 生成Excel文件
      setExportProgress({ visible: true, percent: 90, text: '正在生成Excel文件缓冲区...' })
      let buffer: ArrayBuffer
      try {
        // ExcelJS 的 writeBuffer 是异步的，但可能仍会占用一些时间
        // 使用 Promise 确保错误处理正确
        buffer = await workbook.xlsx.writeBuffer()
      } catch (excelError: any) {
        logger.error('生成Excel文件失败:', excelError)
        throw new Error(`生成Excel文件失败: ${excelError?.message || '未知错误'}`)
      }
      
      try {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `工程量控制_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        // 延迟释放URL，确保下载开始
        setTimeout(() => {
          URL.revokeObjectURL(url)
        }, 100)
        setExportProgress({ visible: false, percent: 0, text: '' })
        message.success({ content: `已导出 ${items.length} 条记录`, key: 'export' })
      } catch (downloadError: any) {
        logger.error('下载文件失败:', downloadError)
        setExportProgress({ visible: false, percent: 0, text: '' })
        throw new Error(`下载文件失败: ${downloadError?.message || '未知错误'}`)
      }
    } catch (error: any) {
      setExportProgress({ visible: false, percent: 0, text: '' })
      logger.error('导出Excel失败:', error)
      logger.error('错误详情:', {
        message: error?.message,
        response: error?.response,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        stack: error?.stack
      })
      
      let errorMessage = '导出失败'
      if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail
      } else if (error?.response?.status === 403) {
        errorMessage = '没有权限导出数据'
      } else if (error?.response?.status === 500) {
        errorMessage = '服务器错误，请稍后重试'
      } else if (error?.response?.status === 504 || error?.code === 'ECONNABORTED') {
        errorMessage = '请求超时，数据量可能过大，请尝试缩小筛选范围'
      } else if (error?.message) {
        errorMessage = `导出失败: ${error.message}`
      } else if (error?.response?.statusText) {
        errorMessage = `导出失败: ${error.response.statusText}`
      }
      
      message.error({ content: errorMessage, key: 'export', duration: 5 })
    }
  }

  const handleImportExcel: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    try {
      setImportProgress({ visible: true, percent: 0, text: '正在解析Excel文件...' })
      
      const fileObj = file as File
      const arrayBuffer = await fileObj.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(arrayBuffer)
      
      const worksheet = workbook.getWorksheet(1) // 获取第一个工作表
      if (!worksheet) {
        throw new Error('Excel文件中没有工作表')
      }
      
      // 读取表头：兼容新旧格式（row1=subtotal时表头在row2）
      const firstRow = worksheet.getRow(1)
      const firstCellA = firstRow.getCell(1).value
      const isFirstRowHeader = firstCellA !== null && firstCellA !== undefined &&
        String(firstCellA).trim() === 'Activity ID'
      const headerRowIndex = isFirstRowHeader ? 1 : 2
      const headerRow = worksheet.getRow(headerRowIndex)
      const headers: string[] = []
      headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const val = cell.value
        const str = (val && typeof val === 'object' && 'formula' in val) ? '' : (val?.toString() || '')
        headers[colNumber - 1] = str
      })
      
      // 读取数据行（跳过 subtotal 行和表头行）
      const importData: any[] = []
      let totalRows = 0
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowIndex) return // 跳过 subtotal 和表头
        
        totalRows++
        const rowData: any = {}
        
        // 读取所有单元格（包括空的），以匹配导出时的格式
        // 导出时null值在Excel中显示为空单元格，导入时需要正确识别
        // 关键：必须遍历所有列（根据表头），而不是只遍历有值的列
        // 修复：总是发送所有字段到后端，包括空值，让后端决定是否更新
        const expectedColumnCount = headers.length
        for (let colNumber = 1; colNumber <= expectedColumnCount; colNumber++) {
          const header = headers[colNumber - 1]
          if (!header) continue

          const cell = row.getCell(colNumber)
          const value = cell.value

          // 检查单元格是否为空（包括各种空值情况）
          const isEmpty = value === null || value === undefined || value === '' ||
                         (typeof value === 'string' && value.trim() === '')

          if (isEmpty) {
            // 单元格为空：不添加到rowData（不更新该字段）
            // 这样，只有用户明确填写的值（包括0）才会被发送到后端
          } else if (typeof value === 'number') {
            // 直接使用 Excel 中的数字值，保持完整精度（包括0）
            rowData[header] = value
          } else {
            // 处理字符串值（可能是文本格式的数字）
            const strValue = String(value).trim()
            if (strValue === '') {
              // 空字符串：不添加到rowData（不更新该字段）
            } else {
              // 对于数值字段，保持为字符串格式发送给后端，确保精度
              // 对于非数值字段，保持为字符串
              rowData[header] = strValue
            }
          }
        }
        
        // 必须有 hedge ID才处理
        if (rowData['Activity ID']) {
          // 映射Excel列名到API字段名
          const mappedData: any = {
            activity_id: rowData['Activity ID'],
          }

          // 工程量及完工信息字段（兼容新旧表头：设计量/预估总量、图算量/图纸批准量AFC、工作面/现有可施工工作面、施工量/施工完成）
          const getVal = (keys: string[]) => keys.reduce((v: any, k) => (v ?? rowData[k]), null)
          mappedData.estimated_total = getVal(['设计量', '预估总量']) ?? null
          mappedData.drawing_approved_afc = getVal(['图算量', '图纸批准量AFC']) ?? null
          mappedData.material_arrived = getVal(['材料到货量']) ?? null
          mappedData.available_workface = getVal(['工作面', '现有可施工工作面']) ?? null
          mappedData.workface_restricted_material = getVal(['工作面受限（材料）']) ?? null
          mappedData.workface_restricted_site = getVal(['工作面受限（现场）']) ?? null

          // 验收相关信息字段
          mappedData.rfi_completed_a = 'RFI验收完成量（A）' in rowData ? rowData['RFI验收完成量（A）'] : null
          mappedData.rfi_completed_b = 'RFI验收完成量（B）' in rowData ? rowData['RFI验收完成量（B）'] : null
          mappedData.rfi_completed_c = 'RFI验收完成量（C）' in rowData ? rowData['RFI验收完成量（C）'] : null

          // 竣工资料相关信息字段
          mappedData.asbuilt_signed_r0 = '竣工资料签署量（R0）' in rowData ? rowData['竣工资料签署量（R0）'] : null
          mappedData.asbuilt_signed_r1 = '竣工资料签署量（R1）' in rowData ? rowData['竣工资料签署量（R1）'] : null

          // 收款相关信息字段
          mappedData.obp_signed = 'OBP签署量' in rowData ? rowData['OBP签署量'] : null
          
          // 只要Activity ID存在，就添加到导入数据中
          // 即使没有其他字段，也应该发送到后端（后端会检查是否有字段需要更新）
          importData.push(mappedData)
        }
      })
      
      if (importData.length === 0) {
        setImportProgress({ visible: false, percent: 0, text: '' })
        throw new Error('Excel文件中没有有效数据')
      }

      // 分批调用后端批量更新接口，减轻单次事务压力、降低 502/504
      const CHUNK_SIZE = 500
      const chunks = []
      for (let i = 0; i < importData.length; i += CHUNK_SIZE) {
        chunks.push(importData.slice(i, i + CHUNK_SIZE))
      }

      let totalSuccessCount = 0
      let totalErrorCount = 0
      let totalUpdatedFieldsCount = 0
      const allErrors: string[] = []
      const BATCH_RETRIES = 3
      const BATCH_RETRY_DELAY_MS = 2000

      for (let i = 0; i < chunks.length; i++) {
        const progress = Math.round((i / chunks.length) * 100)
        const isLastChunk = i === chunks.length - 1
        
        setImportProgress({ 
          visible: true, 
          percent: progress, 
          text: isLastChunk 
            ? `正在导入最后批次并同步甘特图汇总数据... ${progress}%` 
            : `正在导入数据... ${progress}% (${i * CHUNK_SIZE}/${importData.length})` 
        })
        
        let result: any = null
        for (let attempt = 1; attempt <= BATCH_RETRIES; attempt++) {
          try {
            result = await volumeControlServiceV2.batchUpdateFromExcel(chunks[i])
            break
          } catch (e) {
            const status = (e as { response?: { status?: number } })?.response?.status
            if ((status === 502 || status === 504) && attempt < BATCH_RETRIES) {
              setImportProgress({ visible: true, percent: progress, text: `批次 ${i + 1}/${chunks.length} 暂时无响应，${BATCH_RETRY_DELAY_MS / 1000} 秒后重试 (${attempt}/${BATCH_RETRIES})...` })
              await new Promise(r => setTimeout(r, BATCH_RETRY_DELAY_MS))
            } else {
              throw e
            }
          }
        }
        if (result != null) {
          totalSuccessCount += (result.success_count || 0)
          totalErrorCount += (result.error_count || 0)
          totalUpdatedFieldsCount += (result.updated_fields_count || 0)
          if (result.errors && result.errors.length > 0) {
            allErrors.push(...result.errors)
          }
        }
      }
      
      setImportProgress({ visible: false, percent: 100, text: '导入完成' })
      onSuccess?.(null)
      
      // 保存结果以便在 Modal 中显示 (解决 TS 错误并统一 UI)
      setImportResults({
        totalProcessed: importData.length,
        successCount: totalSuccessCount,
        updatedFieldsCount: totalUpdatedFieldsCount,
        errorCount: totalErrorCount,
        errors: allErrors
      })
    } catch (error: any) {
      setImportProgress({ visible: false, percent: 0, text: '' })
      const errorMsg = error?.response?.data?.detail || error?.message || '导入失败'
      message.error({ content: errorMsg, key: 'import' })
      onError?.(error)
    }
  }

  // 使用 useEffect 监听导入结果变化并显示成功的 Modal
  useEffect(() => {
    if (importResults) {
      Modal.success({
        title: '导入完成',
        width: 500,
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
        content: (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 12, fontSize: 14 }}>
              <strong>处理结果（总计）：</strong>
            </div>
            <div style={{ marginLeft: 20, marginBottom: 8 }}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>成功更新：<strong style={{ color: '#52c41a' }}>{importResults.successCount}</strong> 条记录</span>
              </Space>
            </div>
            {importResults.updatedFieldsCount > 0 && (
              <div style={{ marginLeft: 20, marginBottom: 8 }}>
                <Space>
                  <span>•</span>
                  <span>共更新 <strong>{importResults.updatedFieldsCount}</strong> 个字段</span>
                </Space>
              </div>
            )}
            {importResults.totalProcessed > importResults.successCount && (
              <div style={{ marginLeft: 20, marginBottom: 8 }}>
                <Space>
                  <span>•</span>
                  <span>共处理 <strong>{importResults.totalProcessed}</strong> 条记录（{importResults.totalProcessed - importResults.successCount} 条未更新）</span>
                </Space>
              </div>
            )}
            {importResults.errorCount > 0 && (
              <div style={{ marginLeft: 20, marginBottom: 8 }}>
                <Space>
                  <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                  <span>失败：<strong style={{ color: '#ff4d4f' }}>{importResults.errorCount}</strong> 条记录</span>
                </Space>
              </div>
            )}
            {importResults.errors.length > 0 && (
              <div style={{ marginTop: 16, marginLeft: 20 }}>
                <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
                  <strong>错误详情（前100条）：</strong>
                </div>
                <div style={{ 
                  maxHeight: 150, 
                  overflowY: 'auto', 
                  backgroundColor: '#f5f5f5', 
                  padding: '8px 12px', 
                  borderRadius: 4,
                  fontSize: 12
                }}>
                  {importResults.errors.slice(0, 100).map((error: string, index: number) => (
                    <div key={index} style={{ marginBottom: 4, color: '#ff4d4f' }}>
                      {error}
                    </div>
                  ))}
                  {importResults.errors.length > 100 && (
                    <div style={{ color: '#999', fontStyle: 'italic' }}>
                      ... 还有 {importResults.errors.length - 100} 条错误未显示
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ),
        okText: '确定',
        onOk: () => {
          setImportResults(null)
          window.location.reload()
        },
      })
    }
  }, [importResults])

  const summaryColumns = useMemo(() => {
    const groupTitle = (label: string, color: string) => (
      <div style={{ 
        background: color, 
        color: 'white', 
        padding: '4px 8px', 
        fontSize: '11px', 
        fontWeight: 600,
        textAlign: 'center'
      }}>
        {label}
      </div>
    )

    const renderSummaryCell = (value: number, record: any, color: string, showPercent = true, tooltip?: string | null) => {
      const total = record.estimated_total || 0;
      const percent = total > 0 ? (value / total) * 100 : 0;
      
      const content = (
        <div className="summary-cell-content" style={{ 
          position: 'relative', 
          width: '100%', 
          height: '45px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          margin: '-4px -8px', 
          padding: '0 8px',
          cursor: tooltip ? 'help' : 'default'
        }}>
          {showPercent && total > 0 && (
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${Math.min(percent, 100)}%`,
              backgroundColor: color,
              opacity: 0.1,
              zIndex: 0,
              transition: 'width 0.3s'
            }} />
          )}
          <div style={{ zIndex: 1, whiteSpace: 'nowrap', textAlign: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: '12px' }}>
              {formatQuantity(value, 3, '-', true)}
              {tooltip && <QuestionCircleOutlined style={{ fontSize: '10px', marginLeft: 4, color: '#bfbfbf' }} />}
            </div>
            {showPercent && total > 0 && (
              <div style={{ fontSize: '10px', color: '#595959', fontWeight: 500 }}>
                {percent.toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      );

      if (tooltip) {
        return (
          <Tooltip title={tooltip} mouseEnterDelay={0.1}>
            {content}
          </Tooltip>
        );
      }

      return content;
    };

    return [
      {
        title: summaryGroupBy === 'work_package' ? 'Work Package' : 
               summaryGroupBy === 'resource_id_name' ? 'Resource Name' : 'Key Qty',
        dataIndex: 'group_name',
        key: 'group_name',
        width: 180,
        fixed: 'left' as const,
        ellipsis: true,
        align: 'center' as const,
        render: (v: string, record: any) => (
          <div className="summary-cell-content" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: '45px',
            lineHeight: '1.2'
          }}>
            <div style={{ fontWeight: 600 }}>{v}</div>
            {summaryGroupBy === 'work_package' && record.description && (
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: 2 }}>{record.description}</div>
            )}
          </div>
        )
      },
      {
        title: groupTitle('Quantity & Completion', 'rgba(250, 140, 22, 0.9)'),
        children: [
          { 
            title: '预估总量', 
            dataIndex: 'estimated_total', 
            key: 'estimated_total', 
            width: 110, 
            align: 'center' as const, 
            render: (v: number) => (
              <div className="summary-cell-content" style={{ minHeight: '45px' }}>
                <span style={{ fontWeight: 700, color: '#262626' }}>{formatQuantity(v, 3, '-', true)}</span>
              </div>
            )
          },
          { 
            title: '图纸批准', 
            dataIndex: 'drawing_approved_afc', 
            key: 'drawing_approved_afc', 
            width: 110, 
            align: 'center' as const, 
            render: (v: number, record: any) => renderSummaryCell(v, record, '#1890ff') 
          },
          { 
            title: '材料到货', 
            dataIndex: 'material_arrived', 
            key: 'material_arrived', 
            width: 110, 
            align: 'center' as const, 
            render: (v: number, record: any) => renderSummaryCell(v, record, '#52c41a') 
          },
          { 
            title: '工作面', 
            dataIndex: 'available_workface', 
            key: 'available_workface', 
            width: 110, 
            align: 'center' as const, 
            render: (v: number, record: any) => renderSummaryCell(v, record, '#13c2c2') 
          },
          { 
            title: '施工完成', 
            dataIndex: 'construction_completed', 
            key: 'construction_completed', 
            width: 110, 
            align: 'center' as const, 
            render: (v: number, record: any) => renderSummaryCell(v, record, '#faad14') 
          },
        ]
      },
      {
        title: groupTitle('Inspection', 'rgba(235, 47, 150, 0.9)'),
        children: [
          { 
            title: 'RFI (A)', 
            dataIndex: 'rfi_completed_a', 
            key: 'rfi_completed_a', 
            width: 110, 
            align: 'center' as const, 
            render: (v: number, record: any) => renderSummaryCell(v, record, '#eb2f96', true, record.group_name ? `${record.group_name}: ${record.rfi_a_name || '—'}` : record.rfi_a_name) 
          },
          { 
            title: 'RFI (B)', 
            dataIndex: 'rfi_completed_b', 
            key: 'rfi_completed_b', 
            width: 110, 
            align: 'center' as const, 
            render: (v: number, record: any) => renderSummaryCell(v, record, '#eb2f96', true, record.group_name ? `${record.group_name}: ${record.rfi_b_name || '—'}` : record.rfi_b_name) 
          },
          { 
            title: 'RFI (C)', 
            dataIndex: 'rfi_completed_c', 
            key: 'rfi_completed_c', 
            width: 110, 
            align: 'center' as const, 
            render: (v: number, record: any) => renderSummaryCell(v, record, '#eb2f96', true, record.group_name ? `${record.group_name}: ${record.rfi_c_name || '—'}` : record.rfi_c_name) 
          },
        ]
      },
      {
        title: groupTitle('Asbuilt', 'rgba(47, 84, 235, 0.9)'),
        children: [
          { 
            title: 'R0', 
            dataIndex: 'asbuilt_signed_r0', 
            key: 'asbuilt_signed_r0', 
            width: 110, 
            align: 'center' as const, 
            render: (v: number, record: any) => renderSummaryCell(v, record, '#2f54eb') 
          },
          { 
            title: 'R1', 
            dataIndex: 'asbuilt_signed_r1', 
            key: 'asbuilt_signed_r1', 
            width: 110, 
            align: 'center' as const, 
            render: (v: number, record: any) => renderSummaryCell(v, record, '#2f54eb') 
          },
        ]
      },
      {
        title: groupTitle('Payment', 'rgba(114, 46, 209, 0.9)'),
        children: [
          { 
            title: 'OBP', 
            dataIndex: 'obp_signed', 
            key: 'obp_signed', 
            width: 110, 
            align: 'center' as const, 
            render: (v: number, record: any) => renderSummaryCell(v, record, '#722ed1') 
          },
        ]
      }
    ]
  }, [summaryGroupBy])

  const exportMenuItems: MenuProps['items'] = [
    { key: 'excel', label: '导出为 Excel', onClick: handleExportExcel },
  ]

  const defaultColumns: ColumnsType<VolumeControlListItem> = useMemo(() => {
    const groupTitle = (label: string, cls: string) => (
      <div className={`pc-group-title ${cls}`}>{label}</div>
    )

    const headerCell = (cls: string) => () => ({ className: cls })
    const bodyCell = (cls: string) => ({ className: cls })

    const group = (title: string, cls: string, children: any[]) => ({
      title: groupTitle(title, cls),
      onHeaderCell: headerCell(cls),
      ...bodyCell(cls),
      children: children.map((c) => ({
        ...c,
        onHeaderCell: headerCell(cls),
        ...bodyCell(cls),
      })),
    })

    return [
      group('Activity Information', 'th-group-activity', [
        { title: 'Activity ID', dataIndex: 'activity_id', key: 'activity_id', width: 140, fixed: 'left' as const, ellipsis: true },
        { title: 'Title', dataIndex: 'activity_title', key: 'activity_title', width: 200, fixed: 'left' as const, ellipsis: true },
        { title: 'WBS Code', dataIndex: 'wbs_code', key: 'wbs_code', width: 100, fixed: 'left' as const, ellipsis: true },
      ]),
      group('Location Info', 'th-group-location', [
        { title: 'Discipline', dataIndex: 'discipline', key: 'discipline', width: 80 },
        { title: 'Work Package', dataIndex: 'work_package', key: 'work_package', width: 90 },
        { title: 'Block', dataIndex: 'block', key: 'block', width: 100 },
        { title: 'Scope', dataIndex: 'scope', key: 'scope', width: 70 },
      ]),
        group('Quantity & Completion', 'th-group-quantity', [
        { title: '预估总量', dataIndex: 'estimated_total', key: 'estimated_total', width: 90, align: 'right' as const, render: (v: string | null) => formatQuantity(v, 3, '-') },
        { title: '图纸批准量', dataIndex: 'drawing_approved_afc', key: 'drawing_approved_afc', width: 90, align: 'right' as const, render: (v: string | null) => formatQuantity(v, 3, '-') },
        { title: '材料到货量', dataIndex: 'material_arrived', key: 'material_arrived', width: 90, align: 'right' as const, render: (v: string | null) => formatQuantity(v, 3, '-') },
        { title: '可施工工作面', dataIndex: 'available_workface', key: 'available_workface', width: 90, align: 'right' as const, render: (v: string | null) => formatQuantity(v, 3, '-') },
        { title: '工作面受限（材料）', dataIndex: 'workface_restricted_material', key: 'workface_restricted_material', width: 90, align: 'right' as const, render: (v: string | null) => formatQuantity(v, 3, '-') },
        { title: '工作面受限（现场）', dataIndex: 'workface_restricted_site', key: 'workface_restricted_site', width: 90, align: 'right' as const, render: (v: string | null) => formatQuantity(v, 3, '-') },
        { title: '施工完成', dataIndex: 'construction_completed', key: 'construction_completed', width: 90, align: 'right' as const, render: (v: string | null) => formatQuantity(v, 3, '-') },
      ]),
      group('Inspection', 'th-group-inspection', [
        { title: 'RFI (A)', dataIndex: 'rfi_completed_a', key: 'rfi_completed_a', width: 90, align: 'right' as const, render: (v: string | null) => formatQuantity(v, 3, '-') },
        { title: 'RFI (B)', dataIndex: 'rfi_completed_b', key: 'rfi_completed_b', width: 90, align: 'right' as const, render: (v: string | null) => formatQuantity(v, 3, '-') },
        { title: 'RFI (C)', dataIndex: 'rfi_completed_c', key: 'rfi_completed_c', width: 90, align: 'right' as const, render: (v: string | null) => formatQuantity(v, 3, '-') },
      ]),
      group('Asbuilt', 'th-group-asbuilt', [
        { title: '竣工资料（R0）', dataIndex: 'asbuilt_signed_r0', key: 'asbuilt_signed_r0', width: 100, align: 'right' as const, render: (v: string | null) => formatQuantity(v, 3, '-') },
        { title: '竣工资料（R1）', dataIndex: 'asbuilt_signed_r1', key: 'asbuilt_signed_r1', width: 100, align: 'right' as const, render: (v: string | null) => formatQuantity(v, 3, '-') },
      ]),
      group('Payment', 'th-group-payment', [
        { title: 'OBP签署量', dataIndex: 'obp_signed', key: 'obp_signed', width: 100, align: 'right' as const, render: (v: string | null) => formatQuantity(v, 3, '-') },
      ]),
    ]
  }, [])

  // 使用可调整列宽 hook
  const { columns, tableWidth, tableRef: resizableTableRef, resetColumns } = useResizableColumns({
    persistKey: 'volume-control-list-v2',
    columns: defaultColumns,
    extraWidth: 50,
  })

  useEffect(() => {
    const el = tableAreaRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      // 汇总模式下，减去汇总工具栏的高度
      const summaryToolbar = el.querySelector('.summary-toolbar') as HTMLElement | null
      const summaryToolbarH = summaryToolbar?.getBoundingClientRect().height ?? 0
      
      const footerH = paginationBarRef.current?.getBoundingClientRect().height ?? 0
      const headerH =
        (el.querySelector('.volume-control-table .ant-table-header') as HTMLElement | null)?.getBoundingClientRect().height ??
        (el.querySelector('.ant-table-thead') as HTMLElement | null)?.getBoundingClientRect().height ??
        0
      const next = Math.max(160, Math.floor(h - footerH - headerH - summaryToolbarH - 16))
      setBodyHeight(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <LegacyModuleBanner
        compact
        title="遗留工程量控制"
        description="该页面延续原工程建设场景的设计量、材料到货量、施工量、RFI、竣工资料与支付签署口径，适合查询旧项目工程量控制数据。"
        note="机械制造建议以物料主数据、BOM、齐套、工单执行和订单成本为主线，不再用施工工程量口径承载主业务。"
        actions={[
          { label: '进入物料主数据', path: '/manufacturing/materials', type: 'primary' },
          { label: '进入 BOM 管理', path: '/manufacturing/bom' },
        ]}
      />

      <style>{`
        .volume-control-table .ant-table-thead > tr:first-child > th {
          padding: 0 !important;
          background: transparent !important;
        }
        .volume-control-table .ant-table-header .ant-table-thead > tr:first-child > th {
          padding: 0 !important;
          background: transparent !important;
        }

        /* 修复表头圆角与容器不一致的问题 - 更加激进的样式覆盖 */
        .volume-control-table,
        .volume-control-table .ant-table,
        .volume-control-table .ant-table-container,
        .volume-control-table .ant-table-header,
        .volume-control-table .ant-table-content {
          border-radius: 4px 4px 0 0 !important;
          overflow: hidden !important;
        }

        .volume-control-table .ant-table-thead > tr:first-child > th:first-child,
        .volume-control-table .ant-table-thead > tr:first-child > th:first-child .pc-group-title,
        .volume-control-table .ant-table-cell-fix-left:first-child,
        .volume-control-table .ant-table-cell-fix-left:first-child .pc-group-title {
          border-top-left-radius: 4px !important;
        }
        
        .volume-control-table .ant-table-thead > tr:first-child > th:last-child,
        .volume-control-table .ant-table-thead > tr:first-child > th:last-child .pc-group-title,
        .volume-control-table .ant-table-cell-fix-right:last-child,
        .volume-control-table .ant-table-cell-fix-right:last-child .pc-group-title {
          border-top-right-radius: 4px !important;
        }

        .pc-group-title {
          width: 100%;
          height: 100%;
          min-height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px 4px;
          color: #ffffff;
          font-weight: 600;
          font-size: 11px;
          user-select: none;
        }
        .pc-group-title.th-group-activity { background: rgba(24, 144, 255, 0.9); }
        .pc-group-title.th-group-location { background: rgba(82, 196, 26, 0.9); }
        .pc-group-title.th-group-quantity { background: rgba(250, 140, 22, 0.9); }
        .pc-group-title.th-group-inspection { background: rgba(235, 47, 150, 0.9); }
        .pc-group-title.th-group-asbuilt { background: rgba(47, 84, 235, 0.9); }
        .pc-group-title.th-group-payment { background: rgba(114, 46, 209, 0.9); }

        /* 极致截断：解决错行问题的核心 */
        .volume-control-table .ant-table-cell {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          padding: 4px 8px !important;
          max-width: 0 !important;
        }

        /* 确保单元格内部的所有 div 也不撑开，但允许汇总单元格使用 flex */
        .volume-control-table .ant-table-cell > div:not(.summary-cell-content),
        .volume-control-table .ant-table-cell .ant-table-cell-content {
          display: block !important;
          width: 100% !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .volume-control-table .ant-table-cell > div.summary-cell-content {
          display: flex !important;
          flex-direction: column !important;
          white-space: normal !important;
          justify-content: center !important;
          align-items: center !important;
        }

        /* 锁定表格布局 */
        .volume-control-table .ant-table table {
          table-layout: fixed !important;
          width: 100% !important;
        }

        .volume-control-table .ant-table-body,
        .volume-control-table .ant-table-content { 
          overflow: auto !important; 
        }
      `}</style>

      <div className="toolbar-row">
        <h2 className="page-title">工程量控制</h2>
        <Space>
            <Button
              icon={showSummary ? <ReloadOutlined /> : <BarChartOutlined />}
              size="small"
              onClick={() => setShowSummary(!showSummary)}
              type={showSummary ? 'primary' : 'default'}
            >
              {showSummary ? '返回列表' : '查看汇总统计'}
            </Button>
          <Input.Search
            placeholder="搜索作业ID或描述"
            allowClear size="small" style={{ width: 220 }}
            onSearch={(v) => setFilters({ ...filters, search: v })}
          />
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={resetColumns}
              title="重置列宽"
              disabled={showSummary}
            >
              重置列宽
            </Button>
            <Upload
              accept=".xlsx,.xls"
              showUploadList={false}
              customRequest={handleImportExcel}
              disabled={showSummary}
            >
              <Button icon={<ImportOutlined />} size="small" disabled={showSummary}>导入</Button>
            </Upload>
            <Dropdown menu={{ items: exportMenuItems }} trigger={['click']} disabled={showSummary}>
              <Button icon={<ExportOutlined />} size="small" disabled={showSummary}>导出</Button>
            </Dropdown>
        </Space>
      </div>

      <div
        ref={tableAreaRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#ffffff',
          borderRadius: '4px',
          border: '1px solid #e2e8f0',
          position: 'relative',
        }}
      >
        {showSummary ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="summary-toolbar" style={{ 
              padding: '8px 12px', 
              borderBottom: '1px solid #e2e8f0', 
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <Space wrap>
                <span style={{ fontWeight: 600, fontSize: 13 }}>汇总统计视图</span>
                <Divider type="vertical" />
                <span style={{ fontSize: 12, color: '#64748b' }}>分组方式:</span>
                <Radio.Group 
                  size="small" 
                  value={summaryGroupBy} 
                  onChange={e => setSummaryGroupBy(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="work_package">工作包</Radio.Button>
                  <Radio.Button value="resource_id_name">资源名称</Radio.Button>
                  <Radio.Button value="key_qty">只看主要工作项</Radio.Button>
                </Radio.Group>
                <Divider type="vertical" />
                <Segmented
                  size="small"
                  value={summaryViewMode}
                  onChange={(v) => setSummaryViewMode((v as 'table' | 'chart') || 'table')}
                  options={[
                    { label: '表格', value: 'table' },
                    { label: '图表', value: 'chart' },
                  ]}
                />
              </Space>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                注：基于当前所有筛选条件实时汇总
              </span>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', padding: summaryViewMode === 'chart' ? '16px' : '0 1px', display: 'flex', flexDirection: 'column' }}>
              {summaryViewMode === 'chart' ? (
                <>
                  <div
                    style={{
                      background: '#ffffff',
                      borderRadius: 12,
                      padding: 24,
                      border: '1px solid #e2e8f0',
                      flexShrink: 0,
                    }}
                  >
                    <KeyQuantitiesChart
                      items={summaryData || []}
                      height={Math.max(420, bodyHeight - 320)}
                      compact
                      lightBg
                    />
                  </div>
                  {summaryData && summaryData.length > 0 && (() => {
                    const rfiNames = buildRfiNamesConcat(summaryData)
                    if (!rfiNames) return null
                    return (
                      <div
                        style={{
                          marginTop: 12,
                          flexShrink: 0,
                          padding: '12px 16px',
                          background: '#f8fafc',
                          borderRadius: 8,
                          fontSize: 12,
                          color: '#475569',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#334155', marginBottom: 6 }}>验收量说明：</div>
                        <div style={{ lineHeight: 1.8 }}>
                          <div><strong>A：</strong>{rfiNames.rfi_a}</div>
                          <div><strong>B：</strong>{rfiNames.rfi_b}</div>
                          <div><strong>C：</strong>{rfiNames.rfi_c}</div>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
                          未施工 = 设计量 - 施工量（数据库无直接字段，按公式计算）
                        </div>
                      </div>
                    )
                  })()}
                </>
              ) : (
                <Table
                  className="volume-control-table"
                  dataSource={summaryData || []}
                  columns={summaryColumns}
                  size="small"
                  pagination={false}
                  loading={isSummaryLoading}
                  scroll={{ x: 'max-content', y: bodyHeight }}
                  sticky={true}
                  rowKey="group_name"
                  style={{ fontSize: '11px' }}
                  bordered
                />
              )}
            </div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }} ref={resizableTableRef}>
              {isPermissionError(error) ? (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  height: '100%',
                  color: '#ff4d4f',
                  fontSize: '16px',
                  fontWeight: 500
                }}>
                  您无权访问此模块
                </div>
              ) : (
                <Table
                  className="volume-control-table"
                  columns={columns}
                  dataSource={data?.items || []}
                  loading={isLoading}
                  rowKey="activity_id"
                  size="small"
                  scroll={{
                    x: tableWidth,
                    y: bodyHeight,
                  }}
                  sticky={true}
                  components={{
                    header: {
                      cell: ResizableHeaderCell,
                    },
                  }}
                  pagination={false}
                  onRow={(record) => ({
                    onClick: () => {
                      // 跳转到 ActivityListAdvanced 页面并选中该作业
                      navigate(`/activities-advanced?activity_id=${record.activity_id}`)
                    },
                    style: { cursor: 'pointer' },
                  })}
                />
              )}
            </div>

            <div
              ref={paginationBarRef}
              style={{
                flexShrink: 0,
                padding: '8px 12px',
                borderTop: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <Pagination
                size="small"
                current={pagination.current}
                pageSize={pagination.pageSize}
                total={data?.total || 0}
                showSizeChanger
                showTotal={(total) => `共 ${total} 条记录`}
                onChange={(page, pageSize) => setPagination({ current: page, pageSize })}
              />
            </div>
          </>
        )}
      </div>

      {/* 导出进度Modal */}
      <Modal
        open={exportProgress.visible}
        title="正在导出Excel"
        footer={null}
        closable={false}
        maskClosable={false}
        width={400}
      >
        <div style={{ padding: '20px 0' }}>
          <Progress 
            percent={exportProgress.percent} 
            status="active"
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          <div style={{ marginTop: 16, textAlign: 'center', color: '#666' }}>
            {exportProgress.text}
          </div>
        </div>
      </Modal>

      {/* 导入进度Modal */}
      <Modal
        open={importProgress.visible}
        title="正在导入Excel"
        footer={null}
        closable={false}
        maskClosable={false}
        width={400}
      >
        <div style={{ padding: '20px 0' }}>
          <Progress 
            percent={importProgress.percent} 
            status="active"
            strokeColor={{
              '0%': '#1890ff',
              '100%': '#52c41a',
            }}
          />
          <div style={{ marginTop: 16, textAlign: 'center', color: '#666' }}>
            {importProgress.text}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default VolumeControlList

