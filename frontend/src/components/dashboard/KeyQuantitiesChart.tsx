import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from 'recharts'
import { VolumeControlSummaryItem } from '../../services/volumeControlServiceV2'

/** 按数据类型配色 */
export const CATEGORY_COLORS: Record<string, string> = {
  estimated_total: '#0ea5e9',
  drawing_approved_afc: '#f43f5e',
  material_arrived: '#10b981',
  available_workface: '#f59e0b',
  construction_completed: '#8b5cf6',
  not_installed: '#64748b',
  rfi_completed_a: '#06b6d4',
  rfi_completed_b: '#ec4899',
  rfi_completed_c: '#84cc16',
  asbuilt_signed_r0: '#6366f1',
  asbuilt_signed_r1: '#14b8a6',
  obp_signed: '#e11d48',
}

export interface ChartDataRow {
  key: string
  name: string
  value: number
}

export function buildKeyQuantitiesChartData(items: VolumeControlSummaryItem[]): ChartDataRow[] {
  if (!items || items.length === 0) return []

  let estimatedTotal = 0
  let drawingApprovedAfc = 0
  let materialArrived = 0
  let availableWorkface = 0
  let constructionCompleted = 0
  let rfiA = 0
  let rfiB = 0
  let rfiC = 0
  let asbuiltR0 = 0
  let asbuiltR1 = 0
  let obpSigned = 0

  for (const item of items) {
    estimatedTotal += item.estimated_total ?? 0
    drawingApprovedAfc += item.drawing_approved_afc ?? 0
    materialArrived += item.material_arrived ?? 0
    availableWorkface += item.available_workface ?? 0
    constructionCompleted += item.construction_completed ?? 0
    rfiA += item.rfi_completed_a ?? 0
    rfiB += item.rfi_completed_b ?? 0
    rfiC += item.rfi_completed_c ?? 0
    asbuiltR0 += item.asbuilt_signed_r0 ?? 0
    asbuiltR1 += item.asbuilt_signed_r1 ?? 0
    obpSigned += item.obp_signed ?? 0
  }

  const notInstalled = Math.max(0, estimatedTotal - constructionCompleted)

  return [
    { key: 'estimated_total', name: '设计量\nENG Total', value: estimatedTotal },
    { key: 'drawing_approved_afc', name: '图算量\nAFC Total', value: drawingApprovedAfc },
    { key: 'material_arrived', name: '材料到货量\nMaterial Arrival', value: materialArrived },
    { key: 'available_workface', name: '工作面\nWork Front', value: availableWorkface },
    { key: 'construction_completed', name: '施工量\nCIW Completed', value: constructionCompleted },
    { key: 'not_installed', name: '未施工\nNot Installed', value: notInstalled },
    { key: 'rfi_completed_a', name: '验收量 (A)\nInspection A', value: rfiA },
    { key: 'rfi_completed_b', name: '验收量 (B)\nInspection B', value: rfiB },
    { key: 'rfi_completed_c', name: '验收量 (C)\nInspection C', value: rfiC },
    { key: 'asbuilt_signed_r0', name: '竣工资料签署量 (R0)\nABD R0', value: asbuiltR0 },
    { key: 'asbuilt_signed_r1', name: '竣工资料签署量 (R1)\nABD R1', value: asbuiltR1 },
    { key: 'obp_signed', name: 'OBP签署量\nOVR Qty', value: obpSigned },
  ]
}

/** 按 group 连接 rfi 描述（CS01/CS02 等对应不同 rfi 编号） */
export function buildRfiNamesConcat(items: VolumeControlSummaryItem[]) {
  if (!items || items.length === 0) return null
  const joinRfi = (getter: (i: VolumeControlSummaryItem) => string | null | undefined) => {
    return items
      .filter((i) => getter(i))
      .map((i) => `${i.group_name}: ${getter(i) || '—'}`)
      .join(' | ') || '—'
  }
  return {
    rfi_a: joinRfi((i) => i.rfi_a_name),
    rfi_b: joinRfi((i) => i.rfi_b_name),
    rfi_c: joinRfi((i) => i.rfi_c_name),
  }
}

function CustomAxisTick(props: { x?: number; y?: number; payload?: { value: string }; fill?: string }) {
  const { x = 0, y = 0, payload, fill = '#94a3b8' } = props
  const parts = (payload?.value ?? '').split('\n')
  const lineHeight = 12

  return (
    <g transform={`translate(${x},${(y ?? 0) + 10})`}>
      <text x={0} y={0} textAnchor="middle" fill={fill} fontSize={11} fontFamily="system-ui">
        {parts.map((t, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 0 : lineHeight}>
            {t}
          </tspan>
        ))}
      </text>
    </g>
  )
}

interface KeyQuantitiesChartProps {
  items: VolumeControlSummaryItem[]
  height?: number | string
  compact?: boolean
  /** 浅色背景模式（如 VolumeControlList），适配浅色轴/字体 */
  lightBg?: boolean
}

export default function KeyQuantitiesChart({ items, height = 460, compact = false, lightBg = false }: KeyQuantitiesChartProps) {
  const chartData = buildKeyQuantitiesChartData(items)
  const estimatedTotal = chartData[0]?.value ?? 0
  const yAxisDomain: [number, number] = [
    0,
    Math.max(...chartData.map((d) => d.value || 0), 60000),
  ]

  const axisColor = lightBg ? '#64748b' : '#94a3b8'
  const gridStroke = lightBg ? 'rgba(100, 116, 139, 0.2)' : 'rgba(148, 163, 184, 0.15)'
  const tooltipStyle = lightBg
    ? {
        background: 'rgba(255, 255, 255, 0.98)',
        border: '1px solid rgba(148, 163, 184, 0.3)',
        borderRadius: 8,
        color: '#1e293b',
        fontSize: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }
    : {
        background: 'rgba(30, 41, 59, 0.95)',
        border: '1px solid rgba(148, 163, 184, 0.3)',
        borderRadius: 8,
        color: '#e2e8f0',
        fontSize: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 12, right: 24, left: 16, bottom: compact ? 0 : 10 }}
          barCategoryGap="15%"
          barGap={8}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis
            dataKey="name"
            tick={<CustomAxisTick fill={axisColor} />}
            height={compact ? 45 : 65}
            interval={0}
            axisLine={{ stroke: lightBg ? 'rgba(100, 116, 139, 0.4)' : 'rgba(148, 163, 184, 0.3)' }}
            tickLine={{ stroke: lightBg ? 'rgba(100, 116, 139, 0.3)' : 'rgba(148, 163, 184, 0.2)' }}
          />
          <YAxis
            domain={yAxisDomain}
            tick={{ fontSize: 11, fill: axisColor, fontFamily: 'system-ui' }}
            axisLine={{ stroke: lightBg ? 'rgba(100, 116, 139, 0.4)' : 'rgba(148, 163, 184, 0.3)' }}
            tickLine={{ stroke: lightBg ? 'rgba(100, 116, 139, 0.3)' : 'rgba(148, 163, 184, 0.2)' }}
            tickFormatter={(v) => v.toLocaleString()}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: lightBg ? 'rgba(148, 163, 184, 0.08)' : 'rgba(255, 255, 255, 0.05)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.[0]) return null
              const entry = payload[0].payload as ChartDataRow
              const val = entry.value
              const gap = entry.key !== 'estimated_total' ? estimatedTotal - val : null
              return (
                <div
                  style={{
                    padding: '10px 14px',
                    minWidth: 180,
                    ...tooltipStyle,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{(label ?? '').replace(/\n/g, ' ')}</div>
                  <div>数值：{val.toLocaleString()}</div>
                  {gap !== null && (
                    <div style={{ marginTop: 6, color: lightBg ? '#64748b' : '#94a3b8', fontSize: 11 }}>
                      对比设计量差距：{(gap >= 0 ? gap : -gap).toLocaleString()}{gap < 0 ? '（超设计量）' : ''}
                    </div>
                  )}
                </div>
              )
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.key} fill={CATEGORY_COLORS[entry.key] ?? '#94a3b8'} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v: number) => (v > 0 ? v.toLocaleString() : '')}
              style={{ fill: lightBg ? '#1e293b' : '#f1f5f9', fontSize: 11, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
