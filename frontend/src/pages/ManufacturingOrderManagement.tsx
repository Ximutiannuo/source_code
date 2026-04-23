import React, { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
  type TableColumnsType,
} from 'antd'
import {
  ApartmentOutlined,
  BarChartOutlined,
  DeploymentUnitOutlined,
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  SettingOutlined,
  ToolOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  manufacturingOrderService,
  type EquipmentOeeItem,
  type EquipmentOeeSummary,
  type EquipmentOption,
  type MaterialReadinessItem,
  type ManufacturingOrder,
  type ManufacturingOrderCreate,
  type ManufacturingOrderStep,
  type OrderMaterialReadiness,
  type OrderProcurementSuggestion,
  type ProcurementRequest,
  type ProcurementSuggestionItem,
  type ManufacturingOrderUpdate,
  type QualityCheck,
  type QualityCheckCreate,
  type WipSummary,
  type WorkReport,
  type WorkReportCreate,
} from '../services/manufacturingOrderService'
import { plmService } from '../services/plmService'
import { processTemplateService } from '../services/processTemplateService'

const { Title, Text } = Typography

const STATUS_OPTIONS = [
  { label: '计划中', value: 'PLANNED', color: 'default' as const },
  { label: '已下达', value: 'RELEASED', color: 'processing' as const },
  { label: '生产中', value: 'IN_PROGRESS', color: 'blue' as const },
  { label: '质检中', value: 'QC', color: 'purple' as const },
  { label: '已完成', value: 'COMPLETED', color: 'success' as const },
  { label: '已取消', value: 'CANCELLED', color: 'error' as const },
]

const STEP_STATUS_ACTIONS = [
  { label: '转就绪', value: 'READY' },
  { label: '转开工', value: 'IN_PROGRESS' },
  { label: '转阻塞', value: 'BLOCKED' },
  { label: '强制完工', value: 'COMPLETED' },
]

const PRIORITY_OPTIONS = [
  { label: 'P1 最高', value: 1 },
  { label: 'P2 高', value: 2 },
  { label: 'P3 标准', value: 3 },
  { label: 'P4 低', value: 4 },
  { label: 'P5 最低', value: 5 },
]

const REPORT_TYPE_OPTIONS = [
  { label: '手工报工', value: 'MANUAL' },
  { label: '扫码报工', value: 'SCANNED' },
  { label: 'IoT 自动报工', value: 'IOT' },
]

const CHECK_TYPE_OPTIONS = [
  { label: 'IPQC 过程检', value: 'IPQC' },
  { label: 'FQC 完工检', value: 'FQC' },
  { label: 'OQC 出货检', value: 'OQC' },
]

const QUALITY_RESULT_OPTIONS = [
  { label: '通过', value: 'PASS', color: 'success' as const },
  { label: '不合格', value: 'FAIL', color: 'error' as const },
  { label: '返工', value: 'REWORK', color: 'warning' as const },
  { label: '暂缓', value: 'HOLD', color: 'default' as const },
]

const EMPTY_WIP_SUMMARY: WipSummary = {
  orders_total: 0,
  orders_planned: 0,
  orders_released: 0,
  orders_in_progress: 0,
  orders_qc: 0,
  orders_completed: 0,
  orders_cancelled: 0,
  steps_total: 0,
  steps_planned: 0,
  steps_ready: 0,
  steps_in_progress: 0,
  steps_qc: 0,
  steps_completed: 0,
  steps_blocked: 0,
  quality_pass_count: 0,
  quality_fail_count: 0,
  quality_rework_count: 0,
  quality_hold_count: 0,
  rework_qty_total: 0,
  defect_qty_total: 0,
  planned_hours_total: 0,
  reported_hours_total: 0,
  downtime_minutes_total: 0,
  equipment_total: 0,
  equipment_active: 0,
  equipment_maintenance: 0,
  equipment_offline: 0,
  equipment_assigned: 0,
  overall_oee_rate: 0,
  reports_total: 0,
  reports_today: 0,
}

const EMPTY_EQUIPMENT_OEE: EquipmentOeeSummary = {
  equipment_total: 0,
  equipment_active: 0,
  equipment_maintenance: 0,
  equipment_offline: 0,
  equipment_assigned: 0,
  planned_hours_total: 0,
  actual_hours_total: 0,
  runtime_hours_total: 0,
  downtime_minutes_total: 0,
  overall_availability_rate: 0,
  overall_performance_rate: 0,
  overall_quality_rate: 0,
  overall_oee_rate: 0,
  items: [],
}


const EMPTY_ORDER_MATERIAL_READINESS: OrderMaterialReadiness = {
  order_id: 0,
  order_number: '',
  bom_id: null,
  bom_version: null,
  kit_status: 'BOM_PENDING',
  required_items_total: 0,
  ready_items: 0,
  risk_items: 0,
  short_items: 0,
  shortage_qty_total: 0,
  kit_rate: 0,
  items: [],
}


const EMPTY_ORDER_PROCUREMENT_SUGGESTION: OrderProcurementSuggestion = {
  order_id: 0,
  order_number: '',
  kit_status: 'BOM_PENDING',
  items_total: 0,
  urgent_items: 0,
  high_items: 0,
  to_purchase_items: 0,
  to_expedite_items: 0,
  master_data_gap_items: 0,
  replenish_items: 0,
  suggested_purchase_qty_total: 0,
  impacted_orders: 0,
  items: [],
}

const getOrderStatusMeta = (status?: string) =>
  STATUS_OPTIONS.find(option => option.value === status) || STATUS_OPTIONS[0]

const getStepStatusMeta = (status: string) => {
  switch (status) {
    case 'READY':
      return { label: '待开工', color: 'gold' as const }
    case 'IN_PROGRESS':
      return { label: '生产中', color: 'processing' as const }
    case 'QC':
      return { label: '待质检', color: 'purple' as const }
    case 'COMPLETED':
      return { label: '已完成', color: 'success' as const }
    case 'BLOCKED':
      return { label: '已阻塞', color: 'error' as const }
    default:
      return { label: '计划中', color: 'default' as const }
  }
}

const getQualityResultMeta = (result?: string) =>
  QUALITY_RESULT_OPTIONS.find(option => option.value === result) || QUALITY_RESULT_OPTIONS[0]

const getEquipmentStatusMeta = (status?: string) => {
  switch (status) {
    case 'ACTIVE':
      return { label: '可用', color: 'success' as const }
    case 'MAINTENANCE':
      return { label: '保养中', color: 'warning' as const }
    case 'OFFLINE':
      return { label: '离线', color: 'default' as const }
    default:
      return { label: status || '未知', color: 'default' as const }
  }
}

const getReadinessStatusMeta = (status?: string) => {
  switch (status) {
    case 'READY':
      return { label: '齐套', color: 'success' as const }
    case 'RISK':
      return { label: '风险', color: 'warning' as const }
    case 'SHORT':
      return { label: '缺料', color: 'error' as const }
    case 'MISSING':
      return { label: '主数据缺失', color: 'default' as const }
    default:
      return { label: status || '未知', color: 'default' as const }
  }
}

const getKitStatusMeta = (status?: string) => {
  switch (status) {
    case 'KIT_READY':
      return { label: '齐套就绪', color: 'success' as const }
    case 'KIT_RISK':
      return { label: '齐套风险', color: 'warning' as const }
    case 'KIT_SHORT':
      return { label: '缺料阻塞', color: 'error' as const }
    case 'BOM_PENDING':
      return { label: '未绑定 BOM', color: 'default' as const }
    default:
      return { label: status || '未知', color: 'default' as const }
  }
}

const getUrgencyMeta = (urgencyLevel?: string) => {
  switch (urgencyLevel) {
    case 'URGENT':
      return { label: '紧急', color: 'error' as const }
    case 'HIGH':
      return { label: '高', color: 'warning' as const }
    case 'MEDIUM':
      return { label: '中', color: 'processing' as const }
    default:
      return { label: '低', color: 'default' as const }
  }
}

const getProcurementRequestStatusMeta = (status?: string) => {
  switch (status) {
    case 'DRAFT':
      return { label: '草稿', color: 'default' as const }
    case 'SUBMITTED':
      return { label: '已提交', color: 'processing' as const }
    case 'IN_PROGRESS':
      return { label: '采购跟进中', color: 'warning' as const }
    case 'ORDERED':
      return { label: '已下单', color: 'cyan' as const }
    case 'RECEIVED':
      return { label: '已到货', color: 'success' as const }
    case 'CANCELLED':
      return { label: '已取消', color: 'error' as const }
    default:
      return { label: status || '未知', color: 'default' as const }
  }
}

const getProcurementRequestActions = (status?: string) => {
  switch (status) {
    case 'DRAFT':
      return [
        { label: '提交', value: 'SUBMITTED' },
        { label: '取消', value: 'CANCELLED', danger: true },
      ]
    case 'SUBMITTED':
      return [
        { label: '开始跟进', value: 'IN_PROGRESS' },
        { label: '取消', value: 'CANCELLED', danger: true },
      ]
    case 'IN_PROGRESS':
      return [
        { label: '标记已下单', value: 'ORDERED' },
        { label: '取消', value: 'CANCELLED', danger: true },
      ]
    case 'ORDERED':
      return [
        { label: '标记已到货', value: 'RECEIVED' },
        { label: '取消', value: 'CANCELLED', danger: true },
      ]
    default:
      return []
  }
}

const buildSuggestionMaterialCodes = (items: ProcurementSuggestionItem[]) =>
  Array.from(new Set(items.map(item => item.material_code).filter(Boolean)))

const toNumber = (value?: number | null) => Number(value || 0)
const formatPercent = (value?: number | null) => `${Math.round(toNumber(value) * 100)}%`
const formatHours = (value?: number | null) => `${toNumber(value).toFixed(1)} h`
const formatQty = (value?: number | null) => toNumber(value).toFixed(2)

const calcStepProgress = (step: ManufacturingOrderStep) => {
  const target = toNumber(step.target_qty)
  const completed = toNumber(step.completed_qty)
  if (target <= 0) {
    return step.status === 'COMPLETED' ? 100 : completed > 0 ? 50 : 0
  }
  return Math.max(0, Math.min(100, Math.round((completed / target) * 100)))
}

const calcOrderProgress = (order?: ManufacturingOrder | null) => {
  if (!order || order.steps.length === 0) {
    return 0
  }
  const total = order.steps.reduce((sum, step) => sum + calcStepProgress(step), 0)
  return Math.round(total / order.steps.length)
}

const formatDateTime = (value?: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-')

const getLatestQualityCheck = (step: ManufacturingOrderStep) => {
  return [...(step.quality_checks || [])].sort(
    (a, b) =>
      dayjs(b.checked_at || b.created_at || '').valueOf() - dayjs(a.checked_at || a.created_at || '').valueOf()
  )[0]
}

const sumQualityMetric = (
  step: ManufacturingOrderStep,
  field: 'defect_qty' | 'rework_qty'
) => (step.quality_checks || []).reduce((sum, item) => sum + toNumber(item[field]), 0)

const getReportedHours = (step: ManufacturingOrderStep) =>
  (step.reports || []).reduce((sum, report) => sum + toNumber(report.work_hours), 0)

const getDowntimeMinutes = (step: ManufacturingOrderStep) =>
  (step.reports || []).reduce((sum, report) => sum + toNumber(report.downtime_minutes), 0)

const getExpectedHoursByProgress = (step: ManufacturingOrderStep) => {
  const targetQty = toNumber(step.target_qty)
  const completedQty = toNumber(step.completed_qty)
  const plannedWorkHours = toNumber(step.planned_work_hours)
  const setupHours = toNumber(step.setup_hours)

  if (targetQty > 0 && plannedWorkHours > 0) {
    return setupHours + plannedWorkHours * Math.min(completedQty, targetQty) / targetQty
  }
  return setupHours + plannedWorkHours
}

const getRemainingSuggestedHours = (step: ManufacturingOrderStep) => {
  const targetQty = toNumber(step.target_qty)
  const completedQty = toNumber(step.completed_qty)
  const plannedWorkHours = toNumber(step.planned_work_hours)
  const setupHours = toNumber(step.setup_hours)
  const remainingQty = Math.max(0, targetQty - completedQty)

  if (targetQty > 0 && plannedWorkHours > 0) {
    const remainingProcessHours = plannedWorkHours * remainingQty / targetQty
    return Number((remainingProcessHours + (completedQty <= 0 ? setupHours : 0)).toFixed(2))
  }

  return Number((plannedWorkHours + setupHours).toFixed(2))
}

const calcStepEfficiencyRate = (step: ManufacturingOrderStep) => {
  const actualHours = getReportedHours(step)
  const expectedHours = getExpectedHoursByProgress(step)
  if (actualHours <= 0 || expectedHours <= 0) {
    return 0
  }
  return Math.round((expectedHours / actualHours) * 100)
}

const ManufacturingOrderManagement: React.FC = () => {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [keyword, setKeyword] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<ManufacturingOrder | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [selectedStepForReport, setSelectedStepForReport] = useState<ManufacturingOrderStep | null>(null)
  const [selectedStepForQuality, setSelectedStepForQuality] = useState<ManufacturingOrderStep | null>(null)
  const [selectedStepForPlanning, setSelectedStepForPlanning] = useState<ManufacturingOrderStep | null>(null)

  const [createForm] = Form.useForm()
  const [editOrderForm] = Form.useForm()
  const [reportForm] = Form.useForm()
  const [qualityForm] = Form.useForm()
  const [planningForm] = Form.useForm()

  const selectedQualityResult = Form.useWatch('result', qualityForm)

  const refreshManufacturingQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['manufacturing-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['manufacturing-wip-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['manufacturing-equipment-oee'] }),
      ...(selectedOrderId
        ? [
            queryClient.invalidateQueries({ queryKey: ['manufacturing-order-detail', selectedOrderId] }),
            queryClient.invalidateQueries({ queryKey: ['manufacturing-order-material-readiness', selectedOrderId] }),
            queryClient.invalidateQueries({ queryKey: ['manufacturing-order-procurement-suggestions', selectedOrderId] }),
          ]
        : []),
    ])
  }

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['manufacturing-orders', statusFilter],
    queryFn: async () => {
      const response = await manufacturingOrderService.list({ status: statusFilter })
      return response.data
    },
  })

  const [importLoading, setImportLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  const handleExport = async () => {
    try {
      setExportLoading(true)
      const response = await manufacturingOrderService.exportOrders({ status: statusFilter })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `manufacturing_orders_${new Date().toISOString().slice(0, 10)}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      message.success('导出成功')
    } catch (err: any) {
      message.error('导出失败')
    } finally {
      setExportLoading(false)
    }
  }

  const handleImport = async (file: File) => {
    try {
      setImportLoading(true)
      const response = await manufacturingOrderService.importOrders(file)
      const result = response.data
      const createdCount = result.created?.length || 0
      const updatedCount = result.updated?.length || 0
      if (result.errors > 0) {
        Modal.warning({
          title: '导入完成（部分失败）',
          content: `新增 ${createdCount} 条，覆盖更新 ${updatedCount} 条，失败 ${result.errors} 条。\n${result.error_details.map((e: any) => `第 ${e.row} 行: ${e.error}`).join('\n')}`,
          width: 600,
        })
      } else {
        message.success(`导入完成：新增 ${createdCount} 条，覆盖更新 ${updatedCount} 条`)
      }
      await refreshManufacturingQueries()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '导入失败')
    } finally {
      setImportLoading(false)
    }
    return false
  }

  const legacyHandleImport = async (_file: File) => {
    return false
    try {
      const result: any = { imported: 0, errors: 0, error_details: [] }
      if (false) {
        Modal.warning({
          title: '导入完成（部分失败）',
          content: `成功导入 ${result.imported} 条，失败 ${result.errors} 条。\n${result.error_details.map((e: any) => `第 ${e.row} 行: ${e.error}`).join('\n')}`,
          width: 600,
        })
      } else {
        message.success(`成功导入 ${result.imported} 条制造订单`)
      }
      await refreshManufacturingQueries()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '导入失败')
    } finally {
      setImportLoading(false)
    }
    return false
  }

  void legacyHandleImport

  const { data: wipSummary = EMPTY_WIP_SUMMARY, isFetching: isWipLoading, refetch: refetchWip } = useQuery({
    queryKey: ['manufacturing-wip-summary'],
    queryFn: async () => {
      const response = await manufacturingOrderService.getWipSummary()
      return response.data
    },
  })

  const {
    data: equipmentOeeSummary = EMPTY_EQUIPMENT_OEE,
    isFetching: isEquipmentOeeLoading,
    refetch: refetchEquipmentOee,
  } = useQuery({
    queryKey: ['manufacturing-equipment-oee'],
    queryFn: async () => {
      const response = await manufacturingOrderService.getEquipmentOeeSummary()
      return response.data
    },
  })


  const {
    data: procurementRequests = [],
    isFetching: isProcurementRequestLoading,
    refetch: refetchProcurementRequests,
  } = useQuery({
    queryKey: ['manufacturing-procurement-requests'],
    queryFn: async () => {
      const response = await manufacturingOrderService.listProcurementRequests()
      return response.data
    },
  })

  const { data: equipmentOptions = [] } = useQuery({
    queryKey: ['manufacturing-equipment-options'],
    queryFn: async () => {
      const response = await manufacturingOrderService.listEquipment()
      return response.data
    },
  })

  const { data: bomHeaders = [] } = useQuery({
    queryKey: ['manufacturing-order-boms'],
    queryFn: () => plmService.getBOMs(),
  })

  const { data: processTemplates = [] } = useQuery({
    queryKey: ['manufacturing-order-process-templates'],
    queryFn: async () => {
      const response = await processTemplateService.listTemplates()
      return response.data
    },
  })

  const { data: selectedOrder, isFetching: isDetailLoading, refetch: refetchDetail } = useQuery({
    queryKey: ['manufacturing-order-detail', selectedOrderId],
    queryFn: async () => {
      const response = await manufacturingOrderService.get(selectedOrderId!)
      return response.data
    },
    enabled: !!selectedOrderId,
  })

  const {
    data: selectedOrderReadiness = EMPTY_ORDER_MATERIAL_READINESS,
    isFetching: isReadinessLoading,
    refetch: refetchReadiness,
  } = useQuery({
    queryKey: ['manufacturing-order-material-readiness', selectedOrderId],
    queryFn: async () => {
      const response = await manufacturingOrderService.getOrderMaterialReadiness(selectedOrderId!)
      return response.data
    },
    enabled: !!selectedOrderId,
  })

  const {
    data: selectedOrderProcurementSuggestions = EMPTY_ORDER_PROCUREMENT_SUGGESTION,
    isFetching: isOrderProcurementSuggestionLoading,
    refetch: refetchOrderProcurementSuggestions,
  } = useQuery({
    queryKey: ['manufacturing-order-procurement-suggestions', selectedOrderId],
    queryFn: async () => {
      const response = await manufacturingOrderService.getOrderProcurementSuggestions(selectedOrderId!)
      return response.data
    },
    enabled: !!selectedOrderId,
  })

  const createOrderMutation = useMutation({
    mutationFn: (payload: ManufacturingOrderCreate) => manufacturingOrderService.create(payload),
    onSuccess: async response => {
      message.success('制造订单已创建')
      setIsCreateModalOpen(false)
      createForm.resetFields()
      setSelectedOrderId(response.data.id)
      await refreshManufacturingQueries()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || error?.message || '创建失败')
    },
  })

  const updateOrderMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: number; payload: ManufacturingOrderUpdate }) =>
      manufacturingOrderService.update(orderId, payload),
    onSuccess: async response => {
      message.success('制造订单已更新')
      setEditingOrder(null)
      editOrderForm.resetFields()
      setSelectedOrderId(response.data.id)
      await refreshManufacturingQueries()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || error?.message || '制造订单更新失败')
    },
  })

  const updateStepStatusMutation = useMutation({
    mutationFn: ({ orderId, stepId, status }: { orderId: number; stepId: number; status: string }) =>
      manufacturingOrderService.updateStepStatus(orderId, stepId, { status }),
    onSuccess: async () => {
      message.success('工序状态已更新')
      await refreshManufacturingQueries()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || error?.message || '工序状态更新失败')
    },
  })

  const updateStepPlanningMutation = useMutation({
    mutationFn: ({
      orderId,
      stepId,
      body,
    }: {
      orderId: number
      stepId: number
      body: { workstation_id?: number | null; planned_work_hours?: number | null; setup_hours?: number | null }
    }) => manufacturingOrderService.updateStepPlanning(orderId, stepId, body),
    onSuccess: async () => {
      message.success('工序派工与标准工时已更新')
      setSelectedStepForPlanning(null)
      planningForm.resetFields()
      await refreshManufacturingQueries()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || error?.message || '工序计划更新失败')
    },
  })

  const reportWorkMutation = useMutation({
    mutationFn: ({ orderId, stepId, body }: { orderId: number; stepId: number; body: WorkReportCreate }) =>
      manufacturingOrderService.reportWork(orderId, stepId, body),
    onSuccess: async () => {
      message.success('报工已提交，工时与停机数据已回写')
      setSelectedStepForReport(null)
      reportForm.resetFields()
      await refreshManufacturingQueries()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || error?.message || '报工失败')
    },
  })

  const qualityCheckMutation = useMutation({
    mutationFn: ({ orderId, stepId, body }: { orderId: number; stepId: number; body: QualityCheckCreate }) =>
      manufacturingOrderService.createQualityCheck(orderId, stepId, body),
    onSuccess: async (_, variables) => {
      const resultMeta = getQualityResultMeta(variables.body.result)
      message.success(`质检已提交，结果为${resultMeta.label}`)
      setSelectedStepForQuality(null)
      qualityForm.resetFields()
      await refreshManufacturingQueries()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || error?.message || '质检提交失败')
    },
  })

  const generateProcurementRequestMutation = useMutation({
    mutationFn: (payload: {
      source_scope: string
      order_id?: number | null
      material_codes?: string[]
      title?: string
      notes?: string
    }) => manufacturingOrderService.generateProcurementRequest(payload),
    onSuccess: async response => {
      message.success(`请购草稿已生成：${response.data.request_no}`)
      await refreshManufacturingQueries()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || error?.message || '生成请购草稿失败')
    },
  })

  const updateProcurementRequestStatusMutation = useMutation({
    mutationFn: ({ requestId, status }: { requestId: number; status: string }) =>
      manufacturingOrderService.updateProcurementRequestStatus(requestId, { status }),
    onSuccess: async (_, variables) => {
      const statusMeta = getProcurementRequestStatusMeta(variables.status)
      message.success(`请购状态已更新为${statusMeta.label}`)
      await refreshManufacturingQueries()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || error?.message || '请购状态更新失败')
    },
  })

  const filteredOrders = useMemo(() => {
    if (!keyword.trim()) {
      return orders
    }
    const lowered = keyword.trim().toLowerCase()
    return orders.filter(order =>
      [order.order_number, order.customer_name, order.product_name]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(lowered))
    )
  }, [orders, keyword])

  const selectedOrderMetrics = useMemo(() => {
    const steps = selectedOrder?.steps || []
    const completedSteps = steps.filter(step => step.status === 'COMPLETED').length
    const qcSteps = steps.filter(step => step.status === 'QC').length
    const blockedSteps = steps.filter(step => step.status === 'BLOCKED').length
    const reworkQty = steps.reduce((sum, step) => sum + sumQualityMetric(step, 'rework_qty'), 0)
    const defectQty = steps.reduce((sum, step) => sum + sumQualityMetric(step, 'defect_qty'), 0)
    const reports = steps.reduce((sum, step) => sum + (step.reports?.length || 0), 0)
    const plannedHours = steps.reduce((sum, step) => sum + toNumber(step.planned_work_hours) + toNumber(step.setup_hours), 0)
    const actualHours = steps.reduce((sum, step) => sum + getReportedHours(step), 0)
    const downtimeMinutes = steps.reduce((sum, step) => sum + getDowntimeMinutes(step), 0)
    const assignedEquipmentCount = new Set(steps.filter(step => step.workstation_id).map(step => step.workstation_id)).size
    return {
      completedSteps,
      qcSteps,
      blockedSteps,
      reworkQty,
      defectQty,
      reports,
      plannedHours,
      actualHours,
      downtimeMinutes,
      assignedEquipmentCount,
      orderProgress: calcOrderProgress(selectedOrder),
    }
  }, [selectedOrder])

  const qualityTotal =
    wipSummary.quality_pass_count +
    wipSummary.quality_fail_count +
    wipSummary.quality_rework_count +
    wipSummary.quality_hold_count
  const qualityPassRate = qualityTotal > 0 ? Math.round((wipSummary.quality_pass_count / qualityTotal) * 100) : 0

  const wipCards = [
    { title: '制造订单总数', value: wipSummary.orders_total, suffix: '单' },
    { title: '在制订单', value: wipSummary.orders_in_progress, suffix: '单' },
    { title: '待质检工序', value: wipSummary.steps_qc, suffix: '道' },
    { title: '阻塞工序', value: wipSummary.steps_blocked, suffix: '道' },
    { title: '计划工时', value: wipSummary.planned_hours_total, suffix: 'h' },
    { title: '实报工时', value: wipSummary.reported_hours_total, suffix: 'h' },
    { title: '当日报工', value: wipSummary.reports_today, suffix: '次' },
    { title: '设备已派工', value: wipSummary.equipment_assigned, suffix: '台' },
  ]


  const orderProcurementRequests = useMemo(
    () => procurementRequests.filter(item => item.source_scope === 'ORDER' && item.source_order_id === selectedOrderId),
    [procurementRequests, selectedOrderId]
  )

  const handleCreateOrder = async () => {
    try {
      const values = await createForm.validateFields()
      createOrderMutation.mutate({
        ...values,
        due_date: values.due_date ? values.due_date.toISOString() : null,
      })
    } catch {
      // Validation is handled by Ant Design.
    }
  }

  const handleUpdateOrder = async () => {
    if (!editingOrder) {
      return
    }
    try {
      const values = await editOrderForm.validateFields()
      updateOrderMutation.mutate({
        orderId: editingOrder.id,
        payload: {
          ...values,
          due_date: values.due_date ? values.due_date.toISOString() : null,
        },
      })
    } catch {
      // Validation is handled by Ant Design.
    }
  }

  const handleSubmitReport = async () => {
    if (!selectedOrderId || !selectedStepForReport) {
      return
    }
    try {
      const values = await reportForm.validateFields()
      reportWorkMutation.mutate({
        orderId: selectedOrderId,
        stepId: selectedStepForReport.id,
        body: values,
      })
    } catch {
      // Validation is handled by Ant Design.
    }
  }

  const handleSubmitQuality = async () => {
    if (!selectedOrderId || !selectedStepForQuality) {
      return
    }
    try {
      const values = await qualityForm.validateFields()
      qualityCheckMutation.mutate({
        orderId: selectedOrderId,
        stepId: selectedStepForQuality.id,
        body: values,
      })
    } catch {
      // Validation is handled by Ant Design.
    }
  }

  const handleSubmitPlanning = async () => {
    if (!selectedOrderId || !selectedStepForPlanning) {
      return
    }
    try {
      const values = await planningForm.validateFields()
      const normalizedWorkstationId =
        values.workstation_id === undefined || values.workstation_id === null ? 0 : values.workstation_id
      updateStepPlanningMutation.mutate({
        orderId: selectedOrderId,
        stepId: selectedStepForPlanning.id,
        body: {
          workstation_id: normalizedWorkstationId,
          planned_work_hours: values.planned_work_hours,
          setup_hours: values.setup_hours,
        },
      })
    } catch {
      // Validation is handled by Ant Design.
    }
  }


  const handleGenerateOrderProcurementRequest = () => {
    if (!selectedOrderId) {
      return
    }
    const materialCodes = buildSuggestionMaterialCodes(selectedOrderProcurementSuggestions.items)
    if (materialCodes.length === 0) {
      message.warning('当前工单没有可生成请购草稿的缺料建议')
      return
    }
    generateProcurementRequestMutation.mutate({
      source_scope: 'ORDER',
      order_id: selectedOrderId,
      material_codes: materialCodes,
      title: `${selectedOrder?.order_number || selectedOrderProcurementSuggestions.order_number} 缺料请购草稿`,
    })
  }

  const handleProcurementRequestStatusChange = (requestId: number, status: string) => {
    updateProcurementRequestStatusMutation.mutate({ requestId, status })
  }

  const openEditOrderModal = (order: ManufacturingOrder) => {
    setEditingOrder(order)
    editOrderForm.setFieldsValue({
      order_number: order.order_number,
      customer_name: order.customer_name || undefined,
      product_name: order.product_name || undefined,
      bom_id: order.bom?.id,
      process_template_id: order.process_template?.id,
      quantity: order.quantity,
      due_date: order.due_date ? dayjs(order.due_date) : null,
      priority: order.priority,
      status: order.status,
      notes: order.notes || undefined,
    })
  }

  const openReportModal = (step: ManufacturingOrderStep) => {
    setSelectedStepForReport(step)
    reportForm.setFieldsValue({
      quantity: Math.max(0, toNumber(step.target_qty) - toNumber(step.completed_qty)),
      scrap_qty: 0,
      work_hours: getRemainingSuggestedHours(step),
      downtime_minutes: 0,
      report_type: 'MANUAL',
      remarks: undefined,
    })
  }

  const openQualityModal = (step: ManufacturingOrderStep) => {
    setSelectedStepForQuality(step)
    qualityForm.setFieldsValue({
      check_type: step.status === 'COMPLETED' ? 'FQC' : 'IPQC',
      result: 'PASS',
      checked_qty: Math.max(toNumber(step.completed_qty), toNumber(step.target_qty)),
      defect_qty: 0,
      rework_qty: 0,
      remarks: undefined,
    })
  }

  const openPlanningModal = (step: ManufacturingOrderStep) => {
    setSelectedStepForPlanning(step)
    planningForm.setFieldsValue({
      workstation_id: step.workstation_id ?? undefined,
      planned_work_hours: step.planned_work_hours ?? undefined,
      setup_hours: step.setup_hours ?? 0,
    })
  }

  const reportColumns: TableColumnsType<WorkReport> = [
    {
      title: '报工时间',
      key: 'report_time',
      render: (_, report) => formatDateTime(report.report_time || report.created_at),
    },
    {
      title: '数量',
      key: 'quantity',
      render: (_, report) => `${toNumber(report.quantity)} / 报废 ${toNumber(report.scrap_qty)}`,
    },
    {
      title: '实际工时',
      dataIndex: 'work_hours',
      key: 'work_hours',
      render: value => formatHours(value),
    },
    {
      title: '停机',
      dataIndex: 'downtime_minutes',
      key: 'downtime_minutes',
      render: value => `${toNumber(value)} min`,
    },
    {
      title: '方式',
      dataIndex: 'report_type',
      key: 'report_type',
    },
    {
      title: '操作员',
      dataIndex: 'operator_name',
      key: 'operator_name',
      render: value => value || '-',
    },
  ]

  const qualityColumns: TableColumnsType<QualityCheck> = [
    {
      title: '检验时间',
      key: 'checked_at',
      render: (_, record) => formatDateTime(record.checked_at || record.created_at),
    },
    {
      title: '检验类型',
      dataIndex: 'check_type',
      key: 'check_type',
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      render: value => {
        const meta = getQualityResultMeta(value)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '数量',
      key: 'qty',
      render: (_, record) => `检验 ${toNumber(record.checked_qty)} / 不良 ${toNumber(record.defect_qty)} / 返工 ${toNumber(record.rework_qty)}`,
    },
    {
      title: '检验员',
      dataIndex: 'inspector_name',
      key: 'inspector_name',
      render: value => value || '-',
    },
  ]

  const materialReadinessColumns: TableColumnsType<MaterialReadinessItem> = [
    {
      title: '物料',
      key: 'material',
      render: (_, item) => (
        <Space direction="vertical" size={0}>
          <Text strong>{item.material_name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {item.material_code}
            {item.material_type ? ` / ${item.material_type}` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: '需求',
      key: 'required_qty',
      render: (_, item) => `${formatQty(item.required_qty)} ${item.unit}`,
    },
    {
      title: '现有 / 预留 / 在途',
      key: 'stock',
      render: (_, item) =>
        `${formatQty(item.current_stock)} / ${formatQty(item.reserved_stock)} / ${formatQty(item.incoming_stock)}`,
    },
    {
      title: '净可用',
      dataIndex: 'net_available_qty',
      key: 'net_available_qty',
      render: value => formatQty(value),
    },
    {
      title: '安全库存',
      dataIndex: 'safety_stock',
      key: 'safety_stock',
      render: value => formatQty(value),
    },
    {
      title: '缺口',
      dataIndex: 'shortage_qty',
      key: 'shortage_qty',
      render: value => formatQty(value),
    },
    {
      title: '前置期',
      dataIndex: 'lead_time_days',
      key: 'lead_time_days',
      render: value => `${toNumber(value)} 天`,
    },
    {
      title: '状态',
      dataIndex: 'readiness_status',
      key: 'readiness_status',
      render: value => {
        const meta = getReadinessStatusMeta(value)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '原因',
      dataIndex: 'shortage_reason',
      key: 'shortage_reason',
    },
  ]

  const procurementSuggestionColumns: TableColumnsType<ProcurementSuggestionItem> = [
    {
      title: '物料',
      key: 'material',
      render: (_, item) => (
        <Space direction="vertical" size={0}>
          <Text strong>{item.material_name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {item.material_code}
            {item.material_category ? ` / ${item.material_category}` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: '建议动作',
      dataIndex: 'suggested_action',
      key: 'suggested_action',
      render: value => (
        <Tag color={value === '发起请购' ? 'error' : value === '补主数据' ? 'default' : 'warning'}>{value}</Tag>
      ),
    },
    {
      title: '紧急度',
      dataIndex: 'urgency_level',
      key: 'urgency_level',
      render: value => {
        const meta = getUrgencyMeta(value)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '建议数量',
      dataIndex: 'suggested_purchase_qty',
      key: 'suggested_purchase_qty',
      render: (value, item) => `${formatQty(value)} ${item.unit}`,
    },
    {
      title: '采购模式',
      dataIndex: 'procurement_mode',
      key: 'procurement_mode',
    },
    {
      title: '建议下单日',
      dataIndex: 'suggested_order_date',
      key: 'suggested_order_date',
      render: value => formatDateTime(value),
    },
    {
      title: '最早交付需求',
      dataIndex: 'earliest_due_date',
      key: 'earliest_due_date',
      render: value => formatDateTime(value),
    },
    {
      title: '缺料原因',
      dataIndex: 'shortage_reason',
      key: 'shortage_reason',
    },
  ]

  const procurementRequestItemColumns: TableColumnsType<ProcurementRequest['items'][number]> = [
    {
      title: '物料',
      key: 'material',
      render: (_, item) => (
        <Space direction="vertical" size={0}>
          <Text strong>{item.material_name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {item.material_code}
            {item.material_category ? ` / ${item.material_category}` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: '建议动作',
      dataIndex: 'suggested_action',
      key: 'suggested_action',
      render: value => <Tag color={value === '发起请购' ? 'error' : value === '补主数据' ? 'default' : 'warning'}>{value || '-'}</Tag>,
    },
    {
      title: '紧急度',
      dataIndex: 'urgency_level',
      key: 'urgency_level',
      render: value => {
        const meta = getUrgencyMeta(value)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '请购数量',
      dataIndex: 'requested_qty',
      key: 'requested_qty',
      render: (value, item) => `${formatQty(value)} ${item.unit || ''}`.trim(),
    },
    {
      title: '建议下单日',
      dataIndex: 'suggested_order_date',
      key: 'suggested_order_date',
      render: value => formatDateTime(value),
    },
    {
      title: '计划说明',
      dataIndex: 'planning_note',
      key: 'planning_note',
      render: value => value || '-',
    },
  ]

  const procurementRequestColumns: TableColumnsType<ProcurementRequest> = [
    {
      title: '请购单',
      key: 'request_no',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.request_no}</Text>
          <Text type="secondary">{record.title}</Text>
        </Space>
      ),
    },
    {
      title: '来源',
      key: 'source_scope',
      render: (_, record) =>
        record.source_scope === 'ORDER' ? (
          <Space direction="vertical" size={0}>
            <Tag color="blue">订单拉动</Tag>
            <Text type="secondary">{record.source_order_number || `订单 ${record.source_order_id || '-'}`}</Text>
          </Space>
        ) : (
          <Tag color="geekblue">全局汇总</Tag>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: value => {
        const meta = getProcurementRequestStatusMeta(value)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '紧急度',
      dataIndex: 'urgency_level',
      key: 'urgency_level',
      render: value => {
        const meta = getUrgencyMeta(value)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '请购项数',
      dataIndex: 'total_items',
      key: 'total_items',
      render: value => `${value} 项`,
    },
    {
      title: '建议数量',
      dataIndex: 'suggested_purchase_qty_total',
      key: 'suggested_purchase_qty_total',
      render: value => formatQty(value),
    },
    {
      title: '申请人',
      dataIndex: 'requester_name',
      key: 'requester_name',
      render: value => value || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: value => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => {
        const actions = getProcurementRequestActions(record.status)
        if (actions.length === 0) {
          return <Text type="secondary">无可执行动作</Text>
        }
        return (
          <Space wrap>
            {actions.map(action => (
              <Button
                key={action.value}
                size="small"
                danger={action.danger}
                loading={
                  updateProcurementRequestStatusMutation.isPending &&
                  updateProcurementRequestStatusMutation.variables?.requestId === record.id &&
                  updateProcurementRequestStatusMutation.variables?.status === action.value
                }
                onClick={() => handleProcurementRequestStatusChange(record.id, action.value)}
              >
                {action.label}
              </Button>
            ))}
          </Space>
        )
      },
    },
  ]

  const orderColumns: TableColumnsType<ManufacturingOrder> = [
    {
      title: '订单号',
      dataIndex: 'order_number',
      key: 'order_number',
      render: value => (
        <Space>
          <ApartmentOutlined style={{ color: '#1677ff' }} />
          <Text strong>{value}</Text>
        </Space>
      ),
    },
    {
      title: '产品',
      dataIndex: 'product_name',
      key: 'product_name',
      render: value => value || '-',
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: value => value || '-',
    },
    {
      title: 'BOM',
      key: 'bom',
      render: (_, record) =>
        record.bom ? (
          <Space direction="vertical" size={0}>
            <Text>{record.bom.product_code}</Text>
            <Tag color="geekblue">版本 {record.bom.version}</Tag>
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '工艺模板',
      key: 'process_template',
      render: (_, record) =>
        record.process_template ? (
          <Space>
            <DeploymentUnitOutlined style={{ color: '#13c2c2' }} />
            <Text>{record.process_template.name}</Text>
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '工序态势',
      key: 'step_snapshot',
      render: (_, record) => {
        const qcSteps = record.steps.filter(step => step.status === 'QC').length
        const blockedSteps = record.steps.filter(step => step.status === 'BLOCKED').length
        const assignedSteps = record.steps.filter(step => step.workstation_id).length
        return (
          <Space wrap>
            <Tag color="blue">{record.steps.length} 道工序</Tag>
            {assignedSteps > 0 && <Tag color="cyan">已派工 {assignedSteps}</Tag>}
            {qcSteps > 0 && <Tag color="purple">待检 {qcSteps}</Tag>}
            {blockedSteps > 0 && <Tag color="error">阻塞 {blockedSteps}</Tag>}
          </Space>
        )
      },
    },
    {
      title: '执行进度',
      key: 'progress',
      render: (_, record) => <Progress percent={calcOrderProgress(record)} size="small" />,
    },
    {
      title: '交期',
      dataIndex: 'due_date',
      key: 'due_date',
      render: value => formatDateTime(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: value => {
        const meta = getOrderStatusMeta(value)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Button type="link" onClick={() => setSelectedOrderId(record.id)}>
          查看详情
        </Button>
      ),
    },
  ]

  const stepColumns: TableColumnsType<ManufacturingOrderStep> = [
    {
      title: '工序',
      key: 'step',
      render: (_, step) => (
        <Space direction="vertical" size={0}>
          <Text strong>{step.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {step.step_code}
          </Text>
        </Space>
      ),
    },
    {
      title: '设备 / 工位',
      key: 'equipment',
      render: (_, step) =>
        step.equipment ? (
          <Space direction="vertical" size={0}>
            <Text>{step.equipment.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {step.equipment.code}
              {step.equipment.workstation ? ` / ${step.equipment.workstation}` : ''}
            </Text>
          </Space>
        ) : (
          <Text type="secondary">待派工</Text>
        ),
    },
    {
      title: '完成 / 目标',
      key: 'quantity',
      render: (_, step) => (
        <Text>
          {toNumber(step.completed_qty)} / {toNumber(step.target_qty)}
        </Text>
      ),
    },
    {
      title: '标准 / 实际工时',
      key: 'hours',
      render: (_, step) => (
        <Space direction="vertical" size={0}>
          <Text>
            {formatHours(toNumber(step.planned_work_hours) + toNumber(step.setup_hours))} / {formatHours(getReportedHours(step))}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            准备 {formatHours(step.setup_hours)} / 停机 {getDowntimeMinutes(step)} min
          </Text>
        </Space>
      ),
    },
    {
      title: '进度',
      key: 'progress',
      render: (_, step) => <Progress percent={calcStepProgress(step)} size="small" />,
    },
    {
      title: '效率',
      key: 'efficiency',
      render: (_, step) => {
        const efficiencyRate = calcStepEfficiencyRate(step)
        return (
          <Space direction="vertical" size={0}>
            <Tag color={efficiencyRate >= 100 ? 'success' : efficiencyRate >= 85 ? 'gold' : 'error'}>
              {efficiencyRate > 0 ? `${efficiencyRate}%` : '待报工'}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              标准消耗 {formatHours(getExpectedHoursByProgress(step))}
            </Text>
          </Space>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: value => {
        const meta = getStepStatusMeta(value)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '质检',
      key: 'quality',
      render: (_, step) => {
        const latest = getLatestQualityCheck(step)
        if (!latest) {
          return <Text type="secondary">待首检</Text>
        }
        const meta = getQualityResultMeta(latest.result)
        return (
          <Space direction="vertical" size={0}>
            <Tag color={meta.color}>{meta.label}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {latest.check_type} / {formatDateTime(latest.checked_at || latest.created_at)}
            </Text>
          </Space>
        )
      },
    },
    {
      title: '动作',
      key: 'actions',
      render: (_, step) => (
        <Space wrap>
          <Button size="small" icon={<SettingOutlined />} onClick={() => openPlanningModal(step)}>
            派工工时
          </Button>
          {STEP_STATUS_ACTIONS.map(action => (
            <Button
              key={action.value}
              size="small"
              onClick={() =>
                selectedOrderId &&
                updateStepStatusMutation.mutate({
                  orderId: selectedOrderId,
                  stepId: step.id,
                  status: action.value,
                })
              }
              disabled={updateStepStatusMutation.isPending}
            >
              {action.label}
            </Button>
          ))}
          <Button type="primary" size="small" icon={<ToolOutlined />} onClick={() => openReportModal(step)}>
            报工
          </Button>
          <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => openQualityModal(step)}>
            质检
          </Button>
        </Space>
      ),
    },
  ]

  const equipmentColumns: TableColumnsType<EquipmentOeeItem> = [
    {
      title: '设备',
      key: 'equipment',
      render: (_, item) => (
        <Space direction="vertical" size={0}>
          <Text strong>{item.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {item.code}
            {item.workstation ? ` / ${item.workstation}` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: value => {
        const meta = getEquipmentStatusMeta(value)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '派工',
      key: 'assigned',
      render: (_, item) => `${item.assigned_steps} 道 / ${item.orders_count} 单`,
    },
    {
      title: '计划 / 实际工时',
      key: 'hours',
      render: (_, item) => `${formatHours(item.planned_hours_total)} / ${formatHours(item.actual_hours_total)}`,
    },
    {
      title: 'Availability',
      dataIndex: 'availability_rate',
      key: 'availability_rate',
      render: value => <Tag color="blue">{formatPercent(value)}</Tag>,
    },
    {
      title: 'Performance',
      dataIndex: 'performance_rate',
      key: 'performance_rate',
      render: value => <Tag color="cyan">{formatPercent(value)}</Tag>,
    },
    {
      title: 'Quality',
      dataIndex: 'quality_rate',
      key: 'quality_rate',
      render: value => <Tag color="green">{formatPercent(value)}</Tag>,
    },
    {
      title: 'OEE',
      dataIndex: 'oee_rate',
      key: 'oee_rate',
      render: value => <Progress percent={Math.round(toNumber(value) * 100)} size="small" />,
    },
    {
      title: '停机',
      dataIndex: 'downtime_minutes_total',
      key: 'downtime_minutes_total',
      render: value => `${toNumber(value)} min`,
    },
  ]

  const highlightedEquipment = equipmentOeeSummary.items.slice(0, 3)

  return (
    <div
      style={{
        padding: 24,
        minHeight: 'calc(100vh - 64px)',
        background: 'linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)',
      }}
    >
      <Card
        bordered={false}
        style={{ borderRadius: 16, boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08)' }}
        title={
          <Space size="middle">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(22, 119, 255, 0.12)',
              }}
            >
              <ScheduleOutlined style={{ fontSize: 22, color: '#1677ff' }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                制造订单管理
              </Title>
              <Text type="secondary">把工序派工、标准工时、工位报工、质检过站与设备 OEE 串成一条制造执行链。</Text>
            </div>
          </Space>
        }
        extra={
          <Space wrap>
            <Input
              allowClear
              placeholder="搜索订单号 / 客户 / 产品"
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              style={{ width: 260 }}
            />
            <Select
              allowClear
              placeholder="筛选状态"
              value={statusFilter}
              onChange={value => setStatusFilter(value)}
              style={{ width: 160 }}
              options={STATUS_OPTIONS.map(item => ({
                label: item.label,
                value: item.value,
              }))}
            />
            <Button
              icon={<ReloadOutlined />}
              loading={isLoading || isWipLoading || isEquipmentOeeLoading}
              onClick={() => {
                refetch()
                refetchWip()
                refetchEquipmentOee()
              }}
            >
              刷新
            </Button>
            <Button
              icon={<DownloadOutlined />}
              loading={exportLoading}
              onClick={handleExport}
            >
              导出 Excel
            </Button>
            <Upload
              accept=".xlsx,.xls"
              showUploadList={false}
              beforeUpload={(file) => {
                handleImport(file as File)
                return false
              }}
            >
              <Button icon={<UploadOutlined />} loading={importLoading}>
                导入 Excel
              </Button>
            </Upload>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>
              新建订单
            </Button>
          </Space>
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
            marginBottom: 20,
          }}
        >
          {wipCards.map(card => (
            <Card key={card.title} size="small">
              <Statistic title={card.title} value={card.value} suffix={card.suffix} />
            </Card>
          ))}
          <Card size="small">
            <Statistic title="一次通过率" value={qualityPassRate} suffix="%" />
          </Card>
          <Card size="small">
            <Statistic title="整体 OEE" value={Math.round(wipSummary.overall_oee_rate * 100)} suffix="%" />
          </Card>
        </div>

        <Table
          rowKey="id"
          columns={orderColumns}
          dataSource={filteredOrders}
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: total => `共 ${total} 条制造订单`,
          }}
          locale={{
            emptyText: <Empty description="暂无制造订单，点击「新建订单」或「导入 Excel」开始" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
          style={{ marginBottom: 20 }}
        />

        <div
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(255, 127, 80, 0.08), rgba(22, 119, 255, 0.08))',
          }}
        >
          <Space wrap size="large">
            <Space>
              <WarningOutlined style={{ color: '#fa8c16' }} />
              <Text>待质检工序 {wipSummary.steps_qc} 道</Text>
            </Space>
            <Text type="secondary">返工返修数量 {wipSummary.rework_qty_total} 件</Text>
            <Text type="secondary">累计停机 {wipSummary.downtime_minutes_total} 分钟</Text>
            <Text type="secondary">在线设备 {wipSummary.equipment_active} 台</Text>
          </Space>
        </div>

      </Card>

      <Card
        bordered={false}
        style={{ marginTop: 20, borderRadius: 16, boxShadow: '0 16px 40px rgba(15, 23, 42, 0.06)' }}
        title={
          <Space>
            <BarChartOutlined style={{ color: '#0f766e' }} />
            <span>设备稼动与 OEE</span>
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetchEquipmentOee()}>
            刷新 OEE
          </Button>
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <Card size="small">
            <Statistic title="整体 OEE" value={Math.round(equipmentOeeSummary.overall_oee_rate * 100)} suffix="%" />
          </Card>
          <Card size="small">
            <Statistic
              title="Availability"
              value={Math.round(equipmentOeeSummary.overall_availability_rate * 100)}
              suffix="%"
            />
          </Card>
          <Card size="small">
            <Statistic
              title="Performance"
              value={Math.round(equipmentOeeSummary.overall_performance_rate * 100)}
              suffix="%"
            />
          </Card>
          <Card size="small">
            <Statistic title="Quality" value={Math.round(equipmentOeeSummary.overall_quality_rate * 100)} suffix="%" />
          </Card>
        </div>

        {highlightedEquipment.length > 0 && (
          <div
            style={{
              marginBottom: 16,
              padding: 16,
              borderRadius: 12,
              background: '#f8fafc',
            }}
          >
            <Space wrap size="large">
              {highlightedEquipment.map(item => (
                <Space key={item.id}>
                  <Tag color={item.oee_rate >= 0.85 ? 'success' : item.oee_rate >= 0.7 ? 'gold' : 'error'}>
                    {item.code}
                  </Tag>
                  <Text>{item.name}</Text>
                  <Text type="secondary">OEE {formatPercent(item.oee_rate)}</Text>
                </Space>
              ))}
            </Space>
          </div>
        )}

        <Table
          rowKey="id"
          columns={equipmentColumns}
          dataSource={equipmentOeeSummary.items}
          loading={isEquipmentOeeLoading}
          pagination={{ pageSize: 8, showSizeChanger: true }}
          locale={{
            emptyText: <Empty description="暂无设备 OEE 数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
        />
      </Card>

      <Drawer
        title="制造订单详情"
        width={1240}
        open={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        destroyOnClose
        extra={
          selectedOrder ? (
            <Button onClick={() => openEditOrderModal(selectedOrder)}>
              编辑订单
            </Button>
          ) : null
        }
      >
        {!selectedOrderId || isDetailLoading || !selectedOrder ? (
          <div style={{ paddingTop: 60, textAlign: 'center' }}>
            {selectedOrderId ? <Empty description="正在加载订单详情" /> : <Empty description="未选择订单" />}
          </div>
        ) : (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Card bordered={false} style={{ background: '#fafcff' }}>
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                  <div>
                    <Title level={4} style={{ margin: 0 }}>
                      {selectedOrder.order_number}
                    </Title>
                    <Text type="secondary">
                      {selectedOrder.product_name || '未填写产品名称'} / {selectedOrder.customer_name || '未填写客户'}
                    </Text>
                  </div>
                  <Tag color={getOrderStatusMeta(selectedOrder.status).color}>
                    {getOrderStatusMeta(selectedOrder.status).label}
                  </Tag>
                </Space>

                <Descriptions column={3} size="small">
                  <Descriptions.Item label="BOM">
                    {selectedOrder.bom ? `${selectedOrder.bom.product_code} / ${selectedOrder.bom.version}` : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="工艺模板">
                    {selectedOrder.process_template?.name || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="交期">{formatDateTime(selectedOrder.due_date)}</Descriptions.Item>
                  <Descriptions.Item label="数量">{selectedOrder.quantity}</Descriptions.Item>
                  <Descriptions.Item label="优先级">{selectedOrder.priority}</Descriptions.Item>
                  <Descriptions.Item label="备注">{selectedOrder.notes || '-'}</Descriptions.Item>
                </Descriptions>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 16,
                  }}
                >
                  <Card size="small">
                    <Statistic title="工序总数" value={selectedOrder.steps.length} suffix="道" />
                  </Card>
                  <Card size="small">
                    <Statistic title="已完工工序" value={selectedOrderMetrics.completedSteps} suffix="道" />
                  </Card>
                  <Card size="small">
                    <Statistic title="待质检工序" value={selectedOrderMetrics.qcSteps} suffix="道" />
                  </Card>
                  <Card size="small">
                    <Statistic title="阻塞工序" value={selectedOrderMetrics.blockedSteps} suffix="道" />
                  </Card>
                  <Card size="small">
                    <Statistic title="已派工设备" value={selectedOrderMetrics.assignedEquipmentCount} suffix="台" />
                  </Card>
                  <Card size="small">
                    <Statistic title="标准工时" value={selectedOrderMetrics.plannedHours.toFixed(1)} suffix="h" />
                  </Card>
                  <Card size="small">
                    <Statistic title="实际工时" value={selectedOrderMetrics.actualHours.toFixed(1)} suffix="h" />
                  </Card>
                  <Card size="small">
                    <Statistic title="停机" value={selectedOrderMetrics.downtimeMinutes} suffix="min" />
                  </Card>
                </div>
              </Space>
            </Card>

            <Card
              title="工序执行、派工与 WIP"
              extra={
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    refetchDetail()
                    refetchReadiness()
                    refetchOrderProcurementSuggestions()
                    refetchProcurementRequests()
                  }}
                >
                  刷新详情
                </Button>
              }
            >
              <Card
                size="small"
                style={{ marginBottom: 16, background: '#fffdf0' }}
                title="齐套分析 / 缺料清单"
                extra={
                  <Button size="small" icon={<ReloadOutlined />} onClick={() => refetchReadiness()}>
                    刷新齐套
                  </Button>
                }
                loading={isReadinessLoading}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <Card size="small">
                    <Statistic
                      title="齐套状态"
                      value={getKitStatusMeta(selectedOrderReadiness.kit_status).label}
                      valueStyle={{ fontSize: 18 }}
                    />
                  </Card>
                  <Card size="small">
                    <Statistic title="需求物料项" value={selectedOrderReadiness.required_items_total} suffix="项" />
                  </Card>
                  <Card size="small">
                    <Statistic title="缺料项" value={selectedOrderReadiness.short_items} suffix="项" />
                  </Card>
                  <Card size="small">
                    <Statistic title="风险项" value={selectedOrderReadiness.risk_items} suffix="项" />
                  </Card>
                  <Card size="small">
                    <Statistic title="缺口数量" value={selectedOrderReadiness.shortage_qty_total} />
                  </Card>
                  <Card size="small">
                    <Statistic title="齐套率" value={Math.round(selectedOrderReadiness.kit_rate * 100)} suffix="%" />
                  </Card>
                </div>

                {selectedOrderReadiness.kit_status === 'BOM_PENDING' ? (
                  <Empty description="当前工单未绑定 BOM，无法进行齐套分析" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : selectedOrderReadiness.items.length > 0 ? (
                  <Table
                    rowKey="material_code"
                    columns={materialReadinessColumns}
                    dataSource={selectedOrderReadiness.items}
                    pagination={{ pageSize: 8, showSizeChanger: true }}
                    scroll={{ x: 1200 }}
                  />
                ) : (
                  <Empty description="当前工单暂无物料需求明细" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>

              <Card
                size="small"
                style={{ marginBottom: 16, background: '#f6ffed' }}
                title="采购拉动建议"
                extra={
                  <Space>
                    <Button size="small" icon={<ReloadOutlined />} onClick={() => refetchOrderProcurementSuggestions()}>
                      刷新建议
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      loading={
                        generateProcurementRequestMutation.isPending &&
                        generateProcurementRequestMutation.variables?.source_scope === 'ORDER'
                      }
                      disabled={selectedOrderProcurementSuggestions.items.length === 0}
                      onClick={handleGenerateOrderProcurementRequest}
                    >
                      生成工单请购草稿
                    </Button>
                  </Space>
                }
                loading={isOrderProcurementSuggestionLoading}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <Card size="small">
                    <Statistic title="建议项" value={selectedOrderProcurementSuggestions.items_total} suffix="项" />
                  </Card>
                  <Card size="small">
                    <Statistic title="紧急项" value={selectedOrderProcurementSuggestions.urgent_items} suffix="项" />
                  </Card>
                  <Card size="small">
                    <Statistic title="请购项" value={selectedOrderProcurementSuggestions.to_purchase_items} suffix="项" />
                  </Card>
                  <Card size="small">
                    <Statistic title="催交项" value={selectedOrderProcurementSuggestions.to_expedite_items} suffix="项" />
                  </Card>
                  <Card size="small">
                    <Statistic title="补主数据" value={selectedOrderProcurementSuggestions.master_data_gap_items} suffix="项" />
                  </Card>
                  <Card size="small">
                    <Statistic title="建议数量" value={selectedOrderProcurementSuggestions.suggested_purchase_qty_total} />
                  </Card>
                </div>

                {selectedOrderProcurementSuggestions.items.length > 0 ? (
                  <Table
                    rowKey={item => `${item.material_code}-${item.suggested_action}`}
                    columns={procurementSuggestionColumns}
                    dataSource={selectedOrderProcurementSuggestions.items}
                    pagination={{ pageSize: 8, showSizeChanger: true }}
                    scroll={{ x: 1100 }}
                  />
                ) : (
                  <Empty description="当前工单暂无需要采购拉动的物料" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>

              <Card
                size="small"
                style={{ marginBottom: 16, background: '#fffaf0' }}
                title="工单请购跟进"
                extra={
                  <Button size="small" icon={<ReloadOutlined />} onClick={() => refetchProcurementRequests()}>
                    刷新请购
                  </Button>
                }
                loading={isProcurementRequestLoading}
              >
                {orderProcurementRequests.length > 0 ? (
                  <Table
                    rowKey="id"
                    columns={procurementRequestColumns}
                    dataSource={orderProcurementRequests}
                    pagination={{ pageSize: 5, showSizeChanger: true }}
                    scroll={{ x: 1200 }}
                    expandable={{
                      expandedRowRender: record => (
                        <Table
                          rowKey="id"
                          size="small"
                          columns={procurementRequestItemColumns}
                          dataSource={record.items}
                          pagination={false}
                          scroll={{ x: 900 }}
                        />
                      ),
                    }}
                  />
                ) : (
                  <Empty description="当前工单还没有生成请购草稿" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>

              <Table
                rowKey="id"
                columns={stepColumns}
                dataSource={[...selectedOrder.steps].sort((a, b) => a.sort_order - b.sort_order)}
                pagination={false}
                expandable={{
                  expandedRowRender: step => {
                    const reports = [...(step.reports || [])].sort(
                      (a, b) =>
                        dayjs(b.report_time || b.created_at || '').valueOf() -
                        dayjs(a.report_time || a.created_at || '').valueOf()
                    )
                    const qualityChecks = [...(step.quality_checks || [])].sort(
                      (a, b) =>
                        dayjs(b.checked_at || b.created_at || '').valueOf() -
                        dayjs(a.checked_at || a.created_at || '').valueOf()
                    )

                    return (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                          gap: 16,
                        }}
                      >
                        <Card size="small" title={`报工记录 (${reports.length})`} bordered={false}>
                          <div style={{ marginBottom: 12 }}>
                            <Space wrap>
                              <Tag color="blue">标准 {formatHours(toNumber(step.planned_work_hours) + toNumber(step.setup_hours))}</Tag>
                              <Tag color="cyan">实际 {formatHours(getReportedHours(step))}</Tag>
                              <Tag color="gold">停机 {getDowntimeMinutes(step)} min</Tag>
                              {step.equipment && <Tag color="green">{step.equipment.code}</Tag>}
                            </Space>
                          </div>
                          {reports.length > 0 ? (
                            <Table rowKey="id" size="small" pagination={false} columns={reportColumns} dataSource={reports} />
                          ) : (
                            <Empty description="该工序暂无报工记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                          )}
                        </Card>
                        <Card size="small" title={`质检记录 (${qualityChecks.length})`} bordered={false}>
                          <div style={{ marginBottom: 12 }}>
                            <Space wrap>
                              <Tag color="warning">返工 {sumQualityMetric(step, 'rework_qty')}</Tag>
                              <Tag color="error">不良 {sumQualityMetric(step, 'defect_qty')}</Tag>
                              <Tag color="purple">{getStepStatusMeta(step.status).label}</Tag>
                            </Space>
                          </div>
                          {qualityChecks.length > 0 ? (
                            <Table
                              rowKey="id"
                              size="small"
                              pagination={false}
                              columns={qualityColumns}
                              dataSource={qualityChecks}
                            />
                          ) : (
                            <Empty description="该工序暂无质检记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                          )}
                        </Card>
                      </div>
                    )
                  },
                }}
              />
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title="新建制造订单"
        open={isCreateModalOpen}
        onOk={handleCreateOrder}
        onCancel={() => setIsCreateModalOpen(false)}
        okText="创建订单"
        cancelText="取消"
        confirmLoading={createOrderMutation.isPending}
        width={760}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{
            quantity: 1,
            priority: 3,
            status: 'PLANNED',
            auto_generate_steps: true,
          }}
          style={{ marginTop: 20 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="order_number"
              label="制造订单号"
              rules={[{ required: true, message: '请输入制造订单号' }]}
            >
              <Input placeholder="例如 MO-20260422-001" />
            </Form.Item>
            <Form.Item name="customer_name" label="客户名称">
              <Input placeholder="例如 某某装备公司" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="product_name" label="产品名称">
              <Input placeholder="例如 非标混料设备总成" />
            </Form.Item>
            <Form.Item
              name="quantity"
              label="订单数量"
              rules={[{ required: true, message: '请输入订单数量' }]}
            >
              <InputNumber min={1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="bom_id" label="绑定 BOM">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={bomHeaders.map(item => ({
                  value: item.id,
                  label: `${item.material?.name || item.product_code} (${item.version})`,
                }))}
                placeholder="选择 BOM 版本"
              />
            </Form.Item>
            <Form.Item name="process_template_id" label="绑定工艺模板">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={processTemplates.map(item => ({
                  value: item.id,
                  label: item.name,
                }))}
                placeholder="选择工艺模板"
              />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Form.Item name="due_date" label="计划交期">
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="priority" label="优先级">
              <Select options={PRIORITY_OPTIONS} />
            </Form.Item>
            <Form.Item name="status" label="初始状态">
              <Select
                options={STATUS_OPTIONS.map(item => ({
                  label: item.label,
                  value: item.value,
                }))}
              />
            </Form.Item>
          </div>

          <Form.Item name="auto_generate_steps" label="工艺步骤生成">
            <Select
              options={[
                { label: '按工艺模板自动生成工序步骤', value: true },
                { label: '先创建空订单，稍后补工序', value: false },
              ]}
            />
          </Form.Item>

          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="记录项目背景、关键交付约束、变更说明等" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedStepForPlanning ? `工序派工与工时: ${selectedStepForPlanning.name}` : '工序派工与工时'}
        open={!!selectedStepForPlanning}
        onOk={handleSubmitPlanning}
        onCancel={() => {
          setSelectedStepForPlanning(null)
          planningForm.resetFields()
        }}
        okText="保存计划"
        cancelText="取消"
        confirmLoading={updateStepPlanningMutation.isPending}
      >
        <Form form={planningForm} layout="vertical" style={{ marginTop: 20 }}>
          <Form.Item name="workstation_id" label="分配设备 / 工作中心">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={equipmentOptions.map((item: EquipmentOption) => ({
                value: item.id,
                label: `${item.code} - ${item.name}${item.workstation ? ` / ${item.workstation}` : ''}`,
              }))}
              placeholder="选择工位设备"
            />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="planned_work_hours"
              label="标准工时"
              rules={[{ required: true, message: '请输入标准工时' }]}
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="setup_hours" label="准备工时" rules={[{ required: true, message: '请输入准备工时' }]}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title={selectedStepForReport ? `工序报工: ${selectedStepForReport.name}` : '工序报工'}
        open={!!selectedStepForReport}
        onOk={handleSubmitReport}
        onCancel={() => {
          setSelectedStepForReport(null)
          reportForm.resetFields()
        }}
        okText="提交报工"
        cancelText="取消"
        confirmLoading={reportWorkMutation.isPending}
      >
        <Form
          form={reportForm}
          layout="vertical"
          initialValues={{
            quantity: 0,
            scrap_qty: 0,
            work_hours: 0,
            downtime_minutes: 0,
            report_type: 'MANUAL',
          }}
          style={{ marginTop: 20 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="quantity"
              label="报工数量"
              rules={[{ required: true, message: '请输入报工数量' }]}
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="scrap_qty"
              label="报废数量"
              rules={[{ required: true, message: '请输入报废数量' }]}
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="work_hours" label="实际工时">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="downtime_minutes" label="停机分钟">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item name="report_type" label="报工方式">
            <Select options={REPORT_TYPE_OPTIONS} />
          </Form.Item>

          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} placeholder="记录异常原因、待料说明、返工情况等" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedStepForQuality ? `工序质检: ${selectedStepForQuality.name}` : '工序质检'}
        open={!!selectedStepForQuality}
        onOk={handleSubmitQuality}
        onCancel={() => {
          setSelectedStepForQuality(null)
          qualityForm.resetFields()
        }}
        okText="提交质检"
        cancelText="取消"
        confirmLoading={qualityCheckMutation.isPending}
      >
        <Form
          form={qualityForm}
          layout="vertical"
          initialValues={{
            check_type: 'IPQC',
            result: 'PASS',
            checked_qty: 0,
            defect_qty: 0,
            rework_qty: 0,
          }}
          style={{ marginTop: 20 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="check_type" label="检验类型" rules={[{ required: true, message: '请选择检验类型' }]}>
              <Select options={CHECK_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item name="result" label="检验结果" rules={[{ required: true, message: '请选择检验结果' }]}>
              <Select options={QUALITY_RESULT_OPTIONS.map(item => ({ label: item.label, value: item.value }))} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Form.Item
              name="checked_qty"
              label="检验数量"
              rules={[{ required: true, message: '请输入检验数量' }]}
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="defect_qty"
              label="不良数量"
              rules={[{ required: true, message: '请输入不良数量' }]}
            >
              <InputNumber
                min={0}
                precision={2}
                style={{ width: '100%' }}
                disabled={selectedQualityResult === 'PASS'}
              />
            </Form.Item>
            <Form.Item
              name="rework_qty"
              label="返工数量"
              rules={[{ required: true, message: '请输入返工数量' }]}
            >
              <InputNumber
                min={0}
                precision={2}
                style={{ width: '100%' }}
                disabled={selectedQualityResult === 'PASS'}
              />
            </Form.Item>
          </div>

          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} placeholder="记录缺陷现象、返工措施、暂缓原因等" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="编辑制造订单"
        open={!!editingOrder}
        zIndex={1600}
        onOk={handleUpdateOrder}
        onCancel={() => {
          setEditingOrder(null)
          editOrderForm.resetFields()
        }}
        okText="保存修改"
        cancelText="取消"
        confirmLoading={updateOrderMutation.isPending}
        width={760}
      >
        <Form form={editOrderForm} layout="vertical" style={{ marginTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="order_number" label="制造订单号" rules={[{ required: true, message: '请输入制造订单号' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="customer_name" label="客户名称">
              <Input />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="product_name" label="产品名称">
              <Input />
            </Form.Item>
            <Form.Item name="quantity" label="订单数量" rules={[{ required: true, message: '请输入订单数量' }]}>
              <InputNumber min={1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="bom_id" label="绑定 BOM">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={bomHeaders.map(item => ({
                  value: item.id,
                  label: `${item.material?.name || item.product_code} (${item.version})`,
                }))}
              />
            </Form.Item>
            <Form.Item name="process_template_id" label="绑定工艺模板">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={processTemplates.map(item => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Form.Item name="due_date" label="计划交期">
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="priority" label="优先级">
              <Select options={PRIORITY_OPTIONS} />
            </Form.Item>
            <Form.Item name="status" label="订单状态">
              <Select options={STATUS_OPTIONS.map(item => ({ label: item.label, value: item.value }))} />
            </Form.Item>
          </div>

          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ManufacturingOrderManagement
