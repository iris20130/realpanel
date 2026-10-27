import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { deleteUploadFile } from '@/lib/db'

interface RouteParams {
  params: Promise<{ filename: string }>
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const actor = await verifyAuth(request)
  if (!actor) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })

  const { filename } = await params
  const deleted = await deleteUploadFile(filename)
  if (!deleted) return NextResponse.json({ error: '文件不存在或文件名无效' }, { status: 404 })

  return NextResponse.json({ success: true })
}
