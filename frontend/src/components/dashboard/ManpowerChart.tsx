import { useQuery } from '@tanstack/react-query'
import { Spin, Empty } from 'antd'
import { useContext } from 'react'
import { GlobalFilterContext } from '../../components/layout/MainLayout'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { dashboardService } from '../../services/dashboardService'

const ManpowerChart = () => {
  const globalFilter = useContext(GlobalFilterContext)
  
  const { data, isLoading } = useQuery({
    queryKey: ['manpower-chart', globalFilter],
    queryFn: async () => {
      return await dashboardService.getManpower()
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
    计划人力: data.planned[index] || 0,
    实际人力: data.actual[index] || 0,
  })) || []

  if (chartData.length === 0) {
    return <Empty description="暂无数据" />
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 15, left: 5, bottom: 50 }}>
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
          tick={{ fontSize: 10, fill: '#64748b' }}
          width={50}
          label={{ value: '人力', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#64748b' } }} 
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
        <Bar dataKey="计划人力" fill="#5470c6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="实际人力" fill="#91cc75" radius={[4, 4, 0, 0]} />
      </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ManpowerChart

