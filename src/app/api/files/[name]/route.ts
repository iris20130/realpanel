import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { isValidFileName, readStoredFileBuffer, getStoredFile, setStoredFileInline } from '@/lib/db'
import { mimeForFile, sandboxHeaders } from '@/lib/files'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  if (!isValidFileName(name)) {
    return NextResponse.json({ error: '文件不存在' }, { status: 404 })
  }

  const buffer = await readStoredFileBuffer(name)
  if (!buffer) return NextResponse.json({ error: '文件不存在' }, { status: 404 })

  const meta = await getStoredFile(name)
  const inline = meta ? meta.inline : true
  const contentType = meta?.mime || mimeForFile(name)
  const encoded = encodeURIComponent(name)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      ...sandboxHeaders(name),
    },
  })
}

// 切换「网页展示 / 下载」；上传者本人或管理员可改
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { name } = await params
  const meta = await getStoredFile(name)
  if (!meta) return NextResponse.json({ error: '文件不存在' }, { status: 404 })
  if (user.role !== 'admin' && meta.ownerId !== user.id) {
    return NextResponse.json({ error: '无权修改该文件' }, { status: 403 })
  }

  try {
    const body = (await request.json()) as { inline?: boolean }
    const updated = await setStoredFileInline(name, body.inline === true)
    if (!updated) return NextResponse.json({ error: '文件不存在' }, { status: 404 })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: '保存失败' }, { status: 400 })
  }
}
