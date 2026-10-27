import { NextResponse } from 'next/server'
import { createUserAsAdmin, toPublicUser, verifyAuth } from '@/lib/auth'
import { readPanel, readUsers } from '@/lib/db'
import type { UserRole } from '@/types'

export async function GET(request: Request) {
  const actor = await verifyAuth(request)
  if (!actor) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })

  const users = await readUsers()
  const result = await Promise.all(
    users.map(async (user) => {
      const panel = await readPanel(user.id)
      return {
        ...toPublicUser(user),
        groupCount: panel.groups.length,
        siteCount: panel.sites.length,
      }
    })
  )

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const actor = await verifyAuth(request)
  if (!actor) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })

  try {
    const body = await request.json()
    const username = String(body.username ?? '')
    const password = String(body.password ?? '')
    const role: UserRole = body.role === 'admin' ? 'admin' : 'user'

    const result = await createUserAsAdmin({ username, password, role })
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result.user)
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: '创建用户失败' }, { status: 500 })
  }
}
