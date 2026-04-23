import { useState, useContext, useMemo, useEffect } from 'react'
import {
  Select,
  Spin,
  Empty,
  Row,
  Col,
  Typography,
  Space,
  Segmented,
  Alert,
  Tag,
} from 'antd'
import {
  LineChartOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  RiseOutlined,
} from '@ant-design/icons'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
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
import { GlobalFilterContext } from '../components/layout/MainLayout'
import { productivityService, type ProductivityGroupBy } from '../services/productivityService'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const DIM_OPTIONS: { value: ProductivityGroupBy; label: string }[] = [
  { value: 'scope', label: '按队伍' },
  { value: 'subproject', label: '按子项目' },
  { value: 'unit', label: '按装置' },
  { value: 'main_block', label: '按主项' },
]

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
    padding: '16px 20px',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backdropFilter: 'blur(10px)',
  }}>
    <div style={{
      position: 'absolute',
      right: -10,
      top: -10,
      fontSize: 60,
      opacity: 0.1,
      color: color,
    }}>
      {icon}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: `rgba(${color === '#3b82f6' ? '59, 130, 246' : color === '#10b981' ? '16, 185, 129' : color === '#f59e0b' ? '245, 158, 11' : '167, 139, 250'}, 0.2)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
      }}>
        {icon}
      </div>
      <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>{title}</Text>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>{value}</span>
      {unit && <span style={{ fontSize: 12, color: '#64748b' }}>{unit}</span>}
    </div>
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {subValue && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <Text style={{ fontSize: 11, color: '#64748b' }}>{subLabel}:</Text>
          <Text style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>{subValue}</Text>
        </div>
      )}
      {manpower && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <Text style={{ fontSize: 11, color: '#64748b' }}>{manpowerLabel || '投入'}:</Text>
          <Text style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>{manpower} H</Text>
        </div>
      )}
    </div>
  </div>
)

export default function ProductivityAnalysisPage() {
  const globalFilter = useContext(GlobalFilterContext)
  const effectiveDateRange: [dayjs.Dayjs, dayjs.Dayjs] =
    globalFilter?.date_range?.[0] && globalFilter?.date_range?.[1]
      ? [globalFilter.date_range[0], globalFilter.date_range[1]]
      : [dayjs('2025-01-01'), dayjs()]

  const [groupBy, setGroupBy] = useState<ProductivityGroupBy>('scope')
  const [trendMode, setTrendMode] = useState<'overall' | 'by_dim'>('overall') // 总体趋势 | 按分析维度切片
  const [trendMetric, setTrendMetric] = useState<'period' | 'cumulative'>('period') // 周期工效 | 开工累计工效
  const [includeNonprod, setIncludeNonprod] = useState(true) // true=考虑辅助人力，false=不考虑
  const [selectedTrendSeries, setSelectedTrendSeries] = useState<string[]>([])

  const startDate = effectiveDateRange[0]?.format('YYYY-MM-DD')
  const endDate = effectiveDateRange[1]?.format('YYYY-MM-DD')

  // 判断是否有任何有效的筛选条件（不包括日期，因为日期总是有默认值）
  const hasFilter = useMemo(() => {
    if (!globalFilter) return false
    const { date_range, ...filters } = globalFilter
    return Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : !!v)
  }, [globalFilter])

  const { data, isLoading } = useQuery({
    queryKey: ['productivity-analysis', startDate, endDate, groupBy, globalFilter, includeNonprod],
    queryFn: () =>
      productivityService.getAnalysis({
        workPackages: [],
        startDate,
        endDate,
        groupBy,
        globalFilter,
        includeIndirect: includeNonprod,
      }),
    enabled: hasFilter,
  })

  const trendGroupByForApi = trendMode === 'by_dim' ? groupBy : undefined
  const { data: trendData, isError: trendError, error: trendErr } = useQuery({
    queryKey: ['productivity-trend', startDate, endDate, globalFilter, trendGroupByForApi, includeNonprod],
    queryFn: () =>
      productivityService.getTrend({
        workPackages: [],
        startDate,
        endDate,
        globalFilter,
        groupBy: trendGroupByForApi,
        includeIndirect: includeNonprod,
      }),
    enabled: hasFilter,
    placeholderData: keepPreviousData,
    staleTime: 0, // 切换工效算法时强制重新请求
  })

  const summary = data?.summary
  const items = data?.items || []
  const periodKey = includeNonprod ? 'productivity_wp' : 'productivity'
  const cumKey = includeNonprod ? 'cum_productivity_wp' : 'cum_productivity'
  const barData = items.map((r) => ({
    name: r.dim_val || '—',
    周期工效: Number(Number(r[periodKey as keyof typeof r] ?? 0).toFixed(4)),
    开累工效: Number(Number(r[cumKey as keyof typeof r] ?? 0).toFixed(4)),
    标准工效: Number.isFinite(r.weighted_norms) ? Number(r.weighted_norms.toFixed(4)) : 0,
  }))

  const lineData = useMemo(() => {
    if (!trendData?.weeks) return []
    const useCum = trendMetric === 'cumulative'
    // 后端已根据 include_indirect 返回正确的 productivity/cum_productivity
    const periodKey = useCum ? 'cum_productivity' : 'productivity'
    const src = trendData.series && useCum ? trendData.cum_series : trendData.series
    const arr = (trendData as unknown as Record<string, number[] | undefined>)[periodKey]
    return trendData.weeks.map((w, i) => {
      const row: Record<string, unknown> = { week: w }
      if (src) {
        src.forEach((s) => {
          row[s.name] = s.data[i]
        })
      } else {
        row['工效'] = arr?.[i] ?? 0
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
    <div
      style={{
        padding: '24px',
        background: '#0f172a',
        backgroundImage: 'radial-gradient(at 0% 0%, rgba(30, 58, 138, 0.15) 0, transparent 50%), radial-gradient(at 100% 100%, rgba(30, 58, 138, 0.1) 0, transparent 50%)',
        minHeight: '100%',
        color: '#e2e8f0',
      }}
    >
      <Row gutter={[24, 24]}>
        {/* Header Section */}
        <Col span={24}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            marginBottom: 12,
            background: 'rgba(30, 41, 59, 0.3)',
            padding: '12px 20px',
            borderRadius: 12,
            border: '1px solid rgba(71, 85, 105, 0.2)'
          }}>
            <Space size={24} wrap>
              <Title level={4} style={{ color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
                <ThunderboltOutlined style={{ color: '#60a5fa' }} />
                工效分析
              </Title>
              <Text type="secondary" style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                周期: {startDate} 至 {endDate}
              </Text>
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
            </Space>

            <Space size={24} wrap>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Text style={{ color: '#94a3b8', fontSize: 13, whiteSpace: 'nowrap' }}>工效算法</Text>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Text style={{ color: '#94a3b8', fontSize: 13, whiteSpace: 'nowrap' }}>展示维度</Text>
                <Select
                  value={groupBy}
                  onChange={setGroupBy}
                  options={DIM_OPTIONS}
                  style={{ width: 130 }}
                  size="small"
                  className="productivity-dim-select"
                  variant="filled"
                />
              </div>
            </Space>
          </div>
        </Col>

        {/* Main Content Area */}
        <Col span={24}>
          {!hasFilter ? (
            <div style={{ 
              height: 500, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: 'rgba(30, 41, 59, 0.2)',
              borderRadius: 16,
              border: '1px dashed rgba(71, 85, 105, 0.3)'
            }}>
              <Empty 
                description={<span style={{ color: '#94a3b8' }}>请在顶部 GlobalFilter 中选择任意维度以开始分析</span>} 
                image={Empty.PRESENTED_IMAGE_SIMPLE} 
              />
            </div>
          ) : isLoading ? (
            <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin tip="正在分析计算中..." size="large" />
            </div>
          ) : (
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              {/* Summary KPIs */}
              {summary && (
                <Row gutter={[16, 16]}>
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
                      subLabel="加权平均"
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
                      subLabel="累计投入"
                    />
                  </Col>
                </Row>
              )}

              {/* Charts Section */}
              <Row gutter={[24, 24]}>
                {items.length > 0 && (
                  <Col span={24}>
                    <div style={{
                      background: 'rgba(30, 41, 59, 0.4)',
                      border: '1px solid rgba(71, 85, 105, 0.3)',
                      borderRadius: 16,
                      padding: '24px',
                      backdropFilter: 'blur(10px)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <BarChartOutlined style={{ color: '#60a5fa', fontSize: 18 }} />
                        <Title level={5} style={{ color: '#f1f5f9', margin: 0 }}>工效维度对比</Title>
                      </div>
                      <div style={{ height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={barData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                            <defs>
                              <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.9}/>
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0.3}/>
                              </linearGradient>
                              <linearGradient id="colorCum" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis 
                              dataKey="name" 
                              tick={{ fill: '#94a3b8', fontSize: 11 }} 
                              axisLine={{ stroke: '#475569' }}
                              tickLine={false}
                            />
                            <YAxis 
                              tick={{ fill: '#94a3b8', fontSize: 11 }} 
                              axisLine={false}
                              tickLine={false}
                              scale="sqrt"
                              domain={[0, 'auto']}
                            />
                            <Tooltip
                              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                              itemStyle={{ fontSize: 12 }}
                              cursor={{ fill: 'rgba(71, 85, 105, 0.2)' }}
                              formatter={(v: number, name: string) => [Number(v ?? 0).toFixed(4), name || '']}
                            />
                            <Legend 
                              wrapperStyle={{ paddingTop: 20, fontSize: 12 }} 
                              iconType="circle"
                            />
                            <Bar name="周期工效" dataKey="周期工效" fill="url(#colorProd)" radius={[4, 4, 0, 0]} barSize={30} />
                            <Bar name="开累工效" dataKey="开累工效" fill="url(#colorCum)" radius={[4, 4, 0, 0]} barSize={30} />
                            <Line name="标准工效" dataKey="标准工效" stroke="#22d3ee" strokeWidth={3} strokeDasharray="3 3" dot={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </Col>
                )}

                {trendError && hasFilter && (
                  <Col span={24}>
                    <Alert
                      type="warning"
                      showIcon
                      message="趋势分析曲线加载失败"
                      description={(trendErr as { response?: { status?: number } })?.response?.status === 504
                        ? '请求超时，数据量较大时可能需要更长时间。请尝试缩小日期范围或减少筛选条件后重试。'
                        : (trendErr as Error)?.message || '请稍后重试'}
                    />
                  </Col>
                )}
                {lineData.length > 0 && (
                  <Col span={24}>
                    <div style={{
                      background: 'rgba(30, 41, 59, 0.4)',
                      border: '1px solid rgba(71, 85, 105, 0.3)',
                      borderRadius: 16,
                      padding: '24px',
                      backdropFilter: 'blur(10px)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <LineChartOutlined style={{ color: '#a78bfa', fontSize: 18 }} />
                          <Title level={5} style={{ color: '#f1f5f9', margin: 0 }}>工效趋势分析</Title>
                        </div>
                        <Space size={16} wrap>
                          {trendMode === 'by_dim' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Text style={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>
                                对比{DIM_OPTIONS.find(o => o.value === groupBy)?.label.replace('按', '') || '项'}
                              </Text>
                              <Select
                                mode="multiple"
                                maxTagCount="responsive"
                                placeholder="请选择"
                                value={selectedTrendSeries}
                                onChange={setSelectedTrendSeries}
                                options={trendSeries.map(name => ({ label: name, value: name }))}
                                style={{ width: 220 }}
                                size="small"
                                showSearch
                                className="productivity-dim-select"
                              />
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Text style={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>指标</Text>
                            <Segmented
                              value={trendMetric}
                              onChange={(v) => setTrendMetric(v as 'period' | 'cumulative')}
                              options={[
                                { value: 'period', label: '周期' },
                                { value: 'cumulative', label: '累计' },
                              ]}
                              size="small"
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Text style={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>模式</Text>
                            <Select
                              value={trendMode}
                              onChange={(v) => {
                                setTrendMode(v)
                                setSelectedTrendSeries([])
                              }}
                              options={[
                                { value: 'overall', label: '总体' },
                                { value: 'by_dim', label: '切片' },
                              ]}
                              style={{ width: 100 }}
                              size="small"
                              className="productivity-dim-select"
                              variant="filled"
                            />
                          </div>
                        </Space>
                      </div>
                      <div style={{ height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={lineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis 
                              dataKey="week" 
                              tick={{ fill: '#94a3b8', fontSize: 10 }} 
                              axisLine={{ stroke: '#475569' }}
                              tickLine={false}
                            />
                            <YAxis 
                              tick={{ fill: '#94a3b8', fontSize: 11 }} 
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                              itemStyle={{ fontSize: 12 }}
                              formatter={(v: number, name: string) => [Number(v ?? 0).toFixed(4), name || '']}
                            />
                            <Legend wrapperStyle={{ paddingTop: 20, fontSize: 12 }} iconType="circle" />
                            {trendMode === 'overall' ? (
                              <Area type="monotone" dataKey="工效" fill="url(#lineGradient)" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#0f172a' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                            ) : (
                              filteredTrendSeries.map((s: string, idx: number) => (
                                <Line 
                                  key={s}
                                  type="monotone" 
                                  dataKey={s} 
                                  stroke={idx === 0 ? '#3b82f6' : idx === 1 ? '#10b981' : idx === 2 ? '#f59e0b' : idx === 3 ? '#a78bfa' : idx === 4 ? '#ec4899' : idx === 5 ? '#06b6d4' : idx === 6 ? '#f43f5e' : idx === 7 ? '#8b5cf6' : '#64748b'} 
                                  strokeWidth={2} 
                                  activeDot={{ r: 6, strokeWidth: 0 }} 
                                />
                              ))
                            )}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </Col>
                )}
              </Row>
            </Space>
          )}
        </Col>
      </Row>

      <style>{`
        .productivity-dim-select.ant-select .ant-select-selector {
          background: rgba(30, 41, 59, 0.6) !important;
          border-color: rgba(71, 85, 105, 0.4) !important;
          color: #f1f5f9 !important;
          border-radius: 8px !important;
        }
        .productivity-dim-select.ant-select .ant-select-arrow { color: #94a3b8; }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(71, 85, 105, 0.4);
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(71, 85, 105, 0.6);
        }
      `}</style>
    </div>
  )
}
