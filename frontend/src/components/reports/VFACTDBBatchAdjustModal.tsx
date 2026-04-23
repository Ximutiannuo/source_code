import { useState, useEffect, useCallback, useRef } from 'react'
import { Modal, Input, Button, DatePicker, Table, App, Spin, Upload, Progress } from 'antd'
import { PlusOutlined, DeleteOutlined, ReloadOutlined, DownloadOutlined, UploadOutlined, LoadingOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { reportService } from '../../services/reportService'
import { handleUnifiedExport } from '../../utils/exportUtils'
import { importService } from '../../services/importService'
import ImportResultModal from './ImportResultModal'
import dayjs, { type Dayjs } from 'dayjs'

interface VFACTDBBatchAdjustModalProps {
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

interface AdjustmentItem {
  id: number
  activity_id: string
  new_total: number | string  // 支持字符串以保留精度
  start_date?: Dayjs
  end_date?: Dayjs
  statistics?: Statistics | null
  loadingStatistics?: boolean
}

const VFACTDBBatchAdjustModal = ({ visible, onCancel, onSuccess }: VFACTDBBatchAdjustModalProps) => {
  const { message: messageApi } = App.useApp()
  const queryClient = useQueryClient()
  const [items, setItems] = useState<AdjustmentItem[]>([])
  const [nextId, setNextId] = useState(1)
  const [importResult, setImportResult] = useState<any>(null)
  const [showResultModal, setShowResultModal] = useState(false)
  const [importProgressVisible, setImportProgressVisible] = useState(false)
  const [importElapsed, setImportElapsed] = useState(0)
  const importElapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const mutation = useMutation({
    mutationFn: reportService.batchAdjustVFACTDB,
    onSuccess: (data) => {
      if (data.success) {
        messageApi.success(data.message || '批量调整成功')
        queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
        queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
        handleCancel()
        onSuccess()
      } else {
        messageApi.warning(data.message || '批量调整部分成功')
        // 显示详细结果
        if (data.results && data.results.length > 0) {
          const successCount = data.results.filter((r: any) => r.success).length
          const failCount = data.results.length - successCount
          if (failCount > 0) {
            messageApi.warning(`成功: ${successCount}，失败: ${failCount}`)
          }
        }
        queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
        queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
        handleCancel()
        onSuccess()
      }
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '批量调整失败')
    },
  })

  // 获取统计信息
  const fetchStatistics = useCallback(async (activityId: string): Promise<Statistics | null> => {
    if (!activityId || activityId.trim() === '') {
      return null
    }
    try {
      const data = await reportService.getVFACTDBStatistics(activityId.trim())
      return data
    } catch (error: any) {
      // 如果查询失败（比如不存在该ID），返回null
      return null
    }
  }, [])

  const handleAdd = () => {
    const newItem: AdjustmentItem = {
      id: nextId,
      activity_id: '',
      new_total: '',
    }
    setItems([...items, newItem])
    setNextId(nextId + 1)
  }

  const handleDelete = (id: number) => {
    setItems(items.filter(item => item.id !== id))
  }

  const handleItemChange = async (id: number, field: keyof AdjustmentItem, value: any) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value }
        
        // 如果修改的是activity_id，则获取统计信息
        if (field === 'activity_id') {
          const activityId = value?.trim() || ''
          // 只有当ID长度>=18时才查询（因为ID都是19-20位的）
          if (activityId.length >= 18) {
            // 设置loading状态
            updatedItem.loadingStatistics = true
            updatedItem.statistics = undefined
            
            // 异步获取统计信息
            fetchStatistics(activityId).then(stats => {
              setItems(prevItems => 
                prevItems.map(prevItem => 
                  prevItem.id === id 
                    ? { ...prevItem, statistics: stats, loadingStatistics: false }
                    : prevItem
                )
              )
            }).catch(() => {
              setItems(prevItems => 
                prevItems.map(prevItem => 
                  prevItem.id === id 
                    ? { ...prevItem, statistics: null, loadingStatistics: false }
                    : prevItem
                )
              )
            })
          } else {
            // 如果长度不够，清空统计信息
            updatedItem.statistics = null
            updatedItem.loadingStatistics = false
          }
        }
        
        return updatedItem
      }
      return item
    })
    
    setItems(updatedItems)
  }

  const handleFillDates = (id: number) => {
    const item = items.find(i => i.id === id)
    if (item?.statistics) {
      const updatedItems = items.map(i => {
        if (i.id === id) {
          return {
            ...i,
            start_date: item.statistics?.min_date ? dayjs(item.statistics.min_date) : undefined,
            end_date: item.statistics?.max_date ? dayjs(item.statistics.max_date) : undefined,
          }
        }
        return i
      })
      setItems(updatedItems)
    }
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
      const newTotalValue = typeof item.new_total === 'string' 
        ? parseFloat(item.new_total) 
        : item.new_total
      if (!newTotalValue || newTotalValue <= 0 || isNaN(newTotalValue)) {
        errors.push(`第 ${rowNumber} 行的新总量必须大于0`)
      }
      if (item.start_date && item.end_date && item.start_date.isAfter(item.end_date)) {
        errors.push(`第 ${rowNumber} 行的起始日期不能晚于结束日期`)
      }
    })

    if (errors.length > 0) {
      messageApi.error(errors[0])
      return
    }

    // 转换为API格式（只包含有效的记录）
    const adjustments = validItems.map(item => {
      const newTotalValue = typeof item.new_total === 'string' 
        ? parseFloat(item.new_total) 
        : item.new_total
      return {
        activity_id: item.activity_id.trim(),
        new_total: newTotalValue,
        start_date: item.start_date ? item.start_date.format('YYYY-MM-DD') : undefined,
        end_date: item.end_date ? item.end_date.format('YYYY-MM-DD') : undefined,
      }
    })

    mutation.mutate({ adjustments })
  }

  const handleCancel = () => {
    onCancel()
  }

  const [exporting, setExporting] = useState(false)

  const handleDownloadTemplate = async () => {
    handleUnifiedExport(
      'vfactdb',
      { template_type: 'adjust_template' },
      messageApi,
      setExporting,
      'VFACTDB_Adjust_Template'
    )
  }

  const handleImportExcel = async (file: File) => {
    setImportProgressVisible(true)
    setImportElapsed(0)
    importElapsedTimerRef.current = setInterval(() => {
      setImportElapsed((s) => s + 1)
    }, 1000)
    try {
      const response = await importService.importVFACTDBBatchAdjust(file)
      if (importElapsedTimerRef.current) {
        clearInterval(importElapsedTimerRef.current)
        importElapsedTimerRef.current = null
      }
      setImportProgressVisible(false)
      const data = response as {
        success?: boolean
        imported_count?: number
        error_count?: number
        errors?: string[]
        success_ids?: string[]
        failed_items?: { activity_id: string; row?: number | null; reason: string }[]
      }
      setImportResult({
        success: data.success ?? true,
        imported_count: data.imported_count ?? 0,
        error_count: data.error_count ?? 0,
        errors: data.errors ?? [],
        success_ids: data.success_ids ?? [],
        failed_items: data.failed_items ?? [],
      })
      setShowResultModal(true)

      if (data.success && (data.imported_count ?? 0) > 0) {
        if ((data.error_count ?? 0) === 0) {
          messageApi.success(`导入成功！共 ${data.imported_count} 条记录`)
        } else {
          messageApi.warning(`导入完成：成功 ${data.imported_count} 条，失败 ${data.error_count} 条，请查看结果详情`)
        }
        queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
        queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
      } else if ((data.error_count ?? 0) > 0) {
        messageApi.warning(`导入完成：成功 ${data.imported_count ?? 0} 条，失败 ${data.error_count} 条，请查看结果详情`)
        queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
        queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
      }
    } catch (error: any) {
      if (importElapsedTimerRef.current) {
        clearInterval(importElapsedTimerRef.current)
        importElapsedTimerRef.current = null
      }
      setImportProgressVisible(false)
      const detail = error?.response?.data?.detail ?? error?.message ?? '导入失败'
      messageApi.error(typeof detail === 'string' ? detail : '导入失败')
      setImportResult({
        success: false,
        imported_count: 0,
        error_count: 1,
        errors: [typeof detail === 'string' ? detail : '请求异常，请重试或联系管理员'],
        success_ids: [],
        failed_items: [{ activity_id: '-', reason: typeof detail === 'string' ? detail : '请求异常' }],
      })
      setShowResultModal(true)
    }
    return false // 阻止自动上传
  }

  const columns = [
    {
      title: '作业ID',
      dataIndex: 'activity_id',
      key: 'activity_id',
      width: 200,
      render: (_: any, record: AdjustmentItem) => (
        <Input
          value={record.activity_id}
          onChange={(e) => handleItemChange(record.id, 'activity_id', e.target.value)}
          placeholder="请输入作业ID"
        />
      ),
    },
    {
      title: '累计完成量',
      key: 'total_achieved',
      width: 120,
      render: (_: any, record: AdjustmentItem) => {
        if (record.loadingStatistics) {
          return <Spin size="small" />
        }
        if (record.statistics) {
          return (
            <span style={{ color: '#1890ff' }}>
              {record.statistics.total_achieved.toFixed(2)}
            </span>
          )
        }
        return <span style={{ color: '#999' }}>-</span>
      },
    },
    {
      title: '最小开始时间',
      key: 'min_date',
      width: 130,
      render: (_: any, record: AdjustmentItem) => {
        if (record.loadingStatistics) {
          return <Spin size="small" />
        }
        if (record.statistics?.min_date) {
          return (
            <span style={{ color: '#1890ff' }}>
              {dayjs(record.statistics.min_date).format('YYYY-MM-DD')}
            </span>
          )
        }
        return <span style={{ color: '#999' }}>-</span>
      },
    },
    {
      title: '最后更新时间',
      key: 'max_date',
      width: 130,
      render: (_: any, record: AdjustmentItem) => {
        if (record.loadingStatistics) {
          return <Spin size="small" />
        }
        if (record.statistics?.max_date) {
          return (
            <span style={{ color: '#1890ff' }}>
              {dayjs(record.statistics.max_date).format('YYYY-MM-DD')}
            </span>
          )
        }
        return <span style={{ color: '#999' }}>-</span>
      },
    },
    {
      title: '新总量',
      dataIndex: 'new_total',
      key: 'new_total',
      width: 130,
      render: (_: any, record: AdjustmentItem) => (
        <Input
          value={record.new_total?.toString() || ''}
          onChange={(e) => {
            const value = e.target.value.trim()
            // 允许空字符串、数字和小数点
            if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
              handleItemChange(record.id, 'new_total', value)
            }
          }}
          placeholder="请输入新总量"
        />
      ),
    },
    {
      title: '起始日期',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 150,
      render: (_: any, record: AdjustmentItem) => (
        <DatePicker
          value={record.start_date}
          onChange={(date) => handleItemChange(record.id, 'start_date', date || undefined)}
          placeholder="可选"
          format="YYYY-MM-DD"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '结束日期',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 150,
      render: (_: any, record: AdjustmentItem) => (
        <DatePicker
          value={record.end_date}
          onChange={(date) => handleItemChange(record.id, 'end_date', date || undefined)}
          placeholder="可选"
          format="YYYY-MM-DD"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: AdjustmentItem) => (
        <div style={{ display: 'flex', gap: 8 }}>
          {record.statistics && (
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleFillDates(record.id)}
              title="填充日期范围"
            >
              填充日期
            </Button>
          )}
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
            size="small"
          >
            删除
          </Button>
        </div>
      ),
    },
  ]

  // 默认添加5条空记录，关闭时清空
  useEffect(() => {
    if (visible) {
      // 打开弹窗时，如果没有数据则添加5条空记录
      setItems(prevItems => {
        if (prevItems.length === 0) {
          return Array.from({ length: 5 }, (_, index) => ({
            id: index + 1,
            activity_id: '',
            new_total: '',
          }))
        }
        return prevItems
      })
      setNextId(prev => prev <= 5 ? 6 : prev)
    } else {
      // 关闭弹窗时清空数据并停止导入计时
      if (importElapsedTimerRef.current) {
        clearInterval(importElapsedTimerRef.current)
        importElapsedTimerRef.current = null
      }
      setImportProgressVisible(false)
      setImportElapsed(0)
      setItems([])
      setNextId(1)
      setImportResult(null)
      setShowResultModal(false)
    }
  }, [visible])

  return (
    <Modal
      title="批量按比例调整工程量"
      open={visible}
      onCancel={handleCancel}
      width={1200}
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
            <li>输入作业ID后，系统会自动显示该ID的累计完成量、最小开始时间和最后更新时间</li>
            <li>点击"填充日期"按钮可自动填充起始日期和结束日期</li>
            <li>系统将按比例调整指定日期范围内所有记录的achieved值（比例 = 新总量 / 原始范围内总和）</li>
            <li>日期范围外的记录保持不变；不指定日期范围时，默认使用所有记录（2021-01-01 到 2030-01-01）</li>
          </ul>
        </div>
      </div>
      <Table
        columns={columns}
        dataSource={items}
        rowKey="id"
        pagination={false}
        size="small"
        scroll={{ y: 450, x: 1200 }}
      />
      <Modal
        title="正在导入"
        open={importProgressVisible}
        footer={null}
        closable={false}
        maskClosable={false}
        width={400}
      >
        <div style={{ padding: '8px 0' }}>
          <Progress
            type="line"
            percent={Math.min(90, Math.floor((importElapsed / 60) * 90))}
            status="active"
            format={() => ''}
          />
          <div style={{ marginTop: 16, textAlign: 'center', color: '#666' }}>
            <div style={{ marginBottom: 8 }}>
              <LoadingOutlined style={{ marginRight: 8 }} />
              正在上传并处理 Excel，请勿关闭页面…
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#1890ff' }}>
              已等待 {importElapsed} 秒
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
              若超过 1 分钟无响应，可能是文件较大或网络较慢，请耐心等待；若出现超时，可尝试减少单次导入行数或联系管理员调大网关超时时间。
            </div>
          </div>
        </div>
      </Modal>
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
        title="批量调整导入结果"
      />
    </Modal>
  )
}

export default VFACTDBBatchAdjustModal
