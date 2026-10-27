'use client'

import { useState, useEffect } from 'react'
import { Dialog, Input, Button, Select } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { api, type UserWithStats } from '@/lib/api'
import type { Group, VisibilityMode } from '@/types'
import { cn } from '@/lib/utils'

interface GroupEditDialogProps {
  open: boolean
  onClose: () => void
  group?: Group
  onSave: (name: string, visibility: VisibilityMode, visibleUserIds: string[]) => void
}

export function GroupEditDialog({ open, onClose, group, onSave }: GroupEditDialogProps) {
  const { token, user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState<VisibilityMode>('public')
  const [visibleUserIds, setVisibleUserIds] = useState<string[]>([])
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setName(group?.name || '')
      setVisibility(group?.visibility || 'public')
      setVisibleUserIds(group?.visibleUserIds || [])
    }
  }, [open, group])

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave(name.trim(), visibility, visibility === 'users' ? visibleUserIds : [])
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
