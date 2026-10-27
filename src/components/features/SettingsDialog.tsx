'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Dialog, Input, Button, Select, Switch } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { api, type UserWithStats, type UploadedFile } from '@/lib/api'
import { formatDateTime, cn } from '@/lib/utils'
import type { Branding, InviteCode, PanelAccess, UserRole, WebDavConfig } from '@/types'
import {
  User,
  Users,
  Ticket,
  Database,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Copy,
  Check,
  Download,
  Upload,
  FileDown,
  RefreshCw,
  Power,
  Palette,
  ImagePlus,
  RotateCcw,
  FolderOpen,
  HardDrive,
  Link2,
  Monitor,
  PlugZap,
} from 'lucide-react'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

type TabKey = 'account' | 'users' | 'invites' | 'access' | 'data' | 'webdav' | 'branding'

const DEFAULT_BRANDING: Branding = {
  mode: 'logo',
  logoUrl: '/brand/realpanel.svg',
  text: 'realpanel 导航面板',
  faviconUrl: '/favicon.svg',
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { token, user, login, setUser } = useAuthStore()
  const setViewingUser = useUiStore((state) => state.setViewingUser)
  const isAdmin = user?.role === 'admin'

  const [activeTab, setActiveTab] = useState<TabKey>('account')

  // 账户
  const [username, setUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accountLoading, setAccountLoading] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [accountSuccess, setAccountSuccess] = useState('')

  // 用户管理
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [newUser, setNewUser] = useState<{ username: string; password: string; role: UserRole }>({
    username: '',
    password: '',
    role: 'user',
  })
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [editUser, setEditUser] = useState<{
    username: string
    password: string
    role: UserRole
    enabled: boolean
  }>({ username: '', password: '', role: 'user', enabled: true })
  const [userSaving, setUserSaving] = useState(false)

  // 邀请码
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [invitesLoading, setInvitesLoading] = useState(false)
  const [invitesError, setInvitesError] = useState('')
  const [inviteNote, setInviteNote] = useState('')
  const [inviteMaxUses, setInviteMaxUses] = useState('1')
  const [inviteExpires, setInviteExpires] = useState('7')
  const [copiedCode, setCopiedCode] = useState('')

  // 导入导出
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [dataMessage, setDataMessage] = useState('')

  // 品牌设置
  const brandingFileRef = useRef<HTMLInputElement>(null)
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING)
  const [brandingLoading, setBrandingLoading] = useState(false)
  const [brandingSaving, setBrandingSaving] = useState(false)
  const [brandingUploading, setBrandingUploading] = useState(false)
  const faviconFileRef = useRef<HTMLInputElement>(null)
  const [faviconUploading, setFaviconUploading] = useState(false)
  const [brandingError, setBrandingError] = useState('')
  const [brandingSuccess, setBrandingSuccess] = useState('')
  const [uploads, setUploads] = useState<UploadedFile[]>([])
  const [uploadsLoading, setUploadsLoading] = useState(false)
  const [deletingFile, setDeletingFile] = useState('')

  // WebDAV 挂载
  const emptyWebdav: WebDavConfig = {
    enabled: false,
    internalUrl: '',
    externalUrl: '',
    username: '',
    password: '',
  }
  const [webdav, setWebdav] = useState<WebDavConfig>(emptyWebdav)
  const [webdavSaving, setWebdavSaving] = useState(false)
  const [webdavTesting, setWebdavTesting] = useState(false)
  const [webdavError, setWebdavError] = useState('')
  const [webdavSuccess, setWebdavSuccess] = useState('')

  // 面板访问地址
  const [access, setAccess] = useState<Required<PanelAccess>>({
    internalUrl: '',
    externalUrl: '',
  })
  const [accessSaving, setAccessSaving] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [accessSuccess, setAccessSuccess] = useState('')

  const loadUsers = useCallback(async () => {
    if (!token) return
    setUsersLoading(true)
    setUsersError('')
    try {
      setUsers(await api.admin.getUsers(token))
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : '加载用户失败')
    } finally {
      setUsersLoading(false)
    }
  }, [token])

  const loadInvites = useCallback(async () => {
    if (!token) return
    setInvitesLoading(true)
    setInvitesError('')
    try {
      setInvites(await api.admin.getInvites(token))
    } catch (err) {
      setInvitesError(err instanceof Error ? err.message : '加载邀请码失败')
    } finally {
      setInvitesLoading(false)
    }
  }, [token])

  const loadBranding = useCallback(async () => {
    setBrandingLoading(true)
    setBrandingError('')
    try {
      setBranding(await api.getBranding())
    } catch (err) {
      setBrandingError(err instanceof Error ? err.message : '加载品牌设置失败')
    } finally {
      setBrandingLoading(false)
    }
  }, [])

  const loadUploads = useCallback(async () => {
    if (!token) return
    setUploadsLoading(true)
    try {
      setUploads(await api.admin.getUploads(token))
    } catch {
      setUploads([])
    } finally {
      setUploadsLoading(false)
    }
  }, [token])

  const loadWebdav = useCallback(async () => {
    if (!token) return
    setWebdavError('')
    try {
      const config = await api.admin.getWebdav(token)
      setWebdav({
        enabled: config.enabled,
        internalUrl: config.internalUrl || '',
        externalUrl: config.externalUrl || '',
        username: config.username || '',
        password: config.password || '',
      })
    } catch (err) {
      setWebdavError(err instanceof Error ? err.message : '加载 WebDAV 配置失败')
    }
  }, [token])

  const loadAccess = useCallback(async () => {
    if (!token) return
    setAccessError('')
    try {
      const config = await api.getAccess(token)
      setAccess({
        internalUrl: config.internalUrl || '',
        externalUrl: config.externalUrl || '',
      })
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : '加载访问地址失败')
    }
  }, [token])

  useEffect(() => {
    if (open) {
      setUsername(user?.username || '')
      setAccountError('')
      setAccountSuccess('')
      setNewPassword('')
      setConfirmPassword('')
      setShowCreateUser(false)
      setEditUserId(null)
      setDataMessage('')
      setBrandingError('')
      setBrandingSuccess('')
      setWebdavError('')
      setWebdavSuccess('')
      setAccessError('')
      setAccessSuccess('')
    }
  }, [open, user?.username])

  useEffect(() => {
    if (!open) return
    if (activeTab === 'users' && isAdmin) void loadUsers()
    if (activeTab === 'invites' && isAdmin) void loadInvites()
    if (activeTab === 'branding' && isAdmin) {
      void loadBranding()
      void loadUploads()
    }
    if (activeTab === 'webdav' && isAdmin) void loadWebdav()
    if (activeTab === 'access' && isAdmin) void loadAccess()
  }, [open, activeTab, isAdmin, loadUsers, loadInvites, loadBranding, loadUploads, loadWebdav, loadAccess])

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setAccountError('')
    setAccountSuccess('')

    if (newPassword && newPassword !== confirmPassword) {
      setAccountError('两次输入的新密码不一致')
      return
    }

    const updates: { username?: string; password?: string } = {}
    if (username.trim() && username.trim() !== user?.username) updates.username = username.trim()
    if (newPassword) updates.password = newPassword

    if (!updates.username && !updates.password) {
      setAccountError('没有需要更新的内容')
      return
    }

    setAccountLoading(true)
    try {
      const result = await api.admin.updateAccount(token, updates)
      login(result.token, result.user)
      setAccountSuccess('账户信息已更新')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : '更新失败')
    } finally {
      setAccountLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setUsersError('')
    setUserSaving(true)
    try {
      await api.admin.createUser(token, newUser)
      setNewUser({ username: '', password: '', role: 'user' })
      setShowCreateUser(false)
      await loadUsers()
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : '创建用户失败')
    } finally {
      setUserSaving(false)
    }
  }

  const startEditUser = (item: UserWithStats) => {
    setEditUserId(item.id)
    setEditUser({
      username: item.username,
      password: '',
      role: item.role,
      enabled: item.enabled,
    })
    setUsersError('')
  }

  const handleSaveUser = async (id: string) => {
    if (!token) return
    setUsersError('')
    setUserSaving(true)
    try {
      const updates: { username?: string; password?: string; role?: UserRole; enabled?: boolean } = {
        username: editUser.username.trim(),
        role: editUser.role,
        enabled: editUser.enabled,
      }
      if (editUser.password) updates.password = editUser.password

      const updated = await api.admin.updateUser(token, id, updates)
      if (user?.id === id) setUser(updated)
      setEditUserId(null)
      await loadUsers()
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : '更新用户失败')
    } finally {
      setUserSaving(false)
    }
  }

  const handleDeleteUser = async (item: UserWithStats) => {
    if (!token) return
    if (!confirm(`确定删除用户「${item.username}」？其面板数据将一并删除。`)) return
    setUsersError('')
    try {
      await api.admin.deleteUser(token, item.id)
      await loadUsers()
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : '删除用户失败')
    }
  }

  const handleViewPanel = (item: UserWithStats) => {
    setViewingUser({
      id: item.id,
      username: item.username,
      role: item.role,
      enabled: item.enabled,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })
    onClose()
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setInvitesError('')
    setInvitesLoading(true)
    try {
      await api.admin.createInvite(token, {
        note: inviteNote.trim() || undefined,
        maxUses: Math.max(0, Number(inviteMaxUses) || 0),
        expiresInDays: Math.max(0, Number(inviteExpires) || 0),
      })
      setInviteNote('')
      setInviteMaxUses('1')
      setInviteExpires('7')
      await loadInvites()
    } catch (err) {
      setInvitesError(err instanceof Error ? err.message : '生成邀请码失败')
    } finally {
      setInvitesLoading(false)
    }
  }

  const handleToggleInvite = async (invite: InviteCode) => {
    if (!token) return
    try {
      const updated = await api.admin.updateInvite(token, invite.code, { enabled: !invite.enabled })
      setInvites((prev) => prev.map((item) => (item.code === invite.code ? updated : item)))
    } catch (err) {
      setInvitesError(err instanceof Error ? err.message : '更新邀请码失败')
    }
  }

  const handleDeleteInvite = async (code: string) => {
    if (!token) return
    if (!confirm('确定删除该邀请码？')) return
    try {
      await api.admin.deleteInvite(token, code)
      setInvites((prev) => prev.filter((item) => item.code !== code))
    } catch (err) {
      setInvitesError(err instanceof Error ? err.message : '删除邀请码失败')
    }
  }

  const copyInvite = async (code: string) => {
    const link = `${window.location.origin}/?invite=${code}`
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      const input = document.createElement('input')
      input.value = link
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(''), 1500)
  }

  const inviteStatus = (invite: InviteCode) => {
    if (!invite.enabled) return { text: '已停用', className: 'text-[var(--color-text-muted)]' }
    if (invite.expiresAt && invite.expiresAt < Date.now())
      return { text: '已过期', className: 'text-[var(--color-error)]' }
    if (invite.maxUses > 0 && invite.usedCount >= invite.maxUses)
      return { text: '已用完', className: 'text-[var(--color-warning)]' }
    return { text: '可用', className: 'text-[var(--color-success)]' }
  }

  const handleSaveBranding = async () => {
    if (!token) return
    setBrandingError('')
    setBrandingSuccess('')

    if (branding.mode === 'logo' && !branding.logoUrl.trim()) {
      setBrandingError('请填写图标地址或上传图标')
      return
    }
    if (branding.mode === 'text' && !branding.text.trim()) {
      setBrandingError('请填写自定义文字')
      return
    }

    setBrandingSaving(true)
    try {
      const saved = await api.admin.updateBranding(token, {
        ...branding,
        logoUrl: branding.logoUrl.trim(),
        text: branding.text.trim(),
      })
      setBranding(saved)
      window.dispatchEvent(new Event('branding-updated'))
      setBrandingSuccess('品牌设置已保存')
    } catch (err) {
      setBrandingError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setBrandingSaving(false)
    }
  }

  const handleSaveWebdav = async () => {
    if (!token) return
    setWebdavError('')
    setWebdavSuccess('')
    setWebdavSaving(true)
    try {
      const saved = await api.admin.saveWebdav(token, {
        ...webdav,
        internalUrl: webdav.internalUrl.trim(),
        externalUrl: webdav.externalUrl?.trim() || '',
      })
      setWebdav({
        enabled: saved.enabled,
        internalUrl: saved.internalUrl || '',
        externalUrl: saved.externalUrl || '',
        username: saved.username || '',
        password: saved.password || '',
      })
      setWebdavSuccess('挂载配置已保存')
    } catch (err) {
      setWebdavError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setWebdavSaving(false)
    }
  }

  const handleSaveAccess = async () => {
    if (!token) return
    setAccessError('')
    setAccessSuccess('')
    setAccessSaving(true)
    try {
      const saved = await api.admin.saveAccess(token, {
        internalUrl: access.internalUrl.trim(),
        externalUrl: access.externalUrl.trim(),
      })
      setAccess({
        internalUrl: saved.internalUrl || '',
        externalUrl: saved.externalUrl || '',
      })
      setAccessSuccess('访问地址已保存')
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setAccessSaving(false)
    }
  }

  const handleTestWebdav = async () => {    if (!token) return
    setWebdavError('')
    setWebdavSuccess('')
    setWebdavTesting(true)
    try {
      const result = await api.admin.testWebdav(token, webdav)
      setWebdavSuccess(`连接成功，根目录共 ${result.count} 项`)
    } catch (err) {
      setWebdavError(err instanceof Error ? err.message : '连接失败')
    } finally {
      setWebdavTesting(false)
    }
  }

  const handleBrandingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setBrandingError('')
    setBrandingSuccess('')
    setBrandingUploading(true)
    try {
      const result = (await api.admin.uploadIcon(token, file)) as {
        url?: string
        error?: string
      }
      if (!result.url) throw new Error(result.error || '上传失败')
      setBranding((prev) => ({ ...prev, logoUrl: result.url!, mode: 'logo' }))
      setBrandingSuccess('图标已上传，点击保存后生效')
      await loadUploads()
    } catch (err) {
      setBrandingError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setBrandingUploading(false)
      if (brandingFileRef.current) brandingFileRef.current.value = ''
    }
  }

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setBrandingError('')
    setBrandingSuccess('')
    setFaviconUploading(true)
    try {
      const result = (await api.admin.uploadIcon(token, file)) as {
        url?: string
        error?: string
      }
      if (!result.url) throw new Error(result.error || '上传失败')
      setBranding((prev) => ({ ...prev, faviconUrl: result.url }))
      setBrandingSuccess('标签图标已上传，点击保存后生效')
      await loadUploads()
    } catch (err) {
      setBrandingError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setFaviconUploading(false)
      if (faviconFileRef.current) faviconFileRef.current.value = ''
    }
  }

  const handleDeleteUpload = async (file: UploadedFile) => {
    if (!token) return
    if (!confirm(`确定删除图标「${file.filename}」？正在使用它的站点会显示为破图。`)) return

    setDeletingFile(file.filename)
    setBrandingError('')
    setBrandingSuccess('')
    try {
      await api.admin.deleteUpload(token, file.filename)
      setUploads((prev) => prev.filter((item) => item.filename !== file.filename))
      if (branding.logoUrl === file.url) {
        setBranding((prev) => ({ ...prev, logoUrl: DEFAULT_BRANDING.logoUrl }))
      }
      if (branding.faviconUrl === file.url) {
        setBranding((prev) => ({ ...prev, faviconUrl: DEFAULT_BRANDING.faviconUrl }))
      }
      setBrandingSuccess('图标已删除')
    } catch (err) {
      setBrandingError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingFile('')
    }
  }

  const handleExport = async () => {
    if (!token) return
    try {
      const data = await api.admin.exportData(token)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${data.scope === 'all' ? 'ricpanel-config' : 'panel'}-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setDataMessage(
        data.scope === 'all'
          ? '已导出全部配置（用户、邀请码、所有面板、品牌、上传图标）'
          : '已导出我的面板配置'
      )
    } catch (err) {
      setDataMessage(err instanceof Error ? err.message : '导出失败')
    }
  }

  const handleExportAll = async () => {
    if (!token) return
    try {
      const blob = await api.admin.exportAll(token)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${isAdmin ? 'ricpanel-backup' : 'panel-backup'}-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
      setDataMessage(isAdmin ? '已打包完整备份（含上传图标）' : '已打包我的面板与图标')
    } catch (err) {
      setDataMessage(err instanceof Error ? err.message : '完整备份失败')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    if (!confirm('导入将完全覆盖当前面板，确定继续？')) {
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setImportLoading(true)
    setDataMessage('')
    try {
      const result = await api.admin.importFile(token, file)
      setDataMessage(result.scope === 'all' ? '完整配置已恢复，正在刷新…' : '面板已导入，正在刷新…')
      setTimeout(() => window.location.reload(), 600)
    } catch (err) {
      setDataMessage('导入失败：' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setImportLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const tabs: { key: TabKey; label: string; icon: typeof User; adminOnly?: boolean }[] = [
    { key: 'account', label: '账户设置', icon: User },
    { key: 'users', label: '用户管理', icon: Users, adminOnly: true },
    { key: 'invites', label: '邀请码', icon: Ticket, adminOnly: true },
    { key: 'access', label: '访问地址', icon: Link2, adminOnly: true },
    { key: 'webdav', label: 'WebDAV 挂载', icon: HardDrive, adminOnly: true },
    { key: 'branding', label: '品牌设置', icon: Palette, adminOnly: true },
    { key: 'data', label: '导入导出', icon: Database },
  ]

  return (
    <Dialog open={open} onClose={onClose} title="设置" className="max-w-3xl">
      <div className="flex gap-2 mb-6 border-b border-[var(--color-border)] pb-3 overflow-x-auto">
        {tabs
          .filter((tab) => !tab.adminOnly || isAdmin)
          .map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap inline-flex items-center gap-1.5',
                activeTab === tab.key
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              )}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
      </div>

      {/* 账户设置 */}
      {activeTab === 'account' && (
        <form onSubmit={handleUpdateAccount} className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center font-semibold">
              {user?.username?.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">
                {user?.username}
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                  {user?.role === 'admin' ? '管理员' : '普通用户'}
                </span>
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                注册于 {formatDateTime(user?.createdAt || 0)}
              </p>
            </div>
          </div>

          <Input
            label="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="新密码（留空不修改）"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少 6 个字符"
            />
            <Input
              label="确认新密码"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
            />
          </div>
          {accountError && <p className="text-sm text-[var(--color-error)]">{accountError}</p>}
          {accountSuccess && <p className="text-sm text-[var(--color-success)]">{accountSuccess}</p>}
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={accountLoading}>
              {accountLoading ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>
      )}

      {/* 用户管理 */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              管理所有用户，可查看任意用户的面板
            </p>
            <div className="flex gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => loadUsers()} disabled={usersLoading} title="刷新">
                <RefreshCw size={16} className={usersLoading ? 'animate-spin' : ''} />
              </Button>
              <Button size="sm" onClick={() => setShowCreateUser((v) => !v)} className="gap-1.5">
                <Plus size={16} />
                新建用户
              </Button>
            </div>
          </div>

          {showCreateUser && (
            <form onSubmit={handleCreateUser} className="p-4 rounded-xl bg-[var(--color-background)]/70 border border-[var(--color-border)] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="用户名"
                  value={newUser.username}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="用户名"
                  required
                />
                <Input
                  label="密码"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="至少 6 个字符"
                  required
                />
                <Select
                  label="角色"
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser((prev) => ({ ...prev, role: e.target.value as UserRole }))
                  }
                  options={[
                    { value: 'user', label: '普通用户' },
                    { value: 'admin', label: '管理员' },
                  ]}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowCreateUser(false)}>
                  取消
                </Button>
                <Button type="submit" size="sm" disabled={userSaving}>
                  {userSaving ? '创建中...' : '创建'}
                </Button>
              </div>
            </form>
          )}

          {usersError && <p className="text-sm text-[var(--color-error)]">{usersError}</p>}

          <div className="space-y-2">
            {users.map((item) => (
              <div key={item.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60">
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] flex items-center justify-center text-sm font-semibold shrink-0">
                    {item.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[var(--color-text)] truncate">{item.username}</span>
                      {user?.id === item.id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                          我
                        </span>
                      )}
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded',
                          item.role === 'admin'
                            ? 'bg-purple-500/15 text-purple-400'
                            : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'
                        )}
                      >
                        {item.role === 'admin' ? '管理员' : '普通用户'}
                      </span>
                      {!item.enabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-error)]/15 text-[var(--color-error)]">
                          已停用
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {item.groupCount} 个分组 · {item.siteCount} 个网站 · 创建于 {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewPanel(item)}
                      className="gap-1.5"
                      title="查看该用户的面板"
                    >
                      <Eye size={15} />
                      <span className="hidden sm:inline">查看面板</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => (editUserId === item.id ? setEditUserId(null) : startEditUser(item))}
                      className="p-1.5"
                      title="编辑用户"
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUser(item)}
                      disabled={user?.id === item.id}
                      className="p-1.5 text-[var(--color-error)] hover:text-[var(--color-error)]"
                      title={user?.id === item.id ? '不能删除自己' : '删除用户'}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>

                {editUserId === item.id && (
                  <div className="border-t border-[var(--color-border)] p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input
                        label="用户名"
                        value={editUser.username}
                        onChange={(e) => setEditUser((prev) => ({ ...prev, username: e.target.value }))}
                      />
                      <Input
                        label="重置密码（留空不改）"
                        type="password"
                        value={editUser.password}
                        onChange={(e) => setEditUser((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder="新密码"
                      />
                      <Select
                        label="角色"
                        value={editUser.role}
                        onChange={(e) =>
                          setEditUser((prev) => ({ ...prev, role: e.target.value as UserRole }))
                        }
                        options={[
                          { value: 'user', label: '普通用户' },
                          { value: 'admin', label: '管理员' },
                        ]}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Switch
                        checked={editUser.enabled}
                        onChange={(checked) => setEditUser((prev) => ({ ...prev, enabled: checked }))}
                        label="启用该用户"
                      />
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setEditUserId(null)}>
                          取消
                        </Button>
                        <Button size="sm" onClick={() => handleSaveUser(item.id)} disabled={userSaving}>
                          {userSaving ? '保存中...' : '保存'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {users.length === 0 && !usersLoading && (
              <p className="text-center text-sm text-[var(--color-text-muted)] py-6">暂无用户</p>
            )}
          </div>
        </div>
      )}

      {/* 邀请码 */}
      {activeTab === 'invites' && isAdmin && (
        <div className="space-y-4">
          <form onSubmit={handleCreateInvite} className="p-4 rounded-xl bg-[var(--color-background)]/70 border border-[var(--color-border)] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="备注（可选）"
                value={inviteNote}
                onChange={(e) => setInviteNote(e.target.value)}
                placeholder="如：给张三"
              />
              <Input
                label="最大使用次数（0 不限）"
                type="number"
                min={0}
                value={inviteMaxUses}
                onChange={(e) => setInviteMaxUses(e.target.value)}
              />
              <Input
                label="有效期天数（0 永久）"
                type="number"
                min={0}
                value={inviteExpires}
                onChange={(e) => setInviteExpires(e.target.value)}
              />
            </div>
            <div className="flex justify-between items-center gap-3">
              <p className="text-xs text-[var(--color-text-muted)]">
                用户注册时必须填写邀请码，注册链接可直接发给对方
              </p>
              <div className="flex gap-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => loadInvites()}
                  disabled={invitesLoading}
                  title="刷新"
                >
                  <RefreshCw size={16} className={invitesLoading ? 'animate-spin' : ''} />
                </Button>
                <Button type="submit" size="sm" className="gap-1.5" disabled={invitesLoading}>
                  <Plus size={16} />
                  生成邀请码
                </Button>
              </div>
            </div>
          </form>

          {invitesError && <p className="text-sm text-[var(--color-error)]">{invitesError}</p>}

          <div className="space-y-2">
            {invites.map((invite) => {
              const status = inviteStatus(invite)
              return (
                <div
                  key={invite.code}
                  className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <code className="px-2.5 py-1 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] font-mono text-base tracking-widest text-[var(--color-text)]">
                      {invite.code}
                    </code>
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--color-text)] truncate">
                        {invite.note || '未备注'}
                        <span className={cn('ml-2 text-xs', status.className)}>{status.text}</span>
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        已使用 {invite.usedCount}
                        {invite.maxUses > 0 ? ` / ${invite.maxUses}` : ' 次（不限）'}
                        {invite.expiresAt ? ` · ${formatDateTime(invite.expiresAt)} 过期` : ' · 永久有效'}
                      </p>
                      {invite.usedBy.length > 0 && (
                        <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                          使用者：{invite.usedBy.map((entry) => entry.username).join('、')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyInvite(invite.code)}
                      className="gap-1.5 p-1.5"
                      title="复制注册链接"
                    >
                      {copiedCode === invite.code ? <Check size={15} className="text-[var(--color-success)]" /> : <Copy size={15} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleInvite(invite)}
                      className="p-1.5"
                      title={invite.enabled ? '停用' : '启用'}
                    >
                      <Power size={15} className={invite.enabled ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteInvite(invite.code)}
                      className="p-1.5 text-[var(--color-error)] hover:text-[var(--color-error)]"
                      title="删除"
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              )
            })}
            {invites.length === 0 && !invitesLoading && (
              <p className="text-center text-sm text-[var(--color-text-muted)] py-6">还没有邀请码，先生成一个</p>
            )}
          </div>
        </div>
      )}

      {/* 访问地址 */}
      {activeTab === 'access' && isAdmin && (
        <div className="space-y-5">
          <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-4">
            <div>
              <h3 className="font-medium text-[var(--color-text)] mb-1 flex items-center gap-2">
                <Link2 size={18} />
                面板访问地址
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                用于给离线文件和 WebDAV 选中的文件生成内外网链接：内网地址拼进「内网地址」，反代地址拼进「外网地址」。
                留空则沿用当前打开面板的浏览器地址。
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="内网地址"
                value={access.internalUrl}
                onChange={(e) => setAccess((prev) => ({ ...prev, internalUrl: e.target.value }))}
                placeholder="http://192.168.1.10:3000"
              />
              <Input
                label="反代 / 外网地址"
                value={access.externalUrl}
                onChange={(e) => setAccess((prev) => ({ ...prev, externalUrl: e.target.value }))}
                placeholder="https://panel.example.com"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSaveAccess} disabled={accessSaving} className="gap-2">
                {accessSaving ? '保存中...' : '保存访问地址'}
              </Button>
            </div>

            {accessError && <p className="text-sm text-[var(--color-error)]">{accessError}</p>}
            {accessSuccess && <p className="text-sm text-[var(--color-success)]">{accessSuccess}</p>}
          </div>

          <p className="text-xs text-[var(--color-text-muted)]">
            只影响保存后新上传或重新选取的文件链接，已保存的站点地址不会被改写。
            反代如果挂在子路径上，地址要带上路径前缀（如 <code>https://panel.example.com/nav</code>）。
            外网打开 WebDAV 文件时，面板会 302 跳到反代 WebDAV 直链，由该地址自己校验登录。
          </p>
        </div>
      )}

      {/* WebDAV 挂载 */}
      {activeTab === 'webdav' && isAdmin && (
        <div className="space-y-5">
          <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-4">
            <div>
              <h3 className="font-medium text-[var(--color-text)] mb-1 flex items-center gap-2">
                <HardDrive size={18} />
                WebDAV / OpenList 挂载
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                配置后，编辑站点时可从挂载目录直接选文件：文件地址会填成面板的代理直链。
                内网由面板带账号取文件；外网若填了反代地址，面板会 302 跳到反代 WebDAV 直链，不再是面板转发流量。
              </p>
            </div>

            <Switch
              checked={webdav.enabled}
              onChange={(checked) => setWebdav((prev) => ({ ...prev, enabled: checked }))}
              label="启用 WebDAV 挂载"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="内网 WebDAV 地址"
                value={webdav.internalUrl || ''}
                onChange={(e) => setWebdav((prev) => ({ ...prev, internalUrl: e.target.value }))}
                placeholder="http://192.168.1.10:5244/dav"
              />
              <Input
                label="反代 / 外网地址（可选）"
                value={webdav.externalUrl || ''}
                onChange={(e) => setWebdav((prev) => ({ ...prev, externalUrl: e.target.value }))}
                placeholder="https://dav.example.com/dav"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="用户名"
                value={webdav.username || ''}
                onChange={(e) => setWebdav((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="WebDAV 账号（可留空）"
                autoComplete="off"
              />
              <Input
                label="密码"
                type="password"
                value={webdav.password || ''}
                onChange={(e) => setWebdav((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="WebDAV 密码（可留空）"
                autoComplete="new-password"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSaveWebdav} disabled={webdavSaving} className="gap-2">
                {webdavSaving ? '保存中...' : '保存挂载配置'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleTestWebdav}
                disabled={webdavTesting}
                className="gap-2"
              >
                {webdavTesting ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <PlugZap size={16} />
                )}
                测试连接
              </Button>
            </div>

            {webdavError && <p className="text-sm text-[var(--color-error)]">{webdavError}</p>}
            {webdavSuccess && <p className="text-sm text-[var(--color-success)]">{webdavSuccess}</p>}
          </div>

          <p className="text-xs text-[var(--color-text-muted)]">
            OpenList 的 WebDAV 地址通常是 <code>http://IP:5244/dav</code>，内网与反代地址都要带上
            <code>/dav</code> 这类挂载路径；账号可在 OpenList 后台「设置 → 其他」中查看或新建。
            服务端优先连内网地址，连不上时自动尝试反代地址。
          </p>
        </div>
      )}

      {/* 品牌设置 */}
      {activeTab === 'branding' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              自定义顶栏和登录页的品牌展示，公开端口同步生效
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadBranding()}
              disabled={brandingLoading}
              title="刷新"
              className="shrink-0"
            >
              <RefreshCw size={16} className={brandingLoading ? 'animate-spin' : ''} />
            </Button>
          </div>

          <div className="p-4 rounded-xl bg-[var(--color-surface)]/60 border border-[var(--color-border)] space-y-4">
            <Select
              label="显示方式"
              value={branding.mode}
              onChange={(e) =>
                setBranding((prev) => ({ ...prev, mode: e.target.value as Branding['mode'] }))
              }
              options={[
                { value: 'logo', label: '显示图标' },
                { value: 'text', label: '显示自定义文字' },
                { value: 'none', label: '不显示' },
              ]}
            />

            {branding.mode === 'logo' && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="h-14 min-w-32 px-3 flex items-center justify-center rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
                    <Image
                      src={branding.logoUrl || DEFAULT_BRANDING.logoUrl}
                      alt="图标预览"
                      width={180}
                      height={48}
                      unoptimized
                      className="h-10 w-auto max-w-44 object-contain"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => brandingFileRef.current?.click()}
                      disabled={brandingUploading}
                      className="gap-1.5"
                    >
                      <ImagePlus size={15} />
                      {brandingUploading ? '上传中...' : '上传图标'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setBranding((prev) => ({
                          ...prev,
                          logoUrl: DEFAULT_BRANDING.logoUrl,
                          mode: 'logo',
                        }))
                      }
                      className="gap-1.5"
                    >
                      <RotateCcw size={15} />
                      恢复默认
                    </Button>
                  </div>
                  <input
                    ref={brandingFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/svg+xml,image/x-icon"
                    onChange={handleBrandingUpload}
                    className="hidden"
                  />
                </div>
                <Input
                  label="图标地址"
                  value={branding.logoUrl}
                  onChange={(e) => setBranding((prev) => ({ ...prev, logoUrl: e.target.value }))}
                  placeholder="/brand/realpanel.svg 或图片链接"
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--color-text-muted)]">
                      图标库（含历史上传的图标）
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadUploads()}
                      disabled={uploadsLoading}
                      title="刷新图标库"
                    >
                      <RefreshCw size={14} className={uploadsLoading ? 'animate-spin' : ''} />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setBranding((prev) => ({
                          ...prev,
                          logoUrl: DEFAULT_BRANDING.logoUrl,
                          mode: 'logo',
                        }))
                      }
                      title="默认图标"
                      className={cn(
                        'relative h-16 rounded-lg border flex items-center justify-center bg-[var(--color-background)] transition-all hover:border-[var(--color-primary)]',
                        branding.logoUrl === DEFAULT_BRANDING.logoUrl
                          ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]'
                          : 'border-[var(--color-border)]'
                      )}
                    >
                      <Image
                        src={DEFAULT_BRANDING.logoUrl}
                        alt="默认图标"
                        width={100}
                        height={32}
                        unoptimized
                        className="h-8 w-auto max-w-24 object-contain"
                      />
                      <span className="absolute bottom-0.5 left-1 text-[10px] text-[var(--color-text-muted)]">
                        默认
                      </span>
                    </button>

                    {uploads.map((file) => (
                      <div key={file.filename} className="relative group">
                        <button
                          type="button"
                          onClick={() =>
                            setBranding((prev) => ({ ...prev, logoUrl: file.url, mode: 'logo' }))
                          }
                          title={file.filename}
                          className={cn(
                            'w-full h-16 rounded-lg border flex items-center justify-center bg-[var(--color-background)] transition-all hover:border-[var(--color-primary)] overflow-hidden',
                            branding.logoUrl === file.url
                              ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]'
                              : 'border-[var(--color-border)]'
                          )}
                        >
                          <Image
                            src={file.url}
                            alt={file.filename}
                            width={96}
                            height={48}
                            unoptimized
                            className="h-10 w-auto max-w-20 object-contain"
                          />
                          {branding.logoUrl === file.url && (
                            <Check
                              size={12}
                              className="absolute bottom-0.5 right-0.5 text-[var(--color-primary)]"
                            />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUpload(file)}
                          disabled={deletingFile === file.filename}
                          title="删除该图标"
                          className={cn(
                            'absolute top-0.5 right-0.5 p-1 rounded-md bg-[var(--color-elevated)] border border-[var(--color-border)] text-[var(--color-error)] transition-opacity',
                            'opacity-100 sm:opacity-0 sm:group-hover:opacity-100',
                            deletingFile === file.filename && 'animate-pulse'
                          )}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {uploads.length === 0 && !uploadsLoading && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      暂无上传过的图标，上传或自动识别后的图标会出现在这里。
                    </p>
                  )}
                </div>
              </>
            )}

            {branding.mode === 'text' && (
              <Input
                label="自定义文字（最多 40 字）"
                value={branding.text}
                maxLength={40}
                onChange={(e) => setBranding((prev) => ({ ...prev, text: e.target.value }))}
                placeholder="例如：realpanel 导航"
              />
            )}

            {branding.mode === 'none' && (
              <p className="text-sm text-[var(--color-text-muted)]">
                顶栏和登录页将不显示任何品牌标识。
              </p>
            )}

            <div className="rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] p-3">
              <p className="text-xs text-[var(--color-text-muted)] mb-2">顶栏效果预览</p>
              <div className="h-10 flex items-center">
                {branding.mode === 'none' ? (
                  <span className="text-sm text-[var(--color-text-muted)]">（不显示）</span>
                ) : branding.mode === 'text' ? (
                  <span className="text-xl font-bold text-[var(--color-text)]">
                    {branding.text || '自定义文字'}
                  </span>
                ) : (
                  <Image
                    src={branding.logoUrl || DEFAULT_BRANDING.logoUrl}
                    alt="顶栏预览"
                    width={160}
                    height={28}
                    unoptimized
                    className="h-7 w-auto max-w-52 object-contain brand-logo"
                  />
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--color-surface)]/60 border border-[var(--color-border)] space-y-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">浏览器标签图标（Favicon）</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  显示在浏览器标签页与收藏夹，建议正方形 ICO / PNG / SVG
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
                  <Image
                    src={branding.faviconUrl || DEFAULT_BRANDING.faviconUrl!}
                    alt="标签图标预览"
                    width={32}
                    height={32}
                    unoptimized
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => faviconFileRef.current?.click()}
                  disabled={faviconUploading}
                  className="gap-1.5"
                >
                  <ImagePlus size={15} />
                  {faviconUploading ? '上传中...' : '上传图标'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setBranding((prev) => ({
                      ...prev,
                      faviconUrl: DEFAULT_BRANDING.faviconUrl,
                    }))
                  }
                  className="gap-1.5"
                >
                  <RotateCcw size={15} />
                  恢复默认
                </Button>
                <input
                  ref={faviconFileRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
                  onChange={handleFaviconUpload}
                  className="hidden"
                />
              </div>
              <Input
                label="图标地址"
                value={branding.faviconUrl || ''}
                onChange={(e) => setBranding((prev) => ({ ...prev, faviconUrl: e.target.value }))}
                placeholder="/favicon.svg 或图片链接"
              />
            </div>

            {brandingError && <p className="text-sm text-[var(--color-error)]">{brandingError}</p>}
            {brandingSuccess && (
              <p className="text-sm text-[var(--color-success)]">{brandingSuccess}</p>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSaveBranding} disabled={brandingSaving || brandingLoading}>
                {brandingSaving ? '保存中...' : '保存品牌设置'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 导入导出 */}
      {activeTab === 'data' && (
        <div className="space-y-5">
          <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
            <h3 className="font-medium text-[var(--color-text)] mb-2 flex items-center gap-2">
              <Download size={18} />
              导出数据
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              {isAdmin
                ? '管理员导出涵盖全部配置：用户、邀请码、所有用户面板、品牌设置、WebDAV 挂载、上传图标与离线文件。'
                : '成员导出仅包含你自己的面板配置、所用图标与上传的离线文件。'}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={handleExport} className="gap-2">
                <FileDown size={16} />
                {isAdmin ? '导出全部配置 JSON' : '导出我的面板 JSON'}
              </Button>
              <Button variant="secondary" onClick={handleExportAll} className="gap-2">
                <Download size={16} />
                {isAdmin ? '完整备份 ZIP' : '我的面板 ZIP'}
              </Button>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
            <h3 className="font-medium text-[var(--color-text)] mb-2 flex items-center gap-2">
              <Upload size={18} />
              导入数据
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              支持 JSON 或 ZIP 备份；导入将<strong>完全覆盖</strong>对应范围的数据
              {isAdmin ? '（完整备份会覆盖用户、邀请码与所有面板）' : '（仅覆盖你自己的面板）'}。
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.zip,application/json,application/zip"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
              className="gap-2"
            >
              <Upload size={16} />
              {importLoading ? '导入中...' : '选择文件导入'}
            </Button>
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
            <h3 className="font-medium text-[var(--color-text)] mb-2 flex items-center gap-2">
              <FolderOpen size={18} />
              SMB 共享支持
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              浏览器不能直接打开资源管理器，需先在 Windows 注册一次 <code>smb://</code> 协议（写入当前用户注册表，无需管理员权限，可卸载）。
              注册后点击面板里配置了 SMB 地址的站点即可直接打开对应共享目录。
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/enable-smb-protocol.reg"
                download="enable-smb-protocol.reg"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm hover:border-[var(--color-primary)]"
              >
                <FileDown size={16} />
                下载启用文件
              </a>
              <a
                href="/disable-smb-protocol.reg"
                download="disable-smb-protocol.reg"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm hover:border-[var(--color-primary)]"
              >
                <Download size={16} />
                下载卸载文件
              </a>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-3">
              下载后双击 .reg 文件并确认导入；首次点击 SMB 站点时浏览器会询问是否允许打开资源管理器，勾选「始终允许」即可不再提示。
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
            <h3 className="font-medium text-[var(--color-text)] mb-2 flex items-center gap-2">
              <Monitor size={18} />
              RDP 远程桌面支持
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              浏览器不能直接启动远程桌面连接，需先在 Windows 注册一次 <code>rdp://</code> 协议（写入当前用户注册表，无需管理员权限，可卸载）。
              注册后点击面板里配置了 <code>rdp://</code> 地址的站点即会自动调用 mstsc 并填入地址。
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/enable-rdp-protocol.reg"
                download="enable-rdp-protocol.reg"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm hover:border-[var(--color-primary)]"
              >
                <FileDown size={16} />
                下载启用文件
              </a>
              <a
                href="/disable-rdp-protocol.reg"
                download="disable-rdp-protocol.reg"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm hover:border-[var(--color-primary)]"
              >
                <Download size={16} />
                下载卸载文件
              </a>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-3">
              未注册协议时，可在站点卡片上右键「下载 .rdp 连接文件」，双击该文件同样能连接；文件里已写好地址与端口。
            </p>
          </div>

          {dataMessage && <p className="text-sm text-[var(--color-error)]">{dataMessage}</p>}
        </div>
      )}
    </Dialog>
  )
}
