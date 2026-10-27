'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, Input, Button, Select, Switch } from '@/components/ui'
import { IconPicker } from './IconPicker'
import { useAuthStore } from '@/stores/auth'
import { useSitesStore } from '@/stores/sites'
import { useUiStore } from '@/stores/ui'
import { api, type UserWithStats } from '@/lib/api'
import { normalizeUrlInput, cn } from '@/lib/utils'
import { parseShareTarget } from '@/lib/share'
import { parseRdpTarget } from '@/lib/rdp'
import { WebDavPicker } from './WebDavPicker'
import type { Site, SiteIcon, OpenMode, NetworkScope, SiteVisibility, WebDavEntry, PanelAccess } from '@/types'
import {
  Wand2,
  Loader2,
  Globe,
  Building2,
  FolderOpen,
  Monitor,
  CloudDownload,
  UploadCloud,
  FileCheck2,
} from 'lucide-react'

interface SiteEditDialogProps {
  open: boolean
  onClose: () => void
  site: Site | null
  initialGroupId?: string
  onSave: (site: Site) => void
}

interface FormState {
  groupId: string
  title: string
  description: string
  notice: string
  icon: SiteIcon
  externalUrl: string
  internalUrl: string
  networkScope: NetworkScope
  openMode: OpenMode
  tags: string[]
  visibility: SiteVisibility
  visibleUserIds: string[]
  enabled: boolean
}

const emptyForm = (groupId = ''): FormState => ({
  groupId,
  title: '',
  description: '',
  notice: '',
  icon: { type: 'iconify', value: 'mdi:link' },
  externalUrl: '',
  internalUrl: '',
  networkScope: 'auto',
  openMode: 'blank',
  tags: [],
  visibility: 'inherit',
  visibleUserIds: [],
  enabled: true,
})

// 用管理员配置的面板访问地址拼绝对链接；未配置时返回原相对路径
function withPanelBase(base: string | undefined, path: string | undefined): string | undefined {
  if (!base || !path) return path
  return `${base.replace(/\/+$/, '')}${path.startsWith('/') ? '' : '/'}${path}`
}

export function SiteEditDialog({ open, onClose, site, initialGroupId, onSave }: SiteEditDialogProps) {
  const { token, user } = useAuthStore()
  const { groups, addSite, updateSite } = useSitesStore()
  const { viewingUser } = useUiStore()
  const isAdmin = user?.role === 'admin'
  const [formData, setFormData] = useState<FormState>(emptyForm())
  const [tagInput, setTagInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detectMessage, setDetectMessage] = useState('')
  const [error, setError] = useState('')
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [offlineUploading, setOfflineUploading] = useState(false)
  const [offlineFile, setOfflineFile] = useState<{
    name: string
    path: string
    inline: boolean
  } | null>(null)
  const [webdavReady, setWebdavReady] = useState(false)
  const [showWebdav, setShowWebdav] = useState(false)
  const [access, setAccess] = useState<PanelAccess>({})
  const offlineInputRef = useRef<HTMLInputElement>(null)
  const lastDetectUrl = useRef('')

  const readOnly = Boolean(viewingUser)

  useEffect(() => {
    if (!open || !isAdmin || !token) return
    let cancelled = false
    setUsersLoading(true)
    api.admin
      .getUsers(token)
      .then((list) => {
        if (!cancelled) setUsers(list.filter((item) => item.enabled && item.id !== user?.id))
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setUsersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, isAdmin, token, user?.id])

  useEffect(() => {
    if (!open || !token) return
    let cancelled = false
    api.getAccess(token)
      .then((value) => {
        if (!cancelled) setAccess(value)
      })
      .catch(() => {
        if (!cancelled) setAccess({})
      })
    return () => {
      cancelled = true
    }
  }, [open, token])

  useEffect(() => {
    if (!open) return
    setError('')
    setDetectMessage('')
    setTagInput('')
    setOfflineFile(null)
    setShowWebdav(false)
    lastDetectUrl.current = ''
    api.webdav
      .status()
      .then((status) => setWebdavReady(status.enabled))
      .catch(() => setWebdavReady(false))

    if (site) {
      setFormData({
        groupId: site.groupId,
        title: site.title,
        description: site.description || '',
        notice: site.notice || '',
        icon: site.icon,
        externalUrl: site.externalUrl || '',
        internalUrl: site.internalUrl || '',
        networkScope: site.networkScope || 'auto',
        openMode: site.openMode,
        tags: site.tags || [],
        visibility: site.visibility || 'inherit',
        visibleUserIds: site.visibleUserIds || [],
        enabled: site.enabled,
      })
    } else {
      setFormData(emptyForm(initialGroupId || groups[0]?.id || ''))
    }
  }, [open, site, initialGroupId, groups])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }))

  const handleIconChange = (icon: SiteIcon) => {
    update('icon', icon)
    setDetectMessage('')
  }

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (tag && !formData.tags.includes(tag)) {
      update('tags', [...formData.tags, tag])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    update(
      'tags',
      formData.tags.filter((t) => t !== tag)
    )
  }

  const toggleVisibleUser = (id: string) => {
    update(
      'visibleUserIds',
      formData.visibleUserIds.includes(id)
        ? formData.visibleUserIds.filter((item) => item !== id)
        : [...formData.visibleUserIds, id]
    )
  }

  const detectIcon = async (silent = false) => {
    if (!token || readOnly) return
    const rawUrl = formData.externalUrl || formData.internalUrl
    if (rawUrl.startsWith('/')) {
      if (!silent) setDetectMessage('面板直链无需识别图标，可直接手动选择图标')
      return
    }
    if (parseShareTarget(rawUrl)) {
      if (!silent) setDetectMessage('SMB 共享地址无法自动识别图标，请手动选择')
      return
    }
    if (parseRdpTarget(rawUrl)) {
      if (!silent) setDetectMessage('远程桌面地址无法自动识别图标，请手动选择')
      return
    }
    const normalized = normalizeUrlInput(rawUrl)
    if (!normalized) {
      if (!silent) setDetectMessage('请先填写有效的内网或外网地址')
      return
    }

    lastDetectUrl.current = normalized
    setDetecting(true)
    setDetectMessage('')
    try {
      const result = await api.admin.detectIcon(token, normalized, formData.title.trim() || undefined)
      update('icon', result.icon)
      setDetectMessage(result.source === 'favicon' ? '已自动识别网站图标' : '已自动匹配图标库图标')
    } catch (err) {
      if (!silent) setDetectMessage(err instanceof Error ? err.message : '图标识别失败')
    } finally {
      setDetecting(false)
    }
  }

  const maybeAutoDetect = () => {
    if (readOnly || detecting) return
    if (formData.icon.type !== 'iconify' || formData.icon.value !== 'mdi:link') return
    const normalized = normalizeUrlInput(formData.externalUrl || formData.internalUrl)
    if (!normalized || normalized === lastDetectUrl.current) return
    void detectIcon(true)
  }

  // 上传离线文件：内网地址跟随面板内网前缀，外网地址跟随反代前缀
  const handleOfflineUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token || readOnly) return
    setOfflineUploading(true)
    setDetectMessage('')
    try {
      const result = await api.files.upload(token, file, true)
      const internalUrl = access.internalUrl
        ? withPanelBase(access.internalUrl, result.path)!
        : `${window.location.origin}${result.path}`
      const externalUrl = access.externalUrl ? withPanelBase(access.externalUrl, result.path)! : ''
      update('internalUrl', internalUrl)
      update('externalUrl', externalUrl)
      setOfflineFile({ name: result.name, path: result.path, inline: result.inline })
      if (!formData.title.trim()) {
        update('title', file.name.replace(/\.[^.]+$/, ''))
      }
      setDetectMessage(
        externalUrl ? `已上传：内网 ${internalUrl}｜外网 ${externalUrl}` : `已上传：${internalUrl}`
      )
    } catch (err) {
      setDetectMessage(err instanceof Error ? err.message : '上传失败')
    } finally {
      setOfflineUploading(false)
      if (offlineInputRef.current) offlineInputRef.current.value = ''
    }
  }

  const handleOfflineInline = async (checked: boolean) => {
    if (!offlineFile || !token) return
    try {
      const updated = await api.files.setInline(token, offlineFile.name, checked)
      setOfflineFile({ ...offlineFile, inline: updated.inline })
    } catch (err) {
      setDetectMessage(err instanceof Error ? err.message : '设置失败')
    }
  }

  const applyWebdavFile = (entry: WebDavEntry) => {
    // 用面板代理直链，浏览器不会弹 WebDAV 的账号密码框；内外网各走各的取文件通道
    const internalPath = entry.fileUrl || entry.internalUrl
    const externalPath = entry.externalFileUrl || (access.externalUrl ? entry.fileUrl : '') || ''
    const internalUrl = withPanelBase(access.internalUrl, internalPath) || internalPath
    const externalUrl = withPanelBase(access.externalUrl, externalPath) || externalPath || ''
    update('internalUrl', internalUrl)
    update('externalUrl', externalUrl)
    if (!formData.title.trim()) {
      update('title', entry.name.replace(/\.[^.]+$/, ''))
    }
    if (entry.isImage && formData.icon.type === 'iconify' && formData.icon.value === 'mdi:link') {
      update('icon', {
        type: 'favicon',
        value: `/api/webdav/raw?path=${encodeURIComponent(entry.path)}`,
      })
    }
    setShowWebdav(false)
    setDetectMessage(
      access.externalUrl && externalUrl
        ? '已填入面板直链：内网由面板代理取文件，外网 302 到反代 WebDAV 直链'
        : entry.externalFileUrl
          ? '已填入面板直链：内网走内网地址取文件，外网走反代地址由面板代理取文件'
          : '已填入面板直链，打开时不需要账号密码'
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!token || readOnly) return

    const externalUrl = normalizeUrlInput(formData.externalUrl)
    const internalUrl = normalizeUrlInput(formData.internalUrl)

    if (!externalUrl && !internalUrl) {
      setError('请至少填写内网地址或外网地址中的一个')
      return
    }
    if (!formData.title.trim()) {
      setError('请输入网站标题')
      return
    }
    if (!formData.groupId) {
      setError('请选择所属分组')
      return
    }

    setLoading(true)
    try {
      const payload = {
        groupId: formData.groupId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        notice: formData.notice.trim(),
        icon: formData.icon,
        externalUrl,
        internalUrl,
        networkScope: formData.networkScope,
        openMode: formData.openMode,
        tags: formData.tags,
        visibility: formData.visibility,
        visibleUserIds: formData.visibility === 'users' ? formData.visibleUserIds : [],
        enabled: formData.enabled,
      }

      if (site?.id) {
        const updated = await api.admin.updateSite(token, site.id, payload)
        updateSite(site.id, updated as Site)
        onSave(updated as Site)
      } else {
        const created = await api.admin.createSite(token, payload)
        addSite(created as Site)
        onSave(created as Site)
      }
      onClose()
    } catch (err) {
      console.error('Save site error:', err)
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={site?.id ? '编辑网站' : '添加网站'}
      className="max-w-2xl"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="site-form" disabled={loading || readOnly}>
            {loading ? '保存中...' : '保存'}
          </Button>
        </div>
      }
    >
      <form id="site-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="所属分组"
            value={formData.groupId}
            onChange={(e) => update('groupId', e.target.value)}
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
            required
          />
          <Input
            label="标题"
            value={formData.title}
            onChange={(e) => update('title', e.target.value)}
            onBlur={maybeAutoDetect}
            placeholder="网站标题"
            required
          />
        </div>

        <Input
          label="描述"
          value={formData.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="网站描述（可选）"
        />

        <div>
          <label
            htmlFor="site-notice"
            className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5"
          >
            点击提示文字
          </label>
          <textarea
            id="site-notice"
            rows={3}
            value={formData.notice}
            onChange={(e) => update('notice', e.target.value)}
            placeholder="留空则不提示。例如：账号 admin，密码 123456"
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-y"
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            填写后点击卡片会先弹出这段文字，点「确认打开」后才打开网站或下载文件，可用来写账号密码或使用说明
          </p>
        </div>

        {/* 内外网地址 */}
        <div className="space-y-3 p-4 rounded-xl bg-[var(--color-background)]/70 border border-[var(--color-border)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">访问地址与网络范围</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                填哪个地址，就在对应网络下自动显示；都填则各走各的地址
              </p>
            </div>
            <span className="text-xs text-[var(--color-text-muted)] shrink-0">至少填一个</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="外网地址"
              value={formData.externalUrl}
              onChange={(e) => update('externalUrl', e.target.value)}
              onBlur={maybeAutoDetect}
              placeholder="https://example.com"
            />
            <Input
              label="内网地址"
              value={formData.internalUrl}
              onChange={(e) => update('internalUrl', e.target.value)}
              onBlur={maybeAutoDetect}
              placeholder={'http://192.168.1.10:8080、\\\\192.168.1.10\\share 或 rdp://192.168.1.10:3389'}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={offlineInputRef}
              type="file"
              accept=".html,.htm,.svg,.pdf,.txt,.md,image/*"
              onChange={handleOfflineUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => offlineInputRef.current?.click()}
              disabled={offlineUploading || readOnly}
              className="gap-1.5"
            >
              {offlineUploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
              {offlineUploading ? '上传中...' : '上传离线文件'}
            </Button>
            {webdavReady && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowWebdav(true)}
                disabled={readOnly}
                className="gap-1.5"
              >
                <CloudDownload size={14} />
                从 WebDAV 选择
              </Button>
            )}
            {offlineFile && (
              <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] px-2 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)]">
                <FileCheck2 size={13} className="text-[var(--color-success)]" />
                <span className="truncate max-w-[160px]">{offlineFile.name}</span>
                <input
                  type="checkbox"
                  checked={offlineFile.inline}
                  onChange={(e) => void handleOfflineInline(e.target.checked)}
                  className="accent-[var(--color-primary)] ml-1"
                />
                网页直接展示
              </label>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1">
              <Building2 size={12} /> 内网地址与本机同网段时自动走内网
            </span>
            <span className="inline-flex items-center gap-1">
              <Globe size={12} /> 否则优先走外网；只有内网且不同网段则不显示
            </span>
            <span className="inline-flex items-center gap-1">
              <FolderOpen size={12} /> SMB 共享（\\192.168.1.10\share 或 smb://…）点击后由资源管理器打开
            </span>
            <span className="inline-flex items-center gap-1">
              <Monitor size={12} /> 远程桌面（rdp://192.168.1.10:3389）点击后调用系统 mstsc
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            离线文件上传后按「访问地址前缀/文件名」生成内外网链接，例如{' '}
            <code className="text-[var(--color-text)]">{`${typeof window !== 'undefined' ? window.location.origin : 'http://服务器:3000'}/页面.html`}</code>
            ；管理员在「设置 → 访问地址」里配置前缀后改用配置的地址。
            勾选「网页直接展示」则内联打开，取消勾选则作为附件下载。
          </p>
        </div>

        {/* 图标 */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <label className="block text-sm font-medium text-[var(--color-text-muted)]">
              图标
              <span className="text-[var(--color-error)] ml-0.5">*</span>
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => detectIcon(false)}
              disabled={detecting || readOnly}
              className="gap-1.5"
            >
              {detecting ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {detecting ? '识别中...' : '自动识别图标'}
            </Button>
          </div>
          <IconPicker value={formData.icon} onChange={handleIconChange} />
          {detectMessage && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">{detectMessage}</p>
          )}
        </div>

        <Select
          label="打开方式"
          value={formData.openMode}
          onChange={(e) => update('openMode', e.target.value as OpenMode)}
          options={[
            { value: 'blank', label: '新窗口打开' },
            { value: 'current', label: '当前页面打开' },
            { value: 'modal', label: '弹窗打开 (iframe)' },
          ]}
        />

        {formData.openMode === 'modal' && (
          <p className="text-sm text-[var(--color-warning)] -mt-3">
            注意：部分网站禁止被嵌入，弹窗模式可能无法正常显示
          </p>
        )}

        {/* 成员可见范围 */}
        {isAdmin && (
          <div className="space-y-3 p-4 rounded-xl bg-[var(--color-background)]/70 border border-[var(--color-border)]">
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">成员可见范围</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                作用于管理员共享面板（公开端口），默认跟随所属分组
              </p>
            </div>

            <Select
              label="可见范围"
              value={formData.visibility}
              onChange={(e) => update('visibility', e.target.value as SiteVisibility)}
              options={[
                { value: 'inherit', label: '跟随分组' },
                { value: 'public', label: '公开（含未登录访客）' },
                { value: 'members', label: '所有登录成员' },
                { value: 'users', label: '仅指定用户' },
              ]}
            />

            {formData.visibility === 'users' && (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-2">
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {users.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[var(--color-surface-hover)]"
                    >
                      <input
                        type="checkbox"
                        checked={formData.visibleUserIds.includes(item.id)}
                        onChange={() => toggleVisibleUser(item.id)}
                        className="accent-[var(--color-primary)]"
                      />
                      <span className="text-sm text-[var(--color-text)] truncate">
                        {item.username}
                      </span>
                      <span
                        className={cn(
                          'ml-auto text-[10px] px-1.5 py-0.5 rounded',
                          item.role === 'admin'
                            ? 'bg-purple-500/15 text-purple-400'
                            : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'
                        )}
                      >
                        {item.role === 'admin' ? '管理员' : '成员'}
                      </span>
                    </label>
                  ))}
                  {users.length === 0 && !usersLoading && (
                    <p className="text-xs text-[var(--color-text-muted)] px-2 py-3 text-center">
                      暂无其他可用用户
                    </p>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-[var(--color-text-muted)]">
              未登录访客只能看到「公开」内容；管理员始终可见全部。
            </p>
          </div>
        )}

        {/* 标签 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5">
            标签
          </label>
          <div className="flex gap-2 mb-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="输入标签"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={handleAddTag} className="shrink-0">
              添加
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-surface)] text-sm text-[var(--color-text-muted)]"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-[var(--color-text)]"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <Switch
          checked={formData.enabled}
          onChange={(checked) => update('enabled', checked)}
          label="启用"
        />

        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
      </form>

      <WebDavPicker
        open={showWebdav}
        onClose={() => setShowWebdav(false)}
        onSelect={applyWebdavFile}
      />
    </Dialog>
  )
}
