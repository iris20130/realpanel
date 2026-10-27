// 用户角色
export type UserRole = 'admin' | 'user'

// 用户（服务端存储）
export interface User {
  id: string
  username: string
  passwordHash: string
  role: UserRole
  enabled: boolean
  createdAt: number
  updatedAt: number
}

// 对外返回的用户信息
export type PublicUser = Omit<User, 'passwordHash'>

// 邀请码
export interface InviteCode {
  code: string
  note?: string
  maxUses: number
  usedCount: number
  usedBy: { userId: string; username: string; at: number }[]
  expiresAt?: number
  enabled: boolean
  createdAt: number
  createdBy: string
}

// 可见范围：public 含未登录访客，members 登录成员，users 指定用户
export type VisibilityMode = 'public' | 'members' | 'users'
// 链接可跟随所属分组
export type SiteVisibility = 'inherit' | VisibilityMode

// 分组
export interface Group {
  id: string
  name: string
  order: number
  visibility?: VisibilityMode
  visibleUserIds?: string[]
  createdAt: number
  updatedAt: number
}

// 图标类型
export type IconType = 'iconify' | 'uploaded' | 'favicon'

export interface SiteIcon {
  type: IconType
  value: string
}

// 打开方式
export type OpenMode = 'current' | 'blank' | 'modal'

// 显示网络：auto 按填写的地址自动决定
export type NetworkScope = 'auto' | 'both' | 'intranet' | 'internet'
export type Network = 'intranet' | 'internet'

// 网站
export interface Site {
  id: string
  groupId: string
  title: string
  description?: string
  // 点击卡片时在页面中间弹出的自定义提示
  notice?: string
  icon: SiteIcon
  externalUrl?: string
  internalUrl?: string
  networkScope?: NetworkScope
  openMode: OpenMode
  tags?: string[]
  visibility?: SiteVisibility
  visibleUserIds?: string[]
  enabled: boolean
  order: number
  createdAt: number
  updatedAt: number
}

// 数据存储
export interface SitesData {
  groups: Group[]
  sites: Site[]
}

// 备份文件：管理员为全量配置，成员仅本人面板
export interface BackupFile {
  format: 'ricpanel-backup'
  version: 1
  scope: 'all' | 'user'
  exportedAt: number
  owner?: { id: string; username: string }
  config?: {
    initialized: boolean
    createdAt: number
    jwtSecret?: string
    branding?: Branding
    webdav?: WebDavConfig
    access?: PanelAccess
  }
  users?: User[]
  invites?: InviteCode[]
  panels?: Record<string, SitesData>
  panel?: SitesData
}

// 品牌设置
export interface Branding {
  mode: 'logo' | 'text' | 'none'
  logoUrl: string
  text: string
  // 浏览器标签页图标，空则用内置 favicon.svg
  faviconUrl?: string
}

// 面板自身访问地址：离线文件、WebDAV 选中的文件按这两个前缀生成内外网链接
export interface PanelAccess {
  internalUrl?: string
  externalUrl?: string
}

// WebDAV / OpenList 挂载配置：内网直连 + 可选的公网反代地址
export interface WebDavConfig {
  enabled: boolean
  internalUrl: string
  externalUrl?: string
  username?: string
  password?: string
}

// WebDAV 目录项
export interface WebDavEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  modified?: string
  isImage: boolean
  internalUrl: string
  externalUrl?: string
  // 面板代理直链（相对路径，内外网通用，无需 WebDAV 账号）；默认优先内网
  fileUrl?: string
  // 强制走反代地址的代理直链
  externalFileUrl?: string
}

// 上传的离线文件（html / svg / 图片等），访问路径为 /<文件名>
export interface StoredFile {
  name: string
  inline: boolean
  size: number
  mime: string
  ownerId: string
  createdAt: number
}

// 配置
export interface Config {
  initialized: boolean
  jwtSecret: string
  createdAt: number
  branding?: Branding
  webdav?: WebDavConfig
  access?: PanelAccess
  // 旧版本单用户配置，仅用于迁移
  admin?: {
    username: string
    passwordHash: string
  }
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// 设置状态：all 为强制全部显示
export type NetworkMode = 'auto' | Network | 'all'
