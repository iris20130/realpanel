import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { readPanel, withDataLock, writePanel } from '@/lib/db'
import type { NetworkScope, OpenMode, Site, SiteIcon, SiteVisibility } from '@/types'
import { normalizeUrlInput } from '@/lib/utils'
import { normalizeSiteVisibility, normalizeUserIds } from '@/lib/visibility'
import { withWebdavProxySite } from '@/lib/webdavProxy'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface SiteBody {
  groupId?: string
  title?: string
  description?: string
  notice?: string
  icon?: SiteIcon
  externalUrl?: string
  internalUrl?: string
  networkScope?: NetworkScope
  openMode?: OpenMode
  tags?: string[]
  visibility?: SiteVisibility
  visibleUserIds?: string[]
  enabled?: boolean
}

function normalizeScope(value: unknown): NetworkScope {
  return value === 'both' || value === 'intranet' || value === 'internet' ? value : 'auto'
}

export async function PUT(request: Request, { params }: RouteParams) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  return withDataLock(async () => {
    try {
      const { id } = await params
      const body = (await request.json()) as SiteBody
      const data = await readPanel(user.id)
      const site = data.sites.find((item) => item.id === id)
      if (!site) return NextResponse.json({ error: '网站不存在' }, { status: 404 })

      if (body.title !== undefined) {
        const title = String(body.title).trim()
        if (!title) return NextResponse.json({ error: '网站标题不能为空' }, { status: 400 })
        site.title = title
      }

      if (body.groupId !== undefined) {
        if (!data.groups.some((group) => group.id === body.groupId)) {
          return NextResponse.json({ error: '分组不存在' }, { status: 400 })
        }
        if (body.groupId !== site.groupId) {
          const groupSites = data.sites.filter((item) => item.groupId === body.groupId)
          site.order = Math.max(0, ...groupSites.map((item) => item.order)) + 1
          site.groupId = body.groupId
        }
      }

      if (body.externalUrl !== undefined) site.externalUrl = normalizeUrlInput(body.externalUrl)
      if (body.internalUrl !== undefined) site.internalUrl = normalizeUrlInput(body.internalUrl)
      if (!site.externalUrl && !site.internalUrl) {
        return NextResponse.json({ error: '内网地址和外网地址至少填写一个' }, { status: 400 })
      }

      if (body.description !== undefined) site.description = body.description.trim() || undefined
      if (body.notice !== undefined) site.notice = body.notice.trim().slice(0, 500) || undefined
      if (body.icon) site.icon = body.icon
      if (body.networkScope !== undefined) site.networkScope = normalizeScope(body.networkScope)
      if (body.openMode === 'current' || body.openMode === 'blank' || body.openMode === 'modal') {
        site.openMode = body.openMode
      }
      if (Array.isArray(body.tags)) site.tags = body.tags.map(String).filter(Boolean)
      if (body.visibility !== undefined) site.visibility = normalizeSiteVisibility(body.visibility)
      if (body.visibleUserIds !== undefined) {
        site.visibleUserIds = normalizeUserIds(body.visibleUserIds)
      }
      if (typeof body.enabled === 'boolean') site.enabled = body.enabled
      site.updatedAt = Date.now()

      await writePanel(user.id, data)
      return NextResponse.json(await withWebdavProxySite(site as Site))
    } catch (error) {
      console.error('Update site error:', error)
      return NextResponse.json({ error: '更新网站失败' }, { status: 500 })
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
      const index = data.sites.findIndex((item) => item.id === id)
      if (index === -1) return NextResponse.json({ error: '网站不存在' }, { status: 404 })

      data.sites.splice(index, 1)
      await writePanel(user.id, data)
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Delete site error:', error)
      return NextResponse.json({ error: '删除网站失败' }, { status: 500 })
    }
  })
}
