'use client'

import { useMemo } from 'react'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { SiteCard } from './SiteCard'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { usePrefsStore } from '@/stores/prefs'
import { useSiteAccessor } from '@/lib/siteAccess'
import { cn } from '@/lib/utils'
import type { GroupOrientation, Site } from '@/types'

interface SiteGridProps {
  sites: Site[]
  onDeleteSite?: (id: string) => void
  /** 同排合并时的每行图标数，未传则用响应式列数 */
  columns?: number
  /** 固定高度时的图标行数，用于竖排控制每列图标数 */
  rows?: number
  orientation?: GroupOrientation
}

export function SiteGrid({ sites, onDeleteSite, columns, rows, orientation }: SiteGridProps) {
  const { token } = useAuthStore()
  const { editing, viewOnly, viewingUser } = useUiStore()
  const { isVisible } = useSiteAccessor()
  const viewMode = usePrefsStore((state) => state.viewMode)
  const autoSort = usePrefsStore((state) => state.autoSort)
  const usage = usePrefsStore((state) => state.usage)

  const canEdit = editing && Boolean(token) && !viewingUser && !viewOnly
  const compact = viewMode === 'compact'
  // 编辑时保持手动顺序，便于拖动调整
  const sortByUsage = autoSort && !canEdit

  const orderedSites = useMemo(
    () =>
      [...sites]
        .filter((site) => (canEdit ? true : site.enabled))
        .sort((a, b) => (sortByUsage ? (usage[b.id]?.count ?? 0) - (usage[a.id]?.count ?? 0) || a.order - b.order : a.order - b.order)),
    [sites, canEdit, sortByUsage, usage]
  )

  const displaySites = useMemo(
    () => (canEdit ? orderedSites : orderedSites.filter((site) => isVisible(site))),
    [orderedSites, canEdit, isVisible]
  )

  const vertical = orientation === 'vertical' && Boolean(columns) && !compact
  const rowCount = vertical
    ? rows ?? Math.max(1, Math.ceil(displaySites.length / (columns || 1)))
    : undefined

  const grid = (
    <div
      className={cn(
        'grid',
        compact ? 'gap-2' : 'gap-3 sm:gap-4',
        !columns &&
          (compact
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
            : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6')
      )}
      style={
        columns
          ? {
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              ...(vertical && rowCount
                ? {
                    gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
                    gridAutoFlow: 'column',
                    gridAutoColumns: 'minmax(0, 1fr)',
                  }
                : {}),
            }
          : undefined
      }
    >
      {displaySites.map((site, index) => (
        <SiteCard
          key={site.id}
          site={site}
          index={index}
          onDelete={onDeleteSite}
          compact={compact}
        />
      ))}
    </div>
  )

  if (displaySites.length === 0) {
    return (
      <p className="text-center text-[var(--color-text-muted)] py-8">
        当前网络下暂无网站
      </p>
    )
  }

  if (!canEdit) return grid

  return (
    <SortableContext items={displaySites.map((s) => s.id)} strategy={rectSortingStrategy}>
      {grid}
    </SortableContext>
  )
}
