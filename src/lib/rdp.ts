// 远程桌面地址：统一使用 rdp://host[:port]，点击时交给系统协议处理器调用 mstsc
export interface RdpTarget {
  address: string
  uri: string
}

export function parseRdpTarget(input?: string | null): RdpTarget | null {
  const raw = input?.trim()
  if (!raw || !/^rdp:/i.test(raw)) return null

  const rest = raw
    .replace(/^rdp:(\/\/)?/i, '')
    .replace(/^\/+/, '')
    .replace(/[/?#].*$/, '')
    .trim()
  if (!rest) return null
  if (!/^[a-zA-Z0-9._:[\]-]+$/.test(rest)) return null

  const address = rest.replace(/^\[|\]$/g, '')
  return { address, uri: `rdp://${address}` }
}

export function isRdpUrl(input?: string | null): boolean {
  return parseRdpTarget(input) !== null
}

function splitHostPort(address: string): { host: string; port: number | null } {
  const ipv6 = address.match(/^\[([^\]]+)\](?::(\d+))?$/)
  if (ipv6) return { host: ipv6[1], port: ipv6[2] ? Number(ipv6[2]) : null }

  const idx = address.lastIndexOf(':')
  if (idx > 0 && address.indexOf(':') === idx) {
    const host = address.slice(0, idx)
    const port = Number(address.slice(idx + 1))
    if (/^\d+$/.test(address.slice(idx + 1)) && port > 0 && port <= 65535) {
      return { host, port }
    }
  }
  return { host: address, port: null }
}

// 生成 Windows 远程桌面连接文件，双击即用 mstsc 打开并填入地址
export function buildRdpFile(address: string): string {
  const { host, port } = splitHostPort(address)
  const lines = [
    `full address:s:${host}`,
    ...(port ? [`server port:i:${port}`] : []),
    'prompt for credentials:i:1',
    'authentication level:i:2',
    'screen mode id:i:2',
    'use multimon:i:0',
    'session bpp:i:32',
    'redirectclipboard:i:1',
    'redirectprinters:i:0',
    'smart sizing:i:1',
    'audiomode:i:0',
    'networkautodetect:i:1',
    'bandwidthautodetect:i:1',
  ]
  return `${lines.join('\r\n')}\r\n`
}
