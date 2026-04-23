import { useContext, useEffect, useState, useMemo } from 'react'
import { Modal, Spin, Empty } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { volumeControlServiceV2 } from '../../services/volumeControlServiceV2'
import GlobalFilter, { type GlobalFilterState } from '../common/GlobalFilter'
import { GlobalFilterContext } from '../layout/MainLayout'
import KeyQuantitiesChart, { buildRfiNamesConcat } from './KeyQuantitiesChart'

interface KeyQuantitiesDrawerProps {
  open: boolean
  onClose: () => void
}

/** 从 GlobalFilterState 构建 volume control API 的 filters */
function buildFiltersFromGlobal(g: GlobalFilterState): Record<string, any> {
  const filterObj: Record<string, any> = {}
  if (g.subproject?.length) filterObj.subproject = g.subproject
  if (g.train?.length) filterObj.train = g.train
  if (g.unit?.length) filterObj.unit = g.unit
  if (g.main_block?.length) filterObj.main_block = g.main_block
  if (g.block?.length) filterObj.block = g.block
  if (g.quarter?.length) filterObj.quarter = g.quarter
  if (g.scope?.length) filterObj.scope = g.scope
  if (g.discipline?.length) filterObj.discipline = g.discipline
  if (g.implement_phase?.length) filterObj.implement_phase = g.implement_phase
  if (g.contract_phase?.length) filterObj.contract_phase = g.contract_phase
  if (g.type?.length) filterObj.type = g.type
  if (g.work_package?.length) filterObj.work_package = g.work_package
  if (g.resource_id_name?.length) filterObj.resource_id_name = g.resource_id_name
  if (g.bcc_kq_code?.length) filterObj.bcc_kq_code = g.bcc_kq_code
  if (g.kq?.length) filterObj.kq = g.kq
  if (g.cn_wk_report?.length) filterObj.cn_wk_report = g.cn_wk_report
  return filterObj
}

export default function KeyQuantitiesDrawer({ open, onClose }: KeyQuantitiesDrawerProps) {
  const globalFilterFromContext = useContext(GlobalFilterContext) || {}
  const [localFilter, setLocalFilter] = useState<GlobalFilterState>({})

  useEffect(() => {
    if (open && globalFilterFromContext) {
      setLocalFilter({ ...globalFilterFromContext })
    }
  }, [open])

  const mergedFilters = useMemo(() => buildFiltersFromGlobal(localFilter), [localFilter])

  const { data: items, isLoading, error } = useQuery({
    queryKey: ['volume-control-summary-key-qty', mergedFilters],
    queryFn: () =>
      volumeControlServiceV2.getVolumeControlSummary({
        group_by: 'key_qty',
        filters: mergedFilters,
      }),
    enabled: open,
  })

  // 验收量说明需按 work_package 分组取 rfi（CS01/CS02/CS03/CS04 对应不同 rfi），key_qty 分组会丢失
  const { data: workPackageItems } = useQuery({
    queryKey: ['volume-control-summary-work-package', mergedFilters],
    queryFn: () =>
      volumeControlServiceV2.getVolumeControlSummary({
        group_by: 'work_package',
        filters: mergedFilters,
      }),
    enabled: open,
  })

  const rfiNames = useMemo(
    () => (workPackageItems && workPackageItems.length > 0 ? buildRfiNamesConcat(workPackageItems) : null),
    [workPackageItems]
  )

  return (
    <Modal
      title="Key Quantities"
      open={open}
      onCancel={onClose}
      footer={null}
      width={1600}
      centered
      destroyOnClose
      styles={{
        body: {
          background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
          padding: '16px 24px',
          maxHeight: '85vh',
          overflowY: 'auto',
        },
        header: {
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          color: '#fff',
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
        },
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <GlobalFilter
          value={localFilter}
          onChange={setLocalFilter}
          showDateRange={false}
          compact
        />
      </div>

      {isLoading ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 400,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            borderRadius: 12,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <Spin size="large" tip="加载中..." />
        </div>
      ) : error || !items?.length ? (
        <Empty
          description="暂无数据"
          style={{
            marginTop: 80,
            padding: 48,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            borderRadius: 12,
            color: '#94a3b8',
          }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div
            style={{
              width: '100%',
              flex: '0 0 auto',
              padding: '16px 24px 0',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              borderRadius: 12,
              boxShadow: '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <KeyQuantitiesChart items={items} height={380} compact />
          </div>

          {rfiNames && (
            <div
              style={{
                marginTop: 4,
                padding: '12px 16px',
                background: 'rgba(241, 245, 249, 0.9)',
                borderRadius: 8,
                fontSize: 12,
                color: '#475569',
                border: '1px solid rgba(148, 163, 184, 0.3)',
              }}
            >
              <div style={{ fontWeight: 600, color: '#334155', marginBottom: 6 }}>验收量说明：</div>
              <div style={{ lineHeight: 1.8 }}>
                <div><strong>A：</strong>{rfiNames.rfi_a}</div>
                <div><strong>B：</strong>{rfiNames.rfi_b}</div>
                <div><strong>C：</strong>{rfiNames.rfi_c}</div>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
                未施工 = 设计量 - 施工量（数据库无直接字段，按公式计算）
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
