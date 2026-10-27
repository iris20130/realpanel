import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import type {
  BackupFile,
  Branding,
  Config,
  InviteCode,
  PanelAccess,
  Site,
  SiteIcon,
  SitesData,
  StoredFile,
  User,
  WebDavConfig,
} from '@/types'
import { normalizeSiteVisibility, normalizeUserIds, normalizeVisibility } from './visibility'

// 容器部署时用 DATA_DIR 指向外挂目录，未设置则沿用项目下的 data
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'))
const CONFIG_PATH = path.join(DATA_DIR, 'config.json')
const USERS_PATH = path.join(DATA_DIR, 'users.json')
const INVITES_PATH = path.join(DATA_DIR, 'invites.json')
const LEGACY_SITES_PATH = path.join(DATA_DIR, 'sites.json')
const PANELS_DIR = path.join(DATA_DIR, 'panels')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
const FILES_DIR = path.join(DATA_DIR, 'files')
const FILES_META_PATH = path.join(DATA_DIR, 'files.json')

let dataDirReady = false
let configCache: Config | null = null
let usersCache: User[] | null = null
let invitesCache: InviteCode[] | null = null
const panelCache = new Map<string, SitesData>()
let migrationPromise: Promise<void> | null = null
let migrated = false

// 所有写操作串行执行，避免 JSON 文件并发读改写互相覆盖
let dataLock: Promise<unknown> = Promise.resolve()
export function withDataLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = dataLock.then(fn, fn)
  dataLock = next.catch(() => undefined)
  return next
}

async function ensureDataDir(): Promise<void> {
  if (dataDirReady) return
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.mkdir(PANELS_DIR, { recursive: true })
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  await fs.mkdir(FILES_DIR, { recursive: true })
  dataDirReady = true
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await ensureDataDir()
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2))
  await fs.rename(tmp, file)
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8')) as T
  } catch {
    return null
  }
}

// ============ Config ============

function generateSecret(): string {
  return crypto.randomBytes(48).toString('base64url')
}

function getDefaultConfig(): Config {
  return {
    initialized: false,
    jwtSecret: generateSecret(),
    createdAt: Date.now(),
  }
}

export async function readConfig(): Promise<Config> {
  if (configCache) return configCache
  await ensureDataDir()
  const parsed = await readJson<Config>(CONFIG_PATH)
  if (parsed) {
    configCache = parsed
    return parsed
  }
  const defaultConfig = getDefaultConfig()
  await writeJson(CONFIG_PATH, defaultConfig)
  configCache = defaultConfig
  return defaultConfig
}

export async function writeConfig(config: Config): Promise<void> {
  configCache = config
  await writeJson(CONFIG_PATH, config)
}

export async function isInitialized(): Promise<boolean> {
  const config = await readConfig()
  return config.initialized === true
}

// ============ 品牌设置 ============

export function defaultBranding(): Branding {
  return {
    mode: 'logo',
    logoUrl: '/brand/realpanel.svg',
    text: 'realpanel 导航面板',
    faviconUrl: '/favicon.svg',
  }
}

export function normalizeBranding(raw: unknown): Branding {
  const source = (raw ?? {}) as Partial<Branding>
  const mode: Branding['mode'] =
    source.mode === 'text' || source.mode === 'none' ? source.mode : 'logo'
  const fallback = defaultBranding()
  // 旧版预置的 lymax 字标与名称一律换成当前默认品牌
  const logoUrl =
    typeof source.logoUrl === 'string' && source.logoUrl.trim()
      ? source.logoUrl.trim()
      : fallback.logoUrl
  const text =
    typeof source.text === 'string' && source.text.trim()
      ? source.text.trim().slice(0, 40)
      : fallback.text
  return {
    mode,
    logoUrl: logoUrl === '/brand/logoa1.png' ? fallback.logoUrl : logoUrl,
    text: text === 'lymax 导航面板' ? fallback.text : text,
    faviconUrl:
      typeof source.faviconUrl === 'string' && source.faviconUrl.trim()
        ? source.faviconUrl.trim()
        : fallback.faviconUrl,
  }
}

export async function readBranding(): Promise<Branding> {
  const config = await readConfig()
  return normalizeBranding(config.branding)
}

export async function writeBranding(branding: Branding): Promise<Branding> {
  const config = await readConfig()
  const normalized = normalizeBranding(branding)
  await writeConfig({ ...config, branding: normalized })
  return normalized
}

// ============ WebDAV 挂载 ============

export function normalizeWebdav(raw: unknown): WebDavConfig {
  const source = (raw ?? {}) as Partial<WebDavConfig>
  const trim = (value?: string) => (typeof value === 'string' ? value.trim() : '')
  return {
    enabled: source.enabled === true,
    internalUrl: trim(source.internalUrl).replace(/\/+$/, ''),
    externalUrl: trim(source.externalUrl).replace(/\/+$/, '') || undefined,
    username: trim(source.username) || undefined,
    password: typeof source.password === 'string' ? source.password : undefined,
  }
}

export async function readWebdav(): Promise<WebDavConfig> {
  const config = await readConfig()
  return normalizeWebdav(config.webdav)
}

export async function writeWebdav(raw: unknown): Promise<WebDavConfig> {
  const config = await readConfig()
  const webdav = normalizeWebdav(raw)
  await writeConfig({ ...config, webdav })
  return webdav
}

// ============ 面板访问地址 ============

export function normalizeAccess(raw: unknown): PanelAccess {
  const source = (raw ?? {}) as Partial<PanelAccess>
  const trim = (value?: string) =>
    typeof value === 'string' ? value.trim().replace(/\/+$/, '') : ''
  return {
    internalUrl: trim(source.internalUrl) || undefined,
    externalUrl: trim(source.externalUrl) || undefined,
  }
}

export async function readAccess(): Promise<PanelAccess> {
  const config = await readConfig()
  return normalizeAccess(config.access)
}

export async function writeAccess(raw: unknown): Promise<PanelAccess> {
  const config = await readConfig()
  const access = normalizeAccess(raw)
  await writeConfig({ ...config, access })
  return access
}

// ============ 旧数据迁移 ============

function normalizeIcon(raw: unknown): SiteIcon {
  const icon = (raw ?? {}) as Partial<SiteIcon>
  const type: SiteIcon['type'] =
    icon.type === 'uploaded' || icon.type === 'favicon' ? icon.type : 'iconify'
  return {
    type,
    value: typeof icon.value === 'string' && icon.value ? icon.value : 'mdi:web',
  }
}

export function normalizePanel(raw: unknown): SitesData {
  const source = (raw ?? {}) as { groups?: unknown; sites?: unknown }
  const groups = Array.isArray(source.groups)
    ? source.groups
        .map((item: unknown) => {
          const group = (item ?? {}) as Record<string, unknown>
          if (!group.id || !group.name) return null
          return {
            id: String(group.id),
            name: String(group.name),
            order: Number(group.order) || 0,
            visibility: normalizeVisibility(group.visibility),
            visibleUserIds: normalizeUserIds(group.visibleUserIds),
            createdAt: Number(group.createdAt) || Date.now(),
            updatedAt: Number(group.updatedAt) || Date.now(),
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : []

  const groupIds = new Set(groups.map((group) => group.id))
  const sites = Array.isArray(source.sites)
    ? source.sites
        .map((item: unknown) => {
          const site = (item ?? {}) as Record<string, unknown>
          if (!site.id || !site.title) return null
          const externalUrl =
            typeof site.externalUrl === 'string'
              ? site.externalUrl
              : typeof site.publicUrl === 'string'
                ? site.publicUrl
                : ''
          const internalUrl =
            typeof site.internalUrl === 'string'
              ? site.internalUrl
              : typeof site.privateUrl === 'string'
                ? site.privateUrl
                : ''
          const scope = site.networkScope
          return {
            id: String(site.id),
            groupId: String(site.groupId ?? ''),
            title: String(site.title),
            description: typeof site.description === 'string' ? site.description : undefined,
            notice:
              typeof site.notice === 'string' && site.notice.trim()
                ? site.notice.trim().slice(0, 500)
                : undefined,
            icon: normalizeIcon(site.icon),
            externalUrl: externalUrl.trim() || undefined,
            internalUrl: internalUrl.trim() || undefined,
            networkScope:
              scope === 'both' || scope === 'intranet' || scope === 'internet' || scope === 'auto'
                ? scope
                : 'auto',
            openMode:
              site.openMode === 'current' || site.openMode === 'modal' ? site.openMode : 'blank',
            tags: Array.isArray(site.tags) ? site.tags.map(String) : [],
            visibility: normalizeSiteVisibility(site.visibility),
            visibleUserIds: normalizeUserIds(site.visibleUserIds),
            enabled: site.enabled !== false,
            order: Number(site.order) || 0,
            createdAt: Number(site.createdAt) || Date.now(),
            updatedAt: Number(site.updatedAt) || Date.now(),
          } satisfies Site
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .filter((site) => groupIds.has(site.groupId))
    : []

  return { groups, sites }
}

async function migrateLegacy(): Promise<void> {
  if (migrated) return
  if (migrationPromise) return migrationPromise

  migrationPromise = (async () => {
    await ensureDataDir()
    const config = await readConfig()
    if (!config.admin?.username || !config.admin.passwordHash) {
      migrated = true
      return
    }

    const existing = await readJson<{ users?: User[] }>(USERS_PATH)
    if (existing?.users?.length) {
      migrated = true
      return
    }

    const adminId = crypto.randomUUID()
    const now = Date.now()
    const admin: User = {
      id: adminId,
      username: config.admin.username,
      passwordHash: config.admin.passwordHash,
      role: 'admin',
      enabled: true,
      createdAt: config.createdAt || now,
      updatedAt: now,
    }
    await writeJson(USERS_PATH, { users: [admin] })
    usersCache = [admin]

    const legacy = await readJson<SitesData>(LEGACY_SITES_PATH)
    if (legacy) {
      await writePanel(adminId, normalizePanel(legacy))
    }

    await writeConfig({
      initialized: config.initialized,
      jwtSecret: config.jwtSecret,
      createdAt: config.createdAt,
    })
    migrated = true
  })().finally(() => {
    migrationPromise = null
  })

  return migrationPromise
}

// ============ Users ============

export async function readUsers(): Promise<User[]> {
  await migrateLegacy()
  if (usersCache) return usersCache
  const parsed = await readJson<{ users?: User[] }>(USERS_PATH)
  usersCache = Array.isArray(parsed?.users) ? parsed!.users : []
  return usersCache
}

export async function writeUsers(users: User[]): Promise<void> {
  usersCache = users
  await writeJson(USERS_PATH, { users })
}

export async function getUserById(id: string): Promise<User | null> {
  const users = await readUsers()
  return users.find((user) => user.id === id) ?? null
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const users = await readUsers()
  const target = username.trim().toLowerCase()
  return users.find((user) => user.username.toLowerCase() === target) ?? null
}

export async function countAdmins(users?: User[]): Promise<number> {
  const list = users ?? (await readUsers())
  return list.filter((user) => user.role === 'admin' && user.enabled).length
}

// ============ Invites ============

export async function readInvites(): Promise<InviteCode[]> {
  if (invitesCache) return invitesCache
  await ensureDataDir()
  const parsed = await readJson<{ invites?: InviteCode[] }>(INVITES_PATH)
  invitesCache = Array.isArray(parsed?.invites) ? parsed!.invites : []
  return invitesCache
}

export async function writeInvites(invites: InviteCode[]): Promise<void> {
  invitesCache = invites
  await writeJson(INVITES_PATH, { invites })
}

export function createInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(10)
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i] % alphabet.length]
  }
  return code
}

// ============ Panels ============

function panelPath(userId: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
    throw new Error('Invalid user id')
  }
  return path.join(PANELS_DIR, `${userId}.json`)
}

function emptyPanel(): SitesData {
  return { groups: [], sites: [] }
}

export async function readPanel(userId: string): Promise<SitesData> {
  const cached = panelCache.get(userId)
  if (cached) return cached

  await ensureDataDir()
  const parsed = await readJson<unknown>(panelPath(userId))
  const panel = parsed ? normalizePanel(parsed) : emptyPanel()
  panelCache.set(userId, panel)
  return panel
}

export async function writePanel(userId: string, data: SitesData): Promise<SitesData> {
  const normalized = normalizePanel(data)
  panelCache.set(userId, normalized)
  await writeJson(panelPath(userId), normalized)
  return normalized
}

export function createDefaultPanel(): SitesData {
  const now = Date.now()
  return {
    groups: [
      {
        id: crypto.randomUUID(),
        name: '我的导航',
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
    ],
    sites: [],
  }
}

export async function ensurePanel(userId: string): Promise<SitesData> {
  const panel = await readPanel(userId)
  if (panel.groups.length === 0 && panel.sites.length === 0) {
    return writePanel(userId, createDefaultPanel())
  }
  return panel
}

export async function deletePanel(userId: string): Promise<void> {
  panelCache.delete(userId)
  try {
    await fs.unlink(panelPath(userId))
  } catch {
    // 文件不存在时忽略
  }
}

// ============ 上传文件 ============

export function getUploadsDir(): string {
  return UPLOADS_DIR
}

export async function saveUploadFile(file: File): Promise<string> {
  await ensureDataDir()
  const originalExt = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const ext = /^[a-z0-9]{1,8}$/.test(originalExt) ? originalExt : 'bin'
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`
  const arrayBuffer = await file.arrayBuffer()
  await fs.writeFile(path.join(UPLOADS_DIR, filename), Buffer.from(arrayBuffer))
  return `/uploads/${filename}`
}

export async function saveUploadBuffer(buffer: Buffer, ext: string): Promise<string> {
  await ensureDataDir()
  const safeExt = /^[a-z0-9]{1,8}$/i.test(ext) ? ext.toLowerCase() : 'png'
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${safeExt}`
  await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer)
  return `/uploads/${filename}`
}

export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(path.join(DATA_DIR, relativePath))
    return true
  } catch {
    return false
  }
}

export interface UploadedFile {
  filename: string
  url: string
  size: number
  createdAt: number
}

const IMAGE_FILE_RE = /\.(png|jpe?g|gif|svg|ico|webp)$/i

export async function listUploadFiles(): Promise<UploadedFile[]> {
  await ensureDataDir()
  let entries
  try {
    entries = await fs.readdir(UPLOADS_DIR, { withFileTypes: true })
  } catch {
    return []
  }

  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && IMAGE_FILE_RE.test(entry.name))
      .map(async (entry) => {
        const stat = await fs.stat(path.join(UPLOADS_DIR, entry.name))
        return {
          filename: entry.name,
          url: `/uploads/${entry.name}`,
          size: stat.size,
          createdAt: stat.mtimeMs,
        }
      })
  )

  return files.sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteUploadFile(filename: string): Promise<boolean> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename)) return false
  const target = path.join(UPLOADS_DIR, filename)
  if (path.dirname(target) !== UPLOADS_DIR) return false
  try {
    await fs.unlink(target)
    return true
  } catch {
    return false
  }
}

// ============ 离线文件（html / svg / 图片） ============

const FILE_NAME_RE = /^[^\u0000-\u001f\\/:*?"<>|]{1,120}$/

let fileMetaCache: Record<string, StoredFile> | null = null

export function getFilesDir(): string {
  return FILES_DIR
}

export function isValidFileName(name: string): boolean {
  return FILE_NAME_RE.test(name) && name !== '.' && name !== '..'
}

export async function readFileMetas(): Promise<Record<string, StoredFile>> {
  if (fileMetaCache) return fileMetaCache
  await ensureDataDir()
  const parsed = await readJson<{ files?: Record<string, StoredFile> }>(FILES_META_PATH)
  fileMetaCache = parsed?.files && typeof parsed.files === 'object' ? parsed.files : {}
  return fileMetaCache
}

async function writeFileMetas(files: Record<string, StoredFile>): Promise<void> {
  fileMetaCache = files
  await writeJson(FILES_META_PATH, { files })
}

export async function getStoredFile(name: string): Promise<StoredFile | null> {
  if (!isValidFileName(name)) return null
  const metas = await readFileMetas()
  return metas[name] ?? null
}

function uniqueFileName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name
  const ext = path.extname(name)
  const base = ext ? name.slice(0, -ext.length) : name
  let index = 2
  while (taken.has(`${base}-${index}${ext}`)) index += 1
  return `${base}-${index}${ext}`
}

export async function saveStoredFile(input: {
  name: string
  buffer: Buffer
  mime: string
  ownerId: string
  inline: boolean
}): Promise<StoredFile> {
  return withDataLock(async () => {
    await ensureDataDir()
    const cleaned =
      path
        .basename(input.name.replace(/\\/g, '/'))
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
        .replace(/^\.+/, '')
        .trim()
        .slice(0, 120) || `file-${Date.now()}`

    const metas = await readFileMetas()
    const existing = new Set<string>(Object.keys(metas))
    try {
      for (const entry of await fs.readdir(FILES_DIR)) existing.add(entry)
    } catch {
      // 目录还不存在时忽略
    }

    const name = uniqueFileName(cleaned, existing)
    await fs.writeFile(path.join(FILES_DIR, name), input.buffer)

    const meta: StoredFile = {
      name,
      inline: input.inline,
      size: input.buffer.length,
      mime: input.mime,
      ownerId: input.ownerId,
      createdAt: Date.now(),
    }
    await writeFileMetas({ ...metas, [name]: meta })
    return meta
  })
}

export async function setStoredFileInline(name: string, inline: boolean): Promise<StoredFile | null> {
  if (!isValidFileName(name)) return null
  return withDataLock(async () => {
    const metas = await readFileMetas()
    const meta = metas[name]
    if (!meta) return null
    const next = { ...meta, inline }
    await writeFileMetas({ ...metas, [name]: next })
    return next
  })
}

export async function readStoredFileBuffer(name: string): Promise<Buffer | null> {
  if (!isValidFileName(name)) return null
  try {
    return await fs.readFile(path.join(FILES_DIR, name))
  } catch {
    return null
  }
}

// 备份用：管理员取全部离线文件，成员只取自己上传的
async function readStoredFiles(ownerId?: string): Promise<Map<string, Buffer>> {
  await ensureDataDir()
  const metas = await readFileMetas()
  const result = new Map<string, Buffer>()
  let entries: string[] = []
  try {
    entries = (await fs.readdir(FILES_DIR, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
  } catch {
    return result
  }
  for (const name of entries) {
    if (!isValidFileName(name)) continue
    if (ownerId && metas[name]?.ownerId !== ownerId) continue
    try {
      result.set(name, await fs.readFile(path.join(FILES_DIR, name)))
    } catch {
      // 跳过读取失败的文件
    }
  }
  return result
}

// ============ 数据导出 / 导入 ============

function collectUploadRefs(panels: SitesData[], branding?: Branding): Set<string> {
  const refs = new Set<string>()
  const add = (value?: string) => {
    if (value?.startsWith('/uploads/')) refs.add(path.basename(value))
  }
  for (const panel of panels) {
    for (const site of panel.sites) {
      if (site.icon.type === 'uploaded') add(site.icon.value)
    }
  }
  add(branding?.logoUrl)
  add(branding?.faviconUrl)
  return refs
}

async function readUploads(filenames?: Set<string>): Promise<Map<string, Buffer>> {
  await ensureDataDir()
  const result = new Map<string, Buffer>()
  let entries: string[] = []
  try {
    entries = (await fs.readdir(UPLOADS_DIR, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
  } catch {
    return result
  }
  for (const name of entries) {
    if (filenames && !filenames.has(name)) continue
    try {
      result.set(name, await fs.readFile(path.join(UPLOADS_DIR, name)))
    } catch {
      // 跳过读取失败的文件
    }
  }
  return result
}

export async function buildBackup(user: {
  id: string
  username: string
  role: string
}): Promise<{
  backup: BackupFile
  uploads: Map<string, Buffer>
  files: Map<string, Buffer>
}> {
  if (user.role === 'admin') {
    const config = await readConfig()
    const users = await readUsers()
    const invites = await readInvites()
    const panels: Record<string, SitesData> = {}
    for (const item of users) {
      panels[item.id] = await readPanel(item.id)
    }
    const branding = normalizeBranding(config.branding)
    const backup: BackupFile = {
      format: 'ricpanel-backup',
      version: 1,
      scope: 'all',
      exportedAt: Date.now(),
      config: {
        initialized: config.initialized,
        createdAt: config.createdAt,
        branding,
        webdav: normalizeWebdav(config.webdav),
        access: normalizeAccess(config.access),
      },
      users,
      invites,
      panels,
    }
    const uploads = await readUploads(collectUploadRefs(Object.values(panels), branding))
    const files = await readStoredFiles()
    return { backup, uploads, files }
  }

  const panel = await readPanel(user.id)
  const uploads = await readUploads(collectUploadRefs([panel]))
  const files = await readStoredFiles(user.id)
  return {
    backup: {
      format: 'ricpanel-backup',
      version: 1,
      scope: 'user',
      exportedAt: Date.now(),
      owner: { id: user.id, username: user.username },
      panel,
    },
    uploads,
    files,
  }
}

export interface ImportResult {
  scope: 'all' | 'user'
  users: number
  panels: number
  uploads: number
}

export async function restoreBackup(
  backup: BackupFile,
  importer: { id: string; role: string },
  uploads: Map<string, Buffer> = new Map(),
  files: Map<string, Buffer> = new Map()
): Promise<ImportResult> {
  if (backup.scope === 'all') {
    if (importer.role !== 'admin') throw new Error('仅管理员可导入完整备份')
    if (!backup.config || !Array.isArray(backup.users) || !backup.panels) {
      throw new Error('备份文件不完整')
    }
    const config = await readConfig()
    await writeConfig({
      ...config,
      initialized: true,
      createdAt: backup.config.createdAt || config.createdAt,
      branding: normalizeBranding(backup.config.branding),
      webdav: backup.config.webdav
        ? normalizeWebdav(backup.config.webdav)
        : normalizeWebdav(config.webdav),
      access: backup.config.access
        ? normalizeAccess(backup.config.access)
        : normalizeAccess(config.access),
    })
    await writeUsers(backup.users)
    await writeInvites(Array.isArray(backup.invites) ? backup.invites : [])

    const keep = new Set(Object.keys(backup.panels))
    for (const [userId, panel] of Object.entries(backup.panels)) {
      await writePanel(userId, panel)
    }
    let panelFiles: string[] = []
    try {
      panelFiles = await fs.readdir(PANELS_DIR)
    } catch {
      panelFiles = []
    }
    for (const file of panelFiles) {
      const userId = file.replace(/\.json$/, '')
      if (!keep.has(userId)) await deletePanel(userId)
    }

    let count = 0
    for (const [filename, buffer] of uploads) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename)) continue
      await ensureDataDir()
      await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer)
      count += 1
    }
    await writeRestoredFiles(files, importer.id)

    return { scope: 'all', users: backup.users.length, panels: keep.size, uploads: count }
  }

  if (!backup.panel) throw new Error('备份文件缺少面板数据')
  await writePanel(importer.id, backup.panel)
  let count = 0
  for (const [filename, buffer] of uploads) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename)) continue
    await ensureDataDir()
    await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer)
    count += 1
  }
  await writeRestoredFiles(files, importer.id)
  return { scope: 'user', users: 0, panels: 1, uploads: count }
}

// 恢复离线文件：文件名已存在时直接覆盖，未登记元数据的补一条记录
async function writeRestoredFiles(
  files: Map<string, Buffer>,
  importerId: string
): Promise<void> {
  if (files.size === 0) return
  await ensureDataDir()
  const metas = { ...(await readFileMetas()) }
  for (const [name, buffer] of files) {
    if (!isValidFileName(name)) continue
    await fs.writeFile(path.join(FILES_DIR, name), buffer)
    if (!metas[name]) {
      const ext = path.extname(name).slice(1).toLowerCase()
      metas[name] = {
        name,
        inline: true,
        size: buffer.length,
        mime: ext === 'html' || ext === 'htm' ? 'text/html' : ext === 'svg' ? 'image/svg+xml' : 'application/octet-stream',
        ownerId: importerId,
        createdAt: Date.now(),
      }
    }
  }
  await writeFileMetas(metas)
}

export async function exportAllData(userId: string): Promise<{
  sitesData: SitesData
  uploads: Map<string, Buffer>
}> {
  const sitesData = await readPanel(userId)
  const uploads = await readUploads(collectUploadRefs([sitesData]))
  return { sitesData, uploads }
}

