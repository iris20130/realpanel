'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button, Input } from '@/components/ui'
import { BrandMark } from '@/components/layout/BrandMark'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useBranding } from '@/lib/useBranding'
import { api } from '@/lib/api'
import { celebrate } from '@/components/effects/CelebrationLayer'
import { useNetworkStore } from '@/lib/network'
import { useSitesStore } from '@/stores/sites'
import type { PublicUser } from '@/types'
import { LogIn, UserPlus, Ticket, Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register'

export function AuthScreen({ onSuccess }: { onSuccess?: (user: PublicUser) => void }) {
  const login = useAuthStore((state) => state.login)
  const themeMode = useThemeStore((state) => state.mode)
  const cycleMode = useThemeStore((state) => state.cycleMode)
  const branding = useBranding()
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const invite = params.get('invite')
    if (invite) {
      setInviteCode(invite.toUpperCase())
      setMode('register')
    }
  }, [])

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const name = username.trim()
    if (!name || !password) {
      setError('请输入用户名和密码')
      return
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致')
        return
      }
      if (!inviteCode.trim()) {
        setError('请输入管理员邀请码')
        return
      }
    }

    setLoading(true)
    try {
      const result =
        mode === 'login'
          ? await api.login(name, password)
          : await api.register(name, password, inviteCode.trim().toUpperCase())
      login(result.token, result.user)
      celebrate()
      useNetworkStore.getState().detect(
        useSitesStore.getState().sites.map((s) => s.internalUrl).filter((u): u is string => Boolean(u)),
        true
      )
      onSuccess?.(result.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'login' ? '登录失败' : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  const ThemeIcon = themeMode === 'dark' ? Moon : themeMode === 'light' ? Sun : Monitor

  return (
    <div className="min-h-screen flex items-center justify-center py-16 px-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-[var(--color-primary)]/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-3xl" />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--color-primary)]/10 rounded-full blur-3xl"
        />
      </div>

      <button
        type="button"
        onClick={cycleMode}
        title={`主题：${themeMode === 'dark' ? '暗色' : themeMode === 'light' ? '亮色' : '跟随系统'}`}
        className="absolute top-5 right-5 z-10 p-2.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
      >
        <ThemeIcon size={20} />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          {branding.mode !== 'none' && (
            <div className="flex items-center justify-center mb-4 min-h-9">
              <BrandMark
                branding={branding}
                imageClassName="h-9"
                textClassName="text-3xl"
              />
            </div>
          )}
          <h1 className="text-2xl font-bold text-[var(--color-text)]">导航面板</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            登录后查看您的专属导航，内外网自动切换
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-[var(--color-surface)]/80 backdrop-blur-xl border border-[var(--color-border)] shadow-2xl">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[var(--color-background)]/60 border border-[var(--color-border)] mb-7">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={cn(
                'flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors',
                mode === 'login'
                  ? 'bg-[var(--color-primary)] text-white shadow'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              )}
            >
              <LogIn size={16} />
              登录
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={cn(
                'flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors',
                mode === 'register'
                  ? 'bg-[var(--color-primary)] text-white shadow'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              )}
            >
              <UserPlus size={16} />
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
              autoFocus
              required
            />
            <Input
              label="密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '至少 6 个字符' : '请输入密码'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
            {mode === 'register' && (
              <>
                <Input
                  label="确认密码"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  autoComplete="new-password"
                  required
                />
                <Input
                  label="邀请码"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="请输入管理员提供的邀请码"
                  required
                />
                <p className="flex items-start gap-1.5 text-xs text-[var(--color-text-muted)]">
                  <Ticket size={14} className="mt-0.5 shrink-0" />
                  注册需要管理员邀请码，请联系管理员获取
                </p>
              </>
            )}

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-[var(--color-error)]"
              >
                {error}
              </motion.p>
            )}

            <Button type="submit" disabled={loading} className="w-full h-11 mt-2">
              {loading ? (mode === 'login' ? '登录中...' : '注册中...') : mode === 'login' ? '登录' : '注册并登录'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
          {branding.text} · 内外网自动识别
        </p>
      </motion.div>
    </div>
  )
}
