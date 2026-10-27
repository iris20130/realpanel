import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { writeAccess } from '@/lib/db'
import type { PanelAccess } from '@/types'

export const dynamic = 'force-dynamic'

function parseBase(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new Error(`${label}格式不正确`)
  const raw = value.trim().replace(/\/+$/, '')
  if (!raw) return undefined
  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(raw) ? raw : `http://${raw}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol')
    return candidate
  } catch {
    throw new Error(`${label}不是有效的 http/https 地址`)
  }
}

export async function PUT(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (user.role !== 'admin') {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
  }

  try {
    const body = (await request.json()) as Partial<PanelAccess>
    const access = {
      internalUrl: parseBase(body.internalUrl, '内网地址'),
      externalUrl: parseBase(body.externalUrl, '反代地址'),
    }
    return NextResponse.json(await writeAccess(access))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '保存失败' },
      { status: 400 }
    )
  }
}
