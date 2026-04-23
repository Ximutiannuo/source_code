/**
 * 工序逻辑规则配置（四步流程）
 * 第一步：新建装置类型（变电站、管廊、棚式结构、设备框架结构、厂房…）
 * 第二步：选中装置类型 → 左表+右甘特（含所有工作包），点击添加逻辑关系，时间与甘特图联动
 * 第三步：调参设置阈值，实现自定义工期
 * 第四步：分配类型到 faclist，生成逻辑关系表（不写回 activity_summary）
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { facilityTypeService, type FacilityType } from '../services/facilityTypeService'
import {
  processTemplateService,
  type ProcessTemplate,
  type TemplateActivityLink,
  type TemplateActivity,
} from '../services/processTemplateService'
import { facilityService, type Facility } from '../services/facilityService'
import GanttChart, { type GanttTask, type GanttColumn, type TimescaleConfig } from '../components/gantt/GanttChart'

const LINK_TYPES = [
  { value: 'FS', label: 'FS' },
  { value: 'SS', label: 'SS' },
  { value: 'FF', label: 'FF' },
  { value: 'SF', label: 'SF' },
]

const DEFAULT_TIMESCALE: TimescaleConfig = {
  format: 'two',
  primaryType: 'calendar',
  primaryInterval: 'week',
  showOrdinal: true,
  ordinalInterval: 'day',
  zoomLevel: 1,
}

export default function ProcessTemplateConfig() {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)
  const [newTypeName, setNewTypeName] = useState('')
  const [gridWidth, setGridWidth] = useState(400)
  const [timescaleConfig, setTimescaleConfig] = useState<TimescaleConfig>(DEFAULT_TIMESCALE)
  const [linkForm, setLinkForm] = useState({ pred: '', succ: '', linkType: 'FS', lag: '0' })
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [thresholdForm, setThresholdForm] = useState({
    applicable_qty_min: '',
    applicable_qty_max: '',
    min_required_workers: '',
    suggested_min_days: '',
    suggested_max_days: '',
  })
  const [activityDrafts, setActivityDrafts] = useState<Record<number, { planned_duration: string; standard_hours: string; setup_hours: string }>>({})

  const showMsg = useCallback((type: 'ok' | 'err', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }, [])

  // 装置类型列表
  const { data: typesData } = useQuery({
    queryKey: ['facility-types'],
    queryFn: async () => {
      const r = await facilityTypeService.list()
      return r.data
    },
  })
  const facilityTypes: FacilityType[] = typesData ?? []

  // 当前类型的模板
  const { data: templatesData } = useQuery({
    queryKey: ['process-templates-type', selectedTypeId],
    queryFn: async () => {
      const r = await processTemplateService.listTemplatesByFacilityType(selectedTypeId!)
      return r.data
    },
    enabled: !!selectedTypeId,
  })
  const templates: ProcessTemplate[] = templatesData ?? []
  const currentTemplate = templates[0] ?? null

  useEffect(() => {
    if (currentTemplate && step === 3) {
      setThresholdForm({
        applicable_qty_min: currentTemplate.applicable_qty_min != null ? String(currentTemplate.applicable_qty_min) : '',
        applicable_qty_max: currentTemplate.applicable_qty_max != null ? String(currentTemplate.applicable_qty_max) : '',
        min_required_workers: currentTemplate.min_required_workers != null ? String(currentTemplate.min_required_workers) : '',
        suggested_min_days: currentTemplate.suggested_min_days != null ? String(currentTemplate.suggested_min_days) : '',
        suggested_max_days: currentTemplate.suggested_max_days != null ? String(currentTemplate.suggested_max_days) : '',
      })
    }
  }, [currentTemplate?.id, step])

  // 模板工序行
  const { data: activitiesData, refetch: refetchActivities } = useQuery({
    queryKey: ['template-activities', currentTemplate?.id],
    queryFn: async () => {
      const r = await processTemplateService.listTemplateActivities(currentTemplate!.id)
      return r.data
    },
    enabled: !!currentTemplate?.id,
  })
  const templateActivities: TemplateActivity[] = activitiesData ?? []

  useEffect(() => {
    const nextDrafts: Record<number, { planned_duration: string; standard_hours: string; setup_hours: string }> = {}
    templateActivities.forEach(activity => {
      nextDrafts[activity.id] = {
        planned_duration: activity.planned_duration != null ? String(activity.planned_duration) : '1',
        standard_hours: activity.standard_hours != null ? String(activity.standard_hours) : '8',
        setup_hours: activity.setup_hours != null ? String(activity.setup_hours) : '0',
      }
    })
    setActivityDrafts(nextDrafts)
  }, [templateActivities])

  // 逻辑关系
  const { data: linksData, refetch: refetchLinks } = useQuery({
    queryKey: ['template-links', currentTemplate?.id],
    queryFn: async () => {
      const r = await processTemplateService.listTemplateActivityLinks(currentTemplate!.id)
      return r.data
    },
    enabled: !!currentTemplate?.id,
  })
  const links: TemplateActivityLink[] = linksData ?? []

  // 重算日期
  const { data: datesData, refetch: refetchDates } = useQuery({
    queryKey: ['template-recalc-dates', currentTemplate?.id],
    queryFn: async () => {
      const r = await processTemplateService.recalcTemplateDates(currentTemplate!.id)
      return r.data
    },
    enabled: !!currentTemplate?.id && templateActivities.length > 0,
  })
  const datesByKey = datesData?.dates_by_activity_key ?? {}

  // 装置列表（第四步）
  const { data: facilityResp } = useQuery({
    queryKey: ['facilities-list'],
    queryFn: () => facilityService.getFacilities({ limit: 500 }),
  })
  const facilityList = (facilityResp?.items ?? facilityResp) ?? []
  const facilities: Facility[] = Array.isArray(facilityList) ? facilityList : []
  const [relationTable, setRelationTable] = useState<Array<{ predecessor_activity_id: string; successor_activity_id: string; link_type: string; lag_days: number }>>([])

  const createTypeMutation = useMutation({
    mutationFn: (name: string) => facilityTypeService.create({ name }),
    onSuccess: () => {
      showMsg('ok', '装置类型已添加')
      setNewTypeName('')
      queryClient.invalidateQueries({ queryKey: ['facility-types'] })
    },
    onError: (e: any) => showMsg('err', e?.response?.data?.detail || '添加失败'),
  })

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      const res = await processTemplateService.createTemplate({
        facility_type_id: selectedTypeId!,
        name: '装置逻辑模板',
      })
      return res.data
    },
    onSuccess: async (created) => {
      queryClient.invalidateQueries({ queryKey: ['process-templates-type', selectedTypeId] })
      try {
        await processTemplateService.initTemplateFromWorkPackages(created.id)
        queryClient.invalidateQueries({ queryKey: ['template-activities', created.id] })
        queryClient.invalidateQueries({ queryKey: ['template-recalc-dates', created.id] })
        showMsg('ok', '模板已创建，已预加载全部工作包')
      } catch (e: any) {
        showMsg('err', e?.response?.data?.detail || '预加载工作包失败')
      }
    },
    onError: (e: any) => showMsg('err', e?.response?.data?.detail || '创建失败'),
  })

  const didAutoInitRef = useRef<number | null>(null)
  useEffect(() => {
    if (step !== 2 || !currentTemplate?.id || templateActivities.length > 0) return
    if (didAutoInitRef.current === currentTemplate.id) return
    didAutoInitRef.current = currentTemplate.id
    initWorkPackagesMutation.mutate()
  }, [step, currentTemplate?.id, templateActivities.length])

  const initWorkPackagesMutation = useMutation({
    mutationFn: () => processTemplateService.initTemplateFromWorkPackages(currentTemplate!.id),
    onSuccess: () => {
      showMsg('ok', '已预加载全部工作包')
      refetchActivities()
      refetchDates()
      queryClient.invalidateQueries({ queryKey: ['template-activities', currentTemplate?.id] })
    },
    onError: (e: any) => showMsg('err', e?.response?.data?.detail || '预加载失败'),
  })

  const addLinkMutation = useMutation({
    mutationFn: () =>
      processTemplateService.createTemplateActivityLinks(currentTemplate!.id, [
        {
          predecessor_activity_id: linkForm.pred,
          successor_activity_id: linkForm.succ,
          link_type: linkForm.linkType,
          lag_days: parseFloat(linkForm.lag) || 0,
          sort_order: links.length,
        },
      ]),
    onSuccess: () => {
      showMsg('ok', '逻辑关系已添加')
      setLinkForm(prev => ({ ...prev, pred: '', succ: '' }))
      refetchLinks()
      refetchDates()
    },
    onError: (e: any) => showMsg('err', e?.response?.data?.detail || '添加失败'),
  })

  const deleteLinkMutation = useMutation({
    mutationFn: ({ linkId }: { linkId: number }) =>
      processTemplateService.deleteTemplateActivityLink(currentTemplate!.id, linkId),
    onSuccess: () => {
      refetchLinks()
      refetchDates()
    },
  })

  const updateThresholdMutation = useMutation({
    mutationFn: () =>
      processTemplateService.updateTemplate(currentTemplate!.id, {
        name: currentTemplate!.name,
        applicable_qty_min: thresholdForm.applicable_qty_min ? Number(thresholdForm.applicable_qty_min) : undefined,
        applicable_qty_max: thresholdForm.applicable_qty_max ? Number(thresholdForm.applicable_qty_max) : undefined,
        min_required_workers: thresholdForm.min_required_workers ? Number(thresholdForm.min_required_workers) : undefined,
        suggested_min_days: thresholdForm.suggested_min_days ? Number(thresholdForm.suggested_min_days) : undefined,
        suggested_max_days: thresholdForm.suggested_max_days ? Number(thresholdForm.suggested_max_days) : undefined,
      }),
    onSuccess: () => showMsg('ok', '阈值已保存'),
    onError: (e: any) => showMsg('err', e?.response?.data?.detail || '保存失败'),
  })

  const updateActivityMutation = useMutation({
    mutationFn: ({ activityId, body }: { activityId: number; body: { planned_duration?: number; standard_hours?: number; setup_hours?: number } }) =>
      processTemplateService.updateTemplateActivity(currentTemplate!.id, activityId, body),
    onSuccess: async () => {
      showMsg('ok', '工序标准工时已保存')
      await Promise.all([refetchActivities(), refetchDates()])
      queryClient.invalidateQueries({ queryKey: ['template-activities', currentTemplate?.id] })
      queryClient.invalidateQueries({ queryKey: ['template-recalc-dates', currentTemplate?.id] })
    },
    onError: (e: any) => showMsg('err', e?.response?.data?.detail || '保存工序配置失败'),
  })

  const handleAddLink = () => {
    if (!linkForm.pred || !linkForm.succ) {
      showMsg('err', '请选择前驱与后继')
      return
    }
    if (linkForm.pred === linkForm.succ) {
      showMsg('err', '前驱与后继不能相同')
      return
    }
    addLinkMutation.mutate()
  }

  // 甘特图任务（从模板工序 + 重算日期构建）
  const ganttTasks = useMemo<GanttTask[]>(() => {
    return templateActivities.map(a => {
      const d = datesByKey[a.activity_key]
      return {
        id: a.activity_key,
        text: a.label || a.activity_key,
        start_date: d?.start_date_iso ? dayjs(d.start_date_iso) : null,
        end_date: d?.end_date_iso ? dayjs(d.end_date_iso) : null,
        duration: a.planned_duration ?? 1,
        type: 'task',
      }
    })
  }, [templateActivities, datesByKey])

  const ganttColumns: GanttColumn[] = useMemo(
    () => [
      { key: 'id', title: '工作包', width: 140, fixed: 'left' },
      { key: 'text', title: '描述', width: 180 },
      { key: 'duration', title: '工期(天)', width: 80, align: 'right' },
      { key: 'start_date', title: '开始', width: 100 },
      { key: 'end_date', title: '结束', width: 100 },
    ],
    []
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600 }}>工序逻辑规则配置</span>
        {[1, 2, 3, 4].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s as 1 | 2 | 3 | 4)}
            style={{
              padding: '6px 12px',
              background: step === s ? '#2563eb' : '#e2e8f0',
              color: step === s ? '#fff' : '#475569',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {s === 1 && '装置类型'}
            {s === 2 && '左表+甘特'}
            {s === 3 && '调参阈值'}
            {s === 4 && '生成逻辑表'}
          </button>
        ))}
        {message && <span style={{ color: message.type === 'err' ? '#dc2626' : '#16a34a', fontSize: 13 }}>{message.text}</span>}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* 第一步：装置类型 */}
        {step === 1 && (
          <section>
            <h3 style={{ margin: '0 0 12px 0' }}>新建装置类型</h3>
            <p style={{ color: '#64748b', margin: '0 0 12px 0' }}>如：变电站、管廊、棚式结构、设备框架结构、厂房</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={newTypeName}
                onChange={e => setNewTypeName(e.target.value)}
                placeholder="类型名称"
                style={{ width: 200, padding: '8px 10px', border: '1px solid #d9d9d9', borderRadius: 4 }}
              />
              <button
                type="button"
                onClick={() => newTypeName.trim() && createTypeMutation.mutate(newTypeName.trim())}
                disabled={!newTypeName.trim() || createTypeMutation.isPending}
                style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                添加
              </button>
            </div>
            <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 400, background: '#fff', border: '1px solid #e2e8f0' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>名称</th>
                  <th style={{ padding: '8px 10px', width: 80 }}>排序</th>
                </tr>
              </thead>
              <tbody>
                {facilityTypes.map(t => (
                  <tr key={t.id}>
                    <td style={{ padding: '8px 10px' }}>{t.name}</td>
                    <td style={{ padding: '8px 10px' }}>{t.sort_order}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 第二步：选装置类型 → 左表+甘特，点击添加逻辑 */}
        {step === 2 && (
          <section style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400 }}>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label>装置类型：</label>
              <select
                value={selectedTypeId ?? ''}
                onChange={e => setSelectedTypeId(e.target.value ? Number(e.target.value) : null)}
                style={{ minWidth: 180, padding: '6px 10px', border: '1px solid #d9d9d9', borderRadius: 4 }}
              >
                <option value="">请选择</option>
                {facilityTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {selectedTypeId && !currentTemplate && (
                <button
                  type="button"
                  onClick={() => createTemplateMutation.mutate()}
                  disabled={createTemplateMutation.isPending}
                  style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  建立模板
                </button>
              )}
              {currentTemplate && templateActivities.length === 0 && (
                <span style={{ color: '#64748b', fontSize: 13 }}>
                  正在预加载全部工作包…
                </span>
              )}
            </div>
            {currentTemplate && templateActivities.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span>添加逻辑：</span>
                  <select value={linkForm.pred} onChange={e => setLinkForm(f => ({ ...f, pred: e.target.value }))} style={{ width: 140, padding: '4px 8px' }}>
                    <option value="">前驱</option>
                    {templateActivities.map(a => (
                      <option key={a.id} value={a.activity_key}>{a.activity_key}</option>
                    ))}
                  </select>
                  <select value={linkForm.succ} onChange={e => setLinkForm(f => ({ ...f, succ: e.target.value }))} style={{ width: 140, padding: '4px 8px' }}>
                    <option value="">后继</option>
                    {templateActivities.map(a => (
                      <option key={a.id} value={a.activity_key}>{a.activity_key}</option>
                    ))}
                  </select>
                  <select value={linkForm.linkType} onChange={e => setLinkForm(f => ({ ...f, linkType: e.target.value }))} style={{ width: 60, padding: '4px 8px' }}>
                    {LINK_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.value}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={linkForm.lag}
                    onChange={e => setLinkForm(f => ({ ...f, lag: e.target.value }))}
                    placeholder="滞后"
                    style={{ width: 56, padding: '4px 8px' }}
                  />
                  <button type="button" onClick={handleAddLink} disabled={addLinkMutation.isPending} style={{ padding: '4px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    添加关系
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 300, display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden', background: '#fff' }}>
                  <GanttChart
                    tasks={ganttTasks}
                    columns={ganttColumns}
                    gridWidth={gridWidth}
                    onGridWidthChange={setGridWidth}
                    timescaleConfig={timescaleConfig}
                    rowHeight={22}
                    density="compact"
                    onTaskClick={task => setSelectedTaskId(String(task.id))}
                    selectedTaskId={selectedTaskId}
                    onZoomChange={z => setTimescaleConfig(c => ({ ...c, zoomLevel: z }))}
                  />
                </div>
                <div style={{ marginTop: 12 }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>工序标准工时与准备工时</h4>
                  <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#64748b' }}>
                    这里维护模板活动的计划工期、标准工时和准备工时。制造订单从模板自动生成工序时，会优先继承这些参数。
                  </p>
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>工序键</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>描述</th>
                          <th style={{ padding: '6px 8px' }}>计划工期(天)</th>
                          <th style={{ padding: '6px 8px' }}>标准工时(h)</th>
                          <th style={{ padding: '6px 8px' }}>准备工时(h)</th>
                          <th style={{ padding: '6px 8px', width: 80 }}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {templateActivities.map(activity => (
                          <tr key={activity.id}>
                            <td style={{ padding: '6px 8px' }}>{activity.activity_key}</td>
                            <td style={{ padding: '6px 8px' }}>{activity.label || '-'}</td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={activityDrafts[activity.id]?.planned_duration ?? '1'}
                                onChange={e =>
                                  setActivityDrafts(drafts => ({
                                    ...drafts,
                                    [activity.id]: {
                                      planned_duration: e.target.value,
                                      standard_hours: drafts[activity.id]?.standard_hours ?? '8',
                                      setup_hours: drafts[activity.id]?.setup_hours ?? '0',
                                    },
                                  }))
                                }
                                style={{ width: 88, padding: '4px 6px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={activityDrafts[activity.id]?.standard_hours ?? '8'}
                                onChange={e =>
                                  setActivityDrafts(drafts => ({
                                    ...drafts,
                                    [activity.id]: {
                                      planned_duration: drafts[activity.id]?.planned_duration ?? '1',
                                      standard_hours: e.target.value,
                                      setup_hours: drafts[activity.id]?.setup_hours ?? '0',
                                    },
                                  }))
                                }
                                style={{ width: 88, padding: '4px 6px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={activityDrafts[activity.id]?.setup_hours ?? '0'}
                                onChange={e =>
                                  setActivityDrafts(drafts => ({
                                    ...drafts,
                                    [activity.id]: {
                                      planned_duration: drafts[activity.id]?.planned_duration ?? '1',
                                      standard_hours: drafts[activity.id]?.standard_hours ?? '8',
                                      setup_hours: e.target.value,
                                    },
                                  }))
                                }
                                style={{ width: 88, padding: '4px 6px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <button
                                type="button"
                                onClick={() =>
                                  updateActivityMutation.mutate({
                                    activityId: activity.id,
                                    body: {
                                      planned_duration: Number(activityDrafts[activity.id]?.planned_duration || 1),
                                      standard_hours: Number(activityDrafts[activity.id]?.standard_hours || 0),
                                      setup_hours: Number(activityDrafts[activity.id]?.setup_hours || 0),
                                    },
                                  })
                                }
                                disabled={updateActivityMutation.isPending}
                                style={{ padding: '4px 12px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                              >
                                保存
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>已配置逻辑关系</h4>
                  <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%', maxWidth: 600 }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>前驱</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>后继</th>
                        <th style={{ padding: '6px 8px' }}>类型</th>
                        <th style={{ padding: '6px 8px' }}>滞后</th>
                        <th style={{ padding: '6px 8px', width: 60 }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {links.map(l => (
                        <tr key={l.id}>
                          <td style={{ padding: '6px 8px' }}>{l.predecessor_activity_id}</td>
                          <td style={{ padding: '6px 8px' }}>{l.successor_activity_id}</td>
                          <td style={{ padding: '6px 8px' }}>{l.link_type}</td>
                          <td style={{ padding: '6px 8px' }}>{l.lag_days}</td>
                          <td>
                            <button type="button" onClick={() => deleteLinkMutation.mutate({ linkId: l.id })} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>删除</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        {/* 第三步：调参阈值 */}
        {step === 3 && (
          <section>
            <h3 style={{ margin: '0 0 12px 0' }}>调参设置阈值，实现自定义工期</h3>
            <div style={{ marginBottom: 12 }}>
              <label>装置类型：</label>
              <select
                value={selectedTypeId ?? ''}
                onChange={e => setSelectedTypeId(e.target.value ? Number(e.target.value) : null)}
                style={{ minWidth: 180, padding: '6px 10px', marginLeft: 8 }}
              >
                <option value="">请选择</option>
                {facilityTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            {currentTemplate && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 400 }}>
                <div><label>适用预估量下限：</label><input type="number" value={thresholdForm.applicable_qty_min} onChange={e => setThresholdForm(f => ({ ...f, applicable_qty_min: e.target.value }))} style={{ marginLeft: 8, width: 120 }} /></div>
                <div><label>适用预估量上限：</label><input type="number" value={thresholdForm.applicable_qty_max} onChange={e => setThresholdForm(f => ({ ...f, applicable_qty_max: e.target.value }))} style={{ marginLeft: 8, width: 120 }} /></div>
                <div><label>最小人数：</label><input type="number" value={thresholdForm.min_required_workers} onChange={e => setThresholdForm(f => ({ ...f, min_required_workers: e.target.value }))} style={{ marginLeft: 8, width: 120 }} /></div>
                <div><label>建议工期(天) 下限：</label><input type="number" value={thresholdForm.suggested_min_days} onChange={e => setThresholdForm(f => ({ ...f, suggested_min_days: e.target.value }))} style={{ marginLeft: 8, width: 120 }} /></div>
                <div><label>建议工期(天) 上限：</label><input type="number" value={thresholdForm.suggested_max_days} onChange={e => setThresholdForm(f => ({ ...f, suggested_max_days: e.target.value }))} style={{ marginLeft: 8, width: 120 }} /></div>
                <button type="button" onClick={() => updateThresholdMutation.mutate()} disabled={updateThresholdMutation.isPending} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', width: 'fit-content' }}>保存阈值</button>
              </div>
            )}
          </section>
        )}

        {/* 第四步：分配类型到 faclist，生成逻辑关系表 */}
        {step === 4 && (
          <section>
            <h3 style={{ margin: '0 0 12px 0' }}>分配类型到 faclist，生成逻辑关系表</h3>
            <p style={{ color: '#64748b', margin: '0 0 12px 0' }}>为装置分配装置类型后，按类型生成逻辑关系表（前驱-后继-类型-滞后），不写回 activity_summary。参考 j_RLS 宏。</p>
            <h4 style={{ margin: '16px 0 8px 0' }}>分配装置类型到主项清单</h4>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px 0' }}>为每个装置选择装置类型，保存后即可在下方按类型生成逻辑关系表。</p>
            <div style={{ overflowX: 'auto', marginBottom: 24, maxHeight: 220, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 4 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9' }}>
                  <tr>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Block</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Unit</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>装置类型</th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.slice(0, 100).map((f) => (
                    <tr key={f.id}>
                      <td style={{ padding: '6px 8px' }}>{f.block ?? '-'}</td>
                      <td style={{ padding: '6px 8px' }}>{f.unit ?? '-'}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <select
                          value={f.facility_type_id != null ? String(f.facility_type_id) : ''}
                          onChange={async e => {
                            const v = e.target.value ? Number(e.target.value) : null
                            try {
                              await facilityService.updateFacility(f.id, { facility_type_id: v ?? undefined })
                              showMsg('ok', '已更新')
                              queryClient.invalidateQueries({ queryKey: ['facilities-list'] })
                            } catch (err: any) {
                              showMsg('err', err?.response?.data?.detail || '更新失败')
                            }
                          }}
                          style={{ minWidth: 120, padding: '4px 6px' }}
                        >
                          <option value="">未分配</option>
                          {facilityTypes.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {facilities.length > 100 && <p style={{ padding: 8, margin: 0, fontSize: 12, color: '#64748b' }}>仅显示前 100 条，其余请在主项清单管理中维护。</p>}
            </div>
            <h4 style={{ margin: '16px 0 8px 0' }}>生成逻辑关系表</h4>
            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                onClick={async () => {
                  if (!selectedTypeId) {
                    showMsg('err', '请先选择装置类型')
                    return
                  }
                  try {
                    const r = await processTemplateService.generateRelationTable({ facility_type_id: selectedTypeId })
                    setRelationTable(r.data?.relation_table ?? [])
                    showMsg('ok', `已生成 ${(r.data?.relation_table ?? []).length} 条逻辑关系`)
                  } catch (e: any) {
                    showMsg('err', e?.response?.data?.detail || '生成失败')
                  }
                }}
                style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                生成逻辑关系表
              </button>
              <select
                value={selectedTypeId ?? ''}
                onChange={e => setSelectedTypeId(e.target.value ? Number(e.target.value) : null)}
                style={{ marginLeft: 12, minWidth: 160, padding: '6px 10px' }}
              >
                <option value="">选择装置类型</option>
                {facilityTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 700, background: '#fff', border: '1px solid #e2e8f0' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>前驱</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>后继</th>
                  <th style={{ padding: '8px 10px' }}>类型</th>
                  <th style={{ padding: '8px 10px' }}>滞后(天)</th>
                </tr>
              </thead>
              <tbody>
                {relationTable.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: '8px 10px' }}>{row.predecessor_activity_id}</td>
                    <td style={{ padding: '8px 10px' }}>{row.successor_activity_id}</td>
                    <td style={{ padding: '8px 10px' }}>{row.link_type}</td>
                    <td style={{ padding: '8px 10px' }}>{row.lag_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>为每个工位或设施定义类型后，可按指定类型或设施列表重新生成工艺逻辑关系表，用于制造排程联调、模板校核和对外数据交换。</p>
          </section>
        )}
      </div>
    </div>
  )
}
