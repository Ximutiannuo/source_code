import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Table, Input, Button, Space, App, Dropdown, Pagination } from 'antd'
import { ExportOutlined, ReloadOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { activityService, type Activity } from '../services/activityService'
import { GlobalFilterContext } from '../components/layout/MainLayout'
import dayjs from 'dayjs'
import ExcelJS from 'exceljs'
import { useResizableColumns, ResizableHeaderCell } from '../hooks/useResizableColumns'
import type { ColumnsType } from 'antd/es/table'
import { formatQuantity } from '../utils/formatNumber'

const ActivityList = () => {
  const { message } = App.useApp()
  const globalFilter = useContext(GlobalFilterContext)
  const [filters, setFilters] = useState({
    block: '',
    search: '',
  })
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 })
  const tableAreaRef = useRef<HTMLDivElement | null>(null)
  const paginationBarRef = useRef<HTMLDivElement | null>(null)
  const [bodyHeight, setBodyHeight] = useState<number>(360)

  // 当全局筛选器变化时，重置分页到第一页
  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }))
  }, [globalFilter])

  // 合并全局筛选器和本地筛选器，转换为后端API需要的格式
  // 使用 useMemo 优化，只有在 filters 或 globalFilter 真正改变时才重新计算
  const mergedFilters = useMemo(() => {
    const filterObj: Record<string, any> = {}
    
    // 本地筛选器
    if (filters.block) {
      filterObj.block = filters.block
    }
    if (filters.search) {
      filterObj.search = { like: filters.search }
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

  // 使用 useMemo 优化 queryKey，避免不必要的重新计算
  const queryKey = useMemo(() => [
    'activities',
    mergedFilters,
    pagination.current,
    pagination.pageSize,
  ], [mergedFilters, pagination.current, pagination.pageSize])

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      // 使用 advanced API 以支持所有筛选字段
      const result = await activityService.getActivitiesAdvanced({
        filters: mergedFilters,
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize,
        order_by: [{ field: 'activity_id', order: 'asc' }],
      })
      return {
        items: Array.isArray(result.items) ? result.items : (Array.isArray(result) ? result : []),
        total: result.total || 0,
      }
    },
    staleTime: 30000, // 30秒内数据视为新鲜，减少重复请求
    gcTime: 300000, // 5分钟缓存时间（原 cacheTime）
    refetchOnWindowFocus: false, // 窗口聚焦时不自动重新获取，减少不必要的请求
  })

  const handleExportExcel = async () => {
    try {
      message.loading({ content: '正在导出Excel...', key: 'export', duration: 0 })
      const result = await activityService.getActivitiesAdvanced({
        filters: mergedFilters,
        skip: 0,
        limit: 100000,
        order_by: [{ field: 'activity_id', order: 'asc' }],
      })
      
      const items = result.items || []
      const headers = ['Type', 'Activity ID', 'WBS Code', 'Title', 'Project', 'Subproject', 'Train', 'Unit', 'Main Block', 'Quarter', 'Simple Block', 'Block', 'Discipline', 'Work Package', 'Scope', 'Implement Phase', 'Start Up Sequence', 'Contract Phase', 'Resource ID', 'UoM', 'SPE MHrs', 'Key Qty', 'Completed', 'Calculated MHrs', 'Actual Manhour', 'Weight Factor', 'Actual Weight Factor', 'Baseline1 Start Date', 'Baseline1 Finish Date', 'Duration', 'Planned Start Date', 'Planned Finish Date', 'Planned Duration', 'Start Date', 'Finish Date', 'At Completion Duration', 'Actual Start Date', 'Actual Finish Date']
      
      // 创建Excel工作簿
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('作业清单')
      
      // 设置工作表的默认行高（单位：点）
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
      
      // 添加表头
      const headerRow = worksheet.addRow(headers)
      headerRow.eachCell((cell) => {
        cell.style = headerStyle
      })
      // 设置表头行高（自动换行需要更高的行高，单位：点）
      headerRow.height = 80
      
      // 准备数据行
      const dataRows: any[][] = []
      items.forEach((item: Activity) => {
        dataRows.push([
          item.type || '',
          item.activity_id || '',
          item.wbs_code || '',
          item.title || '',
          item.project || '',
          item.subproject || '',
          item.train || '',
          item.unit || '',
          item.main_block || '',
          item.quarter || '',
          item.simple_block || '',
          item.block || '',
          item.discipline || '',
          item.work_package || '',
          item.scope || '',
          item.implement_phase || '',
          item.start_up_sequence || '',
          item.contract_phase || '',
          item.resource_id || '',
          item.uom || '',
          item.spe_mhrs ?? null,
          item.key_qty ?? null,
          item.completed ?? null,
          item.calculated_mhrs ?? null,
          item.actual_manhour ?? null,
          item.weight_factor ?? null,
          item.actual_weight_factor ?? null,
          item.baseline1_start_date ? dayjs(item.baseline1_start_date).format('YYYY-MM-DD') : null,
          item.baseline1_finish_date ? dayjs(item.baseline1_finish_date).format('YYYY-MM-DD') : null,
          item.actual_duration ?? null,
          item.planned_start_date ? dayjs(item.planned_start_date).format('YYYY-MM-DD') : null,
          item.planned_finish_date ? dayjs(item.planned_finish_date).format('YYYY-MM-DD') : null,
          item.planned_duration ?? null,
          item.start_date ? dayjs(item.start_date).format('YYYY-MM-DD') : null,
          item.finish_date ? dayjs(item.finish_date).format('YYYY-MM-DD') : null,
          item.at_completion_duration ?? null,
          item.actual_start_date ? dayjs(item.actual_start_date).format('YYYY-MM-DD') : null,
          item.actual_finish_date ? dayjs(item.actual_finish_date).format('YYYY-MM-DD') : null,
        ])
      })
      
      // 添加数据行
      dataRows.forEach((rowData) => {
        const row = worksheet.addRow(rowData)
        row.eachCell((cell, colNumber) => {
          const numColNumber = Number(colNumber)
          // 数值字段列（SPE MHrs, Key Qty, Completed, Calculated MHrs, Actual Manhour, Weight Factor, Actual Weight Factor, Duration, Planned Duration, At Completion Duration）
          const numericColumns = [21, 22, 23, 24, 25, 26, 27, 30, 33, 36]
          if (numericColumns.includes(numColNumber)) {
            // 对于数值字段列，根据值类型设置样式
            if (cell.value === null || cell.value === undefined) {
              // null值：不设置数字格式，保持为空单元格
              cell.style = {
                font: dataStyle.font,
                border: dataStyle.border,
                alignment: {
                  vertical: dataStyle.alignment?.vertical || 'middle'
                } as ExcelJS.Alignment
              }
              cell.value = null
            } else if (typeof cell.value === 'number') {
              // 数字值：设置样式和右对齐
              cell.style = dataStyle
              cell.alignment = { ...dataStyle.alignment, horizontal: 'right' } as ExcelJS.Alignment
            } else if (typeof cell.value === 'string') {
              // 字符串值：检查是否为数字格式，如果是则右对齐
              if (!isNaN(Number(cell.value)) && cell.value.trim() !== '') {
                // 字符串格式的数字值：设置样式和右对齐
                cell.style = dataStyle
                cell.alignment = { ...dataStyle.alignment, horizontal: 'right' } as ExcelJS.Alignment
              } else {
                // 普通字符串：设置基本样式
                cell.style = dataStyle
              }
            } else {
              // 其他类型：设置基本样式
              cell.style = dataStyle
            }
          } else {
            // 非数值字段列：设置基本样式
            cell.style = dataStyle
          }
        })
        // 设置数据行高（单位：点）
        row.height = 40
      })
      
      // 设置列宽（自动列宽）
      headers.forEach((header, index) => {
        const colIndex = index + 1
        const column = worksheet.getColumn(colIndex)
        
        // 计算列宽：根据表头和数据内容自动调整
        let maxLength = header.length
        
        // 检查数据行的内容长度
        dataRows.forEach((rowData) => {
          const value = rowData[index]
          if (value !== null && value !== undefined) {
            // 对于数字，计算格式化后的长度（考虑千分位和小数点）
            let length: number
            if (typeof value === 'number') {
              // 估算格式化后的长度：数字本身 + 千分位分隔符 + 小数点 + 2位小数
              const numStr = value.toString()
              const intPart = Math.floor(Math.abs(value))
              const intLength = intPart.toString().length
              const thousandSeparators = Math.floor((intLength - 1) / 3)
              length = numStr.length + thousandSeparators + 3 // +3 for decimal point and 2 decimals
            } else {
              length = String(value).length
            }
            if (length > maxLength) {
              maxLength = length
            }
          }
        })
        
        // 设置列宽：最小宽度10，加2个字符的边距，最大不超过50
        column.width = Math.min(Math.max(maxLength + 2, 10), 50)
      })
      
      // 生成Excel文件
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `作业清单_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
      message.success({ content: `已导出 ${items.length} 条记录`, key: 'export' })
    } catch (error: any) {
      message.error({ content: error?.response?.data?.detail || '导出失败', key: 'export' })
    }
  }

  const exportMenuItems: MenuProps['items'] = [
    { key: 'excel', label: '导出为 Excel', onClick: handleExportExcel },
  ]

  const defaultColumns: ColumnsType<Activity> = useMemo(() => {
    const groupTitle = (label: string, cls: string) => (
      <div className={`pc-group-title ${cls}`}>{label}</div>
    )

    // 注意：AntD 分组表头的 th 结构在 fixed/scroll 时会复制多份，直接给 th 上色并不稳定。
    // 这里改为：分组标题本身渲染彩色块；th 背景置透明、padding 置 0（在 CSS 中做），保证视觉稳定。
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
        { 
          title: '状态', 
          key: 'status', 
          width: 60, 
          fixed: 'left' as const, 
          align: 'center' as const,
          render: (_: any, record: Activity) => {
            const status = record.system_status || record.status || 'Not Started'
            const roundedRectStyle: React.CSSProperties = {
              width: '14px',
              height: '10px',
              borderRadius: '2px',
              display: 'inline-block',
              border: '1px solid rgba(0,0,0,0.3)',
              verticalAlign: 'middle'
            }
            if (status === 'Completed') return <span style={{ ...roundedRectStyle, backgroundColor: '#0000FF' }} title="Completed" />
            if (status === 'In Progress') return <span style={{ ...roundedRectStyle, background: 'linear-gradient(to right, #0000FF 50%, #00FF00 50%)' }} title="In Progress" />
            return <span style={{ ...roundedRectStyle, backgroundColor: '#00FF00' }} title="Not Started" />
          }
        },
        { title: 'Type', dataIndex: 'type', key: 'type', width: 100, fixed: 'left' as const },
        { title: 'Activity ID', dataIndex: 'activity_id', key: 'activity_id', width: 140, fixed: 'left' as const, ellipsis: true },
        { title: 'WBS Code', dataIndex: 'wbs_code', key: 'wbs_code', width: 70, fixed: 'left' as const, ellipsis: true },
        { title: 'Title', dataIndex: 'title', key: 'title', width: 200, fixed: 'left' as const, ellipsis: true },
      ]),
      group('Location Info', 'th-group-location', [
        { title: 'Project', dataIndex: 'project', key: 'project', width: 70 },
        { title: 'Subproject', dataIndex: 'subproject', key: 'subproject', width: 70 },
        { title: 'Train', dataIndex: 'train', key: 'train', width: 70 },
        { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 70 },
        { title: 'Main Block', dataIndex: 'main_block', key: 'main_block', width: 70 },
        { title: 'Quarter', dataIndex: 'quarter', key: 'quarter', width: 70 },
        { title: 'Simple Block', dataIndex: 'simple_block', key: 'simple_block', width: 70 },
        { title: 'Block', dataIndex: 'block', key: 'block', width: 100 },
      ]),
      group('Work Category Information', 'th-group-work', [
        { title: 'Discipline', dataIndex: 'discipline', key: 'discipline', width: 70 },
        { title: 'Work Package', dataIndex: 'work_package', key: 'work_package', width: 70 },
        { title: 'Scope', dataIndex: 'scope', key: 'scope', width: 70 },
        { title: 'Implement Phase', dataIndex: 'implement_phase', key: 'implement_phase', width: 70 },
        { title: 'Start Up Sequence', dataIndex: 'start_up_sequence', key: 'start_up_sequence', width: 70 },
        { title: 'Contract Phase', dataIndex: 'contract_phase', key: 'contract_phase', width: 70 },
      ]),
      group('Resource Information', 'th-group-resource', [
        { title: 'Resource ID', dataIndex: 'resource_id', key: 'resource_id', width: 90 },
        { title: 'UoM', dataIndex: 'uom', key: 'uom', width: 60 },
        { title: 'SPE MHrs', dataIndex: 'spe_mhrs', key: 'spe_mhrs', width: 70, align: 'right' as const, render: (v: number) => formatQuantity(v, 3, '-') },
        { title: 'Key Qty', dataIndex: 'key_qty', key: 'key_qty', width: 70, align: 'right' as const, render: (v: number) => formatQuantity(v, 3, '-') },
        { title: 'Completed', dataIndex: 'completed', key: 'completed', width: 90, align: 'right' as const, render: (v: number) => formatQuantity(v, 3, '-') },
        { title: 'Calculated MHrs', dataIndex: 'calculated_mhrs', key: 'calculated_mhrs', width: 70, align: 'right' as const, render: (v: number) => formatQuantity(v, 3, '-') },
        { title: 'Actual Manhour', dataIndex: 'actual_manhour', key: 'actual_manhour', width: 110, align: 'right' as const, render: (v: number) => formatQuantity(v, 3, '-') },
        { title: 'Weight Factor', dataIndex: 'weight_factor', key: 'weight_factor', width: 70, align: 'right' as const, render: (v: number) => formatQuantity(v, 3, '-') },
        { title: 'Actual Weight Factor', dataIndex: 'actual_weight_factor', key: 'actual_weight_factor', width: 100, align: 'right' as const, render: (v: number) => formatQuantity(v, 3, '-') },
      ]),
      group('Date Information', 'th-group-date', [
        { title: 'Baseline1 Start', dataIndex: 'baseline1_start_date', key: 'baseline1_start_date', width: 110, render: (d: string) => (d ? dayjs(d).format('YYYY-MM-DD') : '-') },
        { title: 'Baseline1 Finish', dataIndex: 'baseline1_finish_date', key: 'baseline1_finish_date', width: 110, render: (d: string) => (d ? dayjs(d).format('YYYY-MM-DD') : '-') },
        { title: 'Duration', dataIndex: 'actual_duration', key: 'actual_duration', width: 90, align: 'right' as const, render: (v: number) => (v ?? '-') },
        { title: 'Planned Start', dataIndex: 'planned_start_date', key: 'planned_start_date', width: 110, render: (d: string) => (d ? dayjs(d).format('YYYY-MM-DD') : '-') },
        { title: 'Planned Finish', dataIndex: 'planned_finish_date', key: 'planned_finish_date', width: 110, render: (d: string) => (d ? dayjs(d).format('YYYY-MM-DD') : '-') },
        { title: 'Planned Duration', dataIndex: 'planned_duration', key: 'planned_duration', width: 90, align: 'right' as const, render: (v: number) => (v ?? '-') },
        { title: 'Start Date', dataIndex: 'start_date', key: 'start_date', width: 110, render: (d: string) => (d ? dayjs(d).format('YYYY-MM-DD') : '-') },
        { title: 'Finish Date', dataIndex: 'finish_date', key: 'finish_date', width: 110, render: (d: string) => (d ? dayjs(d).format('YYYY-MM-DD') : '-') },
        { title: 'At Completion Duration', dataIndex: 'at_completion_duration', key: 'at_completion_duration', width: 110, align: 'right' as const, render: (v: number) => (v ?? '-') },
        { title: 'Actual Start Date', dataIndex: 'actual_start_date', key: 'actual_start_date', width: 110, render: (d: string) => (d ? dayjs(d).format('YYYY-MM-DD') : '-') },
        { title: 'Actual Finish Date', dataIndex: 'actual_finish_date', key: 'actual_finish_date', width: 110, render: (d: string) => (d ? dayjs(d).format('YYYY-MM-DD') : '-') },
      ]),
    ]
  }, [])

  // 使用可调整列宽 hook
  const { columns, tableWidth, tableRef: resizableTableRef, resetColumns } = useResizableColumns({
    persistKey: 'activity-list-v2',
    columns: defaultColumns,
    extraWidth: 50,
  })

  useEffect(() => {
    const el = tableAreaRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      const footerH = paginationBarRef.current?.getBoundingClientRect().height ?? 56
      const headerH =
        (el.querySelector('.activity-list-table .ant-table-header') as HTMLElement | null)?.getBoundingClientRect().height ??
        0
      // 关键：需要同时扣掉表头高度，否则 Table 总高度 = headerH + bodyHeight，会超出容器，横向滚动条在 100% 缩放时被裁掉
      const next = Math.max(160, Math.floor(h - footerH - headerH - 16))
      setBodyHeight(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        /* 分组行：去掉 th 自身的 padding + 背景，显示我们渲染的彩色 title 块 */
        .activity-list-table .ant-table-thead > tr:first-child > th {
          padding: 0 !important;
          background: transparent !important;
        }
        .activity-list-table .ant-table-header .ant-table-thead > tr:first-child > th {
          padding: 0 !important;
          background: transparent !important;
        }

        /* 修复表头圆角与容器不一致的问题 - 更加激进的样式覆盖 */
        .activity-list-table,
        .activity-list-table .ant-table,
        .activity-list-table .ant-table-container,
        .activity-list-table .ant-table-header,
        .activity-list-table .ant-table-content {
          border-radius: 4px 4px 0 0 !important;
          overflow: hidden !important;
        }

        .activity-list-table .ant-table-thead > tr:first-child > th:first-child,
        .activity-list-table .ant-table-thead > tr:first-child > th:first-child .pc-group-title,
        .activity-list-table .ant-table-cell-fix-left:first-child,
        .activity-list-table .ant-table-cell-fix-left:first-child .pc-group-title {
          border-top-left-radius: 4px !important;
        }
        
        .activity-list-table .ant-table-thead > tr:first-child > th:last-child,
        .activity-list-table .ant-table-thead > tr:first-child > th:last-child .pc-group-title,
        .activity-list-table .ant-table-cell-fix-right:last-child,
        .activity-list-table .ant-table-cell-fix-right:last-child .pc-group-title {
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
        .pc-group-title.th-group-work { background: rgba(250, 140, 22, 0.9); }
        .pc-group-title.th-group-resource { background: rgba(235, 47, 150, 0.9); }
        .pc-group-title.th-group-date { background: rgba(47, 84, 235, 0.9); }

        /* 极致截断：解决错行问题的核心 */
        .activity-list-table .ant-table-cell {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          padding: 4px 8px !important;
          max-width: 0 !important; /* 核心 hack：强制让 cell 宽度遵从 colgroup */
        }

        /* 确保单元格内部的所有 div 也不撑开高度/宽度 */
        .activity-list-table .ant-table-cell > div,
        .activity-list-table .ant-table-cell .ant-table-cell-content {
          display: block !important;
          width: 100% !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        /* 锁定表格布局 */
        .activity-list-table .ant-table table {
          table-layout: fixed !important;
          width: 100% !important; /* 让 AntD 的 scroll.x 驱动表格宽度 */
        }
        
        /* 确保内容区域支持滚动且不挤压 */
        .activity-list-table .ant-table-content,
        .activity-list-table .ant-table-body {
          overflow: auto !important;
        }
      `}</style>

      <div className="toolbar-row">
        <h2 className="page-title">Activities</h2>
        <Space>
          <Input.Search
            placeholder="搜索作业ID或描述"
            allowClear size="small" style={{ width: 220 }}
            onSearch={(v) => {
              setFilters({ ...filters, search: v })
              // 搜索时重置到第一页
              setPagination(prev => ({ ...prev, current: 1 }))
            }}
          />
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={resetColumns}
            title="重置列宽"
          >
            重置列宽
          </Button>
          <Dropdown menu={{ items: exportMenuItems }} trigger={['click']}>
            <Button icon={<ExportOutlined />} size="small">导出</Button>
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
          position: 'relative', // 确保圆角裁切在 sticky 元素上生效
        }}
      >
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }} ref={resizableTableRef}>
          <Table
            className="activity-list-table"
            columns={columns}
            dataSource={data?.items || []}
            loading={isLoading}
            rowKey="id"
            size="small"
            scroll={{
              x: tableWidth,
              y: bodyHeight,
            }}
            components={{
              header: {
                cell: ResizableHeaderCell,
              },
            }}
            pagination={false}
          />
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
      </div>
    </div>
  )
}

export default ActivityList
