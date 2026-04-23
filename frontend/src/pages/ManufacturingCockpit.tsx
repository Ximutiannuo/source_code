import React from 'react'
import { Alert, Button, Card, Col, Row, Space, Statistic, Tag, Timeline, Typography } from 'antd'
import {
  ApartmentOutlined,
  DeploymentUnitOutlined,
  FundProjectionScreenOutlined,
  ScheduleOutlined,
  ShopOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import {
  manufacturingOrderService,
  type EquipmentOeeSummary,
  type MaterialPlanningSummary,
  type ProcurementSuggestionSummary,
  type WipSummary,
} from '../services/manufacturingOrderService'


const { Title, Paragraph, Text } = Typography

const EMPTY_WIP_SUMMARY: WipSummary = {
  orders_total: 0,
  orders_planned: 0,
  orders_released: 0,
  orders_in_progress: 0,
  orders_qc: 0,
  orders_completed: 0,
  orders_cancelled: 0,
  steps_total: 0,
  steps_planned: 0,
  steps_ready: 0,
  steps_in_progress: 0,
  steps_qc: 0,
  steps_completed: 0,
  steps_blocked: 0,
  quality_pass_count: 0,
  quality_fail_count: 0,
  quality_rework_count: 0,
  quality_hold_count: 0,
  rework_qty_total: 0,
  defect_qty_total: 0,
  planned_hours_total: 0,
  reported_hours_total: 0,
  downtime_minutes_total: 0,
  equipment_total: 0,
  equipment_active: 0,
  equipment_maintenance: 0,
  equipment_offline: 0,
  equipment_assigned: 0,
  overall_oee_rate: 0,
  reports_total: 0,
  reports_today: 0,
}

const EMPTY_EQUIPMENT_SUMMARY: EquipmentOeeSummary = {
  equipment_total: 0,
  equipment_active: 0,
  equipment_maintenance: 0,
  equipment_offline: 0,
  equipment_assigned: 0,
  planned_hours_total: 0,
  actual_hours_total: 0,
  runtime_hours_total: 0,
  downtime_minutes_total: 0,
  overall_availability_rate: 0,
  overall_performance_rate: 0,
  overall_quality_rate: 0,
  overall_oee_rate: 0,
  items: [],
}

const EMPTY_MATERIAL_PLANNING_SUMMARY: MaterialPlanningSummary = {
  orders_considered: 0,
  orders_without_bom: 0,
  materials_total: 0,
  ready_materials: 0,
  risk_materials: 0,
  short_materials: 0,
  shortage_qty_total: 0,
  impacted_orders: 0,
  items: [],
}

const EMPTY_PROCUREMENT_SUGGESTION_SUMMARY: ProcurementSuggestionSummary = {
  orders_considered: 0,
  orders_without_bom: 0,
  items_total: 0,
  urgent_items: 0,
  high_items: 0,
  to_purchase_items: 0,
  to_expedite_items: 0,
  master_data_gap_items: 0,
  replenish_items: 0,
  suggested_purchase_qty_total: 0,
  impacted_orders: 0,
  items: [],
}

const businessChain = ['客户订单', '产品/BOM', '工艺路线', '齐套/MRP', '制造执行', '质量交付']

const capabilityCards = [
  {
    title: 'PLM 主数据源头',
    icon: <DeploymentUnitOutlined />,
    color: '#1d4ed8',
    points: ['物料主数据', 'EBOM / PBOM / MBOM', '版本与 ECN', '图纸联动'],
  },
  {
    title: 'MES 工单执行',
    icon: <ScheduleOutlined />,
    color: '#0f766e',
    points: ['工单下达', '工位报工', '工序质量', '在制追溯'],
  },
  {
    title: 'SCM 采购拉动',
    icon: <ShopOutlined />,
    color: '#b45309',
    points: ['MRP 建议', '缺料分类', '请购草稿', '供应协同'],
  },
  {
    title: 'EAM 设备保障',
    icon: <ToolOutlined />,
    color: '#7c3aed',
    points: ['设备台账', '稼动率', '停机统计', '保养预警'],
  },
  {
    title: '项目制交付',
    icon: <FundProjectionScreenOutlined />,
    color: '#be123c',
    points: ['里程碑计划', '设计-采购-制造联动', '现场调试衔接', '交付驾驶舱'],
  },
  {
    title: '经营分析闭环',
    icon: <ApartmentOutlined />,
    color: '#9a3412',
    points: ['订单成本', '延期预警', '准交率', '单项目复盘'],
  },
]

const phasedRoadmap = [
  {
    color: '#1d4ed8',
    children: '第一阶段先打通订单、物料、BOM、工艺、工单五类核心对象，让设计数据能够直接驱动制造执行。',
  },
  {
    color: '#0f766e',
    children: '第二阶段补齐齐套分析、请购草稿、工位报工、质量记录与设备稼动，形成可穿透的制造执行链路。',
  },
  {
    color: '#b45309',
    children: '第三阶段叠加 APS、成本核算、延期预警与供应协同，把系统从记录平台升级为经营决策平台。',
  },
]

const aiPrompts = [
  '让 AI 根据订单交期、设备产能和物料齐套情况给出排产优先级建议。',
  '让 AI 自动识别图纸和 ECN 变更影响到哪些工单、缺哪些料、需不需要返工。',
  '让 AI 基于缺料原因、前置期和到货风险生成采购催交策略与跟单话术。',
  '让 AI 基于报工、质检、停机记录识别瓶颈工序与低效设备。',
]

const quickActions = [
  { label: '制造订单与工单', path: '/manufacturing/orders', type: 'primary' as const },
  { label: '采购管理', path: '/manufacturing/procurement' },
  { label: '质量管理', path: '/manufacturing/quality' },
  { label: '设备管理', path: '/manufacturing/equipment' },
  { label: '物料主数据', path: '/manufacturing/materials' },
  { label: 'BOM 与产品结构', path: '/manufacturing/bom' },
  { label: '工艺模板与路线', path: '/process-template-config' },
]


const ManufacturingCockpit: React.FC = () => {
  const navigate = useNavigate()

  const { data: wipSummary = EMPTY_WIP_SUMMARY } = useQuery({
    queryKey: ['manufacturing-cockpit-wip-summary'],
    queryFn: async () => {
      const response = await manufacturingOrderService.getWipSummary()
      return response.data
    },
  })

  const { data: equipmentSummary = EMPTY_EQUIPMENT_SUMMARY } = useQuery({
    queryKey: ['manufacturing-cockpit-equipment-oee'],
    queryFn: async () => {
      const response = await manufacturingOrderService.getEquipmentOeeSummary()
      return response.data
    },
  })

  const { data: materialPlanningSummary = EMPTY_MATERIAL_PLANNING_SUMMARY } = useQuery({
    queryKey: ['manufacturing-cockpit-material-planning'],
    queryFn: async () => {
      const response = await manufacturingOrderService.getMaterialPlanningSummary()
      return response.data
    },
  })

  const { data: procurementSummary = EMPTY_PROCUREMENT_SUGGESTION_SUMMARY } = useQuery({
    queryKey: ['manufacturing-cockpit-procurement-summary'],
    queryFn: async () => {
      const response = await manufacturingOrderService.getProcurementSuggestions()
      return response.data
    },
  })

  const bottleneckEquipment = equipmentSummary.items.slice(0, 3)
  const firstPassBase =
    wipSummary.quality_pass_count +
    wipSummary.quality_fail_count +
    wipSummary.quality_rework_count +
    wipSummary.quality_hold_count
  const firstPassRate = firstPassBase > 0 ? Math.round((wipSummary.quality_pass_count / firstPassBase) * 100) : 0

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 64px)',
        padding: 24,
        background:
          'radial-gradient(circle at top left, rgba(13, 148, 136, 0.16), transparent 28%), radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #ecfeff 100%)',
      }}
    >
      <Card
        bordered={false}
        style={{
          borderRadius: 24,
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #0f172a 0%, #123c4a 42%, #155e75 100%)',
          color: '#fff',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.24)',
        }}
        bodyStyle={{ padding: 32 }}
      >
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} lg={15}>
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <Tag color="cyan" style={{ width: 'fit-content', padding: '6px 12px', borderRadius: 999 }}>
                Mechanical Manufacturing Digital Platform
              </Tag>
              <Title level={2} style={{ margin: 0, color: '#fff' }}>
                机械制造运营驾驶舱
              </Title>
              <Paragraph style={{ margin: 0, color: 'rgba(255,255,255,0.84)', fontSize: 16, lineHeight: 1.8 }}>
                平台主线已经从原来的工程排程视角切换到制造业务视角，围绕订单、BOM、工艺、齐套、
                请购、工单执行、质量与设备形成一条可落地的数据链。对于非标装备企业，重点不只是记录数据，
                而是让设计变更、采购拉动与生产现场能够自动联动。
              </Paragraph>
              <Space wrap>
                {businessChain.map(item => (
                  <Tag
                    key={item}
                    style={{
                      borderRadius: 999,
                      padding: '6px 12px',
                      background: 'rgba(255,255,255,0.12)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.18)',
                    }}
                  >
                    {item}
                  </Tag>
                ))}
              </Space>
              <Space wrap>
                {quickActions.map(action => (
                  <Button
                    key={action.path}
                    type={action.type}
                    size="large"
                    onClick={() => navigate(action.path)}
                  >
                    {action.label}
                  </Button>
                ))}
              </Space>
            </Space>
          </Col>

          <Col xs={24} lg={9}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card bordered={false} style={{ borderRadius: 18, background: 'rgba(255,255,255,0.1)' }}>
                  <Statistic title={<span style={{ color: '#cbd5e1' }}>在制订单</span>} value={wipSummary.orders_in_progress} valueStyle={{ color: '#fff' }} />
                </Card>
              </Col>
              <Col span={12}>
                <Card bordered={false} style={{ borderRadius: 18, background: 'rgba(255,255,255,0.1)' }}>
                  <Statistic title={<span style={{ color: '#cbd5e1' }}>缺料物料</span>} value={materialPlanningSummary.short_materials} valueStyle={{ color: '#fff' }} />
                </Card>
              </Col>
              <Col span={12}>
                <Card bordered={false} style={{ borderRadius: 18, background: 'rgba(255,255,255,0.1)' }}>
                  <Statistic title={<span style={{ color: '#cbd5e1' }}>紧急采购项</span>} value={procurementSummary.urgent_items} valueStyle={{ color: '#fff' }} />
                </Card>
              </Col>
              <Col span={12}>
                <Card bordered={false} style={{ borderRadius: 18, background: 'rgba(255,255,255,0.1)' }}>
                  <Statistic
                    title={<span style={{ color: '#cbd5e1' }}>整体 OEE</span>}
                    value={Math.round(equipmentSummary.overall_oee_rate * 100)}
                    suffix="%"
                    valueStyle={{ color: '#fff' }}
                  />
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Alert
        showIcon
        type="info"
        style={{ marginTop: 20, borderRadius: 18 }}
        message="当前制造主线状态"
        description={`当前在制订单 ${wipSummary.orders_in_progress} 单，待质检工序 ${wipSummary.steps_qc} 道，缺料物料 ${materialPlanningSummary.short_materials} 项，建议请购 ${procurementSummary.to_purchase_items} 项，累计停机 ${wipSummary.downtime_minutes_total} 分钟。`}
      />

      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} xl={8}>
          <Card bordered={false} style={{ borderRadius: 20, height: '100%' }}>
            <Title level={4}>生产执行</Title>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic title="已下达订单" value={wipSummary.orders_released} suffix="单" />
              </Col>
              <Col span={12}>
                <Statistic title="待质检工序" value={wipSummary.steps_qc} suffix="道" />
              </Col>
              <Col span={12}>
                <Statistic title="受阻工序" value={wipSummary.steps_blocked} suffix="道" />
              </Col>
              <Col span={12}>
                <Statistic title="今日报工" value={wipSummary.reports_today} suffix="次" />
              </Col>
              <Col span={12}>
                <Statistic title="计划工时" value={wipSummary.planned_hours_total} suffix="h" />
              </Col>
              <Col span={12}>
                <Statistic title="实报工时" value={wipSummary.reported_hours_total} suffix="h" />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card bordered={false} style={{ borderRadius: 20, height: '100%' }}>
            <Title level={4}>齐套与采购</Title>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic title="受影响订单" value={materialPlanningSummary.impacted_orders} suffix="单" />
              </Col>
              <Col span={12}>
                <Statistic title="风险物料" value={materialPlanningSummary.risk_materials} suffix="项" />
              </Col>
              <Col span={12}>
                <Statistic title="缺料物料" value={materialPlanningSummary.short_materials} suffix="项" />
              </Col>
              <Col span={12}>
                <Statistic title="建议请购" value={procurementSummary.to_purchase_items} suffix="项" />
              </Col>
              <Col span={12}>
                <Statistic title="催交项" value={procurementSummary.to_expedite_items} suffix="项" />
              </Col>
              <Col span={12}>
                <Statistic title="建议数量" value={procurementSummary.suggested_purchase_qty_total} />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card bordered={false} style={{ borderRadius: 20, height: '100%' }}>
            <Title level={4}>质量与设备</Title>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic title="一次通过率" value={firstPassRate} suffix="%" />
              </Col>
              <Col span={12}>
                <Statistic title="返工数量" value={wipSummary.rework_qty_total} />
              </Col>
              <Col span={12}>
                <Statistic title="不良数量" value={wipSummary.defect_qty_total} />
              </Col>
              <Col span={12}>
                <Statistic title="已派工设备" value={wipSummary.equipment_assigned} suffix="台" />
              </Col>
              <Col span={12}>
                <Statistic title="保养中设备" value={equipmentSummary.equipment_maintenance} suffix="台" />
              </Col>
              <Col span={12}>
                <Statistic title="停机分钟" value={wipSummary.downtime_minutes_total} suffix="min" />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} xl={10}>
          <Card bordered={false} style={{ borderRadius: 20, height: '100%' }}>
            <Title level={4}>瓶颈设备关注</Title>
            <Paragraph type="secondary">
              这里建议后续叠加设备维修记录、换型时间与订单排队情况，形成真正的瓶颈工序看板。
            </Paragraph>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {bottleneckEquipment.length > 0 ? (
                bottleneckEquipment.map(item => (
                  <Card
                    key={item.id}
                    size="small"
                    style={{ borderRadius: 14, background: '#f8fafc' }}
                    bodyStyle={{ padding: 14 }}
                  >
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <div>
                        <Text strong>{item.code}</Text>
                        <div>
                          <Text type="secondary">{item.name}</Text>
                        </div>
                        <div>
                          <Text type="secondary">派工 {item.assigned_steps} 道，停机 {item.downtime_minutes_total} min</Text>
                        </div>
                      </div>
                      <Tag color={item.oee_rate >= 0.85 ? 'success' : item.oee_rate >= 0.7 ? 'gold' : 'error'}>
                        OEE {Math.round(item.oee_rate * 100)}%
                      </Tag>
                    </Space>
                  </Card>
                ))
              ) : (
                <Text type="secondary">暂无设备稼动数据</Text>
              )}
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card bordered={false} style={{ borderRadius: 20, height: '100%' }}>
            <Title level={4}>平台能力版图</Title>
            <Row gutter={[16, 16]}>
              {capabilityCards.map(item => (
                <Col xs={24} md={12} key={item.title}>
                  <Card
                    size="small"
                    bordered={false}
                    style={{ height: '100%', borderRadius: 18, background: '#f8fafc' }}
                  >
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Space size={12}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 14,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `${item.color}15`,
                            color: item.color,
                            fontSize: 20,
                          }}
                        >
                          {item.icon}
                        </div>
                        <Text strong>{item.title}</Text>
                      </Space>
                      <Space wrap>
                        {item.points.map(point => (
                          <Tag key={point} color="blue" style={{ borderRadius: 999, padding: '4px 10px' }}>
                            {point}
                          </Tag>
                        ))}
                      </Space>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} xl={14}>
          <Card bordered={false} style={{ borderRadius: 20, height: '100%' }}>
            <Title level={4}>三阶段落地路线</Title>
            <Paragraph type="secondary">
              非标机械企业最怕一开始就做“大而全”的系统改造。更稳妥的方式是先打通主数据，再闭环执行，
              最后把计划和经营能力叠加上去。
            </Paragraph>
            <Timeline items={phasedRoadmap} />
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card bordered={false} style={{ borderRadius: 20, height: '100%' }}>
            <Title level={4}>推荐继续推进的 AI 场景</Title>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {aiPrompts.map(prompt => (
                <Card
                  key={prompt}
                  size="small"
                  style={{ borderRadius: 14, background: '#f8fafc' }}
                  bodyStyle={{ padding: 14 }}
                >
                  <Text>{prompt}</Text>
                </Card>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}


export default ManufacturingCockpit
