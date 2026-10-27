import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { readPanel, readUsers } from '@/lib/db'
import { filterPanelForViewer } from '@/lib/visibility'
import { withWebdavProxyUrls } from '@/lib/webdavProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const viewer = await verifyAuth(request)

  const users = await readUsers()
  const admins = users
    .filter((user) => user.role === 'admin')
    .sort((a, b) => a.createdAt - b.createdAt)

  const owner = admins.find((user) => user.enabled) || admins[0]

  if (!owner) {
    return NextResponse.json({
      adminName: null,
      viewerName: viewer?.username ?? null,
      panel: { groups: [], sites: [] },
    })
  }

  const panel = await readPanel(owner.id)
  return NextResponse.json({
    adminName: owner.username,
    viewerName: viewer?.username ?? null,
    panel: await withWebdavProxyUrls(filterPanelForViewer(panel, viewer)),
  })
}
