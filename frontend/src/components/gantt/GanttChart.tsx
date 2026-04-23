import React, { useRef, useEffect, useState, useCallback, useMemo, type RefObject } from 'react'
import { Activity } from '../../services/activityService'
import dayjs, { Dayjs } from 'dayjs'
import { logger } from '../../utils/logger'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import updateLocale from 'dayjs/plugin/updateLocale'
import { CaretRightOutlined, CaretDownOutlined } from '@ant-design/icons'
import './GanttChart.css'

dayjs.extend(weekOfYear)
dayjs.extend(quarterOfYear)
dayjs.extend(updateLocale)

// 全局配置：周五作为一周的开始 (0: Sunday, 1: Monday, ..., 5: Friday)
// 同时适配 en 和 zh-cn 常用语言环境
const updateDayjsLocale = () => {
  const weekStart = 5; // 周五
  try {
    dayjs.updateLocale('en', { weekStart });
    dayjs.updateLocale('zh-cn', { weekStart });
  } catch (e) {
    // 忽略未加载的 locale 错误
  }
};
updateDayjsLocale();

export interface GanttTask {
  id: string | number
  text: string
  start_date: string | Dayjs | null
  end_date: string | Dayjs | null
  duration?: number
  progress?: number
  type?: 'task' | 'project' | 'milestone'
  parent?: string | number
  open?: boolean
  activity?: Activity
}

export interface TimescaleConfig {
  format: 'two' | 'three'
  primaryType: 'calendar' | 'ordinal'
  primaryInterval: 'day' | 'week' | 'month' | 'quarter' | 'year'
  secondaryInterval?: 'day' | 'week' | 'month' | 'quarter' | 'year' // 第二行间隔（三行格式时）
  showOrdinal: boolean
  ordinalInterval: 'day' | 'week' | 'month' | 'quarter' | 'year'
  zoomLevel?: number // 缩放级别，1.0 = 100%，影响时间刻度的宽度
  startDate?: string | Dayjs // 时间刻度开始日期
  endDate?: string | Dayjs // 时间刻度结束日期
}

export interface TimeScaleItem {
  date: Dayjs
  label: string
  width: number
  startDate: Dayjs
  endDate: Dayjs
  fontSize?: number
  showLabel?: boolean
}

export interface GanttColumn {
  key: string
  title: string
  width: number
  fixed?: 'left' | 'right'
  align?: 'left' | 'center' | 'right'
  render?: (value: any, record: GanttTask) => React.ReactNode
  resizable?: boolean // 是否可调整宽度
}

// P6经典配色方案（默认）- 基于P6官方RGB值，支持9个层级
export interface TaskLevelColors {
  level0: string // 第0层（LEVEL 1）：浅绿色 #80FF80
  level1: string // 第1层（LEVEL 2）：黄色 #FFFF00
  level2: string // 第2层（LEVEL 3）：蓝色 #0000FF
  level3: string // 第3层（LEVEL 4）：红色 #FF0000
  level4: string // 第4层（LEVEL 5）：青色 #80FFFF
  level5: string // 第5层（LEVEL 6）：洋红色 #FF80FF
  level6: string // 第6层（LEVEL 7）：浅黄色 #FFFF80
  level7: string // 第7层（LEVEL 8）：白色 #FFFFFF
  level8: string // 第8层（LEVEL 9）：浅灰色 #F0F0F0
}

export const DEFAULT_TASK_COLORS: TaskLevelColors = {
  level0: '#80FF80', // LEVEL 1: R=128, G=255, B=128 (浅绿色)
  level1: '#FFFF00', // LEVEL 2: R=255, G=255, B=0 (黄色)
  level2: '#0000FF', // LEVEL 3: R=0, G=0, B=255 (蓝色)
  level3: '#FF0000', // LEVEL 4: R=255, G=0, B=0 (红色)
  level4: '#80FFFF', // LEVEL 5: R=128, G=255, B=255 (青色)
  level5: '#FF80FF', // LEVEL 6: R=255, G=128, B=255 (洋红色)
  level6: '#FFFF80', // LEVEL 7: R=255, G=255, B=128 (浅黄色)
  level7: '#FFFFFF', // LEVEL 8: R=255, G=255, B=255 (白色)
  level8: '#F0F0F0', // LEVEL 9: R=240, G=240, B=240 (浅灰色)
}

interface GanttChartProps {
  tasks: GanttTask[]
  columns: GanttColumn[]
  gridWidth: number
  onGridWidthChange?: (width: number) => void
  timescaleConfig: TimescaleConfig
  rowHeight?: number
  density?: 'default' | 'compact'
  onTaskClick?: (task: GanttTask, e?: React.MouseEvent) => void
  onTaskDblClick?: (task: GanttTask) => void
  onGroupSelectAll?: (groupId: string) => void // Ctrl+点击分组行时选中该分组内所有作业
  selectedTaskId?: string | number | null
  selectedTaskIds?: (string | number)[]
  onZoomChange?: (zoom: number) => void // 缩放变化回调
  onColumnsChange?: (columns: GanttColumn[]) => void // 列配置变化回调（用于保存列宽）
  onScrollRefsReady?: (gridScrollRef: RefObject<HTMLDivElement>, timelineScrollRef: RefObject<HTMLDivElement>) => void // 滚动容器ref回调
  taskColors?: TaskLevelColors // 任务层级颜色配置（可选，默认使用P6经典配色）
  onGroupToggle?: (groupId: string, isExpanded: boolean) => void // 分组折叠/展开回调
  groupItemCounts?: Map<string, number> // 分组子项数量（用于显示）
  hideTimeline?: boolean // 是否隐藏时间轴（仅作为高性能表格使用）
}

const GanttChart: React.FC<GanttChartProps> = ({
  tasks,
  columns,
  gridWidth,
  onGridWidthChange,
  timescaleConfig,
  rowHeight = 30,
  density = 'default',
  onTaskClick,
  onTaskDblClick,
  onGroupSelectAll,
  selectedTaskId,
  selectedTaskIds,
  onZoomChange,
  onColumnsChange,
  onScrollRefsReady,
  taskColors = DEFAULT_TASK_COLORS,
  onGroupToggle,
  groupItemCounts,
  hideTimeline = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const verticalScrollRef = useRef<HTMLDivElement>(null) // 单一纵向滚动容器（表格+横道图联动）
  const gridScrollRef = useRef<HTMLDivElement>(null)
  const gridHeaderWrapperRef = useRef<HTMLDivElement>(null)
  const timelineScrollRef = useRef<HTMLDivElement>(null)
  const timelineHorizontalScrollRef = useRef<HTMLDivElement>(null)
  const separatorRef = useRef<HTMLDivElement>(null)
  
  const [isResizing, setIsResizing] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(timescaleConfig.zoomLevel || 1.0)
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0) // 跟踪timeline滚动位置，确保任务条响应拖拽
  
  // 虚拟滚动状态
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({ start: 0, end: 100 })
  const overscan = 5 // 额外渲染的行数（上下各5行），提升滚动体验
  const virtualScrollThreshold = 100 // 任务数量超过此阈值时才启用虚拟滚动
  
  // 列宽调整状态
  const [isColumnResizing, setIsColumnResizing] = useState(false)
  const [resizingColumnIndex, setResizingColumnIndex] = useState<number | null>(null)
  const [columnResizeStartX, setColumnResizeStartX] = useState(0)
  const [columnResizeStartWidth, setColumnResizeStartWidth] = useState(0)
  // 初始化localColumns - 使用columns参数，确保第一次渲染时就有值
  const [localColumns, setLocalColumns] = useState<GanttColumn[]>(() => {
    logger.log('GanttChart: Initializing localColumns with', columns.length, 'columns')
    return columns.length > 0 ? columns : []
  })
  
  // 调试：检查tasks和columns是否正确传递（仅开发环境）
  useEffect(() => {
    logger.log('GanttChart received tasks:', tasks.length, 'tasks')
    logger.log('GanttChart received columns:', columns.length, 'columns')
    logger.log('GanttChart localColumns:', localColumns.length, 'localColumns')
    if (tasks.length > 0) {
      logger.log('First task:', { id: tasks[0].id, text: tasks[0].text, type: tasks[0].type, hasActivity: !!tasks[0].activity })
    } else {
      logger.warn('WARNING: tasks array is empty!')
    }
    if (localColumns.length > 0) {
      logger.log('First column:', { key: localColumns[0].key, title: localColumns[0].title, width: localColumns[0].width })
    }
  }, [tasks, columns, localColumns])
  
  // 检查DOM元素 - 使用单独的useEffect，在渲染后检查
  useEffect(() => {
    const checkElement = () => {
      const gridBody = gridScrollRef.current
      const grid = gridRef.current
      const container = containerRef.current
      
      logger.log('=== Layout Debug ===')
      logger.log('containerRef (gantt-chart-container):', {
        offsetHeight: container?.offsetHeight,
        offsetWidth: container?.offsetWidth,
        clientHeight: container?.clientHeight,
      })
      
      // 检查 gantt-content
      const content = container?.querySelector('.gantt-content') as HTMLElement
      logger.log('gantt-content:', {
        offsetHeight: content?.offsetHeight,
        offsetWidth: content?.offsetWidth,
        clientHeight: content?.clientHeight,
        computedHeight: content ? window.getComputedStyle(content).height : 'N/A',
      })
      
      logger.log('gridRef (gantt-grid):', {
        offsetHeight: grid?.offsetHeight,
        offsetWidth: grid?.offsetWidth,
        clientHeight: grid?.clientHeight,
      })
      logger.log('gridScrollRef (gantt-grid-body):', {
        offsetHeight: gridBody?.offsetHeight,
        scrollHeight: gridBody?.scrollHeight,
        childrenCount: gridBody?.children.length,
      })
    }
    // 延迟检查，确保DOM已更新
    setTimeout(checkElement, 500)
  }, [tasks.length])
  
  // 同步外部columns变化 - 确保渲染函数等属性始终最新，同时保留本地调整的宽度
  useEffect(() => {
    if (columns.length === 0) return

    setLocalColumns(prevLocal => {
      // 如果本地还没有列，直接使用外部传入的
      if (prevLocal.length === 0) return columns

      // 映射外部列，但保留本地调整过的宽度
      return columns.map(externalCol => {
        const localCol = prevLocal.find(l => l.key === externalCol.key)
        return {
          ...externalCol,
          width: localCol ? localCol.width : externalCol.width
        }
      })
    })
  }, [columns])

  // 同步外部zoomLevel变化
  useEffect(() => {
    if (timescaleConfig.zoomLevel !== undefined) {
      setZoomLevel(timescaleConfig.zoomLevel)
    }
  }, [timescaleConfig.zoomLevel])
  
  // 建立任务索引 Map，优化查找性能（O(1) 而不是 O(n)）
  const taskMap = useMemo(() => {
    const map = new Map<string | number, GanttTask>()
    tasks.forEach(task => {
      map.set(task.id, task)
    })
    return map
  }, [tasks])
  
  // 计算任务的层级（outline level）- 通过parent链向上查找到根节点
  const getTaskLevel = useCallback((task: GanttTask): number => {
    // 如果是分组行（type === 'project'），通过parent链计算层级
    if (task.type === 'project') {
      if (!task.parent) {
        return 0 // 根级别（项目级别）
      }
      // 有parent，向上查找
      let level = 1
      let current: GanttTask | undefined = taskMap.get(task.parent)
      while (current && current.parent) {
        level++
        current = taskMap.get(current.parent)
      }
      return level
    }
    
    // 普通任务：层级 = 父分组的层级 + 1
    if (!task.parent) {
      return 1 // 没有parent，默认第1层
    }
    
    // 找到父分组，计算父分组的层级
    const parentTask = tasks.find(t => t.id === task.parent)
    if (!parentTask) {
      return 1 // 找不到父分组，默认第1层
    }
    
    // 递归计算父分组的层级
    let parentLevel = 0
    if (parentTask.type === 'project') {
      // 父分组是分组行，计算它的层级
      if (!parentTask.parent) {
        parentLevel = 0
      } else {
        let level = 1
        let current: GanttTask | undefined = taskMap.get(parentTask.parent)
        while (current && current.parent) {
          level++
          current = taskMap.get(current.parent)
        }
        parentLevel = level
      }
    } else {
      // 父任务也是普通任务（不应该发生，但容错处理）
      parentLevel = 1
    }
    
    // 普通任务的层级 = 父分组层级 + 1
    return parentLevel + 1
  }, [taskMap])
  
  // 根据任务状态返回颜色（不基于层级；匹配P6：未开始绿/完成蓝/进行中绿底+蓝进度/关键红）
  const getTaskBarColor = useCallback((task: GanttTask, isGroupRow: boolean): { 
    background: string
    borderTop?: string
    borderBottom?: string
    leftBarColor?: string
    completedBackground?: string // 已完成部分的背景色（用于进行中的任务）
    completedWidth?: string // 已完成部分的宽度百分比
  } => {
    // 分组汇总条：仍然使用层级颜色
    if (isGroupRow) {
      const level = getTaskLevel(task)
      const colors = [
        taskColors.level0, // LEVEL 1
        taskColors.level1, // LEVEL 2
        taskColors.level2, // LEVEL 3
        taskColors.level3, // LEVEL 4
        taskColors.level4, // LEVEL 5
        taskColors.level5, // LEVEL 6
        taskColors.level6, // LEVEL 7
        taskColors.level7, // LEVEL 8
        taskColors.level8, // LEVEL 9
      ]
      const colorIndex = Math.min(level, colors.length - 1)
      const color = colors[colorIndex]
      
      return {
        background: 'rgba(31, 78, 120, 0.1)', // 浅色背景
        borderTop: `2px solid ${color}`,
        borderBottom: `2px solid ${color}`,
        leftBarColor: color, // 左侧竖条颜色
      }
    }
    
    // 普通任务条：根据状态返回颜色（P6样式）
    const activity = task.activity
    if (!activity) {
      // 没有activity数据，使用默认颜色
      return { background: '#0000FF' }
    }
    
    const hasActualStart = !!(activity.actual_start_date || (activity as any).actual_start)
    const hasActualFinish = !!(activity.actual_finish_date || (activity as any).actual_finish)
    const isCritical = !!(activity.iscritical || (activity as any).iscritical)
    const isLongestPath = !!(activity.islongestpath || (activity as any).islongestpath)
    
    // 获取本系统状态
    const systemStatus = activity.system_status || (hasActualFinish ? 'Completed' : (hasActualStart ? 'In Progress' : 'Not Started'))

    // 红色：关键路径且最长路径（优先级最高）
    if (isCritical && isLongestPath) {
      return { background: '#FF0000' } // 红色
    }
    
    // 完全绿色：未开始
    if (systemStatus === 'Not Started') {
      return { background: '#00FF00' } // 绿色
    }
    
    // 完全蓝色：已完成
    if (systemStatus === 'Completed') {
      return { background: '#0000FF' } // 蓝色
    }
    
    // 进行中：绿底+蓝进度（以 Data Date 分割）
    if (systemStatus === 'In Progress') {
      // 获取分割日期：优先使用 data_date，否则使用当前日期
      const dataDate = activity.data_date || (activity as any).data_date
      const splitDate = dataDate ? dayjs(dataDate) : dayjs()
      
      const barStart = dayjs(task.start_date)
      const barEnd = dayjs(task.end_date)
      const barDuration = Math.max(barEnd.diff(barStart, 'day'), 1)
      
      let completedWidth: string | null = null
      
      // 判断是否为 Task Dependent 类型
      const isTaskDependent = activity.type && (
        activity.type.toLowerCase() === 'task dependent' ||
        activity.type.toLowerCase().includes('task dependent') ||
        activity.type.toLowerCase() === 'dependent task'
      )
      
      if (isTaskDependent) {
        // Task Dependent 类型：强制使用 data_date 作为分割点，确保在时间轴上视觉对齐
        if (splitDate.isAfter(barStart) && splitDate.isBefore(barEnd)) {
          const daysFromStart = splitDate.diff(barStart, 'day')
          const percent = Math.min(100, Math.max(0, (daysFromStart / barDuration) * 100))
          completedWidth = `${percent}%`
        } else if (splitDate.isAfter(barEnd) || splitDate.isSame(barEnd)) {
          completedWidth = '100%'
        } else {
          completedWidth = '0%'
        }
      } else {
        // 非 Task Dependent 类型：优先使用完成百分比
        let completedPercent: number | null = null
        if (typeof task.progress === 'number' && !Number.isNaN(task.progress) && task.progress > 0) {
          completedPercent = Math.min(100, Math.max(0, task.progress * 100))
        } else if (typeof activity.completed === 'number' && !Number.isNaN(activity.completed) && activity.completed > 0) {
          completedPercent = Math.min(100, Math.max(0, activity.completed))
        }

        // 没有完成度或完成度为0时，使用 data_date 作为分割参考，确保视觉对齐
        if (completedPercent === null || completedPercent === 0) {
          if (splitDate.isAfter(barStart) && splitDate.isBefore(barEnd)) {
            const daysFromStart = splitDate.diff(barStart, 'day')
            completedPercent = Math.min(100, Math.max(0, (daysFromStart / barDuration) * 100))
          } else if (splitDate.isAfter(barEnd) || splitDate.isSame(barEnd)) {
            completedPercent = 100
          } else {
            completedPercent = 0
          }
        }
        
        completedWidth = completedPercent !== null ? `${completedPercent}%` : null
      }

      return {
        background: '#00FF00', // 绿色（未完成部分）
        completedBackground: '#0000FF', // 蓝色（已完成部分）
        completedWidth: completedWidth || '0%',
      }
    }
    
    // 默认：蓝色
    return { background: '#0000FF' }
  }, [getTaskLevel, taskColors])
  
  // 获取分组行的背景色（P6风格：浅色背景，支持9个层级）
  const getGroupRowBackgroundColor = useCallback((level: number): string => {
    const colors = [
      taskColors.level0, // LEVEL 1
      taskColors.level1, // LEVEL 2
      taskColors.level2, // LEVEL 3
      taskColors.level3, // LEVEL 4
      taskColors.level4, // LEVEL 5
      taskColors.level5, // LEVEL 6
      taskColors.level6, // LEVEL 7
      taskColors.level7, // LEVEL 8
      taskColors.level8, // LEVEL 9
    ]
    const colorIndex = Math.min(level, colors.length - 1)
    const baseColor = colors[colorIndex]
    
    // 将RGB颜色转换为浅色背景（增加亮度，降低饱和度）
    // 简单方法：将颜色与白色混合
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null
    }
    
    const rgb = hexToRgb(baseColor)
    if (!rgb) return '#f0f2f5' // 默认浅灰色
    
    // 与白色混合（85%白色 + 15%原色），得到浅色背景
    const lightR = Math.round(rgb.r * 0.15 + 255 * 0.85)
    const lightG = Math.round(rgb.g * 0.15 + 255 * 0.85)
    const lightB = Math.round(rgb.b * 0.15 + 255 * 0.85)
    
    return `rgb(${lightR}, ${lightG}, ${lightB})`
  }, [taskColors])
  
  // 计算时间范围 - 优先使用用户设置的时间范围，否则使用默认固定范围
  const timeRange = useMemo(() => {
    // 如果用户设置了时间范围，优先使用
    if (timescaleConfig.startDate && timescaleConfig.endDate) {
      return {
        start: dayjs(timescaleConfig.startDate),
        end: dayjs(timescaleConfig.endDate),
      }
    }
    
    // 否则使用默认的固定时间范围（2019-10-11到2028-12-31）
    // 任务条的位置将根据任务日期在这个固定范围内的相对位置来计算
    return {
      start: dayjs('2019-10-11'),
      end: dayjs('2028-12-31'),
    }
  }, [timescaleConfig.startDate, timescaleConfig.endDate])
  
  // 辅助函数：根据间隔获取父级单位
  const getParentInterval = (interval: string): dayjs.OpUnitType => {
    switch (interval) {
      case 'day': return 'month';
      case 'week': return 'month';
      case 'month': return 'year';
      case 'quarter': return 'year';
      case 'year': return 'year';
      default: return 'year';
    }
  };

  // 辅助函数：格式化时间标签
  const formatScaleLabel = (date: dayjs.Dayjs, interval: string, type: 'calendar' | 'ordinal', start: dayjs.Dayjs): string => {
    if (type === 'ordinal') {
      const diff = date.diff(start, interval as dayjs.OpUnitType) + 1;
      return `${diff}`;
    }

    switch (interval) {
      case 'year': return date.format('YYYY');
      case 'quarter': return `Q${date.quarter()}`; // 仅显示 Q1, Q2...
      case 'month': return date.format('MMM'); // 仅显示 Jan, Feb...
      case 'week': return `W${date.week()}`; // 仅显示周数
      case 'day': return date.format('D'); // 仅显示日数字
      default: return date.format('YYYY-MM-DD');
    }
  };

  // 辅助函数：计算单行刻度
  const calculateScaleRow = (
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    interval: string,
    type: 'calendar' | 'ordinal',
    unitWidth: number,
    baseStart: dayjs.Dayjs
  ): TimeScaleItem[] => {
    const items: TimeScaleItem[] = [];
    let current = start.startOf(interval as dayjs.OpUnitType);
    const unit = interval as any; // 使用 any 避免 dayjs 版本间 ManipulateType 的类型不匹配
    
    // 限制最大循环次数，防止死循环（如 10 年按天显示约 3650 次）
    let iterations = 0;
    while ((current.isBefore(end) || current.isSame(end)) && iterations < 5000) {
      iterations++;
      const itemStart = current;
      const itemEnd = current.add(1, unit);
      
      // 计算宽度：基于天数比例，确保跨月/跨年时的精确度
      const daysInPeriod = itemEnd.diff(itemStart, 'day');
      const width = daysInPeriod * (unitWidth / (unit === 'day' ? 1 : 30)); // 粗略估算，后续通过对齐修正
      
      items.push({
        date: itemStart,
        label: formatScaleLabel(itemStart, interval, type, baseStart),
        width: width, // 初始宽度，会被父级重新计算
        startDate: itemStart,
        endDate: itemEnd,
        showLabel: true
      });
      current = itemEnd;
    }
    return items;
  };

  // 计算时间刻度
  const timeScale = useMemo(() => {
    const { start, end } = timeRange;
    const { format, primaryInterval, secondaryInterval, primaryType, showOrdinal, ordinalInterval, zoomLevel = 1.0 } = timescaleConfig;

    // 基础单元宽度（以天为单位）
    // 调整基础宽度：目标是让 100% 缩放时大约能展示 1 年的数据 (365天 * 3px/天 ≈ 1100px)
    const baseWidth = density === 'compact' ? 3 : 4;
    const dayWidth = Math.max(0.01, baseWidth * zoomLevel);
    
    // 生成最底层的刻度（基准刻度）
    const baseInterval = format === 'three' ? primaryInterval : primaryInterval;
    const bottomRows: TimeScaleItem[] = calculateScaleRow(start, end, baseInterval, primaryType, dayWidth * 30, start);
    
    // 修正底层宽度为固定像素
    bottomRows.forEach(item => {
      const days = item.endDate.diff(item.startDate, 'day');
      item.width = days * dayWidth;
    });

    const rows: TimeScaleItem[][] = [];

    // 辅助：根据子级刻度构建父级刻度（确保对齐）
    const buildParentRow = (childRow: TimeScaleItem[], parentInterval: string): TimeScaleItem[] => {
      const parentItems: TimeScaleItem[] = [];
      if (childRow.length === 0) return [];

      let currentParentStart = childRow[0].startDate.startOf(parentInterval as dayjs.OpUnitType);
      let currentWidth = 0;

      childRow.forEach((child, index) => {
        const isLast = index === childRow.length - 1;
        const nextStart = !isLast ? childRow[index + 1].startDate : null;
        const isNewParent = nextStart && (nextStart.isAfter(currentParentStart.endOf(parentInterval as dayjs.OpUnitType)));

        currentWidth += child.width;

        if (isLast || isNewParent) {
          parentItems.push({
            date: currentParentStart,
            label: formatScaleLabel(currentParentStart, parentInterval, 'calendar', start),
            width: currentWidth,
            startDate: currentParentStart,
            endDate: child.endDate,
            showLabel: true
          });
          if (nextStart) {
            currentParentStart = nextStart.startOf(parentInterval as dayjs.OpUnitType);
            currentWidth = 0;
          }
        }
      });
      return parentItems;
    };

    if (format === 'three') {
      // 三行模式：Parent(Sec) -> Secondary -> Primary
      const midInterval = secondaryInterval || 'month';
      const midRow = buildParentRow(bottomRows, midInterval);
      const topRow = buildParentRow(midRow, getParentInterval(midInterval));
      rows.push(topRow, midRow, bottomRows);
    } else {
      // 两行模式：Parent(Pri) -> Primary
      const topRow = buildParentRow(bottomRows, getParentInterval(primaryInterval));
      rows.push(topRow, bottomRows);
    }

    // 处理序数日期行
    if (showOrdinal) {
      const ordRow = calculateScaleRow(start, end, ordinalInterval, 'ordinal', dayWidth * 30, start);
      ordRow.forEach(item => {
        const days = item.endDate.diff(item.startDate, 'day');
        item.width = days * dayWidth;
      });
      rows.push(ordRow);
    }

    return rows;
  }, [timeRange, timescaleConfig, zoomLevel, density]);
  
  // 计算时间刻度的总宽度（使用最底层行，确保精确）
  const timelineTotalWidth = useMemo(() => {
    if (timeScale.length === 0) return 0;
    const lastRow = timeScale[timeScale.length - 1];
    return lastRow.reduce((sum, item) => sum + item.width, 0);
  }, [timeScale])
  
  // 计算任务条的位置和宽度 - 根据任务日期在固定时间范围内的相对位置计算
  const getTaskBarPosition = useCallback((task: GanttTask) => {
    if (!task.start_date || !task.end_date) return null
    
    const start = dayjs(task.start_date)
    const end = dayjs(task.end_date)
    
    // 关键修复：必须使用时间轴的最底层（最精细）一行的日期范围作为参考
    // 之前的逻辑使用 timeScale[0]（最顶层，如年份），由于 top row 经常通过 startOf('year') 对齐，
    // 导致 scaleStart 变成了 1月1日，而 timeline 物理起点可能较晚，从而产生向右偏移。
    if (timeScale.length === 0) return null
    const bottomScale = timeScale[timeScale.length - 1]
    if (bottomScale.length === 0) return null
    
    const scaleStart = bottomScale[0].startDate
    const scaleEnd = bottomScale[bottomScale.length - 1].endDate
    
    // 计算任务在固定时间范围内的相对位置（相对于 scaleStart）
    const totalDays = scaleEnd.diff(scaleStart, 'day')
    const taskStartDays = start.diff(scaleStart, 'day')
    const taskDurationDays = end.diff(start, 'day')
    
    // 使用 timelineTotalWidth，它是由底层 scaleItem.width 累加得到的
    const pixelsPerDay = timelineTotalWidth / Math.max(totalDays, 1)
    
    const left = taskStartDays * pixelsPerDay
    const width = Math.max(taskDurationDays * pixelsPerDay, 4)
    
    return {
      left: left,
      width: width,
    }
  }, [timelineTotalWidth, timeScale]) // 移除 timelineScrollLeft 依赖，它不影响位置计算
  
  // 同步滚动（仅处理横向；纵向由单一容器 verticalScrollRef 负责）
  useEffect(() => {
    const gridScroll = gridRef.current // 外部容器
    const gridHeader = gridHeaderWrapperRef.current // 外部容器
    const timelineScroll = timelineScrollRef.current
    const timelineHorizontalScroll = timelineHorizontalScrollRef.current
    const timelineHeader = containerRef.current?.querySelector('.gantt-timeline-header') as HTMLElement
    
    if (!gridScroll || !gridHeader) return
    
    // 使用标志防止循环触发
    let syncingSource: string | null = null
    
    const sync = (source: HTMLElement, targets: (HTMLElement | null | undefined)[], updateTimeline?: boolean) => {
      if (syncingSource) return
      syncingSource = 'syncing'
      const left = source.scrollLeft
      targets.forEach(target => {
        if (target && Math.abs(target.scrollLeft - left) > 1) {
          target.scrollLeft = left
        }
      })
      if (updateTimeline) setTimelineScrollLeft(left)
      syncingSource = null
    }

    const handleGridScroll = () => sync(gridScroll, [gridHeader])
    const handleGridHeaderScroll = () => sync(gridHeader, [gridScroll])
    
    const handleTimelineScroll = () => sync(timelineScroll!, [timelineHeader, timelineHorizontalScroll], true)
    const handleTimelineHeaderScroll = () => sync(timelineHeader, [timelineScroll, timelineHorizontalScroll], true)
    const handleTimelineHorizontalScroll = () => sync(timelineHorizontalScroll!, [timelineScroll, timelineHeader], true)
    
    gridScroll.addEventListener('scroll', handleGridScroll)
    gridHeader.addEventListener('scroll', handleGridHeaderScroll)
    
    if (!hideTimeline) {
      timelineScroll?.addEventListener('scroll', handleTimelineScroll)
      timelineHeader?.addEventListener('scroll', handleTimelineHeaderScroll)
      timelineHorizontalScroll?.addEventListener('scroll', handleTimelineHorizontalScroll)
    }
    
    return () => {
      gridScroll.removeEventListener('scroll', handleGridScroll)
      gridHeader.removeEventListener('scroll', handleGridHeaderScroll)
      if (!hideTimeline) {
        timelineScroll?.removeEventListener('scroll', handleTimelineScroll)
        timelineHeader?.removeEventListener('scroll', handleTimelineHeaderScroll)
        timelineHorizontalScroll?.removeEventListener('scroll', handleTimelineHorizontalScroll)
      }
    }
  }, [hideTimeline])

  // 虚拟滚动：计算可见行范围
  useEffect(() => {
    const scrollContainer = verticalScrollRef.current
    if (!scrollContainer || tasks.length === 0) {
      // 如果没有滚动容器或没有任务，渲染所有行
      setVisibleRange({ start: 0, end: tasks.length })
      return
    }

    // 如果任务数量较少，不使用虚拟滚动，渲染所有行
    if (tasks.length <= virtualScrollThreshold) {
      setVisibleRange({ start: 0, end: tasks.length - 1 })
      return
    }

    const calculateVisibleRange = () => {
      const scrollTop = scrollContainer.scrollTop
      const containerHeight = scrollContainer.clientHeight
      
      // 计算可见区域的起始和结束索引
      const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
      const endIndex = Math.min(
        tasks.length - 1,
        Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan
      )
      
      setVisibleRange({ start: startIndex, end: endIndex })
    }

    // 初始化计算
    calculateVisibleRange()

    // 监听滚动事件（使用 requestAnimationFrame 优化性能）
    let rafId: number | null = null
    const handleScroll = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      rafId = requestAnimationFrame(calculateVisibleRange)
    }
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    
    // 监听容器大小变化（resize）
    const resizeObserver = new ResizeObserver(() => {
      calculateVisibleRange()
    })
    resizeObserver.observe(scrollContainer)

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll)
      resizeObserver.disconnect()
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [tasks.length, rowHeight, overscan, virtualScrollThreshold])

  // 将滚动容器的ref传递给父组件（用于滚动加载更多）
  useEffect(() => {
    if (onScrollRefsReady) {
      // 延迟一点确保ref已经设置
      const timer = setTimeout(() => {
        if (verticalScrollRef.current) {
          // 纵向滚动统一由 verticalScrollRef 承担；向后兼容仍提供两个参数
          onScrollRefsReady(verticalScrollRef, verticalScrollRef)
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [onScrollRefsReady, tasks.length])
  
  // 处理列宽调整
  const handleColumnResizeStart = useCallback((e: React.MouseEvent, columnIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    setIsColumnResizing(true)
    setResizingColumnIndex(columnIndex)
    setColumnResizeStartX(e.clientX)
    setColumnResizeStartWidth(localColumns[columnIndex].width)
  }, [localColumns])
  
  // 处理分隔条拖动 - P6逻辑：只改变grid和timeline的宽度比例，不影响列宽
  const separatorResizeRef = useRef<{
    startX: number
    startWidth: number
    rafId: number | null
  }>({ startX: 0, startWidth: 0, rafId: null })

  const handleSeparatorMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 记录初始鼠标位置和初始宽度
    separatorResizeRef.current.startX = e.clientX
    separatorResizeRef.current.startWidth = gridWidth
    setIsResizing(true)
  }, [gridWidth])
  
  // 处理分隔条拖动 - P6逻辑：拖动分隔条时，只改变grid和timeline的宽度比例，列宽完全不变
  // 允许拖动分隔条往左覆盖栏位（这是特性，不是bug）
  useEffect(() => {
    if (!isResizing) return
    
    const handleMouseMove = (e: MouseEvent) => {
      // 使用 requestAnimationFrame 优化性能
      if (separatorResizeRef.current.rafId) {
        cancelAnimationFrame(separatorResizeRef.current.rafId)
      }

      separatorResizeRef.current.rafId = requestAnimationFrame(() => {
        const deltaX = e.clientX - separatorResizeRef.current.startX
        const newWidth = separatorResizeRef.current.startWidth + deltaX
        const minWidth = 0 // 允许拖动到0，覆盖所有栏位
        const maxWidth = (containerRef.current?.offsetWidth || window.innerWidth) - 100 // 保留最小timeline宽度
        
        if (newWidth >= minWidth && newWidth <= maxWidth) {
          // 只更新gridWidth状态，不改变列宽
          // grid容器宽度 = gridWidth（可拖动改变）
          // grid内容宽度 = 所有列宽之和（固定，不随gridWidth变化）
          // 当gridWidth < 列宽之和时，grid内部可以横向滚动
          onGridWidthChange?.(newWidth)
        }
      })
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
      if (separatorResizeRef.current.rafId) {
        cancelAnimationFrame(separatorResizeRef.current.rafId)
        separatorResizeRef.current.rafId = null
      }
    }
    
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (separatorResizeRef.current.rafId) {
        cancelAnimationFrame(separatorResizeRef.current.rafId)
        separatorResizeRef.current.rafId = null
      }
    }
  }, [isResizing, onGridWidthChange])
  
  // 使用ref保存最新的列配置，避免闭包问题
  const columnsRef = useRef<GanttColumn[]>(localColumns)
  useEffect(() => {
    columnsRef.current = localColumns
  }, [localColumns])
  
  // 处理列宽调整 - 只改变当前列宽度，grid总宽度相应调整，其他列宽度不变
  const columnResizeRef = useRef<{
    startX: number
    startWidth: number
    columnIndex: number
    rafId: number | null
  }>({ startX: 0, startWidth: 0, columnIndex: -1, rafId: null })

  useEffect(() => {
    if (!isColumnResizing || resizingColumnIndex === null) return
    
    // 初始化 ref 值（只在开始拖拽时设置一次）
    if (columnResizeRef.current.columnIndex !== resizingColumnIndex) {
      columnResizeRef.current.startX = columnResizeStartX
      columnResizeRef.current.startWidth = columnResizeStartWidth
      columnResizeRef.current.columnIndex = resizingColumnIndex
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      // 使用 requestAnimationFrame 优化性能
      if (columnResizeRef.current.rafId) {
        cancelAnimationFrame(columnResizeRef.current.rafId)
      }

      columnResizeRef.current.rafId = requestAnimationFrame(() => {
        const deltaX = e.clientX - columnResizeRef.current.startX
        const newWidth = Math.max(50, columnResizeRef.current.startWidth + deltaX) // 最小宽度50px
        
        const updatedColumns = [...columnsRef.current]
        updatedColumns[columnResizeRef.current.columnIndex] = {
          ...updatedColumns[columnResizeRef.current.columnIndex],
          width: newWidth,
        }
        columnsRef.current = updatedColumns
        setLocalColumns(updatedColumns)
        // 注意：列宽调整时，不更新gridWidth
        // gridWidth应该由用户拖动分隔条来控制，列宽调整只改变列宽，不改变gridWidth
      })
    }
    
    const handleMouseUp = () => {
      setIsColumnResizing(false)
      setResizingColumnIndex(null)
      // 通知外部列配置变化
      onColumnsChange?.(columnsRef.current)
      if (columnResizeRef.current.rafId) {
        cancelAnimationFrame(columnResizeRef.current.rafId)
        columnResizeRef.current.rafId = null
      }
      columnResizeRef.current.columnIndex = -1
    }
    
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (columnResizeRef.current.rafId) {
        cancelAnimationFrame(columnResizeRef.current.rafId)
        columnResizeRef.current.rafId = null
      }
    }
  }, [isColumnResizing, resizingColumnIndex, columnResizeStartX, columnResizeStartWidth, onColumnsChange])
  
  // 处理缩放（鼠标滚轮）
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return // 只在按住Ctrl/Cmd时缩放
    
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05 // 减小单次缩放步长
    const newZoom = Math.max(0.01, Math.min(5.0, zoomLevel + delta))
    setZoomLevel(newZoom)
    onZoomChange?.(newZoom)
  }, [zoomLevel, onZoomChange])
  
  const rowScaleHeight = density === 'compact' ? 22 : 30
  const timelineHeaderHeight = timeScale.length * rowScaleHeight
  const horizontalScrollbarHeight = density === 'compact' ? 8 : 10
  const headerTotalHeight = timelineHeaderHeight + horizontalScrollbarHeight
  
  // 计算视图中所有分组行的最低层级（最深层级）
  const maxGroupLevel = useMemo(() => {
    let maxLevel = 0
    tasks.forEach(t => {
      if (!t.activity || t.type === 'project') {
        const level = getTaskLevel(t)
        maxLevel = Math.max(maxLevel, level)
      }
    })
    return maxLevel
  }, [tasks, getTaskLevel])

  // 计算固定列的 left 偏移量
  const getFixedColumnStyle = useCallback((colIndex: number) => {
    const col = localColumns[colIndex]
    if (col.fixed !== 'left') return {}

    let left = 0
    for (let i = 0; i < colIndex; i++) {
      // 检查当前列之前的列是否也是固定的
      if (localColumns[i].fixed === 'left') {
        left += localColumns[i].width
      }
    }

    return {
      position: 'sticky' as const,
      left: `${left}px`,
      zIndex: 20, // 增加 zIndex 以确保在滚动时处于最上方
      backgroundColor: 'inherit', // 继承父级背景色或明确设置
    }
  }, [localColumns])

  return (
    <div ref={containerRef} className={`gantt-chart-container ${density === 'compact' ? 'gantt-density-compact' : ''} ${hideTimeline ? 'gantt-hide-timeline' : ''}`}>
      {/* 顶部：左表头 + 右时间刻度（flex，避免 absolute 导致高度塌陷） */}
      <div className="gantt-header-row" style={{ height: `${headerTotalHeight}px` }}>
        {/* 左侧表头 */}
        <div
          ref={gridHeaderWrapperRef}
          className="gantt-grid-header-wrapper"
          style={{
            width: hideTimeline ? '100%' : `${gridWidth}px`,
            overflowX: hideTimeline ? 'auto' : 'hidden',
            overflowY: 'hidden',
            flexShrink: hideTimeline ? 1 : 0,
            height: `${headerTotalHeight}px`,
          }}
        >
          <div
            className="gantt-grid-header"
            style={{
              width: `${localColumns.reduce((sum, col) => sum + col.width, 0)}px`,
              overflow: 'visible', // 确保 sticky 生效，不能为 hidden
              height: hideTimeline ? `${headerTotalHeight}px` : `${timelineHeaderHeight}px`,
            }}
          >
            {localColumns.map((col, colIndex) => {
              const fixedStyle = getFixedColumnStyle(colIndex)
              return (
                <div
                  key={col.key}
                  className={`gantt-grid-header-cell-wrapper ${col.fixed === 'left' ? 'gantt-grid-cell--fixed' : ''}`}
                  style={{
                    width: `${col.width}px`,
                    position: col.fixed === 'left' ? 'sticky' : 'relative',
                    height: hideTimeline ? '100%' : undefined,
                    display: hideTimeline ? 'flex' : undefined,
                    alignItems: hideTimeline ? 'center' : undefined,
                    zIndex: col.fixed === 'left' ? 20 : 1, // 增加 zIndex
                    ...fixedStyle,
                  }}
                >
                  <div
                    className="gantt-grid-header-cell"
                    style={{
                      width: '100%',
                      textAlign: col.align || 'left',
                      backgroundColor: '#fafafa', // 确保固定列背景不透明
                    }}
                  >
                    {col.title}
                  </div>
                  {/* 列宽调整分隔线 - 所有列都可以调整宽度 */}
                  <div
                    className="gantt-column-resizer"
                    onMouseDown={(e) => handleColumnResizeStart(e, colIndex)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: '4px',
                      cursor: 'col-resize',
                      zIndex: 21, // 确保 resizer 在 sticky 之上
                    }}
                  />
                </div>
              )
            })}
          </div>
          {/* 左侧表头占位：与右侧横向滚动条高度一致（不要再额外画一条分隔线，避免看起来“多一根线”） */}
          {!hideTimeline && <div style={{ height: `${horizontalScrollbarHeight}px`, background: '#f5f5f5' }} />}
        </div>

        {/* 占位分隔条：用于让“顶部时间刻度”与“主体分隔条”对齐 */}
        {!hideTimeline && <div className="gantt-separator gantt-separator--header" style={{ height: `${headerTotalHeight}px` }} />}

        {/* 右侧时间刻度 + 顶部横向滚动条（合并到表头区域，避免额外多一行） */}
        {!hideTimeline && (
          <div className="gantt-timeline-header-wrap" style={{ flex: 1, minWidth: 0, height: `${headerTotalHeight}px` }}>
            <div
              className="gantt-timeline-header"
              style={{
                height: `${timelineHeaderHeight}px`,
                flex: '0 0 auto',
                minWidth: 0,
              }}
              onWheel={handleWheel}
            >
              {timeScale.map((scaleRow, rowIndex) => (
                <div
                  key={rowIndex}
                  className="gantt-timeline-scale-row"
                  style={{
                    height: `${rowScaleHeight}px`,
                    borderBottom: rowIndex < timeScale.length - 1 ? '1px solid #d9d9d9' : 'none',
                  }}
                >
                  <div className="gantt-timeline-scale" style={{ width: `${timelineTotalWidth}px` }}>
                    {scaleRow.map((item, idx) => (
                      <div
                        key={idx}
                        className="gantt-scale-cell"
                        style={{
                          width: `${item.width}px`,
                          minWidth: `${item.width}px`,
                          maxWidth: `${item.width}px`,
                          fontSize: item.fontSize !== undefined ? `${item.fontSize}px` : undefined,
                          display: 'flex',
                        }}
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div
              ref={timelineHorizontalScrollRef}
              className="gantt-timeline-scrollbar gantt-timeline-scrollbar--top"
              style={{ height: `${horizontalScrollbarHeight}px`, flex: '0 0 auto' }}
            >
              <div style={{ width: `${timelineTotalWidth}px`, height: '1px' }} />
            </div>
          </div>
        )}
      </div>

      {/* 主体：单一纵向滚动容器，表格+横道图联动滚动 */}
      <div className="gantt-body-row">
        <div ref={verticalScrollRef} className="gantt-vertical-scroll">
          <div className="gantt-body-inner" style={{ width: hideTimeline ? '100%' : undefined }}>
            {/* 左侧表格 */}
            <div 
              ref={gridRef}
              className="gantt-grid"
              style={{ 
                width: hideTimeline ? '100%' : `${gridWidth}px`, // grid容器宽度 = gridWidth（可拖动改变）
                overflowX: hideTimeline ? 'auto' : 'hidden', // 隐藏溢出，让内部横向滚动
                flexShrink: hideTimeline ? 1 : 0,
                height: 'auto', // 由内容决定高度（纵向滚动交给外层容器）
              }}
            >
              <div 
                ref={gridScrollRef} 
                className="gantt-grid-body"
                style={{ 
                  height: `${tasks.length * rowHeight}px`, // 内容高度（由父容器滚动）
                  minWidth: `${localColumns.length > 0 ? localColumns.reduce((sum, col) => sum + col.width, 0) : 0}px`, // 最小宽度 = 所有列宽之和
                  boxSizing: 'border-box', // 确保padding包含在宽度内
                  overflow: 'visible', // 确保 sticky 生效，不能为 hidden
                  flex: '0 0 auto', // 不参与 flex 拉伸，避免高度被压缩导致内容不可见
                }}
              >
            {localColumns.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#ff0000' }}>
                错误：列配置为空，无法渲染表格
              </div>
            ) : tasks.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                暂无数据
              </div>
            ) : (
              <>
                {/* 虚拟滚动：顶部占位符（仅在启用虚拟滚动时显示） */}
                {tasks.length > virtualScrollThreshold && visibleRange.start > 0 && (
                  <div style={{ height: `${visibleRange.start * rowHeight}px` }} />
                )}
                {/* 只渲染可见范围的任务（或全部任务，如果数量较少） */}
                {(tasks.length > virtualScrollThreshold 
                  ? tasks.slice(visibleRange.start, visibleRange.end + 1)
                  : tasks
                ).map((task) => {
                // 判断是否为分组节点（没有activity属性，或者type为'project'）
                const isGroupRow = !task.activity || task.type === 'project'
                const groupLevel = isGroupRow ? getTaskLevel(task) : undefined

                // 获取分组行的背景色和左侧竖条颜色
                const groupBgColor = isGroupRow && typeof groupLevel === 'number' 
                  ? getGroupRowBackgroundColor(groupLevel)
                  : undefined
                const groupLeftBarColor = isGroupRow && typeof groupLevel === 'number'
                  ? (() => {
                      const colors = [
                        taskColors.level0, // LEVEL 1
                        taskColors.level1, // LEVEL 2
                        taskColors.level2, // LEVEL 3
                        taskColors.level3, // LEVEL 4
                        taskColors.level4, // LEVEL 5
                        taskColors.level5, // LEVEL 6
                        taskColors.level6, // LEVEL 7
                        taskColors.level7, // LEVEL 8
                        taskColors.level8, // LEVEL 9
                      ]
                      return colors[Math.min(groupLevel, colors.length - 1)]
                    })()
                  : undefined
                
                return (
                  <div
                    key={task.id}
                    className={[
                      'gantt-grid-row',
                      (selectedTaskId === task.id || selectedTaskIds?.includes(task.id)) ? 'selected' : '',
                      isGroupRow ? 'gantt-group-row' : '',
                      isGroupRow && typeof groupLevel === 'number' ? `gantt-group-row--level-${Math.min(groupLevel, 8)}` : '',
                    ].filter(Boolean).join(' ')}
                    style={{ 
                      height: `${rowHeight}px`,
                      display: 'flex',
                      width: `${localColumns.reduce((sum, col) => sum + col.width, 0)}px`, // 确保宽度匹配列宽之和
                      flexShrink: 0, // 防止行被压缩
                      backgroundColor: groupBgColor, // 分组行背景色
                      '--group-left-bar-color': groupLeftBarColor, // CSS变量：左侧竖条颜色
                    } as React.CSSProperties}
                    onClick={(e) => {
                      const groupId = String(task.id).replace(/^group_/, '__group__')
                      if (isGroupRow) {
                        if ((e.ctrlKey || e.metaKey) && onGroupSelectAll) {
                          onGroupSelectAll(groupId)
                        } else if (onGroupToggle) {
                          const isExpanded = task.open !== false
                          onGroupToggle(groupId, isExpanded)
                        }
                      } else {
                        onTaskClick?.(task, e)
                      }
                    }}
                    onDoubleClick={() => {
                      if (!isGroupRow) {
                        onTaskDblClick?.(task)
                      }
                    }}
                  >
                    {localColumns.map((col, colIndex) => {
                      const fixedStyle = getFixedColumnStyle(colIndex)
                      const isFixed = col.fixed === 'left'

                      // 对于分组行：Activity ID列为空，分组名称显示在描述列（第二列或title/description列）
                      if (isGroupRow) {
                        if (col.key === 'activity_id') {
                          return (
                            <div
                              key={col.key}
                              className={`gantt-grid-cell ${isFixed ? 'gantt-grid-cell--fixed' : ''}`}
                              style={{ 
                                width: `${col.width}px`,
                                textAlign: col.align || 'left',
                                ...fixedStyle,
                                backgroundColor: isFixed ? (groupBgColor || '#ffffff') : undefined,
                              }}
                            />
                          )
                        }
                        // 分组名称仅显示在作业描述列（title/description），不在状态列
                        if (col.key === 'title' || col.key === 'description') {
                          // 计算分组层级缩进
                          let indentLevel = 0
                          if (task.parent) {
                            let current: GanttTask | undefined = taskMap.get(task.parent)
                            while (current && current.parent) {
                              indentLevel++
                              const next = taskMap.get(current.parent)
                              if (!next) break
                              current = next
                            }
                            indentLevel++
                          }
                          const paddingLeft = task.parent ? `${1 * indentLevel}ch` : undefined // 每层级缩进1个字符
                          
                          // 检查分组是否展开（默认展开）
                          const isExpanded = task.open !== false
                          // task.id 已经是 "__group__xxx" 格式，直接使用
                          const groupId = String(task.id)
                          const itemCount = groupItemCounts?.get(groupId)
                          const displayText = itemCount !== undefined 
                            ? `${task.text || String(task.id)} (${itemCount})`
                            : (task.text || String(task.id))
                          
                          return (
                            <div
                              key={col.key}
                              className={`gantt-grid-cell ${isFixed ? 'gantt-grid-cell--fixed' : ''}`}
                              style={{ 
                                width: `${col.width}px`,
                                textAlign: col.align || 'left',
                                fontWeight: 'bold',
                                paddingLeft,
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                ...fixedStyle,
                                backgroundColor: isFixed ? (groupBgColor || '#ffffff') : undefined,
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (onGroupToggle) {
                                  onGroupToggle(groupId, isExpanded)
                                }
                              }}
                            >
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                marginRight: '4px',
                                fontSize: '10px',
                                width: '12px',
                                height: '12px',
                              }}>
                                {isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
                              </span>
                              {displayText}
                            </div>
                          )
                        }
                        return (
                          <div
                            key={col.key}
                            className={`gantt-grid-cell ${isFixed ? 'gantt-grid-cell--fixed' : ''}`}
                            style={{ 
                              width: `${col.width}px`,
                              textAlign: col.align || 'left',
                              ...fixedStyle,
                              backgroundColor: isFixed ? (groupBgColor || '#ffffff') : undefined,
                            }}
                          />
                        )
                      }

                      // 普通任务行：根据 parent 链计算缩进
                      const hasParent = task.parent !== undefined && task.parent !== null
                      let indentLevel = 0
                      if (hasParent && task.parent) {
                        const parentTask = taskMap.get(task.parent)
                        if (parentTask) {
                          let current: GanttTask | undefined = parentTask
                          while (current && current.parent) {
                            indentLevel++
                            const next = taskMap.get(current.parent)
                            if (!next) break
                            current = next
                          }
                          indentLevel++
                        }
                      }
                      
                      // 仅对“描述”列缩进（不影响其他栏位设置）；缩进 = 视图最低分组层级 + 1ch
                      const isDescriptionColumn = col.key === 'title' || col.key === 'description'
                      const paddingLeft = (isDescriptionColumn && colIndex > 0)
                        ? `${maxGroupLevel + 1}ch`
                        : undefined
                      //不明白为什么要改。
                      const value = task.activity ? (task.activity as any)?.[col.key] : (task as any)?.[col.key]
                      return (
                        <div
                          key={col.key}
                          className={`gantt-grid-cell gantt-grid-cell-${col.key} ${isFixed ? 'gantt-grid-cell--fixed' : ''}`}
                          style={{ 
                            width: `${col.width}px`,
                            textAlign: col.align || 'left',
                            paddingLeft,
                            ...fixedStyle,
                            backgroundColor: isFixed ? 'inherit' : undefined, // 继承行的背景色（包括选中状态颜色）
                          }}
                        >
                          {col.render
                            ? col.render(value, task)
                            : (col.key.includes('date') && value)
                              ? dayjs(value).format('YYYY-MM-DD')
                              : (value !== undefined && value !== null ? String(value) : '')
                          }
                        </div>
                      )
                    })}
                  </div>
                )
                })}
                {/* 虚拟滚动：底部占位符（仅在启用虚拟滚动时显示） */}
                {tasks.length > virtualScrollThreshold && visibleRange.end < tasks.length - 1 && (
                  <div style={{ height: `${(tasks.length - visibleRange.end - 1) * rowHeight}px` }} />
                )}
              </>
            )}
              </div>
            </div>
            
            {/* 分隔条 */}
            {!hideTimeline && (
              <div
                ref={separatorRef}
                className={`gantt-separator ${isResizing ? 'resizing' : ''}`}
                onMouseDown={handleSeparatorMouseDown}
              />
            )}
            
            {/* 右侧甘特图 */}
            {!hideTimeline && (
              <div 
                ref={timelineRef}
                className="gantt-timeline"
                style={{ flex: 1, height: 'auto' }}
              >
              <div 
                ref={timelineScrollRef} 
                className="gantt-timeline-body"
                style={{ 
                  width: '100%',
                  height: `${tasks.length * rowHeight}px`, 
                  overflowY: 'hidden', 
                  overflowX: 'auto', // 确保允许横向滚动
                  position: 'relative', // 确保任务条相对于此容器定位
                }}
              >
                {/* 关键：把“宽度”放到内部内容层上，让 timeline-body 成为真正可滚动容器 */}
                <div
                  className="gantt-timeline-content"
                  style={{
                    width: `${timelineTotalWidth}px`,
                    height: `${tasks.length * rowHeight}px`,
                    position: 'relative',
                  }}
                >
                  {/* 背景网格线 - 使用底层时间刻度以获得更高精度 */}
                  {timeScale.length > 0 && (
                    <div className="gantt-timeline-grid" style={{ width: `${timelineTotalWidth}px`, height: `${tasks.length * rowHeight}px` }}>
                      {timeScale[timeScale.length - 1].map((_, idx) => (
                        <div
                          key={`grid-${idx}`}
                          className="gantt-timeline-grid-line"
                          style={{
                            left: `${timeScale[timeScale.length - 1].slice(0, idx).reduce((sum, i) => sum + i.width, 0)}px`,
                            width: '1px',
                            height: '100%',
                          }}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* 任务条 - 显示普通任务和分组汇总条 */}
                  {/* 使用timelineScrollLeft作为key的一部分，确保滚动时重新渲染 */}
                  {/* 虚拟滚动：只渲染可见范围的任务条（或全部任务，如果数量较少） */}
                  {(tasks.length > virtualScrollThreshold 
                    ? tasks.slice(visibleRange.start, visibleRange.end + 1)
                    : tasks
                  ).map((task, index) => {
                    const taskIndex = tasks.length > virtualScrollThreshold ? visibleRange.start + index : index
                    const isGroupRow = !task.activity || task.type === 'project'
                    
                    // 分组行显示汇总条（summary bar），普通任务显示任务条
                    if (!task.start_date || !task.end_date) return null
                    
                    // 重新计算位置，确保跟随timeline变化
                    // getTaskBarPosition依赖timelineScrollLeft，滚动时会重新计算
                    const position = getTaskBarPosition(task)
                    if (!position) return null
                    
                    // 根据状态获取颜色
                    const colorConfig = getTaskBarColor(task, isGroupRow)
                    const isMilestone = task.type === 'milestone'
                    
                    // 里程碑使用菱形显示，宽度和高度相等
                    const milestoneSize = Math.min(rowHeight - 4, 8) // 里程碑大小（缩小到8px）
                    const milestoneLeft = position.left - milestoneSize / 2 // 居中显示
                    
                    return (
                      <div
                        key={`${task.id}_${Math.floor(timelineScrollLeft / 100)}`} // 使用滚动位置作为key的一部分，确保滚动时重新渲染
                        className={`gantt-task-bar ${isGroupRow ? 'gantt-summary-bar' : ''} ${isMilestone ? 'gantt-milestone' : ''} ${ (selectedTaskId === task.id || selectedTaskIds?.includes(task.id)) ? 'selected' : ''}`}
                        style={{
                          top: `${taskIndex * rowHeight + 2}px`,
                          left: isMilestone ? `${milestoneLeft}px` : `${position.left}px`,
                          width: isMilestone ? `${milestoneSize}px` : `${position.width}px`,
                          height: isMilestone ? `${milestoneSize}px` : (isGroupRow ? `${rowHeight - 6}px` : `${rowHeight - 4}px`),
                          borderTop: colorConfig.borderTop || 'none',
                          borderBottom: colorConfig.borderBottom || 'none',
                          background: colorConfig.background, // 默认背景色（未完成部分或整体背景）
                          border: !isGroupRow && !isMilestone ? '1px solid rgba(0,0,0,0.65)' : undefined, // P6样式：作业横道图黑色描边
                          overflow: 'hidden',
                        }}
                        onClick={(e) => !isGroupRow && onTaskClick?.(task, e)}
                        onDoubleClick={() => !isGroupRow && onTaskDblClick?.(task)}
                      >
                        {/* 进行中的任务：显示已完成部分（蓝色） */}
                        {!isGroupRow && colorConfig.completedBackground && colorConfig.completedWidth && (
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: colorConfig.completedWidth,
                              background: colorConfig.completedBackground,
                              zIndex: 1,
                            }}
                          />
                        )}
                        {!isGroupRow && (
                          <>
                            <div className="gantt-task-progress" style={{ width: `${(task.progress || 0) * 100}%` }} />
                            <div className="gantt-task-text" style={{ position: 'relative', zIndex: 2 }}>{task.text}</div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  )
}

export default GanttChart

