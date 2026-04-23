import { useQuery } from '@tanstack/react-query'
import { Spin, Empty } from 'antd'
import { useContext } from 'react'
import { GlobalFilterContext } from '../../components/layout/MainLayout'
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, ResponsiveContainer, ComposedChart } from 'recharts'
import { dashboardService } from '../../services/dashboardService'

const VolumeCompletionChart = () => {
  const globalFilter = useContext(GlobalFilterContext)
  
  const { data, isLoading } = useQuery({
    queryKey: ['volume-completion', globalFilter],
    queryFn: async () => {
      // 构建查询参数
      const params: any = {}
      
      if (globalFilter.subproject && globalFilter.subproject.length > 0) {
        params.subproject = globalFilter.subproject
      }
      if (globalFilter.train && globalFilter.train.length > 0) {
        params.train = globalFilter.train
      }
      if (globalFilter.unit && globalFilter.unit.length > 0) {
        params.unit = globalFilter.unit
      }
      if (globalFilter.main_block && globalFilter.main_block.length > 0) {
        params.main_block = globalFilter.main_block
      }
      if (globalFilter.block && globalFilter.block.length > 0) {
        params.block = globalFilter.block
      }
      if (globalFilter.quarter && globalFilter.quarter.length > 0) {
        params.quarter = globalFilter.quarter
      }
      if (globalFilter.scope && globalFilter.scope.length > 0) {
        params.scope = globalFilter.scope
      }
      if (globalFilter.date_range && globalFilter.date_range.length === 2) {
        params.start_date = globalFilter.date_range[0].format('YYYY-MM-DD')
        params.end_date = globalFilter.date_range[1].format('YYYY-MM-DD')
      }
      
      return await dashboardService.getVolumeCompletion(Object.keys(params).length > 0 ? params : undefined)
    },
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin />
      </div>
    )
  }

  if (!data) {
    return <Empty description="暂无数据" />
  }

  const chartData = data?.categories?.map((cat, index) => ({
    category: cat,
    总量: data.total[index] || 0,
    完成量: data.completed[index] || 0,
    剩余量: data.remaining[index] || 0,
    完成百分比: data.completion_rate[index] || 0,
  })) || []

  if (chartData.length === 0) {
    return <Empty description="暂无数据" />
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: 5, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis 
          dataKey="category" 
          angle={-45}
          textAnchor="end"
          height={50}
          interval={0}
          tick={{ fontSize: 10, fill: '#64748b' }}
          style={{ fontSize: '10px' }}
        />
        <YAxis 
          yAxisId="left" 
          tick={{ fontSize: 10, fill: '#64748b' }}
          width={50}
          label={{ value: '工程量', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#64748b' } }} 
        />
        <YAxis 
          yAxisId="right" 
          orientation="right" 
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: '#64748b' }}
          width={50}
          label={{ value: '完成率(%)', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: '#64748b' } }}
        />
        <Tooltip 
          contentStyle={{ 
            borderRadius: '8px', 
            border: '1px solid #e2e8f0',
            fontSize: '12px',
          }}
        />
        <Legend 
          wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }}
          iconSize={10}
        />
        <Bar yAxisId="left" dataKey="总量" fill="#91cc75" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="left" dataKey="完成量" fill="#5470c6" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="left" dataKey="剩余量" fill="#fac858" radius={[4, 4, 0, 0]} />
        <Line 
          yAxisId="right" 
          type="monotone" 
          dataKey="完成百分比" 
          stroke="#ee6666" 
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default VolumeCompletionChart

