// 识别 SMB / UNC 共享地址，统一成 smb:// 供系统协议处理器打开
export interface ShareTarget {
  host: string
  smbUrl: string
  uncPath: string
}

export function parseShareTarget(input?: string | null): ShareTarget | null {
  const raw = input?.trim()
  if (!raw) return null

  let rest: string | null = null
  if (/^smb:[\\/]{2}/i.test(raw)) rest = raw.replace(/^smb:/i, '')
  else if (/^\\\\/.test(raw)) rest = raw
  else if (/^\/\//.test(raw)) rest = raw
  if (rest === null) return null

  const path = rest
    .replace(/^[\\/]+/, '')
    .replace(/[\\/]+/g, '/')
    .replace(/\/+$/, '')
  if (!path) return null

  const host = path.split('/')[0]
  if (!host) return null

  return {
    host: host.toLowerCase(),
    smbUrl: `smb://${path}`,
    uncPath: `\\\\${path.replace(/\//g, '\\')}`,
  }
}

export function isShareUrl(input?: string | null): boolean {
  return parseShareTarget(input) !== null
}
