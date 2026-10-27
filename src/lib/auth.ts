import { SignJWT, jwtVerify } from 'jose'
import { compare, hash } from 'bcryptjs'
import {
  countAdmins,
  createDefaultPanel,
  createInviteCode,
  deletePanel,
  ensurePanel,
  getUserById,
  getUserByUsername,
  readConfig,
  readInvites,
  readUsers,
  withDataLock,
  writeConfig,
  writeInvites,
  writePanel,
  writeUsers,
} from './db'
import type { InviteCode, PublicUser, User, UserRole } from '@/types'

const JWT_ALG = 'HS256'
const TOKEN_TTL = '7d'

export interface TokenPayload {
  sub: string
  username: string
  role: UserRole
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    enabled: user.enabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10)
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash)
}

export async function createToken(user: User, secret: string): Promise<string> {
  return new SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(new TextEncoder().encode(secret))
}

export async function verifyToken(token: string, secret: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    if (typeof payload.sub !== 'string') return null
    return {
      sub: payload.sub,
      username: typeof payload.username === 'string' ? payload.username : '',
      role: payload.role === 'admin' ? 'admin' : 'user',
    }
  } catch {
    return null
  }
}

export function validateUsername(username: string): string | null {
  if (username.length < 2 || username.length > 32) return '用户名长度需为 2-32 个字符'
  if (!/^[\p{L}\p{N}_.-]+$/u.test(username)) return '用户名只能包含字母、数字、中文、下划线、点和短横线'
  return null
}

export function validatePassword(password: string): string | null {
  if (password.length < 6) return '密码至少需要 6 个字符'
  if (password.length > 128) return '密码不能超过 128 个字符'
  return null
}

export async function initializeAdmin(
  username: string,
  password: string
): Promise<{ success: boolean; token?: string; user?: PublicUser; error?: string }> {
  return withDataLock(async () => {
    const config = await readConfig()
    const users = await readUsers()

    if (config.initialized || users.length > 0) {
      return { success: false, error: '系统已初始化' }
    }

    const usernameError = validateUsername(username.trim())
    if (usernameError) return { success: false, error: usernameError }
    const passwordError = validatePassword(password)
    if (passwordError) return { success: false, error: passwordError }

    const now = Date.now()
    const admin: User = {
      id: crypto.randomUUID(),
      username: username.trim(),
      passwordHash: await hashPassword(password),
      role: 'admin',
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }

    await writeUsers([admin])
    await writePanel(admin.id, createDefaultPanel())
    await writeConfig({
      initialized: true,
      jwtSecret: config.jwtSecret,
      createdAt: now,
    })

    const token = await createToken(admin, config.jwtSecret)
    return { success: true, token, user: toPublicUser(admin) }
  })
}

export async function login(
  username: string,
  password: string
): Promise<{ success: boolean; token?: string; user?: PublicUser; error?: string }> {
  const config = await readConfig()
  if (!config.initialized) return { success: false, error: '系统尚未初始化' }

  const user = await getUserByUsername(username)
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { success: false, error: '用户名或密码错误' }
  }
  if (!user.enabled) {
    return { success: false, error: '该账户已被停用' }
  }

  const token = await createToken(user, config.jwtSecret)
  return { success: true, token, user: toPublicUser(user) }
}

export async function register(
  username: string,
  password: string,
  inviteCode: string
): Promise<{ success: boolean; token?: string; user?: PublicUser; error?: string }> {
  return withDataLock(async () => {
    const code = inviteCode.trim().toUpperCase()
    if (!code) return { success: false, error: '请输入邀请码' }

    const usernameError = validateUsername(username.trim())
    if (usernameError) return { success: false, error: usernameError }
    const passwordError = validatePassword(password)
    if (passwordError) return { success: false, error: passwordError }

    const invites = await readInvites()
    const invite = invites.find((item) => item.code === code)
    if (!invite || !invite.enabled) return { success: false, error: '邀请码无效' }
    if (invite.expiresAt && invite.expiresAt < Date.now()) {
      return { success: false, error: '邀请码已过期' }
    }
    if (invite.maxUses > 0 && invite.usedCount >= invite.maxUses) {
      return { success: false, error: '邀请码使用次数已用尽' }
    }

    if (await getUserByUsername(username.trim())) {
      return { success: false, error: '用户名已被占用' }
    }

    const config = await readConfig()
    const now = Date.now()
    const user: User = {
      id: crypto.randomUUID(),
      username: username.trim(),
      passwordHash: await hashPassword(password),
      role: 'user',
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }

    await writeUsers([...(await readUsers()), user])
    await writePanel(user.id, createDefaultPanel())

    invite.usedCount += 1
    invite.usedBy.push({ userId: user.id, username: user.username, at: now })
    await writeInvites(invites)

    const token = await createToken(user, config.jwtSecret)
    return { success: true, token, user: toPublicUser(user) }
  })
}

export async function verifyAuth(request: Request): Promise<PublicUser | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const config = await readConfig()
  if (!config.initialized) return null

  const payload = await verifyToken(authHeader.slice(7), config.jwtSecret)
  if (!payload) return null

  const user = await getUserById(payload.sub)
  if (!user || !user.enabled) return null
  return toPublicUser(user)
}

export async function updateAccount(
  userId: string,
  updates: { username?: string; password?: string }
): Promise<{ success: boolean; user?: PublicUser; token?: string; error?: string }> {
  return withDataLock(async () => {
    const users = await readUsers()
    const index = users.findIndex((item) => item.id === userId)
    if (index === -1) return { success: false, error: '用户不存在' }

    const target = users[index]
    let username = target.username

    if (updates.username && updates.username.trim() !== target.username) {
      const usernameError = validateUsername(updates.username.trim())
      if (usernameError) return { success: false, error: usernameError }
      const duplicate = await getUserByUsername(updates.username.trim())
      if (duplicate && duplicate.id !== userId) {
        return { success: false, error: '用户名已被占用' }
      }
      username = updates.username.trim()
    }

    if (updates.password) {
      const passwordError = validatePassword(updates.password)
      if (passwordError) return { success: false, error: passwordError }
    }

    const updated: User = {
      ...target,
      username,
      passwordHash: updates.password ? await hashPassword(updates.password) : target.passwordHash,
      updatedAt: Date.now(),
    }
    users[index] = updated
    await writeUsers(users)

    const config = await readConfig()
    const token = await createToken(updated, config.jwtSecret)
    return { success: true, user: toPublicUser(updated), token }
  })
}

export async function createUserAsAdmin(input: {
  username: string
  password: string
  role: UserRole
}): Promise<{ success: boolean; user?: PublicUser; error?: string }> {
  return withDataLock(async () => {
    const usernameError = validateUsername(input.username.trim())
    if (usernameError) return { success: false, error: usernameError }
    const passwordError = validatePassword(input.password)
    if (passwordError) return { success: false, error: passwordError }

    if (await getUserByUsername(input.username.trim())) {
      return { success: false, error: '用户名已被占用' }
    }

    const now = Date.now()
    const user: User = {
      id: crypto.randomUUID(),
      username: input.username.trim(),
      passwordHash: await hashPassword(input.password),
      role: input.role === 'admin' ? 'admin' : 'user',
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
    await writeUsers([...(await readUsers()), user])
    await writePanel(user.id, createDefaultPanel())
    return { success: true, user: toPublicUser(user) }
  })
}

export async function updateUserAsAdmin(
  actorId: string,
  targetId: string,
  updates: {
    username?: string
    password?: string
    role?: UserRole
    enabled?: boolean
  }
): Promise<{ success: boolean; user?: PublicUser; error?: string }> {
  return withDataLock(async () => {
    const users = await readUsers()
    const index = users.findIndex((item) => item.id === targetId)
    if (index === -1) return { success: false, error: '用户不存在' }

    const target = users[index]
    const nextRole = updates.role ?? target.role
    const nextEnabled = updates.enabled ?? target.enabled

    if (target.role === 'admin' && (nextRole !== 'admin' || !nextEnabled)) {
      const adminCount = await countAdmins(users)
      if (adminCount <= 1) {
        return { success: false, error: '至少需要保留一名可用的管理员' }
      }
    }

    if (actorId === targetId && (!nextEnabled || nextRole !== 'admin')) {
      return { success: false, error: '不能停用或降级当前登录的管理员' }
    }

    let username = target.username
    if (updates.username && updates.username.trim() !== target.username) {
      const usernameError = validateUsername(updates.username.trim())
      if (usernameError) return { success: false, error: usernameError }
      const duplicate = await getUserByUsername(updates.username.trim())
      if (duplicate && duplicate.id !== targetId) {
        return { success: false, error: '用户名已被占用' }
      }
      username = updates.username.trim()
    }

    if (updates.password) {
      const passwordError = validatePassword(updates.password)
      if (passwordError) return { success: false, error: passwordError }
    }

    const updated: User = {
      ...target,
      username,
      role: nextRole,
      enabled: nextEnabled,
      passwordHash: updates.password ? await hashPassword(updates.password) : target.passwordHash,
      updatedAt: Date.now(),
    }
    users[index] = updated
    await writeUsers(users)

    if (nextEnabled) {
      await ensurePanel(targetId)
    }

    return { success: true, user: toPublicUser(updated) }
  })
}

export async function deleteUserAsAdmin(
  actorId: string,
  targetId: string
): Promise<{ success: boolean; error?: string }> {
  if (actorId === targetId) {
    return { success: false, error: '不能删除当前登录的账户' }
  }

  return withDataLock(async () => {
    const users = await readUsers()
    const target = users.find((item) => item.id === targetId)
    if (!target) return { success: false, error: '用户不存在' }

    if (target.role === 'admin' && (await countAdmins(users)) <= 1) {
      return { success: false, error: '至少需要保留一名可用的管理员' }
    }

    await writeUsers(users.filter((item) => item.id !== targetId))
    await deletePanel(targetId)
    return { success: true }
  })
}

// ============ 邀请码管理 ============

export async function createInvite(input: {
  note?: string
  maxUses?: number
  expiresInDays?: number
  createdBy: string
}): Promise<{ success: boolean; invite?: InviteCode; error?: string }> {
  return withDataLock(async () => {
    const maxUses =
      typeof input.maxUses === 'number' && Number.isFinite(input.maxUses)
        ? Math.max(0, Math.min(999, Math.floor(input.maxUses)))
        : 1
    const days =
      typeof input.expiresInDays === 'number' && Number.isFinite(input.expiresInDays)
        ? Math.max(0, Math.min(3650, Math.floor(input.expiresInDays)))
        : 0

    const invites = await readInvites()
    let code = createInviteCode()
    while (invites.some((item) => item.code === code)) {
      code = createInviteCode()
    }

    const invite = {
      code,
      note: input.note?.trim() || undefined,
      maxUses,
      usedCount: 0,
      usedBy: [],
      expiresAt: days > 0 ? Date.now() + days * 24 * 60 * 60 * 1000 : undefined,
      enabled: true,
      createdAt: Date.now(),
      createdBy: input.createdBy,
    }
    invites.unshift(invite)
    await writeInvites(invites)
    return { success: true, invite }
  })
}
