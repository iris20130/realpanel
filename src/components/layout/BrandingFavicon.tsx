'use client'

import { useEffect } from 'react'
import { useBranding } from '@/lib/useBranding'

// 浏览器标签图标由管理员在「设置 → 品牌设置」指定
export function BrandingFavicon() {
  const branding = useBranding()

  useEffect(() => {
    const href = branding.faviconUrl?.trim()
    if (!href) return
    const link =
      document.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
      (() => {
        const el = document.createElement('link')
        el.rel = 'icon'
        document.head.appendChild(el)
        return el
      })()
    link.href = href
  }, [branding.faviconUrl])

  return null
}
