import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { readPanel, withDataLock, writePanel } from '@/lib/db'
import type { NetworkScope, OpenMode, Site, SiteIcon, SiteVisibility } from '@/types'
import { generateId, getCurrentTimestamp, normalizeUrlInput } from '@/lib/utils'
import { normalizeSiteVisibility, normalizeUserIds } from '@/lib/visibility'
import { withWebdavProxySite, withWebdavProxyUrls } from '@/lib/webdavProxy'

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

export async function GET(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const data = await readPanel(user.id)
  const panel = await withWebdavProxyUrls(data)
  return NextResponse.json(panel.sites)
}

export async function POST(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  return withDataLock(async () => {
    try {
      const body = (await request.json()) as SiteBody
      const title = String(body.title ?? '').trim()
      const groupId = String(body.groupId ?? '')
      const externalUrl = normalizeUrlInput(body.externalUrl)
      const internalUrl = normalizeUrlInput(body.internalUrl)

      if (!title) return NextResponse.json({ error: '请填写网站标题' }, { status: 400 })
      if (!groupId) return NextResponse.json({ error: '请选择分组' }, { status: 400 })
      if (!externalUrl && !internalUrl) {
        return NextResponse.json({ error: '内网地址和外网地址至少填写一个' }, { status: 400 })
      }

      const data = await readPanel(user.id)
      if (!data.groups.some((group) => group.id === groupId)) {
        return NextResponse.json({ error: '分组不存在' }, { status: 400 })
      }

      const groupSites = data.sites.filter((site) => site.groupId === groupId)
      const maxOrder = Math.max(0, ...groupSites.map((site) => site.order))
      const now = getCurrentTimestamp()

      const site: Site = {
        id: generateId(),
        groupId,
        title,
        description: body.description?.trim() || undefined,
        notice: body.notice?.trim().slice(0, 500) || undefined,
        icon: body.icon ?? { type: 'iconify', value: 'mdi:web' },
        externalUrl,
        internalUrl,
        networkScope: normalizeScope(body.networkScope),
        openMode: body.openMode === 'current' || body.openMode === 'modal' ? body.openMode : 'blank',
        tags: Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : [],
        visibility: normalizeSiteVisibility(body.visibility),
        visibleUserIds: normalizeUserIds(body.visibleUserIds),
        enabled: body.enabled !== false,
        order: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      }

      data.sites.push(site)
      await writePanel(user.id, data)
      return NextResponse.json(await withWebdavProxySite(site))
    } catch (error) {
      console.error('Create site error:', error)
      return NextResponse.json({ error: '创建网站失败' }, { status: 500 })
    }
  })
}
