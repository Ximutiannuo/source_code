import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Layout,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Statistic,
  Radio,
  Switch,
  Tag,
  Table,
  Tree,
  Typography,
  Upload,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { DataNode } from 'antd/es/tree'
import {
  ApartmentOutlined,
  BlockOutlined,
  CloudSyncOutlined,
  DeploymentUnitOutlined,
  DownloadOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { drawingDocumentService, type DrawingDocument } from '../services/drawingDocumentService'
import {
  plmService,
  type BOMDetail,
  type BOMItem,
  type BOMItemDrawingValidation,
  type BOMNode,
  type BOMSavePayload,
} from '../services/plmService'

const { Title, Text, Paragraph } = Typography
const { Sider, Content } = Layout

const BOM_TYPE_OPTIONS = [
  { label: 'EBOM', value: 'EBOM' },
  { label: 'PBOM', value: 'PBOM' },
  { label: 'MBOM', value: 'MBOM' },
]

const SOURCE_OPTIONS = [
  { label: 'MANUAL', value: 'MANUAL' },
  { label: 'CAD', value: 'CAD' },
  { label: 'SOLIDWORKS', value: 'SOLIDWORKS' },
  { label: 'EXCEL', value: 'EXCEL' },
]

const ITEM_CATEGORY_OPTIONS = [
  { label: 'Assembly', value: 'Assembly' },
  { label: 'Purchased', value: 'Purchased' },
  { label: 'Fabricated', value: 'Fabricated' },
  { label: 'Standard', value: 'Standard' },
]

const PROCUREMENT_TYPE_OPTIONS = [
  { label: 'MAKE', value: 'MAKE' },
  { label: 'BUY', value: 'BUY' },
  { label: 'OUTSOURCE', value: 'OUTSOURCE' },
]

type EditableBOMItem = {
  id?: number
  localKey: string
  parent_item_code?: string
  child_item_code: string
  material_name?: string
  specification?: string
  unit?: string
  quantity: number
  component_type?: string
  routing_link?: string
  find_number?: string
  item_level?: number
  item_category?: string
  procurement_type?: string
  loss_rate?: number
  unit_price?: number
  total_price?: number
  source_reference?: string
  drawing_document_id?: number | null
  children?: EditableBOMItem[]
}

const generateRowKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const calcLineTotal = (item: EditableBOMItem) => {
  const qty = Number(item.quantity || 0)
  const price = Number(item.unit_price || 0)
  const lossRate = Number(item.loss_rate || 0)
  return Number((qty * price * (1 + lossRate)).toFixed(2))
}

const createEditableItem = (parentItemCode?: string): EditableBOMItem => ({
  localKey: generateRowKey(),
  parent_item_code: parentItemCode,
  child_item_code: '',
  material_name: '',
  specification: '',
  unit: 'PCS',
  quantity: 1,
  component_type: 'NORMAL',
  routing_link: '',
  find_number: '',
  item_level: 1,
  item_category: 'Purchased',
  procurement_type: 'BUY',
  loss_rate: 0,
  unit_price: 0,
  total_price: 0,
  source_reference: '',
})

const getDrawingVersionLabel = (version?: string | null, revision?: string | null) => {
  const parts = [version, revision ? `Rev.${revision}` : null].filter(Boolean)
  return parts.length ? parts.join(' / ') : '-'
}

const getDrawingMappingStatusMeta = (status?: string | null) => {
  switch (status) {
    case 'VALID':
      return { color: 'success', label: '已校验' as const }
    case 'WARNING':
      return { color: 'warning', label: '待确认' as const }
    case 'ERROR':
      return { color: 'error', label: '异常' as const }
    default:
      return { color: 'default', label: '未映射' as const }
  }
}

const getDrawingValidationAlertType = (status?: string | null): 'success' | 'info' | 'warning' | 'error' => {
  switch (status) {
    case 'VALID':
      return 'success'
    case 'WARNING':
      return 'warning'
    case 'ERROR':
      return 'error'
    default:
      return 'info'
  }
}

const transformToTreeData = (node: BOMNode, path = '0'): DataNode => ({
  title: (
    <Space wrap>
      <Text strong>{node.material_name}</Text>
      <Text type="secondary" style={{ fontSize: 12 }}>
        ({node.material_code})
      </Text>
      {node.find_number ? <TagLike color="#1677ff">位号 {node.find_number}</TagLike> : null}
      <Badge
        count={`${node.quantity} ${node.unit}`}
        style={{
          backgroundColor: node.level === 0 ? '#1677ff' : '#52c41a',
          fontSize: 10,
        }}
      />
      {node.procurement_type ? <TagLike color="#722ed1">{node.procurement_type}</TagLike> : null}
      {node.unit_price ? <TagLike color="#faad14">单价 {node.unit_price.toFixed(2)}</TagLike> : null}
    </Space>
  ),
  key: `${path}-${node.material_code}-${node.level}`,
  icon: node.children.length > 0 ? <ApartmentOutlined /> : <BlockOutlined />,
  children: node.children.map((child, index) => transformToTreeData(child, `${path}-${index}`)),
})

const buildEditorTreeRows = (items: EditableBOMItem[], rootCode: string) => {
  const childrenByParent = new Map<string, EditableBOMItem[]>()

  items.forEach(item => {
    const parentCode = item.parent_item_code || rootCode
    const current = childrenByParent.get(parentCode) || []
    current.push(item)
    childrenByParent.set(parentCode, current)
  })

  const attachChildren = (parentCode: string, level: number, lineage: Set<string>): EditableBOMItem[] =>
    (childrenByParent.get(parentCode) || []).map(item => {
      const branchKey = `${parentCode}>${item.child_item_code}>${item.localKey}`
      if (lineage.has(branchKey)) {
        return {
          ...item,
          item_level: item.item_level || level,
          children: [],
        }
      }

      const nextLineage = new Set(lineage)
      nextLineage.add(branchKey)

      return {
        ...item,
        item_level: item.item_level || level,
        children: attachChildren(item.child_item_code, level + 1, nextLineage),
      }
    })

  return attachChildren(rootCode, 1, new Set())
}

const BOMStructure: React.FC = () => {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [selectedBOMId, setSelectedBOMId] = useState<number | null>(null)
  const [bomTypeFilter, setBomTypeFilter] = useState<string | undefined>(undefined)
  const [sourceFilter, setSourceFilter] = useState<string | undefined>(undefined)
  const [editorVisible, setEditorVisible] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editableItems, setEditableItems] = useState<EditableBOMItem[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [mappingVisible, setMappingVisible] = useState(false)
  const [mappingTarget, setMappingTarget] = useState<BOMItem | null>(null)
  const [mappingSearch, setMappingSearch] = useState('')
  const [selectedDrawingId, setSelectedDrawingId] = useState<number | null>(null)
  const [mappingValidation, setMappingValidation] = useState<BOMItemDrawingValidation | null>(null)

  const [editorForm] = Form.useForm()
  const productCodeInEditor = Form.useWatch('product_code', editorForm)

  const { data: bomHeaders = [], isLoading: isLoadingHeaders, refetch: refetchHeaders } = useQuery({
    queryKey: ['boms', bomTypeFilter, sourceFilter],
    queryFn: () => plmService.getBOMs({ bom_type: bomTypeFilter, source_system: sourceFilter }),
  })

  useEffect(() => {
    if (!selectedBOMId && bomHeaders.length > 0) {
      setSelectedBOMId(bomHeaders[0].id)
    }
    if (selectedBOMId && !bomHeaders.some(item => item.id === selectedBOMId) && bomHeaders.length > 0) {
      setSelectedBOMId(bomHeaders[0].id)
    }
  }, [bomHeaders, selectedBOMId])

  const selectedHeader = useMemo(
    () => bomHeaders.find(item => item.id === selectedBOMId) || null,
    [bomHeaders, selectedBOMId]
  )

  const { data: bomDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['bomDetail', selectedBOMId],
    queryFn: () => plmService.getBOMDetail(selectedBOMId!),
    enabled: !!selectedBOMId,
  })

  const { data: bomTree, isLoading: isLoadingTree } = useQuery({
    queryKey: ['bomTree', selectedBOMId],
    queryFn: () => plmService.expandBOM(selectedBOMId!),
    enabled: !!selectedBOMId,
  })

  const { data: linkedDrawings = [], isLoading: isLoadingDrawings } = useQuery({
    queryKey: ['bomDrawings', selectedBOMId],
    queryFn: () => drawingDocumentService.getDrawingsByBOM(selectedBOMId!),
    enabled: !!selectedBOMId,
  })

  const { data: mappingCandidateDocuments = [], isLoading: isLoadingMappingCandidates } = useQuery({
    queryKey: ['bomItemDrawingCandidates', selectedBOMId, mappingTarget?.id, mappingSearch],
    queryFn: () =>
      drawingDocumentService.listDocuments({
        limit: 200,
        search: mappingSearch || undefined,
        material_code: mappingSearch ? undefined : mappingTarget?.child_item_code,
      }),
    enabled: !!selectedBOMId && !!mappingTarget?.id,
  })

  const treeData = useMemo(() => (bomTree ? [transformToTreeData(bomTree)] : []), [bomTree])

  const refreshBOMQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['boms'] }),
      queryClient.invalidateQueries({ queryKey: ['bomDetail'] }),
      queryClient.invalidateQueries({ queryKey: ['bomTree'] }),
      queryClient.invalidateQueries({ queryKey: ['bomDrawings'] }),
      queryClient.invalidateQueries({ queryKey: ['drawingDocuments'] }),
    ])
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: BOMSavePayload) => {
      if (editorMode === 'edit' && selectedBOMId) {
        return plmService.updateBOM(selectedBOMId, payload)
      }
      return plmService.saveBOM(payload)
    },
    onSuccess: async result => {
      message.success(editorMode === 'edit' ? 'BOM 已更新' : 'BOM 已创建')
      setEditorVisible(false)
      setSelectedBOMId(result.id)
      await refreshBOMQueries()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || error?.message || 'BOM 保存失败')
    },
  })

  const syncMutation = useMutation({
    mutationFn: (payload: BOMSavePayload) =>
      plmService.syncBOMFromCAD({
        ...payload,
        source_system: 'SOLIDWORKS',
        sync_status: 'SYNCED',
      }),
    onSuccess: async result => {
      message.success(`CAD BOM 已同步到平台：${result.product_code}/${result.version}`)
      setSelectedBOMId(result.id)
      await refreshBOMQueries()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || error?.message || 'CAD 同步失败')
    },
  })

  const saveDrawingMappingMutation = useMutation({
    mutationFn: (payload: { bom_item_id: number; drawing_document_id?: number | null }[]) =>
      plmService.saveBOMItemDrawingMappings(selectedBOMId!, payload),
    onSuccess: async result => {
      message.success(`已更新 ${result.updated} 条明细行图纸映射`)
      closeDrawingMapping()
      await refreshBOMQueries()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || error?.message || '图纸映射保存失败')
    },
  })

  const openCreateEditor = () => {
    setEditorMode('create')
    editorForm.setFieldsValue({
      product_code: '',
      product_name: '',
      version: 'v1.0',
      bom_type: 'EBOM',
      status: 'DRAFT',
      is_active: true,
      source_system: 'MANUAL',
      source_file: '',
      product_family: '',
      business_unit: '',
      project_code: '',
      plant_code: '',
      discipline: '',
      cad_document_no: '',
      description: '',
    })
    setEditableItems([])
    setEditorVisible(true)
  }

  const openEditEditor = (detail: BOMDetail) => {
    setEditorMode('edit')
    editorForm.setFieldsValue({
      product_code: detail.product_code,
      product_name: detail.material?.name || detail.product_code,
      version: detail.version,
      bom_type: detail.bom_type || 'EBOM',
      status: detail.status || 'DRAFT',
      is_active: detail.is_active,
      source_system: detail.source_system || 'MANUAL',
      source_file: detail.source_file || '',
      product_family: detail.product_family || '',
      business_unit: detail.business_unit || '',
      project_code: detail.project_code || '',
      plant_code: detail.plant_code || '',
      discipline: detail.discipline || '',
      cad_document_no: detail.cad_document_no || '',
      description: detail.description || '',
    })

    setEditableItems(
      detail.items.map(item => ({
        id: item.id,
        localKey: String(item.id || generateRowKey()),
        parent_item_code: item.parent_item_code || detail.product_code,
        child_item_code: item.child_item_code,
        material_name: item.material?.name || '',
        specification: item.material?.specification || '',
        unit: item.material?.unit || 'PCS',
        quantity: item.quantity,
        component_type: item.component_type || 'NORMAL',
        routing_link: item.routing_link || '',
        find_number: item.find_number || '',
        item_level: item.item_level || 1,
        item_category: item.item_category || '',
        procurement_type: item.procurement_type || '',
        loss_rate: item.loss_rate || 0,
        unit_price: item.unit_price || 0,
        total_price: item.total_price || 0,
        source_reference: item.source_reference || '',
        drawing_document_id: item.drawing_document_id,
      }))
    )
    setEditorVisible(true)
  }

  const handleRowChange = (localKey: string, patch: Partial<EditableBOMItem>) => {
    setEditableItems(current =>
      current.map(item => {
        if (item.localKey !== localKey) {
          return item
        }

        const nextItem = { ...item, ...patch }
        if (patch.quantity !== undefined || patch.unit_price !== undefined || patch.loss_rate !== undefined) {
          nextItem.total_price = calcLineTotal(nextItem)
        }
        return nextItem
      })
    )
  }

  const handleAddSibling = (row?: EditableBOMItem) => {
    setEditableItems(current => [...current, createEditableItem(row?.parent_item_code || productCodeInEditor || '')])
  }

  const handleAddChild = (row: EditableBOMItem) => {
    if (!row.child_item_code) {
      message.warning('请先填写当前行的子项编码，再新增下级')
      return
    }
    setEditableItems(current => [...current, createEditableItem(row.child_item_code)])
  }

  const handleDeleteRow = (localKey: string) => {
    const target = editableItems.find(item => item.localKey === localKey)
    if (!target) {
      return
    }

    const descendants = new Set<string>()
    const collectDescendants = (parentCode: string) => {
      editableItems
        .filter(item => item.parent_item_code === parentCode)
        .forEach(item => {
          descendants.add(item.localKey)
          collectDescendants(item.child_item_code)
        })
    }

    collectDescendants(target.child_item_code)
    setEditableItems(current => current.filter(item => item.localKey !== localKey && !descendants.has(item.localKey)))
  }

  const openDrawingMapping = (item: BOMItem) => {
    setMappingTarget(item)
    setSelectedDrawingId(item.drawing_document_id || null)
    setMappingValidation(null)
    setMappingSearch('')
    setMappingVisible(true)
  }

  const closeDrawingMapping = () => {
    setMappingVisible(false)
    setMappingTarget(null)
    setSelectedDrawingId(null)
    setMappingValidation(null)
    setMappingSearch('')
  }

  const validateDrawingMappingSelection = async (drawingDocumentId: number | null) => {
    if (!selectedBOMId || !mappingTarget?.id) {
      return
    }
    try {
      const result = await plmService.validateBOMItemDrawingMappings(selectedBOMId, [
        {
          bom_item_id: mappingTarget.id,
          drawing_document_id: drawingDocumentId,
        },
      ])
      setMappingValidation(result.results[0] || null)
    } catch (error: any) {
      setMappingValidation(null)
      message.error(error?.response?.data?.detail || error?.message || '图纸映射校验失败')
    }
  }

  useEffect(() => {
    if (!mappingVisible || !mappingTarget?.id || !selectedBOMId) {
      return
    }
    void validateDrawingMappingSelection(selectedDrawingId)
  }, [mappingVisible, mappingTarget?.id, selectedBOMId, selectedDrawingId])

  const handleSaveDrawingMapping = async () => {
    if (!selectedBOMId || !mappingTarget?.id) {
      return
    }

    const payload = [
      {
        bom_item_id: mappingTarget.id,
        drawing_document_id: selectedDrawingId,
      },
    ]

    let validation = mappingValidation
    if (!validation) {
      try {
        const result = await plmService.validateBOMItemDrawingMappings(selectedBOMId, payload)
        validation = result.results[0] || null
        setMappingValidation(validation)
      } catch (error: any) {
        message.error(error?.response?.data?.detail || error?.message || '图纸映射校验失败')
        return
      }
    }

    if (!validation) {
      return
    }
    if (!validation.can_apply) {
      message.error(validation.message || '当前图纸不能映射到该 BOM 明细行')
      return
    }

    const commitSave = () => saveDrawingMappingMutation.mutate(payload)
    if (validation.warnings.length > 0) {
      Modal.confirm({
        title: '检测到版本替换校验提示',
        width: 640,
        content: (
          <div>
            <div style={{ marginBottom: 12 }}>{validation.message}</div>
            <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
              {validation.warnings.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ),
        onOk: commitSave,
      })
      return
    }

    commitSave()
  }

  const handleSave = async () => {
    try {
      const values = await editorForm.validateFields()
      const rootCode = String(values.product_code || '').trim()
      const cleanItems = editableItems
        .filter(item => item.child_item_code.trim())
        .map(item => ({
          id: item.id,
          parent_item_code: (item.parent_item_code || rootCode || '').trim() || rootCode,
          child_item_code: item.child_item_code.trim(),
          quantity: Number(item.quantity || 0),
          component_type: item.component_type || 'NORMAL',
          routing_link: item.routing_link || undefined,
          find_number: item.find_number || undefined,
          item_level: item.item_level || undefined,
          item_category: item.item_category || undefined,
          procurement_type: item.procurement_type || undefined,
          loss_rate: Number(item.loss_rate || 0),
          unit_price: Number(item.unit_price || 0),
          total_price: Number(item.total_price || 0),
          source_reference: item.source_reference || undefined,
          drawing_document_id: item.drawing_document_id ?? undefined,
          material_name: item.material_name || undefined,
          specification: item.specification || undefined,
          unit: item.unit || undefined,
        }))

      if (!cleanItems.length) {
        message.warning('请至少维护一条 BOM 明细')
        return
      }

      saveMutation.mutate({
        id: editorMode === 'edit' ? selectedBOMId || undefined : undefined,
        product_code: values.product_code,
        product_name: values.product_name,
        version: values.version,
        bom_type: values.bom_type,
        status: values.status,
        description: values.description,
        is_active: values.is_active !== false,
        product_family: values.product_family,
        business_unit: values.business_unit,
        project_code: values.project_code,
        plant_code: values.plant_code,
        discipline: values.discipline,
        source_system: values.source_system,
        source_file: values.source_file,
        cad_document_no: values.cad_document_no,
        items: cleanItems,
      })
    } catch {
      // 表单校验已由 antd 处理
    }
  }

  const handleExport = async () => {
    try {
      setExportLoading(true)
      const response = await plmService.exportBOMs({
        bom_type: bomTypeFilter,
        source_system: sourceFilter,
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `bom_master_${new Date().toISOString().slice(0, 10)}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      message.success('BOM 主数据已导出')
    } catch (error: any) {
      message.error(error?.response?.data?.detail || 'BOM 导出失败')
    } finally {
      setExportLoading(false)
    }
  }

  const handleImport = async (file: File) => {
    try {
      setImportLoading(true)
      const result = await plmService.importBOMs(file)

      if (result.errors > 0) {
        Modal.warning({
          title: 'BOM 导入完成，但存在异常行',
          width: 720,
          content: (
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
              {`成功导入 ${result.imported} 个 BOM，处理明细 ${result.items_total} 条，异常 ${result.errors} 条。

${result.error_details
  .slice(0, 10)
  .map(item => `行 ${item.row}: ${item.error}`)
  .join('\n')}`}
            </pre>
          ),
        })
      } else {
        message.success(`BOM 导入完成：${result.imported} 个版本，${result.items_total} 条明细`)
      }

      await refreshBOMQueries()
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error?.message || 'BOM 导入失败')
    } finally {
      setImportLoading(false)
    }
    return false
  }

  const handleMockCadSync = () => {
    if (!bomDetail) {
      message.warning('请先选择一个 BOM 版本')
      return
    }

    syncMutation.mutate({
      id: bomDetail.id,
      product_code: bomDetail.product_code,
      product_name: bomDetail.material?.name || bomDetail.product_code,
      version: bomDetail.version,
      bom_type: bomDetail.bom_type || 'EBOM',
      status: bomDetail.status || 'DRAFT',
      description: bomDetail.description || '',
      is_active: bomDetail.is_active,
      product_family: bomDetail.product_family || '',
      business_unit: bomDetail.business_unit || '',
      project_code: bomDetail.project_code || '',
      plant_code: bomDetail.plant_code || '',
      discipline: bomDetail.discipline || '',
      source_file: bomDetail.source_file || `SolidWorks/${bomDetail.product_code}.sldasm`,
      cad_document_no: bomDetail.cad_document_no || bomDetail.product_code,
      items: bomDetail.items.map(item => ({
        id: item.id,
        parent_item_code: item.parent_item_code || bomDetail.product_code,
        child_item_code: item.child_item_code,
        quantity: item.quantity,
        component_type: item.component_type || 'NORMAL',
        routing_link: item.routing_link || undefined,
        find_number: item.find_number || undefined,
        item_level: item.item_level || undefined,
        item_category: item.item_category || undefined,
        procurement_type: item.procurement_type || undefined,
        loss_rate: item.loss_rate,
        unit_price: item.unit_price,
        total_price: item.total_price,
        source_reference: item.source_reference || undefined,
        drawing_document_id: item.drawing_document_id ?? undefined,
        material_name: item.material?.name || undefined,
        specification: item.material?.specification || undefined,
        unit: item.material?.unit || undefined,
        drawing_no: item.material?.drawing_no || undefined,
        revision: item.material?.revision || undefined,
      })),
    })
  }

  const editorTreeRows = useMemo(
    () => buildEditorTreeRows(editableItems, String(productCodeInEditor || '').trim()),
    [editableItems, productCodeInEditor]
  )

  const editorColumns: ColumnsType<EditableBOMItem> = [
    {
      title: '位号',
      dataIndex: 'find_number',
      width: 100,
      render: (_, row) => (
        <Input
          value={row.find_number}
          onChange={event => handleRowChange(row.localKey, { find_number: event.target.value })}
          placeholder="001"
        />
      ),
    },
    {
      title: '子项编码',
      dataIndex: 'child_item_code',
      width: 180,
      render: (_, row) => (
        <Input
          value={row.child_item_code}
          onChange={event => handleRowChange(row.localKey, { child_item_code: event.target.value })}
          placeholder="MAT-1001"
        />
      ),
    },
    {
      title: '子项名称',
      dataIndex: 'material_name',
      width: 180,
      render: (_, row) => (
        <Input
          value={row.material_name}
          onChange={event => handleRowChange(row.localKey, { material_name: event.target.value })}
          placeholder="零件名称"
        />
      ),
    },
    {
      title: '规格',
      dataIndex: 'specification',
      width: 180,
      render: (_, row) => (
        <Input
          value={row.specification}
          onChange={event => handleRowChange(row.localKey, { specification: event.target.value })}
          placeholder="规格型号"
        />
      ),
    },
    {
      title: '单位',
      dataIndex: 'unit',
      width: 90,
      render: (_, row) => (
        <Input
          value={row.unit}
          onChange={event => handleRowChange(row.localKey, { unit: event.target.value })}
          placeholder="PCS"
        />
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 110,
      render: (_, row) => (
        <InputNumber
          min={0}
          value={row.quantity}
          onChange={value => handleRowChange(row.localKey, { quantity: Number(value || 0) })}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '物料维度',
      dataIndex: 'item_category',
      width: 140,
      render: (_, row) => (
        <Select
          value={row.item_category}
          options={ITEM_CATEGORY_OPTIONS}
          onChange={value => handleRowChange(row.localKey, { item_category: value })}
          allowClear
        />
      ),
    },
    {
      title: '采购类型',
      dataIndex: 'procurement_type',
      width: 130,
      render: (_, row) => (
        <Select
          value={row.procurement_type}
          options={PROCUREMENT_TYPE_OPTIONS}
          onChange={value => handleRowChange(row.localKey, { procurement_type: value })}
          allowClear
        />
      ),
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      width: 110,
      render: (_, row) => (
        <InputNumber
          min={0}
          value={row.unit_price}
          onChange={value => handleRowChange(row.localKey, { unit_price: Number(value || 0) })}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '总价',
      dataIndex: 'total_price',
      width: 120,
      render: (_, row) => <Text>{Number(row.total_price || 0).toFixed(2)}</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 190,
      fixed: 'right',
      render: (_, row) => (
        <Space size="small" wrap>
          <Button size="small" onClick={() => handleAddSibling(row)}>
            同级
          </Button>
          <Button size="small" type="dashed" onClick={() => handleAddChild(row)}>
            下级
          </Button>
          <Button size="small" danger onClick={() => handleDeleteRow(row.localKey)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const drawingMappingColumns: ColumnsType<BOMItem> = [
    {
      title: '位号',
      dataIndex: 'find_number',
      width: 90,
      render: value => value || '-',
    },
    {
      title: '子项编码',
      dataIndex: 'child_item_code',
      width: 160,
      render: value => <Text strong>{value}</Text>,
    },
    {
      title: '物料名称',
      key: 'material_name',
      width: 220,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Text>{row.material?.name || '-'}</Text>
          <Text type="secondary">{row.material?.specification || '-'}</Text>
        </Space>
      ),
    },
    {
      title: '物料图号',
      key: 'material_drawing_no',
      width: 150,
      render: (_, row) => row.material?.drawing_no || '-',
    },
    {
      title: '已映射图纸',
      key: 'drawing_document',
      width: 240,
      render: (_, row) =>
        row.drawing_document ? (
          <Space direction="vertical" size={2}>
            <Text strong>{row.drawing_document.document_number}</Text>
            <Text type="secondary">{row.drawing_document.document_name}</Text>
            <Text type="secondary">
              {getDrawingVersionLabel(row.drawing_document.version, row.drawing_document.revision)}
            </Text>
          </Space>
        ) : (
          <Text type="secondary">未映射</Text>
        ),
    },
    {
      title: '映射状态',
      key: 'drawing_mapping_status',
      width: 120,
      render: (_, row) => {
        const meta = getDrawingMappingStatusMeta(row.drawing_mapping_status)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '校验信息',
      dataIndex: 'drawing_validation_message',
      width: 260,
      render: (value, row) => value || (row.drawing_document_id ? '已建立图纸映射' : '未建立图纸映射'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, row) => (
        <Button size="small" type="link" disabled={!row.id} onClick={() => openDrawingMapping(row)}>
          映射图纸
        </Button>
      ),
    },
  ]

  const mappingCandidateColumns: ColumnsType<DrawingDocument> = [
    {
      title: '选择',
      key: 'select',
      width: 70,
      render: (_, row) => (
        <Radio checked={selectedDrawingId === row.id} onChange={() => setSelectedDrawingId(row.id)} />
      ),
    },
    {
      title: '图号',
      dataIndex: 'document_number',
      width: 180,
      render: value => <Text strong>{value}</Text>,
    },
    {
      title: '名称',
      dataIndex: 'document_name',
      width: 220,
    },
    {
      title: '版本',
      key: 'version',
      width: 150,
      render: (_, row) => getDrawingVersionLabel(row.version, row.revision),
    },
    {
      title: '关联物料',
      dataIndex: 'material_code',
      width: 140,
      render: value => value || '-',
    },
    {
      title: '来源目录',
      dataIndex: 'source_relative_path',
      width: 280,
      ellipsis: true,
      render: value => value || '-',
    },
    {
      title: '状态',
      key: 'status',
      width: 140,
      render: (_, row) => (
        <Space size={4} wrap>
          <Tag>{row.document_type}</Tag>
          <Tag color={row.status === 'RELEASED' ? 'green' : row.status === 'ARCHIVED' ? 'red' : 'gold'}>
            {row.status}
          </Tag>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'download',
      width: 90,
      render: (_, row) => (
        <Button size="small" type="link" onClick={() => drawingDocumentService.downloadDocument(row)}>
          下载
        </Button>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, minHeight: 'calc(100vh - 64px)', background: '#f5f7fa' }}>
      <Layout style={{ background: 'transparent' }}>
        <Sider
          width={360}
          theme="light"
          style={{
            borderRadius: 12,
            marginRight: 24,
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Title level={5} style={{ margin: 0 }}>
                <FolderOpenOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                BOM 版本列表
              </Title>

              <Space wrap style={{ width: '100%' }}>
                <Select
                  style={{ width: 120 }}
                  placeholder="BOM类型"
                  allowClear
                  value={bomTypeFilter}
                  options={BOM_TYPE_OPTIONS}
                  onChange={value => setBomTypeFilter(value)}
                />
                <Select
                  style={{ width: 140 }}
                  placeholder="来源系统"
                  allowClear
                  value={sourceFilter}
                  options={SOURCE_OPTIONS}
                  onChange={value => setSourceFilter(value)}
                />
              </Space>

              <Space wrap>
                <Button icon={<ReloadOutlined />} onClick={() => refetchHeaders()}>
                  刷新
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateEditor}>
                  新建 BOM
                </Button>
              </Space>
            </Space>
          </div>

          <div style={{ height: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            <List
              loading={isLoadingHeaders}
              dataSource={bomHeaders}
              renderItem={item => (
                <List.Item
                  onClick={() => setSelectedBOMId(item.id)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: selectedBOMId === item.id ? '#e6f4ff' : 'transparent',
                    borderLeft: selectedBOMId === item.id ? '4px solid #1677ff' : '4px solid transparent',
                    transition: 'all 0.3s',
                  }}
                >
                  <List.Item.Meta
                    title={<Text strong>{item.material?.name || item.product_code || '未知物料'}</Text>}
                    description={
                      <Space direction="vertical" size={4}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          编码: {item.material?.code || item.product_code}
                        </Text>
                        <Space wrap size={[4, 4]}>
                          <TagLike color="#1677ff">版本 {item.version}</TagLike>
                          <TagLike color="#722ed1">{item.bom_type || 'EBOM'}</TagLike>
                          {item.source_system ? <TagLike color="#13c2c2">{item.source_system}</TagLike> : null}
                          {item.project_code ? <TagLike color="#fa8c16">{item.project_code}</TagLike> : null}
                        </Space>
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{
                emptyText: <Empty description="暂无 BOM 版本数据" />,
              }}
            />
          </div>
        </Sider>

        <Content>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <Space wrap>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => bomDetail && openEditEditor(bomDetail)}
                  disabled={!bomDetail}
                >
                  层级编辑
                </Button>
                <Upload beforeUpload={handleImport} showUploadList={false} accept=".xlsx,.xlsm">
                  <Button icon={<UploadOutlined />} loading={importLoading}>
                    导入 Excel
                  </Button>
                </Upload>
                <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exportLoading}>
                  导出 Excel
                </Button>
                <Button icon={<CloudSyncOutlined />} onClick={handleMockCadSync} loading={syncMutation.isPending}>
                  模拟 CAD 同步
                </Button>
              </Space>
            </Card>

            <Card
              bordered={false}
              style={{
                borderRadius: 12,
                minHeight: 'calc(100vh - 220px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              }}
              title={
                <Space>
                  <DeploymentUnitOutlined style={{ fontSize: 20, color: '#722ed1' }} />
                  <Title level={4} style={{ margin: 0 }}>
                    BOM 结构与自动同步
                  </Title>
                </Space>
              }
            >
              {!selectedHeader ? (
                <div
                  style={{
                    height: 420,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: '#fafafa',
                    borderRadius: 8,
                    border: '1px dashed #d9d9d9',
                  }}
                >
                  <Empty description={<Text type="secondary">请先选择一个 BOM 版本</Text>} />
                </div>
              ) : isLoadingDetail || isLoadingTree ? (
                <div style={{ textAlign: 'center', padding: 80 }}>
                  <Spin size="large" tip="正在加载 BOM 结构..." />
                </div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <Card size="small" style={{ background: '#fafcff' }}>
                    <Descriptions column={3} size="small">
                      <Descriptions.Item label="产品">{bomDetail?.material?.name || selectedHeader.product_code}</Descriptions.Item>
                      <Descriptions.Item label="版本">{selectedHeader.version}</Descriptions.Item>
                      <Descriptions.Item label="状态">
                        <Badge status={selectedHeader.is_active ? 'success' : 'default'} text={selectedHeader.status || 'DRAFT'} />
                      </Descriptions.Item>
                      <Descriptions.Item label="产品族">{selectedHeader.product_family || '-'}</Descriptions.Item>
                      <Descriptions.Item label="事业部">{selectedHeader.business_unit || '-'}</Descriptions.Item>
                      <Descriptions.Item label="项目号">{selectedHeader.project_code || '-'}</Descriptions.Item>
                      <Descriptions.Item label="工厂">{selectedHeader.plant_code || '-'}</Descriptions.Item>
                      <Descriptions.Item label="专业/维度">{selectedHeader.discipline || '-'}</Descriptions.Item>
                      <Descriptions.Item label="CAD文档">{selectedHeader.cad_document_no || '-'}</Descriptions.Item>
                    </Descriptions>

                    <Space wrap style={{ marginTop: 12 }}>
                      <Statistic title="明细数量" value={bomDetail?.statistics.item_count || 0} />
                      <Statistic title="叶子件数" value={bomDetail?.statistics.leaf_count || 0} />
                      <Statistic title="预计总成本" value={bomDetail?.statistics.estimated_total_cost || 0} precision={2} />
                    </Space>
                  </Card>

                  <Alert
                    type="info"
                    showIcon
                    message="CAD / SolidWorks 自动同步接口已预留"
                    description={
                      <div>
                        <Paragraph style={{ marginBottom: 8 }}>
                          设计人员保存装配图后，外部插件或中间服务可直接调用 <Text code>POST /api/plm/boms/cad-sync</Text>，
                          按产品编码、版本、BOM 类型自动覆盖更新，无需人工二次录入。
                        </Paragraph>
                        <Text type="secondary">
                          建议后续接入 SolidWorks API 或 PDM 事件，以“图纸保存事件 + JSON 推送”的方式形成自动同步闭环。
                        </Text>
                      </div>
                    }
                  />

                  <Card
                    size="small"
                    title="关联图纸资料"
                    extra={
                      selectedBOMId ? (
                        <Button size="small" onClick={() => (window.location.href = `/manufacturing/drawings?bom_id=${selectedBOMId}`)}>
                          打开资料库
                        </Button>
                      ) : null
                    }
                  >
                    <Space wrap style={{ marginBottom: 12 }}>
                      <Statistic title="关联图纸数" value={linkedDrawings.length} />
                    </Space>
                    <List
                      loading={isLoadingDrawings}
                      dataSource={linkedDrawings.slice(0, 6)}
                      locale={{ emptyText: <Empty description="当前 BOM 暂无关联图纸" /> }}
                      renderItem={(drawing: DrawingDocument) => (
                        <List.Item
                          actions={[
                            <Button
                              key="download"
                              size="small"
                              icon={<DownloadOutlined />}
                              onClick={() => drawingDocumentService.downloadDocument(drawing)}
                            >
                              下载
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            title={
                              <Space wrap>
                                <Text strong>{drawing.document_number}</Text>
                                <Tag color="blue">{drawing.document_type}</Tag>
                                {drawing.revision ? <Tag>{drawing.revision}</Tag> : null}
                              </Space>
                            }
                            description={
                              <Space direction="vertical" size={2}>
                                <Text>{drawing.document_name}</Text>
                                <Text type="secondary">
                                  物料 {drawing.material_code || '-'} / 产品 {drawing.product_code || '-'}
                                </Text>
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </Card>

                  <Card
                    size="small"
                    title="BOM 明细行图纸映射"
                    extra={
                      <Space size={16}>
                        <Text type="secondary">已映射 {bomDetail?.items.filter(item => !!item.drawing_document_id).length || 0} 条</Text>
                        <Text type="secondary">
                          未映射 {(bomDetail?.items.length || 0) - (bomDetail?.items.filter(item => !!item.drawing_document_id).length || 0)} 条
                        </Text>
                      </Space>
                    }
                  >
                    <Table
                      rowKey={row => String(row.id || `${row.child_item_code}-${row.find_number || row.item_level}`)}
                      size="small"
                      columns={drawingMappingColumns}
                      dataSource={bomDetail?.items || []}
                      pagination={{ pageSize: 8, hideOnSinglePage: true }}
                      scroll={{ x: 1350 }}
                      locale={{ emptyText: <Empty description="当前 BOM 暂无明细行" /> }}
                    />
                  </Card>

                  <Card size="small" title="BOM 层级结构">
                    <Tree
                      showIcon
                      defaultExpandAll
                      treeData={treeData}
                      switcherIcon={<ApartmentOutlined style={{ fontSize: 16 }} />}
                      style={{ fontSize: 15, padding: 8, background: '#fff' }}
                    />
                  </Card>
                </Space>
              )}
            </Card>
          </Space>
        </Content>
      </Layout>

      <Modal
        title={editorMode === 'edit' ? '层级编辑 BOM' : '新建 BOM'}
        open={editorVisible}
        onCancel={() => setEditorVisible(false)}
        onOk={handleSave}
        width={1500}
        zIndex={1200}
        okText="保存 BOM"
        confirmLoading={saveMutation.isPending}
        destroyOnClose
      >
        <Form form={editorForm} layout="vertical">
          <Space wrap style={{ width: '100%' }} size={12}>
            <Form.Item name="product_code" label="产品编码" rules={[{ required: true, message: '请输入产品编码' }]}>
              <Input style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="product_name" label="产品名称" rules={[{ required: true, message: '请输入产品名称' }]}>
              <Input style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="version" label="版本" rules={[{ required: true, message: '请输入版本号' }]}>
              <Input style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="bom_type" label="BOM类型" rules={[{ required: true, message: '请选择 BOM 类型' }]}>
              <Select style={{ width: 120 }} options={BOM_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item name="status" label="状态" rules={[{ required: true, message: '请输入状态' }]}>
              <Input style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="is_active" label="当前生效版本" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
            <Form.Item name="source_system" label="来源系统">
              <Select style={{ width: 160 }} options={SOURCE_OPTIONS} />
            </Form.Item>
            <Form.Item name="project_code" label="项目号">
              <Input style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="plant_code" label="工厂">
              <Input style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="discipline" label="专业/维度">
              <Input style={{ width: 160 }} />
            </Form.Item>
          </Space>

          <Space wrap style={{ width: '100%' }} size={12}>
            <Form.Item name="product_family" label="产品族">
              <Input style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="business_unit" label="事业部">
              <Input style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="cad_document_no" label="CAD文档号">
              <Input style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="source_file" label="来源文件">
              <Input style={{ width: 260 }} />
            </Form.Item>
          </Space>

          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>

        <Card
          size="small"
          title="BOM 层级明细"
          extra={
            <Space>
              <Button size="small" onClick={() => handleAddSibling()}>
                新增顶级行
              </Button>
              <Text type="secondary">根节点产品编码：{productCodeInEditor || '-'}</Text>
            </Space>
          }
        >
          <Table
            rowKey="localKey"
            size="small"
            columns={editorColumns}
            dataSource={editorTreeRows}
            pagination={false}
            scroll={{ x: 1600, y: 420 }}
            expandable={{ defaultExpandAllRows: true }}
          />
        </Card>
      </Modal>

      <Modal
        title="BOM 明细行图纸映射"
        open={mappingVisible}
        onCancel={closeDrawingMapping}
        onOk={handleSaveDrawingMapping}
        okText={selectedDrawingId ? '保存映射' : '清空映射'}
        confirmLoading={saveDrawingMappingMutation.isPending}
        width={1180}
        destroyOnClose
      >
        {mappingTarget ? (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Card size="small">
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="BOM 明细行">
                  {mappingTarget.find_number || '-'} / {mappingTarget.child_item_code}
                </Descriptions.Item>
                <Descriptions.Item label="物料名称">{mappingTarget.material?.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="物料图号">{mappingTarget.material?.drawing_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="当前映射">
                  {mappingTarget.drawing_document
                    ? `${mappingTarget.drawing_document.document_number} (${getDrawingVersionLabel(
                        mappingTarget.drawing_document.version,
                        mappingTarget.drawing_document.revision
                      )})`
                    : '未映射'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
              <Input
                allowClear
                value={mappingSearch}
                onChange={event => setMappingSearch(event.target.value)}
                placeholder="按图号、名称或目录搜索候选图纸"
                style={{ width: 360 }}
              />
              <Radio checked={selectedDrawingId === null} onChange={() => setSelectedDrawingId(null)}>
                清空当前映射
              </Radio>
            </Space>

            {mappingValidation ? (
              <Alert
                showIcon
                type={getDrawingValidationAlertType(mappingValidation.validation_status)}
                message={mappingValidation.message}
                description={
                  <Space direction="vertical" size={4}>
                    {mappingValidation.current_document ? (
                      <Text type="secondary">
                        当前图纸: {mappingValidation.current_document.document_number} /{' '}
                        {getDrawingVersionLabel(
                          mappingValidation.current_document.version,
                          mappingValidation.current_document.revision
                        )}
                      </Text>
                    ) : null}
                    {mappingValidation.candidate_document ? (
                      <Text type="secondary">
                        候选图纸: {mappingValidation.candidate_document.document_number} /{' '}
                        {getDrawingVersionLabel(
                          mappingValidation.candidate_document.version,
                          mappingValidation.candidate_document.revision
                        )}
                      </Text>
                    ) : null}
                    {mappingValidation.warnings.length > 0 ? (
                      <Text type="warning">提示: {mappingValidation.warnings.join('；')}</Text>
                    ) : null}
                    {mappingValidation.errors.length > 0 ? (
                      <Text type="danger">错误: {mappingValidation.errors.join('；')}</Text>
                    ) : null}
                  </Space>
                }
              />
            ) : null}

            <Table
              rowKey="id"
              size="small"
              loading={isLoadingMappingCandidates}
              columns={mappingCandidateColumns}
              dataSource={mappingCandidateDocuments}
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              scroll={{ x: 1350, y: 420 }}
              locale={{
                emptyText: (
                  <Empty
                    description={
                      mappingSearch ? '未找到匹配图纸，请调整搜索条件' : '未找到候选图纸，请先批量导入或手工上传图纸'
                    }
                  />
                ),
              }}
              onRow={record => ({
                onClick: () => setSelectedDrawingId(record.id),
              })}
            />
          </Space>
        ) : null}
      </Modal>
    </div>
  )
}

const TagLike: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0 8px',
      height: 22,
      borderRadius: 999,
      background: `${color}14`,
      color,
      fontSize: 12,
    }}
  >
    {children}
  </span>
)

export default BOMStructure
