import { useEffect, useState, useCallback, useRef } from 'react'

export interface VolumeControlCardItem {
  /** cn_wk_report 维度值 */
  groupName: string
  /** 已到货/已完成量 */
  arrived: number
  /** 预估总量 */
  estimatedTotal: number
  /** 百分比 (arrived/estimatedTotal) */
  ratio: number
}

interface CardCarouselProps {
  /** 卡片数据 */
  items: VolumeControlCardItem[]
  /** 空数据时的提示 */
  emptyText?: string
  /** 加载中 */
  loading?: boolean
  /** 主卡片强调色 */
  accentColor?: string
  /** 自动轮播间隔（毫秒），0 表示不自动轮播 */
  autoPlayInterval?: number
}

const CARD_COUNT = 5
const DEFAULT_AUTOPLAY_MS = 4000

/** 子弹上膛：每展示完一个，刚离开的槽位替换为池中下一维度数据 */
function buildMagazine(
  items: VolumeControlCardItem[],
  magazine: VolumeControlCardItem[],
  nextLoadIndex: number,
  slotToReload: number
): { magazine: VolumeControlCardItem[]; nextLoadIndex: number } {
  if (items.length <= CARD_COUNT) return { magazine: [...items], nextLoadIndex: 0 }
  const nextItem = items[nextLoadIndex % items.length]
  const nextMag = [...magazine]
  nextMag[slotToReload] = nextItem
  return { magazine: nextMag, nextLoadIndex: (nextLoadIndex + 1) % items.length }
}

export const CardCarousel = ({
  items,
  emptyText = '暂无数据',
  loading = false,
  accentColor = '#3b82f6',
  autoPlayInterval = DEFAULT_AUTOPLAY_MS,
}: CardCarouselProps) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const [magazine, setMagazine] = useState<VolumeControlCardItem[]>([])
  const nextLoadIndexRef = useRef(0)

  const hasItems = items.length > 0
  const displayItems = magazine.length >= CARD_COUNT ? magazine : items.slice(0, CARD_COUNT)

  const magazineRef = useRef<VolumeControlCardItem[]>([])
  const activeIndexRef = useRef(0)
  magazineRef.current = displayItems
  activeIndexRef.current = activeIndex

  // items 变化时初始化 magazine 与 nextLoadIndex
  useEffect(() => {
    if (!hasItems) return
    const initial = items.slice(0, CARD_COUNT)
    setMagazine(initial)
    nextLoadIndexRef.current = CARD_COUNT
    setActiveIndex(0)
  }, [items, hasItems])

  const goNext = useCallback(() => {
    if (!hasItems || displayItems.length === 0) return
    const prevIdx = activeIndexRef.current
    const nextIdx = (prevIdx + 1) % CARD_COUNT
    setActiveIndex(nextIdx)
    activeIndexRef.current = nextIdx
    if (items.length > CARD_COUNT) {
      const mag = magazineRef.current
      const { magazine: nextMag, nextLoadIndex } = buildMagazine(
        items,
        mag.length >= CARD_COUNT ? mag : items.slice(0, CARD_COUNT),
        nextLoadIndexRef.current,
        prevIdx
      )
      nextLoadIndexRef.current = nextLoadIndex
      setMagazine(nextMag)
    }
  }, [hasItems, items, displayItems.length])

  const goPrev = useCallback(() => {
    if (!hasItems || displayItems.length === 0) return
    setActiveIndex((prev) => {
      const next = (prev - 1 + CARD_COUNT) % CARD_COUNT
      activeIndexRef.current = next
      return next
    })
  }, [hasItems, displayItems.length])

  useEffect(() => {
    if (!hasItems || autoPlayInterval <= 0) return
    const timer = setInterval(goNext, autoPlayInterval)
    return () => clearInterval(timer)
  }, [hasItems, autoPlayInterval, goNext])

  if (loading) {
    return (
      <div style={{ 
        height: 140, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#94a3b8',
        fontSize: 12
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
        fontSize: 12
      }}>
        {emptyText}
      </div>
    )
  }

  const mainItem = displayItems[activeIndex]
  const ratioPct = mainItem.estimatedTotal > 0 
    ? Math.round((mainItem.arrived / mainItem.estimatedTotal) * 100) 
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', minHeight: 0 }}>
      {/* 主卡片 */}
      <div
        style={{
          flex: 1,
          minHeight: 80,
          background: `linear-gradient(135deg, ${accentColor}22 0%, rgba(30, 41, 59, 0.6) 100%)`,
          border: `1px solid ${accentColor}40`,
          borderRadius: 6,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: `0 0 12px ${accentColor}30`,
        }}
      >
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{mainItem.groupName}</div>
        <div style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>{ratioPct}%</div>
        <div style={{ fontSize: 10, color: '#cbd5e1' }}>
          {mainItem.arrived.toLocaleString()} / {mainItem.estimatedTotal.toLocaleString()}
        </div>
      </div>

      {/* 小卡片列表：5 张循环展示 */}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
        {displayItems.map((item, idx) => {
          const isActive = idx === activeIndex
          const itemRatio = item.estimatedTotal > 0 
            ? Math.round((item.arrived / item.estimatedTotal) * 100) 
            : 0
          return (
            <button
              key={item.groupName + idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
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

      {/* 左右切换按钮（可选，在小空间内可隐藏以节省空间） */}
      {displayItems.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={goPrev}
            style={{
              padding: '2px 8px',
              fontSize: 10,
              color: '#94a3b8',
              background: 'rgba(30, 41, 59, 0.5)',
              border: '1px solid #334155',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            ‹
          </button>
          <span style={{ fontSize: 10, color: '#64748b' }}>
            {activeIndex + 1} / {displayItems.length}
          </span>
          <button
            type="button"
            onClick={goNext}
            style={{
              padding: '2px 8px',
              fontSize: 10,
              color: '#94a3b8',
              background: 'rgba(30, 41, 59, 0.5)',
              border: '1px solid #334155',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
