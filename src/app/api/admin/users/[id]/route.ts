import { NextResponse } from 'next/server'
import { deleteUserAsAdmin, updateUserAsAdmin, verifyAuth } from '@/lib/auth'
import type { UserRole } from '@/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(request: Request, { params }: RouteParams) {
  const actor = await verifyAuth(request)
  if (!actor) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()
    const updates: {
      username?: string
      password?: string
      role?: UserRole
      enabled?: boolean
    } = {}

    if (typeof body.username === 'string') updates.username = body.username
    if (typeof body.password === 'string' && body.password) updates.password = body.password
    if (body.role === 'admin' || body.role === 'user') updates.role = body.role
    if (typeof body.enabled === 'boolean') updates.enabled = body.enabled

    const result = await updateUserAsAdmin(actor.id, id, updates)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result.user)
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: '更新用户失败' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const actor = await verifyAuth(request)
  if (!actor) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })

  try {
    const { id } = await params
    const result = await deleteUserAsAdmin(actor.id, id)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: '删除用户失败' }, { status: 500 })
  }
}
