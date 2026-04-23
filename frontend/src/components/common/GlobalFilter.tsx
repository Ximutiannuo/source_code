import { logger } from '../../utils/logger'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Card, Row, Col, DatePicker, Space, Button, Select } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useFacilityFilter, type FacilityFilterState } from '../../hooks/useFacilityFilter'
import { Dayjs } from 'dayjs'
import { facilityService } from '../../services/facilityService'
import { rscService } from '../../services/rscService'
import './GlobalFilter.css'

const { RangePicker } = DatePicker

export interface GlobalFilterState extends FacilityFilterState {
  scope?: string[]
  date_range?: [Dayjs, Dayjs]
}

interface GlobalFilterProps {
  value?: GlobalFilterState
  onChange?: (value: GlobalFilterState) => void
  showDateRange?: boolean
  compact?: boolean
  allowedScopes?: string[]  // 允许的 scope 值（根据用户权限）
  allowedSubprojects?: string[]  // 允许的 subproject 值
  allowedTrains?: string[]  // 允许的 train 值
  allowedUnits?: string[]  // 允许的 unit 值
  allowedMainBlocks?: string[]  // 允许的 main_block 值
  allowedBlocks?: string[]  // 允许的 block 值
  allowedQuarters?: string[]  // 允许的 quarter 值
}

// 筛选器字段的预设宽度（不保存，刷新后恢复）
const DEFAULT_FILTER_WIDTHS: Record<string, number> = {
  subproject: 90,
  train: 90,
  unit: 90,
  main_block: 110,
  block: 140,
  quarter: 90,
  scope: 90,
  discipline: 90,
  implement_phase: 90,
  contract_phase: 90,
  type: 90,
  work_package: 90,
  resource_id_name: 200,
  bcc_kq_code: 110,
  kq: 70,
  cn_wk_report: 120,
}

const GlobalFilter = ({ 
  value, 
  onChange, 
  showDateRange = true, 
  compact = false,
  allowedScopes,
  allowedSubprojects,
  allowedTrains,
  allowedUnits,
  allowedMainBlocks,
  allowedBlocks,
  allowedQuarters,
}: GlobalFilterProps) => {
  // 关键：初始化时传入 value，确保 F5 刷新后状态不丢失
  const { filterState, options, updateFilter, handleFieldFocus, resetFilter, setActiveField, clearActiveField, setExternalScope, syncExternalState } = useFacilityFilter(value)
  const [gccScope, setGccScope] = useState<string[] | undefined>(value?.scope)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | undefined>(value?.date_range)
  
  // 用于跟踪是否是第一次挂载，防止初始同步覆盖
  const isFirstMountRef = useRef(true)

  // 深度监听外部 value 变化并同步到内部状态
  useEffect(() => {
    if (value) {
      // 如果是第一次挂载，或者是外部 value 发生了真实变化（通过 JSON 比较）
      // 注意：这里需要排除 date_range 的影响，因为它不由 useFacilityFilter 处理
      const { date_range, ...otherFilters } = value
      const currentInternalFilters = filterState
      
      if (JSON.stringify(otherFilters) !== JSON.stringify(currentInternalFilters)) {
        syncExternalState(otherFilters)
      }
      
      if (JSON.stringify(date_range) !== JSON.stringify(dateRange)) {
        setDateRange(date_range)
      }
      
      if (JSON.stringify(value.scope) !== JSON.stringify(gccScope)) {
        setGccScope(value.scope)
      }
    }
  }, [value])
  
  // 筛选器宽度状态（仅当前会话，不保存）
  const [filterWidths, setFilterWidths] = useState<Record<string, number>>({})
  
  // Block 和 Work Package 的描述信息缓存（仅当前会话，不保存）
  const [blockDescriptions, setBlockDescriptions] = useState<Record<string, string>>({})
  const [workPackageDescriptions, setWorkPackageDescriptions] = useState<Record<string, string>>({})
  const [searchValues, setSearchValues] = useState<Record<string, string>>({})
  const [, setResizingField] = useState<string | null>(null)
  const resizeRef = useRef<{
    field: string | null
    startX: number
    startWidth: number
  }>({ field: null, startX: 0, startWidth: 0 })
  
  // 获取筛选器宽度（优先使用自定义宽度，否则使用预设宽度）
  const getFilterWidth = (field: string): number => {
    return filterWidths[field] ?? DEFAULT_FILTER_WIDTHS[field] ?? 90
  }
  
  // 处理筛选器宽度调整开始
  const handleFilterResizeStart = (e: React.MouseEvent, field: string) => {
    e.preventDefault()
    e.stopPropagation()
    const currentWidth = getFilterWidth(field)
    resizeRef.current = {
      field,
      startX: e.clientX,
      startWidth: currentWidth,
    }
    setResizingField(field)
    
    const handleMouseMove = (e: MouseEvent) => {
      if (resizeRef.current.field !== field) return
      const deltaX = e.clientX - resizeRef.current.startX
      const newWidth = Math.max(60, Math.min(400, resizeRef.current.startWidth + deltaX)) // 最小60px，最大400px
      setFilterWidths(prev => ({ ...prev, [field]: newWidth }))
    }
    
    const handleMouseUp = () => {
      setResizingField(null)
      resizeRef.current.field = null
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }
  
  // 同步 scope：处理初始化和外部传入的 value?.scope 变化
  useEffect(() => {
    const targetScope = value?.scope ?? gccScope
    if (targetScope !== undefined) {
      // 如果 gccScope 和 targetScope 不一致，更新 gccScope
      if (JSON.stringify(targetScope) !== JSON.stringify(gccScope)) {
        setGccScope(targetScope)
      }
      // 同步到 filterState.scope（setExternalScope 会触发 updateOptions）
      setExternalScope(targetScope)
    }
  }, [value?.scope]) // 依赖外部传入的 value?.scope，初始化时也会执行
  
  // 控制每个 Select 的下拉框打开状态
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({})

  // 加载 Block 描述信息（从 facilities 表获取，仅在宽度变大时加载）
  useEffect(() => {
    const blockWidth = getFilterWidth('block')
    const shouldLoadDescriptions = blockWidth > DEFAULT_FILTER_WIDTHS.block
    
    if (!shouldLoadDescriptions) {
      // 宽度未变大，清除描述信息
      setBlockDescriptions({})
      return
    }
    
    const fetchBlockDescriptions = async () => {
      try {
        // 获取所有可用的 block 值
        const allBlocks = Object.values(options.blocks || {}).flat()
        if (allBlocks.length === 0) return
        
        // 去重（已使用，但 TypeScript 检测不到）
        Array.from(new Set(allBlocks))
        
        // 批量获取描述信息：一次性获取所有 facilities，然后建立映射
        try {
          const response = await facilityService.getFacilities({ limit: 10000 })
          const descriptionsMap: Record<string, string> = {}
          response.items.forEach(facility => {
            if (facility.block && facility.descriptions) {
              // 如果同一个 block 有多个描述，取第一个非空的
              if (!descriptionsMap[facility.block]) {
                descriptionsMap[facility.block] = facility.descriptions
              }
            }
          })
          setBlockDescriptions(descriptionsMap)
        } catch (e) {
          logger.error('批量获取Block描述信息失败:', e)
        }
      } catch (error: any) {
        logger.error('获取Block描述信息失败:', error)
      }
    }
    
    if (Object.keys(options.blocks || {}).length > 0) {
      fetchBlockDescriptions()
    }
  }, [options.blocks, filterWidths.block])
  
  // 加载 Work Package 描述信息（从 rsc_defines 表获取，仅在宽度变大时加载）
  useEffect(() => {
    const wpWidth = getFilterWidth('work_package')
    const shouldLoadDescriptions = wpWidth > DEFAULT_FILTER_WIDTHS.work_package
    
    if (!shouldLoadDescriptions) {
      // 宽度未变大，清除描述信息
      setWorkPackageDescriptions({})
      return
    }
    
    const fetchWorkPackageDescriptions = async () => {
      try {
        const workPackages = options.work_packages || []
        if (workPackages.length === 0) return
        
        // 批量获取描述信息：一次性获取所有 rsc_defines，然后建立映射
        try {
          const response = await rscService.getRSCDefinesWithPagination({ limit: 10000 })
          const descriptionsMap: Record<string, string> = {}
          response.items.forEach(rsc => {
            if (rsc.work_package && rsc.wpkg_description) {
              // 如果同一个 work_package 有多个描述，取第一个非空的
              if (!descriptionsMap[rsc.work_package]) {
                descriptionsMap[rsc.work_package] = rsc.wpkg_description
              }
            }
          })
          setWorkPackageDescriptions(descriptionsMap)
        } catch (e) {
          logger.error('批量获取Work Package描述信息失败:', e)
        }
      } catch (error: any) {
        logger.error('获取Work Package描述信息失败:', error)
      }
    }
    
    if (options.work_packages && options.work_packages.length > 0) {
      fetchWorkPackageDescriptions()
    }
  }, [options.work_packages, filterWidths.work_package])

  // 存储每个字段是否允许关闭（用户点击外部时才允许）
  const allowCloseRef = useRef<Record<string, boolean>>({})

  // 处理下拉框打开/关闭
  const handleDropdownVisibleChange = (field: string, open: boolean) => {
    if (open) {
      setOpenStates(prev => ({ ...prev, [field]: true }))
      allowCloseRef.current[field] = false
      // 标记当前正在操作的字段，避免更新时同步该字段的选项
      if (field !== 'scope') {
        const fieldKey = field as keyof typeof filterState
        setActiveField(fieldKey)
        // 触发 focus 事件，确保显示所有可选项（级联条件下的所有值）
        handleFieldFocus(fieldKey)
      }
    } else {
      // 如果不允许关闭（例如刚选择了值），则不执行关闭逻辑
      if (!allowCloseRef.current[field]) {
        return
      }
      // 真正关闭
      setOpenStates(prev => ({ ...prev, [field]: false }))
      // 真正关闭时清空搜索词
      setSearchValues(prev => ({ ...prev, [field]: '' }))
      if (field !== 'scope') {
        clearActiveField()
      }
    }
  }

  // 处理搜索
  const handleSearch = (field: string, value: string) => {
    setSearchValues(prev => ({ ...prev, [field]: value }))
  }

  // 处理值改变
  const handleChange = (field: string, value: string[], updateFn: (val: string[] | undefined) => void) => {
    // 标记暂时不允许关闭，防止选择后立即触发 onDropdownVisibleChange(false)
    allowCloseRef.current[field] = false
    updateFn(value.length > 0 ? value : undefined)
    
    // 保持打开状态
    setOpenStates(prev => ({ ...prev, [field]: true }))
  }

  // 处理选择事件 - 确保标记不允许关闭
  const handleSelect = (field: string) => {
    allowCloseRef.current[field] = false
    setOpenStates(prev => ({ ...prev, [field]: true }))
  }

  // 处理取消选择事件
  const handleDeselect = (field: string) => {
    allowCloseRef.current[field] = false
    setOpenStates(prev => ({ ...prev, [field]: true }))
  }

  // 处理点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const isClickInSelect = target.closest('.ant-select-dropdown')
      const isClickInSelectInput = target.closest('.ant-select-selector')
      const isClickInSelectClear = target.closest('.ant-select-clear')
      const isClickInSelectSearch = target.closest('.ant-select-selection-search')
      
      // 只有点击在完全外部时才允许关闭
      if (!isClickInSelect && !isClickInSelectInput && !isClickInSelectClear && !isClickInSelectSearch) {
        // 允许关闭所有下拉框
        Object.keys(allowCloseRef.current).forEach(key => {
          allowCloseRef.current[key] = true
        })
        // 延迟关闭，确保不会与选择事件冲突
        setTimeout(() => {
          setOpenStates({})
        }, 0)
      } else {
        // 点击在下拉框内部，不允许关闭
        // 找到对应的字段并标记不允许关闭
        const selectInput = target.closest('.ant-select-selector')
        if (selectInput) {
          // 通过查找最近的 Select 组件来确定字段
          // 这里我们需要一个更好的方法来识别字段
          // 暂时标记所有字段都不允许关闭
          Object.keys(openStates).forEach(key => {
            if (openStates[key]) {
              allowCloseRef.current[key] = false
            }
          })
        }
      }
    }

    // 使用 capture 阶段捕获所有点击
    document.addEventListener('mousedown', handleClickOutside, true)
    document.addEventListener('click', handleClickOutside, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
      document.removeEventListener('click', handleClickOutside, true)
    }
  }, [openStates])


  // 用于跟踪上一次通知给外部的状态，避免冗余更新和初始化覆盖
  const lastNotifiedValueRef = useRef<string>('')

  // 当筛选器状态改变时，通知父组件
  useEffect(() => {
    if (onChange) {
      const newValue = {
        ...filterState,
        scope: gccScope,
        date_range: dateRange,
      };
      const newValueStr = JSON.stringify(newValue);
      
      // 关键：只有当新值与上次通知的值不同时，才通知父组件
      // 这样可以防止初始化过程中的空值覆盖父组件状态
      if (newValueStr !== lastNotifiedValueRef.current) {
        // 如果是初始化阶段（newValue 是空的，但外部传进来的 value 不是空的），跳过通知
        if (isFirstMountRef.current && Object.keys(filterState).length === 0 && value && Object.keys(value).length > 0) {
          logger.log('GlobalFilter - 跳过初始化阶段的空值同步');
          return;
        }
        
        lastNotifiedValueRef.current = newValueStr;
        onChange(newValue);
      }
    }
  }, [filterState, gccScope, dateRange, onChange, value])

  // 在组件挂载完成后，标记初始化结束
  useEffect(() => {
    isFirstMountRef.current = false;
  }, [])

  const handleReset = () => {
    resetFilter()
    setGccScope(undefined)
    setDateRange(undefined)
    // 关闭所有下拉框
    setOpenStates({})
  }

  // 自然排序函数（支持数字和字符串混合排序）
  const naturalSort = (a: string, b: string): number => {
    // 尝试将字符串转换为数字进行比较
    const aNum = parseFloat(a)
    const bNum = parseFloat(b)
    
    // 如果都是有效数字，按数字大小排序
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum
    }
    
    // 如果都是数字字符串（如 "100", "200"），按数字大小排序
    if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
      return parseInt(a, 10) - parseInt(b, 10)
    }
    
    // 否则按字符串排序
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  }

  // 根据权限过滤选项的辅助函数
  const filterByPermission = <T extends string>(items: T[], allowed?: string[]): T[] => {
    if (!allowed || allowed.length === 0) return items
    return items.filter(item => allowed.includes(item))
  }
  
  // 获取可用的 main_blocks 和 blocks（根据已选择的上级过滤，支持多选）
  const availableMainblocks = filterState.simple_block && filterState.simple_block.length > 0
    ? filterState.simple_block
        .map(sb => options.main_blocks[sb] || [])
        .flat()
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .sort(naturalSort)
    : Object.values(options.main_blocks || {}).flat().filter((v, i, arr) => arr.indexOf(v) === i).sort(naturalSort)
  
  // 根据权限过滤 main_blocks
  const filteredMainblocks = filterByPermission(availableMainblocks, allowedMainBlocks)
  
  const availableBlocks = filterState.main_block && filterState.main_block.length > 0
    ? filterState.main_block
        .map(mb => options.blocks[mb] || [])
        .flat()
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .sort(naturalSort)
    : Object.values(options.blocks || {}).flat().filter((v, i, arr) => arr.indexOf(v) === i).sort(naturalSort)
  
  // 根据权限过滤 blocks
  const filteredBlocks = filterByPermission(availableBlocks, allowedBlocks)
  
  // 根据宽度生成 Block 选项（宽度大于预设值时显示描述，描述用颜色区分）
  const blockOptions = useMemo(() => {
    const blockWidth = getFilterWidth('block')
    const showDescription = blockWidth > DEFAULT_FILTER_WIDTHS.block
    return filteredBlocks.map(block => {
      const description = blockDescriptions[block]
      const label = showDescription && description 
        ? (
            <span>
              {block} : <span style={{ color: '#1890ff' }}>{description}</span>
            </span>
          )
        : block
      return { label, value: block }
    })
  }, [filteredBlocks, blockDescriptions, filterWidths.block])
  
  // 根据宽度生成 Work Package 选项（宽度大于预设值时显示描述，描述用颜色区分）
  const workPackageOptions = useMemo(() => {
    const wpWidth = getFilterWidth('work_package')
    const showDescription = wpWidth > DEFAULT_FILTER_WIDTHS.work_package
    return (options.work_packages || []).map(wp => {
      const description = workPackageDescriptions[wp]
      const label = showDescription && description
        ? (
            <span>
              {wp} : <span style={{ color: '#1890ff' }}>{description}</span>
            </span>
          )
        : wp
      return { label, value: wp }
    })
  }, [options.work_packages, workPackageDescriptions, filterWidths.work_package])
  
  // 根据权限过滤其他选项
  const filteredSubprojects = filterByPermission(options.subproject_codes, allowedSubprojects)
  const filteredTrains = filterByPermission(options.trains, allowedTrains)
  const filteredUnits = filterByPermission(options.units, allowedUnits)
  const filteredQuarters = filterByPermission(options.quarters, allowedQuarters)
  const filteredScopes = filterByPermission(options.scopes, allowedScopes)

  return (
    <Card
      size="small"
      className="global-filter-compact"
      style={{
        marginBottom: compact ? 8 : 12,
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        borderRadius: '6px',
      }}
      styles={{ body: { padding: compact ? '8px 6px' : '12px 14px' } }}
    >
      {/* Filter 标题和时间筛选器行 */}
      <Row gutter={[8, 8]} align="middle" style={{ marginBottom: compact ? 8 : 12 }}>
        <Col flex="auto">
          <span style={{ 
            fontSize: compact ? '13px' : '14px', 
            fontWeight: 600, 
            color: '#111827',
            display: 'block'
          }}>
            Filter
          </span>
        </Col>
        {showDateRange && (
          <Col>
            <RangePicker
              size="small"
              style={{ 
                width: compact ? 220 : 240,
                fontSize: '12px'
              }}
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | undefined)}
              format="YYYY-MM-DD"
              placeholder={['开始日期', '结束日期']}
              className={compact ? 'global-filter-compact' : ''}
            />
          </Col>
        )}
      </Row>
      {/* 筛选字段行 */}
      <Row gutter={[8, 8]} align="middle">
        <Col flex="auto">
          <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
            <Space size={[8, 8]} wrap={false} style={{ width: '100%' }}>
            {/* SubProject */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.subproject || ''}
                onSearch={(val) => handleSearch('subproject', val)}
                style={{ width: getFilterWidth('subproject'), minWidth: getFilterWidth('subproject') }}
                placeholder="SubProject"
              value={filterState.subproject || []}
              open={openStates.subproject}
              onDropdownVisibleChange={(open) => handleDropdownVisibleChange('subproject', open)}
              onChange={(val) => handleChange('subproject', val, (v) => updateFilter('subproject', v))}
              onSelect={() => handleSelect('subproject')}
              onDeselect={() => handleDeselect('subproject')}
              onFocus={() => handleFieldFocus('subproject')}
              allowClear
              showSearch
              maxTagCount="responsive"
              dropdownRender={(menu) => {
                return (
                  <div 
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {menu}
                  </div>
                )
              }}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={filteredSubprojects.map(opt => ({ label: opt, value: opt }))}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'subproject')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            {/* Train */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.train || ''}
                onSearch={(val) => handleSearch('train', val)}
                style={{ width: getFilterWidth('train'), minWidth: getFilterWidth('train') }}
                placeholder="Train"
                value={filterState.train || []}
                open={openStates.train}
                onDropdownVisibleChange={(open) => handleDropdownVisibleChange('train', open)}
                onChange={(val) => handleChange('train', val, (v) => updateFilter('train', v))}
                onSelect={() => handleSelect('train')}
                onDeselect={() => handleDeselect('train')}
                onFocus={() => handleFieldFocus('train')}
                allowClear
                showSearch
                maxTagCount="responsive"
                dropdownRender={(menu) => {
                  return (
                    <div 
                      onMouseDown={(e) => {
                        // 阻止事件传播到 document，防止触发关闭逻辑
                        // 但不阻止默认行为，让 Ant Design 可以处理选择
                        e.stopPropagation()
                      }}
                      onClick={(e) => {
                        // 阻止点击事件传播
                        e.stopPropagation()
                      }}
                      onPointerDown={(e) => {
                        // 阻止 pointer 事件传播
                        e.stopPropagation()
                      }}
                    >
                      {menu}
                    </div>
                  )
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={filteredTrains.map(opt => ({ label: opt, value: opt }))}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'train')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            {/* Unit */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.unit || ''}
                onSearch={(val) => handleSearch('unit', val)}
                style={{ width: getFilterWidth('unit'), minWidth: getFilterWidth('unit') }}
                placeholder="Unit"
                value={filterState.unit || []}
                open={openStates.unit}
                onDropdownVisibleChange={(open) => handleDropdownVisibleChange('unit', open)}
                onChange={(val) => handleChange('unit', val, (v) => updateFilter('unit', v))}
                onSelect={() => handleSelect('unit')}
                onDeselect={() => handleDeselect('unit')}
                onFocus={() => handleFieldFocus('unit')}
                allowClear
                showSearch
                maxTagCount="responsive"
                dropdownRender={(menu) => {
                  return (
                    <div 
                      onMouseDown={(e) => {
                        // 阻止事件传播到 document，防止触发关闭逻辑
                        // 但不阻止默认行为，让 Ant Design 可以处理选择
                        e.stopPropagation()
                      }}
                      onClick={(e) => {
                        // 阻止点击事件传播
                        e.stopPropagation()
                      }}
                      onPointerDown={(e) => {
                        // 阻止 pointer 事件传播
                        e.stopPropagation()
                      }}
                    >
                      {menu}
                    </div>
                  )
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={filteredUnits.map(opt => ({ label: opt, value: opt }))}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'unit')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            {/* Main Block */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.main_block || ''}
                onSearch={(val) => handleSearch('main_block', val)}
                style={{ width: getFilterWidth('main_block'), minWidth: getFilterWidth('main_block') }}
                placeholder="Main Block"
                value={filterState.main_block || []}
                open={openStates.main_block}
                onDropdownVisibleChange={(open) => handleDropdownVisibleChange('main_block', open)}
                onChange={(val) => handleChange('main_block', val, (v) => updateFilter('main_block', v))}
                onSelect={() => handleSelect('main_block')}
                onDeselect={() => handleDeselect('main_block')}
                onFocus={() => handleFieldFocus('main_block')}
                allowClear
                showSearch
                maxTagCount="responsive"
                dropdownRender={(menu) => {
                  return (
                    <div 
                      onMouseDown={(e) => {
                        // 阻止事件传播到 document，防止触发关闭逻辑
                        // 但不阻止默认行为，让 Ant Design 可以处理选择
                        e.stopPropagation()
                      }}
                      onClick={(e) => {
                        // 阻止点击事件传播
                        e.stopPropagation()
                      }}
                      onPointerDown={(e) => {
                        // 阻止 pointer 事件传播
                        e.stopPropagation()
                      }}
                    >
                      {menu}
                    </div>
                  )
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={filteredMainblocks.map(opt => ({ label: opt, value: opt }))}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'main_block')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            {/* Block */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.block || ''}
                onSearch={(val) => handleSearch('block', val)}
                style={{ width: getFilterWidth('block'), minWidth: getFilterWidth('block') }}
                placeholder="Block"
                value={filterState.block || []}
                open={openStates.block}
                onDropdownVisibleChange={(open) => handleDropdownVisibleChange('block', open)}
                onChange={(val) => handleChange('block', val, (v) => updateFilter('block', v))}
                onSelect={() => handleSelect('block')}
                onDeselect={() => handleDeselect('block')}
                onFocus={() => handleFieldFocus('block')}
                allowClear
                showSearch
                maxTagCount="responsive"
                dropdownRender={(menu) => {
                  return (
                    <div 
                      onMouseDown={(e) => {
                        // 阻止事件传播到 document，防止触发关闭逻辑
                        // 但不阻止默认行为，让 Ant Design 可以处理选择
                        e.stopPropagation()
                      }}
                      onClick={(e) => {
                        // 阻止点击事件传播
                        e.stopPropagation()
                      }}
                      onPointerDown={(e) => {
                        // 阻止 pointer 事件传播
                        e.stopPropagation()
                      }}
                    >
                      {menu}
                    </div>
                  )
                }}
                filterOption={(input, option) => {
                  const label = typeof option?.label === 'string' ? option.label : ''
                  const value = typeof option?.value === 'string' ? option.value : ''
                  // 搜索时同时匹配 label 和 value（value 是 block 值）
                  return label.toLowerCase().includes(input.toLowerCase()) || 
                         value.toLowerCase().includes(input.toLowerCase())
                }}
                options={blockOptions}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'block')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            {/* Quarter */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.quarter || ''}
                onSearch={(val) => handleSearch('quarter', val)}
                style={{ width: getFilterWidth('quarter'), minWidth: getFilterWidth('quarter') }}
                placeholder="Quarter"
                value={filterState.quarter || []}
                open={openStates.quarter}
                onDropdownVisibleChange={(open) => handleDropdownVisibleChange('quarter', open)}
                onChange={(val) => handleChange('quarter', val, (v) => updateFilter('quarter', v))}
                onSelect={() => handleSelect('quarter')}
                onDeselect={() => handleDeselect('quarter')}
                onFocus={() => handleFieldFocus('quarter')}
                allowClear
                showSearch
                maxTagCount="responsive"
                dropdownRender={(menu) => {
                  return (
                    <div 
                      onMouseDown={(e) => {
                        // 阻止事件传播到 document，防止触发关闭逻辑
                        // 但不阻止默认行为，让 Ant Design 可以处理选择
                        e.stopPropagation()
                      }}
                      onClick={(e) => {
                        // 阻止点击事件传播
                        e.stopPropagation()
                      }}
                      onPointerDown={(e) => {
                        // 阻止 pointer 事件传播
                        e.stopPropagation()
                      }}
                    >
                      {menu}
                    </div>
                  )
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={filteredQuarters.map(opt => ({ label: opt, value: opt }))}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'quarter')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            {/* SCOPE */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.scope || ''}
                onSearch={(val) => handleSearch('scope', val)}
                style={{ width: getFilterWidth('scope'), minWidth: getFilterWidth('scope') }}
                placeholder="Scope"
                value={gccScope || []}
                open={openStates.scope}
                onDropdownVisibleChange={(open) => handleDropdownVisibleChange('scope', open)}
                onChange={(val) => {
                  const newScope = val.length > 0 ? val : undefined
                  setGccScope(newScope)
                  // 立即同步到 filterState.scope，确保级联筛选立即生效
                  // 使用 setExternalScope 确保立即生效，避免异步更新延迟
                  setExternalScope(newScope)
                }}
                onSelect={() => handleSelect('scope')}
                onDeselect={() => handleDeselect('scope')}
                onFocus={() => handleFieldFocus('scope')}
                allowClear
                showSearch
                maxTagCount="responsive"
                dropdownRender={(menu) => {
                  return (
                    <div 
                      onMouseDown={(e) => {
                        // 阻止事件传播到 document，防止触发关闭逻辑
                        // 但不阻止默认行为，让 Ant Design 可以处理选择
                        e.stopPropagation()
                      }}
                      onClick={(e) => {
                        // 阻止点击事件传播
                        e.stopPropagation()
                      }}
                      onPointerDown={(e) => {
                        // 阻止 pointer 事件传播
                        e.stopPropagation()
                      }}
                    >
                      {menu}
                    </div>
                  )
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={filteredScopes.map(opt => ({ label: opt, value: opt }))}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'scope')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            {/* Discipline */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.discipline || ''}
                onSearch={(val) => handleSearch('discipline', val)}
                style={{ width: getFilterWidth('discipline'), minWidth: getFilterWidth('discipline') }}
                placeholder="Discipline"
                value={filterState.discipline || []}
                open={openStates.discipline}
                onDropdownVisibleChange={(open) => handleDropdownVisibleChange('discipline', open)}
                onChange={(val) => handleChange('discipline', val, (v) => updateFilter('discipline', v))}
                onSelect={() => handleSelect('discipline')}
                onDeselect={() => handleDeselect('discipline')}
                onFocus={() => handleFieldFocus('discipline')}
                allowClear
                showSearch
                maxTagCount="responsive"
                dropdownRender={(menu) => {
                  return (
                    <div 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {menu}
                    </div>
                  )
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={options.disciplines.map(opt => ({ label: opt, value: opt }))}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'discipline')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            {/* Implement Phase */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.implement_phase || ''}
                onSearch={(val) => handleSearch('implement_phase', val)}
                style={{ width: getFilterWidth('implement_phase'), minWidth: getFilterWidth('implement_phase') }}
                placeholder="Implement Phase"
              value={filterState.implement_phase || []}
                open={openStates.implement_phase}
                onDropdownVisibleChange={(open) => handleDropdownVisibleChange('implement_phase', open)}
                onChange={(val) => handleChange('implement_phase', val, (v) => updateFilter('implement_phase', v))}
                onSelect={() => handleSelect('implement_phase')}
                onDeselect={() => handleDeselect('implement_phase')}
                onFocus={() => handleFieldFocus('implement_phase')}
                allowClear
                showSearch
                maxTagCount="responsive"
                dropdownRender={(menu) => {
                  return (
                    <div 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {menu}
                    </div>
                  )
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={options.implement_phases.map(opt => ({ label: opt, value: opt }))}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'implement_phase')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            {/* Contract Phase */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.contract_phase || ''}
                onSearch={(val) => handleSearch('contract_phase', val)}
                style={{ width: getFilterWidth('contract_phase'), minWidth: getFilterWidth('contract_phase') }}
                placeholder="Contract Phase"
              value={filterState.contract_phase || []}
                open={openStates.contract_phase}
                onDropdownVisibleChange={(open) => handleDropdownVisibleChange('contract_phase', open)}
                onChange={(val) => handleChange('contract_phase', val, (v) => updateFilter('contract_phase', v))}
                onSelect={() => handleSelect('contract_phase')}
                onDeselect={() => handleDeselect('contract_phase')}
                onFocus={() => handleFieldFocus('contract_phase')}
                allowClear
                showSearch
                maxTagCount="responsive"
                dropdownRender={(menu) => {
                  return (
                    <div 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {menu}
                    </div>
                  )
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={options.contract_phases.map(opt => ({ label: opt, value: opt }))}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'contract_phase')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            {/* Type */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.type || ''}
                onSearch={(val) => handleSearch('type', val)}
                style={{ width: getFilterWidth('type'), minWidth: getFilterWidth('type') }}
                placeholder="Type"
                value={filterState.type || []}
                open={openStates.type}
                onDropdownVisibleChange={(open) => handleDropdownVisibleChange('type', open)}
                onChange={(val) => handleChange('type', val, (v) => updateFilter('type', v))}
                onSelect={() => handleSelect('type')}
                onDeselect={() => handleDeselect('type')}
                onFocus={() => handleFieldFocus('type')}
                allowClear
                showSearch
                maxTagCount="responsive"
                dropdownRender={(menu) => {
                  return (
                    <div 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {menu}
                    </div>
                  )
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={options.types.map(opt => ({ label: opt, value: opt }))}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'type')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            {/* Work Package */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.work_package || ''}
                onSearch={(val) => handleSearch('work_package', val)}
                style={{ width: getFilterWidth('work_package'), minWidth: getFilterWidth('work_package') }}
                placeholder="Work Package"
                value={filterState.work_package || []}
                open={openStates.work_package}
                onDropdownVisibleChange={(open) => handleDropdownVisibleChange('work_package', open)}
                onChange={(val) => handleChange('work_package', val, (v) => updateFilter('work_package', v))}
                onSelect={() => handleSelect('work_package')}
                onDeselect={() => handleDeselect('work_package')}
                onFocus={() => handleFieldFocus('work_package')}
                allowClear
                showSearch
                maxTagCount="responsive"
                dropdownRender={(menu) => {
                  return (
                    <div 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {menu}
                    </div>
                  )
                }}
                filterOption={(input, option) => {
                  const label = typeof option?.label === 'string' ? option.label : ''
                  const value = typeof option?.value === 'string' ? option.value : ''
                  // 搜索时同时匹配 label 和 value（value 是 work_package 值）
                  return label.toLowerCase().includes(input.toLowerCase()) || 
                         value.toLowerCase().includes(input.toLowerCase())
                }}
                options={workPackageOptions}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'work_package')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            {/* Resource ID Name */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.resource_id_name || ''}
                onSearch={(val) => handleSearch('resource_id_name', val)}
                style={{ width: getFilterWidth('resource_id_name'), minWidth: getFilterWidth('resource_id_name') }}
                placeholder="Resource ID Name"
                value={filterState.resource_id_name || []}
                open={openStates.resource_id_name}
                onDropdownVisibleChange={(open) => handleDropdownVisibleChange('resource_id_name', open)}
                onChange={(val) => handleChange('resource_id_name', val, (v) => updateFilter('resource_id_name', v))}
                onSelect={() => handleSelect('resource_id_name')}
                onDeselect={() => handleDeselect('resource_id_name')}
                onFocus={() => handleFieldFocus('resource_id_name')}
                allowClear
                showSearch
                maxTagCount="responsive"
                dropdownRender={(menu) => {
                  return (
                    <div 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {menu}
                    </div>
                  )
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={options.resource_id_names.map(opt => ({ label: opt, value: opt }))}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'resource_id_name')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            {/* BCC KQ Code */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.bcc_kq_code || ''}
                onSearch={(val) => handleSearch('bcc_kq_code', val)}
                style={{ width: getFilterWidth('bcc_kq_code'), minWidth: getFilterWidth('bcc_kq_code') }}
                placeholder="KQ Code"
                value={filterState.bcc_kq_code || []}
                open={openStates.bcc_kq_code}
                onDropdownVisibleChange={(open) => handleDropdownVisibleChange('bcc_kq_code', open)}
                onChange={(val) => handleChange('bcc_kq_code', val, (v) => updateFilter('bcc_kq_code', v))}
                onSelect={() => handleSelect('bcc_kq_code')}
                onDeselect={() => handleDeselect('bcc_kq_code')}
                onFocus={() => handleFieldFocus('bcc_kq_code')}
                allowClear
                showSearch
                maxTagCount="responsive"
                dropdownRender={(menu) => {
                  return (
                    <div 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {menu}
                    </div>
                  )
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={options.bcc_kq_codes.map(opt => ({ label: opt, value: opt }))}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'bcc_kq_code')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            {/* KQ */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.kq || ''}
                onSearch={(val) => handleSearch('kq', val)}
                style={{ width: getFilterWidth('kq'), minWidth: getFilterWidth('kq') }}
                placeholder="isKQ?"
                value={filterState.kq || []}
                open={openStates.kq}
                onDropdownVisibleChange={(open) => handleDropdownVisibleChange('kq', open)}
                onChange={(val) => handleChange('kq', val, (v) => updateFilter('kq', v))}
                onSelect={() => handleSelect('kq')}
                onDeselect={() => handleDeselect('kq')}
                onFocus={() => handleFieldFocus('kq')}
                allowClear
                showSearch
                maxTagCount="responsive"
                dropdownRender={(menu) => {
                  return (
                    <div 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {menu}
                    </div>
                  )
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={options.kqs.map(opt => ({ label: opt, value: opt }))}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'kq')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            {/* CN WK Report */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Select
                mode="multiple"
                size="small"
                autoClearSearchValue={false}
                searchValue={searchValues.cn_wk_report || ''}
                onSearch={(val) => handleSearch('cn_wk_report', val)}
                style={{ width: getFilterWidth('cn_wk_report'), minWidth: getFilterWidth('cn_wk_report') }}
                placeholder="Key Quantity"
                value={filterState.cn_wk_report || []}
                open={openStates.cn_wk_report}
                onDropdownVisibleChange={(open) => handleDropdownVisibleChange('cn_wk_report', open)}
                onChange={(val) => handleChange('cn_wk_report', val, (v) => updateFilter('cn_wk_report', v))}
                onSelect={() => handleSelect('cn_wk_report')}
                onDeselect={() => handleDeselect('cn_wk_report')}
                onFocus={() => handleFieldFocus('cn_wk_report')}
                allowClear
                showSearch
                maxTagCount="responsive"
                dropdownRender={(menu) => {
                  return (
                    <div 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {menu}
                    </div>
                  )
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={options.cn_wk_reports.map(opt => ({ label: opt, value: opt }))}
              />
              <div
                onMouseDown={(e) => handleFilterResizeStart(e, 'cn_wk_report')}
                style={{
                  position: 'absolute',
                  right: -4,
                  top: 0,
                  bottom: 0,
                  width: '8px',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            </div>
            </Space>
          </div>
        </Col>
        <Col>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
            size="small"
            style={{ borderRadius: '6px' }}
          >
            重置
          </Button>
        </Col>
      </Row>
    </Card>
  )
}

export default GlobalFilter

