import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { readInvites, withDataLock, writeInvites } from '@/lib/db'

interface RouteParams {
  params: Promise<{ code: string }>
}

export async function PUT(request: Request, { params }: RouteParams) {
  const actor = await verifyAuth(request)
  if (!actor) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })

  const { code } = await params
  const body = await request.json()

  return withDataLock(async () => {
    const invites = await readInvites()
    const invite = invites.find((item) => item.code === code)
    if (!invite) return NextResponse.json({ error: '邀请码不存在' }, { status: 404 })

    if (typeof body.enabled === 'boolean') invite.enabled = body.enabled
    await writeInvites(invites)
    return NextResponse.json(invite)
  })
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const actor = await verifyAuth(request)
  if (!actor) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })

  const { code } = await params

  return withDataLock(async () => {
    const invites = await readInvites()
    const next = invites.filter((item) => item.code !== code)
    if (next.length === invites.length) {
      return NextResponse.json({ error: '邀请码不存在' }, { status: 404 })
    }
    await writeInvites(next)
    return NextResponse.json({ success: true })
  })
}
