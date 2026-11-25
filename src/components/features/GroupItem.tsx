'use client'

import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { SiteGrid } from './SiteGrid'
import { GroupEditDialog } from './GroupEditDialog'
import { SiteEditDialog } from './SiteEditDialog'
import { Button } from '@/components/ui'
import { Icon } from '@/components/icons/Icon'
import { useAuthStore } from '@/stores/auth'
import { useSitesStore } from '@/stores/sites'
import { useUiStore } from '@/stores/ui'
import { useSiteAccessor } from '@/lib/siteAccess'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  GROUP_COLUMNS,
  GROUP_HEADER_SPACE,
  GROUP_ROW_UNIT,
  clampGroupCols,
  clampGroupRows,
} from '@/lib/groupLayout'
import type { Group, GroupLayout, Site, SiteIcon, VisibilityMode } from '@/types'
import { Edit, Trash2, Plus, GripVertical } from 'lucide-react'

interface GroupItemProps {
  group: Group
  sites: Site[]
  index?: number
  /** 同排合并时该分组占据的列数（即每行最多显示的图标数），未传则用响应式列数 */
  columns?: number
  /** 桌面端编辑模式显示拉伸手柄 */
  resizable?: boolean
}

export function GroupItem({ group, sites, index = 0, columns, resizable = false }: GroupItemProps) {
  const { token } = useAuthStore()
  const { groups, updateGroup, removeGroup, removeSite } = useSitesStore()
  const { editing, viewOnly, viewingUser } = useUiStore()
  const { isVisible } = useSiteAccessor()
  const [showEdit, setShowEdit] = useState(false)
  const [showAddSite, setShowAddSite] = useState(false)
  const [resizing, setResizing] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  const canEdit = editing && Boolean(token) && !viewingUser && !viewOnly

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isGroupDragging,
  } = useSortable({
    id: group.id,
    disabled: !canEdit || resizing,
  })

  const setCardRef = (node: HTMLDivElement | null) => {
    setNodeRef(node)
    cardRef.current = node
  }

  // 网站跨分组拖动时的落点区域（空分组也能接收）
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `group-drop-${group.id}`,
    disabled: !canEdit,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // 拖动右侧 / 底部 / 右下角调整分组大小，按 8 列网格与图标行高吸附
  const beginResize =
    (axis: 'cols' | 'rows' | 'both') => (event: React.PointerEvent<HTMLDivElement>) => {
      if (!canEdit || !resizable) return
      event.preventDefault()
      event.stopPropagation()
      const el = cardRef.current
      if (!el) return

      const rowEl = el.closest('[data-group-row]') as HTMLElement | null
      const colWidth = Math.max(48, (rowEl?.clientWidth ?? el.clientWidth) / GROUP_COLUMNS)
      const startX = event.clientX
      const startY = event.clientY
      const startCols = group.layout?.cols ?? columns ?? 1
      const startRows =
        group.layout?.rows ??
        Math.max(
          1,
          Math.ceil(Math.max(0, el.offsetHeight - GROUP_HEADER_SPACE) / GROUP_ROW_UNIT)
        )
      let nextLayout: GroupLayout = {
        ...group.layout,
        cols: startCols,
        rows: startRows,
        orientation: group.layout?.orientation || 'horizontal',
      }

      setResizing(true)

      const onMove = (moveEvent: PointerEvent) => {
        let nextCols = startCols
        let nextRows = startRows
        if (axis !== 'rows') {
          nextCols = clampGroupCols(startCols + (moveEvent.clientX - startX) / colWidth)
        }
        if (axis !== 'cols') {
          nextRows = clampGroupRows(startRows + (moveEvent.clientY - startY) / GROUP_ROW_UNIT)
        }
        nextLayout = { ...nextLayout, cols: nextCols, rows: nextRows }
        updateGroup(group.id, { layout: nextLayout })
      }

      const onUp = async () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        setResizing(false)
        if (!token) return
        try {
          const updated = await api.admin.updateGroup(token, group.id, {
            name: group.name,
            layout: nextLayout,
          })
          updateGroup(group.id, { layout: updated.layout })
        } catch (error) {
          console.error('Failed to save group layout:', error)
        }
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    }

  const groupSites = useMemo(
    () => sites.filter((s) => s.groupId === group.id).sort((a, b) => a.order - b.order),
    [sites, group.id]
  )

  const visibleCount = groupSites.filter((site) => site.enabled && isVisible(site)).length

  const handleEditGroup = async (
    name: string,
    visibility: VisibilityMode,
    visibleUserIds: string[],
    layout?: GroupLayout,
    parentId?: string | null,
    icon?: SiteIcon | null
  ) => {
    if (!token) return
    const updated = await api.admin.updateGroup(token, group.id, {
      name,
      parentId: parentId ?? null,
      visibility,
      visibleUserIds,
      layout: layout ?? null,
      icon: icon ?? null,
    })
    updateGroup(group.id, {
      name: updated.name,
      parentId: updated.parentId,
      visibility: updated.visibility,
      visibleUserIds: updated.visibleUserIds,
      layout: updated.layout,
      icon: updated.icon,
    })
    setShowEdit(false)
  }

  const handleDeleteGroup = async () => {
    if (!token) return
    if (!confirm(`确定删除分组「${group.name}」及其下所有网站？子分组也会一并删除。`)) return
    await api.admin.deleteGroup(token, group.id)
    removeGroup(group.id)
  }

  const handleDeleteSite = async (id: string) => {
    if (!token) return
    if (!confirm('确定删除此网站？')) return
    await api.admin.deleteSite(token, id)
    removeSite(id)
  }

  return (
    <>
      <motion.div
        ref={setCardRef}
        style={style}
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.5,
          delay: Math.min(index * 0.08, 0.4),
          ease: [0, 0, 0.2, 1],
        }}
        className={cn(
          'relative h-full flex flex-col p-4 rounded-2xl bg-[var(--color-surface)]/40 border backdrop-blur-[4px]',
          (!columns || columns > 3) && 'sm:p-6',
          canEdit
            ? 'border-[var(--color-primary)]/20'
            : 'border-[var(--color-border)]',
          isGroupDragging && 'opacity-30'
        )}
        data-group-card=""
        {...attributes}
      >
        {/* 分组标题 */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-5 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {canEdit && (
              <div
                {...listeners}
                title="拖动调整分组顺序"
                className="cursor-grab active:cursor-grabbing rounded p-0.5 -m-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] touch-none"
              >
                <GripVertical size={18} className="sm:w-5 sm:h-5" />
              </div>
            )}
            {group.icon && (
              <span className="shrink-0 flex h-6 w-6 items-center justify-center">
                <Icon icon={group.icon} size={20} />
              </span>
            )}
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--color-text)] truncate">{group.name}</h2>
            <span className="text-sm text-[var(--color-text-muted)] shrink-0">
              {canEdit ? `(${groupSites.length})` : `(${visibleCount})`}
            </span>
          </div>

          {canEdit && (
            <div className="flex items-center gap-1 sm:gap-2 ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddSite(true)}
                className="gap-1.5 p-1.5 sm:p-2"
                title="添加网站"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">添加网站</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEdit(true)}
                className="p-1.5 sm:p-2"
                title="编辑分组"
              >
                <Edit size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteGroup}
                className="p-1.5 sm:p-2 text-[var(--color-error)] hover:text-[var(--color-error)]"
                title="删除分组"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          )}
        </div>

        {/* 网站网格 */}
        <div
          ref={canEdit ? setDropRef : undefined}
          className={cn(
            'rounded-xl transition-colors',
            group.layout?.rows && 'flex-1 min-h-0 overflow-y-auto',
            isOver && canEdit && 'ring-2 ring-[var(--color-primary)]/50 bg-[var(--color-primary)]/5'
          )}
        >
          {groupSites.length > 0 ? (
            <SiteGrid
              sites={groupSites}
              columns={columns}
              rows={group.layout?.rows}
              orientation={group.layout?.orientation}
              onDeleteSite={handleDeleteSite}
            />
          ) : (
            <p className="text-center text-[var(--color-text-muted)] py-8">
              {canEdit ? '拖拽网站到此处，或点击上方按钮添加' : '暂无网站'}
            </p>
          )}
        </div>

        {canEdit && resizable && !resizing && (
          <>
            <div
              onPointerDown={beginResize('cols')}
              title="左右拖动调整分组宽度"
              className="absolute right-0 top-1/2 -translate-y-1/2 hidden lg:block w-1.5 h-12 rounded-full bg-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/70 cursor-ew-resize touch-none"
            />
            <div
              onPointerDown={beginResize('rows')}
              title="上下拖动调整分组高度"
              className="absolute bottom-0 left-1/2 -translate-x-1/2 hidden lg:block w-12 h-1.5 rounded-full bg-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/70 cursor-ns-resize touch-none"
            />
            <div
              onPointerDown={beginResize('both')}
              title="拖动同时调整宽高"
              className="absolute right-1 bottom-1 hidden lg:block w-4 h-4 rounded-br-lg border-r-2 border-b-2 border-[var(--color-primary)]/40 hover:border-[var(--color-primary)] cursor-nwse-resize touch-none"
            />
          </>
        )}

        {canEdit && resizable && (
          <span className="absolute right-2 top-2 hidden lg:inline text-[10px] text-[var(--color-text-muted)] pointer-events-none">
            拖拽边缘调整
          </span>
        )}
      </motion.div>

      {/* 编辑分组弹窗 */}
      <GroupEditDialog
        open={showEdit}
        onClose={() => setShowEdit(false)}
        group={group}
        groups={groups}
        onSave={handleEditGroup}
      />

      {/* 添加网站弹窗 */}
      <SiteEditDialog
        open={showAddSite}
        onClose={() => setShowAddSite(false)}
        site={null}
        initialGroupId={group.id}
        onSave={() => setShowAddSite(false)}
      />
    </>
  )
}
