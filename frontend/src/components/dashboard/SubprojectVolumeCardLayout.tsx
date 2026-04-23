import { useState, useEffect, useRef } from 'react'
import { VolumeControlCardItem } from './CardCarousel'

const ALTERNATIVE_CARDS_PER_PAGE = 7

export interface SubprojectVolumeCardLayoutProps {
  /** 汇总数据 - 作为维度主列表（或配合 masterDimensionList 使用） */
  summaryItems: VolumeControlCardItem[]
  /** ECU 子项目数据 */
  ecuItems: VolumeControlCardItem[]
  /** PEL 子项目数据 */
  pelItems: VolumeControlCardItem[]
  /** UIO 子项目数据 */
  uioItems: VolumeControlCardItem[]
  /** 加载中 */
  loading?: boolean
  /** 主卡片强调色 */
  accentColor?: string
  /** 空数据提示 */
  emptyText?: string
  /** 自动轮播间隔（毫秒），0 表示不自动轮播 */
  autoPlayInterval?: number
  /** 受控：当前选中的维度索引（P/C 同步用） */
  activeIndex?: number
  /** 受控：选中维度变更回调 */
  onActiveIndexChange?: (index: number) => void
  /** 受控：备选卡片当前页码（0-based） */
  page?: number
  /** 受控：备选卡片翻页回调 */
  onPageChange?: (page: number) => void
  /** 受控：统一维度列表（P/C 同步时由父级传入） */
  masterDimensionList?: VolumeControlCardItem[]
}

/** 按 groupName 查找对应项 */
function findItemByGroup(items: VolumeControlCardItem[], groupName: string): VolumeControlCardItem | undefined {
  return items.find((i) => i.groupName === groupName)
}

/** 主卡片：完成百分比 / 总量 / 完成量 / 剩余量 */
function ValueCard({
  label,
  item,
  accentColor,
}: {
  label: string
  item: VolumeControlCardItem | undefined
  accentColor: string
}) {
  const total = item?.estimatedTotal ?? 0
  const completed = item?.arrived ?? 0
  const remaining = Math.max(0, total - completed)
  const ratioPct = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{label}</div>
      <div
        style={{
          flex: 1,
          minHeight: 60,
          background: `linear-gradient(135deg, ${accentColor}22 0%, rgba(30, 41, 59, 0.6) 100%)`,
          border: `1px solid ${accentColor}40`,
          borderRadius: 6,
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 'bold', color: '#fff' }}>{ratioPct}%</div>
        <div style={{ fontSize: 8, color: '#94a3b8' }}>总量 {total.toLocaleString()}</div>
        <div style={{ fontSize: 8, color: '#cbd5e1' }}>完成 {completed.toLocaleString()}</div>
        <div style={{ fontSize: 8, color: '#64748b' }}>剩余 {remaining.toLocaleString()}</div>
      </div>
    </div>
  )
}

/**
 * P/C 板块：汇总最左；卡片结构 完成百分比/总量/完成量/剩余量；备选卡片每页7个；分页针对备选卡片；支持 P/C 同步，汇总自动轮播
 */
export function SubprojectVolumeCardLayout({
  summaryItems,
  ecuItems,
  pelItems,
  uioItems,
  loading = false,
  accentColor = '#3b82f6',
  emptyText = '暂无数据',
  autoPlayInterval = 4000,
  activeIndex: controlledActiveIndex,
  onActiveIndexChange,
  page: controlledPage,
  onPageChange,
  masterDimensionList,
}: SubprojectVolumeCardLayoutProps) {
  // 维度列表：优先使用 masterDimensionList（P/C 同步），否则从 summaryItems 推导
  const derivedList = summaryItems.filter((i) => i.groupName && (i.estimatedTotal ?? 0) > 0)
  const dimensionList = (masterDimensionList && masterDimensionList.length > 0) ? masterDimensionList : derivedList
  const hasItems = dimensionList.length > 0

  const isControlledIndex = controlledActiveIndex !== undefined && onActiveIndexChange !== undefined
  const isControlledPage = controlledPage !== undefined && onPageChange !== undefined

  const [internalIndex, setInternalIndex] = useState(0)
  const [internalPage, setInternalPage] = useState(0)
  const activeIndex = isControlledIndex ? (controlledActiveIndex ?? 0) : internalIndex
  const page = isControlledPage ? (controlledPage ?? 0) : internalPage

  const activeIndexRef = useRef(activeIndex)
  activeIndexRef.current = activeIndex
  const setActiveIndex = (idx: number) => {
    if (isControlledIndex) onActiveIndexChange?.(idx)
    else setInternalIndex(idx)
  }
  const totalPages = Math.ceil(dimensionList.length / ALTERNATIVE_CARDS_PER_PAGE) || 1
  const setPage = (p: number) => {
    const next = Math.max(0, Math.min(p, totalPages - 1))
    if (isControlledPage) onPageChange?.(next)
    else setInternalPage(next)
  }

  const currentGroupName = hasItems ? dimensionList[activeIndex % dimensionList.length].groupName : ''
  const startIdx = page * ALTERNATIVE_CARDS_PER_PAGE
  const visibleAlternatives = dimensionList.slice(startIdx, startIdx + ALTERNATIVE_CARDS_PER_PAGE)

  // 自动轮播：切换选中的维度（含受控模式，通过 onActiveIndexChange 同步 P/C）
  useEffect(() => {
    if (!hasItems || autoPlayInterval <= 0) return
    const timer = setInterval(() => {
      const next = (activeIndexRef.current + 1) % dimensionList.length
      setActiveIndex(next)
    }, autoPlayInterval)
    return () => clearInterval(timer)
  }, [hasItems, autoPlayInterval, dimensionList.length])

  if (loading) {
    return (
      <div style={{
        height: 140,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94a3b8',
        fontSize: 12,
      }}>
        加载中...
      </div>
    )
  }

  if (!hasItems) {
    return (
      <div style={{
        height: 140,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94a3b8',
        fontSize: 12,
      }}>
        {emptyText}
      </div>
    )
  }

  const summaryItem = findItemByGroup(summaryItems, currentGroupName)
  const ecuItem = findItemByGroup(ecuItems, currentGroupName)

  function renderPagination() {
    if (totalPages <= 1) return null
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={() => setPage(page - 1)}
          disabled={page <= 0}
          style={{
            padding: '2px 8px',
            fontSize: 10,
            color: page <= 0 ? '#475569' : '#94a3b8',
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid #334155',
            borderRadius: 4,
            cursor: page <= 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {'<'}
        </button>
        <span style={{ fontSize: 10, color: '#64748b' }}>
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPages - 1}
          style={{
            padding: '2px 8px',
            fontSize: 10,
            color: page >= totalPages - 1 ? '#475569' : '#94a3b8',
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid #334155',
            borderRadius: 4,
            cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
          }}
        >
          {'>'}
        </button>
      </div>
    )
  }
  const pelItem = findItemByGroup(pelItems, currentGroupName)
  const uioItem = findItemByGroup(uioItems, currentGroupName)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      height: '100%',
      minHeight: 0,
    }}>
      <div style={{
        display: 'flex',
        gap: 6,
        flex: 1,
        minHeight: 0,
      }}>
        <ValueCard label="汇总" item={summaryItem} accentColor={accentColor} />
        <ValueCard label="ECU" item={ecuItem} accentColor={accentColor} />
        <ValueCard label="PEL" item={pelItem} accentColor={accentColor} />
        <ValueCard label="UIO" item={uioItem} accentColor={accentColor} />
      </div>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
        {visibleAlternatives.map((item, idx) => {
          const globalIdx = startIdx + idx
          const isActive = globalIdx === activeIndex
          const panelItem = findItemByGroup(summaryItems, item.groupName)
          const itemRatio = panelItem && panelItem.estimatedTotal > 0
            ? Math.round((panelItem.arrived / panelItem.estimatedTotal) * 100)
            : 0
          return (
            <button
              key={item.groupName + globalIdx}
              type="button"
              onClick={() => setActiveIndex(globalIdx)}
              style={{
                flex: '1 1 0',
                minWidth: 52,
                maxWidth: 64,
                padding: '4px 6px',
                background: isActive ? `${accentColor}40` : 'rgba(30, 41, 59, 0.5)',
                border: isActive ? `1px solid ${accentColor}` : '1px solid rgba(71, 85, 105, 0.5)',
                borderRadius: 4,
                cursor: 'pointer',
                textAlign: 'center',
                color: isActive ? '#fff' : '#94a3b8',
                fontSize: 10,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.groupName}>
                {item.groupName}
              </div>
              <div style={{ fontSize: 11, fontWeight: 'bold', marginTop: 2 }}>{itemRatio}%</div>
            </button>
          )
        })}
      </div>
      {renderPagination()}
    </div>
  )
}
