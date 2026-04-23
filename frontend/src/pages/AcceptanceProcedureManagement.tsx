import { useEffect, useRef, useState } from 'react'
import { Table, Input, Button, Space, App, Tag } from 'antd'
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  acceptanceProcedureService,
  type AcceptanceProcedureITPItem,
  type AcceptanceProcedureGroundFieldRow,
} from '../services/acceptanceProcedureService'
import type { ColumnsType } from 'antd/es/table'

function formatList(arr: string[] | null | undefined): string {
  if (!arr || !Array.isArray(arr)) return ''
  return arr.join('\n')
}

function combineLang(eng: string | null | undefined, rus: string | null | undefined): string {
  const a = (eng ?? '').trim()
  const b = (rus ?? '').trim()
  if (a && b) return `${a}\n------------------\n${b}`
  return a || b
}

const AcceptanceProcedureManagement = () => {
  const { message } = App.useApp()
  const [filterDoc, setFilterDoc] = useState('')
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined)
  const [exporting, setExporting] = useState(false)
  const tableAreaRef = useRef<HTMLDivElement | null>(null)
  const [bodyHeight, setBodyHeight] = useState<number>(360)

  const { data: list, isLoading, refetch, error } = useQuery({
    queryKey: ['acceptance-procedure', filterDoc, filterStatus],
    queryFn: () =>
      acceptanceProcedureService.getList({
        document_number: filterDoc || undefined,
        status: filterStatus,
      }),
  })

  useEffect(() => {
    if (error) {
      const err = error as { response?: { status?: number; data?: { detail?: string } }; message?: string }
      const status = err.response?.status
      const detail = typeof err.response?.data?.detail === 'string' ? err.response.data.detail : undefined
      if (status === 403) {
        message.error(detail || '无验收程序查看权限（需要 acceptance_procedure:read），请联系管理员分配权限')
      } else if (status && status >= 500) {
        message.error(`加载验收程序失败：服务器错误${detail ? ` - ${detail}` : ''}`)
      } else {
        message.error(detail || err.message || '加载验收程序失败，请稍后重试')
      }
    }
  }, [error, message])

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const blob = await acceptanceProcedureService.exportExcel({
        document_number: filterDoc || undefined,
        status: filterStatus,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ITP_Verification_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      message.success('导出成功')
    } catch (e) {
      message.error('导出失败，请稍后重试')
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnsType<AcceptanceProcedureITPItem> = [
    {
      title: 'ITP 文档编号',
      dataIndex: 'document_number',
      key: 'document_number',
      width: 260,
      fixed: 'left',
      ellipsis: true,
    },
    {
      title: 'ITP 名称',
      dataIndex: 'itp_name',
      key: 'itp_name',
      width: 320,
      ellipsis: true,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string | null) => (
        <Tag color={status === 'active' ? 'green' : status === 'draft' ? 'orange' : 'default'}>
          {status || '-'}
        </Tag>
      ),
    },
    {
      title: '明细条数',
      key: 'groundfields_count',
      width: 100,
      align: 'right',
      render: (_: unknown, record: AcceptanceProcedureITPItem) => record.groundfields?.length ?? 0,
    },
  ]

  const renderExpandedRow = (record: AcceptanceProcedureITPItem) => {
    const rows = record.groundfields || []
    if (rows.length === 0) {
      return <div style={{ padding: 12 }}>暂无验收明细</div>
    }

    const innerColumns: ColumnsType<AcceptanceProcedureGroundFieldRow> = [
      {
        title: 'No.',
        dataIndex: 'itp_id',
        key: 'itp_id',
        width: 70,
        align: 'center',
        render: (val: string | null, row: AcceptanceProcedureGroundFieldRow) =>
          row.level === 2 ? '' : (val ?? '-'),
      },
      {
        title: 'Work Description (Eng/Rus)',
        key: 'work_description',
        width: 280,
        render: (_: unknown, row: AcceptanceProcedureGroundFieldRow) => (
          <span className="acceptance-cell-wrap">
            {row.level === 2
              ? ` ${row.itp_id ?? ''} ${row.section_name ?? ''}`
              : combineLang(row.workdescription_eng, row.workdescription_rus)}
          </span>
        ),
      },
      {
        title: 'Applicable Documents',
        key: 'applicable_documents',
        width: 200,
        render: (_: unknown, row: AcceptanceProcedureGroundFieldRow) => (
          <span className="acceptance-cell-wrap">
            {row.level === 2 ? '' : combineLang(formatList(row.applicable_documents_eng ?? undefined), formatList(row.applicable_documents_rus ?? undefined))}
          </span>
        ),
      },
      {
        title: 'Acceptance Criteria',
        key: 'acceptance_criteria',
        width: 220,
        render: (_: unknown, row: AcceptanceProcedureGroundFieldRow) => (
          <span className="acceptance-cell-wrap">
            {row.level === 2 ? '' : combineLang(formatList(row.acceptance_criteria_eng ?? undefined), formatList(row.acceptance_criteria_rus ?? undefined))}
          </span>
        ),
      },
      {
        title: 'Quality Control Form',
        key: 'qc_form',
        width: 180,
        render: (_: unknown, row: AcceptanceProcedureGroundFieldRow) => (
          <span className="acceptance-cell-wrap">
            {row.level === 2 ? '' : combineLang(row.quality_control_form_eng, row.quality_control_form_rus)}
          </span>
        ),
      },
      { title: 'Sub', dataIndex: 'involvement_subcon', key: 'sub', width: 50, align: 'center', render: (v: string | null, row: AcceptanceProcedureGroundFieldRow) => (row.level === 2 ? '' : (v ?? '-')) },
      { title: 'Con', dataIndex: 'involvement_contractor', key: 'con', width: 50, align: 'center', render: (v: string | null, row: AcceptanceProcedureGroundFieldRow) => (row.level === 2 ? '' : (v ?? '-')) },
      { title: 'Cust', dataIndex: 'involvement_customer', key: 'cust', width: 50, align: 'center', render: (v: string | null, row: AcceptanceProcedureGroundFieldRow) => (row.level === 2 ? '' : (v ?? '-')) },
      { title: 'AQC', dataIndex: 'involvement_aqc', key: 'aqc', width: 50, align: 'center', render: (v: string | null, row: AcceptanceProcedureGroundFieldRow) => (row.level === 2 ? '' : (v ?? '-')) },
    ]

    return (
      <Table
        className="acceptance-procedure-inner-table"
        size="small"
        columns={innerColumns}
        dataSource={rows}
        rowKey="id"
        pagination={false}
        rowClassName={(row: AcceptanceProcedureGroundFieldRow) => (row.level === 2 ? 'acceptance-procedure-section-row' : '')}
        style={{ margin: '0 0 12px 0' }}
      />
    )
  }

  useEffect(() => {
    const el = tableAreaRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      const headerH =
        (el.querySelector('.acceptance-procedure-table .ant-table-header') as HTMLElement | null)?.getBoundingClientRect().height ?? 0
      const next = Math.max(160, Math.floor(h - headerH - 16))
      setBodyHeight(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        .acceptance-procedure-table .ant-table-body { overflow-x: auto !important; overflow-y: auto !important; }
        .acceptance-procedure-table .ant-table-content { overflow-x: auto !important; }
        .acceptance-procedure-table .ant-table-container { overflow: hidden; }
        .acceptance-procedure-section-row { background: #f2f2f2 !important; font-weight: 600; }
        /* 验收程序明细表：支持换行显示长文本 */
        .acceptance-procedure-inner-table .ant-table-cell { white-space: pre-wrap; word-break: break-word; vertical-align: top !important; }
        .acceptance-procedure-inner-table .acceptance-cell-wrap { white-space: pre-wrap; word-break: break-word; display: block; }
      `}</style>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>验收程序</h2>
          {list && <Tag color="blue" style={{ margin: 0 }}>共 {list.length} 个 ITP</Tag>}
        </div>
        <Space size="small">
          <Input.Search
            placeholder="ITP 文档编号"
            allowClear
            size="small"
            style={{ width: 220 }}
            value={filterDoc}
            onChange={(e) => setFilterDoc(e.target.value)}
            onSearch={() => refetch()}
            enterButton
          />
          <Button
            size="small"
            onClick={() => setFilterStatus(undefined)}
            type={filterStatus === undefined ? 'primary' : 'default'}
          >
            全部状态
          </Button>
          <Button
            size="small"
            onClick={() => setFilterStatus('active')}
            type={filterStatus === 'active' ? 'primary' : 'default'}
          >
            仅有效
          </Button>
          <Button size="small" onClick={() => { setFilterDoc(''); setFilterStatus(undefined); }}>清除筛选</Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
            刷新
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<DownloadOutlined />}
            onClick={handleExportExcel}
            loading={exporting}
          >
            导出 Excel
          </Button>
        </Space>
      </div>

      <div
        ref={tableAreaRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#ffffff',
          borderRadius: '4px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <Table
            className="acceptance-procedure-table"
            columns={columns}
            dataSource={list ?? []}
            loading={isLoading}
            rowKey="document_number"
            size="small"
            scroll={{ x: 'max-content', y: bodyHeight }}
            pagination={false}
            expandable={{
              expandedRowRender: renderExpandedRow,
              rowExpandable: (record) => (record.groundfields?.length ?? 0) > 0,
            }}
            locale={{ emptyText: isLoading ? '加载中...' : '暂无数据' }}
          />
        </div>
      </div>
    </div>
  )
}

export default AcceptanceProcedureManagement
