import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { readAccess } from '@/lib/db'

export const dynamic = 'force-dynamic'

// 登录成员在编辑站点时读取，用于给离线文件 / WebDAV 链接拼接内外网前缀
export async function GET(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  return NextResponse.json(await readAccess())
}
