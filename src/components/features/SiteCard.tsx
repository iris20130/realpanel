'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@/components/icons/Icon'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useSiteAccessor } from '@/lib/siteAccess'
import { getSiteScope, getScopeLabel, cn } from '@/lib/utils'
import { useSiteLauncher } from '@/lib/useSiteLauncher'
import { SiteEditDialog } from './SiteEditDialog'
import { useSiteContextMenu } from './SiteContextMenu'
import { Button } from '@/components/ui'
import type { Site } from '@/types'
import { Edit, Trash2 } from 'lucide-react'

interface SiteCardProps {
  site: Site
  index?: number
  onDelete?: (id: string) => void
  /** 列表视图：小图标 + 名称的单行样式 */
  compact?: boolean
}

const scopeStyles: Record<string, string> = {
  both: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  intranet: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  internet: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  none: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
}

export function SiteCard({ site, index = 0, onDelete, compact = false }: SiteCardProps) {
  const { token } = useAuthStore()
  const { editing, viewOnly, viewingUser } = useUiStore()
  const { access } = useSiteAccessor()
  const launcher = useSiteLauncher()
  const { launch, overlays } = launcher
  const { openMenu, menuNode } = useSiteContextMenu(launcher)
  const [showEdit, setShowEdit] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const canEdit = editing && Boolean(token) && !viewingUser && !viewOnly

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: site.id,
    disabled: !canEdit,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const accessResult = access(site)
  const url = accessResult.url
  const scope = getSiteScope(site)
  const scopeLabel = getScopeLabel(scope)

  const handleClick = (e: React.MouseEvent) => {
    if (canEdit || !site.enabled) return
    e.preventDefault()
    launch(site, url, accessResult.network ?? 'internet')
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current || canEdit) return

    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const rotateX = (y - centerY) / 10
    const rotateY = (centerX - x) / 10

    cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`
  }

  const handleMouseLeave = () => {
    if (!cardRef.current) return
    cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)'
  }

  return (
    <>
      <motion.div
        ref={setNodeRef}
        style={style}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.4,
          delay: Math.min(index * 0.04, 0.3),
          ease: [0, 0, 0.2, 1],
        }}
        whileHover={{ scale: canEdit ? 1.02 : compact ? 1.02 : 1.05 }}
        whileTap={{ scale: 0.98 }}
        className={cn('group relative', isDragging && 'opacity-30')}
        data-site-card=""
        {...attributes}
        {...(canEdit ? listeners : {})}
      >
        {compact ? (
          <div
            ref={cardRef}
            onClick={handleClick}
            onContextMenu={(e) => openMenu(site, e)}
            title={site.description || scopeLabel}
            className={cn(
              'relative flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--color-surface)]/60 border border-[var(--color-border)]',
              'transition-colors cursor-pointer',
              !canEdit && 'hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]',
              canEdit && 'cursor-grab active:cursor-grabbing',
              !site.enabled && 'opacity-40 grayscale'
            )}
          >
            <span className="shrink-0 flex items-center justify-center">
              <Icon icon={site.icon} size={18} />
            </span>
            <span className="truncate flex-1 text-sm text-[var(--color-text)]">{site.title}</span>
            {!site.enabled && (
              <span className="shrink-0 text-[10px] text-[var(--color-error)]">已禁用</span>
            )}
            {canEdit && (
              <span className="shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowEdit(true)
                  }}
                  title="编辑网站"
                >
                  <Edit size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 text-[var(--color-error)] hover:text-[var(--color-error)]"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete?.(site.id)
                  }}
                  title="删除网站"
                >
                  <Trash2 size={13} />
                </Button>
              </span>
            )}
          </div>
        ) : (
          <div
            ref={cardRef}
            onClick={handleClick}
            onContextMenu={(e) => openMenu(site, e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={cn(
              'card-3d-inner relative p-4 rounded-xl bg-[var(--color-surface)]/75 border border-[var(--color-border)]',
              'transition-all duration-300 cursor-pointer',
              !canEdit && 'hover:border-[var(--color-primary)] hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]',
              canEdit && 'cursor-grab active:cursor-grabbing',
              !site.enabled && 'opacity-40 grayscale'
            )}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* 网络范围标记 */}
            <span
              className={cn(
                'absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] leading-none font-medium border',
                scopeStyles[scope ?? 'none']
              )}
              title={`显示范围：${scopeLabel}`}
            >
              {scope === 'both' ? '内外' : scope === 'intranet' ? '内网' : scope === 'internet' ? '外网' : '未配置'}
            </span>

            {/* 图标 */}
            <div className="w-12 h-12 mx-auto mb-3 mt-1 flex items-center justify-center">
              <Icon icon={site.icon} size={40} />
            </div>

            {/* 标题 */}
            <h3 className="text-center text-sm font-medium text-[var(--color-text)] truncate">
              {site.title}
            </h3>

            {!site.enabled && (
              <p className="text-center text-[10px] text-[var(--color-error)] mt-1">已禁用</p>
            )}

            {/* 描述 */}
            {site.description && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {site.description}
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
              </div>
            )}

            {/* 管理按钮 */}
            {canEdit && (
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 bg-[var(--color-background)]/70"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowEdit(true)
                  }}
                  title="编辑网站"
                >
                  <Edit size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 bg-[var(--color-background)]/70 text-[var(--color-error)] hover:text-[var(--color-error)]"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete?.(site.id)
                  }}
                  title="删除网站"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            )}
          </div>
        )}
      </motion.div>

      <SiteEditDialog
        open={showEdit}
        onClose={() => setShowEdit(false)}
        site={site}
        onSave={() => setShowEdit(false)}
      />

      {menuNode}

      {overlays}
    </>
  )
}
