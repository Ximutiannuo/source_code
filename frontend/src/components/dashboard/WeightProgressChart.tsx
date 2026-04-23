import { useQuery } from '@tanstack/react-query'
import { Spin, Empty, Table } from 'antd'
import { useContext } from 'react'
import { GlobalFilterContext } from '../../components/layout/MainLayout'
import { dashboardService } from '../../services/dashboardService'

const WeightProgressChart = () => {
  const globalFilter = useContext(GlobalFilterContext)
  
  const { data, isLoading } = useQuery({
    queryKey: ['weight-progress', globalFilter],
    queryFn: async () => {
      return await dashboardService.getWeightProgress()
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

  const columns = [
    {
      title: '专业',
      dataIndex: 'code',
      key: 'code',
      width: 70,
      render: (code: string, record: any) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 11 }}>{code}</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>{record.name}</div>
        </div>
      ),
    },
    {
      title: '权重',
      dataIndex: 'weight',
      key: 'weight',
      width: 70,
      align: 'right' as const,
      render: (value: number) => <span style={{ fontSize: 11 }}>{value.toFixed(2)}%</span>,
    },
    {
      title: '本周计划',
      dataIndex: 'this_week_plan',
      key: 'this_week_plan',
      width: 80,
      align: 'right' as const,
      style: { backgroundColor: '#fff7e6' },
      render: (value: number) => <span style={{ fontSize: 11 }}>{value.toFixed(2)}%</span>,
    },
    {
      title: '本周滚动',
      dataIndex: 'this_week_rolling',
      key: 'this_week_rolling',
      width: 80,
      align: 'right' as const,
      style: { backgroundColor: '#fff7e6' },
      render: (value: number) => <span style={{ fontSize: 11 }}>{value.toFixed(2)}%</span>,
    },
    {
      title: '本周实际',
      dataIndex: 'this_week_actual',
      key: 'this_week_actual',
      width: 80,
      align: 'right' as const,
      style: { backgroundColor: '#fff7e6' },
      render: (value: number) => <span style={{ fontSize: 11 }}>{value.toFixed(2)}%</span>,
    },
    {
      title: '累计计划',
      dataIndex: 'cum_plan',
      key: 'cum_plan',
      width: 80,
      align: 'right' as const,
      style: { backgroundColor: '#e6f7ff' },
      render: (value: number) => <span style={{ fontSize: 11 }}>{value.toFixed(2)}%</span>,
    },
    {
      title: '累计滚动',
      dataIndex: 'cum_rolling',
      key: 'cum_rolling',
      width: 80,
      align: 'right' as const,
      style: { backgroundColor: '#e6f7ff' },
      render: (value: number) => <span style={{ fontSize: 11 }}>{value.toFixed(2)}%</span>,
    },
    {
      title: '累计实际',
      dataIndex: 'cum_actual',
      key: 'cum_actual',
      width: 80,
      align: 'right' as const,
      style: { backgroundColor: '#e6f7ff' },
      render: (value: number) => <span style={{ fontSize: 11 }}>{value.toFixed(2)}%</span>,
    },
  ]

  const tableData = [
    ...(data?.disciplines || []).map((item: any, index: number) => ({ ...item, key: `discipline-${item.code || index}` })),
    { ...data?.total, isTotal: true, key: 'total' }
  ]

  return (
    <div style={{ fontSize: '11px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Table
        columns={columns}
        dataSource={tableData}
        rowKey="key"
        pagination={false}
        size="small"
        scroll={{ y: '100%' }}
        rowClassName={(record: any) => record.isTotal ? 'weight-total-row' : ''}
        style={{ flex: 1, minHeight: 0 }}
      />
    </div>
  )
}

export default WeightProgressChart

