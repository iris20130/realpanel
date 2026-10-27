import { NextResponse } from 'next/server'
import { toPublicUser, verifyAuth } from '@/lib/auth'
import { getUserById, readPanel } from '@/lib/db'
import { withWebdavProxyUrls } from '@/lib/webdavProxy'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const actor = await verifyAuth(request)
  if (!actor) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })

  const { id } = await params
  const target = await getUserById(id)
  if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 })

  const panel = await withWebdavProxyUrls(await readPanel(target.id))
  return NextResponse.json({ user: toPublicUser(target), panel })
}
