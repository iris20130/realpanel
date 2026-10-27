import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { buildBackup } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { backup } = await buildBackup(user)
  const filename =
    backup.scope === 'all'
      ? `ricpanel-config-${new Date().toISOString().slice(0, 10)}.json`
      : `panel-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
