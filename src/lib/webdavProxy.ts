import { readConfig, readWebdav } from './db'
import { isWebdavReady, proxifyWebdavUrl } from './webdav'
import type { Site, SitesData, WebDavConfig } from '@/types'

async function loadConfig(): Promise<{ config: WebDavConfig; secret: string } | null> {
  const config = await readWebdav()
  if (!isWebdavReady(config)) return null
  const { jwtSecret } = await readConfig()
  return { config, secret: jwtSecret }
}

function mapSite(site: Site, config: WebDavConfig, secret: string): Site {
  const internalUrl = proxifyWebdavUrl(site.internalUrl, config, secret, 'internal')
  const externalUrl = proxifyWebdavUrl(site.externalUrl, config, secret, 'external')
  if (internalUrl === site.internalUrl && externalUrl === site.externalUrl) return site
  return { ...site, internalUrl, externalUrl }
}

// 返回给前端前把 WebDAV 原地址替换成面板代理直链
export async function withWebdavProxyUrls(panel: SitesData): Promise<SitesData> {
  const loaded = await loadConfig()
  if (!loaded) return panel
  return {
    ...panel,
    sites: panel.sites.map((site) => mapSite(site, loaded.config, loaded.secret)),
  }
}

export async function withWebdavProxySite(site: Site): Promise<Site> {
  const loaded = await loadConfig()
  return loaded ? mapSite(site, loaded.config, loaded.secret) : site
}
