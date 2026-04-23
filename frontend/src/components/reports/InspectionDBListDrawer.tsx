import { useMemo } from 'react'
import { Drawer, Table, Button, Space, Popconfirm, Typography } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { reportService } from '../../services/reportService'
import type { InspectionDBResponse } from '../../types/report'
import { formatQuantity } from '../../utils/formatNumber'
import dayjs from 'dayjs'

type InspectionItem = InspectionDBResponse & { has_input?: boolean; has_output?: boolean }

interface InspectionDBListDrawerProps {
  open: boolean
  onClose: () => void
  /** 当前作业 ID，只拉取该作业下的 RFI 清单 */
  activityId: string | null
  onEdit: (record: InspectionDBResponse) => void
  onDelete: (id: number) => void
  deletePending?: boolean
}

export default function InspectionDBListDrawer({
  open,
  onClose,
  activityId,
  onEdit,
  onDelete,
  deletePending = false,
}: InspectionDBListDrawerProps) {
  const queryClient = useQueryClient()

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['inspectiondb-list', activityId ?? ''],
    queryFn: () =>
      reportService.getInspectionDB({
        activity_id: activityId ?? undefined,
        skip: 0,
        limit: 500,
        count_total: true,
        include_attachment_status: true,
      }),
    enabled: open && !!activityId,
  })

  const items: InspectionItem[] = listData?.items ?? []

  // 当前作业的汇总：RFI 条数、关键 RFI(A/B/C) 验收量合计（仅此 activity_id）
  const { keyRfiQuantitySum } = useMemo(() => {
    let sum = 0
    for (const r of items) {
      if (r.is_key_rfi_aggregation && r.rfi_quantity != null && r.rfi_quantity !== '') {
        const q = typeof r.rfi_quantity === 'number' ? r.rfi_quantity : parseFloat(String(r.rfi_quantity))
        if (!Number.isNaN(q)) sum += q
      }
    }
    return { keyRfiQuantitySum: sum }
  }, [items])

  const handleDelete = (id: number) => {
    onDelete(id)
    queryClient.invalidateQueries({ queryKey: ['inspectiondb-list'] })
    queryClient.invalidateQueries({ queryKey: ['inspectiondb-by-activities'] })
  }

  const columns = [
    {
      title: 'RFI 编号',
      dataIndex: 'rfi_id',
      key: 'rfi_id',
      width: 220,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '验收结论',
      dataIndex: 'inspection_conclusion',
      key: 'inspection_conclusion',
      width: 100,
      render: (v: string) => {
        if (!v) return <span style={{ color: '#999' }}>待定</span>
        if (String(v).toUpperCase().includes('ACC') || (v && v.includes('通过'))) return <span style={{ color: '#52c41a' }}>{v}</span>
        if (String(v).toUpperCase().includes('REJ') || (v && v.includes('拒绝'))) return <span style={{ color: '#ff4d4f' }}>{v}</span>
        return v
      },
    },
    {
      title: '附件',
      key: 'attachment',
      width: 120,
      render: (_: unknown, r: InspectionItem) => (
        <Space size={4}>
          <span title="INPUT 申请文件">{r.has_input ? '✓INPUT' : '—INPUT'}</span>
          <span title="OUTPUT 审批文件">{r.has_output ? '✓OUTPUT' : '—OUTPUT'}</span>
        </Space>
      ),
    },
    {
      title: '验收量',
      dataIndex: 'rfi_quantity',
      key: 'rfi_quantity',
      width: 100,
      align: 'right' as const,
      render: (v: string | number) => (v != null && v !== '' ? formatQuantity(v) : '-'),
    },
    {
      title: '关键 RFI',
      dataIndex: 'is_key_rfi_aggregation',
      key: 'is_key_rfi_aggregation',
      width: 80,
      align: 'center' as const,
      render: (v: boolean) => (v ? 'A/B/C' : '-'),
    },
    {
      title: '计划验收日期',
      dataIndex: 'rfi_inspection_date',
      key: 'rfi_inspection_date',
      width: 110,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, record: InspectionDBResponse) => (
        <Space size={4}>
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条验收记录吗？"
            description="该操作不可恢复，且会一并删除关联的所有附件文件。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger style={{ padding: 0 }} loading={deletePending}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Drawer
      title={`RFI 清单 · 作业 ${activityId ?? ''}`}
      placement="right"
      width={900}
      onClose={onClose}
      open={open}
      destroyOnClose
    >
      <style>{`
        .inspection-drawer-table .ant-table-container { border-radius: 8px; overflow: hidden; }
        .inspection-drawer-table .ant-table-thead > tr > th {
          background: linear-gradient(180deg, #f8f9fc 0%, #eef0f5 100%) !important;
          color: #374151;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          border-bottom: 1px solid #e5e7eb;
          padding: 10px 12px;
        }
        .inspection-drawer-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f0f1f3;
          padding: 10px 12px;
          font-size: 13px;
        }
        .inspection-drawer-table .ant-table-tbody > tr:hover > td {
          background: #f8fafc !important;
        }
        .inspection-drawer-table .ant-table-tbody > tr:last-child > td { border-bottom: none; }
        .inspection-drawer-table .ant-table { background: #fff; }
        .inspection-drawer-table .ant-table-placeholder .ant-table-cell { border-bottom: none; color: #9ca3af; }
      `}</style>
      {listLoading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>加载中…</div>
      ) : (
        <div>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            本作业 RFI 数：{items.length}；关键 RFI（A/B/C）验收量合计：{formatQuantity(keyRfiQuantitySum)}
          </Typography.Text>
          <div className="inspection-drawer-table">
            <Table
              size="small"
              dataSource={items}
              rowKey="id"
              columns={columns}
              scroll={{ x: 720 }}
              pagination={false}
              locale={{ emptyText: '暂无已登记 RFI' }}
            />
          </div>
        </div>
      )}
    </Drawer>
  )
}
