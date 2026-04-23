import { Modal, Spin, Empty, Row, Col, Typography, Space, Progress, Segmented, Tag } from 'antd'
import { LikeOutlined, TrophyOutlined, BulbOutlined, StarOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { aheadPlanService, ResponsibleSummary } from '../../services/aheadPlanService'
import { ISSUE_TYPE_OPTIONS } from '../../constants/aheadPlanIssues'

const { Text } = Typography

const ISSUE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ISSUE_TYPE_OPTIONS.map((o) => [o.value, o.label])
)

interface HMDSummaryDrawerProps {
  open: boolean
  onClose: () => void
}

const TIER_COLORS: Record<string, string> = {
  terrible: '#dc2626',
  poor: '#f97316',
  mixed: '#eab308',
  good: '#84cc16',
  great: '#22c55e',
  excellent: '#10b981',
}

export default function HMDSummaryDrawer({ open, onClose }: HMDSummaryDrawerProps) {
  const [scope, setScope] = useState<'overall' | 'department'>('overall')
  const { data, isLoading, error } = useQuery({
    queryKey: ['ahead-plan-responsible-summary', scope],
    queryFn: () => aheadPlanService.getResponsibleSummary(scope),
    enabled: open,
  })

  return (
    <Modal
      title="我的反馈汇总（HMD）"
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
      centered
      destroyOnClose
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', background: '#f8fafc' } }}
    >
      <Segmented
        options={[
          { label: '整体', value: 'overall' },
          { label: '同部门', value: 'department' },
        ]}
        value={scope}
        onChange={(v) => setScope((v as 'overall' | 'department') || 'overall')}
        block
        style={{ marginBottom: 16 }}
      />
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : error || !data ? (
        <Empty description="加载失败" style={{ padding: 48 }} />
      ) : data.total === 0 ? (
        <Empty description="暂无反馈记录" style={{ padding: 48 }} />
      ) : (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <SummaryHeader data={data} />
          {data.good_rate_tiers && data.good_rate_tiers.length > 0 && (
            <GoodRateTierBar data={data} />
          )}
          <div style={{ padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Text strong style={{ fontSize: 14 }}>好评率</Text>
            <div style={{ marginTop: 12 }}>
              <Progress
                percent={data.good_rate_pct}
                strokeColor={{ '0%': '#34d399', '100%': '#10b981' }}
                trailColor="#e2e8f0"
                showInfo
                format={(p) => `${p}%`}
              />
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>4 星 + 5 星占比</Text>
          </div>
          <StarDistribution data={data} />
          {data.answer_count_rank && data.answer_count_rank.total_users > 0 && (
            <AnswerRankCard rank={data.answer_count_rank} />
          )}
          {data.my_imprint && data.my_imprint.length > 0 && (
            <MyImprintCard imprint={data.my_imprint} />
          )}
          {data.improvement_tags && data.improvement_tags.length > 0 && (
            <ImprovementCard tags={data.improvement_tags} />
          )}
          {data.special_praise_count > 0 && (
            <div style={{ padding: 16, background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', borderRadius: 8, textAlign: 'center' }}>
              <LikeOutlined style={{ fontSize: 24, color: '#10b981', marginBottom: 8 }} />
              <div style={{ fontSize: 20, fontWeight: 700, color: '#047857' }}>{data.special_praise_count}</div>
              <div style={{ fontSize: 13, color: '#059669' }}>次特别好评</div>
            </div>
          )}
        </Space>
      )}
    </Modal>
  )
}

function SummaryHeader({ data }: { data: ResponsibleSummary }) {
  return (
    <div style={{ textAlign: 'center', padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <Text type="secondary" style={{ fontSize: 13 }}>共收到反馈</Text>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>{data.total}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>次协作评价</div>
    </div>
  )
}

function GoodRateTierBar({ data }: { data: ResponsibleSummary }) {
  const tiers = data.good_rate_tiers || []
  const userTier = data.user_tier || 'mixed'
  let cum = 0
  const userTierIdx = tiers.findIndex((t) => t.key === userTier)
  const markerLeft = userTierIdx >= 0
    ? tiers.slice(0, userTierIdx).reduce((s, t) => s + t.pct, 0) + tiers[userTierIdx].pct / 2
    : 50

  return (
    <div style={{ padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <Text strong style={{ fontSize: 14 }}>好评率分布 · 你在哪里</Text>
      <div style={{ display: 'flex', height: 28, marginTop: 12, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        {tiers.map((t) => {
          const w = Math.max(t.pct, 0.5)
          const color = TIER_COLORS[t.key] || '#94a3b8'
          cum += t.pct
          return (
            <div
              key={t.key}
              title={`${t.label} ${t.range} · ${t.pct}%`}
              style={{
                width: `${w}%`,
                background: color,
                opacity: t.key === userTier ? 1 : 0.7,
              }}
            />
          )
        })}
        <div
          style={{
            position: 'absolute',
            left: `${markerLeft}%`,
            top: -4,
            bottom: -4,
            width: 2,
            background: '#0f172a',
            transform: 'translateX(-50%)',
            borderRadius: 1,
          }}
        />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8, fontSize: 11, color: '#64748b' }}>
        {tiers.map((t) => (
          <span key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: TIER_COLORS[t.key] || '#94a3b8' }} />
            {t.label} {t.pct}%
            {t.key === userTier && <Text strong style={{ color: '#0f172a' }}> ← 你</Text>}
          </span>
        ))}
      </div>
    </div>
  )
}

function StarDistribution({ data }: { data: ResponsibleSummary }) {
  return (
    <div style={{ padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <Text strong style={{ fontSize: 14 }}>星级分布</Text>
      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col span={8}>
          <div style={{ textAlign: 'center', padding: 8, background: '#fef3c7', borderRadius: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#92400e' }}>★</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>{data.r1}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>1 星</div>
          </div>
        </Col>
        <Col span={8}>
          <div style={{ textAlign: 'center', padding: 8, background: '#fde68a', borderRadius: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#b45309' }}>★★</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#b45309' }}>{data.r2}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>2 星</div>
          </div>
        </Col>
        <Col span={8}>
          <div style={{ textAlign: 'center', padding: 8, background: '#fed7aa', borderRadius: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#c2410c' }}>★★★</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#c2410c' }}>{data.r3}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>3 星</div>
          </div>
        </Col>
      </Row>
      <Row gutter={12} style={{ marginTop: 8 }}>
        <Col span={12}>
          <div style={{ textAlign: 'center', padding: 8, background: '#bbf7d0', borderRadius: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#166534' }}>★★★★</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>{data.r4}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>响应快，解决得不错</div>
          </div>
        </Col>
        <Col span={12}>
          <div style={{ textAlign: 'center', padding: 8, background: '#86efac', borderRadius: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#14532d' }}>★★★★★</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#14532d' }}>{data.r5}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>超出预期，非常专业</div>
          </div>
        </Col>
      </Row>
    </div>
  )
}

function AnswerRankCard({ rank }: { rank: { count: number; exceed_pct: number; total_users: number } }) {
  return (
    <div style={{ padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <Text strong style={{ fontSize: 14 }}><TrophyOutlined /> 问题回答数量</Text>
      <div style={{ marginTop: 12 }}>
        <Text>共回答 <Text strong>{rank.count}</Text> 个问题的反馈</Text>
        {rank.total_users > 1 && (
          <div style={{ marginTop: 8, color: '#64748b', fontSize: 13 }}>
            超过 <Text strong style={{ color: '#10b981' }}>{rank.exceed_pct}%</Text> 的员工
          </div>
        )}
      </div>
    </div>
  )
}

function MyImprintCard({ imprint }: { imprint: Array<{ issue_type: string; count: number }> }) {
  return (
    <div style={{ padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <Text strong style={{ fontSize: 14 }}><StarOutlined /> 我的印记</Text>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>解决哪些问题最多</div>
      <Space wrap size={[8, 8]}>
        {imprint.map(({ issue_type, count }) => (
          <Tag key={issue_type} color="blue">
            {ISSUE_TYPE_LABELS[issue_type] || issue_type} ×{count}
          </Tag>
        ))}
      </Space>
    </div>
  )
}

function ImprovementCard({ tags }: { tags: Array<{ tag: string; count: number }> }) {
  return (
    <div style={{ padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <Text strong style={{ fontSize: 14 }}><BulbOutlined /> 他们希望你在哪些方面改进</Text>
      <div style={{ marginTop: 12 }}>
        <Space wrap size={[8, 8]}>
          {tags.map(({ tag, count }) => (
            <Tag key={tag} color="orange">
              {tag} ({count})
            </Tag>
          ))}
        </Space>
      </div>
    </div>
  )
}
