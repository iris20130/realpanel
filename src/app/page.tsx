'use client'

import { useEffect, useState } from 'react'
import { PanelHome } from '@/components/features/PanelHome'
import { useAuthStore } from '@/stores/auth'

export default function HomePage() {
  const user = useAuthStore((state) => state.user)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-purple-600 animate-pulse" />
      </div>
    )
  }

  return <PanelHome adminMode={user?.role === 'admin'} />
}
