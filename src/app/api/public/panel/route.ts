import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { readPanel, readUsers } from '@/lib/db'
import { filterPanelForViewer } from '@/lib/visibility'
import { withWebdavProxyUrls } from '@/lib/webdavProxy'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const viewer = await verifyAuth(request)

  // 已登录用户在自己的首页看自己的面板，避免看到别人的分组
  if (viewer) {
    return NextResponse.json(
      {
        adminName: viewer.username,
        viewerName: viewer.username,
        panel: await withWebdavProxyUrls(await readPanel(viewer.id)),
      },
      { headers: NO_STORE }
    )
  }

  const users = await readUsers()
  const admins = users
    .filter((user) => user.role === 'admin')
    .sort((a, b) => a.createdAt - b.createdAt)

  const owner = admins.find((user) => user.enabled) || admins[0]

  if (!owner) {
    return NextResponse.json(
      {
        adminName: null,
        viewerName: null,
        panel: { groups: [], sites: [] },
      },
      { headers: NO_STORE }
    )
  }

  const panel = await readPanel(owner.id)
  return NextResponse.json(
    {
      adminName: owner.username,
      viewerName: null,
      panel: await withWebdavProxyUrls(filterPanelForViewer(panel, null)),
    },
    { headers: NO_STORE }
  )
}
