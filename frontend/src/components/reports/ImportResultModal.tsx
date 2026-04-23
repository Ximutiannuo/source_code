import { Modal, Table, Typography, Space, Button, Collapse } from 'antd'
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons'

const { Text } = Typography

export interface FailedItem {
  activity_id: string
  row?: number | null
  reason: string
}

interface ImportResultModalProps {
  visible: boolean
  onClose: () => void
  result: {
    success: boolean
    imported_count: number
    error_count: number
    errors?: string[]
    success_ids?: string[]
    failed_items?: FailedItem[]
  } | null
  title?: string
}

const ImportResultModal = ({ visible, onClose, result, title = '导入结果' }: ImportResultModalProps) => {
  if (!result) return null

  const isCompleteSuccess = result.error_count === 0
  const isCompleteFailure = result.imported_count === 0 && result.error_count > 0
  const successIds = result.success_ids || []
  const failedItems = result.failed_items || []
  const errors = result.errors || []

  const errorData = failedItems.length > 0
    ? failedItems.map((item, index) => ({
        key: index,
        row: item.row ?? '-',
        activity_id: item.activity_id,
        message: item.reason,
      }))
    : errors.map((err, index) => {
        const rowMatch = err.match(/第 (\d+) 行/)
        return {
          key: index,
          row: rowMatch ? rowMatch[1] : '-',
          activity_id: '-',
          message: err,
        }
      })

  const failColumns = [
    { title: '行号', dataIndex: 'row', key: 'row', width: 70 },
    ...(failedItems.length > 0 ? [{ title: '作业ID', dataIndex: 'activity_id', key: 'activity_id', width: 160 }] : []),
    {
      title: '失败原因',
      dataIndex: 'message',
      key: 'message',
      render: (text: string) => <Text type="danger">{text}</Text>,
    },
  ]

  return (
    <Modal
      title={title}
      open={visible}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          确定
        </Button>,
      ]}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {isCompleteSuccess ? (
          <CheckCircleFilled style={{ fontSize: 48, color: '#52c41a' }} />
        ) : (
          <CloseCircleFilled style={{ fontSize: 48, color: isCompleteFailure ? '#ff4d4f' : '#faad14' }} />
        )}
        <div style={{ marginTop: 16 }}>
          <Space size="large">
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#8c8c8c' }}>成功</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>{result.imported_count}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#8c8c8c' }}>失败</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>{result.error_count}</div>
            </div>
          </Space>
        </div>
      </div>

      {successIds.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Collapse
            items={[
              {
                key: 'success',
                label: <Text strong>成功作业ID（{successIds.length} 条）</Text>,
                children: (
                  <div style={{ maxHeight: 200, overflow: 'auto' }}>
                    {successIds.length <= 20 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {successIds.map((id, i) => (
                          <span key={i} style={{ fontFamily: 'monospace', fontSize: 12 }}>
                            {id}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <Table
                        size="small"
                        dataSource={successIds.map((id, i) => ({ key: i, activity_id: id }))}
                        columns={[{ title: '作业ID', dataIndex: 'activity_id', key: 'activity_id' }]}
                        pagination={{ pageSize: 10, hideOnSinglePage: true }}
                        scroll={{ y: 160 }}
                      />
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {result.error_count > 0 && (
        <>
          <div style={{ marginBottom: 12 }}>
            <Text strong>失败明细（{result.error_count} 条）：</Text>
          </div>
          <Table
            dataSource={errorData}
            columns={failColumns}
            size="small"
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ y: 280 }}
          />
        </>
      )}
    </Modal>
  )
}

export default ImportResultModal
