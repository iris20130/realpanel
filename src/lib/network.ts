'use client'

import { useEffect, useMemo, useRef } from 'react'
import { create } from 'zustand'
import { useSettingsStore } from '@/stores/settings'
import { useSitesStore } from '@/stores/sites'
import { useNicStore } from '@/stores/nic'
import { useAuthStore } from '@/stores/auth'
import type { Network, NetworkMode } from '@/types'

const CACHE_MS = 30_000
const IP_TIMEOUT = 1500

function normalizeIp(raw?: string | null): string | null {
  if (!raw) return null
  let ip = raw.trim()
  if (ip.startsWith('[')) ip = ip.replace(/^\[|\]$/g, '')
  ip = ip.replace(/^::ffff:/i, '')
  const withPort = ip.match(/^([\d.]+):\d+$/)
  if (withPort) ip = withPort[1]
  return ip || null
}

export function isPrivateIPv4(host: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false
  const parts = host.split('.').map(Number)
  if (parts.some((part) => part < 0 || part > 255)) return false
  const [a, b] = parts
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  )
}

export function isPrivateHost(host: string): boolean {
  const lower = host.toLowerCase()
  if (lower === 'localhost' || lower === '::1') return true
  if (isPrivateIPv4(lower)) return true
  if (lower.endsWith('.local') || lower.endsWith('.lan') || lower.endsWith('.home.arpa')) return true
  if (lower.endsWith('.internal') || lower.endsWith('.intra')) return true
  return !lower.includes('.')
}

export function isPrivateIp(ip: string): boolean {
  if (isPrivateIPv4(ip)) return true
  const lower = ip.toLowerCase()
  return lower === '::1' || /^f[cd][0-9a-f]{2}:/.test(lower) || /^fe80:/.test(lower)
}

export function sameSubnet(a: string, b: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(a) || !/^\d{1,3}(\.\d{1,3}){3}$/.test(b)) return false
  return a.split('.').slice(0, 3).join('.') === b.split('.').slice(0, 3).join('.')
}

export function detectByHostname(): Network {
  if (typeof window === 'undefined') return 'internet'
  const host = window.location.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return !host || isPrivateHost(host) ? 'intranet' : 'internet'
}

// 收集浏览器所在设备所有网卡的地址（含 VPN/隧道、企业非标准内网段），
// WebRTC 主机候选拿不到时由服务端返回访客 IP 兜底。
function detectBrowserIps(): Promise<string[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
      resolve([])
      return
    }
    const pc = new RTCPeerConnection({ iceServers: [] })
    const ips = new Set<string>()
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      pc.close()
      resolve([...ips])
    }
    const timer = setTimeout(finish, IP_TIMEOUT)

    pc.createDataChannel('ip')
    pc.onicecandidate = (event) => {
      const candidate = event.candidate?.candidate
      if (!candidate) {
        if (pc.iceGatheringState === 'complete') finish()
        return
      }
      const ip = candidateIp(candidate)
      if (ip) ips.add(ip)
    }
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(finish)
  })
}

// 从 ICE 候选里取出地址：兼容 IPv4 / IPv6，排除通配、回环与链路本地地址
function candidateIp(candidate: string): string | null {
  const parts = candidate.split(' ')
  const raw = parts[4]
  if (!raw) return null
  const ip = raw.replace(/^\[|\]$/g, '')
  if (!ip || ip === '0.0.0.0' || ip === '::') return null
  if (ip === '127.0.0.1' || ip === '::1') return null
  const lower = ip.toLowerCase()
  if (lower.startsWith('fe80:')) return null
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip
  if (ip.includes(':')) return lower
  return null
}

function ipv4Host(host: string): string | null {
  const clean = host.replace(/^\[|\]$/g, '')
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(clean) ? clean : null
}

// 把 IPv6 展开成 8 组，便于比较前缀（处理 :: 压缩写法）
function expandIpv6(ip: string): string[] | null {
  const clean = ip.toLowerCase().replace(/%.*$/, '').replace(/^\[|\]$/g, '')
  if (!clean.includes(':')) return null
  const [head, tail] = clean.split('::')
  const headParts = head ? head.split(':') : []
  const tailParts = tail ? tail.split(':') : []
  if (clean.includes('::')) {
    const missing = 8 - headParts.length - tailParts.length
    if (missing < 0) return null
    return [...headParts, ...Array(missing).fill('0'), ...tailParts]
  }
  const parts = clean.split(':')
  return parts.length === 8 ? parts : null
}

export function sameIpv6Prefix(a: string, b: string): boolean {
  const left = expandIpv6(a)
  const right = expandIpv6(b)
  if (!left || !right) return false
  return left.slice(0, 4).join(':') === right.slice(0, 4).join(':')
}

// 内网链接地址是否命中设备的任一网卡地址（同 /24 网段或同 /64 IPv6）
export function hostMatchesDevice(host: string, deviceIps: string[]): boolean {
  const clean = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (deviceIps.length === 0) return false
  if (ipv4Host(clean)) return deviceIps.some((ip) => sameSubnet(clean, ip))
  if (clean.includes(':')) return deviceIps.some((ip) => ip.includes(':') && sameIpv6Prefix(clean, ip))
  return false
}

// 仅依据「打开网页的设备」判断：设备任一网卡与任一内网地址同网段才算内网
export function resolveDetected(deviceIps: string[], internalUrls: string[]): Network {
  const hosts = internalUrls
    .map((url) => {
      try {
        return new URL(url).hostname.toLowerCase()
      } catch {
        return null
      }
    })
    .filter((host): host is string => Boolean(host))
  if (hosts.length === 0) return 'internet'
  return hosts.some((host) => hostMatchesDevice(host, deviceIps)) ? 'intranet' : 'internet'
}

// 当前页面地址若是 IP（直连内网面板、反代/Docker 端口映射），该地址大概率与内网同段
function pageHostIp(): string | null {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!host) return null
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host
  if (host.includes(':')) return host
  return null
}

// 服务端只负责告知「请求来自哪台设备」：真实客户端 IP；
// 若是回环地址，说明访客就是服务器本机，改用本机所有网卡地址。
async function detectServerIps(): Promise<string[]> {
  try {
    const res = await fetch('/api/network/info', { cache: 'no-store' })
    if (!res.ok) return []
    const data = (await res.json()) as { ip?: string | null; candidates?: string[] }
    const list = data.candidates?.length ? data.candidates : data.ip ? [data.ip] : []
    return list.map((ip) => normalizeIp(ip)).filter((ip): ip is string => Boolean(ip))
  } catch {
    return []
  }
}
interface NetworkState {
  detected: Network
  deviceIp: string | null
  deviceIps: string[]
  source: 'webrtc' | 'server' | 'hostname'
  checked: boolean
  probing: boolean
  lastAt: number
  detect: (internalUrls: string[], force?: boolean) => Promise<void>
}

let inflight: Promise<void> | null = null

export const useNetworkStore = create<NetworkState>((set, get) => ({
  detected: 'internet',
  deviceIp: null,
  deviceIps: [],
  source: 'hostname',
  checked: false,
  probing: false,
  lastAt: 0,

  detect: async (internalUrls, force = false) => {
    if (inflight) {
      await inflight
      if (!force) return
    }
    const state = get()
    if (!force && state.checked && Date.now() - state.lastAt < CACHE_MS) return
    if (force && Date.now() - state.lastAt < 1500) return

    inflight = (async () => {
      set({ probing: true })
      try {
        // 三路来源取并集：WebRTC 网卡、服务端看到的客户端 IP、当前页面 IP
        // （WebRTC 常被 mDNS 混淆，反代/Docker 下服务端可能只看到网关地址）
        const browserIps = await detectBrowserIps()
        const serverIps = await detectServerIps()
        const hostIp = pageHostIp()
        const deviceIps = [
          ...new Set([...browserIps, ...serverIps, ...(hostIp ? [hostIp] : [])]),
        ]
        const detected = resolveDetected(deviceIps, internalUrls)
        set({
          detected,
          deviceIp: deviceIps[0] ?? null,
          deviceIps,
          source: browserIps.length > 0 ? 'webrtc' : serverIps.length > 0 ? 'server' : 'hostname',
          checked: true,
          probing: false,
          lastAt: Date.now(),
        })
      } catch {
        set({
          detected: detectByHostname(),
          deviceIp: null,
          deviceIps: [],
          source: 'hostname',
          checked: true,
          probing: false,
          lastAt: Date.now(),
        })
      } finally {
        inflight = null
      }
    })()

    return inflight
  },
}))

export function useNetwork(): {
  mode: NetworkMode
  detected: Network
  network: Network
  deviceIp: string | null
  deviceIps: string[]
  allIps: string[]
  selected: string[]
  probing: boolean
  checked: boolean
  refresh: () => void
} {
  const mode = useSettingsStore((state) => state.networkMode)
  const sites = useSitesStore((state) => state.sites)
  const storedDetected = useNetworkStore((state) => state.detected)
  const storedIps = useNetworkStore((state) => state.deviceIps)
  const deviceIp = useNetworkStore((state) => state.deviceIp)
  const probing = useNetworkStore((state) => state.probing)
  const checked = useNetworkStore((state) => state.checked)
  const detect = useNetworkStore((state) => state.detect)
  const user = useAuthStore((state) => state.user)
  const guestSelected = useNicStore((state) => state.guest)
  const byUser = useNicStore((state) => state.byUser)
  const guestCustom = useNicStore((state) => state.guestCustom)
  const customByUser = useNicStore((state) => state.customByUser)
  const prevMode = useRef(mode)

  const internalUrls = useMemo(
    () => sites.map((site) => site.internalUrl).filter((url): url is string => Boolean(url)),
    [sites]
  )
  const urlsKey = internalUrls.join('|')

  const selected = user ? byUser[user.id] ?? [] : guestSelected
  // 自动识别的网卡 + 自定义网关/地址（隧道网卡可能拿不到）
  const allIps = useMemo(() => {
    const custom = user ? customByUser[user.id] ?? [] : guestCustom
    return [...new Set([...storedIps, ...custom])]
  }, [storedIps, customByUser, guestCustom, user])

  // 只使用被选中的网卡地址；选中项在本机不存在时回退为全部地址
  const deviceIps = useMemo(() => {
    if (selected.length === 0) return allIps
    const filtered = allIps.filter((ip) => selected.includes(ip))
    return filtered.length > 0 ? filtered : allIps
  }, [allIps, selected])

  const detected = useMemo(() => {
    if (!checked) return storedDetected
    // 拿不到任何网卡地址时只能按访问域名兜底
    if (deviceIps.length === 0) return detectByHostname()
    return resolveDetected(deviceIps, internalUrls)
  }, [checked, deviceIps, internalUrls, storedDetected])

  useEffect(() => {
    const forced = prevMode.current !== mode
    prevMode.current = mode
    detect(internalUrls, forced)
  }, [detect, mode, urlsKey])

  useEffect(() => {
    const onFocus = () => detect(internalUrls, true)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [detect, urlsKey])

  return useMemo(
    () => ({
      mode,
      detected,
      network: mode === 'auto' || mode === 'all' ? detected : mode,
      deviceIp: deviceIps[0] ?? deviceIp,
      deviceIps,
      allIps,
      selected,
      probing,
      checked,
      refresh: () => detect(internalUrls, true),
    }),
    [
      mode,
      detected,
      deviceIp,
      deviceIps,
      allIps,
      selected,
      probing,
      checked,
      detect,
      urlsKey,
      internalUrls,
    ]
  )
}

export const networkLabels: Record<Network, string> = {
  intranet: '内网',
  internet: '外网',
}

export const networkModeLabels: Record<NetworkMode, string> = {
  auto: '自动',
  intranet: '强制内网',
  internet: '强制外网',
  all: '全部显示',
}
