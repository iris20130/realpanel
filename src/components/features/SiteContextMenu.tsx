'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNetwork } from '@/lib/network'
import { parseShareTarget } from '@/lib/share'
import { buildRdpFile, parseRdpTarget } from '@/lib/rdp'
import { copyText } from '@/lib/utils'
import type { Site } from '@/types'
import type { useSiteLauncher } from '@/lib/useSiteLauncher'

type Launcher = Pick<ReturnType<typeof useSiteLauncher>, 'launch' | 'notify'>

const menuItemClass =
  'w-full text-left px-3 py-1.5 rounded-md transition-colors hover:bg-[var(--color-primary)]/25 hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:bg-[var(--color-primary)]/25 active:bg-[var(--color-primary)]/35'

interface SiteContextMenuProps {
  site: Site
  x: number
  y: number
  onClose: () => void
  launcher: Launcher
}

export function SiteContextMenu({ site, x, y, onClose, launcher }: SiteContextMenuProps) {
  const { mode } = useNetwork()
  const { launch, notify } = launcher
  const showOpenItems = mode === 'auto' || mode === 'all'
  const canCopyInternal = (showOpenItems || mode === 'intranet') && Boolean(site.internalUrl)
  const canCopyExternal = (showOpenItems || mode === 'internet') && Boolean(site.externalUrl)
  const rdpInternal = canCopyInternal ? parseRdpTarget(site.internalUrl) : null
  const rdpExternal = canCopyExternal ? parseRdpTarget(site.externalUrl) : null

  useEffect(() => {
    const close = () => onClose()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const downloadRdp = (address: string) => {
    const blob = new Blob([buildRdpFile(address)], { type: 'application/x-rdp' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${address.replace(/[^\w.-]+/g, '_')}.rdp`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    notify(`已下载 ${link.download}，双击即可连接 ${address}`)
  }

  // 复制地址：SMB 共享复制 UNC 路径，面板直链补全成当前访问地址，其余复制原地址
  const copyAddress = async (target: string, label: string) => {
    if (!target) return
    const share = parseShareTarget(target)
    const text =
      share?.uncPath ??
      (target.startsWith('/') ? `${window.location.origin}${target}` : target)
    const ok = await copyText(text)
    notify(ok ? `已复制${label}：${text}` : `复制失败，请手动复制：${text}`)
  }

  return createPortal(
    <div
      className="fixed z-[70] min-w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] shadow-xl p-1 text-sm"
      style={{
        left: Math.min(x, window.innerWidth - 190),
        top: Math.min(y, window.innerHeight - 220),
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {showOpenItems && (
        <>
          <p className="px-3 py-1.5 text-[11px] text-[var(--color-text-muted)]">打开地址</p>
          {site.internalUrl && (
            <button
              type="button"
              onClick={() => {
                onClose()
                launch(site, site.internalUrl!, 'intranet')
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
                onClose()
                launch(site, site.externalUrl!, 'internet')
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
            onClose()
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
            onClose()
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
            onClose()
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
            onClose()
            downloadRdp(rdpExternal.address)
          }}
          className={menuItemClass}
        >
          下载外网 RDP 连接文件
        </button>
      )}
    </div>,
    document.body
  )
}

// 卡片与搜索结果的右键菜单共用：返回打开函数和需要渲染的菜单节点
export function useSiteContextMenu(launcher: Launcher) {
  const { mode } = useNetwork()
  const [menu, setMenu] = useState<{ site: Site; x: number; y: number } | null>(null)

  const openMenu = (site: Site, event: React.MouseEvent) => {
    const showOpenItems = mode === 'auto' || mode === 'all'
    const canCopyInternal = (showOpenItems || mode === 'intranet') && Boolean(site.internalUrl)
    const canCopyExternal = (showOpenItems || mode === 'internet') && Boolean(site.externalUrl)
    if (!canCopyInternal && !canCopyExternal) return
    event.preventDefault()
    event.stopPropagation()
    setMenu({ site, x: event.clientX, y: event.clientY })
  }

  const menuNode = menu ? (
    <SiteContextMenu
      site={menu.site}
      x={menu.x}
      y={menu.y}
      onClose={() => setMenu(null)}
      launcher={launcher}
    />
  ) : null

  return { openMenu, menuNode }
}
