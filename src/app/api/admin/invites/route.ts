import { NextResponse } from 'next/server'
import { createInvite, verifyAuth } from '@/lib/auth'
import { readInvites } from '@/lib/db'

export async function GET(request: Request) {
  const actor = await verifyAuth(request)
  if (!actor) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })

  const invites = await readInvites()
  return NextResponse.json(invites)
}

export async function POST(request: Request) {
  const actor = await verifyAuth(request)
  if (!actor) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })

  try {
    const body = await request.json()
    const result = await createInvite({
      note: typeof body.note === 'string' ? body.note : undefined,
      maxUses: typeof body.maxUses === 'number' ? body.maxUses : 1,
      expiresInDays: typeof body.expiresInDays === 'number' ? body.expiresInDays : 0,
      createdBy: actor.id,
    })
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result.invite)
  } catch (error) {
    console.error('Create invite error:', error)
    return NextResponse.json({ error: '生成邀请码失败' }, { status: 500 })
  }
}
