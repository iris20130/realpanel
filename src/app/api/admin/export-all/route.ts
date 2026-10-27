import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { buildBackup } from '@/lib/db'
// @ts-expect-error adm-zip 无内置类型
import AdmZip from 'adm-zip'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  try {
    const { backup, uploads, files } = await buildBackup(user)
    const zip = new AdmZip()
    zip.addFile('backup.json', Buffer.from(JSON.stringify(backup, null, 2), 'utf8'))
    for (const [filename, buffer] of uploads) {
      zip.addFile(`uploads/${filename}`, buffer)
    }
    for (const [filename, buffer] of files) {
      zip.addFile(`files/${filename}`, buffer)
    }

    const data = zip.toBuffer()
    const name =
      backup.scope === 'all'
        ? `ricpanel-backup-${new Date().toISOString().slice(0, 10)}.zip`
        : `panel-backup-${new Date().toISOString().slice(0, 10)}.zip`

    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${name}"`,
      },
    })
  } catch (error) {
    console.error('Export all error:', error)
    return NextResponse.json({ error: '导出失败' }, { status: 500 })
  }
}
