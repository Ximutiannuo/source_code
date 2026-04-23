import { ArrowRightOutlined, HistoryOutlined } from '@ant-design/icons'
import { Button, Space, Tag } from 'antd'
import type { ButtonProps } from 'antd'
import { useNavigate } from 'react-router-dom'

type LegacyModuleAction = {
  label: string
  path: string
  type?: ButtonProps['type']
}

interface LegacyModuleBannerProps {
  title: string
  description: string
  note?: string
  actions?: LegacyModuleAction[]
  compact?: boolean
}

const LegacyModuleBanner = ({
  title,
  description,
  note = '建议优先从制造驾驶舱、制造订单、物料/BOM、工艺模板等新入口开展业务，避免继续以工程建设口径驱动机械制造流程。',
  actions = [],
  compact = false,
}: LegacyModuleBannerProps) => {
  const navigate = useNavigate()

  return (
    <div
      style={{
        flexShrink: 0,
        marginBottom: compact ? 8 : 16,
        padding: compact ? '10px 14px' : '14px 18px',
        borderRadius: 12,
        border: '1px solid #f5d77a',
        background:
          'linear-gradient(135deg, rgba(255, 251, 235, 0.98) 0%, rgba(254, 243, 199, 0.96) 48%, rgba(255, 255, 255, 0.98) 100%)',
        boxShadow: '0 6px 18px rgba(120, 53, 15, 0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: compact ? 'center' : 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Space direction="vertical" size={compact ? 4 : 8} style={{ flex: 1, minWidth: 280 }}>
          <Space wrap size={[6, 6]}>
            <Tag color="gold" icon={<HistoryOutlined />}>
              遗留工程模块
            </Tag>
            <Tag>兼容入口</Tag>
          </Space>

          <div style={{ fontSize: compact ? 14 : 16, fontWeight: 700, color: '#7c2d12' }}>
            {title}
          </div>

          <div style={{ fontSize: 12, lineHeight: 1.7, color: '#6b7280' }}>{description}</div>

          <div style={{ fontSize: 12, lineHeight: 1.6, color: '#92400e' }}>{note}</div>
        </Space>

        {actions.length > 0 && (
          <Space wrap size={[8, 8]}>
            {actions.map((action) => (
              <Button
                key={`${action.path}-${action.label}`}
                type={action.type || 'default'}
                icon={<ArrowRightOutlined />}
                onClick={() => navigate(action.path)}
              >
                {action.label}
              </Button>
            ))}
          </Space>
        )}
      </div>
    </div>
  )
}

export default LegacyModuleBanner
