import { createHmac, timingSafeEqual } from 'crypto'
import type { WebDavConfig, WebDavEntry } from '@/types'

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|ico|bmp|avif)$/i
const TIMEOUT_MS = 8000

// 浏览器的 <a>/<img> 带不了 Basic 认证，文件统一走面板代理；
// 用服务端密钥对路径签名，避免代理接口变成可随意遍历的门户
export function signWebdavPath(pathname: string, secret: string): string {
  return createHmac('sha256', secret).update(pathname).digest('base64url')
}

export function verifyWebdavPath(
  pathname: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false
  const expected = Buffer.from(signWebdavPath(pathname, secret))
  const actual = Buffer.from(signature)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export type WebdavVia = 'internal' | 'external'

export function webdavFilePath(
  pathname: string,
  secret: string,
  via: WebdavVia = 'internal'
): string {
  const sig = signWebdavPath(pathname, secret)
  return `/api/webdav/file?path=${encodeURIComponent(pathname)}&sig=${sig}&via=${via}`
}

// 历史数据里存的是 WebDAV 原地址（打开会弹登录框），返回面板时换成代理直链；
// 已经是代理直链的（早期版本没带 via）也补上内外网通道
export function proxifyWebdavUrl(
  url: string | undefined,
  config: WebDavConfig,
  secret: string,
  side: WebdavVia = 'internal'
): string | undefined {
  if (!url) return url
  if (url.startsWith('/api/webdav/file?')) {
    const parsed = new URL(url, 'http://panel.local')
    const pathname = parsed.searchParams.get('path')
    const sig = parsed.searchParams.get('sig')
    if (pathname && sig) {
      return `/api/webdav/file?path=${encodeURIComponent(pathname)}&sig=${encodeURIComponent(sig)}&via=${side}`
    }
    return url
  }
  const bases: [WebdavVia, string | undefined][] = [
    ['internal', config.internalUrl],
    ['external', config.externalUrl],
  ]
  for (const [via, base] of bases) {
    if (!base) continue
    let target: URL
    let root: URL
    try {
      target = new URL(url)
      root = new URL(base)
    } catch {
      continue
    }
    if (target.origin !== root.origin) continue
    const basePath = decodePath(root.pathname)
    const rel = decodePath(target.pathname)
    if (basePath && !rel.toLowerCase().startsWith(`${basePath.toLowerCase()}/`)) continue
    const filePath = basePath ? rel.slice(basePath.length) : rel
    if (!filePath || filePath === '/') continue
    return webdavFilePath(filePath, secret, via)
  }
  return url
}

function decodePath(value: string): string {
  try {
    return decodeURIComponent(value).replace(/\/+$/, '')
  } catch {
    return value.replace(/\/+$/, '')
  }
}

function encodeSegments(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => (segment ? encodeURIComponent(segment) : ''))
    .join('/')
}

export function isWebdavReady(config: WebDavConfig): boolean {
  return config.enabled && Boolean(config.internalUrl)
}

export function joinWebdavUrl(base: string, pathname: string): string {
  const root = base.replace(/\/+$/, '')
  const rel = pathname.replace(/^\/+/, '')
  return rel ? `${root}/${encodeSegments(rel)}` : root
}

function authHeader(config: WebDavConfig): Record<string, string> {
  if (!config.username) return {}
  const raw = `${config.username}:${config.password || ''}`
  return { Authorization: `Basic ${Buffer.from(raw).toString('base64')}` }
}

async function requestWith(
  base: string,
  config: WebDavConfig,
  pathname: string,
  init: RequestInit
): Promise<Response> {
  // 只限制等待响应头的时间，大文件下载过程中不再超时
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(joinWebdavUrl(base, pathname), {
      ...init,
      headers: { ...authHeader(config), ...(init.headers as Record<string, string> | undefined) },
      signal: controller.signal,
      cache: 'no-store',
    })
  } finally {
    clearTimeout(timer)
  }
}

// 内网直连优先，失败后回退到反代地址（服务端部署在公网时走反代）
export async function fetchWebdavResult(
  config: WebDavConfig,
  pathname: string,
  init: RequestInit = { method: 'GET' },
  prefer: WebdavVia = 'internal'
): Promise<{ response: Response; base: string }> {
  const ordered =
    prefer === 'external'
      ? [config.externalUrl, config.internalUrl]
      : [config.internalUrl, config.externalUrl]
  const bases = ordered.filter((base): base is string => Boolean(base))
  if (bases.length === 0) throw new Error('未配置 WebDAV 地址')

  let lastError: unknown = null
  for (const base of bases) {
    const target = joinWebdavUrl(base, pathname)
    try {
      const response = await requestWith(base, config, pathname, init)
      if (response.status === 401 || response.status === 403) return { response, base }
      if (response.ok) return { response, base }
      // 404/405/468（OpenList）通常是地址漏了挂载路径（如 /dav）
      const hint = [404, 405, 468].includes(response.status)
        ? '，请检查地址是否包含 /dav 等挂载路径'
        : ''
      lastError = new Error(`WebDAV 返回 ${response.status}（${target}${hint}）`)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('WebDAV 连接失败')
}

export async function fetchWebdav(
  config: WebDavConfig,
  pathname: string,
  init: RequestInit = { method: 'GET' },
  prefer: WebdavVia = 'internal'
): Promise<Response> {
  return (await fetchWebdavResult(config, pathname, init, prefer)).response
}

function stripNamespaces(xml: string): string {
  return xml.replace(/<\/?[a-zA-Z0-9_-]+:/g, (tag) => tag.replace(/[a-zA-Z0-9_-]+:/, ''))
}

function readTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
  return match ? match[1] : null
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number(num)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function relativePath(href: string, dirUrl: URL, rootUrl: URL): string {
  let resolved: URL
  try {
    resolved = new URL(href, dirUrl)
  } catch {
    return ''
  }
  let decoded = resolved.pathname
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    // 含非法转义时保留原样
  }
  decoded = decoded.replace(/\/+$/, '')
  const rootPath = decodeURIComponent(rootUrl.pathname).replace(/\/+$/, '')
  if (rootPath && decoded.toLowerCase().startsWith(rootPath.toLowerCase())) {
    decoded = decoded.slice(rootPath.length)
  }
  decoded = decoded.replace(/\/+$/, '')
  if (!decoded) return ''
  return decoded.startsWith('/') ? decoded : `/${decoded}`
}

function normalizeDir(dirPath: string): string {
  const trimmed = dirPath.replace(/\/+$/, '')
  return trimmed && !trimmed.startsWith('/') ? `/${trimmed}` : trimmed
}

function parseEntries(
  xml: string,
  dirUrl: URL,
  rootUrl: URL,
  selfRel: string,
  config: WebDavConfig
): WebDavEntry[] {
  const blocks = stripNamespaces(xml).match(/<response>[\s\S]*?<\/response>/g) || []
  const entries: WebDavEntry[] = []

  for (const block of blocks) {
    const rawHref = readTag(block, 'href')
    if (!rawHref) continue
    const href = decodeXml(rawHref.trim())
    // 统一成从 WebDAV 根算起的路径，子目录点击时才不会丢掉上级目录
    const rel = relativePath(href, dirUrl, rootUrl)
    if (!rel || rel === selfRel) continue

    const resourcetype = readTag(block, 'resourcetype') || ''
    const isDir = /<collection\b/i.test(resourcetype)
    const name = decodeXml(
      readTag(block, 'displayname')?.trim() ||
        rel.split('/').pop() ||
        ''
    )

    entries.push({
      name,
      path: rel,
      isDir,
      size: Number(readTag(block, 'getcontentlength') || 0) || 0,
      modified: readTag(block, 'getlastmodified') || undefined,
      isImage: !isDir && IMAGE_EXT.test(name),
      internalUrl: joinWebdavUrl(config.internalUrl, rel),
      externalUrl: config.externalUrl ? joinWebdavUrl(config.externalUrl, rel) : undefined,
    })
  }

  return entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-CN')
  })
}

const PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
  </d:prop>
</d:propfind>`

export async function listWebdav(
  config: WebDavConfig,
  dirPath = '/'
): Promise<WebDavEntry[]> {
  const { response, base } = await fetchWebdavResult(config, dirPath, {
    method: 'PROPFIND',
    headers: { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' },
    body: PROPFIND_BODY,
  })
  if (response.status === 401 || response.status === 403) {
    throw new Error('WebDAV 认证失败，请检查用户名和密码')
  }
  if (!response.ok) throw new Error(`WebDAV 返回 ${response.status}`)

  const xml = await response.text()
  // 用实际成功的地址解析，避免内网/反代路径（如 /dav）不一致时把前缀算进文件名
  const rootUrl = new URL(joinWebdavUrl(base, '/'))
  const dirUrl = new URL(`${joinWebdavUrl(base, dirPath)}/`)
  return parseEntries(xml, dirUrl, rootUrl, normalizeDir(dirPath), config)
}
