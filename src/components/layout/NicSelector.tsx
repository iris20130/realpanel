'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { useNicStore } from '@/stores/nic'
import { useNetwork } from '@/lib/network'
import { cn } from '@/lib/utils'
import { Network as NetworkIcon, Check, Plus, X } from 'lucide-react'

// 网卡选择：勾选用于内外网判定的地址，可自定义补录隧道网关等；登录用户按账号记忆，访客存浏览器会话
export function NicSelector() {
  const user = useAuthStore((state) => state.user)
  const { allIps, selected, probing, refresh } = useNetwork()
  const setSelection = useNicStore((state) => state.setSelection)
  const addCustom = useNicStore((state) => state.addCustom)
  const removeCustom = useNicStore((state) => state.removeCustom)
  const guestCustom = useNicStore((state) => state.guestCustom)
  const customByUser = useNicStore((state) => state.customByUser)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const custom = user ? customByUser[user.id] ?? [] : guestCustom
  const userId = user?.id ?? null

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (ip: string) => {
    const next = selected.includes(ip)
      ? selected.filter((item) => item !== ip)
      : [...selected, ip]
    setSelection(userId, next)
  }

  const handleAdd = () => {
    const value = draft.trim()
    if (!value) return
    if (addCustom(userId, value)) {
      // 新增后默认参与识别
      if (!selected.includes(value)) setSelection(userId, [...selected, value])
    }
    setDraft('')
  }

  const handleRemove = (ip: string) => {
    removeCustom(userId, ip)
    setSelection(
      userId,
      selected.filter((item) => item !== ip)
    )
  }

  const active = selected.length > 0
  const title = active
    ? `已选 ${selected.length} 个地址：${selected.join('、')}`
    : '自动使用全部地址识别网络'

  return (
    <div className="relative" ref={ref}>
      <Button
        variant={active ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => setOpen((value) => !value)}
        className="p-1.5 sm:p-2"
        title={`${title}（点击选择网卡/网关）`}
      >
        <NetworkIcon size={18} className={probing ? 'animate-pulse' : ''} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] shadow-xl z-50">
          <div className="px-3 py-2 border-b border-[var(--color-border)]">
            <p className="text-sm font-medium text-[var(--color-text)]">网卡识别</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              {user ? '按账号记住选择' : '访客仅在本次浏览器会话内有效'}
            </p>
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {allIps.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                {probing ? '正在读取网卡…' : '未检测到可用网卡地址'}
              </p>
            ) : (
              allIps.map((ip) => {
                const checked = selected.includes(ip)
                const isCustom = custom.includes(ip)
                return (
                  <div
                    key={ip}
                    className="group flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--color-surface)]"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(ip)}
                      className="flex-1 flex items-center justify-between gap-2 text-left text-xs"
                    >
                      <span className="font-mono text-[var(--color-text)]">
                        {ip}
                        {isCustom && (
                          <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">自定义</span>
                        )}
                      </span>
                      <span
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                          checked
                            ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                            : 'border-[var(--color-border)]'
                        )}
                      >
                        {checked && <Check size={11} />}
                      </span>
                    </button>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => handleRemove(ip)}
                        title="删除该自定义地址"
                        className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div className="px-3 py-2 border-t border-[var(--color-border)] space-y-2">
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="自定义网关/IP，如 192.168.1.1"
                className="flex-1 min-w-0 h-8 px-2 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
              />
              <Button size="sm" variant="secondary" onClick={handleAdd} className="h-8 px-2">
                <Plus size={14} />
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSelection(userId, [])}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                自动（全部地址）
              </button>
              <button
                type="button"
                onClick={() => refresh()}
                className="text-xs text-[var(--color-primary)] hover:opacity-80"
              >
                重新识别
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
