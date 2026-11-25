import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { normalizeGroupIcon, normalizeGroupLayout, readPanel, withDataLock, writePanel } from '@/lib/db'
import type { Group } from '@/types'
import { generateId, getCurrentTimestamp } from '@/lib/utils'
import { normalizeUserIds, normalizeVisibility } from '@/lib/visibility'

export async function GET(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const data = await readPanel(user.id)
  return NextResponse.json([...data.groups].sort((a, b) => a.order - b.order))
}

export async function POST(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  return withDataLock(async () => {
    try {
      const body = await request.json()
      const name = String(body.name ?? '').trim()
      if (!name) return NextResponse.json({ error: '分组名称不能为空' }, { status: 400 })

      const data = await readPanel(user.id)
      const maxOrder = Math.max(-1, ...data.groups.map((group) => group.order))

      const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : undefined
      if (parentId) {
        const parent = data.groups.find((group) => group.id === parentId)
        if (!parent) return NextResponse.json({ error: '上级分组不存在' }, { status: 400 })
        if (parent.parentId) {
          return NextResponse.json({ error: '最多支持两级分组' }, { status: 400 })
        }
      }

      const newGroup: Group = {
        id: generateId(),
        name,
        order: maxOrder + 1,
        ...(parentId ? { parentId } : {}),
        ...(normalizeGroupIcon(body.icon) ? { icon: normalizeGroupIcon(body.icon) } : {}),
        visibility: normalizeVisibility(body.visibility),
        visibleUserIds: normalizeUserIds(body.visibleUserIds),
        layout: normalizeGroupLayout(body.layout),
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
      }

      data.groups.push(newGroup)
      await writePanel(user.id, data)
      return NextResponse.json(newGroup)
    } catch (error) {
      console.error('Create group error:', error)
      return NextResponse.json({ error: '创建分组失败' }, { status: 500 })
    }
  })
}
