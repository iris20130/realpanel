import { NextRequest, NextResponse } from 'next/server'
import os from 'os'

export const dynamic = 'force-dynamic'

function normalizeIp(raw?: string | null): string | null {
  if (!raw) return null
  let ip = raw.trim()
  if (ip.startsWith('[')) ip = ip.replace(/^\[|\]$/g, '')
  ip = ip.replace(/^::ffff:/i, '')
  const withPort = ip.match(/^([\d.]+):\d+$/)
  if (withPort) ip = withPort[1]
  return ip || null
}

function localAddresses(): string[] {
  const result: string[] = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.internal) continue
      // 链路本地地址无法代表所属内网，跳过
      if (item.address.toLowerCase().startsWith('fe80:')) continue
      // 同时返回 IPv4 / IPv6，覆盖 VPN、隧道等虚拟网卡
      result.push(item.address)
    }
  }
  // 去重并让 IPv4 优先，便于展示与匹配
  const unique = [...new Set(result)]
  return unique.sort((a, b) => Number(a.includes(':')) - Number(b.includes(':')))
}

export async function GET(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]
  const clientIp = normalizeIp(request.headers.get('x-real-ip') || forwarded)

  // 回环地址表示访客就是服务器本机，此时用本机全部网卡地址代表该设备
  const isLoopback = !clientIp || clientIp === '127.0.0.1' || clientIp === '::1'
  const candidates = isLoopback ? localAddresses() : [clientIp]

  return NextResponse.json({
    ip: candidates[0] ?? clientIp,
    candidates,
    loopback: isLoopback,
  })
}
