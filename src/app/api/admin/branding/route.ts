import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { normalizeBranding, writeBranding } from '@/lib/db'

export async function PUT(request: Request) {
  const actor = await verifyAuth(request)
  if (!actor) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })

  try {
    const body = await request.json()
    const branding = normalizeBranding(body)
    return NextResponse.json(await writeBranding(branding))
  } catch {
    return NextResponse.json({ error: '保存失败' }, { status: 400 })
  }
}
