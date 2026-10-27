import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { readPanel, withDataLock, writePanel } from '@/lib/db'
import { normalizeUserIds, normalizeVisibility } from '@/lib/visibility'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(request: Request, { params }: RouteParams) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  return withDataLock(async () => {
    try {
      const { id } = await params
      const body = await request.json()
      const name = String(body.name ?? '').trim()
      if (!name) return NextResponse.json({ error: '分组名称不能为空' }, { status: 400 })

      const data = await readPanel(user.id)
      const group = data.groups.find((item) => item.id === id)
      if (!group) return NextResponse.json({ error: '分组不存在' }, { status: 404 })

      group.name = name
      if (body.visibility !== undefined) group.visibility = normalizeVisibility(body.visibility)
      if (body.visibleUserIds !== undefined) {
        group.visibleUserIds = normalizeUserIds(body.visibleUserIds)
      }
      group.updatedAt = Date.now()
      await writePanel(user.id, data)
      return NextResponse.json(group)
    } catch (error) {
      console.error('Update group error:', error)
      return NextResponse.json({ error: '更新分组失败' }, { status: 500 })
    }
  })
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  return withDataLock(async () => {
    try {
      const { id } = await params
      const data = await readPanel(user.id)
      const index = data.groups.findIndex((item) => item.id === id)
      if (index === -1) return NextResponse.json({ error: '分组不存在' }, { status: 404 })

      data.groups.splice(index, 1)
      data.sites = data.sites.filter((site) => site.groupId !== id)
      await writePanel(user.id, data)
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Delete group error:', error)
      return NextResponse.json({ error: '删除分组失败' }, { status: 500 })
    }
  })
}
