import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { normalizeGroupIcon, normalizeGroupLayout, readPanel, withDataLock, writePanel } from '@/lib/db'
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
      if (body.parentId !== undefined) {
        const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : null
        if (parentId) {
          if (parentId === id) {
            return NextResponse.json({ error: '不能选择自己作为上级分组' }, { status: 400 })
          }
          const parent = data.groups.find((item) => item.id === parentId)
          if (!parent) return NextResponse.json({ error: '上级分组不存在' }, { status: 400 })
          if (parent.parentId) {
            return NextResponse.json({ error: '最多支持两级分组' }, { status: 400 })
          }
          if (data.groups.some((item) => item.parentId === id)) {
            return NextResponse.json(
              { error: '该分组下已有子分组，不能再设为子分组' },
              { status: 400 }
            )
          }
        }
        if (parentId) group.parentId = parentId
        else delete group.parentId
      }
      if (body.icon !== undefined) {
        const icon = normalizeGroupIcon(body.icon)
        if (icon) group.icon = icon
        else delete group.icon
      }
      if (body.visibility !== undefined) group.visibility = normalizeVisibility(body.visibility)
      if (body.visibleUserIds !== undefined) {
        group.visibleUserIds = normalizeUserIds(body.visibleUserIds)
      }
      if (body.layout !== undefined) {
        const layout = normalizeGroupLayout(body.layout)
        if (layout) group.layout = layout
        else delete group.layout
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
      // 一并删除该分组下的子分组及其网站
      const childIds = data.groups.filter((item) => item.parentId === id).map((item) => item.id)
      if (childIds.length > 0) {
        const childSet = new Set(childIds)
        data.groups = data.groups.filter((item) => !childSet.has(item.id))
      }
      const removed = new Set([id, ...childIds])
      data.sites = data.sites.filter((site) => !removed.has(site.groupId))
      await writePanel(user.id, data)
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Delete group error:', error)
      return NextResponse.json({ error: '删除分组失败' }, { status: 500 })
    }
  })
}
