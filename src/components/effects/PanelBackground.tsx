'use client'

import { BackgroundEffect } from '@/components/effects/BackgroundEffect'
import { useBranding } from '@/lib/useBranding'
import { usePrefsStore } from '@/stores/prefs'

// 自定义壁纸优先于默认动态背景；都没有时保留原 CSS 动态背景
export function PanelBackground() {
  const branding = useBranding()
  const override = usePrefsStore((state) => state.wallpaperUrl)
  const url = (override || branding.wallpaperUrl || '').trim()

  if (!url) return <BackgroundEffect />

  return (
    <div
      className="fixed inset-0 pointer-events-none bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url("${url}")`, zIndex: 0 }}
      aria-hidden
    >
      <div className="absolute inset-0 bg-black/30" />
    </div>
  )
}
