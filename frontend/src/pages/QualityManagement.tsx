import React, { useState } from 'react'
import {
  Card,
  Col,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExperimentOutlined,
  PauseCircleOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'

import {
  qualityService,
  type DefectParetoItem,
  type QualityCheckItem,
  type QualityDashboard,
  type QualityTrendItem,
} from '../services/qualityEquipmentService'

const { Title, Text, Paragraph } = Typography

const RESULT_COLORS: Record<string, string> = {
  PASS: 'success',
  FAIL: 'error',
  REWORK: 'warning',
  HOLD: 'default',
}

const RESULT_LABELS: Record<string, string> = {
  PASS: '通过',
  FAIL: '不合格',
  REWORK: '返工',
  HOLD: '待定',
}

const EMPTY_DASHBOARD: QualityDashboard = {
  period_days: 30,
  total_checks: 0,
  pass_count: 0,
  fail_count: 0,
  rework_count: 0,
  hold_count: 0,
  checked_qty_total: 0,
  defect_qty_total: 0,
  rework_qty_total: 0,
  first_pass_rate: 0,
  defect_rate: 0,
}

const QualityManagement: React.FC = () => {
  const [days, setDays] = useState(30)
  const [resultFilter, setResultFilter] = useState<string | undefined>(undefined)

  const { data: dashboard = EMPTY_DASHBOARD } = useQuery({
    queryKey: ['quality-dashboard', days],
    queryFn: async () => {
      const res = await qualityService.getDashboard(days)
      return res.data
    },
  })

  const { data: pareto = [] } = useQuery({
    queryKey: ['quality-pareto', days],
    queryFn: async () => {
      const res = await qualityService.getDefectPareto(days)
      return res.data
    },
  })

  const { data: trend = [] } = useQuery({
    queryKey: ['quality-trend', days],
    queryFn: async () => {
      const res = await qualityService.getTrend(days)
      return res.data
    },
  })

  const { data: checks = [], isLoading: checksLoading } = useQuery({
    queryKey: ['quality-checks', resultFilter, days],
    queryFn: async () => {
      const res = await qualityService.listChecks({ result: resultFilter, days })
      return res.data
    },
  })

  const firstPassPct = Math.round(dashboard.first_pass_rate * 100)
  const defectPct = Math.round(dashboard.defect_rate * 100 * 100) / 100

  const paretoColumns: ColumnsType<DefectParetoItem> = [
    {
      title: '工序',
      dataIndex: 'step_code',
      width: 120,
      render: (val: string) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: '不良数量',
      dataIndex: 'defect_qty',
      width: 100,
      align: 'right',
      render: (val: number) => <Text type="danger" strong>{val}</Text>,
    },
    {
      title: '返工数量',
      dataIndex: 'rework_qty',
      width: 100,
      align: 'right',
      render: (val: number) => <Text type="warning">{val}</Text>,
    },
    { title: '检验次数', dataIndex: 'check_count', width: 90, align: 'right' },
    {
      title: '累计占比',
      dataIndex: 'cumulative_pct',
      width: 180,
      render: (val: number) => (
        <Progress
          percent={Math.round(val * 100)}
          size="small"
          strokeColor={val >= 0.8 ? '#ef4444' : val >= 0.5 ? '#f59e0b' : '#3b82f6'}
        />
      ),
    },
  ]

  const trendColumns: ColumnsType<QualityTrendItem> = [
    { title: '日期', dataIndex: 'date', width: 110 },
    { title: '检验次数', dataIndex: 'total_checks', width: 90, align: 'right' },
    {
      title: '通过',
      dataIndex: 'pass_count',
      width: 70,
      align: 'right',
      render: (val: number) => <Text type="success">{val}</Text>,
    },
    {
      title: '不合格',
      dataIndex: 'fail_count',
      width: 80,
      align: 'right',
      render: (val: number) => (val > 0 ? <Text type="danger">{val}</Text> : val),
    },
    {
      title: '返工',
      dataIndex: 'rework_count',
      width: 70,
      align: 'right',
      render: (val: number) => (val > 0 ? <Text type="warning">{val}</Text> : val),
    },
    {
      title: '一次通过率',
      dataIndex: 'first_pass_rate',
      width: 120,
      render: (val: number) => {
        const pct = Math.round(val * 100)
        return (
          <Progress
            percent={pct}
            size="small"
            strokeColor={pct >= 95 ? '#22c55e' : pct >= 80 ? '#f59e0b' : '#ef4444'}
          />
        )
      },
    },
  ]

  const checkColumns: ColumnsType<QualityCheckItem> = [
    { title: '订单号', dataIndex: 'order_number', width: 120, render: (v: string | null) => v || '-' },
    { title: '工序', dataIndex: 'step_code', width: 80, render: (v: string | null) => v ? <Tag color="blue">{v}</Tag> : '-' },
    { title: '工序名称', dataIndex: 'step_name', width: 120, ellipsis: true },
    {
      title: '结果',
      dataIndex: 'result',
      width: 80,
      render: (val: string) => <Tag color={RESULT_COLORS[val] || 'default'}>{RESULT_LABELS[val] || val}</Tag>,
    },
    { title: '检验类型', dataIndex: 'check_type', width: 80 },
    { title: '检验数量', dataIndex: 'checked_qty', width: 90, align: 'right' },
    {
      title: '不良数量',
      dataIndex: 'defect_qty',
      width: 90,
      align: 'right',
      render: (val: number) => (val > 0 ? <Text type="danger">{val}</Text> : val),
    },
    {
      title: '返工数量',
      dataIndex: 'rework_qty',
      width: 90,
      align: 'right',
      render: (val: number) => (val > 0 ? <Text type="warning">{val}</Text> : val),
    },
    { title: '检验员', dataIndex: 'inspector_name', width: 100, render: (v: string | null) => v || '-' },
    {
      title: '检验时间',
      dataIndex: 'checked_at',
      width: 160,
      render: (val: string | null) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
    },
    { title: '备注', dataIndex: 'remarks', width: 150, ellipsis: true },
  ]

  return (
    <div style={{ padding: 24, minHeight: 'calc(100vh - 64px)', background: 'linear-gradient(180deg, #f0fdf4 0%, #f8fafc 100%)' }}>
      {/* Header */}
      <Card
        bordered={false}
        style={{
          borderRadius: 20,
          background: 'linear-gradient(135deg, #0f172a 0%, #14532d 42%, #166534 100%)',
          color: '#fff',
          marginBottom: 20,
          boxShadow: '0 16px 48px rgba(15, 23, 42, 0.2)',
        }}
        bodyStyle={{ padding: 28 }}
      >
        <Row align="middle" gutter={24}>
          <Col flex="auto">
            <Space direction="vertical" size={8}>
              <Tag color="green" style={{ borderRadius: 999, padding: '4px 12px' }}>
                QMS Quality Management System
              </Tag>
              <Title level={3} style={{ margin: 0, color: '#fff' }}>
                <SafetyCertificateOutlined style={{ marginRight: 8 }} />
                质量管理中心
              </Title>
              <Paragraph style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>
                首件检 → 过程检 → 终检 → 不良分析 → 返工闭环 → 质量改进
              </Paragraph>
            </Space>
          </Col>
          <Col>
            <Space>
              <Text style={{ color: '#cbd5e1' }}>统计周期：</Text>
              <Select
                value={days}
                onChange={setDays}
                style={{ width: 120 }}
                options={[
                  { value: 7, label: '近 7 天' },
                  { value: 14, label: '近 14 天' },
                  { value: 30, label: '近 30 天' },
                  { value: 90, label: '近 90 天' },
                ]}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 16, height: '100%' }}>
            <Statistic
              title="一次通过率"
              value={firstPassPct}
              suffix="%"
              prefix={<CheckCircleOutlined style={{ color: firstPassPct >= 95 ? '#22c55e' : '#f59e0b' }} />}
              valueStyle={{ color: firstPassPct >= 95 ? '#22c55e' : '#f59e0b' }}
            />
            <Progress
              percent={firstPassPct}
              showInfo={false}
              strokeColor={firstPassPct >= 95 ? '#22c55e' : firstPassPct >= 80 ? '#f59e0b' : '#ef4444'}
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 16, height: '100%' }}>
            <Statistic
              title="不良率"
              value={defectPct}
              suffix="%"
              prefix={<CloseCircleOutlined style={{ color: defectPct > 5 ? '#ef4444' : '#3b82f6' }} />}
              valueStyle={{ color: defectPct > 5 ? '#ef4444' : '#3b82f6' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 16, height: '100%' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="不良数" value={dashboard.defect_qty_total} valueStyle={{ fontSize: 20 }} prefix={<ExperimentOutlined style={{ color: '#ef4444' }} />} />
              </Col>
              <Col span={12}>
                <Statistic title="返工数" value={dashboard.rework_qty_total} valueStyle={{ fontSize: 20 }} prefix={<ToolOutlined style={{ color: '#f59e0b' }} />} />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 16, height: '100%' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="总检验" value={dashboard.total_checks} valueStyle={{ fontSize: 20 }} />
              </Col>
              <Col span={12}>
                <Statistic title="待定" value={dashboard.hold_count} valueStyle={{ fontSize: 20 }} prefix={<PauseCircleOutlined style={{ color: '#8b5cf6' }} />} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Pareto & Trend */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} xl={12}>
          <Card bordered={false} style={{ borderRadius: 18 }} title="不良 Pareto 分析（按工序）">
            {pareto.length > 0 ? (
              <Table
                columns={paretoColumns}
                dataSource={pareto}
                rowKey="step_code"
                size="small"
                pagination={false}
              />
            ) : (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Text type="secondary">暂无不良数据，全部工序合格 🎉</Text>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card bordered={false} style={{ borderRadius: 18 }} title="质量趋势（每日）">
            {trend.filter(t => t.total_checks > 0).length > 0 ? (
              <Table
                columns={trendColumns}
                dataSource={trend.filter(t => t.total_checks > 0)}
                rowKey="date"
                size="small"
                pagination={{ pageSize: 10 }}
                scroll={{ y: 300 }}
              />
            ) : (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Text type="secondary">当前周期内暂无检验记录</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Check List */}
      <Card
        bordered={false}
        style={{ borderRadius: 18 }}
        title="质检记录明细"
        extra={
          <Select
            value={resultFilter}
            onChange={setResultFilter}
            allowClear
            placeholder="按结果筛选"
            style={{ width: 140 }}
            options={[
              { value: 'PASS', label: '通过' },
              { value: 'FAIL', label: '不合格' },
              { value: 'REWORK', label: '返工' },
              { value: 'HOLD', label: '待定' },
            ]}
          />
        }
      >
        <Table
          columns={checkColumns}
          dataSource={checks}
          rowKey="id"
          loading={checksLoading}
          scroll={{ x: 1300 }}
          size="small"
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: total => `共 ${total} 条` }}
        />
      </Card>
    </div>
  )
}

export default QualityManagement
