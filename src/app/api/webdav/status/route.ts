import { NextResponse } from 'next/server'
import { readWebdav } from '@/lib/db'

export const dynamic = 'force-dynamic'

// 不暴露账号密码，仅用于前端判断是否显示「从 WebDAV 选择」
export async function GET() {
  const config = await readWebdav()
  return NextResponse.json({
    enabled: config.enabled && Boolean(config.internalUrl),
    internalUrl: config.internalUrl,
    externalUrl: config.externalUrl || null,
  })
}
