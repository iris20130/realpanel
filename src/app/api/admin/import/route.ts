import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { normalizePanel, restoreBackup, writePanel, withDataLock } from '@/lib/db'
import type { BackupFile } from '@/types'
// @ts-expect-error adm-zip 无内置类型
import AdmZip from 'adm-zip'

export const dynamic = 'force-dynamic'

function isBackup(value: unknown): value is BackupFile {
  const raw = value as Partial<BackupFile> | null
  return Boolean(
    raw &&
      raw.format === 'ricpanel-backup' &&
      (raw.scope === 'all' || raw.scope === 'user') &&
      (raw.panel || raw.panels)
  )
}

export async function POST(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  return withDataLock(async () => {
    try {
      const contentType = request.headers.get('content-type') || ''
      let backup: BackupFile | null = null
      const uploads = new Map<string, Buffer>()
      const offlineFiles = new Map<string, Buffer>()
      if (contentType.includes('multipart/form-data')) {
        const form = await request.formData()
        const file = form.get('file')
        if (!(file instanceof File)) {
          return NextResponse.json({ error: '未找到上传文件' }, { status: 400 })
        }
        const buffer = Buffer.from(await file.arrayBuffer())
        if (file.name.toLowerCase().endsWith('.zip')) {
          const zip = new AdmZip(buffer)
          const entry = zip.getEntry('backup.json')
          if (!entry) {
            return NextResponse.json({ error: 'ZIP 中缺少 backup.json' }, { status: 400 })
          }
          backup = JSON.parse(zip.readAsText(entry))
          for (const item of zip.getEntries()) {
            if (item.isDirectory) continue
            if (item.entryName.startsWith('uploads/')) {
              uploads.set(item.entryName.slice('uploads/'.length), item.getData())
            } else if (item.entryName.startsWith('files/')) {
              offlineFiles.set(item.entryName.slice('files/'.length), item.getData())
            }
          }
        } else {
          backup = JSON.parse(buffer.toString('utf8'))
        }
      } else {
        const body = await request.json()
        backup = body
      }

      if (isBackup(backup)) {
        if (backup.scope === 'all' && user.role !== 'admin') {
          return NextResponse.json({ error: '仅管理员可导入完整备份' }, { status: 403 })
        }
        const result = await restoreBackup(backup, user, uploads, offlineFiles)
        return NextResponse.json({ success: true, ...result })
      }

      // 兼容旧的纯面板 JSON
      const panel = backup as unknown as { groups?: unknown; sites?: unknown }
      if (!Array.isArray(panel?.groups) || !Array.isArray(panel?.sites)) {
        return NextResponse.json({ error: '数据格式错误：需要 backup.json 或面板 groups/sites' }, { status: 400 })
      }
      await writePanel(user.id, normalizePanel(panel))
      return NextResponse.json({ success: true, scope: 'user', panels: 1 })
    } catch (error) {
      console.error('Import error:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : '导入失败' },
        { status: 500 }
      )
    }
  })
}
