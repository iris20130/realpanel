'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ExternalLink, AlertCircle, Maximize2, Minimize2, Minus } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

interface IframeModalProps {
  open: boolean
  onClose: () => void
  url: string
  title: string
}

export function IframeModal({ open, onClose, url, title }: IframeModalProps) {
  const [loadError, setLoadError] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (open) {
      setLoadError(false)
      setMaximized(false)
      setMinimized(false)
    }
  }, [open, url])

  // ESC 关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      window.addEventListener('keydown', handleEsc)
      if (!minimized) document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, minimized, onClose])

  const handleOpenInNewTab = () => {
    window.open(url, '_blank')
    onClose()
  }

  if (!mounted) return null

  return createPortal(
    <>
      {open && (
        <div
          className={cn(
            'fixed inset-0 flex',
            minimized ? 'z-40 items-end justify-end p-3 pointer-events-none' : 'z-50 items-center justify-center'
          )}
        >
          {/* 遮罩 */}
          {!minimized && (
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={onClose}
            />
          )}

          {/* 内容 */}
          <div
            className={cn(
              'relative flex flex-col overflow-hidden bg-[#1a1a2e] shadow-2xl border border-[var(--color-border)] pointer-events-auto',
              minimized
                ? 'h-11 w-72 rounded-lg'
                : maximized
                  ? 'fixed inset-0 w-screen h-screen rounded-none'
                  : 'w-[95vw] h-[90vh] max-w-7xl rounded-xl'
            )}
          >
            {/* 头部 */}
            <div
              className={cn(
                'shrink-0 bg-[#1a1a2e]/95 backdrop-blur-sm flex items-center justify-between gap-2 px-3 sm:px-4',
                minimized ? 'h-full border-0' : 'h-12 border-b border-[var(--color-border)]'
              )}
              onDoubleClick={() => !minimized && setMaximized((v) => !v)}
            >
              <button
                type="button"
                onClick={() => minimized && setMinimized(false)}
                className="text-sm font-medium text-[var(--color-text)] truncate flex-1 text-left"
                title={minimized ? '点击还原窗口' : title}
              >
                {title}
              </button>
              <div className="flex items-center gap-1">
                {minimized ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMinimized(false)}
                      className="p-1.5"
                      title="还原窗口"
                    >
                      <Maximize2 size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onClose} className="p-1.5" title="关闭">
                      <X size={18} />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleOpenInNewTab}
                      className="gap-1.5"
                      title="在新窗口打开"
                    >
                      <ExternalLink size={16} />
                      <span className="hidden sm:inline">新窗口</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMaximized((v) => !v)}
                      className="p-1.5"
                      title={maximized ? '退出全屏' : '全屏'}
                    >
                      {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMinimized(true)}
                      className="p-1.5"
                      title="最小化"
                    >
                      <Minus size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onClose} className="p-1.5" title="关闭">
                      <X size={18} />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* iframe 或错误提示 */}
            <div className={cn('flex-1 min-h-0 w-full', minimized && 'hidden')}>
              {loadError ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center p-8">
                  <AlertCircle size={48} className="text-[var(--color-warning)]" />
                  <div>
                    <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">
                      无法在弹窗中打开此网站
                    </h3>
                    <p className="text-[var(--color-text-muted)] mb-4">
                      该网站禁止被嵌入显示，请在新窗口中打开
                    </p>
                  </div>
                  <Button onClick={handleOpenInNewTab} className="gap-2">
                    <ExternalLink size={18} />
                    在新窗口中打开
                  </Button>
                </div>
              ) : (
                <iframe
                  src={url}
                  className="w-full h-full border-0 bg-white"
                  title={title}
                  onError={() => setLoadError(true)}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
