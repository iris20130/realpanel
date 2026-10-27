'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PortalPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-[var(--color-text-muted)]">正在进入管理面板...</p>
    </div>
  )
}
