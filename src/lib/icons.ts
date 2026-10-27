import { saveUploadBuffer } from './db'
import type { SiteIcon } from '@/types'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const BLOCKED_HOSTS = new Set([
  'metadata.google.internal',
  'metadata.goog',
  '100.100.100.200',
  '169.254.169.254',
])

type FetchResult = { buffer: Buffer; ext: string } | null

function parseTarget(url: string): URL | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (BLOCKED_HOSTS.has(parsed.hostname)) return null
    return parsed
  } catch {
    return null
  }
}

function domainKeywords(url: string): string[] {
  const parsed = parseTarget(url)
  if (!parsed) return []
  const host = parsed.hostname.toLowerCase()
  const labels = host.split('.').filter(Boolean)
  const keywords: string[] = []

  if (labels.length >= 2) {
    const last = labels[labels.length - 1]
    const secondLast = labels[labels.length - 2]
    if (last.length === 2 && secondLast.length <= 3 && labels.length >= 3) {
      keywords.push(labels[labels.length - 3])
    } else {
      keywords.push(secondLast)
    }
  }
  if (labels.length >= 2) keywords.push(labels[0])
  keywords.push(host)

  return [...new Set(keywords.filter((item) => item && !/^\d+$/.test(item)))]
}

async function searchIconify(query: string): Promise<string | null> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return null

  try {
    const response = await fetch(
      `https://api.iconify.design/search?query=${encodeURIComponent(trimmed)}&prefixes=simple-icons,logos,mdi&limit=24`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!response.ok) return null
    const data = (await response.json()) as { icons?: string[] }
    const icons = Array.isArray(data.icons) ? data.icons : []
    if (icons.length === 0) return null

    const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')
    const preferred = icons.find((icon) => icon.startsWith('simple-icons:'))
    const exact = icons.find((icon) => {
      const name = icon.split(':')[1]?.replace(/-/g, '') ?? ''
      return name === normalized
    })
    return exact ?? preferred ?? icons[0]
  } catch {
    return null
  }
}

function sniffImage(buffer: Buffer, contentType: string, pathname: string): string | null {
  if (buffer.length === 0 || buffer.length > 512 * 1024) return null

  const header = buffer.subarray(0, 16)
  if (header[0] === 0x00 && header[1] === 0x00 && header[2] === 0x01 && header[3] === 0x00) {
    return 'ico'
  }
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) {
    return 'png'
  }
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) return 'gif'
  if (header[0] === 0xff && header[1] === 0xd8) return 'jpg'
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
    return 'webp'
  }

  const text = buffer.subarray(0, 300).toString('utf-8').trim().toLowerCase()
  if (text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg'))) {
    return 'svg'
  }

  if (contentType.includes('svg')) return 'svg'
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('icon') || contentType.includes('ico')) return 'ico'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  if (contentType.includes('gif')) return 'gif'
  if (contentType.includes('webp')) return 'webp'

  const ext = pathname.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'].includes(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext
  }
  return null
}

async function fetchImage(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'image/*,*/*;q=0.8' },
      signal: AbortSignal.timeout(6000),
      redirect: 'follow',
    })
    if (!response.ok) return null

    const contentLength = Number(response.headers.get('content-length') ?? 0)
    if (contentLength > 512 * 1024) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    const ext = sniffImage(buffer, response.headers.get('content-type') ?? '', new URL(url).pathname)
    if (!ext) return null
    return { buffer, ext }
  } catch {
    return null
  }
}

async function discoverIconLinks(target: URL): Promise<string[]> {
  try {
    const response = await fetch(target.toString(), {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(6000),
      redirect: 'follow',
    })
    if (!response.ok) return []
    const html = await response.text()
    const links: string[] = []
    const linkRegex = /<link\b[^>]*>/gi
    for (const tag of html.match(linkRegex) ?? []) {
      if (!/rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["']/i.test(tag)) continue
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1]
      if (!href) continue
      try {
        links.push(new URL(href, target).toString())
      } catch {
        // 忽略非法地址
      }
    }
    return links
  } catch {
    return []
  }
}

async function fetchFavicon(url: string): Promise<SiteIcon | null> {
  const target = parseTarget(url)
  if (!target) return null

  const links = await discoverIconLinks(target)
  const candidates = [
    ...links,
    new URL('/favicon.ico', target.origin).toString(),
    new URL('/favicon.png', target.origin).toString(),
    new URL('/apple-touch-icon.png', target.origin).toString(),
  ]

  for (const candidate of [...new Set(candidates)]) {
    if (!parseTarget(candidate)) continue
    const image = await fetchImage(candidate)
    if (!image) continue
    try {
      const saved = await saveUploadBuffer(image.buffer, image.ext)
      return { type: 'uploaded', value: saved }
    } catch {
      return null
    }
  }

  return null
}

export async function detectSiteIcon(
  url: string,
  title?: string
): Promise<{ icon: SiteIcon | null; source?: 'iconify' | 'favicon' }> {
  const target = parseTarget(url)
  if (!target) return { icon: null }

  // 内网 IP 站点直接抓 favicon，避免拿 IP 去图标库搜索
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(target.hostname)) {
    const keywords = [...domainKeywords(url), title?.trim() ?? ''].filter(Boolean)
    for (const keyword of keywords) {
      const icon = await searchIconify(keyword)
      if (icon) return { icon: { type: 'iconify', value: icon }, source: 'iconify' }
    }
  }

  const favicon = await fetchFavicon(url)
  if (favicon) return { icon: favicon, source: 'favicon' }

  return { icon: null }
}
