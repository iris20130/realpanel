'use client'

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@/components/icons/Icon'
import { useAuthStore } from '@/stores/auth'
import { useSitesStore } from '@/stores/sites'
import { useUiStore } from '@/stores/ui'
import { usePrefsStore } from '@/stores/prefs'
import { useSiteAccessor } from '@/lib/siteAccess'
import { GroupEditDialog } from '@/components/features/GroupEditDialog'
import { api } from '@/lib/api'
import { sidebarSurface } from '@/lib/useAccentColor'
import { cn } from '@/lib/utils'
import { LayoutGrid, FolderOpen, Edit, Trash2 } from 'lucide-react'
import type { Group, GroupLayout, SiteIcon, VisibilityMode } from '@/types'

interface CategoryItem {
  id: string
  name: string
  count: number
  icon: SiteIcon | null
}

function useCategories() {
  const { groups, sites } = useSitesStore()
  const { editing, viewOnly, viewingUser } = useUiStore()
  const { token } = useAuthStore()
  const { isVisible } = useSiteAccessor()
  const canEdit = editing && Boolean(token) && !viewingUser && !viewOnly

  return useMemo(() => {
    const sorted = [...groups].sort((a, b) => a.order - b.order)
    const tops = sorted.filter((group) => !group.parentId)
    const childrenOf = (id: string) => sorted.filter((group) => group.parentId === id)

    const usable = sites.filter((site) => canEdit || (site.enabled && isVisible(site)))

    const items: CategoryItem[] = tops.map((group) => {
      const ids = new Set([group.id, ...childrenOf(group.id).map((child) => child.id)])
      const list = usable
        .filter((site) => ids.has(site.groupId))
        .sort((a, b) => a.order - b.order)
      return {
        id: group.id,
        name: group.name,
        count: list.length,
        icon: group.icon ?? list[0]?.icon ?? null,
      }
    })

    return { items, total: usable.length, canEdit }
  }, [groups, sites, canEdit, isVisible])
}

export function SidebarNav({
  variant = 'aside',
  className,
}: {
  variant?: 'aside' | 'chips'
  className?: string
}) {
  const { items, total, canEdit } = useCategories()
  const { groups, updateGroup, removeGroup } = useSitesStore()
  const { token } = useAuthStore()
  const activeId = usePrefsStore((state) => state.sidebarCategoryId)
  const setActiveId = usePrefsStore((state) => state.setSidebarCategoryId)
  const color = usePrefsStore((state) => state.sidebarColor)
  const [editTarget, setEditTarget] = useState<Group | null>(null)

  const handleEditCategory = async (
    name: string,
    visibility: VisibilityMode,
    visibleUserIds: string[],
    layout?: GroupLayout,
    parentId?: string | null,
    icon?: SiteIcon | null
  ) => {
    if (!token || !editTarget) return
    const updated = await api.admin.updateGroup(token, editTarget.id, {
      name,
      parentId: parentId ?? null,
      visibility,
      visibleUserIds,
      layout: layout ?? null,
      icon: icon ?? null,
    })
    updateGroup(editTarget.id, {
      name: updated.name,
      parentId: updated.parentId,
      visibility: updated.visibility,
      visibleUserIds: updated.visibleUserIds,
      layout: updated.layout,
      icon: updated.icon,
    })
    setEditTarget(null)
  }

  const handleDeleteCategory = async (group: Group) => {
    if (!token) return
    if (!confirm(`确定删除一级分组「${group.name}」及其下所有分组与网站？`)) return
    await api.admin.deleteGroup(token, group.id)
    removeGroup(group.id)
  }

  const visibleItems = canEdit ? items : items.filter((item) => item.count > 0)

  useEffect(() => {
    if (activeId === 'all') return
    if (!visibleItems.some((item) => item.id === activeId)) setActiveId('all')
  }, [activeId, visibleItems, setActiveId])

  const entries = [
    { id: 'all', name: '全部', count: total, icon: null as SiteIcon | null },
    ...visibleItems,
  ]

  const itemClass = (active: boolean) =>
    cn(
      'flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors',
      active
        ? 'bg-[var(--color-primary)]/22 text-[var(--color-text)] ring-1 ring-[var(--color-primary)]/40'
        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
    )

  if (variant === 'chips') {
    return (
      <div className={cn('flex gap-2 overflow-x-auto pb-1', className)}>
        {entries.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveId(item.id)}
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
              activeId === item.id
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/20 text-[var(--color-text)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)]/70 text-[var(--color-text-muted)]'
            )}
          >
            {item.icon ? (
              <Icon icon={item.icon} size={14} />
            ) : (
              <LayoutGrid size={13} />
            )}
            {item.name}
            <span className="opacity-60">{item.count}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <nav
      className={cn(
        'rounded-2xl border border-[var(--color-border)] p-2 backdrop-blur-md',
        className
      )}
      style={{ background: sidebarSurface(color) ?? 'var(--color-surface)' }}
    >
      <p className="px-3 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        分组导航
      </p>
      <div className="space-y-1">
        {entries.map((item) => {
          const group = item.id === 'all' ? null : groups.find((g) => g.id === item.id) ?? null
          return (
            <div key={item.id} className="group/cat relative">
              <button
                type="button"
                onClick={() => setActiveId(item.id)}
                className={cn('w-full', itemClass(activeId === item.id), canEdit && group && 'pr-16')}
                title={item.name}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {item.icon ? (
                    <Icon icon={item.icon} size={18} />
                  ) : item.id === 'all' ? (
                    <LayoutGrid size={16} />
                  ) : (
                    <FolderOpen size={16} />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                <span className="text-[11px] text-[var(--color-text-muted)]">{item.count}</span>
              </button>
              {canEdit && group && (
                <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity group-hover/cat:opacity-100">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setEditTarget(group)
                    }}
                    title="编辑一级分组"
                    className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
                  >
                    <Edit size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleDeleteCategory(group)
                    }}
                    title="删除一级分组"
                    className="rounded p-1 text-[var(--color-error)]/80 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-error)]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <GroupEditDialog
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        group={editTarget ?? undefined}
        groups={groups}
        onSave={handleEditCategory}
      />
    </nav>
  )
}
