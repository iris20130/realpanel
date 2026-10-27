import { NextResponse } from 'next/server'
import { readWebdav } from '@/lib/db'
import { fetchWebdav, isWebdavReady } from '@/lib/webdav'

export const dynamic = 'force-dynamic'

const MAX_ICON_BYTES = 5 * 1024 * 1024

// 图标预览：浏览器 <img> 无法携带 Basic 认证，这里由服务端代理图片
export async function GET(request: Request) {
  const config = await readWebdav()
  if (!isWebdavReady(config)) {
    return NextResponse.json({ error: '未配置 WebDAV' }, { status: 404 })
  }

  const pathname = new URL(request.url).searchParams.get('path') || ''
  if (!pathname.startsWith('/') || pathname.includes('..')) {
    return NextResponse.json({ error: '路径不合法' }, { status: 400 })
  }

  try {
    const response = await fetchWebdav(config, pathname, { method: 'GET' })
    if (!response.ok) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 })
    }
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: '仅支持图片' }, { status: 415 })
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > MAX_ICON_BYTES) {
      return NextResponse.json({ error: '图片超过 5MB' }, { status: 413 })
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ error: '读取失败' }, { status: 502 })
  }
}
