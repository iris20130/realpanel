'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { BackgroundEffect } from '@/components/effects/BackgroundEffect'
import { GroupList } from '@/components/features/GroupList'
import { AuthScreen } from '@/components/features/AuthScreen'
import { useSitesStore } from '@/stores/sites'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { api } from '@/lib/api'
import { ArrowLeft, Eye } from 'lucide-react'
import { Button } from '@/components/ui'

type Stage = 'checking' | 'auth' | 'ready' | 'error'

export function PanelHome({ adminMode }: { adminMode: boolean }) {
  const router = useRouter()
  const token = useAuthStore((state) => state.token)
  const setUser = useAuthStore((state) => state.setUser)
  const logout = useAuthStore((state) => state.logout)
  const viewingUser = useUiStore((state) => state.viewingUser)
  const setViewingUser = useUiStore((state) => state.setViewingUser)
  const setEditing = useUiStore((state) => state.setEditing)
  const setViewOnly = useUiStore((state) => state.setViewOnly)
  const resetUi = useUiStore((state) => state.reset)
  const { setData, setLoading } = useSitesStore()
  const [stage, setStage] = useState<Stage>('checking')
  const [adminName, setAdminName] = useState<string | null>(null)
  const [viewerName, setViewerName] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const viewingUserId = adminMode ? viewingUser?.id : undefined

  useEffect(() => {
    let cancelled = false

    async function boot() {
      setError('')
      try {
        const status = await api.getSetupStatus()
        if (cancelled) return
        if (!status.initialized) {
          router.replace('/setup')
          return
        }

        if (!adminMode) {
          resetUi()
          setViewOnly(true)
          setLoading(true)
          const result = await api.getPublicPanel(token)
          if (cancelled) return
          setAdminName(result.adminName)
          setViewerName(result.viewerName)
          if (token && !result.viewerName) logout()
          setData(result.panel)
          setStage('ready')
          return
        }

        if (!token) {
          setEditing(false)
          setViewOnly(false)
          setStage('auth')
          return
        }

        let current
        try {
          current = await api.me(token)
        } catch {
          if (cancelled) return
          logout()
          resetUi()
          setStage('auth')
          return
        }
        if (cancelled) return

        if (viewingUserId && current.role !== 'admin') {
          setViewingUser(null)
        }
        setUser(current)
        setViewOnly(false)

        setLoading(true)
        const panel = viewingUserId
          ? (await api.admin.getUserPanel(token, viewingUserId)).panel
          : await api.getPanel(token)

        if (cancelled) return
        setData(panel)
        setStage('ready')
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : '加载失败')
        setStage('error')
        setLoading(false)
      }
    }

    boot()
    return () => {
      cancelled = true
    }
  }, [
    adminMode,
    token,
    viewingUserId,
    reloadKey,
    router,
    setData,
    setLoading,
    setUser,
    logout,
    resetUi,
    setEditing,
    setViewOnly,
    setViewingUser,
  ])

  if (stage === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-purple-600 animate-pulse" />
          <p className="text-[var(--color-text-muted)]">加载中...</p>
        </div>
      </div>
    )
  }

  if (stage === 'auth') {
    return (
      <>
        <BackgroundEffect />
        <AuthScreen />
      </>
    )
  }

  if (stage === 'error') {
    return (
      <>
        <BackgroundEffect />
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <p className="text-[var(--color-error)] mb-4">{error}</p>
            <Button onClick={() => setReloadKey((key) => key + 1)}>重新加载</Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <BackgroundEffect />
      <div className="min-h-screen relative pt-16">
        <Header guest={!adminMode} onMemberLogin={() => router.push('/login')} />
        {adminMode && viewingUser && (
          <div className="sticky top-14 sm:top-16 z-30 bg-[var(--color-primary)]/10 border-b border-[var(--color-primary)]/30 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-11 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-[var(--color-text)] min-w-0">
                <Eye size={16} className="shrink-0 text-[var(--color-primary)]" />
                <span className="truncate">
                  正在查看 <strong>{viewingUser.username}</strong> 的面板（只读）
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingUser(null)}
                className="gap-1.5 shrink-0"
              >
                <ArrowLeft size={16} />
                返回我的面板
              </Button>
            </div>
          </div>
        )}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!adminMode && adminName && (
            <p className="mb-5 text-sm text-[var(--color-text-muted)]">
              {adminName} 的导航面板
              {viewerName ? ` · 当前成员：${viewerName}` : ' · 未登录仅显示公开内容'}
            </p>
          )}
          <GroupList />
        </main>
      </div>
    </>
  )
}
