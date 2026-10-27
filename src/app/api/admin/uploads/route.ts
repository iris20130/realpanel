import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { listUploadFiles } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const actor = await verifyAuth(request)
  if (!actor) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })

  return NextResponse.json(await listUploadFiles())
}
