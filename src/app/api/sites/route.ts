import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { readPanel } from '@/lib/db'
import { withWebdavProxyUrls } from '@/lib/webdavProxy'

export async function GET(request: Request) {
  const user = await verifyAuth(request)
  if (!user) {
    return NextResponse.json({ error: '未登录或登录已过期' }, { status: 401 })
  }

  const panel = await withWebdavProxyUrls(await readPanel(user.id))
  return NextResponse.json(panel)
}
