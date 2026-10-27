'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { GroupItem } from './GroupItem'
import { GroupEditDialog } from './GroupEditDialog'
import { Button } from '@/components/ui'
import { Icon } from '@/components/icons/Icon'
import { useAuthStore } from '@/stores/auth'
import { useSitesStore } from '@/stores/sites'
import { useUiStore } from '@/stores/ui'
import { useSiteAccessor } from '@/lib/siteAccess'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Group, Site, VisibilityMode } from '@/types'
import { Plus, Network, PanelLeft, X } from 'lucide-react'

const DROP_PREFIX = 'group-drop-'
const MAX_ROW_ICONS = 8

// 把 active 站点移动到目标分组的目标位置，并重排涉及分组内的 order
function applyMove(
  list: Site[],
  activeId: string,
  targetGroupId: string,
  overSiteId?: string
): Site[] {
  const active = list.find((s) => s.id === activeId)
  if (!active) return list
  const oldGroupId = active.groupId

  const groupSites = (gid: string) =>
    list
      .filter((s) => s.groupId === gid && s.id !== activeId)
      .sort((a, b) => a.order - b.order)

  const targetSites = groupSites(targetGroupId)
  let index = targetSites.length
  if (overSiteId) {
    const overIndex = targetSites.findIndex((s) => s.id === overSiteId)
    if (overIndex !== -1) {
      const inGroup = list
        .filter((s) => s.groupId === targetGroupId)
        .sort((a, b) => a.order - b.order)
      const origOver = inGroup.findIndex((s) => s.id === overSiteId)
      const origActive = inGroup.findIndex((s) => s.id === activeId)
      index = origActive !== -1 && origActive < origOver ? overIndex + 1 : overIndex
    }
  }
  targetSites.splice(index, 0, { ...active, groupId: targetGroupId })

  const result: Site[] = []
  const touched = new Set([targetGroupId, oldGroupId])
  for (const s of list) {
    if (s.id === activeId || touched.has(s.groupId)) continue
    result.push(s)
  }
  for (const gid of touched) {
    const arr = gid === targetGroupId ? targetSites : groupSites(gid)
    arr.forEach((s, i) => result.push({ ...s, groupId: gid, order: i }))
  }
  return result
}

function useIsWide() {
  const [isWide, setIsWide] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsWide(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isWide
}

export function GroupList() {
  const { token } = useAuthStore()
  const { groups, sites, addGroup, reorderGroups, reorderSites } = useSitesStore()
  const { editing, viewOnly, viewingUser, setEditing } = useUiStore()
  const { isVisible } = useSiteAccessor()
  const isWide = useIsWide()
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [localGroups, setLocalGroups] = useState<Group[]>([])
  const [localSites, setLocalSites] = useState<Site[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mobileGroupId, setMobileGroupId] = useState<string>('all')

  const canEdit = editing && Boolean(token) && !viewingUser && !viewOnly

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.order - b.order),
    [groups]
  )

  const displayGroups = useMemo(() => {
    const source = localGroups.length > 0 ? localGroups : sortedGroups
    if (canEdit) return source
    return source.filter((group) =>
      sites.some((site) => site.groupId === group.id && site.enabled && isVisible(site))
    )
  }, [localGroups, sortedGroups, canEdit, sites, isVisible])

  const siteSource = localSites.length > 0 ? localSites : sites

  // 每个分组当前可见的图标数量，用于同一排的合并判断
  const groupCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const group of displayGroups) {
      const count = siteSource.filter(
        (site) =>
          site.groupId === group.id && (canEdit || (site.enabled && isVisible(site)))
      ).length
      map.set(group.id, count)
    }
    return map
  }, [displayGroups, siteSource, canEdit, isVisible])

  // 相邻分组图标数合计不超过 MAX_ROW_ICONS 就放在同一排，超过则换排
  const rows = useMemo(() => {
    const result: { id: string; span: number }[][] = []
    for (const group of displayGroups) {
      const span = Math.min(Math.max(groupCounts.get(group.id) ?? 0, 1), MAX_ROW_ICONS)
      const current = result[result.length - 1]
      const used = current?.reduce((sum, item) => sum + item.span, 0) ?? 0
      if (!current || used + span > MAX_ROW_ICONS) {
        result.push([{ id: group.id, span }])
      } else {
        current.push({ id: group.id, span })
      }
    }
    return result
  }, [displayGroups, groupCounts])

  const groupMap = useMemo(
    () => new Map(displayGroups.map((group) => [group.id, group])),
    [displayGroups]
  )

  const mobileGroup = useMemo(() => {
    if (mobileGroupId === 'all') return null
    return displayGroups.find((group) => group.id === mobileGroupId) ?? null
  }, [mobileGroupId, displayGroups])

  useEffect(() => {
    if (mobileGroupId === 'all') return
    if (!displayGroups.some((group) => group.id === mobileGroupId)) {
      setMobileGroupId('all')
    }
  }, [displayGroups, mobileGroupId])

  const activeGroup = sortedGroups.find((g) => g.id === activeId)
  const activeSite = siteSource.find((s) => s.id === activeId)

  const siteIdSet = useMemo(() => new Set(sites.map((s) => s.id)), [sites])
  const groupIdSet = useMemo(() => new Set(groups.map((g) => g.id)), [groups])

  // 拖站点时优先命中站点卡片，其次命中所属分组的投放区；拖分组时只命中分组容器
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      if (!siteIdSet.has(String(args.active.id))) {
        const groupHits = pointerWithin(args).filter((hit) =>
          groupIdSet.has(String(hit.id))
        )
        if (groupHits.length > 0) return groupHits
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((container) =>
            groupIdSet.has(String(container.id))
          ),
        })
      }
      const hits = pointerWithin(args)
      const cardHit = hits.find((hit) => siteIdSet.has(String(hit.id)))
      if (cardHit) return [cardHit]
      const dropHit = hits.find((hit) => String(hit.id).startsWith(DROP_PREFIX))
      if (dropHit) return [dropHit]
      const groupHit = hits.find((hit) => groupIdSet.has(String(hit.id)))
      return groupHit ? [groupHit] : []
    },
    [siteIdSet, groupIdSet]
  )

  const resolveTarget = (overId: string): { groupId: string; siteId?: string } | null => {
    if (overId.startsWith(DROP_PREFIX)) return { groupId: overId.slice(DROP_PREFIX.length) }
    if (siteIdSet.has(overId)) {
      const site = siteSource.find((s) => s.id === overId)
      return site ? { groupId: site.groupId, siteId: overId } : null
    }
    if (groupIdSet.has(overId)) return { groupId: overId }
    return null
  }

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    setActiveId(id)
    if (siteIdSet.has(id)) {
      setLocalSites(sites)
    } else {
      setLocalGroups(sortedGroups)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeSiteId = String(active.id)
    if (siteIdSet.has(activeSiteId)) {
      const target = resolveTarget(String(over.id))
      if (!target) return
      const moving = siteSource.find((s) => s.id === activeSiteId)
      // 跨分组时才在拖动过程中移动，组内顺序留到松手时按落点调整
      if (!moving || moving.groupId === target.groupId) return
      setLocalSites(applyMove(siteSource, activeSiteId, target.groupId, target.siteId))
      return
    }

    if (localGroups.length === 0) return
    const oldIndex = localGroups.findIndex((g) => g.id === active.id)
    const newIndex = localGroups.findIndex((g) => g.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      setLocalGroups(arrayMove(localGroups, oldIndex, newIndex))
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { over } = event
    const id = String(event.active.id)

    if (siteIdSet.has(id)) {
      let finalSites = localSites.length > 0 ? localSites : sites
      if (over && String(over.id) !== id) {
        const target = resolveTarget(String(over.id))
        if (target) {
          const current = finalSites.find((s) => s.id === id)
          // 已跨组预览时若落点还是同一组、且不是落在具体卡片上，就保持预览位置
          if (target.siteId || !current || target.groupId !== current.groupId) {
            finalSites = applyMove(finalSites, id, target.groupId, target.siteId)
          }
        }
      }

      const orders = finalSites.map((s) => ({
        id: s.id,
        order: s.order,
        groupId: s.groupId,
      }))
      reorderSites(orders)
      if (token) {
        try {
          await api.admin.reorderSites(token, orders)
        } catch (err) {
          console.error('Failed to reorder sites:', err)
        }
      }

      setActiveId(null)
      setLocalSites([])
      return
    }

    setActiveId(null)

    if (over && localGroups.length > 0 && token) {
      const orders = localGroups.map((g, index) => ({
        id: g.id,
        order: index,
      }))
      reorderGroups(orders)

      try {
        await api.admin.reorderGroups(token, orders)
      } catch (err) {
        console.error('Failed to reorder groups:', err)
      }
    }

    setLocalGroups([])
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setLocalGroups([])
    setLocalSites([])
  }

  const handleAddGroup = async (
    name: string,
    visibility: VisibilityMode,
    visibleUserIds: string[]
  ) => {
    if (!token) return
    const newGroup = await api.admin.createGroup(token, name, visibility, visibleUserIds)
    addGroup(newGroup as Group)
    setShowAddGroup(false)
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-text-muted)] mb-4">
          {canEdit ? '暂无分组，先创建一个分组吧' : '暂无内容'}
        </p>
        {canEdit && (
          <Button onClick={() => setShowAddGroup(true)} className="gap-2">
            <Plus size={18} />
            创建第一个分组
          </Button>
        )}
        <GroupEditDialog
          open={showAddGroup}
          onClose={() => setShowAddGroup(false)}
          onSave={handleAddGroup}
        />
      </div>
    )
  }

  if (displayGroups.length === 0) {
    return (
      <div className="text-center py-16">
        <Network className="mx-auto mb-4 text-[var(--color-text-muted)]" size={32} />
        <p className="text-[var(--color-text-muted)] mb-2">
          当前网络下暂无可用网站
        </p>
        <p className="text-sm text-[var(--color-text-muted)] mb-5">
          {canEdit
            ? '点击上方按钮添加分组'
            : '已按内外网范围自动过滤，可切换顶部网络模式查看'}
        </p>
        {canEdit ? (
          <Button variant="secondary" onClick={() => setShowAddGroup(true)} className="gap-2">
            <Plus size={18} />
            添加分组
          </Button>
        ) : (
          token && !viewingUser && !viewOnly && (
            <Button onClick={() => setEditing(true)} className="gap-2">
              <Plus size={18} />
              进入编辑模式添加网站
            </Button>
          )
        )}
        <GroupEditDialog
          open={showAddGroup}
          onClose={() => setShowAddGroup(false)}
          onSave={handleAddGroup}
        />
      </div>
    )
  }

  const groupIndex = new Map(displayGroups.map((group, index) => [group.id, index]))

  const desktopLayout = (
    <div className="space-y-6">
      {rows.map((row) => (
        <div
          key={row.map((item) => item.id).join('-')}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${MAX_ROW_ICONS}, minmax(0, 1fr))` }}
        >
          {row.map((item) => {
            const group = groupMap.get(item.id)
            if (!group) return null
            return (
              <div key={group.id} style={{ gridColumn: `span ${item.span}` }} className="min-w-0">
                <GroupItem
                  group={group}
                  sites={siteSource}
                  index={groupIndex.get(group.id) ?? 0}
                  columns={item.span}
                />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )

  const mobileLayout = (
    <>
      <div className="mb-4 flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setDrawerOpen(true)}
          className="gap-2 shrink-0"
        >
          <PanelLeft size={16} />
          分组
        </Button>
        <span className="text-sm text-[var(--color-text-muted)] truncate">
          {mobileGroup ? mobileGroup.name : '全部显示'}
        </span>
      </div>

      <div className="space-y-6">
        {(mobileGroup ? [mobileGroup] : displayGroups).map((group) => (
          <GroupItem
            key={group.id}
            group={group}
            sites={siteSource}
            index={groupIndex.get(group.id) ?? 0}
          />
        ))}
      </div>
    </>
  )

  return (
    <>
      {canEdit ? (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={displayGroups.map((g) => g.id)} strategy={rectSortingStrategy}>
            {isWide ? desktopLayout : mobileLayout}
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {activeSite ? (
              <div className="cursor-grabbing pointer-events-none scale-90">
                <div className="p-4 rounded-xl bg-[var(--color-surface)] backdrop-blur-xl border border-[var(--color-primary)]/40 shadow-2xl">
                  <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                    <Icon icon={activeSite.icon} size={40} />
                  </div>
                  <h3 className="text-center text-sm font-medium text-[var(--color-text)] truncate mx-auto max-w-28">
                    {activeSite.title}
                  </h3>
                </div>
              </div>
            ) : activeGroup ? (
              <div className="cursor-grabbing">
                <div className="p-6 rounded-2xl bg-[var(--color-surface)] backdrop-blur-xl border border-[var(--color-primary)]/40 shadow-2xl scale-[0.98]">
                  <h2 className="text-xl font-semibold text-[var(--color-text)]">{activeGroup.name}</h2>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : isWide ? (
        desktopLayout
      ) : (
        mobileLayout
      )}

      {canEdit && (
        <div className="mt-6">
          <Button variant="secondary" onClick={() => setShowAddGroup(true)} className="gap-2">
            <Plus size={18} />
            添加分组
          </Button>
        </div>
      )}

      {!isWide && drawerOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 max-w-[80vw] bg-[var(--color-elevated)] border-r border-[var(--color-border)] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-border)]">
              <span className="font-medium text-[var(--color-text)]">分组</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setMobileGroupId('all')
                  setDrawerOpen(false)
                }}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                  mobileGroupId === 'all'
                    ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                )}
              >
                <span className="truncate">全部显示</span>
                <span className="text-xs text-[var(--color-text-muted)]">{displayGroups.length}</span>
              </button>
              {displayGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    setMobileGroupId(group.id)
                    setDrawerOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                    mobileGroupId === group.id
                      ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                      : 'text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                  )}
                >
                  <span className="truncate">{group.name}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {groupCounts.get(group.id) ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <GroupEditDialog
        open={showAddGroup}
        onClose={() => setShowAddGroup(false)}
        onSave={handleAddGroup}
      />
    </>
  )
}
