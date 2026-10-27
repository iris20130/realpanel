'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@/components/icons/Icon'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useSiteAccessor } from '@/lib/siteAccess'
import { useNetwork } from '@/lib/network'
import { parseShareTarget } from '@/lib/share'
import { buildRdpFile, parseRdpTarget } from '@/lib/rdp'
import { getSiteScope, getScopeLabel, cn, copyText } from '@/lib/utils'
import { IframeModal } from '@/components/layout/IframeModal'
import { SiteEditDialog } from './SiteEditDialog'
import { Button } from '@/components/ui'
import type { Site } from '@/types'
import { Edit, Trash2 } from 'lucide-react'

interface SiteCardProps {
  site: Site
  index?: number
  onDelete?: (id: string) => void
}

const menuItemClass =
  'w-full text-left px-3 py-1.5 rounded-md transition-colors hover:bg-[var(--color-primary)]/25 hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:bg-[var(--color-primary)]/25 active:bg-[var(--color-primary)]/35'

const scopeStyles: Record<string, string> = {
  both: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  intranet: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  internet: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  none: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
}

export function SiteCard({ site, index = 0, onDelete }: SiteCardProps) {
  const { token } = useAuthStore()
  const { editing, viewOnly, viewingUser } = useUiStore()
  const { access } = useSiteAccessor()
  const { mode } = useNetwork()
  // 自动与全部显示时提供内外网打开；强制模式只保留对应一侧的复制
  const showOpenItems = mode === 'auto' || mode === 'all'
  const canCopyInternal = (showOpenItems || mode === 'intranet') && Boolean(site.internalUrl)
  const canCopyExternal = (showOpenItems || mode === 'internet') && Boolean(site.externalUrl)
  const rdpInternal = canCopyInternal ? parseRdpTarget(site.internalUrl) : null
  const rdpExternal = canCopyExternal ? parseRdpTarget(site.externalUrl) : null
  const [showIframe, setShowIframe] = useState(false)
  const [iframeUrl, setIframeUrl] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const siteNotice = site.notice?.trim()

  const showToast = (text: string) => setToast(text)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!toast) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setToast(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toast])

  useEffect(() => {
    if (!pendingUrl) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPendingUrl(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingUrl])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

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

  const url = access(site).url
  const scope = getSiteScope(site)
  const scopeLabel = getScopeLabel(scope)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!canCopyInternal && !canCopyExternal) return
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const handleClick = (e: React.MouseEvent) => {
    if (canEdit || !site.enabled) return
    e.preventDefault()
    openUrl(url)
  }

  // 真正的打开动作：共享走系统协议，远程桌面调 mstsc，其余按 openMode
  const performOpen = (target: string) => {
    const share = parseShareTarget(target)
    if (share) {
      openShare(share.smbUrl, share.uncPath)
      return
    }
    const rdp = parseRdpTarget(target)
    if (rdp) {
      openRdp(rdp.uri, rdp.address)
      return
    }
    if (site.openMode === 'modal') {
      setIframeUrl(target)
      setShowIframe(true)
    } else if (site.openMode === 'blank') {
      window.open(target, '_blank', 'noopener,noreferrer')
    } else {
      window.location.href = target
    }
  }

  // 配置了点击提示的站点先弹确认框，确认后才打开或下载
  const openUrl = (target: string) => {
    if (!target) return
    if (siteNotice) {
      setPendingUrl(target)
      return
    }
    performOpen(target)
  }

  // SMB 共享交给系统协议处理器打开资源管理器，同时把 UNC 路径放进剪贴板兜底
  const openShare = (smbUrl: string, uncPath: string) => {
    const frame = document.createElement('iframe')
    frame.style.display = 'none'
    frame.src = smbUrl
    document.body.appendChild(frame)
    window.setTimeout(() => frame.remove(), 2000)

    copyText(uncPath).then((ok) =>
      showToast(
        ok
          ? `已自动复制地址，路径粘贴到资源管理器地址栏：${uncPath}`
          : `请手动复制路径粘贴到资源管理器地址栏：${uncPath}`
      )
    )
  }

  // 远程桌面交给 rdp:// 协议处理器调用 mstsc，未注册协议时可用右键下载 .rdp 文件
  const openRdp = (uri: string, address: string) => {
    const frame = document.createElement('iframe')
    frame.style.display = 'none'
    frame.src = uri
    document.body.appendChild(frame)
    window.setTimeout(() => frame.remove(), 2000)

    showToast(
      `正在调用远程桌面连接：${address}\n若没有弹出，请先在「设置 → 导入导出」导入 RDP 协议支持，或在右键菜单下载 .rdp 连接文件`
    )
  }

  const downloadRdp = (address: string) => {
    const blob = new Blob([buildRdpFile(address)], { type: 'application/x-rdp' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${address.replace(/[^\w.-]+/g, '_')}.rdp`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    showToast(`已下载 ${link.download}，双击即可连接 ${address}`)
  }

  // 复制地址：SMB 共享复制 UNC 路径，面板直链补全成当前访问地址，其余复制原地址
  const copyAddress = async (target: string, label: string) => {
    if (!target) return
    const share = parseShareTarget(target)
    const text =
      share?.uncPath ??
      (target.startsWith('/') ? `${window.location.origin}${target}` : target)
    const ok = await copyText(text)
    showToast(ok ? `已复制${label}：${text}` : `复制失败，请手动复制：${text}`)
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
        whileHover={{ scale: canEdit ? 1.02 : 1.05 }}
        whileTap={{ scale: 0.98 }}
        className={cn('group relative', isDragging && 'opacity-30')}
        {...attributes}
        {...(canEdit ? listeners : {})}
      >
        <div
          ref={cardRef}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
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
      </motion.div>

      <IframeModal
        open={showIframe}
        onClose={() => {
          setShowIframe(false)
          setIframeUrl('')
        }}
        url={iframeUrl || url}
        title={site.title}
      />

      <SiteEditDialog
        open={showEdit}
        onClose={() => setShowEdit(false)}
        site={site}
        onSave={() => setShowEdit(false)}
      />

      {menu &&
        createPortal(
          <div
            className="fixed z-[70] min-w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] shadow-xl p-1 text-sm"
            style={{
              left: Math.min(menu.x, window.innerWidth - 190),
              top: Math.min(menu.y, window.innerHeight - 220),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {showOpenItems && (
              <>
                <p className="px-3 py-1.5 text-[11px] text-[var(--color-text-muted)]">打开地址</p>
                {site.internalUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(null)
                      openUrl(site.internalUrl!)
                    }}
                    className={menuItemClass}
                  >
                    走内网
                  </button>
                )}
                {site.externalUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(null)
                      openUrl(site.externalUrl!)
                    }}
                    className={menuItemClass}
                  >
                    走外网
                  </button>
                )}
                <div className="my-1 h-px bg-[var(--color-border)]" />
              </>
            )}
            {canCopyInternal && (
              <button
                type="button"
                onClick={() => {
                  setMenu(null)
                  copyAddress(site.internalUrl!, '内网地址')
                }}
                className={menuItemClass}
              >
                复制内网地址
              </button>
            )}
            {canCopyExternal && (
              <button
                type="button"
                onClick={() => {
                  setMenu(null)
                  copyAddress(site.externalUrl!, '外网地址')
                }}
                className={menuItemClass}
              >
                复制外网地址
              </button>
            )}
            {rdpInternal && (
              <button
                type="button"
                onClick={() => {
                  setMenu(null)
                  downloadRdp(rdpInternal.address)
                }}
                className={menuItemClass}
              >
                下载内网 RDP 连接文件
              </button>
            )}
            {rdpExternal && (
              <button
                type="button"
                onClick={() => {
                  setMenu(null)
                  downloadRdp(rdpExternal.address)
                }}
                className={menuItemClass}
              >
                下载外网 RDP 连接文件
              </button>
            )}
          </div>,
          document.body
        )}

      {toast &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            onClick={() => setToast(null)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            <div
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-5 text-sm text-[var(--color-text)] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="whitespace-pre-line break-words">{toast}</p>
              <div className="mt-4 flex justify-end">
                <Button size="sm" onClick={() => setToast(null)}>
                  知道了
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {pendingUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            onClick={() => setPendingUrl(null)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${site.title}：打开前确认`}
              className="relative w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-5 text-sm text-[var(--color-text)] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-1 text-xs text-[var(--color-text-muted)]">打开「{site.title}」前请确认</p>
              <p className="whitespace-pre-line break-words">{siteNotice}</p>
              <div className="mt-4 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPendingUrl(null)}>
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const target = pendingUrl
                    setPendingUrl(null)
                    performOpen(target)
                  }}
                >
                  确认打开
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
