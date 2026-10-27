import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { saveStoredFile } from '@/lib/db'
import { isAllowedUpload, mimeForFile, MAX_STORED_FILE_BYTES } from '@/lib/files'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '未选择文件' }, { status: 400 })
    }
    if (!isAllowedUpload(file.name)) {
      return NextResponse.json(
        { error: '不支持的文件类型，仅支持 html / svg / 图片 / PDF / 文本 / 压缩包' },
        { status: 400 }
      )
    }
    if (file.size > MAX_STORED_FILE_BYTES) {
      return NextResponse.json({ error: '文件超过 50MB' }, { status: 400 })
    }

    const meta = await saveStoredFile({
      name: file.name,
      buffer: Buffer.from(await file.arrayBuffer()),
      mime: mimeForFile(file.name),
      ownerId: user.id,
      inline: form.get('inline') !== 'false',
    })

    return NextResponse.json({
      ...meta,
      path: `/${encodeURIComponent(meta.name)}`,
    })
  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json({ error: '上传失败' }, { status: 500 })
  }
}
