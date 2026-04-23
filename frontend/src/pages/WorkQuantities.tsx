import { useState } from 'react'
import { 
  Card, 
  Table, 
  Tag, 
  Space, 
  Select, 
  Button, 
  Input, 
  Row, 
  Col,
  Typography,
  Spin,
  Alert
} from 'antd'
import { ReloadOutlined, SearchOutlined, DownloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { summaryService, VolumeSummaryItem } from '../services/summaryService'

const { Option } = Select
const { Text } = Typography

const WorkQuantities = () => {
  const [disciplineFilter, setDisciplineFilter] = useState<string | undefined>()
  const [workPackageFilter, setWorkPackageFilter] = useState<string | undefined>()
  const [searchText, setSearchText] = useState('')

  // 获取工程量汇总数据
  const { data: volumeData, isLoading, refetch } = useQuery({
    queryKey: ['volume-summary', disciplineFilter, workPackageFilter],
    queryFn: () => summaryService.getVolumeSummary({
      discipline: disciplineFilter,
      work_package: workPackageFilter,
    }),
  })

  // 获取唯一的专业列表
  const uniqueDisciplines = Array.from(
    new Set((volumeData || []).map(item => item.discipline).filter(Boolean))
  ).sort()

  // 获取唯一的工作包列表
  const uniqueWorkPackages = Array.from(
    new Set((volumeData || []).map(item => item.work_package).filter(Boolean))
  ).sort()

  // 过滤数据
  const filteredData = (volumeData || []).filter(item => {
    const matchesSearch = !searchText || 
      (item.discipline || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (item.work_package || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (item.discipline_code || '').toLowerCase().includes(searchText.toLowerCase())
    return matchesSearch
  })

  // 按专业分组并排序
  const groupedData = filteredData.reduce((acc, item) => {
    const discipline = item.discipline || '未分类'
    if (!acc[discipline]) {
      acc[discipline] = []
    }
    acc[discipline].push(item)
    return acc
  }, {} as Record<string, VolumeSummaryItem[]>)

  // 构建表格数据（展开所有专业和工作包）
  const tableData: (VolumeSummaryItem & { key: string; isGroup?: boolean; groupName?: string })[] = []
  Object.entries(groupedData).sort().forEach(([discipline, items]) => {
    // 添加专业分组行
    const disciplineCode = items[0]?.discipline_code || ''
    const disciplineTotal = items.reduce((sum, item) => ({
      total_design: sum.total_design + item.total_design,
      cumulative_completed: sum.cumulative_completed + item.cumulative_completed,
    }), { total_design: 0, cumulative_completed: 0 })
    const disciplineCompletionRate = disciplineTotal.total_design > 0 
      ? (disciplineTotal.cumulative_completed / disciplineTotal.total_design * 100) 
      : 0

    tableData.push({
      key: `group-${discipline}`,
      isGroup: true,
      groupName: discipline,
      discipline,
      discipline_code: disciplineCode,
      total_design: disciplineTotal.total_design,
      cumulative_completed: disciplineTotal.cumulative_completed,
      completion_rate: disciplineCompletionRate,
    } as any)

    // 添加该专业下的工作包
    items.sort((a, b) => (a.work_package || '').localeCompare(b.work_package || '')).forEach(item => {
      tableData.push({
        ...item,
        key: `${item.discipline}-${item.work_package}`,
      })
    })
  })

  // 完成率颜色
  const getCompletionRateColor = (rate: number) => {
    if (rate >= 80) return '#52c41a'
    if (rate >= 50) return '#faad14'
    if (rate >= 20) return '#fa8c16'
    return '#ff4d4f'
  }

  // 周计划率颜色
  const getWeeklyPlanRateColor = (rate: number) => {
    if (rate >= 100) return '#52c41a'
    if (rate >= 80) return '#faad14'
    if (rate >= 50) return '#fa8c16'
    return '#ff4d4f'
  }

  const columns = [
    {
      title: '专业与工作包',
      key: 'discipline_workpackage',
      width: 250,
      fixed: 'left' as const,
      render: (_: any, record: any) => {
        if (record.isGroup) {
          return (
            <Space>
              <Text strong style={{ fontSize: 14 }}>
                {record.discipline_code} {record.groupName}
              </Text>
            </Space>
          )
        }
        return (
          <Space>
            <Text style={{ marginLeft: 24 }}>
              {record.work_package || '未分类'}
            </Text>
          </Space>
        )
      },
    },
    {
      title: '设计总量',
      dataIndex: 'total_design',
      width: 120,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) || '0',
    },
    {
      title: '累计完成',
      dataIndex: 'cumulative_completed',
      width: 120,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) || '0',
    },
    {
      title: '完成率%',
      dataIndex: 'completion_rate',
      width: 100,
      align: 'right' as const,
      render: (rate: number) => (
        <Tag 
          color={getCompletionRateColor(rate)}
          style={{ 
            minWidth: 70, 
            textAlign: 'center',
            backgroundColor: rate > 0 ? getCompletionRateColor(rate) : undefined,
            color: rate > 0 ? '#fff' : undefined,
          }}
        >
          {rate.toFixed(2)}%
        </Tag>
      ),
    },
    {
      title: '上周完成',
      dataIndex: 'last_week_completed',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) || '0',
    },
    {
      title: '本周计划',
      dataIndex: 'this_week_planned',
      width: 100,
      align: 'right' as const,
      style: { backgroundColor: '#e6f7ff' },
      render: (value: number) => value?.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) || '0',
    },
    {
      title: '本周完成',
      dataIndex: 'this_week_completed',
      width: 100,
      align: 'right' as const,
      style: { backgroundColor: '#fff7e6' },
      render: (value: number) => value?.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) || '0',
    },
    {
      title: '周计划%',
      dataIndex: 'weekly_plan_rate',
      width: 100,
      align: 'right' as const,
      render: (rate: number) => (
        <Tag 
          color={getWeeklyPlanRateColor(rate)}
          style={{ 
            minWidth: 70, 
            textAlign: 'center',
            backgroundColor: rate > 0 ? getWeeklyPlanRateColor(rate) : undefined,
            color: rate > 0 ? '#fff' : undefined,
          }}
        >
          {rate.toFixed(2)}%
        </Tag>
      ),
    },
    {
      title: '下周计划',
      dataIndex: 'next_week_planned',
      width: 100,
      align: 'right' as const,
      style: { backgroundColor: '#e6f7ff' },
      render: (value: number) => value?.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) || '0',
    },
    {
      title: '本月计划',
      dataIndex: 'this_month_planned',
      width: 100,
      align: 'right' as const,
      style: { backgroundColor: '#e6f7ff' },
      render: (value: number) => value?.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) || '0',
    },
    {
      title: '本月完成',
      dataIndex: 'this_month_completed',
      width: 100,
      align: 'right' as const,
      style: { backgroundColor: '#fff7e6' },
      render: (value: number) => value?.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) || '0',
    },
  ]

  return (
    <div>
      <Card
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          marginBottom: 24,
        }}
        styles={{ body: { padding: '24px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#333' }}>工程量信息汇总</h2>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              刷新
            </Button>
            <Button icon={<DownloadOutlined />}>
              导出
            </Button>
          </Space>
        </div>

        {/* 筛选器 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Input
              placeholder="搜索专业或工作包"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="筛选专业"
              style={{ width: '100%' }}
              allowClear
              value={disciplineFilter}
              onChange={setDisciplineFilter}
            >
              {uniqueDisciplines.map(d => (
                <Option key={d} value={d}>{d}</Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Select
              placeholder="筛选工作包"
              style={{ width: '100%' }}
              allowClear
              value={workPackageFilter}
              onChange={setWorkPackageFilter}
            >
              {uniqueWorkPackages.map(wp => (
                <Option key={wp} value={wp}>{wp}</Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Button 
              onClick={() => {
                setDisciplineFilter(undefined)
                setWorkPackageFilter(undefined)
                setSearchText('')
              }}
            >
              清除筛选
            </Button>
          </Col>
        </Row>

        {/* 数据表格 */}
        <Spin spinning={isLoading}>
          {filteredData.length === 0 && !isLoading ? (
            <Alert message="暂无数据" type="info" />
          ) : (
            <Table
              columns={columns}
              dataSource={tableData}
              pagination={{ 
                pageSize: 50, 
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              scroll={{ x: 1400, y: 600 }}
              rowClassName={(record: any) => 
                record.isGroup ? 'summary-group-row' : 'summary-detail-row'
              }
              size="small"
            />
          )}
        </Spin>
      </Card>

      <style>{`
        .summary-group-row {
          background-color: #f5f5f5 !important;
          font-weight: 600;
        }
        .summary-detail-row {
          background-color: #ffffff;
        }
        .summary-detail-row:hover {
          background-color: #fafafa;
        }
      `}</style>
    </div>
  )
}

export default WorkQuantities
