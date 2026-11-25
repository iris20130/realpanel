'use client'

import { useState, useEffect } from 'react'
import { Dialog, Input, Button, Select } from '@/components/ui'
import { IconPicker } from './IconPicker'
import { Icon } from '@/components/icons/Icon'
import { useAuthStore } from '@/stores/auth'
import { api, type UserWithStats } from '@/lib/api'
import { clampGroupCols, clampGroupRows } from '@/lib/groupLayout'
import type { Group, GroupLayout, GroupOrientation, SiteIcon, VisibilityMode } from '@/types'
import { cn } from '@/lib/utils'
import { RotateCcw, X } from 'lucide-react'

interface GroupEditDialogProps {
  open: boolean
  onClose: () => void
  group?: Group
  /** 当前面板全部分组：用于选择上级分组，只能挂到一级分组下 */
  groups?: Group[]
  /** 新建时的默认上级分组（侧边栏当前分类） */
  defaultParentId?: string | null
  onSave: (
    name: string,
    visibility: VisibilityMode,
    visibleUserIds: string[],
    layout?: GroupLayout,
    parentId?: string | null,
    icon?: SiteIcon | null
  ) => void
}

export function GroupEditDialog({
  open,
  onClose,
  group,
  groups = [],
  defaultParentId,
  onSave,
}: GroupEditDialogProps) {
  const { token, user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [visibility, setVisibility] = useState<VisibilityMode>('public')
  const [visibleUserIds, setVisibleUserIds] = useState<string[]>([])
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [icon, setIcon] = useState<SiteIcon | null>(null)
  const [orientation, setOrientation] = useState<GroupOrientation>('horizontal')
  const [sizeMode, setSizeMode] = useState<'auto' | 'custom'>('auto')
  const [cols, setCols] = useState('')
  const [rows, setRows] = useState('')

  useEffect(() => {
    if (open) {
      setName(group?.name || '')
      setParentId(group?.parentId || (group ? '' : defaultParentId || ''))
      setVisibility(group?.visibility || 'public')
      setVisibleUserIds(group?.visibleUserIds || [])
      setIcon(group?.icon ?? null)
      setOrientation(group?.layout?.orientation || 'horizontal')
      setSizeMode(group?.layout?.cols || group?.layout?.rows ? 'custom' : 'auto')
      setCols(group?.layout?.cols ? String(group.layout.cols) : '')
      setRows(group?.layout?.rows ? String(group.layout.rows) : '')
    }
  }, [open, group, defaultParentId])

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

  const toggleUser = (id: string) => {
    setVisibleUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const buildLayout = (): GroupLayout | undefined => {
    const result: GroupLayout = { orientation }
    if (sizeMode === 'custom') {
      if (cols.trim()) result.cols = clampGroupCols(Number(cols))
      if (rows.trim()) result.rows = clampGroupRows(Number(rows))
    }
    if (!result.cols && !result.rows && orientation === 'horizontal') return undefined
    return result
  }

  const parentOptions = [
    { value: '', label: '无（一级分类）' },
    ...groups
      .filter((item) => !item.parentId && item.id !== group?.id)
      .map((item) => ({ value: item.id, label: item.name })),
  ]
  const hasChildren = Boolean(group && groups.some((item) => item.parentId === group.id))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave(
      name.trim(),
      visibility,
      visibility === 'users' ? visibleUserIds : [],
      buildLayout(),
      parentId || null,
      icon
    )
    onClose()
  }

  // 一键改回默认：自动宽度 + 自动高度 + 横排
  const handleResetLayout = () => {
    if (!group) {
      setOrientation('horizontal')
      setSizeMode('auto')
      setCols('')
      setRows('')
      return
    }
    onSave(
      name.trim() || group.name,
      visibility,
      visibility === 'users' ? visibleUserIds : [],
      undefined,
      parentId || null,
      icon
    )
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title={group ? '编辑分组' : '创建分组'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="分组名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="请输入分组名称"
          required
        />

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[var(--color-text-muted)]">
              分组图标（可选，一级分组显示在侧边栏）
            </span>
            {icon && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIcon(null)}
                className="gap-1 text-xs shrink-0"
              >
                <X size={12} />
                清除图标
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <Icon icon={icon ?? { type: 'iconify', value: 'mdi:folder' }} size={22} />
            </span>
            <IconPicker
              value={icon ?? { type: 'iconify', value: 'mdi:folder' }}
              onChange={setIcon}
            />
          </div>
        </div>

        <div>
          <Select
            label="上级分类"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            options={parentOptions}
            disabled={hasChildren}
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {hasChildren
              ? '该分组下已有子分组，只能作为一级分类。'
              : '留空即一级分类；选择上级后成为二级分组，在侧边栏布局中显示在对应分类下。'}
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]/60 p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="图标排列"
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as GroupOrientation)}
              options={[
                { value: 'horizontal', label: '横排（从左到右）' },
                { value: 'vertical', label: '竖排（从上到下）' },
              ]}
            />
            <Select
              label="分组尺寸"
              value={sizeMode}
              onChange={(e) => setSizeMode(e.target.value as 'auto' | 'custom')}
              options={[
                { value: 'auto', label: '默认（自适应图标数量）' },
                { value: 'custom', label: '自定义大小' },
              ]}
            />
          </div>

          {sizeMode === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="宽度（1-8 列）"
                type="number"
                min={1}
                max={8}
                value={cols}
                onChange={(e) => setCols(e.target.value)}
                placeholder="按图标自动"
              />
              <Input
                label="高度（1-8 行图标）"
                type="number"
                min={1}
                max={8}
                value={rows}
                onChange={(e) => setRows(e.target.value)}
                placeholder="按内容自动"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--color-text-muted)]">
              编辑模式下也可直接拖动分组右侧、底部或右下角调整大小，网格会自动与相邻分组对齐。
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetLayout}
              className="gap-1.5 shrink-0"
              title="恢复默认尺寸和横排"
            >
              <RotateCcw size={14} />
              一键恢复默认
            </Button>
          </div>
        </div>

        {isAdmin && (
          <div className="space-y-3">
            <Select
              label="可见范围"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as VisibilityMode)}
              options={[
                { value: 'public', label: '公开（所有人，含未登录访客）' },
                { value: 'members', label: '所有登录成员' },
                { value: 'users', label: '仅指定用户' },
              ]}
            />

            {visibility === 'users' && (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]/60 p-2">
                <p className="text-xs text-[var(--color-text-muted)] px-1 pb-1.5">
                  选择可以看到该分组的用户
                </p>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {users.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[var(--color-surface-hover)]"
                    >
                      <input
                        type="checkbox"
                        checked={visibleUserIds.includes(item.id)}
                        onChange={() => toggleUser(item.id)}
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
              未登录访客只能看到「公开」内容，管理员始终可见全部。
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit">{group ? '保存' : '创建'}</Button>
        </div>
      </form>
    </Dialog>
  )
}
