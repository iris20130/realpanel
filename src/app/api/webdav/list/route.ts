import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { readConfig, readWebdav } from '@/lib/db'
import { isWebdavReady, listWebdav, webdavFilePath } from '@/lib/webdav'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const config = await readWebdav()
  if (!isWebdavReady(config)) {
    return NextResponse.json({ error: '管理员尚未配置 WebDAV 挂载' }, { status: 400 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { path?: string }
    const dir = typeof body.path === 'string' && body.path.startsWith('/') ? body.path : '/'
    if (dir.includes('..')) {
      return NextResponse.json({ error: '路径不合法' }, { status: 400 })
    }
    const entries = await listWebdav(config, dir)
    const { jwtSecret } = await readConfig()
    for (const entry of entries) {
      if (entry.isDir) continue
      entry.fileUrl = webdavFilePath(entry.path, jwtSecret, 'internal')
      if (config.externalUrl) {
        entry.externalFileUrl = webdavFilePath(entry.path, jwtSecret, 'external')
      }
    }
    return NextResponse.json({ path: dir, entries })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '读取 WebDAV 目录失败' },
      { status: 502 }
    )
  }
}
