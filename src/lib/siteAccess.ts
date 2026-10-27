'use client'

import { useCallback, useMemo } from 'react'
import type { Network, NetworkMode, Site } from '@/types'
import { hostMatchesDevice, isPrivateHost, useNetwork } from './network'

export interface AccessContext {
  mode: NetworkMode
  deviceIps: string[]
  detected: Network
}

export interface SiteAccess {
  visible: boolean
  url: string
  network: Network | null
  matched: boolean
}

function hostOf(url?: string): string | null {
  if (!url) return null
  try {
    return new URL(url, 'http://localhost').hostname.replace(/^\[|\]$/g, '').toLowerCase()
  } catch {
    return null
  }
}

// 内网地址是否命中本机任一网卡：IPv4 比 /24，IPv6 比 /64；内网域名按当前访问域名判断
export function internalMatchesDevice(internalUrl: string | undefined, ctx: AccessContext): boolean {
  const host = hostOf(internalUrl)
  if (!host) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
    if (ctx.deviceIps.length > 0) return hostMatchesDevice(host, ctx.deviceIps)
    return ctx.detected === 'intranet'
  }
  if (!isPrivateHost(host)) return false
  if (typeof window === 'undefined') return false
  const pageHost = window.location.hostname.toLowerCase()
  return pageHost === host || isPrivateHost(pageHost)
}

export function resolveSiteAccess(site: Site, ctx: AccessContext): SiteAccess {
  const internal = site.internalUrl
  const external = site.externalUrl
  const matched = internalMatchesDevice(internal, ctx)

  const hidden: SiteAccess = { visible: false, url: '', network: null, matched }
  const useInternal: SiteAccess = internal
    ? { visible: true, url: internal, network: 'intranet', matched }
    : hidden
  const useExternal: SiteAccess = external
    ? { visible: true, url: external, network: 'internet', matched }
    : hidden

  if (ctx.mode === 'all') {
    if (matched) return useInternal.visible ? useInternal : useExternal
    return useExternal.visible ? useExternal : useInternal
  }
  if (ctx.mode === 'intranet') {
    return matched ? useInternal : hidden
  }
  if (ctx.mode === 'internet') {
    return useExternal
  }
  // 自动：内网同网段走内网；否则有外网走外网；
  // 只有内网且网段不一致（或内网为空）才不显示
  if (matched) return useInternal
  return useExternal
}

// 组件内统一判定
export function useSiteAccessor() {
  const { mode, detected, deviceIps } = useNetwork()

  const context = useMemo<AccessContext>(
    () => ({ mode, detected, deviceIps }),
    [mode, detected, deviceIps]
  )

  const access = useCallback((site: Site) => resolveSiteAccess(site, context), [context])

  const isVisible = useCallback((site: Site) => access(site).visible, [access])

  return { access, isVisible, context }
}
