import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { CelebrationLayer } from '@/components/effects/CelebrationLayer'
import { BrandingFavicon } from '@/components/layout/BrandingFavicon'
import { readBranding } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const branding = await readBranding().catch(() => null)
  const favicon = branding?.faviconUrl || '/favicon.svg'
  return {
    title: 'realpanel 导航面板',
    description: '多用户导航面板，支持邀请码注册、内外网自动切换与图标自动识别',
    icons: {
      icon: favicon,
      apple: favicon,
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6366f1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased font-sans">
        <ThemeProvider>
          <BrandingFavicon />
          {children}
          <CelebrationLayer />
        </ThemeProvider>
      </body>
    </html>
  )
}
