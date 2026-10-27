'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { SiteGrid } from './SiteGrid'
import { GroupEditDialog } from './GroupEditDialog'
import { SiteEditDialog } from './SiteEditDialog'
import { Button } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { useSitesStore } from '@/stores/sites'
import { useUiStore } from '@/stores/ui'
import { useSiteAccessor } from '@/lib/siteAccess'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Group, Site, VisibilityMode } from '@/types'
import { Edit, Trash2, Plus, GripVertical } from 'lucide-react'

interface GroupItemProps {
  group: Group
  sites: Site[]
  index?: number
  /** 同排合并时该分组占据的列数（即每行最多显示的图标数），未传则用响应式列数 */
  columns?: number
}

export function GroupItem({ group, sites, index = 0, columns }: GroupItemProps) {
  const { token } = useAuthStore()
  const { updateGroup, removeGroup, removeSite } = useSitesStore()
  const { editing, viewOnly, viewingUser } = useUiStore()
  const { isVisible } = useSiteAccessor()
  const [showEdit, setShowEdit] = useState(false)
  const [showAddSite, setShowAddSite] = useState(false)

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
    disabled: !canEdit,
  })

  // 网站跨分组拖动时的落点区域（空分组也能接收）
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `group-drop-${group.id}`,
    disabled: !canEdit,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const groupSites = useMemo(
    () => sites.filter((s) => s.groupId === group.id).sort((a, b) => a.order - b.order),
    [sites, group.id]
  )

  const visibleCount = groupSites.filter((site) => site.enabled && isVisible(site)).length

  const handleEditGroup = async (
    name: string,
    visibility: VisibilityMode,
    visibleUserIds: string[]
  ) => {
    if (!token) return
    const updated = await api.admin.updateGroup(token, group.id, {
      name,
      visibility,
      visibleUserIds,
    })
    updateGroup(group.id, {
      name: updated.name,
      visibility: updated.visibility,
      visibleUserIds: updated.visibleUserIds,
    })
    setShowEdit(false)
  }

  const handleDeleteGroup = async () => {
    if (!token) return
    if (!confirm(`确定删除分组「${group.name}」及其下所有网站？`)) return
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
        ref={setNodeRef}
        style={style}
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.5,
          delay: Math.min(index * 0.08, 0.4),
          ease: [0, 0, 0.2, 1],
        }}
        className={cn(
          'p-4 rounded-2xl bg-[var(--color-surface)]/40 border backdrop-blur-[4px]',
          (!columns || columns > 3) && 'sm:p-6',
          canEdit
            ? 'border-[var(--color-primary)]/20'
            : 'border-[var(--color-border)]',
          isGroupDragging && 'opacity-30'
        )}
        {...attributes}
      >
        {/* 分组标题 */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-5 sm:mb-6">
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
            isOver && canEdit && 'ring-2 ring-[var(--color-primary)]/50 bg-[var(--color-primary)]/5'
          )}
        >
          {groupSites.length > 0 ? (
            <SiteGrid sites={groupSites} columns={columns} onDeleteSite={handleDeleteSite} />
          ) : (
            <p className="text-center text-[var(--color-text-muted)] py-8">
              {canEdit ? '拖拽网站到此处，或点击上方按钮添加' : '暂无网站'}
            </p>
          )}
        </div>
      </motion.div>

      {/* 编辑分组弹窗 */}
      <GroupEditDialog
        open={showEdit}
        onClose={() => setShowEdit(false)}
        group={group}
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
