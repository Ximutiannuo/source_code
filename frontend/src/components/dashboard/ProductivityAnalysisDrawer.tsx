import { useState, useEffect, useMemo } from 'react'
import {
  Drawer,
  Tree,
  DatePicker,
  Select,
  Spin,
  Empty,
  Row,
  Col,
  Typography,
  Space,
  Tag,
  Segmented,
  Alert,
} from 'antd'
import {
  LineChartOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  RiseOutlined,
  BranchesOutlined,
  RightOutlined,
} from '@ant-design/icons'
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
} from 'recharts'
import type { TreeProps } from 'antd'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { productivityService, type ProductivityGroupBy } from '../../services/productivityService'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Text } = Typography

interface ProductivityAnalysisDrawerProps {
  open: boolean
  onClose: () => void
}

const DISC_LABELS: Record<string, string> = {
  CI: '土建',
  CS: '钢结构',
  PI: '管道',
  ME: '设备',
  AR: '建筑',
  HV: '暖通',
  EL: '电气',
  IN: '仪表',
  FF: '消防',
  PA: '防腐',
  IS: '保温',
  CO: '辅助',
  PC: '预试车',
}

const DIM_OPTIONS: { value: ProductivityGroupBy; label: string }[] = [
  { value: 'scope', label: '按队伍' },
  { value: 'subproject', label: '按子项目' },
  { value: 'unit', label: '按装置' },
  { value: 'main_block', label: '按主项' },
]

type TreeDataNode = { key: string; title: React.ReactNode; workPackage?: string; resourceIdName?: string; children?: TreeDataNode[] }

/** 从勾选提取参数：优先用 resource_id_name（命中缓存），否则用 work_package */
function getSelectionParams(checkedKeys: React.Key[], treeData: TreeDataNode[]): { resourceIdNames: string[]; workPackages: string[] } {
  const keySet = new Set((checkedKeys || []) as string[])
  const resourceIdNames: string[] = []
  const workPackages: string[] = []

  function walk(nodes: TreeDataNode[]) {
    if (!nodes) return
    for (const n of nodes) {
      if (n.resourceIdName && keySet.has(n.key)) {
        resourceIdNames.push(n.resourceIdName)
        continue
      }
      if (n.workPackage && keySet.has(n.key)) workPackages.push(n.workPackage)
      if (n.children) walk(n.children)
    }
  }
  walk(treeData)
  return { resourceIdNames, workPackages }
}

const StatCard = ({ title, value, unit, icon, color, subValue, subLabel, manpower, manpowerLabel }: {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  subValue?: string | number;
  subLabel?: string;
  manpower?: string | number;
  manpowerLabel?: string;
}) => (
  <div style={{
    background: 'rgba(30, 41, 59, 0.4)',
    border: `1px solid rgba(71, 85, 105, 0.3)`,
    borderRadius: 12,
    padding: '12px 16px',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backdropFilter: 'blur(10px)',
  }}>
    <div style={{
      position: 'absolute',
      right: -8,
      top: -8,
      fontSize: 48,
      opacity: 0.1,
      color: color,
    }}>
      {icon}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <div style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        background: `rgba(${color === '#3b82f6' ? '59, 130, 246' : color === '#10b981' ? '16, 185, 129' : color === '#f59e0b' ? '245, 158, 11' : '167, 139, 250'}, 0.2)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
        fontSize: 12,
      }}>
        {icon}
      </div>
      <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 500 }}>{title}</Text>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>{value}</span>
      {unit && <span style={{ fontSize: 10, color: '#64748b' }}>{unit}</span>}
    </div>
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {subValue && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 10, color: '#64748b' }}>{subLabel}:</Text>
          <Text style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 600 }}>{subValue}</Text>
        </div>
      )}
      {manpower && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 10, color: '#64748b' }}>{manpowerLabel || '投入'}:</Text>
          <Text style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 600 }}>{manpower} H</Text>
        </div>
      )}
    </div>
  </div>
)

export default function ProductivityAnalysisDrawer({ open, onClose }: ProductivityAnalysisDrawerProps) {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs('2025-01-01'),
    dayjs(),
  ])
  const [groupBy, setGroupBy] = useState<ProductivityGroupBy>('scope')
  const [trendMode, setTrendMode] = useState<'overall' | 'by_dim'>('overall') // 总体趋势 | 按分析维度切片
  const [trendMetric, setTrendMetric] = useState<'period' | 'cumulative'>('period') // 周期工效 | 开工累计工效
  const [includeNonprod, setIncludeNonprod] = useState(true) // true=考虑辅助人力，false=不考虑
  const [selectedTrendSeries, setSelectedTrendSeries] = useState<string[]>([])
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([])
  const [treeData, setTreeData] = useState<TreeDataNode[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const { data: treeResp, isLoading: loadingTree } = useQuery({
    queryKey: ['productivity-wp-tree'],
    queryFn: () => productivityService.getWorkPackageTree(),
    enabled: open,
  })

  useEffect(() => {
    if (!treeResp?.tree) return
    const nodes: TreeDataNode[] = []
    let idx = 0
    for (const disc of treeResp.tree) {
      const discLabel = DISC_LABELS[disc.discipline] || disc.discipline
      const discKey = `disc-${disc.discipline}-${idx++}`
      const children: TreeDataNode[] = []
      for (const rsc of disc.children) {
        const wpChildren: TreeDataNode[] = (rsc.work_packages || []).map((wp, i) => ({
          key: `wp-${wp.work_package}-${i}`,
          title: (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span>{wp.work_package}</span>
              {wp.norms > 0 && <Tag color="blue" bordered={false} style={{ fontSize: 10, marginRight: 0 }}>{wp.norms}</Tag>}
            </div>
          ),
          workPackage: wp.work_package,
        }))
        children.push({
          key: `rsc-${disc.discipline}-${rsc.resource_id_name}`,
          title: <span style={{ fontSize: 12, fontWeight: 500 }}>{rsc.resource_id_name}</span>,
          resourceIdName: rsc.resource_id_name,
          children: wpChildren,
        })
      }
      nodes.push({
        key: discKey,
        title: <span style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa' }}>{disc.discipline} <Text type="secondary" style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>{discLabel}</Text></span>,
        children,
      })
    }
    setTreeData(nodes)
  }, [treeResp])

  const selectionParams = getSelectionParams(checkedKeys, treeData)
  const hasSelection = selectionParams.resourceIdNames.length > 0 || selectionParams.workPackages.length > 0

  const { data, isLoading } = useQuery({
    queryKey: ['productivity-analysis', selectionParams, dateRange, groupBy, includeNonprod],
    queryFn: () =>
      productivityService.getAnalysis({
        resourceIdNames: selectionParams.resourceIdNames,
        workPackages: selectionParams.workPackages,
        startDate: dateRange[0]?.format('YYYY-MM-DD'),
        endDate: dateRange[1]?.format('YYYY-MM-DD'),
        groupBy,
        includeIndirect: includeNonprod,
      }),
    enabled: open && hasSelection,
  })

  const trendGroupByForApi = trendMode === 'by_dim' ? groupBy : undefined
  const { data: trendData, isError: trendError, error: trendErr } = useQuery({
    queryKey: ['productivity-trend', selectionParams, dateRange, trendGroupByForApi, includeNonprod],
    queryFn: () =>
      productivityService.getTrend({
        resourceIdNames: selectionParams.resourceIdNames,
        workPackages: selectionParams.workPackages,
        startDate: dateRange[0]?.format('YYYY-MM-DD'),
        endDate: dateRange[1]?.format('YYYY-MM-DD'),
        groupBy: trendGroupByForApi,
        includeIndirect: includeNonprod,
      }),
    enabled: open && hasSelection,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0, // 切换工效算法时强制重新请求，确保返回对应算法数据
  })

  const onCheck: TreeProps['onCheck'] = (keys) => {
    const k = Array.isArray(keys) ? keys : (keys as { checked: React.Key[] }).checked ?? []
    setCheckedKeys(k)
  }

  const summary = data?.summary
  const items = data?.items || []
  const periodKey = includeNonprod ? 'productivity_wp' : 'productivity'
  const cumKey = includeNonprod ? 'cum_productivity_wp' : 'cum_productivity'
  const barData = items.map((r) => ({
    name: (r.dim_val || '—').slice(0, 10),
    周期: Number((r[periodKey] ?? 0).toFixed(4)),
    开累: Number((r[cumKey] ?? 0).toFixed(4)),
    标准: Number.isFinite(r.weighted_norms) ? Number(r.weighted_norms.toFixed(4)) : 0,
  }))

  const lineData = useMemo(() => {
    if (!trendData?.weeks) return []
    const useCum = trendMetric === 'cumulative'
    const seriesSrc = trendData.series && useCum ? trendData.cum_series : trendData.series
    // 后端已根据 include_indirect 将正确值放入 productivity/cum_productivity，直接使用
    const periodKey = useCum ? 'cum_productivity' : 'productivity'
    const periodSrc = (trendData as unknown as Record<string, number[] | undefined>)[periodKey] ?? []
    return trendData.weeks.map((w, i) => {
      const row: any = { week: w }
      if (seriesSrc) {
        seriesSrc.forEach(s => {
          row[s.name] = s.data[i]
        })
      } else {
        row['工效'] = periodSrc[i] ?? 0
      }
      return row
    })
  }, [trendData, trendMetric])

  const trendSeries = useMemo(() => {
    const src = trendData?.series ?? trendData?.cum_series
    if (src) return src.map(s => s.name)
    return ['工效']
  }, [trendData])

  // 当趋势数据变化时，默认选中前5个
  useEffect(() => {
    const src = trendData?.series ?? trendData?.cum_series
    if (trendMode === 'by_dim' && src) {
      setSelectedTrendSeries(src.slice(0, 5).map(s => s.name))
    }
  }, [trendData?.series, trendData?.cum_series, trendMode])

  const filteredTrendSeries = useMemo(() => {
    if (trendMode === 'overall') return ['工效']
    return selectedTrendSeries
  }, [trendMode, selectedTrendSeries])

  return (
    <Drawer
      title={
        <Space style={{ color: '#f8fafc' }}>
          <ThunderboltOutlined style={{ color: '#60a5fa' }} />
          <span style={{ fontSize: 16 }}>工效分析详情</span>
        </Space>
      }
      placement="right"
      width={1300}
      open={open}
      onClose={onClose}
      styles={{
        body: { 
          padding: '20px', 
          background: '#0f172a',
          backgroundImage: 'radial-gradient(at 0% 0%, rgba(30, 58, 138, 0.1) 0, transparent 50%)',
          color: '#e2e8f0' 
        },
        header: { 
          background: 'rgba(15, 23, 42, 0.95)', 
          color: '#f8fafc', 
          borderBottom: '1px solid rgba(71, 85, 105, 0.3)' 
        },
      }}
    >
      <Row gutter={[20, 20]} wrap={false}>
        {/* Left Column: Metrics & Charts */}
        <Col flex="1" style={{ minWidth: 0 }}>
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            {/* Control Bar */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.4)',
              border: '1px solid rgba(71, 85, 105, 0.3)',
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 24
            }}>
              <Space size={24} wrap>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>日期范围</Text>
                  <RangePicker
                    value={dateRange}
                    onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])}
                    size="small"
                    className="productivity-date-picker"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>分析维度</Text>
                  <Select
                    value={groupBy}
                    onChange={setGroupBy}
                    options={DIM_OPTIONS}
                    style={{ width: 140 }}
                    size="small"
                    className="productivity-dim-select"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>工效算法</Text>
                  <Segmented
                    size="small"
                    options={[
                      { value: false, label: '不考虑辅助人力' },
                      { value: true, label: '考虑辅助人力' },
                    ]}
                    value={includeNonprod}
                    onChange={(v) => setIncludeNonprod(v === true)}
                  />
                </div>
              </Space>
              <Space>
                {sidebarCollapsed && (
                  <div 
                    onClick={() => setSidebarCollapsed(false)}
                    style={{ 
                      cursor: 'pointer', 
                      padding: '4px 12px', 
                      background: 'rgba(59, 130, 246, 0.2)', 
                      borderRadius: 6,
                      color: '#60a5fa',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      border: '1px solid rgba(59, 130, 246, 0.3)'
                    }}
                  >
                    <BranchesOutlined /> 展开选择 <RightOutlined style={{ fontSize: 10 }} />
                  </div>
                )}
                {hasSelection && (
                  <>
                    <Tag color="blue" bordered={false}>
                      已选 {selectionParams.resourceIdNames.length > 0
                        ? `${selectionParams.resourceIdNames.length} 个资源`
                        : `${selectionParams.workPackages.length} 个工作包`}
                    </Tag>
                    {data && (
                      <Tag color={data.data_source === 'cache' ? 'green' : 'orange'} bordered={false}>
                        工效分析：{data.data_source === 'cache' ? '预聚合' : '实时查询'}
                      </Tag>
                    )}
                    {trendData && (
                      <Tag color={trendData.data_source === 'cache' ? 'green' : 'orange'} bordered={false}>
                        趋势：{trendData.data_source === 'cache' ? '预聚合' : '实时查询'}
                      </Tag>
                    )}
                  </>
                )}
              </Space>
            </div>

            {!hasSelection ? (
              <div style={{ 
                height: 400, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: 'rgba(30, 41, 59, 0.2)',
                borderRadius: 12,
                border: '1px dashed rgba(71, 85, 105, 0.3)'
              }}>
                <Empty description={<span style={{ color: '#94a3b8' }}>请在右侧选择工作包</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            ) : isLoading ? (
              <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin tip="计算中..." />
              </div>
            ) : (
              <>
                {/* KPIs */}
                {summary && (
                  <Row gutter={[12, 12]}>
                    <Col span={6}>
                      <StatCard 
                        title="周期工效" 
                        value={Number(summary[periodKey]).toFixed(4)} 
                        icon={<ThunderboltOutlined />} 
                        color="#f59e0b"
                        subValue={Number(summary.achieved).toLocaleString()}
                        subLabel="完成量"
                        manpower={Number(summary.manpower).toLocaleString()}
                        manpowerLabel="投入"
                      />
                    </Col>
                    <Col span={6}>
                      <StatCard 
                        title="开累工效" 
                        value={Number(summary[cumKey] ?? 0).toFixed(4)} 
                        icon={<RiseOutlined />} 
                        color="#a78bfa"
                        subValue={Number(summary.cum_achieved ?? 0).toLocaleString()}
                        subLabel="累计量"
                        manpower={Number(summary.cum_manpower ?? 0).toLocaleString()}
                        manpowerLabel="累计投入"
                      />
                    </Col>
                    <Col span={6}>
                      <StatCard 
                        title="标准工效" 
                        value={Number.isFinite(summary.weighted_norms) ? Number(summary.weighted_norms).toFixed(4) : '0.0000'} 
                        icon={<DatabaseOutlined />} 
                        color="#3b82f6"
                        subLabel="基准"
                      />
                    </Col>
                    <Col span={6}>
                      <StatCard 
                        title="人力投入" 
                        value={Number(summary.manpower).toLocaleString()} 
                        unit="H"
                        icon={<ClockCircleOutlined />} 
                        color="#10b981"
                        subValue={Number(summary.cum_manpower ?? 0).toLocaleString()}
                        subLabel="累计"
                      />
                    </Col>
                  </Row>
                )}

                {/* Bar Chart */}
                {items.length > 0 && (
                  <div style={{
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid rgba(71, 85, 105, 0.3)',
                    borderRadius: 12,
                    padding: '16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <BarChartOutlined style={{ color: '#60a5fa' }} />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>各维度对比</span>
                    </div>
                    <div style={{ height: 240 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                          <defs>
                            <linearGradient id="barProd" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.9}/>
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0.3}/>
                            </linearGradient>
                            <linearGradient id="barCum" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                          <XAxis dataKey="name" angle={-30} textAnchor="end" tick={{ fill: '#94a3b8', fontSize: 10 }} height={40} axisLine={false} tickLine={false} />
                          <YAxis 
                            tick={{ fill: '#94a3b8', fontSize: 10 }} 
                            axisLine={false} 
                            tickLine={false} 
                            scale="sqrt"
                            domain={[0, 'auto']}
                          />
                          <Tooltip 
                            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} 
                            itemStyle={{ fontSize: 11 }}
                            formatter={(v: any, name: string) => [Number(v ?? 0).toFixed(4), name || '']}
                          />
                          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} iconType="circle" />
                          <Bar name="周期" dataKey="周期" fill="url(#barProd)" radius={[3, 3, 0, 0]} barSize={20} />
                          <Bar name="开累" dataKey="开累" fill="url(#barCum)" radius={[3, 3, 0, 0]} barSize={20} />
                          <Line name="标准" dataKey="标准" stroke="#22d3ee" strokeWidth={2.5} strokeDasharray="3 3" dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Line Chart */}
                {trendError && hasSelection && (
                  <Alert
                    type="warning"
                    showIcon
                    message="趋势分析曲线加载失败"
                    description={(trendErr as { response?: { status?: number } })?.response?.status === 504
                      ? '请求超时，数据量较大时可能需要更长时间。请尝试缩小日期范围或减少筛选条件后重试。'
                      : (trendErr as Error)?.message || '请稍后重试'}
                    style={{ marginBottom: 16 }}
                  />
                )}
                {lineData.length > 0 && (
                  <div style={{
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid rgba(71, 85, 105, 0.3)',
                    borderRadius: 12,
                    padding: '16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <LineChartOutlined style={{ color: '#a78bfa' }} />
                        <span style={{ fontWeight: 600, fontSize: 13 }}>趋势分析</span>
                      </div>
                      <Space size={12}>
                        {trendMode === 'by_dim' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Text style={{ color: '#64748b', fontSize: 11 }}>
                              选择对比{DIM_OPTIONS.find(o => o.value === groupBy)?.label.replace('按', '').split('(')[0] || '项'}
                            </Text>
                            <Select
                              mode="multiple"
                              maxTagCount="responsive"
                              placeholder="请选择"
                              value={selectedTrendSeries}
                              onChange={setSelectedTrendSeries}
                              options={trendSeries.map(name => ({ label: name, value: name }))}
                              style={{ width: 200 }}
                              size="small"
                              showSearch
                              className="productivity-dim-select"
                            />
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Text style={{ color: '#64748b', fontSize: 11 }}>指标</Text>
                          <Segmented
                            value={trendMetric}
                            onChange={(v) => setTrendMetric(v as 'period' | 'cumulative')}
                            options={[
                              { value: 'period', label: '周期工效' },
                              { value: 'cumulative', label: '开工累计工效' },
                            ]}
                            size="small"
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Text style={{ color: '#64748b', fontSize: 11 }}>趋势分析</Text>
                          <Select
                            value={trendMode}
                            onChange={(v) => {
                              setTrendMode(v)
                              setSelectedTrendSeries([])
                            }}
                            options={[
                              { value: 'overall', label: '总体趋势' },
                              { value: 'by_dim', label: '按分析维度切片' },
                            ]}
                            style={{ width: 140 }}
                            size="small"
                            className="productivity-dim-select"
                          />
                        </div>
                      </Space>
                    </div>
                    <div style={{ height: 240 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={lineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="areaTrend" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                          <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 9 }} angle={-25} textAnchor="end" height={35} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} 
                            itemStyle={{ fontSize: 11 }}
                            formatter={(v: any, name: string) => [Number(v ?? 0).toFixed(4), name || '工效']}
                          />
                          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} iconType="circle" />
                          {trendMode === 'overall' ? (
                            <Area type="monotone" dataKey="工效" fill="url(#areaTrend)" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                          ) : (
                            filteredTrendSeries.map((s: string, idx: number) => (
                            <Line 
                              key={s}
                              type="monotone" 
                              dataKey={s} 
                              stroke={idx === 0 ? '#3b82f6' : idx === 1 ? '#10b981' : idx === 2 ? '#f59e0b' : idx === 3 ? '#a78bfa' : idx === 4 ? '#ec4899' : idx === 5 ? '#06b6d4' : idx === 6 ? '#f43f5e' : idx === 7 ? '#8b5cf6' : '#64748b'} 
                              strokeWidth={2} 
                              activeDot={{ r: 5, strokeWidth: 0 }}
                            />
                          ))
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </>
            )}
          </Space>
        </Col>

        {/* Right Column: Work Package Tree - Now Collapsible and Wider */}
        <Col 
          flex={sidebarCollapsed ? "0 0 0px" : "0 0 450px"} 
          style={{ 
            transition: 'all 0.3s ease', 
            overflow: 'hidden',
            opacity: sidebarCollapsed ? 0 : 1,
            marginLeft: sidebarCollapsed ? -20 : 0
          }}
        >
          <div style={{
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(71, 85, 105, 0.4)',
            borderRadius: 16,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            width: 450,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8)',
          }}>
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Space>
                <BranchesOutlined style={{ color: '#60a5fa' }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>选择工作包</span>
              </Space>
              <div 
                onClick={() => setSidebarCollapsed(true)}
                style={{ cursor: 'pointer', color: '#64748b' }}
              >
                <RightOutlined />
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '10px' }} className="productivity-tree-container">
              {loadingTree ? (
                <div style={{ padding: 40, textAlign: 'center' }}><Spin size="small" /></div>
              ) : (
                <Tree
                  checkable
                  checkedKeys={checkedKeys}
                  onCheck={onCheck}
                  treeData={treeData}
                  blockNode
                  className="productivity-tree"
                  style={{ background: 'transparent', fontSize: 12 }}
                />
              )}
            </div>
          </div>
        </Col>
      </Row>

      <style>{`
        .productivity-date-picker.ant-picker {
          background: rgba(30, 41, 59, 0.6) !important;
          border-color: rgba(71, 85, 105, 0.4) !important;
        }
        .productivity-date-picker.ant-picker .ant-picker-input > input {
          color: #f1f5f9 !important;
        }
        .productivity-date-picker.ant-picker .ant-picker-suffix {
          color: #94a3b8;
        }
        
        .productivity-dim-select.ant-select .ant-select-selector {
          background: rgba(30, 41, 59, 0.6) !important;
          border-color: rgba(71, 85, 105, 0.4) !important;
          color: #f1f5f9 !important;
        }
        
        .productivity-tree.ant-tree {
          color: #f1f5f9 !important;
          background: transparent !important;
        }
        .productivity-tree.ant-tree .ant-tree-node-content-wrapper {
          overflow: hidden;
        }
        .productivity-tree.ant-tree .ant-tree-node-content-wrapper:hover {
          background-color: rgba(59, 130, 246, 0.2) !important;
        }
        .productivity-tree.ant-tree .ant-tree-node-selected {
          background-color: rgba(59, 130, 246, 0.3) !important;
        }
        .productivity-tree.ant-tree .ant-tree-switcher {
          color: #94a3b8 !important;
        }
        .productivity-tree.ant-tree .ant-tree-title {
          width: 100%;
          white-space: nowrap;
          color: #f1f5f9 !important;
        }
        .ant-tree-checkbox-inner {
          background-color: rgba(30, 41, 59, 0.8) !important;
          border-color: rgba(71, 85, 105, 0.5) !important;
        }
        
        /* Custom scrollbar */
        .ant-drawer-body::-webkit-scrollbar,
        .productivity-tree-container::-webkit-scrollbar {
          width: 5px;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(71, 85, 105, 0.4);
          border-radius: 10px;
        }
      `}</style>
    </Drawer>
  )
}
