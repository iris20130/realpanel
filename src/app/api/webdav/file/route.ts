import { NextResponse } from 'next/server'
import { readConfig, readWebdav } from '@/lib/db'
import { fetchWebdav, isWebdavReady, joinWebdavUrl, verifyWebdavPath } from '@/lib/webdav'

export const dynamic = 'force-dynamic'

// 浏览器打开 WebDAV 原地址会弹 Basic 认证，这里由服务端带认证转发；
// 只接受带签名（由管理员在面板里选文件时生成）的路径。
export async function GET(request: Request) {
  const url = new URL(request.url)
  const pathname = url.searchParams.get('path') || ''
  const signature = url.searchParams.get('sig')

  if (!pathname.startsWith('/') || pathname.includes('..')) {
    return NextResponse.json({ error: '路径不合法' }, { status: 400 })
  }

  const config = await readWebdav()
  if (!isWebdavReady(config)) {
    return NextResponse.json({ error: '未配置 WebDAV' }, { status: 404 })
  }

  const { jwtSecret } = await readConfig()
  if (!verifyWebdavPath(pathname, signature, jwtSecret)) {
    return NextResponse.json({ error: '链接已失效，请重新从面板选择文件' }, { status: 403 })
  }

  const range = request.headers.get('range')
  const via = url.searchParams.get('via') === 'external' ? 'external' : 'internal'
  // 外网不让面板转发文件流量：直接 302 到反代 WebDAV 直链，由该地址自行校验登录
  if (via === 'external' && config.externalUrl) {
    return NextResponse.redirect(joinWebdavUrl(config.externalUrl, pathname), {
      status: 302,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  try {
    const response = await fetchWebdav(
      config,
      pathname,
      {
        method: 'GET',
        headers: range ? { Range: range } : undefined,
      },
      via
    )
    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({ error: 'WebDAV 认证失败' }, { status: 502 })
    }
    if (!response.ok || !response.body) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 })
    }

    const name = pathname.split('/').filter(Boolean).pop() || 'download'
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const inline = /^(image|video|audio)\//.test(contentType) || contentType.startsWith('application/pdf')
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    }
    for (const key of ['content-length', 'content-range', 'accept-ranges']) {
      const value = response.headers.get(key)
      if (value) headers[key.replace(/(^|-)[a-z]/g, (m) => m.toUpperCase())] = value
    }

    return new NextResponse(response.body, {
      status: response.status === 206 ? 206 : 200,
      headers,
    })
  } catch {
    return NextResponse.json({ error: '读取文件失败' }, { status: 502 })
  }
}
