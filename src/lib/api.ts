import type {
  BackupFile,
  Branding,
  Group,
  InviteCode,
  PanelAccess,
  PublicUser,
  Site,
  SiteIcon,
  SitesData,
  StoredFile,
  WebDavConfig,
  WebDavEntry,
} from '@/types'

const API_BASE = '/api'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  token?: string | null
}

export interface UserWithStats extends PublicUser {
  groupCount: number
  siteCount: number
}

export interface UploadedFile {
  filename: string
  url: string
  size: number
  createdAt: number
}

export interface StoredFileResult extends StoredFile {
  path: string
}

export interface WebdavStatus {
  enabled: boolean
  internalUrl: string
  externalUrl: string | null
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options

  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }))
    throw new ApiError(response.status, error.error || '请求失败')
  }

  return response.json()
}

export const api = {
  getSetupStatus: () => request<{ initialized: boolean }>('/setup/status'),
  initSetup: (username: string, password: string) =>
    request<{ token: string; user: PublicUser }>('/setup/init', {
      method: 'POST',
      body: { username, password },
    }),

  login: (username: string, password: string) =>
    request<{ token: string; user: PublicUser }>('/auth/login', {
      method: 'POST',
      body: { username, password },
    }),
  register: (username: string, password: string, inviteCode: string) =>
    request<{ token: string; user: PublicUser }>('/auth/register', {
      method: 'POST',
      body: { username, password, inviteCode },
    }),
  me: (token: string) => request<PublicUser>('/auth/me', { token }),

  getPanel: (token: string) => request<SitesData>('/panel', { token }),
  getPublicPanel: (token?: string | null) =>
    request<{ adminName: string | null; viewerName: string | null; panel: SitesData }>(
      '/public/panel',
      { token }
    ),
  getBranding: () => request<Branding>('/branding'),
  getAccess: (token: string) => request<PanelAccess>('/access', { token }),

  // 离线文件：上传后按 /<文件名> 访问
  files: {
    upload: async (token: string, file: File, inline = true): Promise<StoredFileResult> => {
      const form = new FormData()
      form.append('file', file)
      form.append('inline', String(inline))
      const response = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '上传失败' }))
        throw new ApiError(response.status, error.error || '上传失败')
      }
      return response.json()
    },
    setInline: (token: string, name: string, inline: boolean) =>
      request<StoredFile>(`/files/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: { inline },
        token,
      }),
  },

  webdav: {
    status: () => request<WebdavStatus>('/webdav/status'),
    list: (token: string, path: string) =>
      request<{ path: string; entries: WebDavEntry[] }>('/webdav/list', {
        method: 'POST',
        body: { path },
        token,
      }),
  },

  admin: {
    getUserPanel: (token: string, userId: string) =>
      request<{ user: PublicUser; panel: SitesData }>(`/admin/users/${userId}/panel`, { token }),

    getUsers: (token: string) => request<UserWithStats[]>('/admin/users', { token }),
    createUser: (token: string, input: { username: string; password: string; role: string }) =>
      request<PublicUser>('/admin/users', { method: 'POST', body: input, token }),
    updateUser: (
      token: string,
      id: string,
      updates: { username?: string; password?: string; role?: string; enabled?: boolean }
    ) => request<PublicUser>(`/admin/users/${id}`, { method: 'PUT', body: updates, token }),
    deleteUser: (token: string, id: string) =>
      request<{ success: boolean }>(`/admin/users/${id}`, { method: 'DELETE', token }),

    getInvites: (token: string) => request<InviteCode[]>('/admin/invites', { token }),
    createInvite: (
      token: string,
      input: { note?: string; maxUses?: number; expiresInDays?: number }
    ) => request<InviteCode>('/admin/invites', { method: 'POST', body: input, token }),
    updateInvite: (token: string, code: string, updates: { enabled?: boolean }) =>
      request<InviteCode>(`/admin/invites/${code}`, { method: 'PUT', body: updates, token }),
    deleteInvite: (token: string, code: string) =>
      request<{ success: boolean }>(`/admin/invites/${code}`, { method: 'DELETE', token }),

    getGroups: (token: string) => request<Group[]>('/admin/groups', { token }),
    createGroup: (
      token: string,
      name: string,
      visibility?: string,
      visibleUserIds?: string[]
    ) =>
      request<Group>('/admin/groups', {
        method: 'POST',
        body: { name, visibility, visibleUserIds },
        token,
      }),
    updateGroup: (
      token: string,
      id: string,
      updates: { name: string; visibility?: string; visibleUserIds?: string[] }
    ) => request<Group>(`/admin/groups/${id}`, { method: 'PUT', body: updates, token }),
    deleteGroup: (token: string, id: string) =>
      request<{ success: boolean }>(`/admin/groups/${id}`, { method: 'DELETE', token }),
    reorderGroups: (token: string, orders: { id: string; order: number }[]) =>
      request<{ success: boolean }>('/admin/groups/reorder', {
        method: 'PUT',
        body: { groupOrders: orders },
        token,
      }),

    getSites: (token: string) => request<Site[]>('/admin/sites', { token }),
    createSite: (token: string, site: Partial<Site>) =>
      request<Site>('/admin/sites', { method: 'POST', body: site, token }),
    updateSite: (token: string, id: string, site: Partial<Site>) =>
      request<Site>(`/admin/sites/${id}`, { method: 'PUT', body: site, token }),
    deleteSite: (token: string, id: string) =>
      request<{ success: boolean }>(`/admin/sites/${id}`, { method: 'DELETE', token }),
    reorderSites: (token: string, orders: { id: string; order: number }[]) =>
      request<{ success: boolean }>('/admin/sites/reorder', {
        method: 'PUT',
        body: { siteOrders: orders },
        token,
      }),

    uploadIcon: async (token: string, file: File): Promise<{ url: string }> => {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`${API_BASE}/admin/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      return response.json()
    },
    getFavicon: (token: string, url: string) =>
      request<{ url: string } | { error: string }>(
        `/admin/favicon?url=${encodeURIComponent(url)}`,
        { token }
      ),
    getUploads: (token: string) => request<UploadedFile[]>('/admin/uploads', { token }),
    deleteUpload: (token: string, filename: string) =>
      request<{ success: boolean }>(`/admin/uploads/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        token,
      }),
    searchIconify: (token: string, query: string) =>
      request<{ icons: string[] }>(`/admin/iconify/search?q=${encodeURIComponent(query)}`, {
        token,
      }),
    detectIcon: (token: string, url: string, title?: string) =>
      request<{ icon: SiteIcon; source: 'iconify' | 'favicon' }>('/admin/icon/detect', {
        method: 'POST',
        body: { url, title },
        token,
      }),

    getWebdav: (token: string) => request<WebDavConfig>('/admin/webdav', { token }),
    saveWebdav: (token: string, config: WebDavConfig) =>
      request<WebDavConfig>('/admin/webdav', { method: 'PUT', body: config, token }),
    testWebdav: (token: string, config: WebDavConfig) =>
      request<{ success: boolean; count: number }>('/admin/webdav', {
        method: 'POST',
        body: config,
        token,
      }),
    saveAccess: (token: string, access: PanelAccess) =>
      request<PanelAccess>('/admin/access', { method: 'PUT', body: access, token }),

    getAccount: (token: string) => request<PublicUser>('/admin/account', { token }),
    updateBranding: (token: string, branding: Branding) =>
      request<Branding>('/admin/branding', { method: 'PUT', body: branding, token }),    updateAccount: (token: string, updates: { username?: string; password?: string }) =>
      request<{ success: boolean; user: PublicUser; token: string }>('/admin/account', {
        method: 'PUT',
        body: updates,
        token,
      }),

    exportData: (token: string) => request<BackupFile>('/admin/export', { token }),
    importData: (token: string, data: BackupFile | SitesData) =>
      request<{ success: boolean }>('/admin/import', { method: 'POST', body: data, token }),
    importFile: async (token: string, file: File): Promise<{ success: boolean; scope?: string }> => {
      const form = new FormData()
      form.append('file', file)
      const response = await fetch(`${API_BASE}/admin/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '导入失败' }))
        throw new ApiError(response.status, error.error || '导入失败')
      }
      return response.json()
    },
    exportAll: async (token: string): Promise<Blob> => {
      const response = await fetch(`${API_BASE}/admin/export-all`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new ApiError(response.status, '导出失败')
      return response.blob()
    },
  },
}

export { ApiError }
