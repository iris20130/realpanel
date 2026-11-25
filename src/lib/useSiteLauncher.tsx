'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IframeModal } from '@/components/layout/IframeModal'
import { Button } from '@/components/ui'
import { usePrefsStore } from '@/stores/prefs'
import { parseShareTarget } from '@/lib/share'
import { parseRdpTarget } from '@/lib/rdp'
import { copyText } from '@/lib/utils'
import type { Network, Site } from '@/types'

interface PendingOpen {
  site: Site
  target: string
  network: Network
}

// 站点的统一打开入口：卡片、最近使用、搜索结果共用，
// 同时负责使用次数统计与「打开前提示」确认框
export function useSiteLauncher() {
  const recordUse = usePrefsStore((state) => state.recordUse)
  const [iframe, setIframe] = useState<{ url: string; title: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingOpen | null>(null)

  const notify = useCallback((text: string) => setToast(text), [])

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
    if (!pending) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPending(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending])

  // SMB 共享交给系统协议处理器打开资源管理器，同时把 UNC 路径放进剪贴板兜底
  const openShare = useCallback(
    (smbUrl: string, uncPath: string, tip?: string) => {
      const frame = document.createElement('iframe')
      frame.style.display = 'none'
      frame.src = smbUrl
      document.body.appendChild(frame)
      window.setTimeout(() => frame.remove(), 2000)

      copyText(uncPath).then((ok) =>
        notify(
          tip?.trim() ||
            (ok
              ? `已自动复制地址，路径粘贴到资源管理器地址栏：${uncPath}`
              : `请手动复制路径粘贴到资源管理器地址栏：${uncPath}`)
        )
      )
    },
    [notify]
  )

  // 远程桌面交给 rdp:// 协议处理器调用 mstsc
  const openRdp = useCallback(
    (uri: string, address: string, tip?: string) => {
      const frame = document.createElement('iframe')
      frame.style.display = 'none'
      frame.src = uri
      document.body.appendChild(frame)
      window.setTimeout(() => frame.remove(), 2000)

      notify(
        tip?.trim() ||
          `正在调用远程桌面连接：${address}\n若没有弹出，请先在「设置 → 导入导出」导入 RDP 协议支持，或在右键菜单下载 .rdp 连接文件`
      )
    },
    [notify]
  )

  const performOpen = useCallback(
    (site: Site, target: string, network: Network) => {
      const share = parseShareTarget(target)
      if (share) {
        openShare(share.smbUrl, share.uncPath, site.launchTip)
      } else {
        const rdp = parseRdpTarget(target)
        if (rdp) {
          openRdp(rdp.uri, rdp.address, site.launchTip)
        } else if (site.openMode === 'modal') {
          setIframe({ url: target, title: site.title })
        } else if (site.openMode === 'blank') {
          window.open(target, '_blank', 'noopener,noreferrer')
        } else {
          window.location.href = target
        }
      }

      recordUse({
        siteId: site.id,
        groupId: site.groupId,
        title: site.title,
        network,
        url: target,
      })
    },
    [openRdp, openShare, recordUse]
  )

  const launch = useCallback(
    (site: Site, target: string | undefined, network: Network) => {
      if (!target) return
      if (site.notice?.trim()) {
        setPending({ site, target, network })
        return
      }
      performOpen(site, target, network)
    },
    [performOpen]
  )

  const overlays = (
    <>
      <IframeModal
        open={Boolean(iframe)}
        onClose={() => setIframe(null)}
        url={iframe?.url ?? ''}
        title={iframe?.title ?? ''}
      />

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

      {pending &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            onClick={() => setPending(null)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${pending.site.title}：打开前确认`}
              className="relative w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-5 text-sm text-[var(--color-text)] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-1 text-xs text-[var(--color-text-muted)]">
                打开「{pending.site.title}」前请确认
              </p>
              <p className="whitespace-pre-line break-words">{pending.site.notice}</p>
              <div className="mt-4 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const task = pending
                    setPending(null)
                    performOpen(task.site, task.target, task.network)
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

  return { launch, notify, overlays }
}
