import { logger } from '../../utils/logger'
import { useState, useEffect } from 'react'
import { Modal, Input, Button, DatePicker, Table, App, Spin, Select, Upload } from 'antd'
import { PlusOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { reportService } from '../../services/reportService'
import { activityService, type Activity } from '../../services/activityService'
import { handleUnifiedExport } from '../../utils/exportUtils'
import { importService } from '../../services/importService'
import { workstepService, type WorkStepDefine } from '../../services/workstepService'
import ImportResultModal from './ImportResultModal'
import dayjs, { type Dayjs } from 'dayjs'

interface VFACTDBWeeklyDistributeModalProps {
  visible: boolean
  onCancel: () => void
  onSuccess: () => void
}

interface Statistics {
  activity_id: string
  total_achieved: number
  min_date: string | null
  max_date: string | null
  record_count: number
}

interface DistributeItem {
  id: number
  activity_id: string
  start_date?: Dayjs
  finish_date?: Dayjs
  total_quantity: number | string
  scope?: string  // 用户选择的Scope
  work_step_description?: string // 工作步骤描述
  // 从activity自动获取的字段（只读）
  activity_info?: Activity | null
  loadingActivity?: boolean
  statistics?: Statistics | null
  loadingStatistics?: boolean
  workstepDefines?: WorkStepDefine[]
  loadingWorksteps?: boolean
}

const VFACTDBWeeklyDistributeModal = ({ visible, onCancel, onSuccess }: VFACTDBWeeklyDistributeModalProps) => {
  const { message: messageApi } = App.useApp()
  const queryClient = useQueryClient()
  const [items, setItems] = useState<DistributeItem[]>([])
  const [nextId, setNextId] = useState(1)
  const [availableScopes, setAvailableScopes] = useState<string[]>([])
  const [loadingScopes, setLoadingScopes] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [showResultModal, setShowResultModal] = useState(false)

  // 获取所有可用的Scope列表（用于下拉选择）
  useEffect(() => {
    const fetchScopes = async () => {
      setLoadingScopes(true)
      try {
        const response = await activityService.getActivitiesAdvanced({
          filters: {},
          skip: 0,
          limit: 10000,
          order_by: [{ field: 'scope', order: 'asc' }],
        })
        const scopes = new Set<string>()
        response.items.forEach((item: Activity) => {
          if (item.scope) {
            scopes.add(item.scope)
          }
        })
        setAvailableScopes(Array.from(scopes).sort())
      } catch (error) {
        logger.error('获取Scope列表失败:', error)
      } finally {
        setLoadingScopes(false)
      }
    }
    fetchScopes()
  }, [])

  const mutation = useMutation({
    mutationFn: reportService.weeklyDistributeVFACTDB,
    onSuccess: (data) => {
      messageApi.success(data.message || '按周分配成功')
      queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
      queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
      handleCancel()
      onSuccess()
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '按周分配失败')
    },
  })

  // 获取Activity信息
  const fetchActivityInfo = async (activityId: string): Promise<Activity | null> => {
    if (!activityId || activityId.trim() === '' || activityId.trim().length < 18) {
      return null
    }
    try {
      const data = await activityService.getActivityById(activityId.trim())
      return data
    } catch (error: any) {
      return null
    }
  }

  // 获取统计信息
  const fetchStatistics = async (activityId: string): Promise<Statistics | null> => {
    if (!activityId || activityId.trim() === '' || activityId.trim().length < 18) {
      return null
    }
    try {
      const data = await reportService.getVFACTDBStatistics(activityId.trim())
      return data
    } catch (error: any) {
      return null
    }
  }

  // 获取工作步骤定义
  const fetchWorksteps = async (workPackage: string): Promise<WorkStepDefine[]> => {
    if (!workPackage) return []
    try {
      // 只获取关键数量 (is_key_quantity=true)
      const data = await workstepService.getWorkStepDefines({ 
        work_package: workPackage,
        is_key_quantity: true,
        is_active: true 
      })
      return data
    } catch (error) {
      logger.error('获取工作步骤失败:', error)
      return []
    }
  }

  const handleAdd = () => {
    const newItem: DistributeItem = {
      id: nextId,
      activity_id: '',
      total_quantity: '',
    }
    setItems([...items, newItem])
    setNextId(nextId + 1)
  }

  const handleDelete = (id: number) => {
    setItems(items.filter(item => item.id !== id))
  }

  const handleItemChange = async (id: number, field: keyof DistributeItem, value: any) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value }
        
        // 如果修改的是activity_id，则获取activity信息和统计信息
        if (field === 'activity_id') {
          const activityId = value?.trim() || ''
          if (activityId.length >= 18) {
            // 设置loading状态
            updatedItem.loadingActivity = true
            updatedItem.activity_info = undefined
            updatedItem.loadingStatistics = true
            updatedItem.statistics = undefined
            // 清空scope，等待异步获取后自动填充
            updatedItem.scope = undefined
            
            // 异步获取activity信息和统计信息
            Promise.all([
              fetchActivityInfo(activityId),
              fetchStatistics(activityId)
            ]).then(async ([activityInfo, stats]) => {
              let worksteps: WorkStepDefine[] = []
              if (activityInfo?.work_package) {
                worksteps = await fetchWorksteps(activityInfo.work_package)
              }

              setItems(prevItems => 
                prevItems.map(prevItem => 
                  prevItem.id === id 
                    ? { 
                        ...prevItem, 
                        activity_info: activityInfo, 
                        loadingActivity: false,
                        statistics: stats,
                        loadingStatistics: false,
                        workstepDefines: worksteps,
                        loadingWorksteps: false,
                        scope: activityInfo?.scope || prevItem.scope // 自动填充推荐的Scope
                      }
                    : prevItem
                )
              )
            }).catch(() => {
              setItems(prevItems => 
                prevItems.map(prevItem => 
                  prevItem.id === id 
                    ? { 
                        ...prevItem, 
                        activity_info: null, 
                        loadingActivity: false,
                        statistics: null,
                        loadingStatistics: false
                      }
                    : prevItem
                )
              )
            })
          } else {
            updatedItem.activity_info = null
            updatedItem.loadingActivity = false
            updatedItem.statistics = null
            updatedItem.loadingStatistics = false
            updatedItem.scope = undefined
          }
        }
        
        return updatedItem
      }
      return item
    })
    
    setItems(updatedItems)
  }

  const handleSubmit = async () => {
    // 只验证有填写activity_id的记录
    const validItems = items.filter(item => item.activity_id && item.activity_id.trim() !== '')
    
    if (validItems.length === 0) {
      messageApi.warning('请至少填写一个作业ID')
      return
    }

    // 验证所有有效项目
    const errors: string[] = []
    validItems.forEach((item) => {
      const rowNumber = items.findIndex(i => i.id === item.id) + 1
      if (!item.activity_id || item.activity_id.trim() === '') {
        errors.push(`第 ${rowNumber} 行的作业ID不能为空`)
      }
      if (!item.scope) {
        errors.push(`第 ${rowNumber} 行的Scope不能为空，请选择Scope`)
      }
      if (!item.work_step_description) {
        errors.push(`第 ${rowNumber} 行的工作步骤描述不能为空`)
      }
      // 验证Scope是否匹配
      if (item.scope && item.activity_info && item.activity_info.scope !== item.scope) {
        errors.push(`第 ${rowNumber} 行的Scope "${item.scope}" 与作业ID "${item.activity_id}" 的Scope "${item.activity_info.scope}" 不匹配`)
      }
      if (!item.start_date) {
        errors.push(`第 ${rowNumber} 行的开始日期不能为空`)
      }
      if (!item.finish_date) {
        errors.push(`第 ${rowNumber} 行的结束日期不能为空`)
      }
      if (item.start_date && item.finish_date && item.start_date.isAfter(item.finish_date)) {
        errors.push(`第 ${rowNumber} 行的开始日期不能晚于结束日期`)
      }
      const totalQuantityValue = typeof item.total_quantity === 'string' 
        ? parseFloat(item.total_quantity) 
        : item.total_quantity
      if (!totalQuantityValue || totalQuantityValue <= 0 || isNaN(totalQuantityValue)) {
        errors.push(`第 ${rowNumber} 行的总量必须大于0`)
      }
      // 验证日期范围不与已有记录重叠
      if (item.statistics?.min_date && item.statistics?.max_date) {
        const existingMin = dayjs(item.statistics.min_date)
        const existingMax = dayjs(item.statistics.max_date)
        const hasOverlap = !(
          item.finish_date!.isBefore(existingMin, 'day') || 
          item.start_date!.isAfter(existingMax, 'day')
        )
        if (hasOverlap) {
          errors.push(`第 ${rowNumber} 行的日期范围与已有记录重叠。已有记录的时间范围是 ${item.statistics.min_date} 到 ${item.statistics.max_date}`)
        }
      }
    })

    if (errors.length > 0) {
      messageApi.error(errors[0])
      return
    }

    // 转换为API格式（只包含有效的记录）
    const requests = validItems.map(item => {
      const totalQuantityValue = typeof item.total_quantity === 'string' 
        ? parseFloat(item.total_quantity) 
        : item.total_quantity
      return {
        activity_id: item.activity_id.trim(),
        start_date: item.start_date!.format('YYYY-MM-DD'),
        finish_date: item.finish_date!.format('YYYY-MM-DD'),
        total_quantity: totalQuantityValue,
        scope: item.scope!,
        project: item.activity_info?.project,
        subproject: item.activity_info?.subproject,
        implement_phase: item.activity_info?.implement_phase,
        train: item.activity_info?.train,
        unit: item.activity_info?.unit,
        block: item.activity_info?.block,
        quarter: item.activity_info?.quarter,
        main_block: item.activity_info?.main_block,
        title: item.activity_info?.title,
        work_step_description: item.work_step_description,
        discipline: item.activity_info?.discipline,
        work_package: item.activity_info?.work_package,
      }
    })

    // 逐个提交（因为API只支持单个请求）
    let successCount = 0
    const submitErrors: string[] = []
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i]
      try {
        await reportService.weeklyDistributeVFACTDB(request)
        successCount++
      } catch (error: any) {
        const errorMsg = error?.response?.data?.detail || '创建失败'
        submitErrors.push(`第 ${i + 1} 条：${errorMsg}`)
      }
    }

    if (submitErrors.length === 0) {
      messageApi.success(`成功创建 ${successCount} 条记录`)
      queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
      queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
      handleCancel()
      onSuccess()
    } else {
      messageApi.warning(`部分成功：成功 ${successCount}，失败 ${submitErrors.length}。${submitErrors[0]}`)
      queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
      queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
      handleCancel()
      onSuccess()
    }
  }

  const handleCancel = () => {
    setItems([])
    setNextId(1)
    onCancel()
  }

  const [exporting, setExporting] = useState(false)

  const handleDownloadTemplate = async () => {
    handleUnifiedExport(
      'vfactdb',
      { template_type: 'distribute_template' },
      messageApi,
      setExporting,
      'VFACTDB_Distribute_Template'
    )
  }

  const handleImportExcel = async (file: File) => {
    try {
      const response = await importService.importVFACTDBWeeklyDistribute(file)
      setImportResult(response)
      setShowResultModal(true)
      
      if (response.success && response.imported_count > 0) {
        if (response.error_count === 0) {
          messageApi.success(`导入成功！共 ${response.imported_count} 条记录`)
        } else {
          messageApi.warning(`导入完成：成功 ${response.imported_count} 条，失败 ${response.error_count} 条`)
        }
        queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
        queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
        // 注意：这里不再立即调用 handleCancel()，让用户看到 ImportResultModal
      }
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || '导入失败')
    }
    return false // 阻止自动上传
  }

  const columns = [
    {
      title: '作业ID',
      dataIndex: 'activity_id',
      key: 'activity_id',
      width: 200,
      render: (_: any, record: DistributeItem) => (
        <Input
          value={record.activity_id}
          onChange={(e) => handleItemChange(record.id, 'activity_id', e.target.value)}
          placeholder="请输入作业ID"
        />
      ),
    },
    {
      title: 'Scope（必选）',
      key: 'scope',
      width: 150,
      render: (_: any, record: DistributeItem) => {
        if (record.loadingActivity || loadingScopes) {
          return <Spin size="small" />
        }
        // 如果有activity信息，显示推荐的scope
        const recommendedScope = record.activity_info?.scope
        return (
          <Select
            value={record.scope}
            onChange={(value) => handleItemChange(record.id, 'scope', value)}
            placeholder="请选择Scope"
            style={{ width: '100%' }}
            showSearch
            allowClear
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={Array.from(new Set([...availableScopes, ...(recommendedScope ? [recommendedScope] : [])])).map(scope => ({
              label: scope,
              value: scope,
            }))}
            status={recommendedScope && record.scope && record.scope !== recommendedScope ? 'error' : undefined}
          />
        )
      },
    },
    {
      title: '工作步骤描述',
      key: 'work_step_description',
      width: 200,
      render: (_: any, record: DistributeItem) => {
        if (record.loadingWorksteps) {
          return <Spin size="small" />
        }
        return (
          <Select
            value={record.work_step_description}
            onChange={(value) => handleItemChange(record.id, 'work_step_description', value)}
            placeholder="请选择工作步骤"
            style={{ width: '100%' }}
            showSearch
            options={record.workstepDefines?.map(ws => ({
              label: ws.work_step_description,
              value: ws.work_step_description,
            })) || []}
          />
        )
      },
    },
    {
      title: '推荐Scope',
      key: 'recommended_scope',
      width: 120,
      render: (_: any, record: DistributeItem) => {
        if (record.loadingActivity) {
          return <Spin size="small" />
        }
        if (record.activity_info?.scope) {
          return (
            <span style={{ color: record.scope === record.activity_info.scope ? '#52c41a' : '#ff4d4f' }}>
              {record.activity_info.scope}
            </span>
          )
        }
        return <span style={{ color: '#999' }}>-</span>
      },
    },
    {
      title: '已有记录时间范围',
      key: 'existing_range',
      width: 180,
      render: (_: any, record: DistributeItem) => {
        if (record.loadingStatistics) {
          return <Spin size="small" />
        }
        if (record.statistics?.min_date && record.statistics?.max_date) {
          return (
            <span style={{ color: '#1890ff' }}>
              {record.statistics.min_date} 至 {record.statistics.max_date}
            </span>
          )
        }
        return <span style={{ color: '#999' }}>无记录</span>
      },
    },
    {
      title: '开始日期',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 130,
      render: (_: any, record: DistributeItem) => (
        <DatePicker
          value={record.start_date}
          onChange={(date) => handleItemChange(record.id, 'start_date', date || undefined)}
          placeholder="必选"
          format="YYYY-MM-DD"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '结束日期',
      dataIndex: 'finish_date',
      key: 'finish_date',
      width: 130,
      render: (_: any, record: DistributeItem) => (
        <DatePicker
          value={record.finish_date}
          onChange={(date) => handleItemChange(record.id, 'finish_date', date || undefined)}
          placeholder="必选"
          format="YYYY-MM-DD"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '总量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 130,
      render: (_: any, record: DistributeItem) => (
        <Input
          value={record.total_quantity?.toString() || ''}
          onChange={(e) => {
            const value = e.target.value.trim()
            // 允许数字和小数点
            if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
              handleItemChange(record.id, 'total_quantity', value)
            }
          }}
          placeholder="请输入总量"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: DistributeItem) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record.id)}
          size="small"
        >
          删除
        </Button>
      ),
    },
  ]

  useEffect(() => {
    if (visible) {
      setItems(prevItems => {
        if (prevItems.length === 0) {
          return Array.from({ length: 5 }, (_, index) => ({
            id: index + 1,
            activity_id: '',
            total_quantity: '',
          }))
        }
        return prevItems
      })
      setNextId(prev => prev <= 5 ? 6 : prev)
    } else {
      setItems([])
      setNextId(1)
      setImportResult(null)
      setShowResultModal(false)
    }
  }, [visible])

  return (
    <Modal
      title="按周分配数量生成记录"
      open={visible}
      onCancel={handleCancel}
      width={1400}
      footer={[
        <Button key="template" icon={<DownloadOutlined />} loading={exporting} onClick={handleDownloadTemplate}>
          下载模板
        </Button>,
        <Upload
          key="import"
          accept=".xlsx,.xls"
          showUploadList={false}
          beforeUpload={(file) => {
            handleImportExcel(file)
            return false
          }}
        >
          <Button icon={<UploadOutlined />}>导入Excel</Button>
        </Upload>,
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button key="add" icon={<PlusOutlined />} onClick={handleAdd}>
          添加
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={mutation.isPending}
          onClick={handleSubmit}
        >
          提交
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>
          <p style={{ margin: '0 0 8px 0' }}>
            <strong>使用说明：</strong>
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>输入作业ID后，系统会自动获取该作业的信息（Scope、工作步骤等会自动填充）</li>
            <li>Scope为必选项，请仔细确认选择的Scope与作业ID匹配（系统会显示推荐的Scope并自动填充）</li>
            <li>如果该作业已有记录，输入的开始日期和结束日期必须完全在已有记录的时间范围之外</li>
            <li>系统将按周四分配数量（如果日期范围内没有周四，则按天分配）</li>
            <li>总量会被平均分配到每个分配日期，生成多条VFACTDB记录</li>
          </ul>
        </div>
      </div>
      <Table
        columns={columns}
        dataSource={items}
        rowKey="id"
        pagination={false}
        size="small"
        scroll={{ y: 450, x: 1400 }}
      />
      <ImportResultModal
        visible={showResultModal}
        onClose={() => {
          setShowResultModal(false)
          if (importResult?.success && importResult?.error_count === 0) {
            // 延时一点关闭，防止 Modal 嵌套关闭冲突
            setTimeout(() => {
              handleCancel()
              onSuccess()
            }, 100)
          }
        }}
        result={importResult}
        title="按周分配导入结果"
      />
    </Modal>
  )
}

export default VFACTDBWeeklyDistributeModal
