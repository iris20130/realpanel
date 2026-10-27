'use client'

import { useMemo } from 'react'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { SiteCard } from './SiteCard'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useSiteAccessor } from '@/lib/siteAccess'
import { cn } from '@/lib/utils'
import type { Site } from '@/types'

interface SiteGridProps {
  sites: Site[]
  onDeleteSite?: (id: string) => void
  /** 同排合并时的每行图标数，未传则用响应式列数 */
  columns?: number
}

export function SiteGrid({ sites, onDeleteSite, columns }: SiteGridProps) {
  const { token } = useAuthStore()
  const { editing, viewOnly, viewingUser } = useUiStore()
  const { isVisible } = useSiteAccessor()

  const canEdit = editing && Boolean(token) && !viewingUser && !viewOnly

  const orderedSites = useMemo(
    () =>
      [...sites]
        .filter((site) => (canEdit ? true : site.enabled))
        .sort((a, b) => a.order - b.order),
    [sites, canEdit]
  )

  const displaySites = useMemo(
    () => (canEdit ? orderedSites : orderedSites.filter((site) => isVisible(site))),
    [orderedSites, canEdit, isVisible]
  )

  const grid = (
    <div
      className={cn(
        'grid gap-3 sm:gap-4',
        !columns && 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
      )}
      style={
        columns
          ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
          : undefined
      }
    >
      {displaySites.map((site, index) => (
        <SiteCard key={site.id} site={site} index={index} onDelete={onDeleteSite} />
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
