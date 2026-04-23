import { useState } from 'react'
import { 
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
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { summaryService, ManpowerSummaryItem } from '../../services/summaryService'
import { formatQuantity } from '../../utils/formatNumber'

const { Option } = Select
const { Text } = Typography

const ManpowerSummaryTable = () => {
  const [disciplineFilter, setDisciplineFilter] = useState<string | undefined>()
  const [workPackageFilter, setWorkPackageFilter] = useState<string | undefined>()
  const [manpowerTypeFilter, setManpowerTypeFilter] = useState<string | undefined>()
  const [searchText, setSearchText] = useState('')

  // 获取人力汇总数据
  const { data: manpowerData, isLoading, refetch } = useQuery({
    queryKey: ['manpower-summary', disciplineFilter, workPackageFilter, manpowerTypeFilter],
    queryFn: () => summaryService.getManpowerSummary({
      discipline: disciplineFilter,
      work_package: workPackageFilter,
    }),
  })

  // 获取唯一的专业列表
  const uniqueDisciplines = Array.from(
    new Set((manpowerData || []).map(item => item.discipline).filter(Boolean))
  ).sort()

  // 获取唯一的工作包列表
  const uniqueWorkPackages = Array.from(
    new Set((manpowerData || []).map(item => item.work_package).filter(Boolean))
  ).sort()

  // 获取唯一的人力类型列表
  const uniqueManpowerTypes = Array.from(
    new Set((manpowerData || []).map(item => item.manpower_type).filter(Boolean))
  ).sort()

  // 过滤数据
  const filteredData = (manpowerData || []).filter(item => {
    const matchesSearch = !searchText || 
      (item.discipline || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (item.work_package || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (item.discipline_code || '').toLowerCase().includes(searchText.toLowerCase())
    const matchesType = !manpowerTypeFilter || item.manpower_type === manpowerTypeFilter
    return matchesSearch && matchesType
  })

  // 按专业、工作包和类型分组
  const groupedData = filteredData.reduce((acc, item) => {
    const discipline = item.discipline || '未分类'
    const key = `${discipline}`
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(item)
    return acc
  }, {} as Record<string, ManpowerSummaryItem[]>)

  // 构建表格数据
  const tableData: (ManpowerSummaryItem & { key: string; isGroup?: boolean; groupName?: string })[] = []
  Object.entries(groupedData).sort().forEach(([discipline, items]) => {
    // 按工作包分组
    const workPackageGroups = items.reduce((acc, item) => {
      const wp = item.work_package || '未分类'
      if (!acc[wp]) {
        acc[wp] = []
      }
      acc[wp].push(item)
      return acc
    }, {} as Record<string, ManpowerSummaryItem[]>)

    // 添加专业分组行
    const disciplineCode = items[0]?.discipline_code || ''
    const disciplineTotal = items.reduce((sum, item) => sum + item.total_manpower, 0)

    tableData.push({
      key: `group-${discipline}`,
      isGroup: true,
      groupName: discipline,
      discipline,
      discipline_code: disciplineCode,
      total_manpower: disciplineTotal,
    } as any)

    // 添加工作包分组
    Object.entries(workPackageGroups).sort().forEach(([workPackage, wpItems]) => {
      const wpTotal = wpItems.reduce((sum, item) => sum + item.total_manpower, 0)
      tableData.push({
        key: `wp-${discipline}-${workPackage}`,
        isGroup: true,
        groupName: workPackage,
        discipline,
        work_package: workPackage,
        total_manpower: wpTotal,
        indent: 1,
      } as any)

      // 添加该工作包下的人力类型
      wpItems.forEach(item => {
        tableData.push({
          ...item,
          key: `${item.discipline}-${item.work_package}-${item.manpower_type}`,
        } as any)
      })
    })
  })

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
          const indent = record.indent || 0
          return (
            <Space style={{ marginLeft: indent * 24 }}>
              <Text strong={indent === 0} style={{ fontSize: indent === 0 ? 14 : 13 }}>
                {indent === 0 ? `${record.discipline_code} ${record.groupName}` : record.groupName}
              </Text>
            </Space>
          )
        }
        return (
          <Space style={{ marginLeft: 48 }}>
            <Tag color={record.manpower_type === 'Direct' ? 'blue' : 'orange'}>
              {record.manpower_type || '未分类'}
            </Tag>
          </Space>
        )
      },
    },
    {
      title: '总人力',
      dataIndex: 'total_manpower',
      width: 100,
      align: 'right' as const,
      render: (value: string | number) => formatQuantity(value, 3, '0', true),
    },
    {
      title: '上周人力',
      dataIndex: 'last_week_manpower',
      width: 100,
      align: 'right' as const,
      render: (value: string | number) => formatQuantity(value, 3, '0', true),
    },
    {
      title: '本周计划',
      dataIndex: 'this_week_planned',
      width: 100,
      align: 'right' as const,
      style: { backgroundColor: '#e6f7ff' },
      render: (value: string | number) => formatQuantity(value, 3, '0', true),
    },
    {
      title: '本周实际',
      dataIndex: 'this_week_actual',
      width: 100,
      align: 'right' as const,
      style: { backgroundColor: '#fff7e6' },
      render: (value: string | number) => formatQuantity(value, 3, '0', true),
    },
    {
      title: '周计划%',
      dataIndex: 'weekly_plan_rate',
      width: 100,
      align: 'right' as const,
      render: (rate: number) => rate > 0 ? (
        <Tag 
          color={getWeeklyPlanRateColor(rate)}
          style={{ 
            minWidth: 70, 
            textAlign: 'center',
            backgroundColor: getWeeklyPlanRateColor(rate),
            color: '#fff',
          }}
        >
          {rate.toFixed(2)}%
        </Tag>
      ) : '-',
    },
    {
      title: '下周计划',
      dataIndex: 'next_week_planned',
      width: 100,
      align: 'right' as const,
      style: { backgroundColor: '#e6f7ff' },
      render: (value: string | number) => formatQuantity(value, 3, '0', true),
    },
    {
      title: '本月计划',
      dataIndex: 'this_month_planned',
      width: 100,
      align: 'right' as const,
      style: { backgroundColor: '#e6f7ff' },
      render: (value: string | number) => formatQuantity(value, 3, '0', true),
    },
    {
      title: '本月实际',
      dataIndex: 'this_month_actual',
      width: 100,
      align: 'right' as const,
      style: { backgroundColor: '#fff7e6' },
      render: (value: string | number) => formatQuantity(value, 3, '0', true),
    },
  ]

  return (
    <div>
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
        <Col span={5}>
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
        <Col span={5}>
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
        <Col span={4}>
          <Select
            placeholder="人力类型"
            style={{ width: '100%' }}
            allowClear
            value={manpowerTypeFilter}
            onChange={setManpowerTypeFilter}
          >
            {uniqueManpowerTypes.map(t => (
              <Option key={t} value={t}>{t}</Option>
            ))}
          </Select>
        </Col>
        <Col span={4}>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              刷新
            </Button>
            <Button 
              onClick={() => {
                setDisciplineFilter(undefined)
                setWorkPackageFilter(undefined)
                setManpowerTypeFilter(undefined)
                setSearchText('')
              }}
            >
              清除
            </Button>
          </Space>
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
            scroll={{ x: 1200, y: 600 }}
            rowClassName={(record: any) => {
              if (record.isGroup && record.indent === 0) return 'summary-group-row'
              if (record.isGroup && record.indent === 1) return 'summary-wp-row'
              return 'summary-detail-row'
            }}
            size="small"
          />
        )}
      </Spin>

      <style>{`
        .summary-group-row {
          background-color: #f5f5f5 !important;
          font-weight: 600;
        }
        .summary-wp-row {
          background-color: #fafafa !important;
          font-weight: 500;
        }
        .summary-detail-row {
          background-color: #ffffff;
        }
        .summary-detail-row:hover {
          background-color: #f0f0f0;
        }
      `}</style>
    </div>
  )
}

export default ManpowerSummaryTable

