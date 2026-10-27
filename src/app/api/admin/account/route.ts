import { NextResponse } from 'next/server'
import { updateAccount, verifyAuth } from '@/lib/auth'

export async function GET(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  return NextResponse.json(user)
}

export async function PUT(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  try {
    const body = await request.json()
    const updates: { username?: string; password?: string } = {}
    if (typeof body.username === 'string' && body.username.trim()) updates.username = body.username
    if (typeof body.password === 'string' && body.password) updates.password = body.password

    if (!updates.username && !updates.password) {
      return NextResponse.json({ error: '没有需要更新的内容' }, { status: 400 })
    }

    const result = await updateAccount(user.id, updates)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, user: result.user, token: result.token })
  } catch (error) {
    console.error('Update account error:', error)
    return NextResponse.json({ error: '更新账户失败' }, { status: 500 })
  }
}
