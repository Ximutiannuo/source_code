import { useState, useEffect, useCallback, useRef } from 'react'
import { facilityFilterService, type FacilityFilterParams } from '../services/facilityFilterService'

export interface FacilityFilterState {
  project?: string[]
  subproject?: string[]
  train?: string[]
  unit?: string[]
  simple_block?: string[]
  main_block?: string[]
  block?: string[]
  quarter?: string[]
  // activity_summary 相关字段
  scope?: string[]
  discipline?: string[]
  implement_phase?: string[]
  contract_phase?: string[]
  type?: string[]
  work_package?: string[]
  // rsc_defines 相关字段
  resource_id_name?: string[]
  bcc_kq_code?: string[]
  kq?: string[]
  cn_wk_report?: string[]
}

export const useFacilityFilter = (initialState?: FacilityFilterState) => {
  const [filterState, setFilterState] = useState<FacilityFilterState>(initialState || {})
  // 用于存储外部的 scope 值（用于立即同步，避免异步更新延迟）
  const externalScopeRef = useRef<string[] | undefined>(undefined)
  const [options, setOptions] = useState<{
    projects: string[]
    subproject_codes: string[]
    trains: string[]
    units: string[]
    simple_blocks: string[]
    main_blocks: Record<string, string[]>  // 字典格式：key是simple_block，value是main_block列表
    blocks: Record<string, string[]>  // 字典格式：key是main_block，value是block列表
    quarters: string[]
    scopes: string[]
    disciplines: string[]
    implement_phases: string[]
    contract_phases: string[]
    types: string[]
    work_packages: string[]
    resource_id_names: string[]
    bcc_kq_codes: string[]
    kqs: string[]
    cn_wk_reports: string[]
  }>({
    projects: [],
    subproject_codes: [],
    trains: [],
    units: [],
    simple_blocks: [],
    main_blocks: {},
    blocks: {},
    quarters: [],
    scopes: [],
    disciplines: [],
    implement_phases: [],
    contract_phases: [],
    types: [],
    work_packages: [],
    resource_id_names: [],
    bcc_kq_codes: [],
    kqs: [],
    cn_wk_reports: [],
  })

  // 存储正在进行的请求，用于取消
  const pendingControllersRef = useRef<Map<string, AbortController>>(new Map())

  // 更新选项的函数
  const updateOptions = useCallback(async (
    excludeField?: keyof FacilityFilterParams,
    onlyUpdateField?: keyof FacilityFilterParams,
    overrideState?: FacilityFilterState // 新增：支持覆盖状态，解决重置时的闭包问题
  ) => {
    // 优先使用传入的 overrideState，否则使用当前 filterState
    const currentState = overrideState || filterState
    
    // 获取当前选择的值
    const scopeValue = externalScopeRef.current && externalScopeRef.current.length > 0 
      ? externalScopeRef.current 
      : (currentState.scope && currentState.scope.length > 0 ? currentState.scope : undefined)
      
    const params: FacilityFilterParams = {
      subproject: currentState.subproject && currentState.subproject.length > 0 
        ? currentState.subproject 
        : undefined,
      train: currentState.train && currentState.train.length > 0 
        ? currentState.train 
        : undefined,
      unit: currentState.unit && currentState.unit.length > 0 
        ? currentState.unit 
        : undefined,
      simple_block: currentState.simple_block && currentState.simple_block.length > 0 
        ? currentState.simple_block 
        : undefined,
      main_block: currentState.main_block && currentState.main_block.length > 0 
        ? currentState.main_block 
        : undefined,
      block: currentState.block && currentState.block.length > 0 
        ? currentState.block 
        : undefined,
      quarter: currentState.quarter && currentState.quarter.length > 0 
        ? currentState.quarter 
        : undefined,
      scope: scopeValue,
      discipline: currentState.discipline && currentState.discipline.length > 0 
        ? currentState.discipline 
        : undefined,
      implement_phase: currentState.implement_phase && currentState.implement_phase.length > 0 
        ? currentState.implement_phase 
        : undefined,
      contract_phase: currentState.contract_phase && currentState.contract_phase.length > 0 
        ? currentState.contract_phase 
        : undefined,
      type: currentState.type && currentState.type.length > 0 
        ? currentState.type 
        : undefined,
      work_package: currentState.work_package && currentState.work_package.length > 0 
        ? currentState.work_package 
        : undefined,
      resource_id_name: currentState.resource_id_name && currentState.resource_id_name.length > 0 
        ? currentState.resource_id_name 
        : undefined,
      bcc_kq_code: currentState.bcc_kq_code && currentState.bcc_kq_code.length > 0 
        ? currentState.bcc_kq_code 
        : undefined,
      kq: currentState.kq && currentState.kq.length > 0 
        ? currentState.kq 
        : undefined,
      cn_wk_report: currentState.cn_wk_report && currentState.cn_wk_report.length > 0 
        ? currentState.cn_wk_report 
        : undefined,
    }

    // 生成请求键（用于去重和取消）
    const paramsForKey = Object.entries(params).reduce((acc, [k, v]) => {
      if (v !== undefined && v !== null) {
        // 如果是数组，转换为排序后的字符串；如果是字符串，直接使用
        if (Array.isArray(v)) {
          acc[k] = [...v].sort().join(',')
        } else {
          acc[k] = v
        }
      }
      return acc
    }, {} as Record<string, string>)
    const qs = new URLSearchParams(paramsForKey).toString()
    const requestKey = `${excludeField || ''}_${onlyUpdateField || ''}_${qs}`

    // 如果已经有相同的请求正在进行，取消它
    const existingController = pendingControllersRef.current.get(requestKey)
    if (existingController) {
      existingController.abort()
    }

    // 创建新的 AbortController
    const controller = new AbortController()
    pendingControllersRef.current.set(requestKey, controller)

    try {
      const data = await facilityFilterService.getOptions(params, controller.signal)
      
      // 请求完成后移除
      pendingControllersRef.current.delete(requestKey)

      // 如果指定了只更新某个字段，则只更新该字段
      if (onlyUpdateField) {
        setOptions(prev => {
          const updates: Partial<typeof prev> = {}
          
          switch (onlyUpdateField) {
            case 'subproject':
              updates.subproject_codes = data.subproject_codes || []
              break
            case 'train':
              updates.trains = data.trains || []
              break
            case 'unit':
              updates.units = data.units || []
              break
            case 'simple_block':
              updates.simple_blocks = data.simple_blocks || []
              break
            case 'main_block':
              updates.main_blocks = data.main_blocks || {}
              break
            case 'block':
              updates.blocks = data.blocks || {}
              break
            case 'quarter':
              updates.quarters = data.quarters || []
              break
            case 'scope':
              updates.scopes = data.scopes || []
              break
            case 'discipline':
              updates.disciplines = data.disciplines || []
              break
            case 'implement_phase':
              updates.implement_phases = data.implement_phases || []
              break
            case 'contract_phase':
              updates.contract_phases = data.contract_phases || []
              break
            case 'type':
              updates.types = data.types || []
              break
            case 'work_package':
              updates.work_packages = data.work_packages || []
              break
            case 'resource_id_name':
              updates.resource_id_names = data.resource_id_names || []
              break
            case 'bcc_kq_code':
              updates.bcc_kq_codes = data.bcc_kq_codes || []
              break
            case 'kq':
              updates.kqs = data.kqs || []
              break
            case 'cn_wk_report':
              updates.cn_wk_reports = data.cn_wk_reports || []
              break
          }
          
          return { ...prev, ...updates }
        })
        return
      }

      // 否则更新所有选项（change 事件）
      // 注意：如果当前有正在操作的字段 (excludeField)，我们不更新该字段的选项，
      // 这样可以防止“锁死”现象（即下拉框中只剩下当前选中的值），
      // 同时也保证了其他字段（如 quarter）能根据最新的 filterState 进行更新。
      setOptions(prev => {
        const newOptions = { ...prev }
        
        // 更新所有字段的选项，除非它是正在操作的排除字段
        if (excludeField !== 'subproject') {
          newOptions.subproject_codes = data.subproject_codes || []
        }
        if (excludeField !== 'train') {
          newOptions.trains = data.trains || []
        }
        if (excludeField !== 'unit') {
          newOptions.units = data.units || []
        }
        if (excludeField !== 'simple_block') {
          newOptions.simple_blocks = data.simple_blocks || []
        }
        
        // main_blocks 和 blocks 的特殊处理
        if (excludeField !== 'main_block' && excludeField !== 'simple_block') {
          newOptions.main_blocks = data.main_blocks || {}
        }
        if (excludeField !== 'block' && excludeField !== 'main_block') {
          newOptions.blocks = data.blocks || {}
        }

        if (excludeField !== 'quarter') {
          newOptions.quarters = data.quarters || []
        }
        if (excludeField !== 'scope') {
          newOptions.scopes = data.scopes || []
        }
        // activity_summary 相关字段
        if (excludeField !== 'discipline') {
          newOptions.disciplines = data.disciplines || []
        }
        if (excludeField !== 'implement_phase') {
          newOptions.implement_phases = data.implement_phases || []
        }
        if (excludeField !== 'contract_phase') {
          newOptions.contract_phases = data.contract_phases || []
        }
        if (excludeField !== 'type') {
          newOptions.types = data.types || []
        }
        if (excludeField !== 'work_package') {
          newOptions.work_packages = data.work_packages || []
        }
        // rsc_defines 相关字段
        if (excludeField !== 'resource_id_name') {
          newOptions.resource_id_names = data.resource_id_names || []
        }
        if (excludeField !== 'bcc_kq_code') {
          newOptions.bcc_kq_codes = data.bcc_kq_codes || []
        }
        if (excludeField !== 'kq') {
          newOptions.kqs = data.kqs || []
        }
        if (excludeField !== 'cn_wk_report') {
          newOptions.cn_wk_reports = data.cn_wk_reports || []
        }
        
        // projects 总是更新
        newOptions.projects = data.projects || []

        return newOptions
      })
    } catch (error: any) {
      // 请求完成后移除
      pendingControllersRef.current.delete(requestKey)
      // 忽略请求被取消的错误（AbortError, ERR_CANCELED, CanceledError）
      const isCancel = 
        error?.name === 'AbortError' || 
        error?.code === 'ERR_CANCELED' || 
        error?.name === 'CanceledError' ||
        error?.message === 'canceled'
        
      if (!isCancel) {
        console.error('更新筛选器选项失败:', error)
      }
    }
  }, [filterState])

  // 防抖定时器 Map（每个字段独立防抖）
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // 防抖函数（按照 JS 逻辑）
  const debounceUpdate = useCallback((
    func: () => void,
    wait: number,
    key: string
  ) => {
    if (debounceTimersRef.current.has(key)) {
      clearTimeout(debounceTimersRef.current.get(key)!)
    }
    const timer = setTimeout(() => {
      func()
      debounceTimersRef.current.delete(key)
    }, wait)
    debounceTimersRef.current.set(key, timer)
  }, [])

  // 存储当前正在操作的字段（下拉框打开的字段）
  const activeFieldRef = useRef<keyof FacilityFilterParams | null>(null)

  // 当筛选状态改变时，更新选项（change 事件，500ms 防抖，增加防抖时间以减少API请求）
  // 但排除当前正在操作的字段，避免更新导致下拉框关闭
  // 注意：scope 是全局筛选条件，永远不应该被排除
  useEffect(() => {
    debounceUpdate(() => {
      // 如果有正在操作的字段，排除它，不更新它的选项
      // 但是，其他字段的选项需要更新，以反映级联过滤的结果
      // 重要：scope 是全局筛选条件，永远不应该被排除
      if (activeFieldRef.current && activeFieldRef.current !== 'scope') {
        updateOptions(activeFieldRef.current) // 排除当前字段，更新其他字段（但 scope 不会被排除）
      } else {
        updateOptions() // 没有正在操作的字段，更新所有选项
      }
    }, 500, 'change')
  }, [filterState, updateOptions, debounceUpdate])

  // 设置当前正在操作的字段
  const setActiveField = useCallback((field: keyof FacilityFilterParams | null) => {
    activeFieldRef.current = field
  }, [])

  // 清除当前正在操作的字段
  const clearActiveField = useCallback(() => {
    activeFieldRef.current = null
  }, [])

  // 初始化时加载选项
  // 注意：不在这里立即加载，等待外部设置 scope 后再加载
  // 这样可以确保第一次请求就包含 scope 参数
  // useEffect(() => {
  //   updateOptions()
  // }, [])

  // 更新筛选器值（支持多选数组）
  const updateFilter = useCallback((key: keyof FacilityFilterState, value: string[] | undefined) => {
    setFilterState(prev => {
      const newState = { ...prev, [key]: value && value.length > 0 ? value : undefined }
      
      // 级联清除：当上级字段改变时，清除下级字段
      // 注意：不再强制清除，允许用户自由选择任何组合
      if (key === 'main_block' && JSON.stringify(value) !== JSON.stringify(prev.main_block)) {
        newState.block = undefined
      }
      
      return newState
    })
  }, [])

  // 处理 focus 事件：当用户点击某个筛选器时，如果该字段有值，排除该字段来获取所有可选项（300ms 防抖）
  // 注意：scope 是全局筛选条件，永远不应该被排除
  const handleFieldFocus = useCallback((field: keyof FacilityFilterParams) => {
    const currentValue = filterState[field]
    if (currentValue && currentValue.length > 0) {
      // 如果当前字段有值，则排除该字段来获取所有可选项，但只更新当前字段
      // 但是，如果字段是 scope，不应该排除它（scope 是全局筛选条件）
      const excludeField = field === 'scope' ? undefined : field
      debounceUpdate(() => {
        updateOptions(excludeField, field) // excludeField 和 onlyUpdateField 都是当前字段（除非是 scope）
      }, 300, `focus_${field}`)
    }
  }, [filterState, updateOptions, debounceUpdate])

  // 重置筛选器
  const resetFilter = useCallback(() => {
    // 取消所有正在进行的请求
    pendingControllersRef.current.forEach(controller => {
      controller.abort()
    })
    pendingControllersRef.current.clear()
    
    // 清除所有防抖定时器
    debounceTimersRef.current.forEach(timer => {
      clearTimeout(timer)
    })
    debounceTimersRef.current.clear()
    
    setFilterState({})
    // 重置后重新加载选项，显式传入空对象作为 overrideState
    // 这样可以确保请求不带任何旧条件，彻底解决重置失效问题
    updateOptions(undefined, undefined, {})
  }, [updateOptions])

  // 设置外部 scope 值的函数（用于立即同步）
  const setExternalScope = useCallback((scope: string[] | undefined) => {
    externalScopeRef.current = scope
    // 更新 filterState.scope，这会触发 useEffect 自动调用 updateOptions
    updateFilter('scope', scope)
    // 注意：不需要手动调用 updateOptions，因为 filterState 更新会触发 useEffect
  }, [updateFilter])

  return {
    filterState,
    options,
    updateFilter,
    handleFieldFocus,
    resetFilter,
    setActiveField,
    clearActiveField,
    setExternalScope,
    // 新增：强制同步整个外部状态，解决 F5 刷新后从 localStorage 恢复数据的问题
    syncExternalState: (newState: FacilityFilterState) => {
      setFilterState(newState);
      externalScopeRef.current = newState.scope;
      updateOptions();
    },
    isLoading: false,
  }
}

