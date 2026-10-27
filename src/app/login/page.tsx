'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthScreen } from '@/components/features/AuthScreen'
import { BackgroundEffect } from '@/components/effects/BackgroundEffect'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    api
      .getSetupStatus()
      .then((status) => {
        if (cancelled) return
        if (!status.initialized) {
          router.replace('/setup')
          return
        }
        if (token && user) {
          router.replace(user.role === 'admin' ? '/' : '/admin')
          return
        }
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [router, token, user])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--color-text-muted)]">加载中...</p>
      </div>
    )
  }

  return (
    <>
      <BackgroundEffect />
      <AuthScreen
        onSuccess={(logged) => router.replace(logged.role === 'admin' ? '/' : '/admin')}
      />
    </>
  )
}
