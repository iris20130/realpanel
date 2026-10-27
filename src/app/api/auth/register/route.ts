import { NextResponse } from 'next/server'
import { register } from '@/lib/auth'
import { isInitialized } from '@/lib/db'

export async function POST(request: Request) {
  try {
    if (!(await isInitialized())) {
      return NextResponse.json({ error: '系统尚未初始化' }, { status: 400 })
    }

    const body = await request.json()
    const username = String(body.username ?? '').trim()
    const password = String(body.password ?? '')
    const inviteCode = String(body.inviteCode ?? '')

    const result = await register(username, password, inviteCode)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ token: result.token, user: result.user })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: '注册失败' }, { status: 500 })
  }
}
