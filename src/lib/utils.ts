import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Network, Site } from '@/types'
import { parseShareTarget } from './share'
import { parseRdpTarget } from './rdp'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function getCurrentTimestamp(): number {
  return Date.now()
}

// 自动模式：按填写的地址推导显示网络
export function getSiteScope(site: Site): 'both' | 'intranet' | 'internet' | null {
  const hasInternal = Boolean(site.internalUrl)
  const hasExternal = Boolean(site.externalUrl)
  if (hasInternal && hasExternal) return 'both'
  if (hasInternal) return 'intranet'
  if (hasExternal) return 'internet'
  return null
}

export function getSiteUrl(site: Site, network: Network, override?: Network | null): string {
  const target = override ?? network
  if (target === 'intranet') {
    return site.internalUrl || site.externalUrl || ''
  }
  return site.externalUrl || site.internalUrl || ''
}

export function getScopeLabel(scope: ReturnType<typeof getSiteScope>): string {
  if (scope === 'both') return '内外网'
  if (scope === 'intranet') return '仅内网'
  if (scope === 'internet') return '仅外网'
  return '未设置地址'
}

export function normalizeUrlInput(input?: string | null): string | undefined {
  const value = input?.trim()
  if (!value) return undefined

  // 远程桌面地址统一存成 rdp://host[:port]
  if (/^rdp:/i.test(value)) return parseRdpTarget(value)?.uri

  // SMB / UNC 共享地址统一存成 smb://，点击时交给系统资源管理器
  const share = parseShareTarget(value)
  if (share) return share.smbUrl

  // 面板自身的相对直链（如 /api/webdav/file?...），内外网共用
  if (value.startsWith('/') && !value.startsWith('//')) return value

  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value) ? value : `http://${value}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    if (!url.hostname) return undefined
    return candidate
  } catch {
    return undefined
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, index)
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`
}

export function formatDateTime(timestamp: number): string {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}


// 局域网 http 访问时 Clipboard API 不可用，退回 execCommand 兜底
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 继续尝试旧接口
    }
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    area.style.pointerEvents = 'none'
    document.body.appendChild(area)
    area.focus()
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}
