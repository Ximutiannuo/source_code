import { Card, Typography } from 'antd'

const { Paragraph } = Typography

const WorkPlans = () => {
  return (
    <Card
      style={{
        background: '#ffffff',
        borderRadius: 4,
        border: '1px solid #e0e0e0',
      }}
      styles={{ body: { padding: '24px' } }}
    >
      <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600, color: '#333' }}>作业计划</h2>
      <Paragraph style={{ color: '#666', marginBottom: 12 }}>
        这里将用于查看与维护作业计划信息，包括计划开始/完成日期、逻辑关系、关键路径作业等，与 P6 计划保持联动。
      </Paragraph>
      <Paragraph style={{ color: '#666', margin: 0 }}>
        当前为占位页面，后续会结合 P6 同步结果和现场需求补充甘特视图、筛选条件以及批量调整功能。
      </Paragraph>
    </Card>
  )
}

export default WorkPlans


