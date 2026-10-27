'use client'

import { useCallback, useEffect, useState } from 'react'
import { Dialog, Button } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'
import type { WebDavEntry } from '@/types'
import { ArrowUp, ChevronRight, Folder, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-react'
import { formatBytes } from '@/lib/utils'

interface WebDavPickerProps {
  open: boolean
  onClose: () => void
  mode?: 'link' | 'icon'
  onSelect: (entry: WebDavEntry) => void
}

export function WebDavPicker({ open, onClose, mode = 'link', onSelect }: WebDavPickerProps) {
  const { token } = useAuthStore()
  const [path, setPath] = useState('/')
  const [entries, setEntries] = useState<WebDavEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async (target: string) => {
      if (!token) return
      setLoading(true)
      setError('')
      try {
        const result = await api.webdav.list(token, target)
        setEntries(result.entries)
        setPath(result.path)
      } catch (err) {
        setEntries([])
        setError(err instanceof Error ? err.message : '读取目录失败')
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  useEffect(() => {
    if (!open) return
    setPath('/')
    setEntries([])
    void load('/')
  }, [open, load])

  const segments = path.split('/').filter(Boolean)
  const parent = segments.length > 1 ? `/${segments.slice(0, -1).join('/')}` : '/'
  const visible = mode === 'icon' ? entries.filter((entry) => entry.isDir || entry.isImage) : entries

  return (
    <Dialog open={open} onClose={onClose} title="从 WebDAV 选择" className="max-w-xl">
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] min-w-0">
          <button
            type="button"
            onClick={() => load('/')}
            className="shrink-0 hover:text-[var(--color-text)]"
          >
            根目录
          </button>
          {segments.map((segment, index) => (
            <span key={`${segment}-${index}`} className="flex items-center gap-1.5 min-w-0">
              <ChevronRight size={12} className="shrink-0" />
              <button
                type="button"
                onClick={() => load(`/${segments.slice(0, index + 1).join('/')}`)}
                className="truncate hover:text-[var(--color-text)]"
              >
                {segment}
              </button>
            </span>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => load(parent)}
              disabled={path === '/' || loading}
              className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] disabled:opacity-40"
              title="上一级"
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              onClick={() => load(path)}
              disabled={loading}
              className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] disabled:opacity-40"
              title="刷新"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </button>
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/60 divide-y divide-[var(--color-border)]">
          {visible.map((entry) => (
            <button
              key={entry.path}
              type="button"
              onClick={() => (entry.isDir ? load(entry.path) : onSelect(entry))}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-hover)]"
            >
              {entry.isDir ? (
                <Folder size={16} className="text-[var(--color-primary)] shrink-0" />
              ) : entry.isImage ? (
                <ImageIcon size={16} className="text-emerald-400 shrink-0" />
              ) : (
                <Folder size={16} className="text-[var(--color-text-muted)] shrink-0" />
              )}
              <span className="truncate flex-1">{entry.name}</span>
              {!entry.isDir && (
                <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                  {formatBytes(entry.size)}
                </span>
              )}
            </button>
          ))}
          {visible.length === 0 && !loading && !error && (
            <p className="px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
              {mode === 'icon' ? '该目录没有可用的图片' : '空目录'}
            </p>
          )}
          {error && <p className="px-3 py-4 text-sm text-[var(--color-error)]">{error}</p>}
        </div>

        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span>
            {mode === 'icon' ? '选择一张图片作为站点图标' : '选好后填入面板直链，内外网下载都不需要账号密码'}
          </span>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            取消
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
