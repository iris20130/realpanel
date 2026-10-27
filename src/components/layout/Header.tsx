'use client'

import { useState } from 'react'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useThemeStore, type ThemeMode } from '@/stores/theme'
import { useEffectStore } from '@/stores/effect'
import { EFFECTS } from '@/lib/effects'
import { useNetwork, networkLabels, networkModeLabels } from '@/lib/network'
import { useBranding } from '@/lib/useBranding'
import { BrandMark } from '@/components/layout/BrandMark'
import { NicSelector } from '@/components/layout/NicSelector'
import { Button } from '@/components/ui'
import { Globe, Wifi, Radar, User, LogOut, LogIn, Settings, Sun, Moon, Monitor, Pencil, Check, Eye, Sparkles, LayoutGrid } from 'lucide-react'
import { SettingsDialog } from '@/components/features/SettingsDialog'
import { cn } from '@/lib/utils'

const themeConfig: Record<ThemeMode, { icon: typeof Sun; label: string }> = {
  dark: { icon: Moon, label: '暗色模式' },
  light: { icon: Sun, label: '亮色模式' },
  system: { icon: Monitor, label: '跟随系统' },
}

export function Header({
  guest = false,
  onMemberLogin,
}: {
  guest?: boolean
  onMemberLogin?: () => void
}) {
  const { mode, network, deviceIp, deviceIps, probing, detected } = useNetwork()
  const cycleNetworkMode = useSettingsStore((state) => state.cycleNetworkMode)
  const setNetworkMode = useSettingsStore((state) => state.setNetworkMode)
  const { user, logout } = useAuthStore()
  const { editing, setEditing, viewingUser, setViewingUser } = useUiStore()
  const themeMode = useThemeStore((state) => state.mode)
  const cycleMode = useThemeStore((state) => state.cycleMode)
  const effectMode = useEffectStore((state) => state.mode)
  const fixedEffectId = useEffectStore((state) => state.fixedId)
  const cycleEffect = useEffectStore((state) => state.cycleEffect)
  const branding = useBranding()
  const [showSettings, setShowSettings] = useState(false)

  const openAdmin = () => {
    window.location.href = '/admin'
  }

  const currentTheme = themeConfig[themeMode]
  const ThemeIcon = currentTheme.icon

  const networkLabel =
    mode === 'auto'
      ? `自动 · ${networkLabels[network]}`
      : mode === 'all'
        ? '全部显示'
        : networkModeLabels[mode]
  const NetworkIcon = mode === 'auto' ? Radar : mode === 'intranet' ? Wifi : mode === 'all' ? LayoutGrid : Globe
  const effectLabel =
    effectMode === 'random'
      ? '随机'
      : EFFECTS.find((effect) => effect.id === fixedEffectId)?.name || '默认'

  const handleLogout = () => {
    logout()
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md bg-[var(--color-background)]/80 border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            {branding.mode !== 'none' && (
              <button
                type="button"
                onClick={() => viewingUser && setViewingUser(null)}
                title={viewingUser ? '返回我的面板' : branding.text}
                className="flex items-center gap-2 sm:gap-3 min-w-0"
              >
                <BrandMark
                  branding={branding}
                  imageClassName="h-6 sm:h-7"
                  textClassName="text-lg sm:text-xl truncate max-w-56"
                />
              </button>
            )}

            {/* 右侧操作区 */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* 网卡选择：先选网卡，再做内外网识别 */}
              <NicSelector />

              {/* 网络强制切换：自动 -> 强制内网 -> 强制外网 */}
              <button
                type="button"
                onClick={cycleNetworkMode}
                title={`当前：${networkLabel}${deviceIps.length > 0 ? `（本机 IP ${deviceIps.join('、')}）` : deviceIp ? `（本机 IP ${deviceIp}）` : ''}${probing ? '，正在识别网络…' : mode === 'auto' ? `，检测结果：${networkLabels[detected]}` : ''}。点击切换：自动识别 → 强制内网 → 强制外网`}
                className={cn(
                  'network-badge flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium text-white transition-all hover:opacity-90 hover:scale-105 active:scale-95 cursor-pointer',
                  mode
                )}
              >
                <NetworkIcon size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{networkLabel}</span>
              </button>

              {/* 强制全部显示：不受内外网筛选影响 */}
              <Button
                variant={mode === 'all' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setNetworkMode(mode === 'all' ? 'auto' : 'all')}
                className="p-1.5 sm:p-2"
                title={mode === 'all' ? '取消全部显示，恢复自动识别' : '全部显示（同时展示内网与外网链接）'}
              >
                <LayoutGrid size={18} />
              </Button>

              {/* 主题切换 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={cycleMode}
                className="p-1.5 sm:p-2"
                title={currentTheme.label}
              >
                <ThemeIcon size={18} />
              </Button>

              {/* 背景效果：随机 → 四套效果循环 */}
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cycleEffect}
                  className="p-1.5 sm:p-2"
                  title={`背景效果：${effectLabel}（点击切换）`}
                >
                  <Sparkles size={18} />
                </Button>
              )}

              {guest &&
                (user ? (
                  <>
                    <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-[var(--color-border)]">
                      <div className="w-7 h-7 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center text-xs font-semibold">
                        {user.username.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-[var(--color-text)] max-w-28 truncate">
                        {user.username}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={openAdmin}
                      className="gap-1.5 p-2 sm:px-3"
                      title="进入管理面板（编辑、设置、添加分组）"
                    >
                      <Settings size={18} />
                      <span className="hidden sm:inline">管理</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      className="p-1.5 sm:p-2"
                      title="退出登录"
                    >
                      <LogOut size={18} />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onMemberLogin}
                    className="gap-1.5 p-2 sm:px-3"
                    title="成员登录"
                  >
                    <LogIn size={16} />
                    <span className="hidden sm:inline">成员登录</span>
                  </Button>
                ))}

              {!guest && (
                <>
                  {viewingUser ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setViewingUser(null)}
                      className="gap-1.5 p-1.5 sm:px-3"
                      title="返回我的面板"
                    >
                      <Eye size={16} />
                      <span className="hidden sm:inline">只读查看中</span>
                    </Button>
                  ) : (
                    <Button
                      variant={editing ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => setEditing(!editing)}
                      className="p-1.5 sm:p-2 sm:gap-1.5"
                      title={editing ? '完成编辑' : '编辑面板'}
                    >
                      {editing ? <Check size={18} /> : <Pencil size={18} />}
                      <span className="hidden sm:inline">{editing ? '完成' : '编辑'}</span>
                    </Button>
                  )}

                  {/* 用户 */}
                  <div className="hidden md:flex items-center gap-2 pl-2 ml-1 border-l border-[var(--color-border)]">
                    <div className="w-7 h-7 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center text-xs font-semibold">
                      {user?.username?.slice(0, 1).toUpperCase() || <User size={14} />}
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-medium text-[var(--color-text)] max-w-32 truncate">{user?.username}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {user?.role === 'admin' ? '管理员' : '普通用户'}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSettings(true)}
                    className="p-1.5 sm:p-2"
                    title="设置"
                  >
                    <Settings size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="p-1.5 sm:p-2"
                    title="退出登录"
                  >
                    <LogOut size={18} />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {!guest && <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />}
    </>
  )
}
