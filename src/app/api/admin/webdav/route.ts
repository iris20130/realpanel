import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { readWebdav, writeWebdav } from '@/lib/db'
import { listWebdav } from '@/lib/webdav'
import type { WebDavConfig } from '@/types'

export const dynamic = 'force-dynamic'

async function requireAdmin(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return { error: NextResponse.json({ error: '未登录' }, { status: 401 }) }
  if (user.role !== 'admin') {
    return { error: NextResponse.json({ error: '需要管理员权限' }, { status: 403 }) }
  }
  return { user }
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  return NextResponse.json(await readWebdav())
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  try {
    const body = (await request.json()) as Partial<WebDavConfig>
    if (body.enabled && !body.internalUrl?.trim()) {
      return NextResponse.json({ error: '启用挂载时必须填写 WebDAV 内网地址' }, { status: 400 })
    }
    return NextResponse.json(await writeWebdav(body))
  } catch {
    return NextResponse.json({ error: '保存失败' }, { status: 400 })
  }
}

// 测试连接：返回根目录内容
export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  try {
    const body = (await request.json()) as WebDavConfig
    const config = {
      enabled: true,
      internalUrl: (body.internalUrl || '').trim().replace(/\/+$/, ''),
      externalUrl: (body.externalUrl || '').trim().replace(/\/+$/, '') || undefined,
      username: body.username?.trim() || undefined,
      password: body.password ?? undefined,
    }
    if (!config.internalUrl) {
      return NextResponse.json({ error: '请先填写 WebDAV 地址' }, { status: 400 })
    }
    const entries = await listWebdav(config, '/')
    return NextResponse.json({ success: true, count: entries.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '连接失败' },
      { status: 502 }
    )
  }
}
